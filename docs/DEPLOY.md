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
Set `SAATHI_SECRET` for review and live agent requests. On HTTPS, open `/facts.html` and enter username `review` and the secret as the password. Recordings, Bolna fact edits, case files and Bolna benchmark results require the same credentials. API clients can use the existing `x-saathi-secret` header. The UI and API disable caching for these resources. Configure the secret on Bolna tools and webhooks.

## Vercel and the Dockerfile
Vercel treats this project as a **container build**: the root `Dockerfile` is its entrypoint, and every deployment pushes an image to the project's container registry. The registry has a maximum number of images; when it is full every build fails with "denied: repository has reached the maximum allowed number of images". Fix: delete old images (project, Sandboxes, Container Registry) and redeploy.
Do not move or delete the root `Dockerfile`: the build then fails with "Container service must specify an entrypoint".
To save images, branch previews are off for the working branch (`vercel.json`, `git.deploymentEnabled`); only merges to `main` deploy.
