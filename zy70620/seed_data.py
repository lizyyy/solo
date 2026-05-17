from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Base, RepairOrder, Handler, Reminder, Outsourcing, CompletionProof, RepairOrderStatus, UrgencyLevel

Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    try:
        handlers = [
            {"name": "张师傅", "phone": "13800138001", "department": "工程部", "is_outsourcer": False},
            {"name": "李师傅", "phone": "13800138002", "department": "物业部", "is_outsourcer": False},
            {"name": "王工", "phone": "13800138003", "department": "水电维修", "is_outsourcer": True},
            {"name": "赵师傅", "phone": "13800138004", "department": "家政服务", "is_outsourcer": True},
        ]
        for h in handlers:
            if not db.query(Handler).filter(Handler.name == h["name"]).first():
                db.add(Handler(**h))
        db.commit()
        
        buildings = ["1号楼", "2号楼", "3号楼", "5号楼", "6号楼"]
        rooms = ["101", "102", "201", "202", "301", "302", "401", "501"]
        issue_types = ["水电维修", "管道堵塞", "电梯故障", "门禁问题", "公共区域", "墙面脱落"]
        contact_names = ["王先生", "李女士", "张先生", "刘阿姨", "陈先生"]
        
        orders_data = []
        for i in range(15):
            building = buildings[i % len(buildings)]
            room = rooms[i % len(rooms)]
            issue_type = issue_types[i % len(issue_types)]
            contact_name = contact_names[i % len(contact_names)]
            
            created_at = datetime.utcnow() - timedelta(hours=i * 5)
            timeout_hours = 24 if i % 3 == 0 else 48
            
            orders_data.append({
                "order_no": f"BX{datetime.now().strftime('%Y%m%d')}{str(i+1).zfill(4)}",
                "building": building,
                "room_number": room,
                "contact_name": contact_name,
                "contact_phone": f"139{str(1000000 + i).zfill(7)[1:]}",
                "issue_type": issue_type,
                "description": f"{contact_name}家{issue_type}，需要尽快处理",
                "urgency": [UrgencyLevel.LOW, UrgencyLevel.MEDIUM, UrgencyLevel.HIGH][i % 3],
                "timeout_hours": timeout_hours,
                "created_at": created_at,
            })
        
        for i, data in enumerate(orders_data):
            if not db.query(RepairOrder).filter(RepairOrder.order_no == data["order_no"]).first():
                order = RepairOrder(**data)
                
                if i < 3:
                    order.status = RepairOrderStatus.PENDING
                elif i < 6:
                    order.status = RepairOrderStatus.PROCESSING
                    order.handler_id = 1
                elif i < 9:
                    order.status = RepairOrderStatus.OUTSOURCED
                    order.handler_id = 3
                elif i < 12:
                    order.status = RepairOrderStatus.COMPLETED
                elif i < 14:
                    order.status = RepairOrderStatus.VERIFIED
                else:
                    order.status = RepairOrderStatus.CLOSED
                
                db.add(order)
        db.commit()
        
        orders = db.query(RepairOrder).all()
        for order in orders[1:4]:
            for j in range(3):
                reminder = Reminder(
                    repair_order_id=order.id,
                    reminder_time=datetime.utcnow() - timedelta(hours=j),
                    reminder_method="电话" if j % 2 == 0 else "微信",
                    reminder_content=f"第{j+1}次催办：{order.issue_type}问题还未解决，请尽快处理",
                    operator="物业管理员",
                    created_at=datetime.utcnow() - timedelta(hours=j)
                )
                db.add(reminder)
        db.commit()
        
        outsourced_orders = db.query(RepairOrder).filter(RepairOrder.status == RepairOrderStatus.OUTSOURCED).all()
        for i, order in enumerate(outsourced_orders):
            outsourcing = Outsourcing(
                repair_order_id=order.id,
                outsourcer_name="专业水电维修公司" if i % 2 == 0 else "家政服务中心",
                outsourcer_contact="13800138888",
                dispatch_time=datetime.utcnow() - timedelta(hours=2),
                promised_completion_time=datetime.utcnow() + timedelta(hours=4),
                cost=150.0 if i % 2 == 0 else 80.0,
                status="处理中",
                remarks="需要准备专业工具"
            )
            db.add(outsourcing)
        db.commit()
        
        completed_orders = db.query(RepairOrder).filter(
            RepairOrder.status.in_([RepairOrderStatus.COMPLETED, RepairOrderStatus.VERIFIED])
        ).all()
        for i, order in enumerate(completed_orders):
            proof = CompletionProof(
                repair_order_id=order.id,
                proof_type="照片+文字说明",
                proof_content=f"已完成{order.issue_type}维修工作，经检查运行正常",
                image_urls="http://example.com/img1.jpg,http://example.com/img2.jpg",
                submitter="张师傅",
                submit_time=datetime.utcnow() - timedelta(hours=1),
                is_verified=order.status == RepairOrderStatus.VERIFIED,
                verifier="物业主管" if order.status == RepairOrderStatus.VERIFIED else None,
                verify_time=datetime.utcnow() - timedelta(minutes=30) if order.status == RepairOrderStatus.VERIFIED else None,
                verify_remarks="复核通过，维修质量合格" if order.status == RepairOrderStatus.VERIFIED else None
            )
            db.add(proof)
        db.commit()
        
        for order in orders:
            time_elapsed = datetime.utcnow() - order.created_at
            order.is_timeout = time_elapsed.total_seconds() > order.timeout_hours * 3600
        db.commit()
        
        print(f"测试数据创建完成！")
        print(f"处理人: {db.query(Handler).count()} 人")
        print(f"报修单: {db.query(RepairOrder).count()} 单")
        print(f"催办记录: {db.query(Reminder).count()} 条")
        print(f"外包派单: {db.query(Outsourcing).count()} 单")
        print(f"完工证明: {db.query(CompletionProof).count()} 份")
        
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
