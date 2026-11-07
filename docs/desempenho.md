# Desempenho: SLO, plano de p95 e medição

## SLO

Um único SLO, para o endpoint mais importante da API:

| Endpoint | Indicador (SLI) | Objetivo |
|---|---|---|
| `POST /orders` | latência p95, medida no servidor | **< 300 ms** |
| `POST /orders` | taxa de erro: respostas 5xx / total | **< 1%** |

**Janela:** em produção, 30 dias corridos, calculado a partir do Prometheus. No smoke test, cada execução é avaliada isoladamente.

### Por que esses valores

- **300 ms no p95.** Criar um pedido é uma ação interativa: alguém clica em "pedir" e espera a confirmação. Até ~300 ms a resposta ainda parece imediata. O trabalho por requisição é pequeno e limitado: 1 `SELECT` no cardápio e 1 transação com 2 `INSERT`s, sem chamadas externas. Num ambiente com rede e banco reais isso deve levar dezenas de milissegundos, então 300 ms dá folga para rede, banco em outra máquina e picos, sem virar uma meta impossível. Escolhemos o p95, e não a média, para o SLO enxergar a cauda que os usuários de fato sentem. O p99 só seria útil com mais tráfego e mais tempo de observação.
- **1% de erro 5xx.** Erros 4xx são do cliente (validação, produto inexistente, pedido já cancelado) e não contam. Um 5xx significa que o servidor falhou. Com 1%, o orçamento de erro é de 1 a cada 100 pedidos: rigoroso o suficiente para pegar regressões, mas tolerante a falhas pontuais de infraestrutura, como reinício do banco ou deploy.

### Como calcular a partir das métricas (PromQL)

A API expõe o histograma `http_request_duration_seconds` em `GET /metrics`, com os labels `method`, `route` (template da rota, ex.: `/orders/:id`) e `status_code`. Os buckets são `5ms, 10ms, 25ms, 50ms, 100ms, 200ms, 300ms, 500ms, 1s, 2,5s, 5s`. O limite de 300 ms existe exatamente para medir o SLO.

p95 da latência de `POST /orders` nos últimos 5 minutos:

```promql
histogram_quantile(
  0.95,
  sum by (le) (rate(http_request_duration_seconds_bucket{method="POST", route="/orders"}[5m]))
)
```

Taxa de erro 5xx de `POST /orders`:

```promql
sum(rate(http_request_duration_seconds_count{method="POST", route="/orders", status_code=~"5.."}[5m]))
/
sum(rate(http_request_duration_seconds_count{method="POST", route="/orders"}[5m]))
```

Fração das requisições abaixo de 300 ms (forma alternativa de acompanhar o mesmo SLO, sem interpolação):

```promql
sum(rate(http_request_duration_seconds_bucket{method="POST", route="/orders", le="0.3"}[5m]))
/
sum(rate(http_request_duration_seconds_count{method="POST", route="/orders"}[5m]))
```

O `histogram_quantile` interpola linearmente dentro do bucket, então o p95 do Prometheus é uma estimativa. Ele não bate exatamente com o p95 calculado pelo k6, que usa as amostras reais.

## Plano de p95

| Item | Definição |
|---|---|
| **O que é medido** | Latência e taxa de erro de `POST /orders` (alvo do SLO). `GET /orders/:id` também é medido, só como referência. |
| **Como** | k6 `2.3.0` (imagem oficial `grafana/k6:2.3.0`), em container, pelo profile `load` do `docker-compose.yml`. Script: `tests/load/smoke.js`. |
| **Cenário** | Smoke: 5 usuários virtuais constantes (`constant-vus`) por 1 minuto. Cada iteração cria um pedido com 1 a 3 produtos distintos do cardápio (quantidade de 1 a 5, sorteados), consulta o pedido criado por `GET /orders/:id` e espera 1 s. |
| **Checks** | `POST`: status 201 e `totalCents` igual ao calculado pelo script a partir do cardápio. `GET`: status 200 e mesmo `id` do pedido criado. |
| **Thresholds** (reprovam a execução, com código de saída 99) | `http_req_duration{endpoint:create_order}` p(95) < 300 ms; `http_req_failed` < 1%; `checks` > 99%. |
| **Tags** | `endpoint:create_order` e `endpoint:get_order`. O `name` fixo `GET /orders/:id` agrupa as URLs com ids diferentes numa só série. |
| **Resultado** | Resumo em texto no terminal e JSON completo em `tests/load/results/smoke-summary-<data-hora>.json`, um arquivo por execução (o conteúdo da pasta é ignorado pelo git). O texto mostra o nome do arquivo gravado. |

