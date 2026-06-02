FROM node:22-alpine

WORKDIR /app

# ---- 1. Shared Dependencies ----
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 2. Service-level Dependencies ----
COPY services/leave-service/package.json          services/leave-service/
RUN cd services/leave-service && npm install --omit=dev

# ---- 3. Application Folder Structure ----
COPY shared/                                       shared/
COPY services/leave-service/src/                  services/leave-service/src/

WORKDIR /app/services/leave-service

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3003
CMD ["node", "src/index.js"]
