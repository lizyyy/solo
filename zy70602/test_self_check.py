import requests
import json
from datetime import date, datetime, timedelta
import os

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_test_result(test_name, success, message=""):
    status = "✅ 通过" if success else "❌ 失败"
    print(f"{test_name:50s} {status}")
    if message:
        print(f"   {message}")

def test_package_import():
    print_section("1. 测试月租套餐导入")
    
    test_cases = [
        {
            "name": "正常导入套餐",
            "data": {
                "plate_number": "京A12345",
                "package_name": "月卡30天",
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "total_amount": 300.0
            },
            "should_pass": True
        },
        {
            "name": "重复导入同车牌",
            "data": {
                "plate_number": "京A12345",
                "package_name": "月卡30天",
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "total_amount": 300.0
            },
            "should_pass": False,
            "expected_error": "already_processed"
        },
        {
            "name": "导入另一车牌",
            "data": {
                "plate_number": "京B67890",
                "package_name": "月卡30天",
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "total_amount": 50.0
            },
            "should_pass": True
        }
    ]
    
    results = []
    for test in test_cases:
        try:
            response = requests.post(f"{BASE_URL}/api/packages/", json=test["data"])
            success = (response.status_code == 200) == test["should_pass"]
            
            if not test["should_pass"] and response.status_code == 400:
                error_detail = response.json()["detail"]
                success = error_detail.get("error_type") == test.get("expected_error")
            
            results.append(success)
            print_test_result(test["name"], success, 
                            f"状态码: {response.status_code}" if success else f"响应: {response.text}")
        except Exception as e:
            results.append(False)
            print_test_result(test["name"], False, f"异常: {str(e)}")
    
    return all(results)

def test_event_import():
    print_section("2. 测试道闸事件导入与自动去重")
    
    test_time = datetime(2024, 1, 15, 10, 30, 0)
    
    test_cases = [
        {
            "name": "导入出场事件（自动扣费）",
            "data": {
                "event_unique_id": "EVT001",
                "plate_number": "京A12345",
                "pass_time": test_time.isoformat(),
                "direction": "out",
                "gate_id": "GATE001"
            },
            "should_pass": True
        },
        {
            "name": "重复导入同一事件",
            "data": {
                "event_unique_id": "EVT001",
                "plate_number": "京A12345",
                "pass_time": test_time.isoformat(),
                "direction": "out",
                "gate_id": "GATE001"
            },
            "should_pass": False,
            "expected_error": "duplicate"
        },
        {
            "name": "导入入场事件",
            "data": {
                "event_unique_id": "EVT002",
                "plate_number": "京A12345",
                "pass_time": (test_time - timedelta(hours=2)).isoformat(),
                "direction": "in",
                "gate_id": "GATE001"
            },
            "should_pass": True
        },
        {
            "name": "导入无套餐车辆出场",
            "data": {
                "event_unique_id": "EVT003",
                "plate_number": "京C11111",
                "pass_time": test_time.isoformat(),
                "direction": "out",
                "gate_id": "GATE001"
            },
            "should_pass": True
        }
    ]
    
    results = []
    for test in test_cases:
        try:
            response = requests.post(f"{BASE_URL}/api/events/", json=test["data"])
            success = (response.status_code == 200) == test["should_pass"]
            
            if not test["should_pass"] and response.status_code == 400:
                error_detail = response.json()["detail"]
                success = error_detail.get("error_type") == test.get("expected_error")
            
            results.append(success)
            print_test_result(test["name"], success, 
                            f"状态码: {response.status_code}" if success else f"响应: {response.text}")
        except Exception as e:
            results.append(False)
            print_test_result(test["name"], False, f"异常: {str(e)}")
    
    return all(results)

def test_event_filter():
    print_section("3. 测试事件筛选查询")
    
    test_cases = [
        {
            "name": "按车牌号筛选",
            "params": {"plate_number": "京A12345"},
            "expected_count": 2
        },
        {
            "name": "按日期范围筛选",
            "params": {"start_date": "2024-01-15", "end_date": "2024-01-15"},
            "expected_count": 3
        },
        {
            "name": "按未扣费筛选",
            "params": {"is_deducted": False},
            "expected_min": 1
        }
    ]
    
    results = []
    for test in test_cases:
        try:
            response = requests.get(f"{BASE_URL}/api/events/", params=test["params"])
            data = response.json()
            count = data["count"]
            
            if "expected_count" in test:
                success = count == test["expected_count"]
            else:
                success = count >= test["expected_min"]
            
            results.append(success)
            print_test_result(test["name"], success, 
                            f"返回 {count} 条记录" if success else f"期望 {test.get('expected_count', '>=' + str(test.get('expected_min')))}，实际 {count}")
        except Exception as e:
            results.append(False)
            print_test_result(test["name"], False, f"异常: {str(e)}")
    
    return all(results)

