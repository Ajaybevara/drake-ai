"""Basic API tests for Drake AI backend"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from backend.app.core.database import Base, get_db

# Use an in-memory SQLite database for isolated tests and persist it across connections
SQLALCHEMY_TEST_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def register_user(email: str):
    response = client.post("/api/auth/register", json={
        "email": email,
        "full_name": "Test User",
        "password": "Test@1234",
        "role": "petrophysicist",
    })
    assert response.status_code == 201
    return response.json()["id"]


def login_user(email: str):
    response = client.post("/api/auth/login", json={
        "email": email,
        "password": "Test@1234",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    return data["access_token"]


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_and_login():
    email = "test@drakeai.com"
    register_user(email)
    token = login_user(email)
    assert token is not None


def test_create_project():
    email = "project_test@drakeai.com"
    register_user(email)
    token = login_user(email)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/api/projects/", json={
        "name": "Test Project",
        "field_name": "Permian",
        "operator": "Drake Energy",
    }, headers=headers)
    assert res.status_code == 201
    assert res.json()["name"] == "Test Project"


def test_create_well():
    email = "well_test@drakeai.com"
    register_user(email)
    token = login_user(email)
    headers = {"Authorization": f"Bearer {token}"}

    proj_res = client.post(
        "/api/projects/",
        json={"name": "Well Test Project", "field_name": "Permian", "operator": "Drake Energy"},
        headers=headers,
    )
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    res = client.post("/api/wells/", json={
        "project_id": project_id,
        "name": "TEST_01H",
        "api_number": "42-999-00001",
        "total_depth": 10000,
        "top_depth": 7000,
        "base_depth": 10000,
        "status": "Active",
    }, headers=headers)
    assert res.status_code == 201
    assert res.json()["name"] == "TEST_01H"
