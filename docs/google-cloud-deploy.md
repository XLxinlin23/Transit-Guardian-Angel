# Deploying to Google Cloud Run

The app builds as a standalone Node.js server (`NITRO_PRESET=node-server`,
set automatically in the `Dockerfile`) and listens on the `PORT` environment
variable, which Cloud Run provides.

## One-command deploy

```sh
gcloud run deploy wayline --source . --region asia-southeast1 --allow-unauthenticated
```

Cloud Build builds the container from the `Dockerfile` and deploys it. After
deploy, Cloud Run prints your public URL.

## Subsequent updates

Re-run the same command after pulling the latest code.

## Notes

- The database and sign-in stay on Lovable Cloud — the public app URL and
  publishable key are baked in at build time from `.env`, so no extra setup
  is needed for them.
- Google Maps routing goes through Lovable's connector gateway, which is only
  available when hosted on Lovable. On Cloud Run the app automatically falls
  back to its built-in local routing, so journey planning still works.
- Secrets such as `LOVABLE_API_KEY` are not available outside Lovable hosting;
  nothing needs to be configured, the fallback covers it.
