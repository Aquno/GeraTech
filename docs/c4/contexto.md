# Arquitetura (modelo C4)

Dois níveis do [modelo C4](https://c4model.com/): Contexto e Contêiner. O nível de Componente segue as camadas descritas no `CLAUDE.md` e na [ADR 0001](../adr/0001-repository-pattern.md): `domain`, `application`, `infra` e `http`.

## Nível 1: Contexto

```mermaid
flowchart TB
    atendente["👤 <b>Atendente / Cliente</b><br/><i>Pessoa</i><br/>Registra pedidos do cardápio,<br/>consulta e cancela"]
    operador["👤 <b>Operador / Dev</b><br/><i>Pessoa</i><br/>Sobe, monitora e mede<br/>o desempenho do sistema"]

    sistema["<b>API de Pedidos</b><br/><i>Sistema de software</i><br/>Pedidos de uma lanchonete<br/>sobre um cardápio fixo"]

    atendente -- "Cria, consulta, lista e cancela pedidos<br/>[HTTP/JSON]" --> sistema
    operador -- "Verifica saúde, coleta métricas,<br/>lê a documentação e roda o teste de carga<br/>[HTTP]" --> sistema

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef system fill:#1168bd,stroke:#0b4884,color:#ffffff
    class atendente,operador person
    class sistema system
```

A API de Pedidos é um sistema único, sem integrações externas. Duas pessoas interagem com ela:

- **Atendente ou cliente:** usa os endpoints de negócio para criar pedidos a partir do cardápio, consultar, listar e cancelar. O preço sempre vem do cardápio do próprio sistema.
- **Operador/dev:** não usa os pedidos em si. Cuida da operação: verifica a saúde do sistema, coleta métricas, consulta a documentação interativa e mede o desempenho contra o SLO.

## Nível 2: Contêiner

```mermaid
flowchart TB
    atendente["👤 <b>Atendente / Cliente</b><br/><i>Pessoa</i>"]
    operador["👤 <b>Operador / Dev</b><br/><i>Pessoa</i>"]

    subgraph sistema["API de Pedidos (docker compose)"]
        direction TB
        api["<b>API Fastify</b><br/><i>Contêiner: Node 26 + TypeScript</i><br/>POST /orders · GET /orders<br/>GET /orders/:id · POST /orders/:id/cancel"]
        ops["<b>Endpoints operacionais</b><br/><i>na mesma API</i><br/>GET /health · GET /metrics · GET /docs"]
        db[("<b>PostgreSQL 16</b><br/><i>Contêiner: banco de dados</i><br/>products (seed) · orders · order_items")]
    end

    k6["<b>k6</b><br/><i>Contêiner: grafana/k6, profile load</i><br/>Smoke test: cria e consulta pedidos<br/>e verifica os thresholds do SLO"]

    atendente -- "Pedidos [HTTP/JSON]" --> api
    operador -- "Saúde, métricas Prometheus,<br/>Swagger UI [HTTP]" --> ops
    operador -- "docker compose --profile load<br/>run --rm k6" --> k6
    k6 -- "POST /orders e GET /orders/:id<br/>[HTTP/JSON]" --> api
    api -- "Lê cardápio, grava e lê pedidos<br/>[SQL via Knex/pg]" --> db
    ops -. "/health executa select 1" .-> db
    api -. "mesmo processo" .- ops

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef container fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef database fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef tool fill:#999999,stroke:#6b6b6b,color:#ffffff
    class atendente,operador person
    class api,ops container
    class db database
    class k6 tool
    style sistema fill:none,stroke:#0b4884,stroke-dasharray:5 5,color:#0b4884
```

O sistema roda em dois contêineres, orquestrados pelo `docker-compose.yml`:

- **API Fastify:** um processo Node que atende os quatro endpoints de negócio. Os endpoints operacionais rodam no mesmo processo e na mesma porta:
  - `/health` faz um `select 1` para verificar o banco;
  - `/metrics` expõe o histograma de latência no formato Prometheus;
  - `/docs` serve o Swagger UI a partir do `docs/openapi.yaml`.
- **PostgreSQL:** guarda o cardápio (populado por seed a cada inicialização) e os pedidos, com nome e preço congelados nos itens.

O **k6** (em cinza) não faz parte do sistema em produção. É uma ferramenta de medição que só sobe com o profile `load` e gera tráfego contra a API para verificar o SLO de `POST /orders` (ver [desempenho](../desempenho.md)).
