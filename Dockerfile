# Build the app as a standalone Node.js server for Google Cloud Run.
#
#   gcloud run deploy wayline --source . --region asia-southeast1
#
# Cloud Run sets PORT automatically; the server listens on it.

FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
# Outside the Lovable sandbox this env var is honoured and produces a
# Node server in .output/ instead of the Cloudflare-targeted bundle.
ENV NITRO_PRESET=node-server
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output

EXPOSE 8080
CMD ["bun", ".output/server/index.mjs"]
