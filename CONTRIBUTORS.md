# Registro de processo

Este é o meu registro de como construí este projeto, na ordem em que as coisas aconteceram.

**Sobre a autoria:** o código foi gerado com assistência do **Claude Code** (Anthropic). Defini o escopo, as regras e a ordem das etapas, e decidi cada ponto listado aqui. Revisei o que foi gerado e validei os resultados rodando lint, testes, coverage, o fluxo com curl, o CI no GitHub Actions e o teste de carga. Nas linhas abaixo, "Matheus Aquino" é o que eu fiz ou decidi. "Claude Code" é o que foi gerado ou executado pela ferramenta a meu pedido.

**Sobre o histórico do git:** o repositório começa num commit único, `chore: projeto base da Orders API` (`cf3842f`). As etapas 1 a 6 aconteceram antes desse commit e estão consolidadas nele. Reescrevi o início do histórico de propósito, para que testes e CI entrassem por uma branch própria. A partir da etapa 7, cada etapa corresponde a uma branch com merge no `main`:

| Commit | Etapa |
|---|---|
| `cf3842f` chore: projeto base da Orders API | 1 a 6 |
| `4402f68` test: testes unitários e de integração… | 7 |
| `f4c2c58` ci: workflow do GitHub Actions | 7 |
| `933e22c` Merge branch 'feat/testes-ci' | 7 |
| `ef479b0` feat: logs estruturados, métricas Prometheus e smoke test k6… | 8 |
| `1e4146a` Merge branch 'feat/observabilidade-k6' | 8 |
| branch `docs/readme-entrega` | 9 |

---

## 1. Escopo e regras do projeto

- **Matheus Aquino:** escolhi o **nível B** por causa do prazo e porque a proposta do desafio valoriza foco em engenharia. Preferi entregar poucas funcionalidades bem feitas (contrato, testes, CI, observabilidade, medição de desempenho) a cobrir muitas de forma rasa.
- **Matheus Aquino:** escolhi o domínio de **pedidos de uma lanchonete com cardápio fixo**, para manter uma única entidade principal, o pedido. O cardápio é só leitura, populado por seed, sem endpoint de cadastro. Assim o esforço fica nas regras do pedido, e não em CRUDs paralelos.
- **Matheus Aquino:** defini regras permanentes no `CLAUDE.md`:
  - escopo fixo de endpoints;
  - nenhum `.env` com valores reais;
  - Repository Pattern;
  - commits e pushes sempre feitos por mim.
- **Matheus Aquino:** decidi pelo **Repository Pattern** e pedi o registro numa ADR ([0001](docs/adr/0001-repository-pattern.md)), com a alternativa descartada (SQL direto nas rotas) e o motivo: testabilidade do domínio sem banco.
- **Claude Code:** gerou `CLAUDE.md`, `.gitignore`, `.env.example`, a ADR em formato MADR e a estrutura de pastas.

## 2. Contrato antes do código

- **Matheus Aquino:** decidi escrever o **contrato OpenAPI antes de qualquer código** ([`docs/openapi.yaml`](docs/openapi.yaml)). Fechar o contrato primeiro me obrigou a decidir formatos, códigos de erro e o formato padrão de erro antes da implementação. Depois ele serviu de referência para a validação das rotas e para os testes.
- **Claude Code:** gerou a primeira versão do contrato em OpenAPI 3.1.
- **Matheus Aquino:** revisei o contrato e **corrigi a modelagem do preço: o preço vem do cardápio, nunca do cliente.** A primeira versão aceitava `unitPrice` na requisição, o que deixaria o cliente definir quanto paga. A requisição passou a trazer só `productId` e `quantity`, e um `unitPrice` enviado é rejeitado com 400, e não ignorado em silêncio.
- **Matheus Aquino:** defini **valores monetários em centavos inteiros** (`unitPriceCents`, `subtotalCents`, `totalCents`). Ponto flutuante acumula erro de arredondamento em somas de dinheiro, e inteiros eliminam o problema.
- **Matheus Aquino:** troquei um status sem uso por uma **transição real, de `PENDING` para `CANCELLED`**, com o endpoint `POST /orders/{id}/cancel` (409 se o pedido já estiver cancelado). Um status que nunca muda seria decoração. Com a transição, há uma regra de domínio de verdade para implementar e testar.
- **Matheus Aquino:** defini **422 para produto inexistente no cardápio** e 400 para erro de formato, separando "requisição malformada" de "requisição bem formada que viola uma regra".
- **Matheus Aquino:** pedi um `security: []` explícito (a API não tem autenticação), a licença MIT e um `redocly.yaml` que só rebaixa o aviso de servidor localhost. Aceitei conscientemente o aviso que sobrou em `GET /orders`.

