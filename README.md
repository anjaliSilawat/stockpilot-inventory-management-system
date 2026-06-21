# CapsuleHub — Inventory & Order Management System

## Live Links

- Frontend: https://ethara-inventory-frontend-brown.vercel.app
- Backend API Documentation: https://ethara-inventory-api-zf9s.onrender.com/docs
- Backend Health Check: https://ethara-inventory-api-zf9s.onrender.com/health
- Docker Hub Image: https://hub.docker.com/r/anjalisilawat/ethara-inventory-backend

A full-stack assessment project for managing **products, customers, orders, and inventory**. The application enforces inventory rules server-side, prevents orders that exceed available stock, and records every stock movement for traceability.


## Assessment requirements covered

- React responsive frontend for products, customers, orders, and inventory tracking
- Python FastAPI REST API
- PostgreSQL persistence
- Unique product SKU and unique customer-email validation
- Order stock validation and atomic stock deduction
- Prevention of orders with insufficient stock
- Inventory adjustment history / audit trail
- Dockerfiles and Docker Compose
- Environment-variable based configuration; no real credentials are committed
- Seed data for an immediately usable demo
- Health endpoint and interactive API documentation

## Architecture

```text
React (Vite) frontend
        |
        | HTTP / JSON
        v
FastAPI backend  --->  PostgreSQL
        |
        +--> Inventory transactions (audit trail)
```

## Core business rules

1. A product SKU is unique (case-normalized to uppercase).
2. A customer email is unique (case-normalized to lowercase).
3. Every order must contain at least one distinct product with a positive quantity.
4. The API locks the affected product rows while creating an order, verifies stock, and then reduces stock in the same database transaction. This avoids overselling under concurrent requests.
5. A manual negative inventory adjustment cannot make stock negative.
6. Cancelling a created order restores each ordered quantity and writes a `RETURN_IN` inventory transaction.

## Repository layout

```text
.
├── backend/                 # FastAPI service
│   ├── app/
│   │   ├── routers/          # Products, customers, orders, inventory, dashboard
│   │   ├── models.py         # SQLAlchemy entities
│   │   ├── schemas.py        # Request/response validation
│   │   ├── services.py       # Transactional order / inventory logic
│   │   └── main.py
│   └── Dockerfile
├── frontend/                # React + Vite app
│   ├── src/
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Run locally with Docker Compose (recommended)

### Prerequisites

- Docker Desktop
- Git

### Steps

```bash
# 1. Clone the repository
 git clone <YOUR_GITHUB_REPOSITORY_URL>
 cd ethara-inventory-management-system

# 2. Create a local environment file
 cp .env.example .env

# 3. Replace POSTGRES_PASSWORD in .env with a strong local password.

# 4. Start all services
 docker compose up --build
```

Open:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:8000/health`
- Swagger API documentation: `http://localhost:8000/docs`

To stop services:

```bash
docker compose down
```

To remove the local database volume as well:

```bash
docker compose down -v
```

## Run without Docker

### Backend

1. Create a PostgreSQL database and set `DATABASE_URL` in `.env`.
2. From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate             # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite development server runs at `http://localhost:5173` by default.

## API overview

| Area | Endpoint examples |
|---|---|
| Health | `GET /health` |
| Dashboard | `GET /api/v1/dashboard/summary` |
| Products | `GET/POST /api/v1/products`, `PATCH/DELETE /api/v1/products/{id}` |
| Customers | `GET/POST /api/v1/customers`, `PATCH/DELETE /api/v1/customers/{id}` |
| Orders | `GET/POST /api/v1/orders`, `POST /api/v1/orders/{id}/cancel` |
| Inventory | `GET /api/v1/inventory/transactions`, `POST /api/v1/inventory/adjustments` |

The complete interactive contract is available at `/docs` while the backend is running.

## Example API request — create an order

```json
POST /api/v1/orders
{
  "customer_id": 1,
  "notes": "Priority delivery",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 2, "quantity": 1 }
  ]
}
```

If any requested quantity is unavailable, the API returns HTTP `409 Conflict` and does not deduct stock for any item.

## Deployment plan

Use three independently deployable services:

1. **PostgreSQL:** create a managed PostgreSQL database and copy its connection string into the backend `DATABASE_URL` environment variable.
2. **Backend:** deploy `backend/` using its Dockerfile. Set `DATABASE_URL`, `FRONTEND_ORIGINS`, and `AUTO_SEED=true` initially. The public service URL should expose `/health` and `/docs`.
3. **Frontend:** deploy `frontend/` as a static site. During its build set `VITE_API_BASE_URL` to `https://<your-backend-domain>/api/v1` and redeploy.
4. Update the backend `FRONTEND_ORIGINS` to include the final frontend URL, then restart/redeploy the backend.

### Docker Hub submission image

After replacing `<dockerhub-username>` with your Docker Hub user name:

```bash
docker build -t <dockerhub-username>/capsulehub-inventory-backend:latest ./backend
docker login
docker push <dockerhub-username>/capsulehub-inventory-backend:latest
```

Your form submission needs:

- GitHub repository: `https://github.com/<username>/ethara-inventory-management-system`
- Docker Hub backend image: `https://hub.docker.com/r/<dockerhub-username>/capsulehub-inventory-backend`
- Frontend hosted URL: `https://<your-frontend-domain>`
- Backend hosted URL: `https://<your-backend-domain>/health`

## Suggested 3-minute reviewer demo

1. Open the dashboard and point out product, customer, order, low-stock, and audit information.
2. Create a new product with an SKU and stock quantity.
3. Create a customer with a unique email.
4. Create an order. Show that stock decreases and a transaction appears in Inventory.
5. Attempt an order that exceeds stock. Show the meaningful validation message and unchanged stock.
6. Cancel the valid order. Show restored stock and the `RETURN_IN` audit record.
7. Open `/docs` and `/health` to show API usability and deployment readiness.

## Scope note

Authentication and role-based access control are intentionally out of scope because the assessment specification does not require them. The backend remains the source of truth for all validation; the frontend only improves usability.
