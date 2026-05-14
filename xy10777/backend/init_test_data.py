from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.database import engine, Geofence, Device, DevicePosition, AlertEvent, NotificationStrategy, FalseAlarmFilter

def init_test_data():
    with Session(engine) as db:
        fence1_coords = [
            [116.397428, 39.90923],
            [116.407428, 39.90923],
            [116.407428, 39.91923],
            [116.397428, 39.91923],
            [116.397428, 39.90923]
        ]
        fence1 = Geofence(
            name="北京天安门广场围栏",
            description="天安门广场核心区域监控围栏",
            fence_type="polygon",
            coordinates=fence1_coords,
            is_active=True
        )
        db.add(fence1)

        fence2 = Geofence(
            name="北京国贸圆形围栏",
            description="国贸CBD区域监控",
            fence_type="circle",
            coordinates=[116.460942, 39.909239],
            radius=500,
            is_active=True
        )
        db.add(fence2)
        db.commit()
        db.refresh(fence1)
        db.refresh(fence2)

        device1 = Device(
            device_id="DEV-001",
            name="配送车辆A-京A12345",
            device_type="vehicle",
            is_active=True
        )
        device2 = Device(
            device_id="DEV-002",
            name="配送车辆B-京B67890",
            device_type="vehicle",
            is_active=True
        )
        device3 = Device(
            device_id="DEV-003",
            name="人员定位终端-张经理",
            device_type="person",
            is_active=True
        )
        db.add_all([device1, device2, device3])
        db.commit()
        db.refresh(device1)
        db.refresh(device2)
        db.refresh(device3)

        base_time = datetime(2024, 1, 15, 8, 0, 0)
        positions = []

        for i in range(30):
            offset = i * 60
            pos = DevicePosition(
                device_id=device1.id,
                latitude=39.90923 + (i * 0.0003),
                longitude=116.397428 + (i * 0.0003),
                speed=30 + i * 0.5,
                direction=90,
                accuracy=5 + i,
                timestamp=base_time + timedelta(seconds=offset),
                is_valid=True
            )
            positions.append(pos)

        positions[10].accuracy = 150
        positions[10].is_valid = False
        positions[20].latitude = 39.99999
        positions[20].longitude = 116.99999
        positions[20].is_valid = False

        for i in range(20):
            offset = i * 120
            pos = DevicePosition(
                device_id=device2.id,
                latitude=39.909239 + (i * 0.0002 - 0.002),
                longitude=116.460942 + (i * 0.0002 - 0.002),
                speed=25 + i * 0.3,
                direction=180,
                accuracy=3 + i,
                timestamp=base_time + timedelta(minutes=30) + timedelta(seconds=offset),
                is_valid=True
            )
            positions.append(pos)

        db.add_all(positions)
        db.commit()

        alerts = []

        alert1 = AlertEvent(
            geofence_id=fence1.id,
            device_id=device1.id,
            event_type="enter",
            timestamp=base_time + timedelta(minutes=5),
            position_id=positions[5].id,
            is_false_alarm=False,
            is_verified=False,
            confidence=0.95
        )
        alerts.append(alert1)

        alert2 = AlertEvent(
            geofence_id=fence1.id,
            device_id=device1.id,
            event_type="exit",
            timestamp=base_time + timedelta(minutes=15),
            position_id=positions[15].id,
            is_false_alarm=True,
            is_verified=True,
            verified_by="系统管理员",
            verified_at=base_time + timedelta(minutes=16),
            notes="GPS信号漂移导致误报，实际车辆未离开围栏",
            confidence=0.82
        )
        alerts.append(alert2)

        alert3 = AlertEvent(
            geofence_id=fence1.id,
            device_id=device1.id,
            event_type="enter",
            timestamp=base_time + timedelta(minutes=20),
            position_id=positions[20].id,
            is_false_alarm=True,
            is_verified=False,
            notes="异常点数据，待人工确认",
            confidence=0.45
        )
        alerts.append(alert3)

        alert4 = AlertEvent(
            geofence_id=fence2.id,
            device_id=device2.id,
            event_type="enter",
            timestamp=base_time + timedelta(minutes=40),
            position_id=positions[35].id,
            is_false_alarm=False,
            is_verified=False,
            confidence=0.98
        )
        alerts.append(alert4)

        alert5 = AlertEvent(
            geofence_id=fence2.id,
            device_id=device2.id,
            event_type="stay",
            timestamp=base_time + timedelta(minutes=50),
            position_id=positions[38].id,
            is_false_alarm=False,
            is_verified=True,
            verified_by="运维负责人",
            verified_at=base_time + timedelta(minutes=51),
            notes="正常停留，配送中",
            confidence=0.92
        )
        alerts.append(alert5)

        db.add_all(alerts)
        db.commit()

        strategy1 = NotificationStrategy(
            name="围栏1进出告警通知",
            geofence_id=fence1.id,
            event_types=["enter", "exit"],
            channels=["sms", "email", "app_push"],
            min_interval=300,
            confidence_threshold=0.8,
            is_active=True
        )
        strategy2 = NotificationStrategy(
            name="围栏2实时通知",
            geofence_id=fence2.id,
            event_types=["enter", "exit", "stay"],
            channels=["app_push"],
            min_interval=60,
            confidence_threshold=0.5,
            is_active=True
        )
        db.add_all([strategy1, strategy2])
        db.commit()

        filter1 = FalseAlarmFilter(
            name="精度过滤规则",
            filter_type="accuracy_threshold",
            parameters={"max_accuracy": 50},
            is_active=True,
            priority=10
        )
        filter2 = FalseAlarmFilter(
            name="速度异常过滤",
            filter_type="speed_threshold",
            parameters={"min_speed": 0, "max_speed": 120},
            is_active=True,
            priority=5
        )
        filter3 = FalseAlarmFilter(
            name="置信度过滤",
            filter_type="confidence_threshold",
            parameters={"min_confidence": 0.7},
            is_active=True,
            priority=8
        )
        db.add_all([filter1, filter2, filter3])
        db.commit()

        print("测试数据初始化完成！")
        print(f"- 围栏数量: {db.query(Geofence).count()}")
        print(f"- 设备数量: {db.query(Device).count()}")
        print(f"- 位置点数量: {db.query(DevicePosition).count()} (其中无效点: {db.query(DevicePosition).filter(DevicePosition.is_valid == False).count()})")
        print(f"- 告警数量: {db.query(AlertEvent).count()} (其中误报: {db.query(AlertEvent).filter(AlertEvent.is_false_alarm == True).count()})")
        print(f"- 通知策略数量: {db.query(NotificationStrategy).count()}")
        print(f"- 误报过滤器数量: {db.query(FalseAlarmFilter).count()}")

if __name__ == "__main__":
    init_test_data()