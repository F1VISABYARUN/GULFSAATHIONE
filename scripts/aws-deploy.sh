#!/usr/bin/env bash
# Update and restart both containers on the EC2 instance. Run from the repository folder as root: bash scripts/aws-deploy.sh
# Needs /root/interpreter.env and /root/backend.env (see deploy/backend.env.example). Prints no secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in /root/interpreter.env /root/backend.env; do [ -f "$f" ] || { echo "Missing $f"; exit 1; }; done
git fetch -q origin main && git checkout -q main && git pull -q origin main
RELEASE=$(git rev-parse --short HEAD)
echo "Building $RELEASE"
docker build -q -f Dockerfile.interpreter -t saathi-interpreter .
docker build -q -t saathi-backend .
docker rm -f interpreter backend >/dev/null 2>&1 || true
docker run -d --name interpreter --restart unless-stopped --env-file /root/interpreter.env -p 80:8080 saathi-interpreter >/dev/null
docker run -d --name backend --restart unless-stopped --env-file /root/backend.env -e RELEASE_COMMIT="$RELEASE" -p 8081:8080 saathi-backend >/dev/null
sleep 6
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
if curl -fsS http://localhost:8081/api/health >/dev/null; then echo "backend: healthy ($RELEASE)"; else echo "backend: NOT healthy, run: docker logs backend --tail 50"; exit 1; fi
