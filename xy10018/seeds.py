#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta

sys.path.insert(0, '.')

from app.database import SessionLocal, Base, engine
from app.models import User, Reissue, StatusHistory, ReissueHistory, OperationLog, FailedTask, UserRole, ReissueStatus, OperationType
from app.security import get_password_hash
from app.services import log_operation, create_history_snapshot

def seed_users(db):
    print("Seeding users...")
    
    users_data = [
        {
            "username": "admin",
            "email": "admin@example.com",
            "password": "admin123",
            "full_name": "系统管理员",
            "role": UserRole.ADMIN
        },
        {
            "username": "manager",
            "email": "manager@example.com",
            "password": "manager123",
            "full_name": "客服经理",
            "role": UserRole.MANAGER
        },
        {
            "username": "cs01",
            "email": "cs01@example.com",
            "password": "cs123456",
            "full_name": "客服张三",
            "role": UserRole.CS
        },
        {
            "username": "cs02",
            "email": "cs02@example.com",
            "password": "cs123456",
            "full_name": "客服李四",
            "role": UserRole.CS
        },
        {
            "username": "operator01",
            "email": "operator01@example.com",
            "password": "op123456",
            "full_name": "运营王五",
            "role": UserRole.OPERATOR
        }
    ]
    
    for data in users_data:
        existing = db.query(User).filter(User.username == data["username"]).first()
        if not existing:
            user = User(
                username=data["username"],
                email=data["email"],
                hashed_password=get_password_hash(data["password"]),
                full_name=data["full_name"],
                role=data["role"],
                is_active=True
            )
            db.add(user)
    
    db.commit()
    print("Users seeded.")

