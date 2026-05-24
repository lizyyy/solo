import requests
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=" * 60)
    print("剧场烟火审批 API - 自检程序 (v3)")
    print("=" * 60)
    
    all_passed = True
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200 and response.json()["status"] == "healthy":
            print("✓ [1/11] 健康检查通过")
        else:
            print("✗ [1/11] 健康检查失败")
            all_passed = False
    except Exception as e:
        print(f"✗ [1/11] 健康检查失败: {e}")
        print("  请确保服务已启动: uvicorn app.main:app --reload")
        return False
    
    future_date = datetime.now() + timedelta(days=3)
    perf_data = {
        "name": "自检测试演出",
        "date": future_date.isoformat(),
        "venue": "测试剧场",
        "is_temporary": False
    }
    response = requests.post(f"{BASE_URL}/performances", json=perf_data)
    if response.status_code == 200:
        perf_id = response.json()["id"]
        initial_status = response.json()["status"]
        print(f"✓ [2/11] 创建演出通过 (ID={perf_id}, 初始状态={initial_status})")
    else:
        print("✗ [2/11] 创建演出失败")
        all_passed = False
        perf_id = None
    
    if perf_id:
        valid_points = [
            {
                "location_code": "TEST-001",
                "x_coordinate": 0.0,
                "y_coordinate": 0.0,
                "distance_to_audience": 10.0,
                "firework_type": "测试烟花",
                "quantity": 10
            }
        ]
        response = requests.post(f"{BASE_URL}/performances/{perf_id}/points", json=valid_points)
        result = response.json()
        if response.status_code == 200 and "校验通过" in result["message"]:
            perf_response = requests.get(f"{BASE_URL}/performances/{perf_id}")
            current_status = perf_response.json()["status"]
            if current_status == "points_verified":
                print(f"✓ [3/11] 状态机修复验证: pending→points_verified 直接跳转成功 (状态={current_status})")
            else:
                print(f"✗ [3/11] 状态机修复验证失败: 期望 points_verified，实际 {current_status}")
                all_passed = False
        else:
            print("✗ [3/11] 安全距离校验失败")
            all_passed = False
    
    if perf_id:
        invalid_points = [
            {
                "location_code": "TEST-002",
                "x_coordinate": 1.0,
                "y_coordinate": 1.0,
                "distance_to_audience": 3.0,
                "firework_type": "危险烟花",
                "quantity": 10
            }
        ]
        response = requests.post(f"{BASE_URL}/performances/{perf_id}/points", json=invalid_points)
        result = response.json()
        if response.status_code == 200 and not result["is_duplicate"] and "校验失败" in result["message"]:
            print("✓ [4/11] 违规点位拦截通过 (距离不足5米被拦截)")
        else:
            print("✗ [4/11] 违规点位拦截失败")
            all_passed = False
    
    if perf_id:
        points_data = [
            {
                "location_code": "DUP-TEST",
                "x_coordinate": 5.0,
                "y_coordinate": 5.0,
                "distance_to_audience": 8.0,
                "firework_type": "重复测试",
                "quantity": 5
            }
        ]
        response1 = requests.post(f"{BASE_URL}/performances/{perf_id}/points", json=points_data)
        response2 = requests.post(f"{BASE_URL}/performances/{perf_id}/points", json=points_data)
        if response2.status_code == 200 and response2.json()["is_duplicate"]:
            print("✓ [5/11] 重复提交检测通过")
        else:
            print("✗ [5/11] 重复提交检测失败")
            all_passed = False
    
    if perf_id:
        approval_data = {
            "department": "消防部门",
            "approver_name": "王建国",
            "certificate_number": "XF-2024-TEST-001"
        }
        response = requests.post(f"{BASE_URL}/performances/{perf_id}/approvals", json=approval_data)
        if response.status_code == 200:
            perf_response = requests.get(f"{BASE_URL}/performances/{perf_id}")
            current_status = perf_response.json()["status"]
            if current_status == "fire_approved":
                print(f"✓ [6/11] 消防审批状态推进成功 (状态={current_status})")
            else:
                print(f"✗ [6/11] 消防审批状态推进失败: 期望 fire_approved，实际 {current_status}")
                all_passed = False
        else:
            print("✗ [6/11] 消防审批提交失败")
            all_passed = False
    
    if perf_id:
        test_time = datetime.now() - timedelta(hours=1)
        test_data = {
            "test_time": test_time.isoformat(),
            "tester_name": "李明",
            "witness_name": "张华",
            "video_evidence_url": "https://example.com/test-video.mp4"
        }
        response = requests.post(f"{BASE_URL}/performances/{perf_id}/test-records", json=test_data)
        if response.status_code == 200:
            perf_response = requests.get(f"{BASE_URL}/performances/{perf_id}")
            current_status = perf_response.json()["status"]
            if current_status == "test_completed":
                print(f"✓ [7/11] 试放记录状态推进成功 (状态={current_status})")
            else:
                print(f"✗ [7/11] 试放记录状态推进失败: 期望 test_completed，实际 {current_status}")
                all_passed = False
        else:
            print("✗ [7/11] 试放记录提交失败")
            all_passed = False
    
    if perf_id:
        props_data = [
            {
                "item_name": "冷焰火发射器",
                "quantity": 4,
                "safety_rating": "A级"
            }
        ]
        response = requests.post(f"{BASE_URL}/performances/{perf_id}/props", json=props_data)
        if response.status_code == 200:
            perf_response = requests.get(f"{BASE_URL}/performances/{perf_id}")
            current_status = perf_response.json()["status"]
            if current_status == "props_confirmed":
                print(f"✓ [8/11] 道具清单状态推进成功 (状态={current_status})")
            else:
                print(f"✗ [8/11] 道具清单状态推进失败: 期望 props_confirmed，实际 {current_status}")
                all_passed = False
        else:
            print("✗ [8/11] 道具清单提交失败")
            all_passed = False
    
    if perf_id:
        response = requests.get(f"{BASE_URL}/performances/{perf_id}/check")
        if response.status_code == 200:
            result = response.json()
            if not result["approved"] and "TEST-002" in str(result["violations"]):
                print(f"✓ [9/11] 安全校验绕过修复验证: 违规点位成功阻断审批")
                print(f"  违规项已检测: {result['violations'][0][:50]}...")
            else:
                print(f"✗ [9/11] 安全校验绕过修复失败: 违规点位未阻断审批")
                print(f"  approved={result['approved']}, violations={result['violations']}")
                all_passed = False
        else:
            print("✗ [9/11] 规则判定执行失败")
            all_passed = False
    
    if perf_id:
        perf2_data = {
            "name": "完全合规演出",
            "date": future_date.isoformat(),
            "venue": "测试剧场",
            "is_temporary": False
        }
        perf2_response = requests.post(f"{BASE_URL}/performances", json=perf2_data)
        perf2_id = perf2_response.json()["id"]
        
        valid_only_points = [
            {
                "location_code": "SAFE-001",
                "x_coordinate": 0.0,
                "y_coordinate": 0.0,
                "distance_to_audience": 10.0,
                "firework_type": "合规烟花",
                "quantity": 10
            }
        ]
        requests.post(f"{BASE_URL}/performances/{perf2_id}/points", json=valid_only_points)
        
        requests.post(f"{BASE_URL}/performances/{perf2_id}/approvals", json=approval_data)
        requests.post(f"{BASE_URL}/performances/{perf2_id}/test-records", json=test_data)
        requests.post(f"{BASE_URL}/performances/{perf2_id}/props", json=props_data)
        
        final_check = requests.get(f"{BASE_URL}/performances/{perf2_id}/check")
        result = final_check.json()
        if result["approved"] and result["current_status"] == "final_approved":
            print(f"✓ [10/11] 纯合规点位完整审批闭环通过 (状态={result['current_status']})")
        else:
            print(f"✗ [10/11] 纯合规点位审批闭环失败: approved={result['approved']}, status={result['current_status']}")
            if result["violations"]:
                print(f"  违规项: {result['violations']}")
            all_passed = False
    
    if perf_id:
        temp_perf_data = {
            "name": "临时加场测试",
            "date": future_date.isoformat(),
            "venue": "测试剧场",
            "is_temporary": True
        }
        temp_response = requests.post(f"{BASE_URL}/performances", json=temp_perf_data)
        if temp_response.status_code == 200:
            temp_perf_id = temp_response.json()["id"]
            confirm_data = {
                "stage_manager_name": "张三",
                "fire_department_name": "李四",
                "prop_team_name": "王五"
            }
            confirm_response = requests.post(f"{BASE_URL}/performances/{temp_perf_id}/confirm", json=confirm_data)
            if confirm_response.status_code == 403:
                print("✓ [11/11] 责任确认拦截通过 (未完成审批被禁止)")
            else:
                print(f"✗ [11/11] 责任确认拦截失败: 期望 403，实际 {confirm_response.status_code}")
                all_passed = False
        else:
            print("✗ [11/11] 创建临时演出失败")
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("✓ 全部自检通过！API 功能正常")
        print("✓ 核心安全验证: 违规点位会阻断审批，合规点位正常推进")
        print("✓ 审批闭环: pending → points_verified → fire_approved")
        print("✓           → test_completed → props_confirmed → final_approved")
    else:
        print("✗ 部分自检失败，请检查相关功能")
    print("=" * 60)
    
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
