Wirefluid Backend Deployment Handoff

Status
- Frontend is live on Vercel: https://ticket-reservation-wirefluid.vercel.app/
- Dockerized backend deployment files are prepared.
- Sensitive env files are ignored by git.
- Only env template files are intended to be committed.

Files to use
- docker-compose.server.yml
- .env.server.example
- DEPLOYMENT.md

Env fields senior must fill in .env.server
1. DATABASE_URL
   - Required.
   - Use existing production Postgres URL to preserve current state.

Optional fields only if different from defaults
2. WIREFLUID_RPC_URL
3. WIREFLUID_CONTRACT_ADDRESS
4. CONTRACT_SYNC_INTERVAL_MS
5. CONTRACT_SYNC_BATCH_SIZE

Pre-filled and normally unchanged
- NODE_ENV=production
- PORT=4000
- CORS_ORIGIN=https://ticket-reservation-wirefluid.vercel.app
- RUN_DB_PUSH_ON_START=false
- RUN_MIGRATIONS_ON_START=false

Deploy commands (server)
1. cp .env.server.example .env.server
2. Edit .env.server and set DATABASE_URL
3. docker compose -f docker-compose.server.yml up --build -d
4. docker compose -f docker-compose.server.yml ps
5. docker compose -f docker-compose.server.yml logs --tail=120 backend
6. curl -sS http://localhost:4000/healthz

Frontend requirement in Vercel
- NEXT_PUBLIC_BACKEND_URL must point to backend public URL.

Data safety
- Do not run seed or reset scripts.
- Existing state is preserved by using current database and keeping:
  - RUN_DB_PUSH_ON_START=false
  - RUN_MIGRATIONS_ON_START=false
