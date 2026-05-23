test_code = r"""#!/usr/bin/env python3
import sys
from pathlib import Path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from fastapi.testclient import TestClient
from main import app
client = TestClient(app)
SAMPLE_DATA_DIR = project_root / "sample_data"

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

def t1_health():
    print_step(1, "健康检查")
    r = client.get("/")
    if r.status_code == 200:
        ok(f"健康检查通过: {r.json().get('message')}")
        return True
    fail(f"HTTP {r.status_code}")
    return False

def t2_import_claims():
    print_step(2, "导入申诉CSV")
    p = SAMPLE_DATA_DIR / "claims.csv"
    if not p.exists():
        fail("文件不存在")
        return False
    with open(p, "rb") as f:
        files = {"file": ("claims.csv", f, "text/csv")}
        r = client.post("/api/import/claims/csv", files=files)
    if r.status_code == 200:
        ok(f"导入成功: {r.json()}")
        return True
    fail(f"HTTP {r.status_code}: {r.text}")
    return False

def t3_import_flights():
    print_step(3, "导入航班JSON")
    p = SAMPLE_DATA_DIR / "flights.json"
    if not p.exists():
        fail("文件不存在")
        return False
    with open(p, "rb") as f:
        files = {"file": ("flights.json", f, "application/json")}
        r = client.post("/api/import/flights/json", files=files)
    if r.status_code == 200:
        ok(f"导入成功: {r.json()}")
        return True
    fail(f"HTTP {r.status_code}: {r.text}")
    return False

def t4_import_photos():
    print_step(4, "导入照片JSON")
    p = SAMPLE_DATA_DIR / "photos.json"
    if not p.exists():
        fail("文件不存在")
        return False
    with open(p, "rb") as f:
        files = {"file": ("photos.json", f, "application/json")}
        r = client.post("/api/import/photos", files=files)
    if r.status_code == 200:
        ok(f"导入成功: {r.json()}")
        return True
    fail(f"HTTP {r.status_code}: {r.text}")
    return False

def t5_query_claims():
    print_step(5, "查询申诉列表")
    r = client.get("/api/statistics/claims")
    if r.status_code == 200:
        d = r.json()
        ok(f"查询成功: {d.get('total_claims')}条, 总金额{d.get('total_claimed_amount')}元")
        return True
    fail(f"HTTP {r.status_code}")
    return False

def t6_compare_all():
    print_step(6, "自动比对所有申诉")
    r = client.post("/api/compare/all")
    if r.status_code == 200:
        d = r.json()
        ok(f"比对完成: 共{d.get('total')}条")
        return True
    fail(f"HTTP {r.status_code}")
    return False

def t7_get_explanation():
    print_step(7, "获取差异解释")
    cr = client.get("/api/statistics/claims")
    claims = cr.json().get("claims", [])
    if not claims:
        info("无申诉数据")
        return True
    cid = claims[0].get("claim_id")
    r = client.get(f"/api/report/{cid}")
    if r.status_code == 200:
        ok("获取解释成功")
        return True
    fail(f"HTTP {r.status_code}")
    return False

def t8_manual_review():
    print_step(8, "人工复核")
    cr = client.get("/api/statistics/claims")
    claims = cr.json().get("claims", [])
    if not claims:
        info("无申诉数据")
        return True
    cid = claims[0].get("claim_id")
    data = {"reviewer": "测试员", "status": "approved", "reviewed_amount": 450.0, "review_notes": "通过"}
    r = client.post(f"/api/review/{cid}", data=data)
    if r.status_code == 200:
        ok("复核成功")
        return True
    fail(f"HTTP {r.status_code}: {r.text}")
    return False

def t9_get_stats():
    print_step(9, "获取统计汇总")
    r = client.get("/api/statistics/summary")
    if r.status_code == 200:
        ok("获取统计成功")
        return True
    fail(f"HTTP {r.status_code}")
    return False

def t10_export_excel():
    print_step(10, "导出Excel报告")
    r = client.get("/api/export/excel")
    if r.status_code == 200:
        ct = r.headers.get("content-type", "")
        if "excel" in ct or "spreadsheet" in ct:
            ok(f"导出成功: {len(r.content)}字节")
            with open(project_root / "test_output.xlsx", "wb") as f:
                f.write(r.content)
            info("保存至 test_output.xlsx")
            return True
    fail(f"HTTP {r.status_code}")
    return False

def main():
    sep = "=" * 60
    print(f"\n{Colors.BOLD}{Colors.GREEN}{sep}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}  API 闭环测试{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}{sep}{Colors.ENDC}")
    
    tests = [
        ("健康检查", t1_health),
        ("导入申诉CSV", t2_import_claims),
        ("导入航班JSON", t3_import_flights),
        ("导入照片JSON", t4_import_photos),
        ("查询申诉列表", t5_query_claims),
        ("自动比对", t6_compare_all),
        ("差异解释", t7_get_explanation),
        ("人工复核", t8_manual_review),
        ("统计汇总", t9_get_stats),
        ("导出Excel", t10_export_excel),
    ]
    
    results = []
    for name, fn in tests:
        try:
            results.append((name, fn()))
        except Exception as e:
            fail(f"{name} 异常: {e}")
            results.append((name, False))
    
    print(f"\n{Colors.BOLD}{Colors.BLUE}{sep}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}  测试结果{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{sep}{Colors.ENDC}")
    
    passed = sum(1 for _, r in results if r)
    for name, r in results:
        s = f"{Colors.GREEN}通过{Colors.ENDC}" if r else f"{Colors.RED}失败{Colors.ENDC}"
        print(f"  {name:<15} - {s}")
    
    print(f"\n{Colors.BOLD}总计: {passed}/{len(tests)} 通过{Colors.ENDC}")
    return 0 if passed == len(tests) else 1

if __name__ == "__main__":
    sys.exit(main())
"""

with open('test_api_fix.py', 'w') as f:
    f.write(test_code)

print('test_api_fix.py created successfully!')
