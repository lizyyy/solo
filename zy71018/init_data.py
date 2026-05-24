from datetime import date
from database import SessionLocal, init_db
import database as models


def init_sample_data():
    db = SessionLocal()
    try:
        print("初始化示例数据...")
        battery_types = [
            {"code": "LI-ION", "name": "锂离子电池", "description": "标准锂离子电池", "un_code": "UN3480", "packing_group": "II", "is_lithium": True, "watt_hour": "<=100Wh"},
            {"code": "LI-METAL", "name": "锂金属电池", "description": "锂金属原电池", "un_code": "UN3090", "packing_group": "II", "is_lithium": True, "watt_hour": "<=20Wh"},
            {"code": "PI965", "name": "PI965 锂电池包装", "description": "单独包装锂离子电池", "un_code": "UN3480", "packing_group": "II", "is_lithium": True, "watt_hour": "<=100Wh"},
            {"code": "PI966", "name": "PI966 与设备同装", "description": "锂离子电池与设备同包装", "un_code": "UN3481", "packing_group": "II", "is_lithium": True},
            {"code": "PI967", "name": "PI967 装在设备内", "description": "锂离子电池装在设备内", "un_code": "UN3481", "packing_group": "II", "is_lithium": True},
        ]
        for bt in battery_types:
            existing = db.query(models.BatteryType).filter_by(code=bt["code"]).first()
            if not existing:
                db.add(models.BatteryType(**bt))
        carriers = [
            {"code": "SF", "name": "顺丰国际", "contact_info": "电话: 95338"},
            {"code": "DHL", "name": "DHL 国际快递", "contact_info": "电话: 95380"},
            {"code": "UPS", "name": "UPS 国际", "contact_info": "电话: 400-820-8388"},
            {"code": "FEDEX", "name": "联邦快递", "contact_info": "电话: 800-988-1888"},
        ]
        for c in carriers:
            existing = db.query(models.Carrier).filter_by(code=c["code"]).first()
            if not existing:
                db.add(models.Carrier(**c))
        db.commit()
        sf_carrier = db.query(models.Carrier).filter_by(code="SF").first()
        dhl_carrier = db.query(models.Carrier).filter_by(code="DHL").first()
        today = date.today()
        carrier_rules = [
            {"carrier_id": sf_carrier.id if sf_carrier else 1, "rule_code": "SF-BAT-001", "rule_name": "顺丰锂电池运输规则", "description": "顺丰国际锂电池通用运输规则", "allowed_battery_types": "LI-ION, PI965, PI966, PI967", "max_watt_hour": "100Wh", "packaging_requirements": "需使用符合UN标准的包装", "effective_date": today},
            {"carrier_id": dhl_carrier.id if dhl_carrier else 2, "rule_code": "DHL-BAT-001", "rule_name": "DHL锂电池运输规则", "description": "DHL国际锂电池通用运输规则", "allowed_battery_types": "LI-ION, LI-METAL, PI965, PI966, PI967", "max_watt_hour": "160Wh", "packaging_requirements": "需提供MSDS报告", "effective_date": today},
        ]
        for r in carrier_rules:
            existing = db.query(models.CarrierRule).filter_by(rule_code=r["rule_code"]).first()
            if not existing:
                db.add(models.CarrierRule(**r))
        products = [
            {"sku": "PROD-001", "name": "无线蓝牙耳机", "description": "TWS真无线蓝牙耳机", "battery_type_code": "LI-ION", "battery_quantity": 2, "weight": "50g", "origin_country": "CN", "hs_code": "85176290"},
            {"sku": "PROD-002", "name": "移动电源", "description": "10000mAh移动电源", "battery_type_code": "LI-ION", "battery_quantity": 1, "weight": "200g", "origin_country": "CN", "hs_code": "85076000"},
            {"sku": "PROD-003", "name": "智能手表", "description": "多功能智能手表", "battery_type_code": "LI-ION", "battery_quantity": 1, "weight": "75g", "origin_country": "CN", "hs_code": "85171210"},
        ]
        for p in products:
            existing = db.query(models.Product).filter_by(sku=p["sku"]).first()
            if not existing:
                db.add(models.Product(**p))
        db.commit()
        print("示例数据初始化完成!")
    except Exception as e:
        print(f"初始化数据出错: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    init_sample_data()
