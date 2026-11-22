# Check a deployed Saathi release

Use a deployment URL you control. Set `SAATHI_SECRET` locally to the deployment's existing secret. Vercel exposes its deployed revision through the system variable `VERCEL_GIT_COMMIT_SHA` when system variables are enabled. Other hosts can inject the full 40-character Git SHA as `RELEASE_COMMIT` at build or deployment time.

```bash
EXPECTED_REVISION=$(git rev-parse HEAD) npx tsx scripts/smoke-release.ts https://gulfsaathione.vercel.app
```

The command reads public health, checks anonymous access to the private fact sheet and a nonexistent audio filename, and submits an empty transcription request. An authenticated HTTP 400 with `audio file required` confirms that the request reached input validation. No worker record, call, transcript, provider key, audio or SMS is needed. The script reports the SHA from the application. It exits 0 when all checks pass, 1 for a failed check, and 2 if checks were skipped. A missing revision on older deployments fails an explicitly requested SHA check. A 503 on a private route means the deployment needs configuration and fails the release check.

Provider credentials, spoken translation, model accuracy and phone transfer require separate tests.
