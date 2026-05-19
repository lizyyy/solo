import httpx
import time
import subprocess
import sys
import os

BASE_URL = "http://localhost:8000"
TEST_IMAGE = "registry.example.com/myapp:v1.0.0"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

def print_test(name, success, message=""):
    color = Colors.GREEN if success else Colors.RED
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"{color}[{status}]{Colors.ENDC} {name}")
    if message:
        print(f"    {message}")

def wait_for_server():
    print(f"{Colors.BLUE}[INFO]{Colors.ENDC} 等待服务器启动...")
    for i in range(30):
        try:
            response = httpx.get(f"{BASE_URL}/docs")
            if response.status_code == 200:
                print(f"{Colors.GREEN}[INFO]{Colors.ENDC} 服务器已就绪")
                return True
        except:
            pass
        time.sleep(1)
    print(f"{Colors.RED}[ERROR]{Colors.ENDC} 服务器启动超时")
    return False

def test_import_image():
    """测试镜像导入功能"""
    test_cases = [
        {
            "name": "正常导入dev环境镜像",
            "data": {
                "image_tag": TEST_IMAGE,
                "environment": "dev",
                "scan_status": "not_scanned",
                "signature_status": "unsigned",
                "deployed": False
            },
            "should_pass": True
        },
        {
            "name": "重复导入同环境镜像（应该失败）",
            "data": {
                "image_tag": TEST_IMAGE,
                "environment": "dev"
            },
            "should_pass": False
        },
        {
            "name": "导入test环境镜像",
            "data": {
                "image_tag": TEST_IMAGE,
                "environment": "test",
                "scan_status": "passed",
                "scan_result": "无高危漏洞",
                "signature_status": "verified",
                "signature_key": "key-12345",
                "deployed": True,
                "deploy_env": "test"
            },
            "should_pass": True
        }
    ]
    
    results = []
    for case in test_cases:
        try:
            response = httpx.post(f"{BASE_URL}/api/v1/images/import", json=case["data"])
            success = response.status_code in [200, 201] if case["should_pass"] else response.status_code in [400, 409, 422]
            results.append((case["name"], success, response.json()))
        except Exception as e:
            results.append((case["name"], False, str(e)))
    
    return results

def test_list_and_filter_images():
    """测试镜像列表查询和筛选功能"""
    test_cases = [
        ("查询所有镜像", {}),
        ("按环境筛选dev", {"environment": "dev"}),
        ("按扫描状态筛选", {"scan_status": "not_scanned"}),
        ("按签名状态筛选", {"signature_status": "verified"}),
        ("按部署状态筛选", {"deployed": True})
    ]
    
    results = []
    for name, params in test_cases:
        try:
            response = httpx.get(f"{BASE_URL}/api/v1/images", params=params)
            success = response.status_code == 200 and response.json().get("success")
            data = response.json()
            results.append((name, success, f"返回 {data.get('count', 0)} 条记录"))
        except Exception as e:
            results.append((name, False, str(e)))
    
    return results

def test_update_image_status():
    """测试更新镜像状态（扫描、签名、部署）"""
    response = httpx.get(f"{BASE_URL}/api/v1/images", params={"environment": "dev"})
    image_id = response.json()["data"][0]["id"]
    
    test_cases = [
        ("更新扫描结果", f"/api/v1/images/{image_id}/scan", {"scan_status": "passed", "scan_result": "0个高危漏洞"}),
        ("更新签名状态", f"/api/v1/images/{image_id}/signature", {"signature_status": "verified", "signature_key": "prod-key-001"}),
        ("标记已部署", f"/api/v1/images/{image_id}/deploy", {"deploy_env": "dev"})
    ]
    
    results = []
    for name, endpoint, params in test_cases:
        try:
            response = httpx.put(f"{BASE_URL}{endpoint}", params=params)
            success = response.status_code == 200 and response.json().get("success")
            results.append((name, success, response.json().get("message", "")))
        except Exception as e:
            results.append((name, False, str(e)))
    
    return results

def test_promotion_check():
    """测试晋级检查功能"""
    test_cases = [
        {
            "name": "dev -> test 正常晋级（应该通过）",
            "data": {"image_tag": TEST_IMAGE, "from_stage": "dev", "to_stage": "test"},
            "expected_status": "approved"
        },
        {
            "name": "dev -> prod 跨级晋级（应该需要人工复核）",
            "data": {"image_tag": TEST_IMAGE, "from_stage": "dev", "to_stage": "prod"},
            "expected_status": "manual_review_required"
        }
    ]
    
    results = []
    for case in test_cases:
        try:
            response = httpx.post(f"{BASE_URL}/api/v1/promotion/check", json=case["data"])
            actual_status = response.json().get("status") if response.status_code == 200 else response.json().get("detail", {}).get("status")
            success = actual_status == case["expected_status"]
            message = f"返回状态: {actual_status}"
            results.append((case["name"], success, message))
        except Exception as e:
            results.append((case["name"], False, str(e)))
    
    return results

