import sys
sys.path.insert(0, ".")
from main import app, global_store
from fastapi.testclient import TestClient

print("Initial global_store claims:", len(global_store.claims))

c = TestClient(app)

f = open("sample_data/claims.csv", "rb")
r = c.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
f.close()

print("After import API call, global_store claims:", len(global_store.claims))
print("Import result:", r.json())

