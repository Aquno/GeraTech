# Registro de processo

Este é o meu registro de como construí este projeto, na ordem em que as coisas aconteceram.

**Sobre a autoria:** o código foi gerado com assistência do **Claude Code** (Anthropic). Defini o escopo, as regras e a ordem das etapas, e decidi cada ponto listado aqui. Revisei o que foi gerado e validei os resultados rodando lint, testes, coverage, o fluxo com curl, o CI no GitHub Actions e o teste de carga. Nas linhas abaixo, "Matheus Aquino" é o que eu fiz ou decidi. "Claude Code" é o que foi gerado ou executado pela ferramenta a meu pedido.

**Sobre o histórico do git:** o repositório começa num commit único, `chore: projeto base da Orders API` (`cf3842f`). As etapas 1 a 6 aconteceram antes desse commit e estão consolidadas nele. Reescrevi o início do histórico de propósito, para que testes e CI entrassem por uma branch própria. A partir da etapa 7, cada etapa corresponde a uma branch integrada ao `main`.

**Como as branches foram integradas:** as três primeiras (`feat/testes-ci`, `feat/observabilidade-k6` e `docs/readme-entrega`) foram integradas **localmente**, com `git merge --no-ff` seguido de push, depois de eu conferir o CI da branch. A partir de `chore/ajustes-finais`, o fluxo passou a ser por **pull request** no GitHub: o CI roda no PR, e só faço o merge com ele verde.

