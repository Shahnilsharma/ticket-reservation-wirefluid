# Production Deployment Guide

This repository is best deployed as:

- Frontend on Vercel (Next.js native platform).
- Backend as a Docker container on a VM/container host.
- PostgreSQL as a managed service (recommended) or Docker service.

## Why This Topology

- Next.js officially supports Vercel directly with standard `build` and `start` scripts.
- Backend is an independent Express + Socket.IO API and is straightforward to run in a container.
- Database should be durable and separately managed in production.

## 1. Backend: Build and Run Docker Image

From repo root:

```bash
cd backend
npm ci
npm run build
cd ..

docker build -t wirefluid-backend:latest ./backend
```

Run backend with explicit environment values:

```bash
docker run -d \
  --name wirefluid-backend \
  -p 4000:4000 \
  -e NODE_ENV=production \
  -e PORT=4000 \
  -e DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?schema=public' \
  -e CORS_ORIGIN='https://your-vercel-app.vercel.app' \
  -e WIREFLUID_RPC_URL='https://evm.wirefluid.com' \
  -e WIREFLUID_CONTRACT_ADDRESS='0x5D21dA3Fd25Af95f6b26E8b8784C431E06D5A940' \
  wirefluid-backend:latest
```

Health check endpoint:

- `GET /healthz`

## 1.1 Live Server (Recommended)

Use the dedicated server compose file with a real production env file.

On the server:

```bash
git clone <your-repo-url>
cd ticket-reservation-wirefluid
cp .env.server.example .env.server
```

Edit `.env.server` with real values (database URL, cors origin, chain config), then run:

```bash
docker compose -f docker-compose.server.yml up --build -d
```

Verify:

```bash
curl -s http://localhost:4000/healthz
docker compose -f docker-compose.server.yml ps
docker compose -f docker-compose.server.yml logs --tail=100 backend
```

Rolling update after new commits:

```bash
git pull
docker compose -f docker-compose.server.yml up --build -d
```

## 2. Local Container Stack (Backend + Postgres)

For local production-like testing:

```bash
docker compose -f docker-compose.backend.yml up --build -d
```

This compose file defaults to:

- Postgres on `localhost:5432`
- Backend on `localhost:4000`
- `RUN_DB_PUSH_ON_START=true` to auto-create schema for first boot

Stop it with:

```bash
docker compose -f docker-compose.backend.yml down
```

This file is for local/prod-like validation, not the recommended public production topology.

## 3. Frontend on Vercel

In Vercel:

1. Import the `frontend` directory as a Next.js project.
2. Add environment variable:
   - `NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain`
3. Deploy.

## 4. Backend Environment Variables

Start from `backend/.env.example`.

Required:

- `DATABASE_URL`

Recommended:

- `CORS_ORIGIN=https://your-vercel-domain`
- `WIREFLUID_RPC_URL`
- `WIREFLUID_CONTRACT_ADDRESS`
- `CONTRACT_SYNC_INTERVAL_MS`
- `CONTRACT_SYNC_BATCH_SIZE`

Optional startup flags:

- `RUN_DB_PUSH_ON_START=true|false`
- `RUN_MIGRATIONS_ON_START=true|false`

## 5. Prisma in Production

Current repository state does not include a `prisma/migrations` folder. Because of that:

- `RUN_DB_PUSH_ON_START=true` is used for easy bootstrap.
- Long-term production should migrate to migration-driven deploys (`prisma migrate deploy`) in CI/CD.

Suggested next step to move to migration workflow:

```bash
cd backend
npx prisma migrate dev --name init
```

Commit the generated `prisma/migrations` directory, then set `RUN_DB_PUSH_ON_START=false` and run `prisma migrate deploy` during release.

## 6. Senior Review Checklist

- Backend image builds from `backend/Dockerfile`.
- Backend runs as non-root user in container.
- Health endpoint available at `/healthz`.
- Frontend points to backend using `NEXT_PUBLIC_BACKEND_URL`.
- CORS restricted with `CORS_ORIGIN` to frontend domain.
- Database credentials provided through environment variables only.
- Startup DB behavior controlled via `RUN_DB_PUSH_ON_START` / `RUN_MIGRATIONS_ON_START`.
