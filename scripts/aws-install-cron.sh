#!/usr/bin/env bash
# Adds the daily 03:30 UTC job once. Run as root from the repository folder: bash scripts/aws-install-cron.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LINE="30 3 * * * bash $DIR/scripts/aws-cron.sh"
( crontab -l 2>/dev/null | grep -vF "aws-cron.sh" ; echo "$LINE" ) | crontab -
crontab -l | grep aws-cron.sh
