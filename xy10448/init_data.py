import sys
sys.path.insert(0, '.')

from clinic_api.database import SessionLocal, engine
from clinic_api import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    supplies_data = [
        {"name": "一次性针灸针", "code": "ACU001", "unit": "支", "stock": 500, "safety_stock": 100, "cost_price": 0.5},
        {"name": "75%酒精棉球", "code": "ALC001", "unit": "个", "stock": 200, "safety_stock": 50, "cost_price": 0.3},
        {"name": "消毒棉签", "code": "COT001", "unit": "包", "stock": 100, "safety_stock": 20, "cost_price": 2.0},
        {"name": "无菌纱布", "code": "GAU001", "unit": "块", "stock": 50, "safety_stock": 10, "cost_price": 1.5},
        {"name": "碘伏消毒液", "code": "IOD001", "unit": "瓶", "stock": 30, "safety_stock": 5, "cost_price": 8.0},
        {"name": "一次性注射器", "code": "SYR001", "unit": "支", "stock": 150, "safety_stock": 30, "cost_price": 1.2},
        {"name": "雾化面罩", "code": "NEB001", "unit": "个", "stock": 30, "safety_stock": 5, "cost_price": 15.0},
        {"name": "生理盐水", "code": "SAL001", "unit": "瓶", "stock": 10, "safety_stock": 3, "cost_price": 5.0},
        {"name": "胶带", "code": "TAP001", "unit": "卷", "stock": 0, "safety_stock": 5, "cost_price": 3.0}
    ]

    for s in supplies_data:
        existing = db.query(models.Supply).filter(models.Supply.code == s["code"]).first()
        if not existing:
            db.add(models.Supply(**s))

    treatments_data = [
        {"name": "针灸治疗", "code": "TRT001", "price": 80.0, "description": "常规针灸治疗服务", "is_active": True},
        {"name": "伤口换药", "code": "TRT002", "price": 50.0, "description": "伤口清创换药服务", "is_active": True},
        {"name": "雾化吸入", "code": "TRT003", "price": 35.0, "description": "呼吸道雾化治疗", "is_active": True}
    ]

    for t in treatments_data:
        existing = db.query(models.TreatmentItem).filter(models.TreatmentItem.code == t["code"]).first()
        if not existing:
            db.add(models.TreatmentItem(**t))

    db.commit()

    treatment_map = {}
    for t in db.query(models.TreatmentItem).all():
        treatment_map[t.code] = t.id

    supply_map = {}
    for s in db.query(models.Supply).all():
        supply_map[s.code] = s.id

    templates_data = [
        {"treatment_code": "TRT001", "supply_code": "ACU001", "quantity": 10, "description": "针灸针"},
        {"treatment_code": "TRT001", "supply_code": "ALC001", "quantity": 5, "description": "消毒棉球"},
        {"treatment_code": "TRT001", "supply_code": "COT001", "quantity": 1, "description": "棉签"},

        {"treatment_code": "TRT002", "supply_code": "ALC001", "quantity": 8, "description": "消毒棉球"},
        {"treatment_code": "TRT002", "supply_code": "GAU001", "quantity": 2, "description": "纱布"},
        {"treatment_code": "TRT002", "supply_code": "IOD001", "quantity": 0.1, "description": "碘伏"},
        {"treatment_code": "TRT002", "supply_code": "TAP001", "quantity": 0.5, "description": "胶带"},

        {"treatment_code": "TRT003", "supply_code": "NEB001", "quantity": 1, "description": "雾化面罩"},
        {"treatment_code": "TRT003", "supply_code": "SAL001", "quantity": 1, "description": "生理盐水"},
    ]

    for tmpl in templates_data:
        existing = db.query(models.SupplyTemplate).filter(
            models.SupplyTemplate.treatment_item_id == treatment_map[tmpl["treatment_code"]],
            models.SupplyTemplate.supply_id == supply_map[tmpl["supply_code"]]
        ).first()
        if not existing:
            db.add(models.SupplyTemplate(
                treatment_item_id=treatment_map[tmpl["treatment_code"]],
                supply_id=supply_map[tmpl["supply_code"]],
                quantity=tmpl["quantity"],
                description=tmpl["description"]
            ))

    patients_data = [
        {"name": "张三", "phone": "13800138001", "id_card": "110101199001011234"},
        {"name": "李四", "phone": "13800138002"},
        {"name": "王五", "phone": "13800138003"}
    ]

    for p in patients_data:
        existing = db.query(models.Patient).filter(models.Patient.phone == p["phone"]).first()
        if not existing:
            db.add(models.Patient(**p))

    db.commit()
    print("样例数据初始化完成！")

finally:
    db.close()
