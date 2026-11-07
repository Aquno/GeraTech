---
status: accepted
date: 2026-11-07
---

# Servir o frontend com nginx e encaminhar /api/ para a API (proxy reverso)

## Contexto e Problema

A evolução do projeto adicionou uma interface web de cardápio (React + Vite, pasta `web/`) que consome a API de Pedidos (`GET /products`, `POST /orders`, `POST /orders/:id/cancel`). O build do frontend gera arquivos estáticos (HTML, JS, CSS, fontes) que precisam ser servidos a um navegador, e o navegador precisa chamar a API.

Por padrão, interface e API ficariam em origens diferentes (portas 8080 e 3000). Com isso, o navegador aplicaria a política de mesma origem e bloquearia as chamadas sem CORS. Havia duas restrições: a API não poderia mudar de comportamento nem de porta, e o `docker compose up --build` deveria continuar subindo tudo com um único comando.

Como servir os arquivos do frontend e fazer o navegador falar com a API, sem mexer na API e com a menor superfície de segurança possível?

## Fatores de Decisão

* Não alterar o comportamento nem as portas da API.
* Segurança no navegador: mesma origem, um Content Security Policy restrito e nada de liberar origens cruzadas.
* Separação de responsabilidades: a API serve dados, e arquivos estáticos ficam com quem é bom nisso (cache, gzip, cabeçalhos).
* Um único comando para subir tudo (`docker compose up --build`) e o mesmo caminho de URL em desenvolvimento e em produção.
* Rodar sem root, como a API.

## Opções Consideradas

* **nginx servindo os estáticos e repassando `/api/` para a API** (proxy reverso)
* Habilitar CORS na API e o frontend chamar `http://localhost:3000` diretamente
* Servir os arquivos estáticos pela própria API (ex.: `@fastify/static`)

## Resultado da Decisão

Opção escolhida: **nginx com proxy reverso**. Um contêiner `web` com `nginx-unprivileged` (uid 101, porta 8080) serve o build do Vite e repassa `/api/*` para `http://api:3000/*`, sem o prefixo. O frontend chama apenas caminhos relativos (`/api/products`), então o navegador sempre fala com a mesma origem. Em desenvolvimento, o proxy do Vite faz o mesmo papel (`/api` para `localhost:3000`), e o código do frontend é idêntico nos dois ambientes.

É a única opção que atende a todos os fatores: a API não muda, não há CORS a configurar, e os estáticos ganham cache, gzip e cabeçalhos de segurança no lugar certo.

### Consequências

* **Bom: mesma origem.** O navegador nunca faz requisição para outra origem, então não há CORS a configurar, nem preflight `OPTIONS`, nem risco de liberar origens demais por engano.
* **Bom: CSP restrito.** Como tudo vem da mesma origem, a página usa `default-src 'self'` (com `script-src`, `style-src`, `font-src` e `connect-src` também `'self'`) e `frame-ancestors 'none'`, além de `X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options`. O CSP vale para a interface; as respostas de `/api/` mantêm os cabeçalhos da própria API.
* **Bom: a API continua igual.** Mesmas rotas, mesma porta 3000 e o mesmo contrato. Quem usa a API direto (curl, Swagger em `/docs`, k6) não é afetado.
* **Bom: estáticos servidos com eficiência.** Os assets com hash no nome têm cache de 1 ano, o `index.html` usa `no-cache` e o gzip fica ativo. Rotas desconhecidas caem no `index.html` (comportamento de SPA).
* **Bom: rastreabilidade.** O nginx gera um `X-Request-Id` que a API aceita e registra nos logs, correlacionando a requisição do navegador com o log da API.
* **Ruim: um contêiner a mais** (`web`) para construir, versionar e monitorar, e mais um `Dockerfile` e uma configuração de nginx para manter.
* **Ruim: a configuração do nginx é crítica.** Um erro no template (prefixo, `proxy_pass`, cabeçalhos dentro de `location`, que não herdam os do `server`) quebra a interface inteira. Isso é mitigado pelo job de compose do CI, que verifica a página e `GET /api/products` passando pelo nginx.
* **Ruim: o upstream é resolvido na subida.** O nginx resolve `api` quando inicia, por isso o serviço `web` só sobe depois de a API passar no healthcheck. Se a API cair depois, o nginx responde 502, e a interface mostra a mensagem de "fora do ar".
* **Neutro: a medição de desempenho continua sendo da API.** O SLO e o k6 medem a API diretamente; o nginx não entra nos números (ver [desempenho](../desempenho.md)).

## Prós e Contras das Opções

### nginx com proxy reverso

* Bom, porque garante a mesma origem e permite um CSP restrito.
* Bom, porque não exige nenhuma mudança na API.
* Bom, porque o nginx é especializado em servir estáticos (cache, gzip, cabeçalhos).
* Ruim, porque acrescenta um contêiner e uma configuração a manter.

### Habilitar CORS na API (descartada)

* Bom, porque dispensa o proxy: bastaria servir os estáticos de qualquer lugar.
* Ruim, porque **altera o comportamento da API** (novos cabeçalhos e respostas de preflight `OPTIONS`), o que contraria a restrição de não mexer na API.
* Ruim, porque abre uma superfície de configuração sensível: uma lista de origens permitidas errada, ou um `*`, libera chamadas de qualquer site.
* Ruim, porque o frontend teria que conhecer a URL absoluta da API, que muda entre ambientes, e o `connect-src` do CSP precisaria incluir outra origem.

**Motivo do descarte:** muda a API e aumenta a superfície de segurança para resolver um problema que o proxy elimina por completo.

### Servir os estáticos pela própria API (descartada)

* Bom, porque mantém um único processo e garante a mesma origem sem proxy.
* Ruim, porque **altera a API** (novo plugin, rotas de arquivos e fallback de SPA convivendo com as rotas de negócio), contra a restrição desta etapa.
* Ruim, porque mistura responsabilidades: o build do frontend passaria a fazer parte da imagem da API, e um deploy de interface exigiria redeploy da API.
* Ruim, porque o Node seria usado para servir arquivos estáticos (cache, gzip, cabeçalhos), papel que o nginx cumpre melhor e com menos código nosso.

**Motivo do descarte:** acopla o ciclo de vida da interface ao da API e muda a API, sem ganho que compense o contêiner a mais.
