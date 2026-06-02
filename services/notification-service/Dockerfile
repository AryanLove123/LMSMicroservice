FROM node:22-alpine

WORKDIR /app

# ---- 1. Shared Dependencies ----
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 2. Service-level Dependencies ----
COPY services/notification-service/package.json   services/notification-service/
RUN cd services/notification-service && npm install --omit=dev

# ---- 3. Application Folder Structure ----
COPY shared/                                       shared/
COPY services/notification-service/src/           services/notification-service/src/

WORKDIR /app/services/notification-service

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3004
CMD ["node", "src/index.js"]
