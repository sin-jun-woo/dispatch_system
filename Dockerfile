FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./
COPY patches ./patches

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

ENTRYPOINT ["sh", "docker/entrypoint.sh"]
CMD ["pnpm", "dev"]
