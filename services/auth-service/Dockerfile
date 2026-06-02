FROM node:22-alpine

WORKDIR /app

# ---- 1. Shared Dependencies ----
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 2. Service-level Dependencies ----
COPY services/auth-service/package.json           services/auth-service/
RUN cd services/auth-service && npm install --omit=dev

# ---- 3. Application Folder Structure ----
COPY shared/                                       shared/
COPY services/auth-service/src/                   services/auth-service/src/

WORKDIR /app/services/auth-service

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001
CMD ["node", "src/index.js"]
