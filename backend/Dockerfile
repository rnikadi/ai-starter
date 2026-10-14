# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile

COPY backend ./backend

ENV NODE_ENV=production
ENV BACKEND_PORT=4000
ENV HOST="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apiuser

USER apiuser
WORKDIR /app/backend
EXPOSE 4000

CMD ["node", "--import", "tsx", "src/index.ts"]
