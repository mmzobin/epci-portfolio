#!/usr/bin/env bash
#
# Manual database backup (free-plan friendly). Dumps the whole database to a
# timestamped .sql file under backups/ and keeps the 14 most recent.
#
# Usage:
#   npm run db:backup            # loads BACKUP_DATABASE_URL from .env.backup
#
# BACKUP_DATABASE_URL must be the PROD *Session pooler* connection string
# (port 5432). The transaction pooler (6543) does NOT work with pg_dump.
#
set -euo pipefail

: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL (PROD session pooler, port 5432) in .env.backup}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install Postgres client tools, e.g.: brew install postgresql@17" >&2
  exit 1
fi

mkdir -p backups
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="backups/epci-backup-${STAMP}.sql"

echo "Backing up database to ${OUT} ..."
pg_dump "${BACKUP_DATABASE_URL}" --no-owner --no-privileges -f "${OUT}"
echo "Done: ${OUT}"

# Keep only the 14 most recent backups.
ls -1t backups/epci-backup-*.sql 2>/dev/null | tail -n +15 | xargs -r rm -f
