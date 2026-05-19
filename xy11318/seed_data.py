import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

sample_anomalies = [
    {
        "bus_id": "BUS001",
        "driver_id": "DRV001",
        "driver_name": "张三",
        "route_name": "阳光花园线",
        "scheduled_time": (datetime.now() - timedelta(hours=2)).isoformat(),
        "actual_time": (datetime.now() - timedelta(hours=2, minutes=15)).isoformat(),
        "anomaly_type": "traffic_delay",
        "responsible_person": "李调度",
        "notes": "早高峰堵车，GPS轨迹显示车辆在主干道停留20分钟"
    },
    {
        "bus_id": "BUS002",
        "driver_id": "DRV002",
        "driver_name": "李四",
        "route_name": "幸福小区线",
        "scheduled_time": (datetime.now() - timedelta(hours=1, minutes=30)).isoformat(),
        "actual_time": (datetime.now() - timedelta(hours=1)).isoformat(),
        "anomaly_type": "driver_late",
        "responsible_person": "王主管",
        "notes": "司机打卡晚到30分钟，GPS显示车辆未按时出库"
    },
    {
        "bus_id": "BUS003",
        "driver_id": "DRV003",
        "driver_name": "王五",
        "route_name": "和平路沿线",
        "scheduled_time": (datetime.now() - timedelta(hours=1)).isoformat(),
        "actual_time": (datetime.now() - timedelta(minutes=55)).isoformat(),
        "anomaly_type": "gps_mismatch",
        "responsible_person": "李调度",
        "notes": "GPS轨迹与规划路线偏差500米，家长投诉3起"
    },
    {
        "bus_id": "BUS001",
        "driver_id": "DRV001",
        "driver_name": "张三",
        "route_name": "阳光花园线",
        "scheduled_time": (datetime.now() - timedelta(days=1, hours=2)).isoformat(),
        "actual_time": (datetime.now() - timedelta(days=1, hours=1, minutes=45)).isoformat(),
        "anomaly_type": "traffic_delay",
        "responsible_person": "李调度",
        "notes": "昨日晚高峰同样路段堵车"
    },
    {
        "bus_id": "BUS004",
        "driver_id": "DRV004",
        "driver_name": "赵六",
        "route_name": "新城快线",
        "scheduled_time": (datetime.now() - timedelta(days=2)).isoformat(),
        "actual_time": (datetime.now() - timedelta(days=2, minutes=40)).isoformat(),
        "anomaly_type": "breakdown",
        "responsible_person": "王主管",
        "notes": "车辆故障，已安排救援车接驳"
    },
    {
        "bus_id": "BUS005",
        "driver_id": "DRV005",
        "driver_name": "钱七",
        "route_name": "老城区环线",
        "scheduled_time": (datetime.now() - timedelta(hours=3)).isoformat(),
        "actual_time": (datetime.now() - timedelta(hours=2, minutes=50)).isoformat(),
        "anomaly_type": "driver_late",
        "responsible_person": "张队长",
        "notes": "司机临时请假，替班司机到位延迟"
    }
]

def seed_data():
    print("开始导入示例数据...")
    
    response = requests.post(f"{BASE_URL}/api/anomalies/batch/", json=sample_anomalies)
    
    if response.status_code == 200:
        result = response.json()
        print(f"导入成功: {result['success_count']} 条")
        print(f"导入失败: {result['failure_count']} 条")
        if result['successful_ids']:
            print(f"成功的异常ID: {', '.join(result['successful_ids'])}")
        if result['errors']:
            print(f"错误信息: {result['errors']}")
    else:
        print(f"请求失败: {response.status_code}")
        print(response.text)
    
    print("\n获取数据摘要:")
    summary = requests.get(f"{BASE_URL}/api/anomalies/summary")
    print(json.dumps(summary.json(), indent=2, ensure_ascii=False))

if __name__ == "__main__":
    seed_data()
