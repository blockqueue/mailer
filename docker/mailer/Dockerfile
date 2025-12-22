FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/mailer/package.json ./apps/mailer/

# Install dependencies
RUN bun install

# Copy app source
COPY apps/mailer ./apps/mailer

# Set working directory to mailer app
WORKDIR /app/apps/mailer

# Expose port
EXPOSE 3000

# Run the app
CMD ["bun", "run", "src/index.ts"]

