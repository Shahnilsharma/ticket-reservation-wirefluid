#!/bin/sh
set -eu

if [ "${RUN_DB_PUSH_ON_START:-false}" = "true" ]; then
  echo "Applying schema with prisma db push..."
  npx prisma db push
fi

if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  echo "Applying migrations with prisma migrate deploy..."
  npx prisma migrate deploy
fi

echo "Starting backend..."
exec npm run start:prod
