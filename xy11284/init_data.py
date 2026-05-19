from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from database import engine, Medicine, Inventory, Contraindication, init_db


def create_test_data():
    init_db()
    
    db = Session(bind=engine)
    
    try:
        medicines = [
            {
                "name": "阿莫西林片剂",
                "generic_name": "Amoxicillin",
                "manufacturer": "兽药集团",
                "dosage_form": "片剂",
                "concentration": "250mg/片",
                "min_dose_per_kg": 10,
                "max_dose_per_kg": 20,
                "dose_unit": "mg",
                "species": "犬,猫",
                "contraindications": "对青霉素过敏者禁用"
            },
            {
                "name": "头孢氨苄胶囊",
                "generic_name": "Cefalexin",
                "manufacturer": "动物药业",
                "dosage_form": "胶囊",
                "concentration": "500mg/粒",
                "min_dose_per_kg": 15,
                "max_dose_per_kg": 30,
                "dose_unit": "mg",
                "species": "犬,猫",
                "contraindications": "肾功能不全者慎用"
            },
            {
                "name": "布洛芬片",
                "generic_name": "Ibuprofen",
                "manufacturer": "制药公司",
                "dosage_form": "片剂",
                "concentration": "100mg/片",
                "min_dose_per_kg": 5,
                "max_dose_per_kg": 10,
                "dose_unit": "mg",
                "species": "犬",
                "contraindications": "猫禁用"
            },
            {
                "name": "庆大霉素注射液",
                "generic_name": "Gentamicin",
                "manufacturer": "生物制药",
                "dosage_form": "注射液",
                "concentration": "20mg/ml",
                "min_dose_per_kg": 2,
                "max_dose_per_kg": 5,
                "dose_unit": "mg",
                "species": "犬,猫",
                "contraindications": "肾功能损伤者禁用"
            }
        ]
        
        created_medicines = []
        for med_data in medicines:
            med = Medicine(**med_data)
            db.add(med)
            db.flush()
            created_medicines.append(med)
            print(f"创建药品: {med.name} (ID: {med.id})")
        
        expiry_future = datetime.utcnow() + timedelta(days=365)
        expiry_soon = datetime.utcnow() + timedelta(days=20)
        
        inventory_items = [
            {"medicine_id": created_medicines[0].id, "batch_number": "AMX-2024-001", "quantity": 500, "unit": "片", "expiry_date": expiry_future, "location": "A-01-01"},
            {"medicine_id": created_medicines[0].id, "batch_number": "AMX-2024-002", "quantity": 50, "unit": "片", "expiry_date": expiry_soon, "location": "A-01-02"},
            {"medicine_id": created_medicines[1].id, "batch_number": "CEF-2024-001", "quantity": 300, "unit": "粒", "expiry_date": expiry_future, "location": "A-02-01"},
            {"medicine_id": created_medicines[2].id, "batch_number": "IBU-2024-001", "quantity": 200, "unit": "片", "expiry_date": expiry_future, "location": "B-01-01"},
            {"medicine_id": created_medicines[3].id, "batch_number": "GEN-2024-001", "quantity": 100, "unit": "支", "expiry_date": expiry_future, "location": "C-01-01"},
        ]
        
        for inv_data in inventory_items:
            inv = Inventory(**inv_data)
            db.add(inv)
            print(f"添加库存: {inv.batch_number}, 数量: {inv.quantity}{inv.unit}")
        
        contraindications = [
            {"medicine_a_id": created_medicines[0].id, "medicine_b_id": created_medicines[2].id, "description": "阿莫西林与布洛芬联用可能增加肾毒性风险", "severity": "warning"},
            {"medicine_a_id": created_medicines[2].id, "medicine_b_id": created_medicines[3].id, "description": "布洛芬与庆大霉素联用禁忌，可能导致严重肾损伤", "severity": "danger"}
        ]
        
        for contra_data in contraindications:
            contra = Contraindication(**contra_data)
            db.add(contra)
            print(f"添加禁忌: 药品 {contra_data['medicine_a_id']} & {contra_data['medicine_b_id']}")
        
        db.commit()
        print("\n测试数据创建成功！")
        print(f"共创建 {len(created_medicines)} 种药品")
        print(f"共添加 {len(inventory_items)} 条库存记录")
        print(f"共设置 {len(contraindications)} 组禁忌组合")
        
    except Exception as e:
        db.rollback()
        print(f"创建测试数据失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_test_data()
