import requests
import sys
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=" * 60)
    print("剧场烟火审批 API - 自检程序")
    print("=" * 60)
    
    all_passed = True
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200 and response.json()["status"] == "healthy":
            print("✓ [1/7] 健康检查通过")
        else:
            print("✗ [1/7] 健康检查失败")
            all_passed = False
    except Exception as e:
        print(f"✗ [1/7] 健康检查失败: {e}")
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
        print(f"✓ [2/7] 创建演出通过 (ID={perf_id})")
    else:
        print("✗ [2/7] 创建演出失败")
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
        if response.status_code == 200 and "校验通过" in response.json()["message"]:
            print("✓ [3/7] 安全距离校验通过")
        else:
            print("✗ [3/7] 安全距离校验失败")
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
            print("✓ [4/7] 违规点位拦截通过 (距离不足5米被拦截)")
        else:
            print("✗ [4/7] 违规点位拦截失败")
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
            print("✓ [5/7] 重复提交检测通过")
        else:
            print("✗ [5/7] 重复提交检测失败")
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
                print("✓ [6/7] 临时加场拦截通过 (未复核的临时加场被禁止确认)")
            else:
                print("✗ [6/7] 临时加场拦截失败")
                all_passed = False
        else:
            print("✗ [6/7] 创建临时演出失败")
            all_passed = False
    
    if perf_id:
        response = requests.get(f"{BASE_URL}/performances/{perf_id}/check")
        if response.status_code == 200:
            result = response.json()
            print(f"✓ [7/7] 全流程规则判定可执行")
            print(f"  当前状态: {result['current_status']}")
        else:
            print("✗ [7/7] 全流程规则判定失败")
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("✓ 全部自检通过！API 功能正常")
    else:
        print("✗ 部分自检失败，请检查相关功能")
    print("=" * 60)
    
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
