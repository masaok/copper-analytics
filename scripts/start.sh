#!/bin/sh
# Container entry point: bring the schema up to date, optionally seed, then serve.
set -e
pnpm --filter @copper/db migrate
if [ "$COPPER_SEED" = "1" ]; then
  pnpm --filter @copper/web seed
fi
exec pnpm --filter @copper/web start
