from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models.models import (
    Base, Forklift, ForkliftStatus, ChargingStation, 
    ChargingStationStatus, BatteryStatus, Task, TaskPriority
)

def init_demo_data():
    db = SessionLocal()
    
    try:
        print("清理现有数据...")
        db.execute(text("DELETE FROM audit_logs"))
        db.execute(text("DELETE FROM charging_queues"))
        db.execute(text("DELETE FROM charging_requests"))
        db.execute(text("DELETE FROM tasks"))
        db.execute(text("DELETE FROM battery_statuses"))
        db.execute(text("DELETE FROM charging_stations"))
        db.execute(text("DELETE FROM forklifts"))
        db.commit()

        print("创建叉车档案...")
        forklifts_data = [
            {"forklift_code": "FL-001", "name": "夜班叉车1号", "battery_capacity": 80.0, "min_operating_percent": 20.0, "charging_rate": 15.0},
            {"forklift_code": "FL-002", "name": "夜班叉车2号", "battery_capacity": 80.0, "min_operating_percent": 20.0, "charging_rate": 15.0},
            {"forklift_code": "FL-003", "name": "夜班叉车3号", "battery_capacity": 60.0, "min_operating_percent": 25.0, "charging_rate": 12.0},
            {"forklift_code": "FL-004", "name": "夜班叉车4号", "battery_capacity": 100.0, "min_operating_percent": 20.0, "charging_rate": 18.0},
            {"forklift_code": "FL-005", "name": "高优先级叉车", "battery_capacity": 80.0, "min_operating_percent": 30.0, "charging_rate": 15.0},
        ]

        forklifts = []
        for data in forklifts_data:
            forklift = Forklift(**data)
            db.add(forklift)
            db.flush()
            forklifts.append(forklift)

        print("创建电池状态...")
        battery_data = [
            (0, 35.0),
            (1, 18.0),
            (2, 45.0),
            (3, 22.0),
            (4, 15.0),
        ]

        for idx, current_percent in battery_data:
            battery = BatteryStatus(
                forklift_id=forklifts[idx].id,
                current_percent=current_percent
            )
            db.add(battery)

        print("创建充电位...")
        stations_data = [
            {"station_code": "CS-001", "name": "快充位1号", "charging_power": 50.0},
            {"station_code": "CS-002", "name": "快充位2号", "charging_power": 50.0},
            {"station_code": "CS-003", "name": "慢充位1号", "charging_power": 20.0},
            {"station_code": "CS-004", "name": "慢充位2号", "charging_power": 20.0},
        ]

        for data in stations_data:
            station = ChargingStation(**data)
            db.add(station)

        print("创建次日任务...")
        now = datetime.utcnow()
        tomorrow = now + timedelta(days=1)

        tasks_data = [
            {
                "task_code": "TASK-001",
                "forklift_idx": 4,
                "priority": TaskPriority.HIGH,
                "duration": 4.0,
                "required_percent": 80.0,
                "start_time": tomorrow.replace(hour=6, minute=0, second=0),
                "description": "紧急订单配送 - 高优先级"
            },
            {
                "task_code": "TASK-002",
                "forklift_idx": 0,
                "priority": TaskPriority.MEDIUM,
                "duration": 3.0,
                "required_percent": 70.0,
                "start_time": tomorrow.replace(hour=7, minute=0, second=0),
                "description": "常规货物搬运"
            },
            {
                "task_code": "TASK-003",
                "forklift_idx": 1,
                "priority": TaskPriority.MEDIUM,
                "duration": 5.0,
                "required_percent": 85.0,
                "start_time": tomorrow.replace(hour=8, minute=0, second=0),
                "description": "跨区调货"
            },
            {
                "task_code": "TASK-004",
                "forklift_idx": 2,
                "priority": TaskPriority.LOW,
                "duration": 2.0,
                "required_percent": 50.0,
                "start_time": tomorrow.replace(hour=9, minute=0, second=0),
                "description": "库存盘点"
            },
        ]

        for data in tasks_data:
            task = Task(
                task_code=data["task_code"],
                forklift_id=forklifts[data["forklift_idx"]].id,
                priority=data["priority"],
                estimated_duration_hours=data["duration"],
                required_battery_percent=data["required_percent"],
                scheduled_start_time=data["start_time"],
                scheduled_end_time=data["start_time"] + timedelta(hours=data["duration"]),
                description=data["description"]
            )
            db.add(task)

        db.commit()
        print("\n演示数据初始化完成！")
        print("\n=== 初始化数据概览 ===")
        print(f"叉车数量: {len(forklifts)}")
        print(f"充电位数量: {len(stations_data)}")
        print(f"任务数量: {len(tasks_data)}")
        
        print("\n=== 叉车电量状态 ===")
        for idx, forklift in enumerate(forklifts):
            print(f"  {forklift.forklift_code} ({forklift.name}): {battery_data[idx][1]}%")

        print("\n=== 任务安排 ===")
        for task in tasks_data:
            forklift = forklifts[task["forklift_idx"]]
            print(f"  {task['task_code']} - {forklift.forklift_code}: {task['priority'].value}优先级, 需要{task['required_percent']}%电量")

    except Exception as e:
        print(f"初始化失败: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    init_demo_data()
