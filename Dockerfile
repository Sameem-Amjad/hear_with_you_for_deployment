FROM node:20-bookworm-slim AS builder

RUN set -eux; \
    for i in 1 2 3; do \
      apt-get update && \
      apt-get install -y --no-install-recommends --fix-missing \
        python3 build-essential ca-certificates openssl && \
      rm -rf /var/lib/apt/lists/* && break || \
      { echo "apt-get failed (attempt $i), retrying..."; sleep 5; }; \
    done

WORKDIR /usr/src/app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --unsafe-perm || npm install

# copy sources and build
COPY . .
RUN npx prisma generate
RUN npm run build

RUN npm prune --production

FROM node:20-bookworm-slim AS runner

RUN set -eux; \
    for i in 1 2 3; do \
      apt-get update && \
      apt-get install -y --no-install-recommends --fix-missing \
        ffmpeg ca-certificates openssl && \
      rm -rf /var/lib/apt/lists/* && break || \
      { echo "apt-get failed (attempt $i), retrying..."; sleep 5; }; \
    done

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
