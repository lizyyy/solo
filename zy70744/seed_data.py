from database import init_db, SessionLocal, FeatureFlag
from datetime import datetime


def seed_feature_flags():
    db = SessionLocal()

    flags = [
        {
            "name": "new_ui_vip",
            "description": "VIP用户新版UI",
            "conditions": {
                "user_group": "vip",
                "login_days": {"operator": "gte", "value": 30}
            },
            "priority": 100,
            "user_group": "vip"
        },
        {
            "name": "new_ui_all",
            "description": "全体用户新版UI",
            "conditions": {
                "login_days": {"operator": "gte", "value": 7}
            },
            "priority": 50,
            "user_group": None
        },
        {
            "name": "promotion_a",
            "description": "促销活动A",
            "conditions": {
                "region": {"operator": "in", "value": ["北京", "上海"]},
                "user_level": {"operator": "gte", "value": 3}
            },
            "priority": 80,
            "user_group": None
        },
        {
            "name": "promotion_b",
            "description": "促销活动B",
            "conditions": {
                "region": "北京",
                "user_level": {"operator": "gte", "value": 5}
            },
            "priority": 90,
            "user_group": None
        },
        {
            "name": "beta_feature",
            "description": "Beta测试功能",
            "conditions": {
                "is_beta_tester": True,
                "app_version": {"operator": "gte", "value": "2.0.0"}
            },
            "priority": 75,
            "user_group": "beta"
        }
    ]

    for flag_data in flags:
        existing = db.query(FeatureFlag).filter(FeatureFlag.name == flag_data["name"]).first()
        if not existing:
            db_flag = FeatureFlag(**flag_data)
            db.add(db_flag)
            print(f"Created flag: {flag_data['name']}")
        else:
            print(f"Flag already exists: {flag_data['name']}")

    db.commit()
    db.close()
    print("Seeding completed!")


if __name__ == "__main__":
    init_db()
    seed_feature_flags()
