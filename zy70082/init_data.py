from database import init_db, SessionLocal
from models import Material, ReviewRule, RejectReason


def init_sample_data():
    db = SessionLocal()
    
    try:
        materials = [
            {"name": "身份证复印件", "code": "ID-001", "category": "身份证明", "description": "申请人本人有效身份证复印件，需正反面", "required": "必填", "format": "纸质/电子版", "page_count": 1},
            {"name": "户口本复印件", "code": "HK-001", "category": "身份证明", "description": "户口本首页及本人页复印件", "required": "必填", "format": "纸质/电子版", "page_count": 2},
            {"name": "申请表", "code": "APP-001", "category": "申请文书", "description": "业务申请表，需本人签字", "required": "必填", "format": "纸质/电子版", "page_count": 3},
            {"name": "收入证明", "code": "INC-001", "category": "证明材料", "description": "单位出具的收入证明", "required": "选填", "format": "纸质/电子版", "page_count": 1},
            {"name": "居住证明", "code": "RES-001", "category": "证明材料", "description": "居住地社区或物业出具的居住证明", "required": "必填", "format": "纸质/电子版", "page_count": 1},
        ]
        
        for mat in materials:
            if not db.query(Material).filter(Material.code == mat["code"]).first():
                db.add(Material(**mat))
        
        rules = [
            {"material_code": "ID-001", "rule_name": "身份证有效期检查", "rule_type": "有效期", "rule_content": "检查身份证是否在有效期内，剩余有效期需大于30天", "priority": 1},
            {"material_code": "ID-001", "rule_name": "身份证信息一致性", "rule_type": "信息比对", "rule_content": "身份证姓名需与申请人姓名一致", "priority": 2},
            {"material_code": "APP-001", "rule_name": "申请表完整性", "rule_type": "完整性", "rule_content": "申请表所有必填项必须填写完整", "priority": 1},
            {"material_code": "APP-001", "rule_name": "签字确认", "rule_type": "签字检查", "rule_content": "申请表必须有申请人签字确认", "priority": 2},
            {"material_code": "RES-001", "rule_name": "居住证明有效期", "rule_type": "有效期", "rule_content": "居住证明开具日期需在3个月内", "priority": 1},
        ]
        
        for rule in rules:
            material = db.query(Material).filter(Material.code == rule["material_code"]).first()
            if material:
                exists = db.query(ReviewRule).filter(
                    ReviewRule.material_id == material.id,
                    ReviewRule.rule_name == rule["rule_name"]
                ).first()
                if not exists:
                    db.add(ReviewRule(
                        material_id=material.id,
                        rule_name=rule["rule_name"],
                        rule_type=rule["rule_type"],
                        rule_content=rule["rule_content"],
                        priority=rule["priority"]
                    ))
        
        reject_reasons = [
            {"code": "R001", "name": "材料不完整", "description": "申请材料不完整，缺少必要的申请材料", "category": "材料问题"},
            {"code": "R002", "name": "材料信息不一致", "description": "材料信息与系统信息或其他材料信息不一致", "category": "信息问题"},
            {"code": "R003", "name": "材料过期", "description": "提供的证明材料已过有效期", "category": "有效期问题"},
            {"code": "R004", "name": "材料不清晰", "description": "提交的材料复印件或扫描件不清晰，无法辨认", "category": "质量问题"},
            {"code": "R005", "name": "材料不符合规范", "description": "材料格式、规格不符合办理规范要求", "category": "规范问题"},
            {"code": "R006", "name": "不符合申请条件", "description": "申请人不符合该业务的申请条件", "category": "资格问题"},
        ]
        
        for reason in reject_reasons:
            if not db.query(RejectReason).filter(RejectReason.code == reason["code"]).first():
                db.add(RejectReason(**reason))
        
        db.commit()
        print("示例数据初始化完成！")
        
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    init_sample_data()
