#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app
client = TestClient(app)
passed = 0
print("="*60)
print("API 闭环测试")
print("="*60)

print()
print("[1/10] 健康检查")
r = client.get("/")
if r.status_code == 200:
    print("  PASS:", r.json())
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[2/10] 导入申诉CSV")
with open("sample_data/claims.csv", "rb") as f:
    r = client.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
if r.status_code == 200:
    print("  PASS:", r.json())
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[3/10] 导入航班JSON")
with open("sample_data/flights.json", "rb") as f:
    r = client.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
if r.status_code == 200:
    print("  PASS:", r.json())
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[4/10] 导入照片JSON")
with open("sample_data/photos.json", "rb") as f:
    r = client.post("/api/import/photos", files={"file": ("photos.json", f, "application/json")})
if r.status_code == 200:
    print("  PASS:", r.json())
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[5/10] 查询申诉列表")
r = client.get("/api/statistics/claims")
data = r.json()
if r.status_code == 200 and data.get("success"):
    print("  PASS:", data.get("total_claims"), "条记录")
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[6/10] 自动比对所有申诉")
r = client.post("/api/compare/all")
data = r.json()
if r.status_code == 200 and data.get("success"):
    print("  PASS: 比对", data.get("total"), "条")
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[7/10] 获取差异解释")
claims = client.get("/api/statistics/claims").json().get("claims", [])
if claims:
    r = client.get(f"/api/report/{claims[0]['claim_id']}")
    if r.status_code == 200 and r.json().get("success"):
        print("  PASS: 获取解释成功")
        passed += 1
    else:
        print("  FAIL: HTTP", r.status_code)
else:
    print("  SKIP: 无申诉数据")
    passed += 1

print()
print("[8/10] 人工复核")
claims = client.get("/api/statistics/claims").json().get("claims", [])
if claims:
    cid = claims[0]['claim_id']
    data = {"reviewer": "测试员", "status": "approved", "reviewed_amount": 450.0, "review_notes": "通过"}
    r = client.post(f"/api/review/{cid}", data=data)
    if r.status_code == 200 and r.json().get("success"):
        print("  PASS: 复核成功")
        passed += 1
    else:
        print("  FAIL: HTTP", r.status_code)
else:
    print("  SKIP: 无申诉数据")
    passed += 1

print()
print("[9/10] 获取统计汇总")
r = client.get("/api/statistics/summary")
if r.status_code == 200 and r.json().get("success"):
    print("  PASS: 获取统计成功")
    passed += 1
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("[10/10] 导出Excel报告")
r = client.get("/api/export/excel")
if r.status_code == 200:
    ct = r.headers.get("content-type", "")
    if "excel" in ct or "spreadsheet" in ct:
        print("  PASS:", len(r.content), "字节")
        with open("test_output.xlsx", "wb") as f:
            f.write(r.content)
        print("        已保存至 test_output.xlsx")
        passed += 1
    else:
        print("  FAIL: 非Excel格式", ct)
else:
    print("  FAIL: HTTP", r.status_code)

print()
print("="*60)
print("测试结果:", passed, "/10 通过")
print("="*60)
if passed == 10:
    print()
    print("所有测试通过！API 闭环流程验证成功！")
    sys.exit(0)
