# Render deployment

This repository is prepared for a Node.js Render Web Service running the production Next.js server and a separate private Render service running Ollama with the existing `gemma3:4b` model. The app also uses the external Tiger Data Postgres database, SerpApi for search, Browserbase for remote browser sessions, Sentry for monitoring, and optionally DigitalOcean Spaces for uploaded artifacts. `render.yaml` describes both Render services and generates their shared Ollama API secret; provider credentials remain dashboard-only.

![THE UNCLAIMED Render deployment architecture](docs/architecture.svg)

See [the architecture notes](docs/architecture.md) for the complete request flow, trust boundaries, and persistence map.

## Architecture and Render credit

Render hosts the Next.js app and the model. Tiger Data, SerpApi, Browserbase, Sentry, and DigitalOcean Spaces remain separate services; configure their credentials as private Render environment variables. The app must use the Tiger Data connection string, not a local database.

The Blueprint selects Render's `1c-2g` plan (1 CPU, 2 GB RAM) for the app, currently listed at $25/month, and `2c-8g` (2 CPU, 8 GB RAM) for the private Ollama service, currently listed at $135/month. Together that is about $5.33/day, or $26.67 for five days, plus the small 5 GB model-disk charge and any usage beyond included workspace allowances. Render prorates paid compute per second, so shut the private model service down as soon as the demo ends. A $50 credit can cover a few days with room for initial setup, but check the live Billing page before launch and set a reminder to suspend/delete the model service after the event. It does not pay for external providers. See [Render compute plans](https://render.com/docs/compute-plans), [Render pricing](https://render.com/pricing), and [Render billing FAQ](https://render.com/docs/faq).

Local runs continue to use Ollama at `127.0.0.1:11434`. On Render, `gemma3:4b` runs in a separate private service; its Ollama listener is bound to container loopback and only an authenticated gateway is reachable from the Render private network. The gateway accepts only authenticated `POST /api/chat` and a limited health endpoint. The private service has no public URL. Do not expose the developer's local port publicly or replace Gemma with a cloud LLM. The model service keeps its downloaded model on a small Render disk; this is model cache only, while investigations and uploaded artifacts remain in Tiger Data and Spaces.

## Required Render environment variables

Enter these in Render's Environment settings or during the initial Blueprint setup. Do not commit their values or paste them into source files.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Tiger Data Postgres URL, including username/password and TLS. Tiger Cloud's supplied URL uses `sslmode=require`; the app enforces TLS for production and rejects plaintext/fallback SSL modes. Use `sslmode=verify-full` only after configuring the required CA certificate chain in Render. |
| `SERPAPI_API_KEY` | Server-side search credential. |
| `BROWSERBASE_API_KEY` | Server-side Browserbase credential. |
| `BROWSERBASE_PROJECT_ID` | Browserbase project associated with the API key. |
| `SENTRY_DSN` | Server/edge Sentry error reporting DSN. |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser Sentry DSN. A DSN is a public ingestion identifier, not an auth token. |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | Optional build-time source-map upload. Add them in Render only if you want Sentry source maps; keep the auth token secret and restrict it to the needed Sentry project. |

Render also generates `OLLAMA_API_KEY` in the Blueprint's environment group, shares it only with the web and private model services, and injects `OLLAMA_INTERNAL_HOST` from the private service reference. Do not set a public Ollama URL.

Set `BROWSERBASE_REGION` only to a supported region for the Browserbase project. Render provides `OLLAMA_INTERNAL_HOST` from the private service's internal hostname; the Blueprint sets its private gateway port and model name. Locally, the defaults remain `http://127.0.0.1:11434` and `gemma3:4b`.

### Optional artifact storage

If production users can upload or save artifacts, configure all of these together:

- `SPACES_ENDPOINT` — HTTPS regional endpoint such as `https://nyc3.digitaloceanspaces.com`.
- `SPACES_BUCKET`
- `SPACES_REGION` — datacenter slug matching the endpoint host.
- `SPACES_ACCESS_KEY`
- `SPACES_SECRET_KEY`
- `SPACES_URL_TTL_SECONDS` — optional, defaults to 900 seconds.

The bucket should remain private. Artifact downloads use short-lived presigned URLs. In production, artifact write/open operations now fail clearly if Spaces is not configured; they never silently write to Render's ephemeral local filesystem. Local artifact records created during development are not available in production and must be copied to Spaces before migrating that database.

### Other optional server-side settings

The existing defaults are suitable for a first deployment. Add these only when changing limits: `SEARCH_MAX_QUERIES`, `SEARCH_RESULTS_PER_QUERY`, `SEARCH_TIMEOUT_MS`, `CRAWL_MAX_DEPTH`, `CRAWL_MAX_PAGES`, `CRAWL_DELAY_MS`, `ARCHIVE_MAX_SOURCES`, `ARCHIVE_MAX_CAPTURES`, `ARCHIVE_TIMEOUT_MS`, `OLLAMA_TIMEOUT_MS`, and the `PRESENCE_*` settings. Check the corresponding config readers before adding settings; no secret belongs in a `NEXT_PUBLIC_` variable other than the Sentry DSN.