| Integração no `main` | Branch | Como | Etapa |
|---|---|---|---|
| `cf3842f` chore: projeto base da Orders API | (commit inicial) | direto | 1 a 6 |
| `933e22c` Merge branch 'feat/testes-ci' | `feat/testes-ci` | merge local | 7 |
| `1e4146a` Merge branch 'feat/observabilidade-k6' | `feat/observabilidade-k6` | merge local | 8 |
| `7d15699` Merge branch 'docs/readme-entrega' | `docs/readme-entrega` | merge local | 9 |
| `0092106` Merge pull request #1 (tag `v1.0.0-entrega`) | `chore/ajustes-finais` | PR #1 | 9 |
| `a09c3ff` Merge pull request #2 | `feat/cardapio-api` | PR #2 | 10 |
| `615d688` Merge pull request #3 | `feat/web-cardapio` | PR #3 | 10 |
| `7bdd02b` (sem merge commit próprio: entrou no `main` junto com o PR #5) | `docs/evolucao-final` | PR #4 | 10 |
| `72cffb5` Merge pull request #5 | `feat/redesign-ui` | PR #5 | 11 |
| `c71df20` Merge pull request #6 | `chore/claude-md-node` | PR #6 | 11 |

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
- **Matheus Aquino:** fiz ajustes finais numa branch própria (`chore/ajustes-finais`): versionei os resumos JSON das 3 execuções do k6 como evidência em `docs/evidencias/k6/` e fixei o runner do CI em `ubuntu-24.04` em vez de `ubuntu-latest`, para o ambiente do CI não mudar sozinho. Foi a primeira branch integrada por pull request (PR #1).

## 10. Evolução: interface web (`feat/cardapio-api`, `feat/web-cardapio`, `docs/evolucao-final`)

Depois da entrega, evoluí o projeto para algo mais visual, com uma regra principal: **nada do que existia podia quebrar**. Tudo nesta etapa é funcionalidade extra, fora do escopo exigido pelo nível B.

**Preparação**

- **Matheus Aquino:** antes de mexer em qualquer coisa, **congelei a versão de entrega na tag `v1.0.0-entrega`** (commit `0092106`, merge do PR #1, com o CI verde). Se a evolução desse errado, a entrega continuava intacta e recuperável com `git switch -c <branch> v1.0.0-entrega`.
- **Matheus Aquino:** decidi fazer **só o cardápio**: listar os produtos e montar o pedido com eles, **sem montagem de lanche** (escolha de ingredientes, adicionais). Personalizar o lanche mudaria o domínio: itens com variações, preço composto e novas regras de validação. Com só o cardápio, o pedido continua sendo uma lista de produtos com quantidade, e nenhuma regra de negócio muda.

**API do cardápio (PR #2)**

- **Matheus Aquino:** pedi a API primeiro, separada da interface:
  - descrição e categoria dos produtos numa migration nova (`003`), sem editar as antigas;
  - `GET /products` seguindo as mesmas camadas (caso de uso `ListProducts`);
  - o contrato só recebendo adições, com a versão indo de 0.2.0 para 0.3.0.
- **Matheus Aquino:** a regra inicial era "testes existentes não podem ser alterados". **Claude Code:** encontrou um **conflito** entre essa regra e "o contrato só recebe adições": o `api-docs.test.ts` comparava a lista **exata** de paths do contrato, então qualquer endpoint novo o quebraria. Parou, mostrou o teste falhando e as opções, sem alterar nada.
- **Matheus Aquino:** **corrigi a regra** para: **testes existentes podem ser ajustados para acomodar adições, mas nunca podem ter asserções removidas ou enfraquecidas**, e cada arquivo alterado precisa ser listado com o motivo. Escolhi trocar a lista exata por `expect.arrayContaining` com os três paths originais (os paths de antes continuam obrigatórios). O path novo ficou verificado num teste novo. No fim, só dois arquivos de teste existentes mudaram (`api-docs.test.ts` e o helper `tests/unit/support/app.ts`), cada um listado com o motivo.
- **Matheus Aquino:** a primeira versão tinha o caso de uso de listagem como **dependência opcional** do `buildApp`, só para não tocar no helper dos testes. Sem ele, a rota simplesmente não existiria. Pedi que virasse **dependência obrigatória**, com o helper de testes fornecendo um fake: uma rota que some sem aviso seria um comportamento escondido. Mantive a separação `MenuProductRepository` / `ProductRepository` por segregação de interfaces (quem cria pedidos não depende da listagem).
- **Matheus Aquino:** a primeira versão deixava `category` aceitar nulo no banco e escondia do cardápio os produtos sem categoria. Pedi **categoria obrigatória no banco** (`NOT NULL`), funcionando tanto num banco novo quanto num banco que já tinha os produtos do seed. **Claude Code:** fez a migration preencher os produtos existentes e só depois aplicar o `NOT NULL`. Se sobrar algum produto desconhecido, a migration falha e é revertida inteira, sem inventar categoria. Testou os três cenários (banco novo, com seed e com produto desconhecido). A migration rodou de verdade no meu banco local, com milhares de pedidos.

**Interface web (PR #3)**

- **Matheus Aquino:** defini os requisitos:
  - React + Vite + TypeScript strict numa pasta `web/` separada, sem bibliotecas de componentes pesadas;
  - cardápio por categoria, carrinho com limite de 1 a 20, finalização e confirmação com cancelamento;
  - identidade visual de lanchonete, mobile primeiro, modo claro e escuro;
  - acessibilidade (teclado, foco, labels, contraste, `prefers-reduced-motion`);
  - o `docker compose up --build` continuando a subir tudo com um único comando.
- **Matheus Aquino:** estabeleci que **o total oficial vem sempre da API**: o carrinho mostra só uma prévia, e a confirmação exibe o `totalCents` devolvido pelo servidor. **Claude Code:** protegeu isso com um teste em que a API simulada devolve um total diferente da prévia (R$ 45,00 contra R$ 44,00), e a tela precisa mostrar o do servidor. Também introduziu de propósito o bug "a confirmação recalcula o total no front", e o teste o detectou.
- **Matheus Aquino:** escolhi **proxy reverso em vez de CORS**. O nginx serve a interface e repassa `/api/*` para a API, então o navegador fala sempre com a mesma origem, sem CORS, com um CSP restrito e sem nenhuma mudança na API. O custo é um contêiner a mais. A decisão e as alternativas descartadas (CORS na API, estáticos servidos pela API) estão na [ADR 0002](docs/adr/0002-frontend-com-proxy-reverso.md).
- **Claude Code:** os testes do frontend pegaram, durante o desenvolvimento, um defeito real de acessibilidade (o nome do botão do carrinho saía grudado para leitores de tela) e um `setState` síncrono dentro de efeito, acusado pela regra de hooks do React. Os dois foram corrigidos. O contraste de todas as combinações de cor dos dois temas foi conferido por cálculo (WCAG AA). As capturas de tela, em celular e desktop, estão em `docs/evidencias/web/`.
- **Matheus Aquino:** pedi um job novo no CI para o frontend e, no job de compose, a verificação da página web e de `/api/products` passando pelo nginx, **sem remover nem enfraquecer os jobs existentes**.

**Verificação e documentação (`docs/evolucao-final`)**

- **Matheus Aquino:** pedi repetir as 3 execuções do k6 depois da evolução. A mediana do p95 de `POST /orders` foi de 33,24 ms (antes) para 33,71 ms (depois), dentro da variação de uma mesma série: não há regressão mensurável. Deixei registrado que **o SLO cobre só a API** e que a interface web não faz parte da medição.
- **Matheus Aquino:** pedi que o README apresentasse a interface web numa seção identificada como **funcionalidade extra, fora do escopo do nível B**, e que o C4 de contêiner mostrasse os três contêineres e o fluxo navegador → nginx → API → PostgreSQL.

## 11. Redesign com fotos reais e ajustes antes da entrega (`feat/redesign-ui`, `chore/claude-md-node`, `docs/ajustes-pre-entrega`)

**Redesign da interface (PR #5)**

- **Matheus Aquino:** pedi um redesign com visão de UI/UX, mais bonito e moderno, **com fotos reais nos lanches**, sem quebrar nada do que já funcionava.
- **Matheus Aquino:** fotos reais contrariavam a regra anterior do `CLAUDE.md` ("ilustrações são SVG próprios", "não use imagens da internet"). Decidi usar **bancos de imagens gratuitos com licença que permite uso comercial** e atualizar a regra. Ela passou a ser: só fotos CC0/domínio público com licença conferida, sem marca, logotipo nem marca d'água, e ilustração SVG como fallback para produto sem foto.
- **Claude Code:** buscou candidatas com licença CC0/domínio público pelo [Openverse](https://openverse.org) e conferiu cada uma visualmente. Descartou fotos com marca visível (papel de restaurante, produtos de rede de fast food) e uma candidata ao X-Burger que aparecia como domínio público mas tinha a **marca d'água de direitos autorais de outra pessoa**. Recortou as escolhidas em 4:3 e otimizou em WebP (versões de 480 e 800 px, de 15 a 49 KB).
- **Origem das fotos:** a fonte, o autor e a licença de cada uma estão em [`web/src/assets/products/CREDITS.md`](web/src/assets/products/CREDITS.md), citado também no README e no rodapé da página. As fotos ficam dentro do projeto e são servidas pelo próprio nginx, então o CSP (`img-src 'self'`) continua valendo.
- **Claude Code:** redesenhou a interface:
  - cabeçalho fixo;
  - destaque com composição de fotos no desktop e versão compacta no celular, para o primeiro produto já aparecer na primeira tela;
  - cards horizontais no celular e verticais com foto grande a partir de 560 px;
  - carrinho com miniaturas;
  - botões com ícones;
  - paleta refinada nos dois temas.

  Conferiu por cálculo o contraste de todas as combinações de cor (WCAG AA) e revisou as telas por captura em celular e desktop. As capturas mostraram dois defeitos (fotos do destaque esticadas no desktop e um botão que deveria sumir no celular), corrigidos antes do PR.
- **Matheus Aquino:** pela regra dos testes, só um arquivo de teste existente mudou: o `web/src/App.test.tsx` passou a procurar o texto alternativo da foto em vez do da ilustração, com o mesmo rigor (nome exato e contagem de 5 imagens). Entraram 12 testes novos, e os 5 bugs introduzidos de propósito no código novo foram detectados.
- **Matheus Aquino:** o PR #4 (documentação) ainda estava aberto quando o redesign começou. A branch do redesign partiu dele, e os dois entraram no `main` juntos, pelo merge do PR #5.

**Correção do `CLAUDE.md` (PR #6)**

- **Matheus Aquino:** corrigi a menção a "Node 20" no `CLAUDE.md`, que estava desatualizada desde a migração para o Node 26 (etapa 5).

**Auditoria e ajustes antes da entrega (`docs/ajustes-pre-entrega`)**

- **Matheus Aquino:** pedi uma **auditoria somente leitura** antes da entrega. **Claude Code:** verificou:
  - subida do zero num ambiente limpo e o fluxo completo pela API e pelo nginx;
  - lint, testes e coverage da API e do web contra os thresholds, e nenhum teste sem asserção;
  - o CI;
  - gitleaks no histórico inteiro;
  - CSP e requisições externas no navegador, axe-core e contraste;
  - as capturas comparadas pixel a pixel;
  - os links do README e o OpenAPI contra as rotas registradas.

  Nenhum item bloqueava a entrega.
- **Matheus Aquino:** dos pontos levantados, escolhi corrigir:
  - o `.env.example`, que ganhou uma seção comentada com as variáveis opcionais (incluindo `WEB_PORT`), com os mesmos valores fictícios de desenvolvimento do compose;
  - este registro;
  - uma seção datada de "Notas posteriores" na ADR 0001 (Node 26, cinco endpoints, decisão mantida), **sem alterar o texto original**;
  - "ilustrações" por "fotos" no README.