def test_supplementary_deduction():
    print_section("4. 测试补扣申请与处理")
    
    try:
        response = requests.get(f"{BASE_URL}/api/events/", params={"is_deducted": False})
        undeducted_events = response.json()["events"]
        if not undeducted_events:
            print_test_result("获取未扣费事件", False, "没有未扣费事件")
            return False
        
        event_id = undeducted_events[0]["id"]
        plate_number = undeducted_events[0]["plate_number"]
        
        print(f"   选择事件ID: {event_id}, 车牌号: {plate_number}")
        
        test1_response = requests.post(f"{BASE_URL}/api/supplementary-deductions/", json={
            "plate_number": "京C11111",
            "event_id": event_id,
            "amount": 5.0
        })
        
        if test1_response.status_code == 400:
            error_type = test1_response.json()["detail"].get("error_type")
            success1 = error_type == "needs_manual_review"
            print_test_result("无套餐车辆补扣（需人工复核）", success1, 
                            f"错误类型: {error_type}")
        else:
            print_test_result("无套餐车辆补扣（需人工复核）", False, 
                            f"响应: {test1_response.text}")
            success1 = False
        
        event_id_京B = None
        response = requests.post(f"{BASE_URL}/api/events/", json={
            "event_unique_id": "EVT004",
            "plate_number": "京B67890",
            "pass_time": datetime(2024, 1, 15, 14, 0, 0).isoformat(),
            "direction": "out",
            "gate_id": "GATE001"
        })
        if response.status_code == 200:
            event_id_京B = response.json()["event_id"]
        
        if not event_id_京B:
            print_test_result("创建补扣申请", False, "无法创建测试事件")
            return success1 and False
        
        test2_response = requests.post(f"{BASE_URL}/api/supplementary-deductions/", json={
            "plate_number": "京B67890",
            "event_id": event_id_京B,
            "amount": 5.0
        })
        
        success2 = test2_response.status_code == 200
        print_test_result("创建补扣申请", success2, 
                        f"状态码: {test2_response.status_code}")
        
        if success2:
            deduction_id = test2_response.json()["supplementary_id"]
            
            test3_response = requests.post(f"{BASE_URL}/api/supplementary-deductions/{deduction_id}/process")
            success3 = test3_response.status_code == 200
            print_test_result("处理补扣申请", success3, 
                            f"状态码: {test3_response.status_code}")
            
            test4_response = requests.post(f"{BASE_URL}/api/supplementary-deductions/{deduction_id}/process")
            if test4_response.status_code == 400:
                error_type = test4_response.json()["detail"].get("error_type")
                success4 = error_type == "already_processed"
            else:
                success4 = False
            print_test_result("重复处理补扣（状态校验）", success4, 
                            f"错误类型: {error_type if test4_response.status_code == 400 else 'N/A'}")
            
            return success1 and success2 and success3 and success4
        
        return success1 and success2
        
    except Exception as e:
        print_test_result("补扣流程", False, f"异常: {str(e)}")
        return False

def test_balance_recalculation():
    print_section("5. 测试余额重算与扣费流水")
    
    try:
        response = requests.get(f"{BASE_URL}/api/packages/", params={"plate_number": "京B67890"})
        packages = response.json()["packages"]
        if packages:
            balance = packages[0]["balance"]
            print(f"   京B67890 当前余额: {balance}")
            success1 = balance == 45.0
            print_test_result("余额正确计算（50-5）", success1, f"余额: {balance}")
        else:
            success1 = False
            print_test_result("查询套餐信息", False, "未找到套餐")
        
        response = requests.get(f"{BASE_URL}/api/deduction-records/", 
                               params={"plate_number": "京B67890"})
        records = response.json()["records"]
        success2 = len(records) >= 1
        print_test_result("扣费流水记录存在", success2, f"流水数: {len(records)}")
        
        return success1 and success2
        
    except Exception as e:
        print_test_result("余额与流水查询", False, f"异常: {str(e)}")
        return False

def test_reconciliation_summary():
    print_section("6. 测试对账摘要生成")
    
    try:
        response = requests.post(f"{BASE_URL}/api/reconciliation/generate", 
                                params={"target_date": "2024-01-15"})
        success = response.status_code == 200
        print_test_result("生成对账摘要", success)
        
        if success:
            summary = response.json()["summary"]
            print(f"   总事件数: {summary['total_events']}")
            print(f"   总扣费数: {summary['total_deductions']}")
            print(f"   未扣费数: {summary['missing_deductions']}")
            print(f"   对账状态: {summary['reconciliation_status']}")
        
        return success
    except Exception as e:
        print_test_result("生成对账摘要", False, f"异常: {str(e)}")
        return False

def test_reconciliation_export():
    print_section("7. 测试对账数据导出CSV")
    
    try:
        response = requests.get(f"{BASE_URL}/api/reconciliation/export",
                               params={"start_date": "2024-01-01", "end_date": "2024-01-31"})
        success = response.status_code == 200 and "text/csv" in response.headers.get("content-type", "")
        print_test_result("导出CSV", success, 
                        f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        
        if success:
            lines = response.text.strip().split('\n')
            print(f"   导出行数: {len(lines)}")
            print(f"   表头: {lines[0][:50]}...")
        
        return success
    except Exception as e:
        print_test_result("导出CSV", False, f"异常: {str(e)}")
        return False

def main():
    print("\n" + "="*60)
    print("  月租扣费道闸事件对账闭环API 自检脚本")
    print("="*60)
    
    all_tests = []
    
    all_tests.append(("套餐导入", test_package_import()))
    all_tests.append(("事件导入去重", test_event_import()))
    all_tests.append(("事件筛选", test_event_filter()))
    all_tests.append(("补扣流程", test_supplementary_deduction()))
    all_tests.append(("余额与流水", test_balance_recalculation()))
    all_tests.append(("对账摘要", test_reconciliation_summary()))
    all_tests.append(("对账导出", test_reconciliation_export()))
    
    print_section("自检结果汇总")
    
    passed = sum(1 for _, result in all_tests if result)
    total = len(all_tests)
    
    for name, result in all_tests:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{name:30s} {status}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！系统运行正常。")
    else:
        print(f"\n⚠️  有 {total - passed} 项测试未通过，请检查。")
    
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    main()
