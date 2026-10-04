# Simple-mode image: the dashboard and the ingest endpoint in one process.
FROM node:22-slim
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# Manifests first, so the dependency layer is reused until one of them changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/ingest/package.json apps/ingest/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/next/package.json packages/next/
COPY packages/tracker/package.json packages/tracker/
COPY packages/ui/package.json packages/ui/
# The hook installer has nothing to do without a git checkout.
RUN HUSKY=0 pnpm install --frozen-lockfile

COPY . .
RUN pnpm turbo run build --filter=@copper/web

ENV NODE_ENV=production PORT=3000 COPPER_MODE=simple
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["sh", "scripts/start.sh"]
