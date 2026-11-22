# Running the whole backend on AWS (instead of Vercel)

Status: written from the code, **not yet tried**. It is a backup plan, not a migration that has been done.
The backend is `server/index.ts` (Express: website, API, case store client, check-in scheduler). The root `Dockerfile`
already runs it (`tsx server/index.ts`, port 8080, ffmpeg installed). When `VERCEL` is not set it listens on `PORT` by itself.

## What stays the same
- Data: the same Upstash Redis (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) works from AWS. Nothing to move.
- The call server (`interpreter`) keeps running as it does today.

## Shortcut: scripts (added after the first version of this page)
`deploy/backend.env.example` lists the variables. After creating `/root/backend.env`, run `bash scripts/aws-deploy.sh` (builds both images, replaces both containers, health-checks the backend) and once `bash scripts/aws-install-cron.sh` (daily job; reads `CRON_SECRET` from the env file). The CloudFront step below is still manual. Not run on a real server yet.

## What you have to do (about 1–2 hours the first time)
1. **Second container on the same EC2** (or a second instance). Build the backend image from the root Dockerfile:
   `docker build -t saathi-backend .` then
   `docker run -d --name backend --restart unless-stopped --env-file /root/backend.env -p 8081:8080 saathi-backend`
   (the call server already uses port 80, so the backend uses 8081). A t3.small has 2 GB RAM; running both is likely fine but unmeasured.
2. **Env file `/root/backend.env`**: copy every variable from Vercel (you type them on the server, never in chat). The ones the code reads:
   `STORE=redis` (or leave unset: Upstash is used when its URL is set), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SAATHI_SECRET`, `OPENAI_API_KEY`,
   `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_FROM_NUMBER`, `INTERPRETER_ORIGIN`, `SAATHI_BASE_URL` (the NEW public address of this backend), `CRON_SECRET`,
   `GOOGLE_MAPS_API_KEY`, `MSG91_*` if used, `CALL_ME_ALLOWLIST` / `CALL_ME_DAILY_MAX` / `CALL_ME_PEPPER` if used.
3. **HTTPS address**: create a second CloudFront distribution (same settings as the first: Pay-as-you-go plan, CachingDisabled, AllViewer, all methods, no extra protections)
   whose origin is the EC2 public DNS on **HTTP port 8081**. Open port 8081 in the instance's security group. Its `*.cloudfront.net` address is the new public site.
   `gulfsaathione.vercel.app` stays on Vercel; it does not move to AWS.
4. **Point things at the new address**: set `SAATHI_BASE_URL` (backend env) and `SAATHI_URL` in `/root/interpreter.env` to the new CloudFront origin, then restart both containers.
   The Plivo hangup address for website calls is built from `SAATHI_BASE_URL`, so it follows.
5. **Daily check-in job**: Vercel's cron does not exist on AWS. On the instance run `crontab -e` and add (one line, with your own values; keep the secret off the command history):
   `30 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<new-address>/api/saathi/cron >/dev/null`
6. **Smoke test**: open `https://<new-address>/api/health` (or `/`), submit nothing yet; then use docs/RELEASE_SMOKE.md.

## Risks
- A temporary workshop AWS account can be shut down; the public site would go with it. Keep Vercel as the main site unless AWS is yours long-term.
- You own uptime, HTTPS renewal (CloudFront handles certificates), updates and security. One server, no failover.
- Deploys are manual: `git pull && docker build … && docker rm -f backend && docker run …`.
