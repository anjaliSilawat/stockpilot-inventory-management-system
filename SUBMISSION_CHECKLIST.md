# Submission Checklist — Ethara AI Assessment

## Before publishing

- [ ] Copy `.env.example` to `.env` and replace the example PostgreSQL password.
- [ ] Run `docker compose up --build`.
- [ ] Confirm the frontend opens at `http://localhost:5173`.
- [ ] Confirm `http://localhost:8000/health` returns `{"status":"ok", ...}`.
- [ ] Confirm `http://localhost:8000/docs` opens Swagger documentation.
- [ ] Create one product, one customer, and one order. Check that stock reduces.
- [ ] Try ordering more than available stock. Confirm it is rejected.
- [ ] Cancel a created order. Confirm stock is restored.

## Publish the repository to GitHub

Create an empty **public** repository named `ethara-inventory-management-system`, then run these commands from this project folder:

```bash
git init
git add .
git commit -m "Build inventory and order management system"
git branch -M main
git remote add origin https://github.com/<your-github-username>/ethara-inventory-management-system.git
git push -u origin main
```

Verify that `.env` is not present on GitHub. The repository should include `.env.example`, Dockerfiles, `docker-compose.yml`, the full source code, and this README.

## Publish the required backend Docker Hub image

Replace `<dockerhub-username>` with the username shown in your Docker Hub account:

```bash
docker login
docker build -t <dockerhub-username>/capsulehub-inventory-backend:latest ./backend
docker push <dockerhub-username>/capsulehub-inventory-backend:latest
```

Open the Docker Hub repository in a browser and ensure it is public. The form value will be:

```text
https://hub.docker.com/r/<dockerhub-username>/capsulehub-inventory-backend
```

## Deploy configuration

### Backend Docker service

Deploy the `backend/` directory to a hosting platform that builds Dockerfiles. Supply these environment variables in the platform dashboard:

```text
DATABASE_URL=postgresql+psycopg://<user>:<password>@<host>:<port>/<database>?sslmode=require
FRONTEND_ORIGINS=https://<your-frontend-domain>
AUTO_SEED=true
PORT=8000
```

After it deploys, test:

```text
https://<your-backend-domain>/health
https://<your-backend-domain>/docs
```

### Frontend static site

Deploy the `frontend/` directory as a static/Vite site. During the build set:

```text
VITE_API_BASE_URL=https://<your-backend-domain>/api/v1
```

Build command:

```bash
npm ci && npm run build
```

Publish directory:

```text
dist
```

After the frontend is deployed, set the exact frontend URL in backend `FRONTEND_ORIGINS`, then redeploy the backend.

## Exact final form values

| Google Form field | Value to submit |
|---|---|
| GitHub Repository Link (Frontend + Backend) | `https://github.com/<your-github-username>/ethara-inventory-management-system` |
| Backend Docker Hub Image Link | `https://hub.docker.com/r/<dockerhub-username>/capsulehub-inventory-backend` |
| Frontend Hosted URL | `https://<your-frontend-domain>` |
| Backend API Hosted URL | `https://<your-backend-domain>/health` |

## Three-minute demo order

1. Start on the Dashboard and identify the stock and order cards.
2. Add a product with a unique SKU and an opening stock quantity.
3. Add a customer with a unique email.
4. Place an order and show reduced stock.
5. Attempt to over-order and show the conflict message.
6. Cancel the earlier valid order and show the restored stock plus audit transaction.
7. Open `/docs` and `/health` in a new tab.
