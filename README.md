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

Set before running (or use `source ../local/scripts/setup-env.sh`):

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Postgres connection string (e.g. `postgresql://user:pass@localhost:5432/db`) |
| `REDIS_URL` | No | Redis URL for opaque token store (e.g. `redis://localhost:6379`) |
| `BACKEND_PORT` | No | Port (default 4567) |
| `FRONTEND_URL` | No | Frontend base URL used in email links (default `http://localhost:5678`) |
| `CORS_ORIGIN` | No | CORS allowed origin (default = `FRONTEND_URL`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID (loaded by `load-google-oauth.sh`) |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | Google OAuth callback URL (default `http://localhost:4567/auth/google/callback`) |
| `GOOGLE_ALLOWED_REDIRECT_URIS` | No | Optional comma-separated list of statically allowed `redirect_uri` values for third-party frontends (e.g. `https://app1.com/callback,https://app2.com/auth/cb`). The effective allow list = `FRONTEND_URL` (always) + this env var + URIs stored in DB via the console or `POST /management/redirect-uris`. Dynamic URIs added through the console or Management API take effect immediately without restart. |
| `SMTP_HOST` | No | SMTP host for email notifications (Mailhog on port 1025 locally) |
| `SMTP_PORT` | No | SMTP port (default 1025) |
| `SMTP_FROM` | No | Sender address (default `noreply@saintpetter.local`) |
| `RABBITMQ_URL` | No | RabbitMQ URL for async notifications |
| `PLATFORM_ADMIN_EMAIL` | No | On startup, assigns `platform_admin` role to this user (sign in first, then restart) |

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