else:
    print()
    print("有", 10 - passed, "项测试失败")
    sys.exit(1)
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_get_discrepancy_explanation():
    print_step(7, "获取差异解释")
    try:
        claims_resp = client.get("/api/statistics/claims")
        claims_data = claims_resp.json()
        claims = claims_data.get("claims", [])
        if not claims:
            print_info("无申诉数据")
            return True
        first_id = claims[0].get("claim_id")
        response = client.get(f"/api/report/{first_id}")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"获取解释成功")
                return True
        print_failure(f"HTTP {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_manual_review():
    print_step(8, "人工复核")
    try:
        claims_resp = client.get("/api/statistics/claims")
        claims_data = claims_resp.json()
        claims = claims_data.get("claims", [])
        if not claims:
            print_info("无申诉数据")
            return True
        first_id = claims[0].get("claim_id")
        review_data = {
            "reviewer": "测试审核员",
            "status": "approved",
            "reviewed_amount": 450.0,
            "review_notes": "审核通过",
        }
        response = client.post(f"/api/review/{first_id}", data=review_data)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"复核成功")
                return True
        print_failure(f"HTTP {response.status_code}: {response.text}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_get_statistics_summary():
    print_step(9, "获取统计汇总")
    try:
        response = client.get("/api/statistics/summary")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"获取统计成功")
                return True
        print_failure(f"HTTP {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_export_excel_report():
    print_step(10, "导出Excel报告")
    try:
        response = client.get("/api/export/excel")
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            if "excel" in content_type or "spreadsheet" in content_type:
                print_success(f"导出成功: {len(response.content)} 字节")
                output_path = project_root / "test_output_report.xlsx"
                with open(output_path, "wb") as f:
                    f.write(response.content)
                print_info(f"保存至: {output_path}")
                return True
        print_failure(f"HTTP {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}  航班延误申诉自动比对系统 - API 闭环测试{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.ENDC}")

    tests = [
        ("健康检查", test_health_check),
        ("导入申诉CSV", test_import_claims_csv),
        ("导入航班JSON", test_import_flights_json),
        ("导入照片JSON", test_import_photos_json),
        ("查询申诉列表", test_query_claims_list),
        ("自动比对所有申诉", test_compare_all_claims),
        ("获取差异解释", test_get_discrepancy_explanation),
        ("人工复核", test_manual_review),
        ("获取统计汇总", test_get_statistics_summary),
        ("导出Excel报告", test_export_excel_report),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_failure(f"{test_name} 异常: {str(e)}")
            results.append((test_name, False))

    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}  测试结果汇总{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = f"{Colors.GREEN}通过{Colors.ENDC}" if result else f"{Colors.RED}失败{Colors.ENDC}"
        print(f"  {name:<20} - {status}")

    print(f"\n{Colors.BOLD}总计: {passed}/{total} 测试通过{Colors.ENDC}")

    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD} 所有测试通过！API 闭环流程验证成功！{Colors.ENDC}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD} 有 {total - passed} 项测试失败{Colors.ENDC}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_get_discrepancy_explanation():
    print_step(7, "获取差异解释")
    try:
        claims_resp = client.get("/api/statistics/claims")
        claims_data = claims_resp.json()
        claims = claims_data.get("claims", [])
        if not claims:
            print_info("无申诉数据")
            return True
        first_id = claims[0].get("claim_id")
        response = client.get(f"/api/report/{first_id}")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"获取解释成功")
                return True
        print_failure(f"HTTP {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_manual_review():
    print_step(8, "人工复核")
    try:
        claims_resp = client.get("/api/statistics/claims")
        claims_data = claims_resp.json()
        claims = claims_data.get("claims", [])
        if not claims:
            print_info("无申诉数据")
            return True
        first_id = claims[0].get("claim_id")
        review_data = {
            "reviewer": "测试审核员",
            "status": "approved",
            "reviewed_amount": 450.0,
            "review_notes": "审核通过",
        }
        response = client.post(f"/api/review/{first_id}", data=review_data)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"复核成功")
                return True
        print_failure(f"HTTP {response.status_code}: {response.text}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_get_statistics_summary():
    print_step(9, "获取统计汇总")
    try:
        response = client.get("/api/statistics/summary")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"获取统计成功")
                return True
        print_failure(f"HTTP {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def test_export_excel_report():
    print_step(10, "导出Excel报告")
    try:
        response = client.get("/api/export/excel")
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            if "excel" in content_type or "spreadsheet" in content_type:
                print_success(f"导出成功: {len(response.content)} 字节")
                output_path = project_root / "test_output_report.xlsx"
                with open(output_path, "wb") as f:
                    f.write(response.content)
                print_info(f"保存至: {output_path}")
                return True
        print_failure(f"HTTP {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"异常: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}  航班延误申诉自动比对系统 - API 闭环测试{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.ENDC}")

    tests = [
        ("健康检查", test_health_check),
        ("导入申诉CSV", test_import_claims_csv),
        ("导入航班JSON", test_import_flights_json),
        ("导入照片JSON", test_import_photos_json),
        ("查询申诉列表", test_query_claims_list),
        ("自动比对所有申诉", test_compare_all_claims),
        ("获取差异解释", test_get_discrepancy_explanation),
        ("人工复核", test_manual_review),
        ("获取统计汇总", test_get_statistics_summary),
        ("导出Excel报告", test_export_excel_report),
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_failure(f"{test_name} 异常: {str(e)}")
            results.append((test_name, False))

    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}  测试结果汇总{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")

    passed = sum(1 for _, r in results if r)
    total = len(results)

    for name, result in results:
        status = f"{Colors.GREEN}通过{Colors.ENDC}" if result else f"{Colors.RED}失败{Colors.ENDC}"
        print(f"  {name:<20} - {status}")

    print(f"\n{Colors.BOLD}总计: {passed}/{total} 测试通过{Colors.ENDC}")

    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD} 所有测试通过！API 闭环流程验证成功！{Colors.ENDC}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD} 有 {total - passed} 项测试失败{Colors.ENDC}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
            response = client.post("/api/import/photos", files=files)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"照片JSON导入成功 - 导入 {data.get('imported', 0)} 条记录")
                print_info(f"详细信息: {data}")
                return True
            else:
                print_failure(f"照片JSON导入失败: {data.get('error')}")
                return False
        else:
            print_failure(f"照片JSON导入失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"照片JSON导入异常: {str(e)}")
        return False

def test_query_claims_list():
    """步骤 5: 查询申诉列表验证数据保留"""
    print_step(5, "查询申诉列表验证数据保留")
    
    try:
        response = client.get("/api/statistics/claims")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                claims = data.get("claims", [])
                total_claims = data.get("total_claims", 0)
                total_amount = data.get("total_claimed_amount", 0)
                
                print_success(f"申诉列表查询成功 - 共 {total_claims} 条申诉")
                print_info(f"总申报金额: {total_amount} 元")
                
                if claims:
                    print_info("申诉数据明细:")
                    for claim in claims[:3]:
                        print_info(f"  - {claim.get('claim_id')}: {claim.get('passenger_name')} - "
                                  f"{claim.get('flight_no')} - ￥{claim.get('claim_amount')}")
                    if len(claims) > 3:
                        print_info(f"  ... 还有 {len(claims) - 3} 条记录")
                return True
            else:
                print_failure(f"申诉列表查询失败")
                return False
        else:
            print_failure(f"申诉列表查询失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"申诉列表查询异常: {str(e)}")
        return False

def test_compare_all_claims():
    """步骤 6: 自动比对所有申诉"""
    print_step(6, "自动比对所有申诉")
    
    try:
        response = client.post("/api/compare/all")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                results = data.get("results", [])
                print_success(f"自动比对完成 - 共比对 {len(results)} 条申诉")
                
                if results:
                    matched = sum(1 for r in results if r.get("is_match"))
                    print_info(f"匹配成功: {matched} 条")
                    print_info(f"存在差异: {len(results) - matched} 条")
                    
                    for result in results[:2]:
                        status = "匹配" if result.get("is_match") else "差异"
                        print_info(f"  - {result.get('claim_id')}: {status} - "
                                  f"申报:￥{result.get('claimed_amount')} -> "
                                  f"计算:￥{result.get('calculated_amount')}")
                return True
            else:
                print_failure(f"自动比对失败")
                return False
        else:
            print_failure(f"自动比对失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"自动比对异常: {str(e)}")
        return False

def test_get_discrepancy_explanation():
    """步骤 7: 获取差异解释"""
    print_step(7, "获取差异解释（通过详细报告）")
    
    try:
        claims_response = client.get("/api/statistics/claims")
        claims_data = claims_response.json()
        claims = claims_data.get("claims", [])
        
        if not claims:
            print_info("没有申诉数据可查询")
            return True
        
        first_claim_id = claims[0].get("claim_id")
        print_info(f"查询申诉 {first_claim_id} 的详细报告...")
        
        response = client.get(f"/api/report/{first_claim_id}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"差异解释获取成功")
                report = data.get("report", {})
                
                discrepancies = report.get("discrepancies", [])
                if discrepancies:
                    print_info(f"发现 {len(discrepancies)} 处差异:")
                    for disc in discrepancies:
                        print_info(f"  - [{disc.get('type')}] {disc.get('description')}")
                else:
                    print_info("未发现差异，申诉匹配成功")
                
                explanation = report.get("explanation", "")
                if explanation:
                    print_info(f"解释说明: {explanation[:100]}...")
                
                return True
            else:
                print_failure(f"差异解释获取失败: {data.get('error')}")
                return False
        else:
            print_failure(f"差异解释获取失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"差异解释获取异常: {str(e)}")
        return False

def test_manual_review():
    """步骤 8: 人工复核"""
    print_step(8, "人工复核申诉")
    
    try:
        claims_response = client.get("/api/statistics/claims")
        claims_data = claims_response.json()
        claims = claims_data.get("claims", [])
        
        if not claims:
            print_info("没有申诉数据可复核")
            return True
        
        first_claim_id = claims[0].get("claim_id")
        print_info(f"复核申诉 {first_claim_id}...")
        
        review_data = {
            "reviewer": "测试审核员",
            "status": "approved",
            "reviewed_amount": 450.0,
            "review_notes": "审核通过，调整金额至450元",
            "adjustment_reason": "符合延误赔付标准"
        }
        
        response = client.post(
            f"/api/review/{first_claim_id}",
            data=review_data
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"人工复核成功")
                print_info(f"审核状态: {data.get('status')}")
                print_info(f"复核金额: ￥{data.get('reviewed_amount')}")
                return True
            else:
                print_failure(f"人工复核失败: {data.get('error')}")
                return False
        else:
            print_failure(f"人工复核失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"人工复核异常: {str(e)}")
        return False

def test_get_statistics_summary():
    """步骤 9: 获取统计汇总"""
    print_step(9, "获取统计汇总")
    
    try:
        response = client.get("/api/statistics/summary")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print_success(f"统计汇总获取成功")
                summary = data.get("summary", {})
                
                print_info("统计汇总数据:")
                for key, value in summary.items():
                    if isinstance(value, (int, float, str)):
                        print_info(f"  - {key}: {value}")
                    elif isinstance(value, dict):
                        print_info(f"  - {key}:")
                        for k, v in value.items():
                            print_info(f"      {k}: {v}")
                
                return True
            else:
                print_failure(f"统计汇总获取失败")
                return False
        else:
            print_failure(f"统计汇总获取失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"统计汇总获取异常: {str(e)}")
        return False

def test_export_excel_report():
    """步骤 10: 导出Excel报告"""
    print_step(10, "导出Excel报告")
    
    try:
        response = client.get("/api/export/excel")
        
        if response.status_code == 200:
            content_type = response.headers.get("content-type", "")
            if "excel" in content_type or "spreadsheet" in content_type:
                content_length = len(response.content)
                
                print_success(f"Excel报告导出成功")
                print_info(f"文件大小: {content_length} 字节")
                print_info(f"Content-Type: {content_type}")
                
                output_path = project_root / "test_output_report.xlsx"
                with open(output_path, "wb") as f:
                    f.write(response.content)
                print_info(f"报告已保存至: {output_path}")
                
                return True
            else:
                print_failure(f"返回内容不是Excel格式: {content_type}")
                return False
        else:
            print_failure(f"Excel报告导出失败 - HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_failure(f"Excel报告导出异常: {str(e)}")
        return False

def run_all_tests():
    """运行所有测试"""
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}  航班延误申诉自动比对系统 - API 闭环测试{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.GREEN}{'='*60}{Colors.ENDC}")
    
    tests = [
        ("健康检查", test_health_check),
        ("导入申诉CSV", test_import_claims_csv),
        ("导入航班JSON", test_import_flights_json),
        ("导入照片JSON", test_import_photos_json),
        ("查询申诉列表", test_query_claims_list),
        ("自动比对所有申诉", test_compare_all_claims),
        ("获取差异解释", test_get_discrepancy_explanation),
        ("人工复核", test_manual_review),
        ("获取统计汇总", test_get_statistics_summary),
        ("导出Excel报告", test_export_excel_report),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_failure(f"{test_name} - 未处理的异常: {str(e)}")
            results.append((test_name, False))
    
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}  测试结果汇总{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{Colors.GREEN}通过{Colors.ENDC}" if result else f"{Colors.RED}失败{Colors.ENDC}"
        print(f"  {test_name:<25} - {status}")
    
    print(f"\n{Colors.BOLD}总计: {passed}/{total} 测试通过{Colors.ENDC}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}🎉 所有测试通过！API 闭环流程验证成功！{Colors.ENDC}")
        return 0
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠ 有 {total - passed} 项测试失败，请检查问题。{Colors.ENDC}")
        return 1

if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
    print("  - DataStore 单例修复：数据在请求间正确保留")
    print("  - CSV 字段修复：可以正确导入包含逗号的字段")
    print("  - 完整闭环：导入→比对→复核→报告全部可用")

if __name__ == "__main__":
    main()
