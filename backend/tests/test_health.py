import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///./test_inventory.db")
os.environ.setdefault("AUTO_SEED", "false")

from fastapi.testclient import TestClient
from app.main import app


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
