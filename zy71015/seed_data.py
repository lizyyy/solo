import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def seed_data():
    print("开始造数...")
    
    future_date = datetime.now() + timedelta(days=7)
    performance_data = {
        "name": "《天鹅湖》新年特别场",
        "date": future_date.isoformat(),
        "venue": "国家大剧院歌剧院",
        "is_temporary": False
    }
    
    response = requests.post(f"{BASE_URL}/performances", json=performance_data)
    if response.status_code == 200:
        performance = response.json()
        performance_id = performance["id"]
        print(f"✓ 创建演出场次: ID={performance_id}")
    else:
        print(f"✗ 创建演出失败: {response.text}")
        return
    
    points_data = [
        {
            "location_code": "STAGE-LEFT-01",
            "x_coordinate": -5.0,
            "y_coordinate": 2.0,
            "distance_to_audience": 8.5,
            "firework_type": "冷焰火",
            "quantity": 20
        },
        {
            "location_code": "STAGE-RIGHT-01",
            "x_coordinate": 5.0,
            "y_coordinate": 2.0,
            "distance_to_audience": 8.5,
            "firework_type": "冷焰火",
            "quantity": 20
        },
        {
            "location_code": "STAGE-CENTER-01",
            "x_coordinate": 0.0,
            "y_coordinate": 5.0,
            "distance_to_audience": 12.0,
            "firework_type": "喷泉烟花",
            "quantity": 5
        }
    ]
    
    response = requests.post(f"{BASE_URL}/performances/{performance_id}/points", json=points_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 提交烟火点位: {result['message']}")
    else:
        print(f"✗ 提交点位失败: {response.text}")
    
    approval_data = {
        "department": "消防部门",
        "approver_name": "王建国",
        "certificate_number": "XF-2024-001234",
        "notes": "已现场核查消防通道，符合安全要求"
    }
    
    response = requests.post(f"{BASE_URL}/performances/{performance_id}/approvals", json=approval_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 提交消防审批: {result['message']}")
    else:
        print(f"✗ 提交审批失败: {response.text}")
    
    test_time = datetime.now() - timedelta(hours=2)
    test_data = {
        "test_time": test_time.isoformat(),
        "tester_name": "李明",
        "witness_name": "张华",
        "weather_condition": "晴，无风",
        "video_evidence_url": "https://example.com/test-video-001.mp4",
        "notes": "试放效果良好，无异常情况"
    }
    
    response = requests.post(f"{BASE_URL}/performances/{performance_id}/test-records", json=test_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 提交试放记录: {result['message']}")
    else:
        print(f"✗ 提交试放记录失败: {response.text}")
    
    props_data = [
        {
            "item_name": "冷焰火发射器",
            "quantity": 4,
            "safety_rating": "A级",
            "storage_location": "道具库A区",
            "handler": "道具组-刘强"
        },
        {
            "item_name": "烟花遥控器",
            "quantity": 2,
            "safety_rating": "B级",
            "storage_location": "道具库B区",
            "handler": "道具组-刘强"
        },
        {
            "item_name": "防火毯",
            "quantity": 6,
            "safety_rating": "A级",
            "storage_location": "舞台侧室",
            "handler": "道具组-王丽"
        }
    ]
    
    response = requests.post(f"{BASE_URL}/performances/{performance_id}/props", json=props_data)
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 提交道具清单: {result['message']}")
    else:
        print(f"✗ 提交道具清单失败: {response.text}")
    
    response = requests.get(f"{BASE_URL}/performances/{performance_id}/check")
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 规则判定结果: {'通过' if result['approved'] else '未通过'}")
        if result['violations']:
            print(f"  违规项: {result['violations']}")
        if result['warnings']:
            print(f"  警告项: {result['warnings']}")
    else:
        print(f"✗ 规则判定失败: {response.text}")
    
    print("\n造数完成！")
    print(f"演出ID: {performance_id}")
    print(f"API 文档: {BASE_URL}/docs")

if __name__ == "__main__":
    try:
        seed_data()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务: uvicorn app.main:app --reload")
