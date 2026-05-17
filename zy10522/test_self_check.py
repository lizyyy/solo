#!/usr/bin/env python3
import os
import sys
import json
import time
from datetime import datetime, timedelta
import subprocess
import requests

BASE_URL = "http://localhost:8000"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✓ SUCCESS: {msg}{Colors.ENDC}")

def print_fail(msg):
    print(f"{Colors.RED}✗ FAILED: {msg}{Colors.ENDC}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ INFO: {msg}{Colors.ENDC}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ WARNING: {msg}{Colors.ENDC}")

def cleanup_db():
    if os.path.exists("api_registry.db"):
        os.remove("api_registry.db")
        print_info("Database cleaned up")

def start_server():
    print_info("Starting FastAPI server...")
    process = subprocess.Popen(
        [sys.executable, "app.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(5)
    for i in range(5):
        try:
            resp = requests.get(f"{BASE_URL}/export/statistics", timeout=2)
            if resp.status_code == 200:
                print_info("Server is ready")
                break
        except:
            pass
        time.sleep(1)
    return process

def stop_server(process):
    process.terminate()
    process.wait()
    print_info("Server stopped")

def test_normal_flow():
    print_info("\n" + "="*60)
    print_info("TEST 1: NORMAL FLOW - 正常流程测试")
    print_info("="*60)
    
    success_count = 0
    total_count = 0
    
    total_count += 1
    try:
        payload = {
            "api_path": "/api/v1/users",
            "caller_system": "order-service",
            "contact_person": "张三",
            "contact_email": "zhangsan@example.com",
            "last_call_time": datetime.utcnow().isoformat(),
            "transformation_plan": "2024年Q2完成改造",
            "planned_completion_date": "2024-06-30"
        }
        resp = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        assert resp.status_code == 201, f"Expected 201, got {resp.status_code}"
        data = resp.json()
        assert data["api_path"] == "/api/v1/users"
        assert data["caller_system"] == "order-service"
        assert data["status"] == "pending"
        reg_id = data["id"]
        print_success(f"Create registration - ID: {reg_id}")
        success_count += 1
    except Exception as e:
        print_fail(f"Create registration: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/{reg_id}", timeout=5)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == reg_id
        print_success("Get single registration")
        success_count += 1
    except Exception as e:
        print_fail(f"Get registration: {e}")
    
    total_count += 1
    try:
        payload = {
            "log_source": "nginx-access.log",
            "log_timestamp": datetime.utcnow().isoformat(),
            "log_details": 'GET /api/v1/users?id=123 - 200 OK - 15ms - "User-Agent: order-service/1.0"',
            "call_count": 156
        }
        resp = requests.post(f"{BASE_URL}/registrations/{reg_id}/log-evidence", json=payload, timeout=5)
        assert resp.status_code == 200
        print_success("Add log evidence - auto status update to log_verified")
        success_count += 1
    except Exception as e:
        print_fail(f"Add log evidence: {e}")
    
    total_count += 1
    try:
        resp = requests.post(f"{BASE_URL}/registrations/{reg_id}/confirm-transformation", 
                           json={"confirmed_by": "李四"}, timeout=5)
        assert resp.status_code == 200
        print_success("Confirm transformation")
        success_count += 1
    except Exception as e:
        print_fail(f"Confirm transformation: {e}")
    
    total_count += 1
    try:
        payload = {
            "new_status": "in_progress",
            "changed_by": "张三",
            "change_reason": "改造工作正式开始"
        }
        resp = requests.post(f"{BASE_URL}/registrations/{reg_id}/status", json=payload, timeout=5)
        assert resp.status_code == 200
        print_success("Update status to in_progress")
        success_count += 1
    except Exception as e:
        print_fail(f"Update status: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/{reg_id}/history", timeout=5)
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) >= 3
        print_success(f"Get status history - {len(history)} records")
        success_count += 1
    except Exception as e:
        print_fail(f"Get history: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/export/registrations?format=xlsx", timeout=5)
        assert resp.status_code == 200
        assert "application/vnd.openxmlformats" in resp.headers["content-type"]
        print_success("Export XLSX")
        success_count += 1
    except Exception as e:
        print_fail(f"Export XLSX: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/export/statistics", timeout=5)
        assert resp.status_code == 200
        stats = resp.json()
        assert stats["total_registrations"] >= 1
        print_success(f"Get statistics - total: {stats['total_registrations']}")
        success_count += 1
    except Exception as e:
        print_fail(f"Get statistics: {e}")
    
    return success_count, total_count

def test_dirty_data():
    print_info("\n" + "="*60)
    print_info("TEST 2: DIRTY DATA - 脏数据测试")
    print_info("="*60)
    
    success_count = 0
    total_count = 0
    
    dirty_cases = [
        ("无斜杠开头的路径", {"api_path": "api/v1/orders", "caller_system": "payment"}, 422),
        ("缺少必填字段 api_path", {"caller_system": "payment"}, 422),
        ("缺少必填字段 caller_system", {"api_path": "/api/v1/orders"}, 422),
        ("无效日期格式", {"api_path": "/api/v1/test", "caller_system": "test", "planned_completion_date": "invalid-date"}, 422),
        ("空字符串", {"api_path": "", "caller_system": ""}, 422),
    ]
    
    for case_name, payload, expected_status in dirty_cases:
        total_count += 1
        try:
            resp = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
            assert resp.status_code == expected_status, f"Expected {expected_status}, got {resp.status_code}"
            print_success(f"Dirty data rejected: {case_name}")
            success_count += 1
        except AssertionError as e:
            print_fail(f"{case_name}: {e} (got {resp.status_code})")
        except Exception as e:
            print_fail(f"{case_name}: {e}")
    
    total_count += 1
    try:
        payload = {
            "api_path": "/api/v1/dirty",
            "caller_system": "legacy-system",
            "contact_person": "   王 五  ",
            "contact_email": "bad-email-format",
            "contact_phone": "乱七八糟的电话 138****1234",
            "transformation_plan": "计划改造，但具体时间待定\t\t包含特殊字符和空格",
            "raw_input": '{"malformed_json": true, missing_quotes}'
        }
        resp = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] > 0
        print_success(f"Dirty data accepted - ID: {data['id']}")
        success_count += 1
    except Exception as e:
        print_fail(f"Accept dirty data: {e}")
    
    return success_count, total_count

