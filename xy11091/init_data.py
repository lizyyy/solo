from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, SessionLocal
from models import Medicine, Inventory, DoctorOrder, InventoryCheck, InventoryCheckDetail


def init_sample_data():
    db = SessionLocal()
    try:
        medicines = [
            {
                "medicine_code": "MED001",
                "medicine_name": "硝苯地平控释片",
                "generic_name": "Nifedipine Controlled-release Tablets",
                "specification": "30mg*7片/盒",
                "dosage_form": "片剂",
                "manufacturer": "拜耳医药保健有限公司",
                "batch_number": "BH202401001",
                "expiry_date": datetime.utcnow() + timedelta(days=365),
                "storage_condition": "遮光，密封保存",
                "category": "心血管系统用药"
            },
            {
                "medicine_code": "MED002",
                "medicine_name": "盐酸二甲双胍片",
                "generic_name": "Metformin Hydrochloride Tablets",
                "specification": "0.5g*30片/瓶",
                "dosage_form": "片剂",
                "manufacturer": "中美上海施贵宝制药有限公司",
                "batch_number": "BH202401002",
                "expiry_date": datetime.utcnow() + timedelta(days=540),
                "storage_condition": "密封保存",
                "category": "糖尿病用药"
            },
            {
                "medicine_code": "MED003",
                "medicine_name": "阿司匹林肠溶片",
                "generic_name": "Aspirin Enteric-coated Tablets",
                "specification": "100mg*30片/盒",
                "dosage_form": "片剂",
                "manufacturer": "拜耳医药保健有限公司",
                "batch_number": "BH202401003",
                "expiry_date": datetime.utcnow() + timedelta(days=720),
                "storage_condition": "遮光，密封保存",
                "category": "解热镇痛抗炎药"
            },
            {
                "medicine_code": "MED004",
                "medicine_name": "阿托伐他汀钙片",
                "generic_name": "Atorvastatin Calcium Tablets",
                "specification": "20mg*7片/盒",
                "dosage_form": "片剂",
                "manufacturer": "辉瑞制药有限公司",
                "batch_number": "BH202401004",
                "expiry_date": datetime.utcnow() + timedelta(days=450),
                "storage_condition": "遮光，密封保存",
                "category": "调节血脂药"
            },
            {
                "medicine_code": "MED005",
                "medicine_name": "奥美拉唑肠溶胶囊",
                "generic_name": "Omeprazole Enteric Capsules",
                "specification": "20mg*14粒/瓶",
                "dosage_form": "胶囊剂",
                "manufacturer": "阿斯利康制药有限公司",
                "batch_number": "BH202401005",
                "expiry_date": datetime.utcnow() + timedelta(days=600),
                "storage_condition": "遮光，密封保存",
                "category": "消化系统用药"
            }
        ]

        created_medicines = []
        for med_data in medicines:
            med = Medicine(**med_data)
            db.add(med)
            db.flush()
            created_medicines.append(med)

        inventories = [
            {"medicine_id": created_medicines[0].id, "quantity": 50, "unit": "盒", "location": "A区-01架-01层"},
            {"medicine_id": created_medicines[1].id, "quantity": 35, "unit": "瓶", "location": "A区-01架-02层"},
            {"medicine_id": created_medicines[2].id, "quantity": 80, "unit": "盒", "location": "A区-02架-01层"},
            {"medicine_id": created_medicines[3].id, "quantity": 45, "unit": "盒", "location": "A区-02架-02层"},
            {"medicine_id": created_medicines[4].id, "quantity": 60, "unit": "瓶", "location": "B区-01架-01层"}
        ]

        for inv_data in inventories:
            inv = Inventory(**inv_data)
            db.add(inv)

        orders = [
            {
                "order_no": "ORD202401001",
                "elderly_name": "张三",
                "elderly_id_card": "110101194001011234",
                "room_number": "101室",
                "medicine_id": created_medicines[0].id,
                "medicine_name": "硝苯地平控释片",
                "dosage": "30mg",
                "frequency": "每日一次",
                "start_date": datetime.utcnow() - timedelta(days=30),
                "is_stopped": False,
                "inventory_synced": True,
                "created_by": "李医生"
            },
            {
                "order_no": "ORD202401002",
                "elderly_name": "李四",
                "elderly_id_card": "110101194502025678",
                "room_number": "102室",
                "medicine_id": created_medicines[1].id,
                "medicine_name": "盐酸二甲双胍片",
                "dosage": "0.5g",
                "frequency": "每日两次",
                "start_date": datetime.utcnow() - timedelta(days=15),
                "is_stopped": False,
                "inventory_synced": True,
                "created_by": "王医生"
            },
            {
                "order_no": "ORD202401003",
                "elderly_name": "王五",
                "elderly_id_card": "110101193803039012",
                "room_number": "201室",
                "medicine_id": created_medicines[2].id,
                "medicine_name": "阿司匹林肠溶片",
                "dosage": "100mg",
                "frequency": "每日一次",
                "start_date": datetime.utcnow() - timedelta(days=60),
                "is_stopped": True,
                "stopped_at": datetime.utcnow() - timedelta(days=5),
                "stopped_by": "赵主任",
                "stop_reason": "患者出现胃肠道不适",
                "inventory_synced": False,
                "created_by": "李医生"
            }
        ]

        for order_data in orders:
            order = DoctorOrder(**order_data)
            db.add(order)

        db.commit()
        print("样本数据初始化完成！")
        print(f"药品数量: {len(created_medicines)}")
        print(f"库存记录: {len(inventories)}")
        print(f"医嘱记录: {len(orders)}")

    except Exception as e:
        db.rollback()
        print(f"数据初始化失败: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
