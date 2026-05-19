#!/usr/bin/env python3
import sys
import time
import uuid
import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

def generate_device_id() -> str:
    return f"DEV-{uuid.uuid4().hex[:8]}"

def print_step(step: str, title: str):
    print(f"\n{'='*60}")
    print(f"步骤 {step}: {title}")
    print('='*60)

def print_result(success: bool, message: str, data: Any = None):
    status = "✅ 通过" if success else "❌ 失败"
    print(f"\n{status}: {message}")
    if data:
        print(f"详情: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")

def test_import_evidence():
    """测试1: 导入证据 - 正常流程"""
    print_step("1", "导入证据 - 正常流程")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T10:30:00Z",
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response.status_code == 200:
            result = response.json()
            print_result(True, "正常证据导入成功", result)
            return result.get("report_id")
        else:
            print_result(False, f"正常证据导入失败: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return None

def test_firmware_mismatch():
    """测试2: 固件版本不匹配 - 需要人工复核"""
    print_step("2", "固件版本不匹配 - 需要人工复核")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T11:00:00Z",
        "firmware_version": "v1.0.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response.status_code == 400:
            result = response.json()
            error_detail = result.get("detail", {})
            if error_detail.get("error_code") == "needs_manual_review":
                print_result(True, "固件不匹配正确触发人工复核", error_detail)
                return error_detail.get("details", {}).get("report_id")
            else:
                print_result(False, f"错误码不匹配: {error_detail}")
                return None
        else:
            print_result(False, f"预期400但得到: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return None

def test_proof_validation_failed():
    """测试3: 证明材料校验失败 - 强制隔离"""
    print_step("3", "证明材料校验失败 - 强制隔离")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": "invalid data",
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response.status_code == 200:
            result = response.json()
            if result.get("isolation_status") == "isolated":
                print_result(True, "证明材料无效正确触发强制隔离", result)
                return result.get("report_id")
            else:
                print_result(False, f"隔离状态不正确: {result.get('isolation_status')}")
                return result.get("report_id")
        else:
            print_result(False, f"请求失败: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return None

def test_duplicate_submission():
    """测试4: 重复上报幂等性"""
    print_step("4", "重复上报幂等性测试")
    
    device_id = generate_device_id()
    proof_material = f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T12:00:00Z"
    test_data = {
        "device_id": device_id,
        "proof_material": proof_material,
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response1 = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response1.status_code != 200:
            print_result(False, f"第一次上报失败: {response1.status_code} - {response1.text}")
            return None
        
        response2 = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response2.status_code == 409:
            result = response2.json()
            error_detail = result.get("detail", {})
            if error_detail.get("error_code") == "already_processed":
                print_result(True, "重复上报正确检测", error_detail)
                return True
            else:
                print_result(False, f"错误码不匹配: {error_detail}")
                return False
        else:
            print_result(False, f"预期409但得到: {response2.status_code} - {response2.text}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_missing_fields():
    """测试5: 缺失字段验证"""
    print_step("5", "缺失字段验证")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response.status_code == 400:
            result = response.json()
            if result.get("error_code") == "missing_fields":
                print_result(True, "缺失字段正确返回 missing_fields 错误码", result)
                return True
            else:
                print_result(False, f"错误码不正确，预期 missing_fields，得到: {result.get('error_code')}", result)
                return False
        else:
            print_result(False, f"预期400但得到: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_filter_by_device():
    """测试6: 按设备编号筛选"""
    print_step("6", "按设备编号筛选")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T13:00:00Z",
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        
        response = requests.get(f"{BASE_URL}/api/evidence/list", params={"device_id": device_id})
        if response.status_code == 200:
            results = response.json()
            if all(r.get("device_id") == device_id for r in results):
                print_result(True, f"按设备筛选成功，找到 {len(results)} 条记录")
                return True
            else:
                print_result(False, "筛选结果包含其他设备的记录")
                return False
        else:
            print_result(False, f"请求失败: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_filter_by_isolation_status():
    """测试7: 按隔离状态筛选"""
    print_step("7", "按隔离状态筛选")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": "invalid proof for isolation test",
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        
        response = requests.get(f"{BASE_URL}/api/evidence/list", params={"isolation_status": "isolated"})
        if response.status_code == 200:
            results = response.json()
            if all(r.get("isolation_status") == "isolated" for r in results):
                print_result(True, f"按隔离状态筛选成功，找到 {len(results)} 条已隔离记录")
                return True
            else:
                print_result(False, "筛选结果状态不正确")
                return False
        else:
            print_result(False, f"请求失败: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_filter_by_needs_review():
    """测试8: 按需要复核筛选"""
    print_step("8", "按需要复核筛选")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T14:00:00Z",
        "firmware_version": "v1.0.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        
        response = requests.get(f"{BASE_URL}/api/evidence/list", params={"needs_review": True})
        if response.status_code == 200:
            results = response.json()
            if all(r.get("needs_review") == True for r in results):
                print_result(True, f"按需要复核筛选成功，找到 {len(results)} 条记录")
                return True
            else:
                print_result(False, "筛选结果不正确")
                return False
        else:
            print_result(False, f"请求失败: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_manual_review():
    """测试9: 人工复核处理"""
    print_step("9", "人工复核处理")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T15:00:00Z",
        "firmware_version": "v1.0.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response1 = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response1.status_code != 400:
            print_result(False, f"创建待复核记录失败，预期400得到: {response1.status_code}")
            return False
        
        result1 = response1.json()
        report_id = result1.get("detail", {}).get("details", {}).get("report_id")
        
        if not report_id:
            print_result(False, "无法获取待复核报告ID")
            return False
        
        response = requests.post(
            f"{BASE_URL}/api/evidence/{report_id}/review",
            params={"approve": True, "review_notes": "审核通过，确认异常"}
        )
        if response.status_code == 200:
            result = response.json()
            print_result(True, "人工复核成功", result)
            return True
        else:
            print_result(False, f"请求失败: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_export_evidence():
    """测试10: 导出证据报告"""
    print_step("10", "导出证据报告")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T16:00:00Z",
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response1 = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response1.status_code != 200:
            print_result(False, "创建测试记录失败")
            return False
        
        report_id = response1.json().get("report_id")
        
        response = requests.get(f"{BASE_URL}/api/evidence/export/{report_id}")
        if response.status_code == 200:
            result = response.json()
            required_fields = ["report_id", "device_id", "firmware", "isolation", "evidence_report"]
            if all(field in result for field in required_fields):
                print_result(True, "导出成功，包含所有必要字段", result)
                return True
            else:
                print_result(False, f"导出结果缺少必要字段: {result.keys()}")
                return False
        else:
            print_result(False, f"请求失败: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def test_get_single_evidence():
    """测试11: 获取单条证据详情"""
    print_step("11", "获取单条证据详情")
    
    device_id = generate_device_id()
    test_data = {
        "device_id": device_id,
        "proof_material": f"hash:{uuid.uuid4().hex}, signature:{uuid.uuid4().hex}, timestamp:2024-01-15T17:00:00Z",
        "firmware_version": "v2.1.0",
        "expected_firmware": "v2.1.0"
    }
    
    try:
        response1 = requests.post(f"{BASE_URL}/api/evidence/review", json=test_data)
        if response1.status_code != 200:
            print_result(False, "创建测试记录失败")
            return False
        
        report_id = response1.json().get("report_id")
        
        response = requests.get(f"{BASE_URL}/api/evidence/{report_id}")
        if response.status_code == 200:
            result = response.json()
            if result.get("report_id") == report_id:
                print_result(True, "获取单条证据成功", result)
                return True
            else:
                print_result(False, "返回的报告ID不匹配")
                return False
        else:
            print_result(False, f"请求失败: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"请求异常: {str(e)}")
        return False

def main():
    print("\n" + "="*60)
    print("IoT设备可信证据隔离动作证明材料API - 自检脚本")
    print("="*60)
    
    print("\n正在启动API服务器...")
    
    import subprocess
    import os
    
    server_process = subprocess.Popen(
        [sys.executable, "main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    time.sleep(3)
    
    results = []
    
    try:
        print("\n开始执行测试...")
        
        report_id1 = test_import_evidence()
        results.append(("正常导入", report_id1 is not None))
        
        report_id2 = test_firmware_mismatch()
        results.append(("固件不匹配触发复核", report_id2 is not None))
        
        report_id3 = test_proof_validation_failed()
        results.append(("证明材料无效触发隔离", report_id3 is not None))
        
        dup_result = test_duplicate_submission()
        results.append(("重复上报幂等性", dup_result))
        
        missing_result = test_missing_fields()
        results.append(("缺失字段验证", missing_result))
        
        filter1_result = test_filter_by_device()
        results.append(("按设备筛选", filter1_result))
        
        filter2_result = test_filter_by_isolation_status()
        results.append(("按隔离状态筛选", filter2_result))
        
        filter3_result = test_filter_by_needs_review()
        results.append(("按需要复核筛选", filter3_result))
        
        review_result = test_manual_review()
        results.append(("人工复核处理", review_result))
        
        export_result = test_export_evidence()
        results.append(("导出证据报告", export_result))
        
        get_result = test_get_single_evidence()
        results.append(("获取单条证据", get_result))
        
    finally:
        server_process.terminate()
        server_process.wait()
    
    print("\n" + "="*60)
    print("测试结果汇总")
    print("="*60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{status}: {name}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！API功能正常。")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个测试失败，请检查。")
        return 1

if __name__ == "__main__":
    sys.exit(main())
