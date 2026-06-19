import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime
from src import db
from src.services import persistent_service

TASK_ID = "DEMO-001"

TRAJECTORY_DATA = [
    {"point_id": "tp001", "timestamp": "2026-06-15T08:00:00", "latitude": 39.90420, "longitude": 116.40740, "altitude": 43.5, "speed": 2.5, "heading": 90.0},
    {"point_id": "tp002", "timestamp": "2026-06-15T08:00:30", "latitude": 39.90425, "longitude": 116.40745, "altitude": 43.6, "speed": 2.6, "heading": 92.0},
    {"point_id": "tp003", "timestamp": "2026-06-15T08:01:00", "latitude": 39.90430, "longitude": 116.40750, "altitude": 43.4, "speed": 2.4, "heading": 88.0},
    {"point_id": "tp004", "timestamp": "2026-06-15T08:01:30", "latitude": 39.90435, "longitude": 116.40755, "altitude": 43.7, "speed": 2.7, "heading": 91.0},
    {"point_id": "tp005", "timestamp": "2026-06-15T08:02:00", "latitude": 39.90440, "longitude": 116.40760, "altitude": 43.5, "speed": 2.5, "heading": 90.0},
    {"point_id": "tp006", "timestamp": "2026-06-15T08:02:30", "latitude": 39.90445, "longitude": 116.40765, "altitude": 43.6, "speed": 2.3, "heading": 89.0},
    {"point_id": "tp007", "timestamp": "2026-06-15T08:03:00", "latitude": 39.90450, "longitude": 116.40770, "altitude": 43.8, "speed": 2.6, "heading": 91.0},
    {"point_id": "tp008", "timestamp": "2026-06-15T08:03:30", "latitude": 39.90455, "longitude": 116.40775, "altitude": 43.4, "speed": 2.8, "heading": 90.0},
]

RANGEFINDER_BATCH_1 = [
    {
        "obstacle_name": "电线杆", "obstacle_type": "utility_pole",
        "distance": 12.5, "angle": 35.0,
        "latitude": 39.90425, "longitude": 116.40745, "altitude": 45.0,
        "raw_conclusion": "正常通过，不影响作业", "confidence": 0.92
    },
    {
        "obstacle_name": "大树", "obstacle_type": "tree",
        "distance": 8.3, "angle": -15.0,
        "latitude": 39.90435, "longitude": 116.40755, "altitude": 48.0,
        "raw_conclusion": "需要绕行", "confidence": 0.88
    },
    {
        "obstacle_name": "电杆", "obstacle_type": "utility_pole",
        "distance": 12.4, "angle": 34.8,
        "latitude": 39.90426, "longitude": 116.40746, "altitude": 45.1,
        "raw_conclusion": "正常通过，不影响作业", "confidence": 0.91
    },
    {
        "obstacle_name": "灌溉井", "obstacle_type": "well",
        "distance": 5.2, "angle": -45.0,
        "latitude": 39.90450, "longitude": 116.40770, "altitude": 43.0,
        "raw_conclusion": "正常通过，不影响作业", "confidence": 0.85
    }
]


def seed():
    db.init_db()
    persistent_service.init_task(TASK_ID)

    db.TrajectoryPointRepo.save_batch(TASK_ID, TRAJECTORY_DATA)
    print(f"已写入{len(TRAJECTORY_DATA)}个轨迹点")

    result = persistent_service.import_rangefinder(
        TASK_ID, RANGEFINDER_BATCH_1, "BATCH-20260615-001", "laoliang"
    )
    print(f"已导入测距仪记录，版本v{result['version']}")
    print(f"自检: {result['self_check']['overall_passed']}")
    print(f"待处理决策: {len(result['pending_decisions'])}项")
    for c in result['self_check']['checks']:
        status = "✅" if c['passed'] else "❌"
        print(f"  {status} {c['check_name']}: {c['message']}")

    print(f"\n样例数据已写入SQLite，任务ID: {TASK_ID}")
    print("启动应用: python3 -m uvicorn src.app:app --reload --port 8000")
    print("打开浏览器: http://localhost:8000")


if __name__ == "__main__":
    seed()
