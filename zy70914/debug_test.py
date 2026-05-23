import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app
c = TestClient(app)
f = open("sample_data/claims.csv", "rb")
r = c.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
f.close()
print("Import result:", r.json())

