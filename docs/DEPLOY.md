# Deploy (demo link)

The server is one Node process. Audio (`eval/audio/`) and case files (`server/data/cases/`) stay off the image:
- **Audio:** your own recordings.
- **Case files:** personal data.

## Option A — AWS App Runner (simplest with the hackathon AWS account)

1. Build and push the image to Amazon ECR:
   ```bash
   aws ecr create-repository --repository-name gulf-saathi
   ```
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin <acct>.dkr.ecr.<region>.amazonaws.com
   ```
   ```bash
   docker build -t gulf-saathi .
   ```
   ```bash
   docker tag gulf-saathi <acct>.dkr.ecr.<region>.amazonaws.com/gulf-saathi:latest
   ```
   ```bash
   docker push <acct>.dkr.ecr.<region>.amazonaws.com/gulf-saathi:latest
   ```
2. In the console: App Runner → Create service → Container registry (ECR) → port **8080**.
3. Add environment variables `OPENAI_API_KEY`, `OPENAI_STT_MODEL` and `OPENAI_TEXT_MODEL`. Put the key in Secrets Manager rather than a plain variable.
4. Point Bolna's webhook forward and the `saathi_gate` tool at the App Runner HTTPS URL. The live mic also needs HTTPS, which App Runner provides.

## Option B — any VM (Lightsail, EC2)

```bash
docker build -t gulf-saathi .
```
```bash
docker run -d -p 80:8080 --env-file .env gulf-saathi
```

Put HTTPS in front (Caddy or a load balancer), because browsers only allow the microphone on HTTPS.

## Before making it public
- `/facts.html` and `/api/bolna/*` expose your test-call transcripts. They contain no phone numbers, but either remove them or put basic auth in front.
- `/webhooks/bolna` and `/api/gate` have no authentication yet. Add a shared secret header before real callers use it.

## Vercel and the Dockerfile
The root `Dockerfile` is for AWS or any container host. Vercel auto-detected it, built a container image for every deployment, and failed with "repository has reached the maximum allowed number of images". `.vercelignore` now excludes `Dockerfile`, so Vercel deploys the Node functions in `api/` as before. If a deployment still fails with that error, delete old images in the Vercel project (Sandboxes, then Container Registry) and redeploy.
