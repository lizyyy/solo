from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models, crud, schemas
from app.models import RepairStatus, UrgencyLevel
from datetime import datetime, timedelta
import random

db = SessionLocal()


def seed_buildings():
    building_data = [
        {"building_name": "1号楼", "unit_number": "1单元", "room_number": "101", "owner_name": "张三", "owner_phone": "13800138001"},
        {"building_name": "1号楼", "unit_number": "1单元", "room_number": "102", "owner_name": "李四", "owner_phone": "13800138002"},
        {"building_name": "1号楼", "unit_number": "2单元", "room_number": "201", "owner_name": "王五", "owner_phone": "13800138003"},
        {"building_name": "2号楼", "unit_number": "1单元", "room_number": "101", "owner_name": "赵六", "owner_phone": "13800138004"},
        {"building_name": "2号楼", "unit_number": "1单元", "room_number": "102", "owner_name": "钱七", "owner_phone": "13800138005"},
        {"building_name": "3号楼", "unit_number": "1单元", "room_number": "101", "owner_name": "孙八", "owner_phone": "13800138006"},
    ]
    
    buildings = []
    for data in building_data:
        building = crud.create_building(db, schemas.BuildingCreate(**data))
        buildings.append(building)
        print(f"Created building: {building.building_name} {building.unit_number} {building.room_number}")
    
    return buildings


def seed_handlers():
    handler_data = [
        {"name": "张维修", "phone": "13900139001", "department": "工程部", "is_outsourcer": False},
        {"name": "李维修", "phone": "13900139002", "department": "工程部", "is_outsourcer": False},
        {"name": "王师傅", "phone": "13900139003", "department": "外包队A", "is_outsourcer": True, "company_name": "诚信维修公司", "skills": "水电,空调"},
        {"name": "赵师傅", "phone": "13900139004", "department": "外包队B", "is_outsourcer": True, "company_name": "快捷服务公司", "skills": "管道,门窗"},
    ]
    
    handlers = []
    for data in handler_data:
        handler = crud.create_handler(db, schemas.HandlerCreate(**data))
        handlers.append(handler)
        print(f"Created handler: {handler.name} (outsourcer: {handler.is_outsourcer})")
    
    return handlers


def seed_repair_orders(buildings, handlers):
    repair_types = ["水管漏水", "电路故障", "空调维修", "门窗损坏", "电梯故障", "公共区域照明", "下水道堵塞", "门禁故障"]
    
    orders = []
    for i, building in enumerate(buildings):
        order_data = {
            "building_id": building.id,
            "reporter_name": building.owner_name,
            "reporter_phone": building.owner_phone,
            "repair_type": random.choice(repair_types),
            "description": f"{building.owner_name}家报修，请尽快处理",
            "urgency": random.choice(list(UrgencyLevel)),
        }
        
        order = crud.create_repair_order(db, schemas.RepairOrderCreate(**order_data))
        
        if i == 0:
            order.reported_at = datetime.now() - timedelta(hours=48)
            order.is_overdue = True
            db.commit()
            print(f"Created overdue order: {order.order_no}")
        elif i == 1:
            order.status = RepairStatus.ASSIGNED
            order.handler_id = handlers[0].id
            db.commit()
            print(f"Created assigned order: {order.order_no}")
        elif i == 2:
            order.status = RepairStatus.OUTSOURCED
            order.handler_id = handlers[2].id
            db.commit()
            
            outsourcing = schemas.OutsourcingCreate(
                outsourcer_id=handlers[2].id,
                cost_estimate=200,
                notes="需要更换零件"
            )
            crud.create_outsourcing(db, order.id, outsourcing, "系统")
            print(f"Created outsourced order: {order.order_no}")
        elif i == 3:
            order.status = RepairStatus.COMPLETED
            order.actual_completion_time = datetime.now()
            db.commit()
            print(f"Created completed order: {order.order_no}")
        else:
            print(f"Created pending order: {order.order_no}")
        
        orders.append(order)
    
    return orders


def seed_reminders(orders):
    for i, order in enumerate(orders[:3]):
        reminder_data = {
            "reminder_method": "电话",
            "reminder_content": f"再次催办{order.order_no}，请尽快处理",
            "reminder_by": order.reporter_name,
        }
        reminder = schemas.ReminderCreate(**reminder_data)
        crud.add_reminder(db, order.id, reminder)
        print(f"Added reminder for order: {order.order_no}")


def seed_completion_proofs(orders):
    completed_orders = [o for o in orders if o.status == RepairStatus.COMPLETED]
    for order in completed_orders:
        proof_data = {
            "proof_type": "照片",
            "proof_url": f"http://example.com/proofs/{order.order_no}.jpg",
            "description": "维修完成现场照片",
            "uploaded_by": "张维修",
        }
        proof = schemas.CompletionProofUpload(**proof_data)
        crud.add_completion_proof(db, order.id, proof)
        print(f"Added completion proof for order: {order.order_no}")


def main():
    print("=" * 50)
    print("开始生成测试数据...")
    print("=" * 50)
    
    print("\n1. 生成楼栋房间数据...")
    buildings = seed_buildings()
    
    print("\n2. 生成处理人数据...")
    handlers = seed_handlers()
    
    print("\n3. 生成报修工单数据...")
    orders = seed_repair_orders(buildings, handlers)
    
    print("\n4. 生成催办记录...")
    seed_reminders(orders)
    
    print("\n5. 生成完工证明...")
    seed_completion_proofs(orders)
    
    print("\n" + "=" * 50)
    print("测试数据生成完成！")
    print(f"  - 楼栋房间: {len(buildings)} 条")
    print(f"  - 处理人: {len(handlers)} 条")
    print(f"  - 报修工单: {len(orders)} 条")
    print("=" * 50)


if __name__ == "__main__":
    main()
    db.close()
