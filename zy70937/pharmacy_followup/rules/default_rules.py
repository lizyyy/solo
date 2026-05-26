from sqlalchemy.orm import Session
from models import FollowupRule


DEFAULT_RULES = [
    {
        "rule_id": "RULE_HYPERTENSION_30",
        "rule_type": "interval",
        "disease_type": "高血压",
        "drug_name": "",
        "interval_days": 30,
        "forbidden_drugs": None,
        "description": "高血压患者每30天随访一次",
    },
    {
        "rule_id": "RULE_DIABETES_30",
        "rule_type": "interval",
        "disease_type": "糖尿病",
        "drug_name": "",
        "interval_days": 30,
        "forbidden_drugs": None,
        "description": "糖尿病患者每30天随访一次",
    },
    {
        "rule_id": "RULE_HYPERLIPIDEMIA_60",
        "rule_type": "interval",
        "disease_type": "高血脂",
        "drug_name": "",
        "interval_days": 60,
        "forbidden_drugs": None,
        "description": "高血脂患者每60天随访一次",
    },
    {
        "rule_id": "RULE_HYPERTENSION_FORBIDDEN",
        "rule_type": "forbidden",
        "disease_type": "高血压",
        "drug_name": "",
        "interval_days": None,
        "forbidden_drugs": ["甘草", "人参", "糖皮质激素"],
        "description": "高血压患者禁用药物",
    },
    {
        "rule_id": "RULE_DIABETES_FORBIDDEN",
        "rule_type": "forbidden",
        "disease_type": "糖尿病",
        "drug_name": "",
        "interval_days": None,
        "forbidden_drugs": ["糖浆", "蜜炼", "糖衣"],
        "description": "糖尿病患者禁用药物",
    },
    {
        "rule_id": "RULE_INSULIN_15",
        "rule_type": "interval",
        "disease_type": "糖尿病",
        "drug_name": "胰岛素",
        "interval_days": 15,
        "forbidden_drugs": None,
        "description": "胰岛素使用者每15天随访一次",
    },
]


def init_default_rules(db: Session):
    for rule_data in DEFAULT_RULES:
        existing = db.query(FollowupRule).filter(FollowupRule.rule_id == rule_data["rule_id"]).first()
        if not existing:
            rule = FollowupRule(**rule_data)
            db.add(rule)
    db.commit()
