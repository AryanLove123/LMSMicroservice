# Setup Guide — Leave Management System

This guide walks through getting the project running from scratch on a new machine using Docker Compose.

---

## Prerequisites

| Tool | Minimum Version | Notes |
|---|---|---|
| Docker Desktop | 4.x | Enable WSL2 backend on Windows |
| Git | any | To clone the repo |
| Node.js | 22.x | Only needed for local (non-Docker) development |

> **Windows users:** all `docker` commands below should be run inside **WSL2** (Ubuntu terminal), not PowerShell. Docker Desktop exposes the Docker daemon to WSL2 automatically.

---

## 1. Clone the Repository

```bash
git clone https://github.com/AryanLove123/LMSMicroservice.git
cd LMS-Microservice
```

---

## 2. Create the Shared Observability Network

This network is used by Jaeger and ELK. It must exist before `docker compose up` because it is declared `external: true` in `docker-compose.yml`.

```bash
docker network create lm-dev
```

> Only run this once. If you get `Error: network with name lm-dev already exists`, that's fine — skip it.

---

## 3. Configure Environment Variables

The project uses a two-layer `.env` system:

- **Root `.env`** — shared secrets used by all services (JWT keys, RabbitMQ URI, etc.)
- **Per-service `.env`** — service-specific overrides (port, MongoDB URI, etc.)

### 3.1 Root `.env`

Create the file at the repo root:

```bash
# LMS-Microservice/.env

# JWT
JWT_SECRET=replace_with_a_long_random_string_at_least_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_another_long_random_string_32_chars
JWT_REFRESH_EXPIRES_IN=24h
BCRYPT_ROUNDS=12

# RabbitMQ — matches the rabbitmq service in docker-compose.yml
RABBITMQ_URI=amqp://admin:admin123@rabbitmq:5672/lms_vhost

# Internal service-to-service auth secret (any long random hex string)
INTERNAL_SERVICE_SECRET=545abbd9185ca6abd6b94d6239310bf2c61dae6c3ef84d6a20acd4ab2be9ac72820329de3f1453c5c36180f6c02d12e1

# Logging
LOG_LEVEL=info
LOGSTASH_HOST=logstash
LOGSTASH_PORT=5000

# Tracing
JAEGER_HOST=jaeger
JAEGER_OTLP_PORT=4318

# Consul
CONSUL_HOST=consul
CONSUL_PORT=8500

INSTANCE_ID=1
```

> **Tip:** generate secrets with `openssl rand -hex 32`

`node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`


### 3.2 `services/auth-service/.env`

```bash
PORT=3001
SERVICE_NAME=auth-service
MONGODB_URI=mongodb://root:Auth%40123@mongo-auth:27017/auth_db?authSource=admin

# Seeded admin account (created automatically on first startup)
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=Admin@123456
ADMIN_NAME=System Administrator

# Seeded demo manager + employee accounts
SEED_MANAGER_NAME=Manager1
SEED_MANAGER_EMAIL=manager1@gmail.com
SEED_MANAGER_PASSWORD=Manager@1234

SEED_EMPLOYEE_NAME=Employee1
SEED_EMPLOYEE_EMAIL=employee1@gmail.com
SEED_EMPLOYEE_PASSWORD=Employee@1234
```

### 3.3 `services/employee-service/.env`

```bash
PORT=3002
SERVICE_NAME=employee-service
MONGODB_URI=mongodb://root:Employee%40123@mongo-employee:27017/employee_db?authSource=admin
```

### 3.4 `services/leave-service/.env`

```bash
PORT=3003
SERVICE_NAME=leave-service
MONGODB_URI=mongodb://root:Leave%40123@mongo-leave:27017/leave_db?authSource=admin
EMPLOYEE_SERVICE_URL=http://employee-service:3002/api
```

### 3.5 `services/notification-service/.env`

```bash
PORT=3004
SERVICE_NAME=notification-service
MONGODB_URI=mongodb://root:Notification%40123@mongo-notification:27017/notification_db?authSource=admin

# Set to "log" to print notifications to stdout instead of sending email
# NOTIFICATION_CHANNEL=log

SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM=Leave Management <noreply@leavemgmt.com>
NOTIFICATION_CHANNEL=email
```

---

## 4. Start the Stack

```bash
# From the repo root (inside WSL2)
docker compose up -d --build
```

This will:
1. Pull base images (mongo, rabbitmq, nginx, consul, ELK, jaeger) on first run
2. Build the 4 Node.js service images
3. Start all containers in dependency order (databases + broker → consul → services → nginx)

### Check everything is running

```bash
docker compose ps
```

All containers should show `Up` or `Up (healthy)`. The service containers (`auth-service`, `employee-service`, etc.) may take 15–30 s to start while they wait for MongoDB and RabbitMQ health checks to pass.

### Watch logs

```bash
# All services
docker compose logs -f

# Single service
docker compose logs -f auth-service
```

---

## 5. Verify Services & UIs

| Service | URL | Credentials |
|---|---|---|
| **API Gateway** | http://localhost/health | — |
| **RabbitMQ UI** | http://localhost:15672 | `admin` / `admin123` |
| **Consul UI** | http://localhost:8500 | — |
| **Jaeger UI** | http://localhost:16686 | — |
| **Kibana** | http://localhost:5601 | — |
| **Elasticsearch** | http://localhost:9200 | — |
| **Mailpit** | http://localhost:8025 | — |

