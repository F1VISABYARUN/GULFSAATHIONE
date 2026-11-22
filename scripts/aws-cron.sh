#!/usr/bin/env bash
# Daily check-in job (replaces Vercel Cron). Reads CRON_SECRET from /root/backend.env so the secret is not in the crontab.
set -euo pipefail
set -a; . /root/backend.env; set +a
curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "${SAATHI_BASE_URL}/api/saathi/cron" >/dev/null
