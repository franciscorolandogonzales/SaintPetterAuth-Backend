# SaintPetter Auth — Backend

NestJS API for authentication and authorization. Port **4567**.

## Prerequisites

- Node.js LTS (>= 20)
- Yarn
- Postgres (e.g. via [local/docker-compose.yml](../local/docker-compose.yml))
- Redis (optional but recommended for tokens/sessions)

## Setup

```bash
yarn install
```

## Environment

Variables con prefijo **SPA_** (ver `backend/.env.example`). Puedes usar `backend/.env` o `source ../local/scripts/setup-env.sh`:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SPA_POSTGRES_URL` | Sí | Cadena de conexión Postgres |
| `SPA_REDIS_URL` | No | Redis (ej. `redis://127.0.0.1:6379`) |
| `SPA_FRONTEND_URL` | Sí | URL del frontend (emails, CORS) |
| `SPA_BACKEND_PORT` | No | Puerto (default 4567) |
| `SPA_CORS_ORIGIN` | No | Origen CORS (default = `SPA_FRONTEND_URL`) |
| `SPA_GOOGLE_CLIENT_ID` / `SPA_GOOGLE_CLIENT_SECRET` / `SPA_GOOGLE_CALLBACK_URL` | No | Google OAuth |
| `SPA_GOOGLE_ALLOWED_REDIRECT_URIS` | No | Lista de `redirect_uri` permitidos (además del frontend) |
| `SPA_SMTP_HOST` / `SPA_SMTP_PORT` / `SPA_SMTP_FROM` | No | SMTP (Mailhog: 127.0.0.1:1025) |
| `SPA_RABBITMQ_URL` | No | RabbitMQ para cola de notificaciones |
| `SPA_PLATFORM_ADMIN_EMAIL` | No | Al arrancar, el seed asigna rol `platform_admin` a este email (el usuario debe existir; inicia sesión una vez y reinicia el backend) |

### Acceso denegado a la consola de gestión

Si puedes hacer login pero ves *"Access Denied - You need the platform_admin or org_admin role"*:

1. **Asignar rol sin reiniciar:** desde `backend/` ejecuta:
   ```bash
   yarn assign-platform-admin franciscorolandogonzalezburgos@gmail.com
   ```
   (o el email con el que iniciaste sesión). Usa las variables de `backend/.env` o `SPA_POSTGRES_URL`.

2. **O bien** define `SPA_PLATFORM_ADMIN_EMAIL` en `.env` (o al lanzar el script de local), reinicia el backend y vuelve a entrar en la consola.

## Run

```bash
yarn start        # production
yarn start:dev    # watch mode
yarn start:debug  # debug mode
```

## Test and lint

```bash
yarn test
yarn lint
yarn build
```

## API overview

See [spec/openapi.yaml](../spec/openapi.yaml) for the full Auth API and [spec/management-openapi.yaml](../spec/management-openapi.yaml) for the Management API.

### Auth API (`/`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register with email and password |
| `POST` | `/auth/login` | Login (email/password) |
| `POST` | `/auth/refresh` | Exchange refresh token |
| `POST` | `/auth/logout` | Invalidate session |
| `GET` | `/auth/google` | Start Google OAuth flow |
| `POST` | `/auth/password-reset/request` | Request password reset |
| `POST` | `/auth/password-reset/confirm` | Confirm password reset |
| `POST` | `/auth/mfa/totp/enroll` | Enroll TOTP MFA |
| `POST` | `/auth/mfa/totp/verify` | Verify TOTP code |
| `POST` | `/authorization/check` | RBAC authorization check (user + actions + resource → allowed) |
| `GET` | `/sessions` | List active sessions |
| `DELETE` | `/sessions/:id` | Revoke session |
| `POST` | `/notifications/send` | Send notification (email/Telegram) |
| `GET` | `/events` | Poll domain events |
| `GET` | `/health` | Health check |

### Management API (`/management`)

Requires `platform_admin` (global) or `org_admin` (org-scoped) role.  
Both human users (session token) and service accounts (API key) are accepted.

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/management/organizations` | List / create organizations |
| `GET/PATCH/DELETE` | `/management/organizations/:id` | Get / update / delete organization |
| `GET` | `/management/organizations/:id/users` | List users in org |
| `GET/POST` | `/management/resources` | List / create resources |
| `GET/DELETE` | `/management/resources/:id` | Get / delete resource |
| `GET/POST` | `/management/roles` | List / create roles |
| `GET/POST` | `/management/roles/:id/permissions` | List / add permissions |
| `GET/POST` | `/management/service-accounts` | List / create service accounts |
| `GET/DELETE` | `/management/service-accounts/:id` | Get / delete service account |
| `GET/POST` | `/management/service-accounts/:id/api-keys` | List / create API keys |
| `DELETE` | `/management/service-accounts/:id/api-keys/:keyId` | Revoke API key |

## Authentication model

| Caller | How | Notes |
|--------|-----|-------|
| Human user | `Authorization: Bearer <session_token>` | Opaque token from login/refresh |
| Service account | `Authorization: Bearer spk_<hex>` | API key; scoped to one org; no session |

Service accounts are automatically scoped to their `organizationId`. They cannot access data outside their organization.

## Bootstrap seed

On startup, the seed module creates (idempotently):
- Organization **System** (slug: `system`)
- Roles: `platform_admin`, `org_admin`, `member`
- System resources: `auth:organization`, `auth:user`, `auth:resource`, `auth:role`, `auth:permission`
- Default permissions per role

See [spec/default-data.md](../spec/default-data.md) for the full contract.