O `http_req_failed` do k6 é **mais rigoroso** que o SLO: conta qualquer resposta fora de 2xx/3xx, inclusive 4xx. Num cenário só com pedidos válidos, qualquer 4xx também indica problema.

### Por que o k6 não está no CI

Os runners do GitHub Actions são máquinas compartilhadas, com CPU, disco e vizinhos variando a cada execução. Um threshold de latência ali reprovaria builds por ruído do ambiente, não por regressão do código, e um CI instável acaba sendo ignorado. Medimos variação até numa máquina local dedicada (ver "Riscos e limitações"). O CI verifica correção (testes, coverage, compose sobe e responde `/health`). Desempenho é medido sob demanda, em ambiente conhecido, com o comando abaixo.

## Ambiente da medição

> **Máquina local de desenvolvimento.** Aplicação, PostgreSQL e k6 rodaram **no mesmo host**, disputando CPU e memória, e o tráfego não passou por rede real (rede interna do Docker). Os números servem para validar o cenário e detectar regressões grosseiras. Eles **não** representam a capacidade de um ambiente de produção.

| Item | Valor |
|---|---|
| Data | 07/11/2026, de 16:31:30 a 16:32:33 (UTC−3) |
| Sistema operacional | Windows 11 Pro 10.0.26200 (build 26200) |
| CPU | Intel Core i5-10210U @ 1,60 GHz, 4 núcleos / 8 threads (notebook) |
| Memória | 19,8 GB no host; 9,6 GiB disponíveis para a VM do Docker |
| Docker | Docker Desktop, engine 29.6.2, Compose 5.3.1, backend WSL2 (kernel 6.18.33.2-microsoft-standard-WSL2), 8 CPUs na VM |
| Aplicação | imagem `node:26-alpine` (Node 26.13.0), `LOG_LEVEL=info` |
| Banco | `postgres:16-alpine`, banco `orders_dev` com 299 pedidos antes da execução |
| Gerador de carga | `grafana/k6:2.3.0`, no mesmo host, na rede do compose (`http://api:3000`) |
| Outros processos | antivírus (Avast) ativo e uso normal de desktop durante a medição |

## Resultados medidos

Execução de 07/11/2026, das 16:31:30 às 16:32:33. Os números vieram do resumo JSON daquela execução. O arquivo era local, não versionado, e foi removido quando o nome dos resumos passou a incluir data e hora (ver "Repetibilidade").

**Volume**

| Métrica | Valor |
|---|---|
| Iterações completas | 295 (0 interrompidas) |
| Requisições totais | 590 (9,71 req/s) |
| `POST /orders` | 295 (4,86 req/s) |
| `GET /orders/:id` | 295 (4,86 req/s) |
| Requisições com falha (`http_req_failed`) | **0,00%** (0 de 590) |
| Checks aprovados | **100,00%** (1180 de 1180) |

**Latência por endpoint (medida pelo k6, em ms)**

| Endpoint | p50 | p90 | p95 | p99 | máximo | média | mínimo |
|---|---|---|---|---|---|---|---|
| `POST /orders` | 12,96 | 48,55 | **68,73** | 147,14 | 203,65 | 21,57 | 4,44 |
| `GET /orders/:id` | 3,38 | 6,97 | 7,90 | 12,48 | 20,19 | 4,10 | 1,56 |
| Todas | 6,67 | 24,34 | 48,50 | 98,64 | 203,65 | 12,83 | 1,56 |

**Thresholds**

| Threshold | Resultado |
|---|---|
| `http_req_duration{endpoint:create_order}`: p(95) < 300 ms | ✅ aprovado (68,73 ms) |
| `http_req_failed`: rate < 1% | ✅ aprovado (0,00%) |
| `checks`: rate > 99% | ✅ aprovado (100,00%) |

Código de saída do k6: `0`.

**Lado do servidor (histograma do Prometheus)**

Depois da execução, o `/metrics` da API mostrava todas as observações de `POST /orders` com status 201 no bucket `le="0.3"`: 590 de 590, somando esta execução e uma anterior do mesmo dia, ambas de 295 pedidos. Havia apenas 4 séries de rota (`/orders`, `/orders/:id`, `/health`, `/metrics`), confirmando que o label `route` não carrega ids.

