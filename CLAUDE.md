# Orders API

API de pedidos em Node 20 + TypeScript + Fastify + PostgreSQL, com um domínio só e nível simples, sobre um cardápio fixo.

## Regras permanentes

- **Git:** nunca execute `git commit`, `git push` nem crie PRs. O desenvolvedor faz isso manualmente.
- **Segredos:** nunca crie arquivo `.env` com valores reais; mantenha apenas o `.env.example`.
- **Escopo fixo:** apenas estes endpoints. Não adicione funcionalidades extras.
  - `POST /orders`
  - `GET /orders/:id`
  - `GET /orders`
  - `POST /orders/:id/cancel`
- **Endpoints operacionais** (fora do contrato de negócio): `GET /health` e `GET /metrics` (Prometheus).
- **Logs:** JSON (pino), um por requisição, com request id (`x-request-id`). Nunca registre `customerName`, corpos de requisição ou outros dados pessoais.
- **Cardápio:** os produtos ficam numa tabela populada por seed, com ids em formato slug. Não há endpoint de cadastro de produtos.
- **Dinheiro:** todos os valores monetários são inteiros em centavos (campos com sufixo `Cents`). Nunca use float para dinheiro.
- **Preço:** o preço sempre vem do cardápio. A requisição traz apenas `productId` e `quantity`; nunca aceite preço vindo do cliente.
- **Itens únicos:** o mesmo `productId` não pode aparecer duas vezes no mesmo pedido. Validado no domínio; responde 400 com `details` indicando o item duplicado.
- **Arquitetura:** Repository Pattern. O domínio depende de interfaces de repositório, nunca do driver/ORM diretamente (ver `docs/adr/0001-repository-pattern.md`).
- **CI:** a pasta de workflows é `.github/workflows` (minúsculo).

## Referências

- Contrato da API: `docs/openapi.yaml` (OpenAPI 3.1), lint com `npx @redocly/cli lint docs/openapi.yaml` (config em `redocly.yaml`)
- Decisões de arquitetura: `docs/adr/`
- Diagramas C4: `docs/c4/`
