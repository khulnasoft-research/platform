FROM node:22-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3001
CMD ["pnpm", "--filter", "@platform/api", "exec", "tsx", "src/index.ts"]