`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are only for the local sound-generation utility. The deployed application serves checked-in files from `public/audio`; it does not call ElevenLabs.

## Create the Render service

1. Push the repository to a Git provider connected to Render.
2. In Render, create a Blueprint from the repository and review `render.yaml`. It creates the Next.js Node service and the Ollama Docker private service. The app uses `npm ci && npm run build`, runs `npm run db:migrate` before each deploy, then starts with `npm run start`. The model service pulls `gemma3:4b` into its attached model-cache disk on first start.
3. Set the same Render region for both services; choose the region closest to Tiger Data when possible. Confirm the selected plans and live credit estimate in the Render dashboard.
4. Supply the required secrets in Render. Add the Spaces variables if artifact storage is enabled. Keep preview environments disabled until separate non-production credentials and a separate database are ready.
5. Confirm Tiger Data accepts connections from the deployed service and that its URL uses TLS. Confirm Browserbase and SerpApi credentials are valid.
6. Run the production build locally with the production configuration. Do not trigger the first deploy until that build succeeds and all required Render variables are present.
7. Deploy the Blueprint. Render runs database migrations before starting the app; wait until the private service log confirms the model pull has completed before trying analysis. Confirm logs contain no secret values.
8. At the end of the few-day demo, suspend the private Ollama service from Render. If the model will not be reused, delete its service and disk to stop compute and storage charges; leave the app service running only if you still need the hosted site.

Render's environment variable and Blueprint behavior is documented at [Environment Variables and Secrets](https://render.com/docs/configure-environment-variables) and [Blueprint Specification](https://render.com/docs/blueprint-spec). Secrets marked `sync: false` are supplied in the Render dashboard, not this repository.

## Health, sessions, and persistence

- Render checks `/api/health`; it runs `SELECT 1` against Tiger Data and verifies the private model gateway is ready before returning `{ ok: true }`. Failure returns only `{ ok: false }` with no connection detail. `/api/health/database` provides the database-only health response.
- Investigation, evidence, artifact metadata, and Browserbase session metadata live in Postgres. Production artifact bytes require private Spaces; no user files are written to local Render storage. The checked-in `public/audio` files are static deployment assets, not user persistence.
- Browser connections are detached in `finally` blocks. Stopping or completing an investigation requests Browserbase release and records the session as closed. Browserbase sessions have a bounded API timeout (300 or 600 seconds) as a fallback if the app process terminates unexpectedly. Keep the Browserbase project retention policy appropriate for investigation data.
- The model API key is generated by Render and checked with constant-time comparison in a small gateway. The raw Ollama API listens only on `127.0.0.1` inside its container; the gateway is reachable only through the same-region Render private network. Render's private services have no public URL and only communicate over their private network. [Render private networking](https://render.com/docs/private-network).
- The app needs no persistent Render disk. The model service alone uses a 5 GB disk for its model cache; it does not store investigations or user files. Do not enable local artifact persistence as a production fallback.

## Sound-effect coverage

The pasted sound plan is now represented in the sound library and event map. Existing checked-in clips cover archive ambience, server hum, radio static, metallic knock, keyboard clicks, and digital glitch. The prompts/event map now include empty-room ambience, hard-drive startup, tape rewind, notification, whisper-like wind without intelligible words, and a rare corrupted transmission. Those six new MP3 files are not in `public/audio` yet, so the audio player safely skips them until generated and added. The three existing spoken whisper clips remain in the library for the audio gallery, but presence events now map to the nonverbal wind clip requested by the plan.

The manager arms investigation audio only after the user's explicit audio click and respects Settings volume/mute. Generate missing files locally using the audio-generation script and your own authorized ElevenLabs credentials, then review the loudness and ensure no speech/jumpscare was generated before committing. Ambient volume stays capped and event effects are gain-reduced.

## Verification checklist

- [ ] `npm ci` completes from the lockfile.
- [ ] `npm run build` succeeds with the intended production environment.
- [ ] Tiger Data URL is valid, TLS-enabled, and uses the correct production database.
- [ ] Render has SerpApi, Browserbase, Sentry, and (if used) Spaces variables configured as secrets.
- [ ] Spaces bucket is private; a test artifact upload/download returns a short-lived URL.
- [ ] Render `/api/health` returns HTTP 200; make Tiger Data unavailable in staging and confirm it returns HTTP 503 without exposing secrets.
- [ ] Database migrations complete before the app process starts.
- [ ] Start, navigate, stop, and complete a Browserbase investigation; confirm the remote session is released and the DB status closes.
- [ ] Confirm no Ollama endpoint or port is reachable from the public internet and local analysis still uses Gemma 3 4B.
- [ ] Confirm the model API rejects a request without the generated bearer key and accepts one from the app over Render's private network.
- [ ] Confirm `gemma3:4b` has finished pulling before starting an analysis.
- [ ] Suspend or delete the private Ollama service when the demo ends; delete its cache disk too if you do not plan to reuse it.
- [ ] Confirm no production artifact is written to `.data` and there is no Render persistent disk dependency.
- [ ] Confirm Sentry receives a safe test event in a controlled environment and scrub rules remove sensitive request data.
- [ ] Verify audio stays silent until explicitly enabled, uses the requested event mapping, and safely skips clips that are still missing.
