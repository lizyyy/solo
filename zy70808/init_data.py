from database import SessionLocal, engine
import models
from datetime import date, timedelta
import uuid


def init_demo_data():
    db = SessionLocal()

    try:
        equipments = [
            {
                "equipment_code": "ELEV-001",
                "name": "1号客梯",
                "type": "电梯",
                "floor": "1-20层",
                "area": "A栋",
                "location": "A栋东侧",
                "installation_date": date(2020, 5, 15),
                "maintenance_person": "张三",
                "last_inspection_date": date(2026, 1, 10),
                "next_inspection_date": date(2026, 2, 10)
            },
            {
                "equipment_code": "ELEV-002",
                "name": "2号客梯",
                "type": "电梯",
                "floor": "1-20层",
                "area": "A栋",
                "location": "A栋西侧",
                "installation_date": date(2020, 5, 15),
                "maintenance_person": "张三",
                "last_inspection_date": date(2026, 1, 12),
                "next_inspection_date": date(2026, 5, 12)
            },
            {
                "equipment_code": "AC-001",
                "name": "中央空调主机",
                "type": "空调",
                "floor": "顶楼",
                "area": "B栋",
                "location": "B栋机房",
                "installation_date": date(2019, 8, 20),
                "maintenance_person": "李四",
                "last_inspection_date": date(2026, 1, 5),
                "next_inspection_date": date(2026, 4, 5)
            },
            {
                "equipment_code": "FIRE-001",
                "name": "消防水泵1号",
                "type": "消防设备",
                "floor": "地下1层",
                "area": "C栋",
                "location": "C栋消防泵房",
                "installation_date": date(2018, 3, 10),
                "maintenance_person": "王五",
                "last_inspection_date": date(2025, 12, 20),
                "next_inspection_date": date(2026, 3, 20)
            },
            {
                "equipment_code": "GEN-001",
                "name": "备用发电机",
                "type": "发电设备",
                "floor": "地下1层",
                "area": "C栋",
                "location": "C栋发电机房",
                "installation_date": date(2018, 4, 25),
                "maintenance_person": "赵六",
                "last_inspection_date": date(2026, 1, 18),
                "next_inspection_date": date(2026, 4, 18)
            }
        ]

        for eq_data in equipments:
            existing = db.query(models.Equipment).filter(
                models.Equipment.equipment_code == eq_data["equipment_code"]
            ).first()
            if not existing:
                eq = models.Equipment(**eq_data, status="normal")
                db.add(eq)

        db.commit()

        contracts = [
            {
                "contract_number": "CT-2026-001",
                "equipment_code": "ELEV-001",
                "vendor_name": "XX电梯维保有限公司",
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "contract_amount": 50000,
                "contact_person": "李经理",
                "contact_phone": "13800138001"
            },
            {
                "contract_number": "CT-2026-002",
                "equipment_code": "ELEV-001",
                "vendor_name": "YY电梯技术服务公司",
                "start_date": date(2026, 2, 1),
                "end_date": date(2026, 12, 31),
                "contract_amount": 48000,
                "contact_person": "王总监",
                "contact_phone": "13900139002"
            },
            {
                "contract_number": "CT-2026-003",
                "equipment_code": "ELEV-002",
                "vendor_name": "XX电梯维保有限公司",
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "contract_amount": 50000,
                "contact_person": "李经理",
                "contact_phone": "13800138001"
            },
            {
                "contract_number": "CT-2026-004",
                "equipment_code": "AC-001",
                "vendor_name": "ZZ空调维修服务部",
                "start_date": date(2026, 1, 1),
                "end_date": date(2026, 12, 31),
                "contract_amount": 35000,
                "contact_person": "张工",
                "contact_phone": "13700137003"
            }
        ]

        for ct_data in contracts:
            existing = db.query(models.Contract).filter(
                models.Contract.contract_number == ct_data["contract_number"]
            ).first()
            if not existing:
                equipment = db.query(models.Equipment).filter(
                    models.Equipment.equipment_code == ct_data["equipment_code"]
                ).first()
                ct = models.Contract(
                    **ct_data,
                    equipment_id=equipment.id if equipment else None,
                    status="active"
                )
                db.add(ct)

        db.commit()

        photos = [
            {
                "equipment_code": "ELEV-002",
                "file_name": "ELEV-002_20260112.jpg",
                "file_path": "/photos/ELEV-002_20260112.jpg",
                "inspection_date": date(2026, 1, 12),
                "photographer": "张三",
                "description": "2号客梯例行维保现场照片"
            },
            {
                "equipment_code": "AC-001",
                "file_name": "AC-001_20260105.jpg",
                "file_path": "/photos/AC-001_20260105.jpg",
                "inspection_date": date(2026, 1, 5),
                "photographer": "李四",
                "description": "中央空调主机维保照片"
            }
        ]

        for photo_data in photos:
            photo_code = f"PHOTO{date.today().strftime('%Y%m%d')}{uuid.uuid4().hex[:4].upper()}"
            equipment = db.query(models.Equipment).filter(
                models.Equipment.equipment_code == photo_data["equipment_code"]
            ).first()
            photo = models.InspectionPhoto(
                **photo_data,
                photo_code=photo_code,
                equipment_id=equipment.id if equipment else None
            )
            db.add(photo)

        db.commit()

        print("演示数据初始化完成！")
        print(f"已添加 {len(equipments)} 台设备")
        print(f"已添加 {len(contracts)} 份合同")
        print(f"已添加 {len(photos)} 张巡检照片")

    except Exception as e:
        print(f"初始化失败: {str(e)}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    models.Base.metadata.create_all(bind=engine)
    init_demo_data()
