# AWS runbook: phone interpreter (EC2 + CloudFront)

Written from general AWS knowledge and **not run**. Console labels and CLI flags may differ; verify as you go. The Workshop Studio
account is temporary (72 h from 11/21 05:56 per its event page) and may block some services. Do not store real worker data there.
Only the interpreter goes on AWS. The main app stays on Vercel. Why EC2 + CloudFront: CloudFront gives an HTTPS/WSS address on a
`*.cloudfront.net` name without a domain, and it supports WebSockets.

## 0. Before you start
- Pick **us-east-1** (one of the two allowed regions). Keep every resource in that region (CloudFront itself is global).
- **Rotate `SAATHI_SECRET`** in Vercel first (the value used during testing was weak) and redeploy. Use the new value below.
- Have ready: `SAATHI_URL` (the Vercel app origin, e.g. `https://<app>.vercel.app`), `SAATHI_SECRET`, `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`,
  `INTERPRETER_HUMAN_NUMBER` (E.164 desk phone), `OPENAI_API_KEY`.

## 1. Launch the server (EC2)
1. Console -> EC2 -> Launch instance. Name `saathi-interpreter`. AMI: Amazon Linux 2023. Type: `t3.small`. Key pair: create/download one (or use Session Manager).
2. Network: new security group `saathi-interpreter-sg`. Inbound: TCP **8080** from anywhere for now (tightened in step 5). SSH 22 only from your IP, or skip SSH and use Session Manager.
3. Launch, then note the instance's **Public IPv4 DNS** (looks like `ec2-1-2-3-4.compute-1.amazonaws.com`).

## 2. Install Docker and build the image
SSH in (or Session Manager) and run:

    sudo dnf install -y docker git
    sudo systemctl enable --now docker
    git clone https://github.com/F1VISABYARUN/GULFSAATHIONE.git
    cd GULFSAATHIONE
    sudo docker build -f Dockerfile.interpreter -t saathi-interpreter .

## 3. Run it (placeholders until step 4 gives the real origin)
Create `/home/ec2-user/interpreter.env` (never commit it; `chmod 600`):

    INTERPRETER_ORIGIN=https://REPLACE_AFTER_STEP_4.cloudfront.net
    SAATHI_URL=https://YOUR-APP.vercel.app
    SAATHI_SECRET=...
    PLIVO_AUTH_ID=...
    PLIVO_AUTH_TOKEN=...
    INTERPRETER_HUMAN_NUMBER=+91XXXXXXXXXX
    OPENAI_API_KEY=...
    INTERPRETER_TARGET=ar
    INTERPRETER_MODE=agent

Start it (restarts after reboot):

    sudo docker run -d --name interpreter --restart unless-stopped --env-file /home/ec2-user/interpreter.env -p 8080:8080 saathi-interpreter
    sudo docker logs -f interpreter

Check from the instance: `curl -i http://localhost:8080/answer` should return **403** (unsigned requests are refused). That is correct.

## 4. HTTPS with CloudFront
1. Console -> CloudFront -> Create distribution.
2. Origin domain: the EC2 **Public IPv4 DNS**. Protocol: **HTTP only**, HTTP port **8080**.
3. Viewer protocol policy: **HTTPS only**. Allowed methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** (WebSocket upgrade needs GET with the upgrade headers).
4. Cache policy: **CachingDisabled**. Origin request policy: **AllViewer** (forwards the `X-Plivo-Signature-V3*` headers and all query strings; the signature check fails without them).
5. Create, wait for status Deployed, copy the **Distribution domain name** (`dxxxx.cloudfront.net`).
6. Put `INTERPRETER_ORIGIN=https://dxxxx.cloudfront.net` in the env file (no trailing slash, no path), then:

        sudo docker rm -f interpreter
        sudo docker run -d --name interpreter --restart unless-stopped --env-file /home/ec2-user/interpreter.env -p 8080:8080 saathi-interpreter

Note: the Plivo signature is computed over `INTERPRETER_ORIGIN`. If it differs from the exact address Plivo calls, every call returns 403.

## 5. Tighten access (recommended)
Restrict inbound 8080 in the security group to the CloudFront managed prefix list (`com.amazonaws.global.cloudfront.origin-facing`).
If the workshop account does not allow that, leave it open: requests are still rejected without a valid Plivo signature.

## 6. Plivo
1. Console -> Voice -> Applications -> new application. Answer URL: `https://dxxxx.cloudfront.net/answer` (method **GET**); add `?case_id=GS-XXXX` to bind a case. Optional `&mode=keypad` for the old keypad mode.
2. Attach it to a **main-account** number (subaccount numbers failed signature checks earlier on the Bolna path).
3. Call the number.

## 7. What to watch
- `sudo docker logs -f interpreter`: JSON lines `asr`, `think`, `human_dial_ended`. No audio is logged.
- 403 on every call: wrong `INTERPRETER_ORIGIN`, headers not forwarded, or wrong `PLIVO_AUTH_TOKEN`.
- Call connects but no audio: WebSocket not passing CloudFront (check step 4.3 and 4.4) or Plivo stream events differ from what the code expects (unverified).
- Long silences: note the `asr` and `think` milliseconds and report them.

## 8. Shut down
Terminate the EC2 instance and delete the CloudFront distribution (disable first, then delete). Remove the Plivo application's answer URL.

## Unverified
Everything on this page against a real account; Plivo's real stream and dial parameters; CloudFront's WebSocket idle timeout versus long calls.