### O SLO foi cumprido?

**Sim, neste cenário e neste ambiente.**
- **Latência:** o p95 de `POST /orders` foi 68,73 ms, contra o limite de 300 ms. Até o máximo (203,65 ms) ficou abaixo do limite.
- **Erros:** nenhum 5xx (nem qualquer outra falha) em 295 criações.

Com 5 VUs e cerca de 10 req/s, este resultado mostra que o fluxo funciona e que não há regressão grosseira. Ele não diz como a API se comporta com carga maior (ver limitações).

## Repetibilidade: 3 execuções seguidas

Mesmo cenário, mesmo comando (`docker compose --profile load run --rm k6`), mesma máquina e mesmo ambiente descritos acima. As 3 execuções rodaram em sequência em 07/11/2026, das 16:50 às 16:54, com a imagem da API já incluindo o Swagger UI em `/docs` (mudança sem efeito nas rotas medidas). Fonte: o resumo JSON de cada execução, versionado como evidência em [`docs/evidencias/k6/`](evidencias/k6/) (link na primeira coluna).

| Execução | Horário (UTC−3) | Pedidos no banco antes | p95 `POST /orders` | p50 | p99 | máximo | p95 `GET /orders/:id` | Falhas | Checks |
|---|---|---|---|---|---|---|---|---|---|
| [1](evidencias/k6/smoke-summary-2026-11-07T19-51-39-030Z.json) | 16:50:36 – 16:51:39 | 1479 | **35,59 ms** | 23,09 | 80,15 | 82,88 | 11,21 | 0 / 590 | 1180 / 1180 |
| [2](evidencias/k6/smoke-summary-2026-11-07T19-52-42-509Z.json) | 16:51:40 – 16:52:43 | 1774 | **33,24 ms** | 19,61 | 37,89 | 47,27 | 10,54 | 0 / 590 | 1180 / 1180 |
| [3](evidencias/k6/smoke-summary-2026-11-07T19-53-46-508Z.json) | 16:52:44 – 16:53:47 | 2069 | **31,29 ms** | 20,27 | 37,27 | 39,15 | 11,05 | 0 / 590 | 1180 / 1180 |

| Resumo do p95 de `POST /orders` | Valor |
|---|---|
| Mediana das 3 execuções | **33,24 ms** |
| Amplitude (máx − mín) | **4,30 ms** (31,29 a 35,59 ms), cerca de 13% da mediana |

As 3 execuções cumpriram o SLO e aprovaram todos os thresholds, com código de saída 0.

**Análise da variação:**

- **As 3 execuções seguidas concordam bem.** Amplitude de 4,30 ms no p95, todas cerca de 9× abaixo do limite de 300 ms.
- **Em janelas de tempo diferentes, a variação é bem maior.** Na mesma tarde, a execução das 16:29 mediu p95 de 36,76 ms e a das 16:31 (a medição detalhada acima) mediu 68,73 ms: o dobro da mediana destas três, sem mudança no código das rotas. Não identificamos a causa. As candidatas são carga de fundo no notebook (antivírus, desktop) e o agendamento de CPU da VM do Docker. Por isso, a mediana de várias execuções é mais confiável que qualquer número isolado, e uma diferença de algumas dezenas de milissegundos entre duas medições locais **não** deve ser lida como regressão.
- **As caudas variam mais que o p95.** O p99 foi de 37,27 a 80,15 ms e o máximo de 39,15 a 82,88 ms. Com 295 requisições por execução, o p99 se apoia em só ~3 amostras, então é estatisticamente fraco.
- **O volume do banco não pesou.** De 1479 para 2069 pedidos, o p95 não piorou (caiu levemente). Era o esperado: `POST /orders` e `GET /orders/:id` usam chave primária e índice, sem varrer a tabela. Isso **não** vale para `GET /orders` (risco 1).
- **3 execuções descartadas.** Entre 16:45 e 16:49 rodamos 3 execuções antes desta série. Elas rodaram normalmente, mas o resumo JSON não pôde ser gravado: o arquivo antigo pertencia a outro usuário do container (ver risco 9), e o k6 saiu com código 0 mesmo assim. Como não havia JSON para conferir, essas execuções ficaram fora da tabela, e o problema foi corrigido antes desta série.

## Riscos e limitações conhecidos

