from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
res = client.post(
    '/api/auth/register',
    json={
        'email': 'test@drakeai.com',
        'full_name': 'Test User',
        'password': 'Test@1234',
        'role': 'petrophysicist',
    },
)
print('status', res.status_code)
try:
    print(res.json())
except Exception:
    print(res.text)