## 3. Implementação em camadas

- **Claude Code:** gerou a aplicação em camadas (`domain`, `application`, `infra`, `http`, `config`), com Knex, migrations, seed, validação por JSON Schema coerente com o contrato e o error handler no formato padrão de erro.
- **Matheus Aquino:** decidi que **nome e preço do produto ficam congelados no pedido** no momento da criação. Se o cardápio mudar depois, os pedidos antigos continuam mostrando o que foi cobrado.
- **Matheus Aquino:** decidi **rejeitar produto duplicado no mesmo pedido com 400**, com `details` apontando o item repetido. Somar as quantidades em silêncio esconderia um provável erro do cliente e interagiria mal com o limite de 20 unidades por item. A regra fica no domínio, com uma barreira extra no banco (`UNIQUE(order_id, product_id)`).
- **Matheus Aquino:** defini que a interface do cardápio se chama `ProductRepository`, somente leitura, coerente com a ADR.
- **Matheus Aquino:** exigi que o domínio não dependesse de infraestrutura. **Claude Code:** criou a **regra no ESLint** que impede o domínio de importar `knex`, `pg`, `fastify` e as camadas `infra`, `http` e `config`, e provou que ela funciona com um import proibido de propósito, que o lint acusou.
- **Matheus Aquino:** pedi que o `docker compose` funcionasse num clone limpo sem `.env`, com valores padrão de desenvolvimento no próprio compose.
- **Matheus Aquino:** validei o fluxo completo com curl contra a aplicação no Docker: criar, consultar, listar, cancelar, cancelar de novo (409) e produto inexistente (422).

## 4. Ambiente: antivírus interceptando HTTPS

- **Claude Code:** identificou que o `npm ci` dentro do build Docker falhava com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, porque o antivírus da minha máquina (Avast Web Shield) intercepta HTTPS com um certificado próprio. O Node do Windows confia nesse certificado, mas os containers não.
- **Matheus Aquino:** aceitei a solução de **secret opcional no build**, em vez de desligar a verificação TLS. O Dockerfile aceita um certificado extra via BuildKit secret (`--secret id=npm_ca,...`), que existe só durante o `npm ci` e não fica em nenhuma camada da imagem.
- **Matheus Aquino:** pedi a confirmação de que o secret é opcional de verdade e de que nenhum caminho ou arquivo do certificado foi parar em arquivos versionados. **Claude Code:** verificou os dois pontos: build sem o secret, histórico de camadas e busca nos arquivos.

## 5. Migração de Node 20 para a LTS ativa

- **Matheus Aquino:** decidi **migrar de Node 20 para a LTS ativa**. O Node 20 chegou ao fim de suporte em 30/04/2026, e as dependências já estavam abandonando essa versão: um pacote transitivo do Fastify passou a exigir Node 22 ou mais novo, o que forçou um `overrides` temporário.
- **Claude Code:** conferiu no calendário oficial de releases que o **Node 26** é a LTS com suporte ativo (até 20/10/2027, fim de vida em 30/04/2029). Atualizou `engines`, `.nvmrc`, a imagem base e `@types/node`, e removeu o `overrides`, que deixou de ser necessário.

## 6. Verificações do ambiente

- **Matheus Aquino:** pedi a prova de que o Dockerfile funciona sem o certificado num ambiente como o GitHub Actions. **Claude Code:** mostrou que, sem o secret, o build só falha pela rede desta máquina. Um teste isolado, com a mesma instrução do Dockerfile, mostrou que o build passa sem o secret e que o secret some depois do passo em que é usado.

## 7. Testes, coverage e CI (`feat/testes-ci`)

