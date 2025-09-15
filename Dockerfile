## Multi-stage build: build static assets with Node, serve with Nginx

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
ENV HUSKY=0

# Install OS deps for node-gyp if needed by transitive deps
RUN apk add --no-cache python3 make g++

# Copy only package files first for better layer caching
COPY package.json package-lock.json ./

# Install deps with clean, reproducible lockfile
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy source
COPY . .

# Build production assets
RUN npm run build

# ---------- Runtime ----------
FROM nginx:1.27-alpine AS runtime

# Copy built assets to Nginx html
COPY --from=builder /app/dist /usr/share/nginx/html

# Provide Nginx main config (file contains events{} and http{} blocks)
COPY nginx.conf /etc/nginx/nginx.conf

# Remove default server config to avoid conflicting or invalid directives
RUN rm -f /etc/nginx/conf.d/default.conf

EXPOSE 80

# Healthcheck: ensure index is served
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ | grep -q "PDF Compressor" || exit 1

CMD ["nginx", "-g", "daemon off;"]

## ---------- Runtime (use local dist without building) ----------
FROM nginx:1.27-alpine AS runtime_local

# Copy prebuilt assets from context (requires local npm run build beforehand)
COPY dist /usr/share/nginx/html

# Provide Nginx main config (file contains events{} and http{} blocks)
COPY nginx.conf /etc/nginx/nginx.conf

# Remove default server config to avoid conflicting or invalid directives
RUN rm -f /etc/nginx/conf.d/default.conf

EXPOSE 80

# Healthcheck: ensure index is served
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ | grep -q "PDF Compressor" || exit 1

CMD ["nginx", "-g", "daemon off;"]

 