In Consul UI you should see all four services listed with green health checks within ~30 s of startup.

---

## 6. API Testing

All requests go through the nginx gateway on port 80. The base URL for every request is:

```
http://localhost
```

---

### Step 1 — Login

The admin account and a demo manager/employee are seeded automatically on first startup.

**Login as admin:**
```http
POST http://localhost/api/auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "Admin@123456"
}
```

**Login as manager:**
```http
POST http://localhost/api/auth/login
Content-Type: application/json

{
  "email": "manager1@gmail.com",
  "password": "Manager@1234"
}
```

**Login as employee:**
```http
POST http://localhost/api/auth/login
Content-Type: application/json

{
  "email": "employee1@gmail.com",
  "password": "Employee@1234"
}
```

A successful response returns:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "<JWT>",
    "refreshToken": "<token>"
  }
}
```

Copy the `accessToken`. All subsequent requests require it as a `Bearer` token.

---

### Step 2 — Auth Routes

| Method | URL | Role | Body |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | `{ email, password }` |
| `POST` | `/api/auth/register` | Admin | `{ name, email, password, role }` |

**Register a new user (admin token required):**
```http
POST http://localhost/api/auth/register
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "password": "Jane@12345",
  "role": "employee"
}
```

Valid roles: `admin`, `manager`, `employee`

---

### Step 3 — Employee Routes

| Method | URL | Role | Description |
|---|---|---|---|
| `GET` | `/api/employees/profile` | Any | Own profile + leave balance |
| `GET` | `/api/employees/leave-balance` | Any | Own leave balance |
| `GET` | `/api/employees/team` | Admin/Manager | Team members list |
| `GET` | `/api/employees/managers` | Admin | All managers |
| `GET` | `/api/employees/` | Admin | All employees |
| `GET` | `/api/employees/:id` | Admin/Manager/Owner | Single employee |
| `PUT` | `/api/employees/:id` | Admin | Update employee |
| `DELETE` | `/api/employees/:id` | Admin | Deactivate employee |

**Get own profile:**
```http
GET http://localhost/api/employees/profile
Authorization: Bearer <access_token>
```

---

### Step 4 — Leave Routes

| Method | URL | Role | Description |
|---|---|---|---|
| `POST` | `/api/leaves/` | Employee | Submit leave request |
| `GET` | `/api/leaves/my` | Employee | Own leave history |
| `GET` | `/api/leaves/` | Admin/Manager | All team leaves |
| `PUT` | `/api/leaves/:id/review` | Admin/Manager | Approve or reject |
| `PUT` | `/api/leaves/:id/cancel` | Employee | Cancel a pending request |

**Submit a leave request (employee token):**
```http
POST http://localhost/api/leaves/
Authorization: Bearer <employee_access_token>
Content-Type: application/json

{
  "leaveType": "casual",
  "startDate": "2026-07-01",
  "endDate": "2026-07-03",
  "reason": "Family function"
}
```

Valid `leaveType` values: `casual`, `sick`, `privilege`

**Approve a leave request (manager/admin token):**
```http
PUT http://localhost/api/leaves/<leave_id>/review
Authorization: Bearer <manager_access_token>
Content-Type: application/json

{
  "action": "approve",
  "comments": "Approved. Enjoy your time off."
}
```

**Reject a leave request:**
```http
PUT http://localhost/api/leaves/<leave_id>/review
Authorization: Bearer <manager_access_token>
Content-Type: application/json

{
  "action": "reject",
  "comments": "Insufficient staffing during this period."
}
```

**Cancel a leave (employee token, only if still pending):**
```http
PUT http://localhost/api/leaves/<leave_id>/cancel
Authorization: Bearer <employee_access_token>
Content-Type: application/json

{
  "reason": "Plans changed."
}
```

---

### Step 5 — Notification Routes

| Method | URL | Role | Description |
|---|---|---|---|
| `GET` | `/api/notifications/` | Any | Own notifications |

```http
GET http://localhost/api/notifications/
Authorization: Bearer <access_token>
```


## 7. Observability

### View Distributed Traces in Jaeger

1. Open http://localhost:16686
2. Select a service from the dropdown (e.g. `leave-service`)
3. Click **Find Traces**
4. Click any trace to see the full span tree including RabbitMQ publish/consume and MongoDB operations

### View Logs in Kibana

1. Open http://localhost:5601
2. Go to **Discover**
3. Create a data view for the `lms-logs-*` index pattern
4. Filter by `service`, `level`, or `traceId` (use `traceId` to correlate a Kibana log entry with a Jaeger trace)

### Check Service Health in Consul

1. Open http://localhost:8500
2. Click **Services** — all four services should show green (passing)
3. Click a service to see its health check output and registered address

---

## 8. Day-to-Day Commands

```bash
# Start the full stack
docker compose up -d

# Stop the full stack (data is preserved in volumes)
docker compose down

# Rebuild and restart a single service after a code change
docker compose up -d --build auth-service

# Rebuild all services
docker compose up -d --build

# View logs (live)
docker compose logs -f leave-service

# Open a shell inside a running container
docker exec -it auth-service sh

# Destroy everything including volumes (WARNING: deletes all data)
docker compose down -v
```
