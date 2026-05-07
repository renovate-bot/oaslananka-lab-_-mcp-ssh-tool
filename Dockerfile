# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts/use-ci-npm.mjs scripts/use-ci-npm.mjs
RUN node scripts/use-ci-npm.mjs && npm ci --ignore-scripts

COPY tsconfig.json typedoc.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app

ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="mcp-ssh-tool" \
      org.opencontainers.image.description="Secure MCP SSH automation server" \
      org.opencontainers.image.source="https://github.com/oaslananka-lab/mcp-ssh-tool" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY scripts/use-ci-npm.mjs scripts/use-ci-npm.mjs
RUN node scripts/use-ci-npm.mjs && npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY README.md LICENSE SECURITY.md SECURITY_DECISIONS.md ARCHITECTURE.md REGISTRY_SUBMISSION.md ./
COPY docs ./docs
COPY mcp.json server.json ./
COPY registry ./registry

RUN chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node dist/index.js --version >/dev/null || exit 1

ENTRYPOINT ["node", "dist/index.js"]
CMD []
