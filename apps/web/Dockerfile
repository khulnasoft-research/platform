FROM node:22-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json turbo.json ./
COPY apps/web/ apps/web/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @platform/shared-types build
RUN pnpm --filter @platform/web build

EXPOSE 3000
ENV PORT=3000
CMD ["pnpm", "--filter", "@platform/web", "start"]
