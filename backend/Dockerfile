# --- Stage 1: Build Stage ---
  FROM oven/bun:1.3.8 AS builder

  WORKDIR /app

  # Copy lockfiles and manifest configurations
  COPY package.json tsconfig.json ./
  COPY bun.lock ./

  # Install ALL dependencies (including @nestjs/cli in devDependencies)
  RUN bun install --no-check

  # Copy all source files and migration scripts
  COPY . .

  # Run your exact Nest build script
  RUN bun run build

  # --- Stage 2: Clean Production Dependency Stage ---
  FROM oven/bun:1.3.8 AS production-deps
  WORKDIR /app
  COPY package.json ./
  RUN bun install --production --no-check

  # --- Stage 3: Runtime Stage ---
  FROM oven/bun:1.3.8 AS runner
  WORKDIR /app
  ENV NODE_ENV=production

  # Bring over production code and slim node_modules
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/run-migrations.ts* /app/data-source.ts* ./
  COPY --from=production-deps /app/node_modules ./node_modules
  COPY package.json ./

  EXPOSE 3000

  # Triggers 'bun dist/main.js' directly as designated by your start script
  CMD ["bun", "run", "start"]
