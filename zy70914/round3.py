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
print("  photos.json:", r.json().get("imported"), "条")

r = c.get("/api/statistics/claims")
print("  数据持久化:", r.json().get("total_claims"), "条")
passed += 1
print("  PASS")
print()

print("[2/7] 自动比对")
print("-" * 50)
r = c.post("/api/compare/all")
data = r.json()
results = data.get("results", [])
print("  比对完成:", data.get("total"), "条")

all_ok = True
for res in results:
    if "auto_status" not in res or "suggested_amount" not in res:
        all_ok = False
print("  有auto_status和suggested_amount:", all_ok)

claim001 = [x for x in results if x["claim_id"] == "CLAIM001"][0]
has_flight = claim001["matched_flight"] is not None
has_disc = len(claim001["discrepancies"]) > 0
print("  CLAIM001有航班匹配:", has_flight)
print("  CLAIM001有差异检测:", has_disc)

claim002 = [x for x in results if x["claim_id"] == "CLAIM002"][0]
has_overtime = any(d["type"] == "overtime_declaration" for d in claim002["discrepancies"])
print("  CLAIM002有超时检测:", has_overtime)

if all_ok and has_flight and has_disc and has_overtime:
    passed += 1
    print("  PASS")
else:
    print("  FAIL")
print()

print("[3/7] 差异解释")
print("-" * 50)
r = c.get("/api/report/CLAIM001")
report = r.json()
comp = report.get("comparison_result", {})
has_status = comp.get("auto_status") is not None
has_claimed = comp.get("claimed_amount") is not None
has_suggested = comp.get("suggested_amount") is not None
has_disc2 = len(comp.get("discrepancies", [])) > 0
has_flight2 = comp.get("matched_flight") is not None
print("  有预审结果:", has_status)
print("  有申报金额:", has_claimed)
print("  有建议金额:", has_suggested)
print("  有差异说明:", has_disc2)
print("  有航班信息:", has_flight2)

if all([has_status, has_claimed, has_suggested, has_disc2, has_flight2]):
    passed += 1
    print("  PASS")
else:
    print("  FAIL")
print()

