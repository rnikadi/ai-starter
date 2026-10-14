# syntax=docker/dockerfile:1

# Stage 1: Base with pnpm
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# Stage 2: Dependencies and Builder
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN pnpm install --frozen-lockfile

COPY frontend ./frontend

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Next.js webpack build with standalone output
RUN cd frontend && pnpm exec next build --webpack

# Stage 3: Production Runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone server bundle
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static

USER nextjs
EXPOSE 3001

CMD ["node", "frontend/server.js"]
