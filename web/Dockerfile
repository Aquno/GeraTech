# syntax=docker/dockerfile:1

# --- build: gera os arquivos estáticos com Vite ---
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# CA extra opcional para redes com inspeção de TLS (mesmo mecanismo do Dockerfile da API).
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- runtime: nginx sem root (a imagem unprivileged roda como uid 101 e escuta na 8080) ---
FROM nginxinc/nginx-unprivileged:1.30.6-alpine AS runtime
# O template é processado com envsubst na inicialização (só API_UPSTREAM é variável de ambiente nele).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=api:3000
EXPOSE 8080
