FROM node:22-alpine

WORKDIR /app

# ---- 1. Shared Dependencies ----
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 2. Service-level Dependencies ----
COPY services/employee-service/package.json       services/employee-service/
RUN cd services/employee-service && npm install --omit=dev

# ---- 3. Application Folder Structure ----
COPY shared/                                       shared/
COPY services/employee-service/src/               services/employee-service/src/

WORKDIR /app/services/employee-service

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3002
CMD ["node", "src/index.js"]
