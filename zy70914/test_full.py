import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app

c = TestClient(app)

print("=" * 70)
print("完整业务链路测试 - 第二轮修复验证")
print("=" * 70)
print()

passed = 0
total = 7

print("[1/7] 数据导入")
print("-" * 50)

f = open("sample_data/claims.csv", "rb")
r = c.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
f.close()
print("  claims.csv:", r.json().get("imported"), "条")

f = open("sample_data/flights.json", "rb")
r = c.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
f.close()
print("  flights.json:", r.json().get("imported"), "条")

f = open("sample_data/photos.json", "rb")
r = c.post("/api/import/photos", files={"file": ("photos.json", f, "application/json")})
f.close()
print("  photos.json:", r.json(print("  photos.json:", r.json(print("  pi/print("  photos.json:", r.json(print("  ??rint("  photos.jt("print("  photos.json:", rssed += 1
print("  PASS")
print()
