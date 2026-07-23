"""Basic API tests for Drake AI backend"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import Base, get_db
from app.api import support as support_api

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


def login_user(email: str, device_id: str | None = None):
    headers = {"X-Device-ID": device_id} if device_id else None
    response = client.post("/api/auth/login", json={
        "email": email,
        "password": "Test@1234",
    }, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    return data["access_token"]


def logout_user(token: str):
    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_register_and_login():
    email = "test@drakeai.com"
    register_user(email)
    token = login_user(email)
    assert token is not None


def test_single_active_user_session():
    email = "single_session@drakeai.com"
    register_user(email)
    login_user(email, "device-a")
    same_device_token = login_user(email, "device-a")

    blocked = client.post("/api/auth/login", json={
        "email": email,
        "password": "Test@1234",
    }, headers={"X-Device-ID": "device-b"})
    assert blocked.status_code == 409
    assert "logout from the previous device" in blocked.json()["detail"]

    logout_user(same_device_token)
    second_token = login_user(email, "device-b")
    assert second_token is not None


def test_support_access_request_and_feedback(monkeypatch):
    email = "support_test@drakeai.com"
    register_user(email)
    token = login_user(email, "support-test-device")
    sent_messages = []

    def capture_mail(**kwargs):
        sent_messages.append(kwargs)

    monkeypatch.setattr(support_api, "send_support_mail", capture_mail)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Device-ID": "support-test-device",
    }
    access_response = client.post("/api/support/access-request", headers=headers, json={
        "module_id": "seismic-frequency-enhancer",
        "module_label": "Seismic Frequency Enhancer",
        "page_path": "/seismic/frequency-enhancer",
    })
    assert access_response.status_code == 200

    feedback_response = client.post("/api/support/feedback", headers=headers, json={
        "page_path": "/seismic/frequency-enhancer",
        "modules": [
            {
                "module_id": "seismic-frequency-enhancer",
                "module_label": "Seismic Frequency Enhancer",
                "rating": 5,
                "message": "Production feedback test",
            },
            {
                "module_id": "well-log-digitizer",
                "module_label": "Well Log Digitizer",
                "rating": 4,
                "message": "Second module feedback test",
            },
        ],
    })
    assert feedback_response.status_code == 200
    assert len(sent_messages) == 2
    assert "module access request" in sent_messages[0]["subject"]
    assert "feedback" in sent_messages[1]["subject"]
    assert "Feedback Submission" in sent_messages[1]["html_body"]
    assert len(sent_messages[1]["attachments"]) == 1
    flyer_name, flyer_type, flyer_content = sent_messages[1]["attachments"][0]
    assert flyer_name.endswith(".png")
    assert flyer_type == "image/png"
    assert flyer_content.startswith(b"\x89PNG\r\n\x1a\n")
    assert sent_messages[1]["inline_images"][0][3] == "drake-logo@thedrake.ai"


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
