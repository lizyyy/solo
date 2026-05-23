import sys
from pathlib import Path
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from main import app
client = TestClient(app)
SAMPLE_DATA_DIR = Path(".") / "sample_data"

class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"

def print_step(n, t):
    sep = "=" * 60
    print(f"\n{Colors.BOLD}{Colors.BLUE}{sep}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE} 步骤 {n}: {t}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{sep}{Colors.ENDC}")

def ok(m): print(f"{Colors.GREEN}OK - {m}{Colors.ENDC}")
def fail(m): print(f"{Colors.RED}FAIL - {m}{Colors.ENDC}")
def info(m): print(f"{Colors.YELLOW}  {m}{Colors.ENDC}")

results = []

print_step(1, "健康检查")
r = client.get("/")
if r.status_code == 200:
    ok(f"健康检查通过: {r.json().get('message')}")
    results.append(("健康检查", True))
else:
    fail(f"HTTP {r.status_code}")
    results.append(("健康检查", False))

print_step(2, "导入申诉CSV")
p = SAMPLE_DATA_DIR / "claims.csv"
if p.exists():
    with open(p, "rb") as f:
        files = {"file": ("claims.csv", f, "text/csv")}
        r = client.post("/api/import/claims/csv", files=files)
    if r.status_code == 200:
        ok(f"导入成功: {r.json()}")
        results.append(("导入申诉CSV", True))
    else:
        fail(f"HTTP {r.status_code}: {r.text}")
        results.append(("导入申诉CSV", False))
else:
    fail("文件不存在")
    results.append(("导入申诉CSV", False))

print_step(3, "导入航班JSON")
p = SAMPLE_DATA_DIR / "flights.json"
if p.exists():
    with open(p, "rb") as f:
        files = {"file": ("flights.json", f, "application/json")}
        r = client.post("/api/import/flights/json", files=files)
    if r.status_code == 200:
        ok(f"导入成功: {r.json()}")
        results.append(("导入航班JSON", True))
    else:
        fail(f"HTTP {r.status_code}: {r.text}")
        results.append(("导入航班JSON", False))
else:
    fail("文件不存在")
    results.append(("导入航班JSON", False))

print_step(4, "导入照片JSON")
p = SAMPLE_DATA_DIR / "photos.json"
if p.exists():
    with open(p, "rb") as f:
        files = {"file": ("photos.json", f, "application/json")}
        r = client.post("/api/import/photos", files=files)
    if r.status_code == 200:
        ok(f"导入成功: {r.json()}")
        results.append(("导入照片JSON", True))
    else:
        fail(f"HTTP {r.status_code}: {r.text}")
        results.append(("导入照片JSON", False))
else:
    fail("文件不存在")
    results.append(("导入照片JSON", False))

print_step(5, "查询申诉列表")
r = client.get("/api/statistics/claims")
if r.status_code == 200:
    d = r.json()
    ok(f"查询成功: {d.get('total_claims')}条, 总金额{d.get('total_claimed_amount')}元")
    results.append(("查询申诉列表", True))
else:
    fail(f"HTTP {r.status_code}")
    results.append(("查询申诉列表", False))

print_step(6, "自动比对所有申诉")
r = client.post("/api/compare/all")
if r.status_code == 200:
    d = r.json()
    ok(f"比对完成: 共{d.get('total')}条")
    results.append(("自动比对", True))
else:
    fail(f"HTTP {r.status_code}")
    results.append(("自动比对", False))

print_step(7, "获取差异解释")
cr = client.get("/api/statistics/claims")
claims = cr.json().get("claims", [])
if claims:
    cid = claims[0].get("claim_id")
    r = client.get(f"/api/report/{cid}")
    if r.status_code == 200:
        ok("获取解释成功")
        results.append(("差异解释", True))
    else:
        fail(f"HTTP {r.status_code}")
        results.append(("差异解释", False))
else:
    info("无申诉数据")
    results.append(("差异解释", True))

print_step(8, "人工复核")
cr = client.get("/api/statistics/claims")
claims = cr.json().get("claims", [])
if claims:
    cid = claims[0].get("claim_id")
    data = {"reviewer": "测试员", "status": "approved", "reviewed_amount": 450.0, "review_notes": "通过"}
    r = client.post(f"/api/review/{cid}", data=data)
    if r.status_code == 200:
        ok("复核成功")
        results.append(("人工复核", True))
    else:
        fail(f"HTTP {r.status_code}: {r.text}")
        results.append(("人工复核", False))
else:
    info("无申诉数据")
    results.append(("人工复核", True))

print_step(9, "获取统计汇总")
r = client.get("/api/statistics/summary")
if r.status_code == 200:
    ok("获取统计成功")
    results.append(("统计汇总", True))
else:
    fail(f"HTTP {r.status_code}")
    results.append(("统计汇总", False))

print_step(10, "导出Excel报告")
r = client.get("/api/export/excel")
if r.status_code == 200:
    ct = r.headers.get("content-type", "")
    if "excel" in ct or "spreadsheet" in ct:
        ok(f"导出成功: {len(r.content)}字节")
        with open("test_output.xlsx", "wb") as f:
            f.write(r.content)
        info("保存至 test_output.xlsx")
        results.append(("导出Excel", True))
    else:
        fail(f"非Excel格式: {ct}")
        results.append(("导出Excel", False))
else:
    fail(f"HTTP {r.status_code}")
    results.append(("导出Excel", False))

sep = "=" * 60
print(f"\n{Colors.BOLD}{Colors.BLUE}{sep}{Colors.ENDC}")
print(f"{Colors.BOLD}{Colors.BLUE}  测试结果{Colors.ENDC}")
print(f"{Colors.BOLD}{Colors.BLUE}{sep}{Colors.ENDC}")

passed = sum(1 for _, r in results if r)
for name, r in results:
    s = f"{Colors.GREEN}通过{Colors.ENDC}" if r else f"{Colors.RED}失败{Colors.ENDC}"
    print(f"  {name:<15} - {s}")

print(f"\n{Colors.BOLD}总计: {passed}/{len(results)} 通过{Colors.ENDC}")

if passed == len(results):
    print(f"\n{Colors.GREEN}{Colors.BOLD}所有测试通过！{Colors.ENDC}")
    sys.exit(0)
else:
    print(f"\n{Colors.RED}{Colors.BOLD}有 {len(results) - passed} 项失败{Colors.ENDC}")
    sys.exit(1)