def test_manual_review():
    """测试人工复核功能"""
    response = httpx.get(f"{BASE_URL}/api/v1/reports")
    reports = response.json()["data"]
    if not reports:
        return [("人工复核测试", False, "没有找到报告")]
    
    pending_report = None
    for r in reports:
        if r["status"] == "manual_review_required":
            pending_report = r
            break
    
    if not pending_report:
        return [("人工复核测试", False, "没有找到需要复核的报告")]
    
    try:
        report_id = pending_report["id"]
        response = httpx.put(
            f"{BASE_URL}/api/v1/reports/{report_id}/review",
            params={"status": "approved", "reviewer": "test-admin"}
        )
        success = response.status_code == 200 and response.json().get("success")
        return [("人工复核测试", success, response.json().get("message", ""))]
    except Exception as e:
        return [("人工复核测试", False, str(e))]

def test_report_export():
    """测试报告导出功能"""
    response = httpx.get(f"{BASE_URL}/api/v1/reports")
    reports = response.json()["data"]
    if not reports:
        return [("报告导出测试", False, "没有找到报告")]
    
    report_id = reports[0]["id"]
    
    try:
        response = httpx.get(f"{BASE_URL}/api/v1/reports/{report_id}/export")
        success = response.status_code == 200 and response.json().get("success")
        data = response.json()
        message = f"导出报告: {data.get('report', {}).get('image_tag', '')}"
        return [("报告导出测试", success, message)]
    except Exception as e:
        return [("报告导出测试", False, str(e))]

def test_error_responses():
    """测试错误响应分类"""
    test_cases = [
        {
            "name": "查询不存在的镜像（NOT_FOUND）",
            "func": lambda: httpx.get(f"{BASE_URL}/api/v1/images/99999"),
            "expected_code": "not_found"
        },
        {
            "name": "重复处理晋级（ALREADY_PROCESSED）",
            "func": lambda: httpx.post(f"{BASE_URL}/api/v1/promotion/check", json={"image_tag": TEST_IMAGE, "from_stage": "dev", "to_stage": "test"}),
            "expected_code": "already_processed"
        }
    ]
    
    results = []
    for case in test_cases:
        try:
            response = case["func"]()
            detail = response.json().get("detail", {}) if response.status_code != 200 else response.json()
            actual_code = detail.get("code", "") if isinstance(detail, dict) else ""
            success = case["expected_code"] in (actual_code, "")
            results.append((case["name"], success, f"code={actual_code}"))
        except Exception as e:
            results.append((case["name"], False, str(e)))
    
    return results

def main():
    print(f"{Colors.BLUE}==================================={Colors.ENDC}")
    print(f"{Colors.BLUE}  镜像晋级门禁系统自检脚本        {Colors.ENDC}")
    print(f"{Colors.BLUE}==================================={Colors.ENDC}")
    
    if os.path.exists("image_promotion.db"):
        os.remove("image_promotion.db")
        print(f"{Colors.YELLOW}[INFO]{Colors.ENDC} 已清理旧数据库")
    
    print(f"\n{Colors.BLUE}[INFO]{Colors.ENDC} 启动服务器...")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    
    try:
        if not wait_for_server():
            server_proc.terminate()
            return 1
        
        all_tests = []
        
        print(f"\n{Colors.BLUE}[1/7]{Colors.ENDC} 测试镜像导入功能")
        results = test_import_image()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        print(f"\n{Colors.BLUE}[2/7]{Colors.ENDC} 测试列表查询和筛选功能")
        results = test_list_and_filter_images()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        print(f"\n{Colors.BLUE}[3/7]{Colors.ENDC} 测试镜像状态更新功能")
        results = test_update_image_status()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        print(f"\n{Colors.BLUE}[4/7]{Colors.ENDC} 测试晋级检查功能")
        results = test_promotion_check()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        print(f"\n{Colors.BLUE}[5/7]{Colors.ENDC} 测试错误响应分类")
        results = test_error_responses()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        print(f"\n{Colors.BLUE}[6/7]{Colors.ENDC} 测试报告导出功能")
        results = test_report_export()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        print(f"\n{Colors.BLUE}[7/7]{Colors.ENDC} 测试人工复核功能")
        results = test_manual_review()
        for name, success, msg in results:
            print_test(name, success, str(msg))
        all_tests.extend(results)
        
        passed = sum(1 for _, s, _ in all_tests if s)
        total = len(all_tests)
        
        print(f"\n{Colors.BLUE}==================================={Colors.ENDC}")
        print(f"测试结果: {Colors.GREEN}{passed}{Colors.ENDC}/{total} 通过")
        
        if passed == total:
            print(f"{Colors.GREEN}✓ 所有测试通过！系统运行正常{Colors.ENDC}")
            return 0
        else:
            print(f"{Colors.RED}✗ 部分测试失败，请检查代码{Colors.ENDC}")
            return 1
            
    finally:
        server_proc.terminate()
        server_proc.wait()
        print(f"\n{Colors.YELLOW}[INFO]{Colors.ENDC} 服务器已停止")

if __name__ == "__main__":
    sys.exit(main())
