import requests

headers = {
    "Origin": "http://localhost:4000",
    "Access-Control-Request-Method": "POST",
}
resp = requests.options("http://127.0.0.1:8002/api/auth/login", headers=headers)
print("Status:", resp.status_code)
print("Text:", resp.text)
