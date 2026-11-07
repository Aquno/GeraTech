# syntax=docker/dockerfile:1

# --- build: compila TypeScript e depois remove as dependências de desenvolvimento ---
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# CA extra opcional para redes com inspeção de TLS (proxy corporativo, antivírus).
# Sem o secret o build segue normal; com ele: docker build --secret id=npm_ca,src=<arquivo.pem> .
# O secret só existe durante este RUN e não fica em nenhuma camada da imagem.
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# --- runtime: só dist + dependências de produção, executando como usuário não-root ---
FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Os arquivos ficam com dono root (somente leitura para a aplicação); o processo roda como "node".
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