- **Matheus Aquino:** defini as regras dos testes: asserções sobre valores concretos, nenhum teste sem asserção e nenhum teste que só verifica "não lançou erro". A integração usa PostgreSQL real, num banco separado do de desenvolvimento.
- **Claude Code:** gerou os testes unitários (domínio, casos de uso com repositórios em memória, HTTP, config) e o de integração (banco `orders_test`, com proteção para nunca rodar num banco cujo nome não termine em `_test`).
- **Matheus Aquino:** exigi provar que os testes detectam falhas. **Claude Code:** fez **experimentos com bugs introduzidos de propósito**, um de cada vez, restaurando o código depois. Os 8 bugs foram detectados:
  - limite de 20 virando 21;
  - subtotal ignorando a quantidade;
  - sem checagem de duplicado;
  - cancelar duas vezes permitido;
  - produto inexistente ignorado;
  - 409 virando 400;
  - cancelamento sem gravar no banco;
  - `ORDER BY` invertido.
- **Matheus Aquino:** pedi que o **threshold de coverage** fosse definido depois de medir, de forma honesta. Ficou um pouco abaixo do medido: 95% em linhas, statements e funções, e 85% em branches. As exclusões são justificadas no `vitest.config.mts`.
- **Matheus Aquino:** defini os 4 jobs do CI, com permissões mínimas e ações com versão fixada:
  - qualidade;
  - testes com coverage;
  - gitleaks;
  - `docker compose up` do zero com verificação do `/health`.
- **Matheus Aquino:** reescrevi o início do histórico para separar o projeto base, criei a branch `feat/testes-ci` com dois commits (testes e CI), fiz commit e push, acompanhei o CI até ficar verde e fiz o merge no `main`.

## 8. Observabilidade e desempenho (`feat/observabilidade-k6`)

- **Matheus Aquino:** defini os requisitos de logs:
  - JSON;
  - um log por requisição;
  - request id;
  - eventos `order.created` e `order.cancelled`;
  - **nenhum dado pessoal** (`customerName`) nem corpo de requisição nos logs, com redact como precaução.
- **Matheus Aquino:** defini a métrica `http_request_duration_seconds` com o **template da rota como label** (`/orders/:id`, nunca a URL real), para evitar explosão de cardinalidade.
- **Claude Code:** gerou logs, métricas e testes. Repetiu o experimento de bugs introduzidos no código de observabilidade, e os 6 foram detectados.
- **Matheus Aquino:** declarei um **único SLO** para `POST /orders`: p95 abaixo de 300 ms e menos de 1% de erros 5xx, justificado em [`docs/desempenho.md`](docs/desempenho.md).
- **Matheus Aquino:** decidi deixar o **k6 fora do CI.** Os runners do GitHub Actions são máquinas compartilhadas com desempenho variável, e um threshold de latência ali reprovaria builds por ruído, não por regressão. O k6 roda sob demanda, num profile separado do compose.
- **Matheus Aquino:** decidi **registrar a falta de paginação em `GET /orders` como risco, sem implementar.** O endpoint devolve todos os pedidos, e a latência cresce com o volume. Implementar estaria fora do escopo fixo e inflaria a entrega, então a melhoria futura (paginação por cursor) ficou documentada.
- **Matheus Aquino:** revisei o resultado do smoke test, fiz commit e push da branch, acompanhei o CI e fiz o merge no `main`.

## 9. Documentação e entrega (`docs/readme-entrega`)

- **Matheus Aquino:** pedi o **Swagger UI em `/docs`** servido a partir do próprio `docs/openapi.yaml`, sem duplicar o contrato no código.
- **Matheus Aquino:** pedi os **diagramas C4** de contexto e contêiner ([`docs/c4/contexto.md`](docs/c4/contexto.md)).
- **Matheus Aquino:** pedi que a pasta de resultados do k6 funcionasse em hosts Linux e macOS. **Claude Code:** reproduziu o erro de permissão com semântica de Linux e corrigiu rodando o container com o uid do host. Cada execução agora grava um arquivo próprio. No caminho, encontrou outro problema: o k6 sai com código 0 mesmo quando não consegue gravar o resumo. As execuções afetadas foram descartadas e a medição foi repetida.
- **Matheus Aquino:** pedi **3 execuções do smoke** com p95, mediana e amplitude, e uma análise honesta da variação, incluindo o número que destoou em outro horário.
- **Matheus Aquino:** revisei README, este registro e a conferência final da estrutura do repositório antes da entrega.
