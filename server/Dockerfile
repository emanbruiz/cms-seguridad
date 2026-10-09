# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get upgrade -y --no-install-recommends && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /app/uploads && chown node:node /app/uploads && node -e "import('argon2').then(() => console.log('argon2 ok'))"
USER node
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
EXPOSE 4000
CMD ["node", "src/server.js"]

