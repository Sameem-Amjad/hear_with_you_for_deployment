FROM node:20-bullseye-slim AS builder

RUN apt-get update && apt-get install -y python3 build-essential ffmpeg ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# install deps
COPY package.json package-lock.json* ./
RUN npm ci --unsafe-perm || npm install

# copy sources and build
COPY . .
RUN npm run build

RUN npm prune --production

FROM node:20-bullseye-slim AS runner
RUN apt-get update && apt-get install -y ffmpeg ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