def seed_reissues(db):
    print("Seeding reissues...")
    
    cs01 = db.query(User).filter(User.username == "cs01").first()
    cs02 = db.query(User).filter(User.username == "cs02").first()
    operator01 = db.query(User).filter(User.username == "operator01").first()
    
    if not cs01 or not cs02 or not operator01:
        print("Users not found, skipping reissues seed.")
        return
    
    reissues_data = [
        {
            "order_no": "ORD202505010001",
            "customer_name": "张三",
            "customer_phone": "13800138001",
            "address": "北京市朝阳区建国路88号",
            "product_name": "iPhone 15 Pro",
            "product_sku": "SKU-001",
            "quantity": 1,
            "reason": "屏幕漏光",
            "description": "用户反馈购买的iPhone 15 Pro屏幕左侧有漏光现象，申请补发新机。",
            "status": ReissueStatus.PENDING,
            "created_by": cs01.id,
            "assigned_to": operator01.id
        },
        {
            "order_no": "ORD202505010002",
            "customer_name": "李四",
            "customer_phone": "13800138002",
            "address": "上海市浦东新区陆家嘴金融中心",
            "product_name": "MacBook Air M3",
            "product_sku": "SKU-002",
            "quantity": 1,
            "reason": "键盘按键失灵",
            "description": "键盘C键按下无反应，需要更换键盘。",
            "status": ReissueStatus.PROCESSING,
            "created_by": cs01.id,
            "assigned_to": operator01.id,
            "tracking_number": "SF1234567890",
            "shipping_company": "顺丰速运",
            "shipping_cost": 15.0
        },
        {
            "order_no": "ORD202505010003",
            "customer_name": "王五",
            "customer_phone": "13800138003",
            "address": "广州市天河区珠江新城",
            "product_name": "AirPods Pro 2",
            "product_sku": "SKU-003",
            "quantity": 1,
            "reason": "包装盒破损",
            "description": "收到的商品包装盒严重破损，可能影响二次销售。",
            "status": ReissueStatus.SHIPPED,
            "created_by": cs02.id,
            "assigned_to": operator01.id,
            "tracking_number": "YT9876543210",
            "shipping_company": "圆通速递",
            "shipping_cost": 8.0
        },
        {
            "order_no": "ORD202505010004",
            "customer_name": "赵六",
            "customer_phone": "13800138004",
            "address": "深圳市南山区科技园",
            "product_name": "iPad Air",
            "product_sku": "SKU-004",
            "quantity": 1,
            "reason": "颜色发错",
            "description": "用户订购的是银色，收到的是深空灰。",
            "status": ReissueStatus.DELIVERED,
            "created_by": cs02.id,
            "assigned_to": operator01.id,
            "tracking_number": "JD1122334455",
            "shipping_company": "京东物流",
            "shipping_cost": 12.0
        },
        {
            "order_no": "ORD202505010005",
            "customer_name": "钱七",
            "customer_phone": "13800138005",
            "address": "杭州市西湖区文三路",
            "product_name": "Apple Watch Series 9",
            "product_sku": "SKU-005",
            "quantity": 2,
            "reason": "数量短缺",
            "description": "订购2个只收到1个，需要补发1个。",
            "status": ReissueStatus.COMPLETED,
            "created_by": cs01.id,
            "assigned_to": operator01.id,
            "tracking_number": "EMS6677889900",
            "shipping_company": "EMS",
            "shipping_cost": 10.0,
            "remarks": "用户已签收，问题解决。"
        },
        {
            "order_no": "ORD202505010006",
            "customer_name": "孙八",
            "customer_phone": "13800138006",
            "address": "成都市武侯区天府大道",
            "product_name": "Magic Mouse 2",
            "product_sku": "SKU-006",
            "quantity": 1,
            "reason": "功能故障",
            "description": "鼠标滚轮无法正常工作。",
            "status": ReissueStatus.FAILED,
            "created_by": cs01.id,
            "assigned_to": operator01.id,
            "retry_count": 2,
            "last_error": "库存不足，无法补发",
            "remarks": "需要等待进货"
        },
        {
            "order_no": "ORD202505010007",
            "customer_name": "周九",
            "customer_phone": "13800138007",
            "address": "武汉市洪山区光谷广场",
            "product_name": "Magic Keyboard",
            "product_sku": "SKU-007",
            "quantity": 1,
            "reason": "型号不符",
            "description": "用户需要带数字小键盘版本。",
            "status": ReissueStatus.CANCELLED,
            "created_by": cs02.id,
            "assigned_to": None,
            "remarks": "用户已申请退款，取消补发。"
        },
        {
            "order_no": "ORD202505010008",
            "customer_name": "吴十",
            "customer_phone": "13800138008",
            "address": "南京市鼓楼区中山北路",
            "product_name": "HomePod mini",
            "product_sku": "SKU-008",
            "quantity": 1,
            "reason": "包装破损",
            "description": "外包装有明显挤压痕迹，需确认商品是否完好。",
            "status": ReissueStatus.PENDING,
            "created_by": cs02.id,
            "assigned_to": None
        }
    ]
    
    for data in reissues_data:
        existing = db.query(Reissue).filter(Reissue.order_no == data["order_no"]).first()
        if not existing:
            reissue = Reissue(
                order_no=data["order_no"],
                customer_name=data["customer_name"],
                customer_phone=data["customer_phone"],
                address=data["address"],
                product_name=data["product_name"],
                product_sku=data["product_sku"],
                quantity=data["quantity"],
                reason=data["reason"],
                description=data["description"],
                status=data["status"],
                created_by=data["created_by"],
                assigned_to=data.get("assigned_to"),
                tracking_number=data.get("tracking_number"),
                shipping_company=data.get("shipping_company"),
                shipping_cost=data.get("shipping_cost"),
                remarks=data.get("remarks"),
                version=1,
                retry_count=data.get("retry_count", 0),
                last_error=data.get("last_error")
            )
            db.add(reissue)
            db.flush()
            
            create_history_snapshot(db, reissue, data["created_by"], "create")
            
            status_history = StatusHistory(
                reissue_id=reissue.id,
                from_status=None,
                to_status=ReissueStatus.PENDING,
                changed_by=data["created_by"],
                remarks="创建补发单"
            )
            db.add(status_history)
            
            if data["status"] != ReissueStatus.PENDING:
                status_history = StatusHistory(
                    reissue_id=reissue.id,
                    from_status=ReissueStatus.PENDING,
                    to_status=data["status"],
                    changed_by=data["created_by"],
                    remarks="状态变更"
                )
                db.add(status_history)
            
            log_operation(db, data["created_by"], OperationType.CREATE, reissue.id, {
                "order_no": data["order_no"],
                "customer_name": data["customer_name"]
            })
    
    db.commit()
    print("Reissues seeded.")

def seed_failed_tasks(db):
    print("Seeding failed tasks...")
    
    cs01 = db.query(User).filter(User.username == "cs01").first()
    if cs01:
        failed_reissues = db.query(Reissue).filter(Reissue.status == ReissueStatus.FAILED).all()
        for reissue in failed_reissues:
            existing = db.query(FailedTask).filter(
                FailedTask.reissue_id == reissue.id,
                FailedTask.task_name == "reissue_processing"
            ).first()
            if not existing:
                task = FailedTask(
                    task_name="reissue_processing",
                    reissue_id=reissue.id,
                    parameters={"reissue_id": reissue.id},
                    error_message=reissue.last_error or "处理失败",
                    retry_count=reissue.retry_count,
                    max_retries=3,
                    next_retry_at=datetime.utcnow() + timedelta(minutes=5),
                    status="pending"
                )
                db.add(task)
    
    db.commit()
    print("Failed tasks seeded.")

def main():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_users(db)
        seed_reissues(db)
        seed_failed_tasks(db)
        print("\nSeed completed successfully!")
        print("\nDefault accounts:")
        print("  admin / admin123    - 管理员")
        print("  manager / manager123 - 经理")
        print("  cs01 / cs123456    - 客服")
        print("  cs02 / cs123456    - 客服")
        print("  operator01 / op123456 - 运营")
    finally:
        db.close()

if __name__ == "__main__":
    main()
