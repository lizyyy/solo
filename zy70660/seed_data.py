from datetime import datetime, timedelta
from database import SessionLocal, init_db, Employee, DoorArea, AccessLog, Whitelist


def seed_all():
    init_db()
    db = SessionLocal()

    try:
        print("Creating door areas...")
        door_areas = [
            {"name": "A座1楼大门", "building": "A座", "floor": "1楼"},
            {"name": "A座2楼门禁", "building": "A座", "floor": "2楼"},
            {"name": "B座1楼大门", "building": "B座", "floor": "1楼"},
            {"name": "B座3楼门禁", "building": "B座", "floor": "3楼"},
            {"name": "C座地下停车场", "building": "C座", "floor": "B1"},
        ]

        for da in door_areas:
            db.add(DoorArea(**da))
        db.commit()

        print("Creating employees...")
        employees = [
            {"employee_id": "EMP001", "name": "张三", "department": "技术部", "position": "工程师", "card_number": "CARD001"},
            {"employee_id": "EMP002", "name": "李四", "department": "市场部", "position": "经理", "card_number": "CARD002"},
            {"employee_id": "EMP003", "name": "王五", "department": "人事部", "position": "主管", "card_number": "CARD003"},
            {"employee_id": "EMP004", "name": "赵六", "department": "财务部", "position": "会计", "card_number": "CARD004"},
            {"employee_id": "EMP005", "name": "钱七", "department": "安保部", "position": "保安", "card_number": "CARD005"},
        ]

        for emp in employees:
            db.add(Employee(**emp))
        db.commit()

        print("Creating whitelist...")
        whitelist = Whitelist(
            card_number="CARD005",
            employee_id="EMP005",
            reason="安保人员需要巡逻不同区域",
            created_by="system"
        )
        db.add(whitelist)
        db.commit()

        print("Creating access logs with anomalies...")
        base_time = datetime(2024, 5, 15, 8, 0, 0)

        door_area_ids = [da.id for da in db.query(DoorArea).all()]
        card_numbers = ["CARD001", "CARD002", "CARD003", "CARD004", "CARD005"]

        normal_logs = []
        for i, card in enumerate(card_numbers):
            for j in range(5):
                swipe_time = base_time + timedelta(hours=i, minutes=j * 10)
                normal_logs.append({
                    "card_number": card,
                    "door_area_id": door_area_ids[i % len(door_area_ids)],
                    "swipe_time": swipe_time,
                    "access_type": "entry",
                    "original_data": f"Normal log {card}-{j}"
                })

        anomaly_logs = []

        anomaly_card = "CARD001"
        anomaly_time = base_time + timedelta(hours=10, minutes=0)
        anomaly_logs.append({
            "card_number": anomaly_card,
            "door_area_id": door_area_ids[0],
            "swipe_time": anomaly_time,
            "access_type": "entry",
            "original_data": "Anomaly log 1"
        })
        anomaly_logs.append({
            "card_number": anomaly_card,
            "door_area_id": door_area_ids[2],
            "swipe_time": anomaly_time + timedelta(minutes=5),
            "access_type": "entry",
            "original_data": "Anomaly log 2 - same card different building in 5 min"
        })

        anomaly_card2 = "CARD002"
        anomaly_time2 = base_time + timedelta(hours=11, minutes=30)
        anomaly_logs.append({
            "card_number": anomaly_card2,
            "door_area_id": door_area_ids[1],
            "swipe_time": anomaly_time2,
            "access_type": "entry",
            "original_data": "Anomaly log 3"
        })
        anomaly_logs.append({
            "card_number": anomaly_card2,
            "door_area_id": door_area_ids[4],
            "swipe_time": anomaly_time2 + timedelta(minutes=15),
            "access_type": "entry",
            "original_data": "Anomaly log 4 - same card different floor in 15 min"
        })

        whitelist_card = "CARD005"
        whitelist_time = base_time + timedelta(hours=12, minutes=0)
        anomaly_logs.append({
            "card_number": whitelist_card,
            "door_area_id": door_area_ids[0],
            "swipe_time": whitelist_time,
            "access_type": "entry",
            "original_data": "Whitelist log 1"
        })
        anomaly_logs.append({
            "card_number": whitelist_card,
            "door_area_id": door_area_ids[2],
            "swipe_time": whitelist_time + timedelta(minutes=3),
            "access_type": "entry",
            "original_data": "Whitelist log 2 - should NOT be anomaly due to whitelist"
        })

        all_logs = normal_logs + anomaly_logs
        for log in all_logs:
            db.add(AccessLog(**log))
        db.commit()

        print(f"Created {len(door_areas)} door areas")
        print(f"Created {len(employees)} employees")
        print(f"Created 1 whitelist entry")
        print(f"Created {len(all_logs)} access logs")
        print("\nExpected anomalies:")
        print("- CARD001: A座1楼大门 -> B座1楼大门 in 5 minutes")
        print("- CARD002: A座2楼门禁 -> C座地下停车场 in 15 minutes")
        print("- CARD005: No anomaly due to whitelist")
        print("\nData seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