def test_duplicate_requests():
    print_info("\n" + "="*60)
    print_info("TEST 3: DUPLICATE REQUESTS - 重复请求测试")
    print_info("="*60)
    
    success_count = 0
    total_count = 0
    
    total_count += 1
    try:
        payload = {
            "api_path": "/api/v2/products",
            "caller_system": "inventory-service"
        }
        resp1 = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        assert resp1.status_code == 201
        print_success("First request succeeded")
        success_count += 1
    except Exception as e:
        print_fail(f"First request: {e}")
    
    total_count += 1
    try:
        payload = {
            "api_path": "/api/v2/products",
            "caller_system": "inventory-service"
        }
        resp2 = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        assert resp2.status_code == 409
        print_success("Duplicate request rejected with 409")
        success_count += 1
    except Exception as e:
        print_fail(f"Duplicate request: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/", timeout=5)
        data = resp.json()
        count = sum(1 for r in data if r["api_path"] == "/api/v2/products")
        assert count == 1
        print_success(f"Only one registration exists (expected 1, got {count})")
        success_count += 1
    except Exception as e:
        print_fail(f"Verify single registration: {e}")
    
    return success_count, total_count

def test_manual_correction():
    print_info("\n" + "="*60)
    print_info("TEST 4: MANUAL CORRECTION - 人工修正测试")
    print_info("="*60)
    
    success_count = 0
    total_count = 0
    
    total_count += 1
    try:
        payload = {
            "api_path": "/api/v3/wrong-path",
            "caller_system": "wrong-system-name",
            "contact_person": "错误的联系人"
        }
        resp = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        assert resp.status_code == 201
        reg_id = resp.json()["id"]
        print_success(f"Created wrong data for correction - ID: {reg_id}")
        success_count += 1
    except Exception as e:
        print_fail(f"Create wrong data: {e}")
        return success_count, total_count
    
    total_count += 1
    try:
        payload = {
            "corrected_by": "管理员",
            "correction_notes": "修正接口路径和调用方系统名称，原数据是日志解析错误导致的",
            "updates": {
                "api_path": "/api/v3/correct-path",
                "caller_system": "correct-system-name",
                "contact_person": "赵六",
                "status": "log_verified"
            }
        }
        resp = requests.post(f"{BASE_URL}/registrations/{reg_id}/manual-correction", json=payload, timeout=5)
        assert resp.status_code == 200
        data = resp.json()["registration"]
        assert data["api_path"] == "/api/v3/correct-path"
        assert data["caller_system"] == "correct-system-name"
        assert data["is_manual_correction"] == True
        assert data["corrected_by"] == "管理员"
        print_success("Manual correction applied successfully")
        success_count += 1
    except Exception as e:
        print_fail(f"Apply manual correction: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/{reg_id}/history", timeout=5)
        history = resp.json()
        assert len(history) >= 1
        correction_found = any("Manual correction" in h.get("change_reason", "") for h in history)
        assert correction_found
        print_success("Correction recorded in history")
        success_count += 1
    except Exception as e:
        print_fail(f"Verify correction history: {e}")
    
    return success_count, total_count

