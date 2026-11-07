---
status: accepted
date: 2026-11-07
---

# Adotar o Repository Pattern para acesso a dados de pedidos

## Contexto e Problema

A Orders API (Node 20 + TypeScript + Fastify + PostgreSQL) expõe quatro endpoints: `POST /orders`, `GET /orders/:id`, `GET /orders` e `POST /orders/:id/cancel`. Os pedidos são feitos sobre um cardápio fixo, populado por seed. Mesmo com um domínio pequeno, há regras de negócio que não pertencem à camada HTTP nem ao banco:

- o preço de cada item vem sempre do cardápio, nunca da requisição;
- `subtotalCents` e `totalCents` são calculados pelo servidor, em centavos inteiros;
- um pedido que referencia produto inexistente no cardápio é rejeitado;
- só um pedido `PENDING` pode ser cancelado.

Como organizar o acesso ao PostgreSQL para que essas regras sejam testáveis sem banco real e não fiquem acopladas ao Fastify nem ao driver SQL?

## Fatores de Decisão

* Testabilidade das regras de domínio com testes unitários rápidos, sem banco.
* Separação clara entre HTTP (Fastify), domínio e persistência.
* Baixo custo de adoção, compatível com um projeto de escopo simples.
* Facilidade de trocar o driver/biblioteca de acesso a dados no futuro.

## Opções Consideradas

* Repository Pattern, com o domínio dependendo de interfaces (`OrderRepository` para pedidos, `ProductRepository` para leitura do cardápio)
* Acesso direto ao banco nas rotas (queries SQL dentro dos handlers do Fastify)

## Resultado da Decisão

Opção escolhida: **Repository Pattern**. O domínio define as interfaces `OrderRepository` e `ProductRepository` (esta só de leitura, já que o cardápio não tem cadastro via API), e a camada de infraestrutura fornece implementações PostgreSQL. As rotas chamam os casos de uso/serviços de domínio, que recebem os repositórios por injeção de dependência. Essa é a única opção que atende aos fatores de testabilidade e separação de responsabilidades.

### Consequências

* Bom, porque as regras de domínio (preço vindo do cardápio, cálculo em centavos, rejeição de produto inexistente, transição para `CANCELLED`) podem ser testadas com implementações em memória dos repositórios.
* Bom, porque os handlers HTTP ficam finos: só tratam entrada, saída e códigos de status.
* Bom, porque a troca do driver (ex.: `pg` → outra biblioteca) fica restrita às implementações dos repositórios.
* Bom, porque o contrato de persistência fica explícito e documentado nas interfaces.
* Ruim, porque adiciona camadas e arquivos (interfaces, implementações, wiring) para um domínio pequeno.
* Ruim, porque exige disciplina para que detalhes do SQL (tipos, erros do driver) não vazem pelas interfaces.
* Ruim, porque são necessários testes de integração separados para validar as implementações PostgreSQL de verdade.

## Prós e Contras das Opções

### Repository Pattern

* Bom, porque desacopla domínio de infraestrutura.
* Bom, porque permite testes unitários sem banco.
* Neutro, porque o volume de código extra é pequeno com apenas duas entidades.
* Ruim, porque há mais indireção para quem lê o código.

### Acesso direto ao banco nas rotas — **descartada**

* Bom, porque é o caminho mais curto: menos arquivos e menos abstração.
* Ruim, porque mistura HTTP, regra de negócio e SQL no mesmo handler.
* Ruim, porque testar regras como o cálculo do total ou o cancelamento exige subir o servidor e um banco real.
* Ruim, porque espalha queries pelas rotas, dificultando mudanças de schema ou de driver.

**Motivo do descarte:** o ganho de simplicidade inicial não compensa o acoplamento entre HTTP, domínio e SQL, que inviabiliza testes unitários do domínio e torna mais cara qualquer mudança na persistência.
