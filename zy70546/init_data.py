#!/usr/bin/env python3
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, BloodlineSubscription, SubscriptionStatus
import json

def init_subscriptions():
    db = SessionLocal()
    try:
        subscriptions = [
            {
                "team_name": "财务报表团队",
                "contact_person": "张三",
                "contact_email": "zhangsan@company.com",
                "field_name_pattern": "*amount*",
                "upstream_table_pattern": "ods.*finance*",
                "downstream_report_pattern": "rpt_finance_*",
                "notify_channels": {"email": True, "dingtalk": True}
            },
            {
                "team_name": "用户分析团队",
                "contact_person": "李四",
                "contact_email": "lisi@company.com",
                "field_name_pattern": "user_*",
                "upstream_table_pattern": "dwd.*user*",
                "downstream_report_pattern": "rpt_user_*",
                "notify_channels": {"email": True, "wechat": True}
            },
            {
                "team_name": "运营数据团队",
                "contact_person": "王五",
                "contact_email": "wangwu@company.com",
                "field_name_pattern": "*order*",
                "upstream_table_pattern": "dws.*order*",
                "downstream_report_pattern": "rpt_operation_*",
                "notify_channels": {"email": True}
            }
        ]
        
        for sub_data in subscriptions:
            existing = db.query(BloodlineSubscription).filter(
                BloodlineSubscription.team_name == sub_data["team_name"]
            ).first()
            if not existing:
                sub = BloodlineSubscription(
                    **sub_data,
                    status=SubscriptionStatus.ACTIVE
                )
                db.add(sub)
        
        db.commit()
        print("订阅数据初始化完成！")
        
        all_subs = db.query(BloodlineSubscription).all()
        print(f"当前共有 {len(all_subs)} 个订阅:")
        for sub in all_subs:
            print(f"  - {sub.team_name}: {sub.field_name_pattern}")
            
    except Exception as e:
        print(f"初始化失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    init_subscriptions()
