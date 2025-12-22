# Development Dockerfile for mailer
# Uses Bun with hot reload and volume mounts for development

FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies into temp directory for better caching
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb* package-lock.json* ./
COPY apps/mailer/package.json ./apps/mailer/
COPY turbo.json ./

# Install all dependencies (including devDependencies for development)
# Note: Not using --frozen-lockfile in dev since we only copy mailer app
RUN cd /temp/dev && \
    cp -r /app/package.json /app/bun.lockb* /app/package-lock.json* . 2>/dev/null || true && \
    mkdir -p apps/mailer && \
    cp /app/apps/mailer/package.json apps/mailer/ && \
    cp /app/turbo.json . && \
    bun install

# Copy source code
FROM base AS development
COPY --from=install /temp/dev/node_modules ./node_modules
COPY --from=install /temp/dev/apps/mailer/node_modules ./apps/mailer/node_modules

# Copy workspace files
COPY package.json bun.lockb* package-lock.json* turbo.json ./
COPY apps/mailer ./apps/mailer
COPY packages/data ./packages/data

WORKDIR /app/apps/mailer

# Run with hot reload
# Volume mounts should be done in docker-compose for live code changes
CMD ["bun", "run", "--hot", "src/index.ts"]
