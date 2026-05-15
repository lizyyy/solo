from sqlalchemy.orm import Session
from . import models, schemas, services
import random
from datetime import datetime, timedelta


def create_demo_data(db: Session):
    existing_flags = db.query(models.FeatureFlag).count()
    if existing_flags > 0:
        return
    
    flags_data = [
        {
            "name": "新支付系统",
            "key": "payment_system_v2",
            "description": "新一代支付系统灰度开关",
            "enabled": True,
            "status": "active",
            "gray_rules": [
                {
                    "rule_type": "percentage",
                    "percentage": 30.0,
                    "user_ids": [],
                    "user_groups": ["beta_testers"],
                    "regions": ["北京", "上海"],
                    "conditions": {}
                }
            ]
        },
        {
            "name": "AI推荐算法",
            "key": "ai_recommendation",
            "description": "基于机器学习的推荐算法",
            "enabled": True,
            "status": "active",
            "gray_rules": [
                {
                    "rule_type": "whitelist",
                    "percentage": 0,
                    "user_ids": ["user_001", "user_002", "user_003"],
                    "user_groups": [],
                    "regions": [],
                    "conditions": {}
                }
            ]
        },
        {
            "name": "新版用户界面",
            "key": "new_ui_v3",
            "description": "全新设计的用户界面",
            "enabled": False,
            "status": "draft",
            "gray_rules": []
        },
        {
            "name": "实时通知系统",
            "key": "realtime_notifications",
            "description": "WebSocket实时通知推送",
            "enabled": True,
            "status": "active",
            "gray_rules": [
                {
                    "rule_type": "region",
                    "percentage": 0,
                    "user_ids": [],
                    "user_groups": [],
                    "regions": ["深圳", "广州", "杭州"],
                    "conditions": {}
                }
            ]
        },
        {
            "name": "数据导出功能",
            "key": "data_export_advanced",
            "description": "高级数据导出功能",
            "enabled": True,
            "status": "active",
            "gray_rules": []
        }
    ]
    
    created_flags = []
    for flag_data in flags_data:
        flag_create = schemas.FeatureFlagCreate(**flag_data)
        db_flag = services.create_feature_flag(db, flag_create, created_by="demo_system")
        created_flags.append(db_flag)
    
    sources_data = [
        {"name": "Web前端", "source_type": "web", "description": "主站前端应用"},
        {"name": "移动APP", "source_type": "mobile", "description": "iOS/Android移动应用"},
        {"name": "后端服务", "source_type": "backend", "description": "微服务调用"},
        {"name": "脚本任务", "source_type": "script", "description": "定时脚本和批处理"}
    ]
    
    for source_data in sources_data:
        source_create = schemas.ReadSourceCreate(**source_data)
        services.create_read_source(db, source_create)
    
    user_ids = [f"user_{i:03d}" for i in range(1, 101)]
    regions = ["北京", "上海", "广州", "深圳", "杭州", "成都"]
    sources = ["web", "mobile", "backend", "script"]
    
    for _ in range(200):
        flag = random.choice(created_flags)
        user_id = random.choice(user_ids) if random.random() > 0.3 else None
        region = random.choice(regions) if random.random() > 0.5 else None
        source = random.choice(sources)
        
        result = services.evaluate_feature_flag(
            db, flag.key, user_id=user_id, region=region, source=source
        )
        
        services.record_read_audit(
            db, flag.id, source_name=source, source_type=source,
            user_identifier=user_id, result=result.hit
        )
    
    pending_orders = [
        {
            "feature_flag_id": created_flags[1].id,
            "order_type": "update",
            "title": "扩大AI推荐灰度范围至50%",
            "description": "根据用户反馈，建议将灰度比例从白名单扩大到50%用户",
            "after_data": {
                "name": "AI推荐算法",
                "enabled": True,
                "status": "active",
                "gray_rules": [
                    {
                        "rule_type": "percentage",
                        "percentage": 50.0,
                        "user_ids": [],
                        "user_groups": ["premium"],
                        "regions": [],
                        "conditions": {}
                    }
                ]
            }
        },
        {
            "feature_flag_id": created_flags[2].id,
            "order_type": "enable",
            "title": "启用新版用户界面",
            "description": "UI设计评审通过，准备灰度发布",
            "after_data": {
                "name": "新版用户界面",
                "enabled": True,
                "status": "active",
                "gray_rules": [
                    {
                        "rule_type": "percentage",
                        "percentage": 10.0,
                        "user_ids": [],
                        "user_groups": [],
                        "regions": [],
                        "conditions": {}
                    }
                ]
            }
        }
    ]
    
    for order_data in pending_orders:
        order_create = schemas.ChangeOrderCreate(**order_data)
        services.create_change_order(db, order_create, created_by="product_manager")
    
    db.commit()
