#!/bin/sh
set -e

echo ">> Waiting for MySQL (${DATABASE_URL})..."
attempt=0
max_attempts=60

while [ "$attempt" -lt "$max_attempts" ]; do
  if node -e "
    const mysql = require('mysql2/promise');
    mysql.createConnection(process.env.DATABASE_URL)
      .then((conn) => conn.end())
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  "; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$attempt" -eq "$max_attempts" ]; then
  echo ">> ERROR: MySQL connection timeout"
  exit 1
fi

echo ">> Running DB migrations..."
pnpm exec drizzle-kit migrate

echo ">> Starting application..."
exec "$@"
