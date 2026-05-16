from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os

import database
import services
import schemas


def init_sample_data(db: Session):
    print("初始化样例数据...")
    
    change_types_data = [
        {"code": "BREAKING", "name": "破坏性变更", "severity": "high", "description": "API合约发生破坏性变更"},
        {"code": "DEPRECATION", "name": "接口废弃", "severity": "medium", "description": "API标记废弃"},
        {"code": "NEW_FEATURE", "name": "新增功能", "severity": "low", "description": "新增API接口"},
        {"code": "BUGFIX", "name": "Bug修复", "severity": "low", "description": "API行为修复"},
    ]
    
    for ct_data in change_types_data:
        services.create_change_type(db, schemas.ChangeTypeCreate(**ct_data))
    print(f"已创建 {len(change_types_data)} 个变更类型")
    
    subscribers_data = [
        {"name": "支付系统团队", "email": "payment@example.com", "description": "负责支付相关服务"},
        {"name": "用户中心团队", "email": "user@example.com", "description": "用户认证和管理服务"},
        {"name": "订单系统团队", "email": "order@example.com", "description": "订单处理服务"},
    ]
    
    subscribers = []
    for sub_data in subscribers_data:
        subscriber = services.create_subscriber(db, schemas.SubscriberCreate(**sub_data))
        subscribers.append(subscriber)
    print(f"已创建 {len(subscribers_data)} 个订阅方")
    
    api_paths_data = [
        {"path": "/api/v1/payments/create", "method": "POST", "service": "payment", "description": "创建支付订单"},
        {"path": "/api/v1/payments/callback", "method": "POST", "service": "payment", "description": "支付回调接口"},
        {"path": "/api/v1/users/register", "method": "POST", "service": "user", "description": "用户注册"},
        {"path": "/api/v1/users/profile", "method": "GET", "service": "user", "description": "获取用户信息"},
        {"path": "/api/v1/orders/create", "method": "POST", "service": "order", "description": "创建订单"},
        {"path": "/api/v1/orders/status", "method": "GET", "service": "order", "description": "查询订单状态"},
    ]
    
    api_paths = []
    for ap_data in api_paths_data:
        api_path = services.create_api_path(db, schemas.ApiPathCreate(**ap_data))
        api_paths.append(api_path)
    print(f"已创建 {len(api_paths_data)} 个API路径")
    
    change_types = services.get_change_types(db)
    ct_by_code = {ct.code: ct for ct in change_types}
    
    subscriptions_data = [
        (0, 0, "BREAKING"),
        (0, 1, "BREAKING"),
        (0, 0, "DEPRECATION"),
        (1, 2, "BREAKING"),
        (1, 3, "NEW_FEATURE"),
        (2, 4, "BREAKING"),
        (2, 5, "DEPRECATION"),
        (2, 4, "BUGFIX"),
    ]
    
    for sub_idx, ap_idx, ct_code in subscriptions_data:
        ct_id = ct_by_code[ct_code].id
        services.create_subscription(db, schemas.SubscriptionCreate(
            subscriber_id=subscribers[sub_idx].id,
            api_path_id=api_paths[ap_idx].id,
            change_type_id=ct_id
        ))
    print(f"已创建 {len(subscriptions_data)} 个订阅关系")
    
    api_changes_data = [
        {
            "api_path_idx": 0,
            "change_type_code": "BREAKING",
            "title": "支付创建接口参数变更",
            "description": "amount字段从string改为number类型",
            "change_date": datetime.utcnow() - timedelta(days=1),
            "effective_date": datetime.utcnow() + timedelta(days=30),
        },
        {
            "api_path_idx": 2,
            "change_type_code": "DEPRECATION",
            "title": "用户注册接口v1版本废弃",
            "description": "将在30天后废弃，请迁移到v2版本",
            "change_date": datetime.utcnow() - timedelta(days=2),
            "effective_date": datetime.utcnow() + timedelta(days=28),
        },
        {
            "api_path_idx": 4,
            "change_type_code": "NEW_FEATURE",
            "title": "订单创建接口新增字段",
            "description": "新增discount字段支持折扣",
            "change_date": datetime.utcnow(),
            "effective_date": datetime.utcnow() + timedelta(days=7),
        },
    ]
    
    for change_data in api_changes_data:
        ct_id = ct_by_code[change_data["change_type_code"]].id
        ap_id = api_paths[change_data["api_path_idx"]].id
        services.create_api_change(db, schemas.ApiChangeCreate(
            api_path_id=ap_id,
            change_type_id=ct_id,
            title=change_data["title"],
            description=change_data["description"],
            change_date=change_data["change_date"],
            effective_date=change_data["effective_date"],
            raw_input="sample_data"
        ))
    print(f"已创建 {len(api_changes_data)} 个API变更记录")
    
    print("\n样例数据初始化完成！")


def reset_database():
    db_path = "api_change_subscription.db"
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"已删除旧数据库: {db_path}")
    
    database.init_db()
    print("已创建新数据库")


def main():
    reset_database()
    
    db = database.SessionLocal()
    try:
        init_sample_data(db)
        
        unprocessed_changes = services.get_api_changes(db, is_processed=False)
        print(f"\n待处理的API变更: {len(unprocessed_changes)} 个")
        for change in unprocessed_changes:
            notification_count, duplicate_count = services.process_api_change(db, change.id)
            print(f"  - 处理变更 [{change.title}]: 生成 {notification_count} 个通知，跳过 {duplicate_count} 个重复")
    finally:
        db.close()


if __name__ == "__main__":
    main()
