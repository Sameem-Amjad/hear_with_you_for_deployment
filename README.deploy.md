Deployment checklist and GitHub Actions / DigitalOcean instructions

Secrets required in GitHub repository settings (Actions > Secrets):
- `GHCR_TOKEN` : Personal access token with `write:packages` and `read:packages` (or use `GITHUB_TOKEN` if permitted)
- `DEPLOY_HOST` : Droplet public IP or hostname
- `DEPLOY_USER` : SSH username on droplet (e.g., `root` or `deploy`)
- `DEPLOY_SSH_KEY` : Private SSH key for the deploy user (PEM content)

Recommended droplet setup:
- Create a droplet (Ubuntu 22.04+) with Docker and Docker Compose v2 installed.
- Create `/home/<user>/app` directory as deployment folder (the workflow will copy files there).
- Ensure the deploy user can run `docker` (add to `docker` group) or use `root`.

How the pipeline works:
- On push to `main` the workflow builds a Docker image and pushes it to GitHub Container Registry as `ghcr.io/<owner>/<repo>:<sha>` and `:latest`.
- The workflow copies `docker-compose.yml` and `.env` to `~/app` on the droplet via `scp`.
- It logs into GHCR from the droplet, pulls the image, and restarts the compose stack.
- The workflow attempts to run `npx prisma migrate deploy` inside the running `app` container.

Notes and next steps:
- Replace values in `.env` on the droplet with production credentials (DB, Redis, JWT secret, etc.).
- For Managed Postgres, use the provider connection string in DATABASE_URL and enable private networking so your droplet can reach the DB securely.
- For Redis: this repo's `docker-compose.prod.yml` includes a `redis` service which will run Redis on the droplet. If you prefer a system Redis or a separate droplet, remove the `redis` service and set `REDIS_HOST`/`REDIS_PORT` accordingly in the droplet `~/app/.env`.
- If you prefer zero-downtime deploys, consider adding a simple rolling update strategy or use a load balancer.