1. **`GET /orders` não tem paginação.** O endpoint devolve todos os pedidos, cada um com seus itens. A latência e o tamanho da resposta crescem linearmente com o volume de pedidos, e o consumo de memória do processo também, porque monta a lista inteira antes de serializar. Com alguns milhares de pedidos, isso pode estourar qualquer SLO e degradar os outros endpoints. **Melhoria futura:** paginação por cursor (`?limit=` com `createdAt`/`id` como cursor, aproveitando o índice `orders_created_at_idx`) e um limite máximo por página. Esse endpoint ficou fora do smoke test justamente para que esse crescimento não contamine a medição do SLO.
2. **Variação entre execuções.** Três execuções seguidas ficaram entre 31,29 e 35,59 ms de p95 (mediana 33,24 ms), mas uma execução no mesmo dia mediu 68,73 ms (ver "Repetibilidade"). Quase o dobro, sem mudança de código, mostra o quanto o ambiente local influencia. Compare a mediana de várias execuções, não um número isolado.
3. **Tudo no mesmo host.** O k6 compete por CPU com a API e o banco, e não há latência de rede real. Em produção, a rede soma latência. Por outro lado, a disputa por CPU deixa de existir.
4. **Smoke não é teste de capacidade.** 5 VUs com 1 s de pausa (~10 req/s) validam o caminho, não o limite. O pool do Knex tem no máximo 10 conexões e o Node roda num único processo. Não sabemos onde a latência começa a degradar. Para isso, faltaria um teste de carga com rampa (`ramping-arrival-rate`).
5. **O smoke escreve no banco de desenvolvimento.** Cada execução cria cerca de 295 pedidos em `orders_dev`, e eles se acumulam. Isso piora o risco 1 para quem usar `GET /orders` localmente. Para limpar: `docker compose exec db psql -U orders_user -d orders_dev -c "truncate order_items, orders"`.
6. **Latência do cliente e do servidor são coisas diferentes.** O k6 mede do lado do cliente: inclui a rede do Docker e a serialização. O histograma mede dentro do Fastify. O SLO é definido sobre o histograma do servidor, e o k6 serve de aproximação conservadora.
7. **p95 do Prometheus é estimado.** Entre 100, 200 e 300 ms os buckets são largos, e o `histogram_quantile` interpola. Para decidir se o SLO foi cumprido, a fração abaixo de `le="0.3"` é exata.
8. **`/metrics` não tem autenticação.** O endpoint fica na mesma porta da API. Em produção, ele deveria ficar restrito à rede interna ou numa porta separada.
9. **Permissão da pasta de resultados.** A imagem do k6 roda como uid 12345, que não pode escrever numa pasta do host Linux. Reproduzimos isso com uma pasta de dono 1000:1000 e modo 755 (permissão negada) e corrigimos assim:
   - o serviço `k6` roda como `${K6_UID:-1000}:${K6_GID:-1000}`;
   - a pasta `tests/load/results/` é versionada (com `.gitkeep`), para o Docker não criá-la como root num clone limpo;
   - cada execução grava um arquivo novo, com data e hora no nome, e nunca sobrescreve um arquivo de outro dono.

   Num Linux cujo usuário não seja o 1000, rode com `K6_UID=$(id -u) K6_GID=$(id -g) docker compose --profile load run --rm k6`. No Windows (Docker Desktop) foi verificado. No macOS, o compartilhamento de arquivos do Docker Desktop também não costuma restringir por uid, mas isso **não** foi testado. Atenção: se a gravação do JSON falhar por qualquer motivo, o k6 registra um erro e **mantém o código de saída 0**. Confira se o arquivo indicado no resumo existe.

## Como reproduzir

Na raiz do projeto:

```bash
# 1. Subir API e banco (aguarda os healthchecks)
docker compose up -d --build --wait

# 2. Rodar o smoke test (sobe api/db se ainda não estiverem no ar)
docker compose --profile load run --rm k6
#    Linux com usuário diferente do uid 1000:
#    K6_UID=$(id -u) K6_GID=$(id -g) docker compose --profile load run --rm k6

# 3. Resumo completo em JSON: um arquivo por execução, com data e hora no nome
ls tests/load/results/
```

O código de saída do passo 2 é `0` quando todos os thresholds passam e `99` quando algum falha.

Numa máquina com antivírus que inspeciona HTTPS (como o Avast desta medição), o passo 1 precisa do certificado no build: `docker build --secret id=npm_ca,src=<certificado.pem> -t orders-api-api .`, seguido de `docker compose up -d --wait`.