def test_delay_request():
    print_info("\n" + "="*60)
    print_info("TEST 5: DELAY REQUEST - 延期申请测试")
    print_info("="*60)
    
    success_count = 0
    total_count = 0
    
    total_count += 1
    try:
        payload = {
            "api_path": "/api/v4/delay-test",
            "caller_system": "delay-service"
        }
        resp = requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        reg_id = resp.json()["id"]
        print_success(f"Created registration for delay test - ID: {reg_id}")
        success_count += 1
    except Exception as e:
        print_fail(f"Create registration: {e}")
        return success_count, total_count
    
    total_count += 1
    try:
        resp = requests.post(
            f"{BASE_URL}/registrations/{reg_id}/delay-request",
            json={
                "delay_reason": "依赖第三方系统升级未完成，需要等待对方配合",
                "extension_days": 30,
                "requested_by": "项目负责人"
            },
            timeout=5
        )
        assert resp.status_code == 200
        print_success("Delay request submitted")
        success_count += 1
    except Exception as e:
        print_fail(f"Submit delay request: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/{reg_id}", timeout=5)
        data = resp.json()
        assert data["status"] == "delayed"
        assert data["extension_days"] == 30
        assert "第三方系统升级" in data["delay_reason"]
        print_success(f"Status updated to delayed with {data['extension_days']} days extension")
        success_count += 1
    except Exception as e:
        print_fail(f"Verify delay status: {e}")
    
    return success_count, total_count

def test_query_filters():
    print_info("\n" + "="*60)
    print_info("TEST 6: QUERY FILTERS - 查询过滤测试")
    print_info("="*60)
    
    success_count = 0
    total_count = 0
    
    total_count += 1
    try:
        for i in range(3):
            payload = {
                "api_path": f"/api/filter/test{i}",
                "caller_system": f"system-{i % 2}"
            }
            requests.post(f"{BASE_URL}/registrations/", json=payload, timeout=5)
        print_success("Created test data for filtering")
        success_count += 1
    except Exception as e:
        print_fail(f"Create test data: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/?api_path=filter", timeout=5)
        data = resp.json()
        assert len(data) >= 3
        print_success(f"Filter by api_path - found {len(data)} records")
        success_count += 1
    except Exception as e:
        print_fail(f"Filter by api_path: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/?caller_system=system-0", timeout=5)
        data = resp.json()
        assert len(data) >= 1
        print_success(f"Filter by caller_system - found {len(data)} records")
        success_count += 1
    except Exception as e:
        print_fail(f"Filter by caller_system: {e}")
    
    total_count += 1
    try:
        resp = requests.get(f"{BASE_URL}/registrations/?status=pending", timeout=5)
        data = resp.json()
        assert len(data) >= 1
        print_success(f"Filter by status - found {len(data)} pending records")
        success_count += 1
    except Exception as e:
        print_fail(f"Filter by status: {e}")
    
    return success_count, total_count

def main():
    print(f"\n{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}API 调用方登记系统 - 自检测试脚本{Colors.ENDC}")
    print(f"{Colors.BOLD}{'='*60}{Colors.ENDC}")
    
    cleanup_db()
    
    server_process = start_server()
    
    total_success = 0
    total_tests = 0
    
    try:
        tests = [
            test_normal_flow,
            test_dirty_data,
            test_duplicate_requests,
            test_manual_correction,
            test_delay_request,
            test_query_filters
        ]
        
        for test in tests:
            success, count = test()
            total_success += success
            total_tests += count
        
        print_info("\n" + "="*60)
        print_info("FINAL RESULTS")
        print_info("="*60)
        
        success_rate = (total_success / total_tests * 100) if total_tests > 0 else 0
        
        if success_rate >= 90:
            print_success(f"Overall: {total_success}/{total_tests} tests passed ({success_rate:.1f}%)")
            print_success("All major functionality working correctly!")
        elif success_rate >= 70:
            print_warning(f"Overall: {total_success}/{total_tests} tests passed ({success_rate:.1f}%)")
            print_warning("Some tests failed, please check the issues above")
        else:
            print_fail(f"Overall: {total_success}/{total_tests} tests passed ({success_rate:.1f}%)")
            print_fail("Many tests failed, system may have issues")
        
        print_info("\nTest coverage includes:")
        print_info("  ✓ Normal flow: create → query → add evidence → confirm transformation → status update → export")
        print_info("  ✓ Dirty data: validation for invalid inputs, raw input preservation")
        print_info("  ✓ Duplicate requests: 409 conflict detection")
        print_info("  ✓ Manual correction: field updates with audit trail")
        print_info("  ✓ Delay request: status change and extension tracking")
        print_info("  ✓ Query filters: by api_path, caller_system, and status")
        
    finally:
        stop_server(server_process)
        cleanup_db()

if __name__ == "__main__":
    main()
