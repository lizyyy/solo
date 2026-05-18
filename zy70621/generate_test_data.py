#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app import models, crud, schemas
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    buildings = ["1号楼", "2号楼", "3号楼", "5号楼", "6号楼", "7号楼", "8号楼", "9号楼", "10号楼", "11号楼"]
    repair_types = ["水电维修", "电梯故障", "墙面脱落", "管道堵塞", "门禁故障", "路灯损坏", "绿化修剪", "垃圾分类", "噪音投诉", "其他"]
    
    handlers_data = [
        {"name": "张工", "phone": "13800138001", "department": "工程部", "role": "维修工", "is_outsource": False},
        {"name": "李工", "phone": "13800138002", "department": "工程部", "role": "电工", "is_outsource": False},
        {"name": "王工", "phone": "13800138003", "department": "保洁部", "role": "保洁员", "is_outsource": False},
        {"name": "快修公司", "phone": "4008008801", "department": "外包", "role": "外包商", "is_outsource": True},
        {"name": "专业水电", "phone": "4008008802", "department": "外包", "role": "外包商", "is_outsource": True},
        {"name": "家政服务", "phone": "4008008803", "department": "外包", "role": "外包商", "is_outsource": True},
    ]
    
    handlers = []
    for h_data in handlers_data:
        handler = crud.create_handler(db, schemas.HandlerCreate(**h_data))
        handlers.append(handler)
        print(f"创建处理人: {handler.name} (ID: {handler.id})")
    
    internal_handlers = [h for h in handlers if not h.is_outsource]
    outsource_handlers = [h for h in handlers if h.is_outsource]
    
    order_count = 0
    for building in buildings:
        for room_num in range(101, 105):
            room = f"{room_num}"
            
            for i in range(random.randint(1, 3)):
                order_data = schemas.RepairOrderCreate(
                    building=building,
                    room_number=room,
                    repair_type=random.choice(repair_types),
                    description=f"{building}{room}业主报修{random.choice(['', '多次', '紧急'])}",
                    contact_name=f"业主{random.choice(['A', 'B', 'C', 'D'])}",
                    contact_phone=f"139{random.randint(10000000, 99999999)}",
                    priority=random.choice(["normal", "high", "urgent"]),
                    sla_hours=random.choice([24, 48, 72])
                )
                
                order = crud.create_repair_order(db, order_data)
                order_count += 1
                
                rand = random.random()
                if rand < 0.3:
                    pass
                elif rand < 0.5:
                    handler = random.choice(internal_handlers)
                    order.handler_id = handler.id
                    order.status = "assigned"
                    db.commit()
                elif rand < 0.7:
                    handler = random.choice(internal_handlers)
                    order.handler_id = handler.id
                    order.status = "processing"
                    db.commit()
                elif rand < 0.85:
                    outsource = random.choice(outsource_handlers)
                    crud.create_outsource_order(
                        db, order.id,
                        schemas.OutsourceOrderCreate(
                            outsource_company_id=outsource.id,
                            estimated_cost=random.uniform(100, 500),
                            notes="常规外包"
                        ),
                        "system"
                    )
                else:
                    handler = random.choice(internal_handlers)
                    order.handler_id = handler.id
                    order.status = "completed"
                    order.completed_at = datetime.now()
                    db.commit()
                    
                    crud.create_completion_proof(
                        db, order.id,
                        schemas.CompletionProofCreate(
                            proof_type="photo",
                            proof_url=f"http://example.com/proof/{order.id}.jpg",
                            description="维修完成照片"
                        )
                    )
                
                for j in range(random.randint(0, 3)):
                    crud.add_reminder(
                        db, order.id,
                        schemas.ReminderCreate(
                            reminder_type=random.choice(["normal", "urgent"]),
                            content=f"第{j+1}次催办，请尽快处理",
                            reminded_by=f"业主{random.choice(['X', 'Y', 'Z'])}"
                        )
                    )
                
                print(f"创建工单: {order.order_no} - {building}{room} - {order.status}")
    
    print(f"\n=== 数据生成完成 ===")
    print(f"处理人: {len(handlers)} 人")
    print(f"工单: {order_count} 条")
    print(f"房号记录: {db.query(models.BuildingRoom).count()} 条")
    
finally:
    db.close()