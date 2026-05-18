#!/usr/bin/env python3
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, User, DecoctionPot, Prescription, QueueEntry, StatusHistory
from datetime import datetime
import json


def init_sample_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        print("正在创建用户...")
        users = [
            User(username="zhang_sf", real_name="张三风", role="现场负责人"),
            User(username="li_fh", real_name="李复核", role="后台复核人"),
            User(username="wang_cz", real_name="王操作", role="操作员"),
        ]
        db.add_all(users)
        db.flush()
        print("用户创建完成")
        
        print("正在创建煎锅...")
        pots = [
            DecoctionPot(pot_no="POT-001", capacity_liters=20.0, status="空闲"),
            DecoctionPot(pot_no="POT-002", capacity_liters=20.0, status="空闲"),
            DecoctionPot(pot_no="POT-003", capacity_liters=30.0, status="空闲"),
            DecoctionPot(pot_no="POT-004", capacity_liters=30.0, status="使用中"),
        ]
        db.add_all(pots)
        db.flush()
        print("煎锅创建完成")
        
        print("正在创建处方和排队记录...")
        
        prescriptions_data = [
            {
                "prescription_no": "CF202401150001",
                "patient_name": "王大明",
                "patient_age": 45,
                "patient_gender": "男",
                "patient_id_card": "110101197901011234",
                "department": "内科",
                "doctor_name": "陈医生",
                "diagnosis": "高血压",
                "herbal_items": json.dumps([
                    {"name": "天麻", "dose": "10g"},
                    {"name": "钩藤", "dose": "15g"},
                    {"name": "石决明", "dose": "30g"},
                    {"name": "栀子", "dose": "10g"},
                ], ensure_ascii=False),
                "total_doses": 7,
                "decoction_type": "常规煎煮",
                "priority": 1,
                "submit_source": "门诊",
                "submitted_by": "wang_cz",
            },
            {
                "prescription_no": "CF202401150002",
                "patient_name": "李秀英",
                "patient_age": 58,
                "patient_gender": "女",
                "patient_id_card": "110101196602025678",
                "department": "内科",
                "doctor_name": "陈医生",
                "diagnosis": "高血压",
                "herbal_items": json.dumps([
                    {"name": "天麻", "dose": "10g"},
                    {"name": "钩藤", "dose": "15g"},
                    {"name": "石决明", "dose": "30g"},
                    {"name": "栀子", "dose": "10g"},
                ], ensure_ascii=False),
                "total_doses": 7,
                "decoction_type": "常规煎煮",
                "priority": 1,
                "submit_source": "门诊",
                "submitted_by": "wang_cz",
            },
            {
                "prescription_no": "CF202401150003",
                "patient_name": "张小华",
                "patient_age": 32,
                "patient_gender": "男",
                "patient_id_card": "110101199203039012",
                "department": "消化科",
                "doctor_name": "刘医生",
                "diagnosis": "慢性胃炎",
                "herbal_items": json.dumps([
                    {"name": "党参", "dose": "15g"},
                    {"name": "白术", "dose": "12g"},
                    {"name": "茯苓", "dose": "15g"},
                    {"name": "甘草", "dose": "6g"},
                ], ensure_ascii=False),
                "total_doses": 14,
                "decoction_type": "常规煎煮",
                "priority": 0,
                "submit_source": "门诊",
                "submitted_by": "zhang_sf",
            },
            {
                "prescription_no": "CF202401150004",
                "patient_name": "赵美玲",
                "patient_age": 28,
                "patient_gender": "女",
                "patient_id_card": "110101199604043456",
                "department": "妇科",
                "doctor_name": "周医生",
                "diagnosis": "月经不调",
                "herbal_items": json.dumps([
                    {"name": "当归", "dose": "12g"},
                    {"name": "川芎", "dose": "6g"},
                    {"name": "白芍", "dose": "12g"},
                    {"name": "熟地", "dose": "15g"},
                ], ensure_ascii=False),
                "total_doses": 7,
                "decoction_type": "先煎后下",
                "priority": 2,
                "submit_source": "急诊",
                "submitted_by": "zhang_sf",
            },
            {
                "prescription_no": "CF202401150005",
                "patient_name": "陈建国",
                "patient_age": 67,
                "patient_gender": "男",
                "patient_id_card": "110101195705057890",
                "department": "呼吸科",
                "doctor_name": "吴医生",
                "diagnosis": "慢性支气管炎",
                "herbal_items": json.dumps([
                    {"name": "麻黄", "dose": "6g"},
                    {"name": "杏仁", "dose": "10g"},
                    {"name": "石膏", "dose": "30g"},
                    {"name": "甘草", "dose": "6g"},
                ], ensure_ascii=False),
                "total_doses": 10,
                "decoction_type": "常规煎煮",
                "priority": 0,
                "submit_source": "门诊",
                "submitted_by": "wang_cz",
            },
            {
                "prescription_no": "CF202401150006",
                "patient_name": "刘淑芳",
                "patient_age": 52,
                "patient_gender": "女",
                "patient_id_card": "110101197206062345",
                "department": "内分泌科",
                "doctor_name": "郑医生",
                "diagnosis": "糖尿病",
                "herbal_items": json.dumps([
                    {"name": "黄芪", "dose": "30g"},
                    {"name": "山药", "dose": "20g"},
                    {"name": "天花粉", "dose": "15g"},
                    {"name": "知母", "dose": "12g"},
                ], ensure_ascii=False),
                "total_doses": 14,
                "decoction_type": "常规煎煮",
                "priority": 0,
                "submit_source": "门诊",
                "submitted_by": "wang_cz",
            },
        ]
        
        prescriptions = []
        for p_data in prescriptions_data:
            prescription = Prescription(**p_data)
            db.add(prescription)
            prescriptions.append(prescription)
        db.flush()
        
        queue_statuses = [
            ("已完成", 1, "DJ202401150001"),
            ("包装中", 1, "DJ202401150002"),
            ("煎煮中", 4, "DJ202401150003"),
            ("已分配锅次", 4, "DJ202401150004"),
            ("已排队", None, "DJ202401150005"),
            ("待排队", None, "DJ202401150006"),
        ]
        
        queue_entries = []
        for i, (status, pot_id, queue_no) in enumerate(queue_statuses):
            qe = QueueEntry(
                queue_no=queue_no,
                prescription_id=prescriptions[i].id,
                status=status,
                pot_id=pot_id,
                queue_position=i + 1 if status == "已排队" else None,
                is_same_pot=(i < 2),
                same_pot_group_id="SP20240115001" if i < 2 else None,
                updated_by="zhang_sf" if i < 2 else "wang_cz",
            )
            queue_entries.append(qe)
            db.add(qe)
        db.flush()
        
        print("正在创建状态历史记录...")
        status_flow = [
            ["待排队", "已排队", "已分配锅次", "煎煮中", "煎煮完成", "包装中", "已完成"],
            ["待排队", "已排队", "已分配锅次", "煎煮中", "煎煮完成", "包装中"],
            ["待排队", "已排队", "已分配锅次", "煎煮中"],
            ["待排队", "已排队", "已分配锅次"],
            ["待排队", "已排队"],
            ["待排队"],
        ]
        
        actions_map = {
            "待排队→已排队": "排队登记",
            "已排队→已分配锅次": "分配锅次",
            "已分配锅次→煎煮中": "开始煎煮",
            "煎煮中→煎煮完成": "完成煎煮",
            "煎煮完成→包装中": "开始包装",
            "包装中→已完成": "完成包装",
        }
        
        for i, flow in enumerate(status_flow):
            for j in range(len(flow) - 1):
                from_status = flow[j]
                to_status = flow[j + 1]
                action_key = f"{from_status}→{to_status}"
                action = actions_map.get(action_key, "状态变更")
                
                performer = "zhang_sf" if j % 2 == 0 else "wang_cz"
                performer_role = "现场负责人" if performer == "zhang_sf" else "操作员"
                
                history = StatusHistory(
                    queue_entry_id=queue_entries[i].id,
                    from_status=from_status,
                    to_status=to_status,
                    action=action,
                    performed_by=performer,
                    performed_by_role=performer_role,
                    notes=f"自动流转: {from_status} → {to_status}",
                )
                db.add(history)
        
        db.flush()
        
        print("\n" + "=" * 60)
        print("样例数据创建完成!")
        print("=" * 60)
        print(f"\n创建了 {len(users)} 个用户:")
        for u in users:
            print(f"  - {u.real_name} ({u.username}): {u.role}")
        
        print(f"\n创建了 {len(pots)} 个煎锅")
        print(f"\n创建了 {len(prescriptions)} 个处方")
        print(f"\n排队状态分布:")
        for status in ["待排队", "已排队", "已分配锅次", "煎煮中", "煎煮完成", "包装中", "已完成"]:
            count = db.query(QueueEntry).filter(QueueEntry.status == status).count()
            print(f"  - {status}: {count}")
        
        print("\n同锅合煎示例:")
        print(f"  - SP20240115001 组包含 2 张处方 (王大明、李秀英)")
        print(f"  - 煎煮类型相同: 常规煎煮")
        
        print("\n" + "=" * 60)
        print("系统已准备就绪，可以开始测试!")
        print("=" * 60)
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        print(f"创建样例数据时出错: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
