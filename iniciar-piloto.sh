#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
export SIGEIA_MODE=pilot
exec node scripts/start.mjs
