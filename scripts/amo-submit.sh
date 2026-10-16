#!/usr/bin/env bash
# Submit the extension to addons.mozilla.org (listed channel) with web-ext sign.
#
# Credentials are read from a local file you create yourself; they are never
# printed, passed on the command line or stored in the repository:
#
#   ~/.config/colluvio/amo.env   (chmod 600)
#     WEB_EXT_API_KEY=user:12345678:123
#     WEB_EXT_API_SECRET=...
#
# Override the location with AMO_ENV_FILE=/path/to/file.
#
# The first run creates the listing from amo/metadata.json. Later runs with a
# higher manifest version add a new listed version. --approval-timeout 0 means
# the script returns once Mozilla has accepted the upload; review continues
# on Mozilla's side (check with: node scripts/amo.mjs status).
set -euo pipefail

cd "$(dirname "$0")/.."
env_file="${AMO_ENV_FILE:-$HOME/.config/colluvio/amo.env}"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. See docs/PUBLISHING.md (step 2)." >&2
  exit 2
fi
if [[ "$(stat -c %a "$env_file")" != "600" ]]; then
  echo "$env_file must be readable only by you: chmod 600 \"$env_file\"" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a
: "${WEB_EXT_API_KEY:?WEB_EXT_API_KEY is not set in $env_file}"
: "${WEB_EXT_API_SECRET:?WEB_EXT_API_SECRET is not set in $env_file}"

npm test
npm run lint

npx web-ext sign \
  --source-dir extension \
  --artifacts-dir dist/signed \
  --channel listed \
  --amo-metadata amo/metadata.json \
  --approval-timeout 0
