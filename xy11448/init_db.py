#!/usr/bin/env python3
"""
数据库初始化脚本
创建默认用户和样例数据
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.models import Base, User, UserRole, ChargingPile
from app.auth import get_password_hash

Base.metadata.create_all(bind=engine)


def create_default_users(db: Session):
    """创建默认用户"""
    users = [
        {
            "username": "admin",
            "full_name": "系统管理员",
            "email": "admin@example.com",
            "role": UserRole.SUPERVISOR,
            "password": "admin123"
        },
        {
            "username": "reviewer",
            "full_name": "复核员张三",
            "email": "reviewer@example.com",
            "role": UserRole.REVIEWER,
            "password": "reviewer123"
        },
        {
            "username": "operator",
            "full_name": "录入员李四",
            "email": "operator@example.com",
            "role": UserRole.DATA_ENTRY,
            "password": "operator123"
        },
        {
            "username": "viewer",
            "full_name": "只读用户王五",
            "email": "viewer@example.com",
            "role": UserRole.READ_ONLY,
            "password": "viewer123"
        }
    ]
    
    for user_data in users:
        existing = db.query(User).filter(User.username == user_data["username"]).first()
        if not existing:
            hashed_pwd = get_password_hash(user_data["password"])
            db_user = User(
                username=user_data["username"],
                full_name=user_data["full_name"],
                email=user_data["email"],
                role=user_data["role"],
                hashed_password=hashed_pwd,
                is_active=True
            )
            db.add(db_user)
            print(f"创建用户: {user_data['username']} / {user_data['password']} (角色: {user_data['role'].value})")
    
    db.commit()


def create_sample_piles(db: Session):
    """创建样例充电桩数据"""
    piles = [
        {"pile_code": "CP001", "pile_name": "A区1号桩", "location": "A区停车场入口", "area": "A区", "manufacturer": "特斯拉", "model": "V3", "is_online": True},
        {"pile_code": "CP002", "pile_name": "A区2号桩", "location": "A区停车场中间", "area": "A区", "manufacturer": "特斯拉", "model": "V3", "is_online": True},
        {"pile_code": "CP003", "pile_name": "B区1号桩", "location": "B区停车场入口", "area": "B区", "manufacturer": "特来电", "model": "TCD-120KW", "is_online": True},
        {"pile_code": "CP004", "pile_name": "B区2号桩", "location": "B区停车场出口", "area": "B区", "manufacturer": "特来电", "model": "TCD-120KW", "is_online": False},
        {"pile_code": "CP005", "pile_name": "C区1号桩", "location": "C区地下一层", "area": "C区", "manufacturer": "星星充电", "model": "XX-60KW", "is_online": True},
        {"pile_code": "CP006", "pile_name": "C区2号桩", "location": "C区地下二层", "area": "C区", "manufacturer": "星星充电", "model": "XX-60KW", "is_online": True},
    ]
    
    for pile_data in piles:
        existing = db.query(ChargingPile).filter(ChargingPile.pile_code == pile_data["pile_code"]).first()
        if not existing:
            db_pile = ChargingPile(**pile_data)
            db.add(db_pile)
            print(f"创建充电桩: {pile_data['pile_code']} - {pile_data['pile_name']}")
    
    db.commit()


def create_sample_alerts(db: Session):
    """创建样例告警数据"""
    from app.models import PileAlert, AlertType, AlertStatus, DataQuality
    
    now = datetime.now()
    
    alerts = [
        {
            "pile_id": 1,
            "alert_type": AlertType.OFFLINE,
            "alert_code": "ERR001",
            "alert_message": "充电桩离线，网络连接中断",
            "alert_level": 2,
            "status": AlertStatus.RECOVERED,
            "start_time": now - timedelta(hours=5),
            "end_time": now - timedelta(hours=2),
            "duration_minutes": 180,
            "data_quality": DataQuality.VALID,
            "created_by": 3
        },
        {
            "pile_id": 1,
            "alert_type": AlertType.ABNORMAL,
            "alert_code": "ERR002",
            "alert_message": "充电电压异常波动",
            "alert_level": 1,
            "status": AlertStatus.RECOVERED,
            "start_time": now - timedelta(hours=8),
            "end_time": now - timedelta(hours=6),
            "duration_minutes": 120,
            "data_quality": DataQuality.VALID,
            "created_by": 3
        },
        {
            "pile_id": 4,
            "alert_type": AlertType.FAULT,
            "alert_code": "ERR003",
            "alert_message": "充电模块故障，无法启动",
            "alert_level": 3,
            "status": AlertStatus.ACTIVE,
            "start_time": now - timedelta(hours=24),
            "end_time": None,
            "duration_minutes": None,
            "data_quality": DataQuality.VALID,
            "created_by": 3
        },
        {
            "pile_id": 2,
            "alert_type": AlertType.WARNING,
            "alert_code": "WARN001",
            "alert_message": "温度过高预警",
            "alert_level": 1,
            "status": AlertStatus.RECOVERED,
            "start_time": now - timedelta(days=2),
            "end_time": now - timedelta(days=2, hours=2),
            "duration_minutes": 120,
            "data_quality": DataQuality.VALID,
            "created_by": 3
        },
        {
            "pile_id": 3,
            "alert_type": AlertType.OFFLINE,
            "alert_code": "ERR004",
            "alert_message": "通信模块故障",
            "alert_level": 2,
            "status": AlertStatus.RECOVERED,
            "start_time": now - timedelta(days=3),
            "end_time": now - timedelta(days=3, hours=4),
            "duration_minutes": 240,
            "data_quality": DataQuality.INVALID,
            "quality_issue": "结束时间格式异常，需要人工复核",
            "created_by": 3
        },
    ]
    
    for alert_data in alerts:
        db_alert = PileAlert(**alert_data)
        db.add(db_alert)
        print(f"创建告警: {alert_data['alert_code']} - {alert_data['alert_message'][:30]}...")
    
    db.commit()


def create_sample_work_orders(db: Session):
    """创建样例工单数据"""
    from app.models import WorkOrder, WorkOrderStatus
    
    now = datetime.now()
    
    work_orders = [
        {
            "order_no": "WO202401001",
            "pile_id": 1,
            "alert_id": 1,
            "order_type": "故障维修",
            "title": "A区1号桩离线故障处理",
            "description": "充电桩离线，网络连接中断，需要现场排查",
            "status": WorkOrderStatus.COMPLETED,
            "assignee": "维修员A",
            "priority": 2,
            "due_date": now + timedelta(days=1),
            "actual_start_time": now - timedelta(hours=4),
            "actual_end_time": now - timedelta(hours=2),
            "duration_minutes": 120,
            "created_by": 2
        },
        {
            "order_no": "WO202401002",
            "pile_id": 1,
            "alert_id": 2,
            "order_type": "异常处理",
            "title": "A区1号桩电压异常处理",
            "description": "充电电压异常波动，需要检测电路",
            "status": WorkOrderStatus.COMPLETED,
            "assignee": "维修员B",
            "priority": 1,
            "due_date": now + timedelta(days=2),
            "actual_start_time": now - timedelta(hours=7),
            "actual_end_time": now - timedelta(hours=6),
            "duration_minutes": 60,
            "created_by": 2
        },
        {
            "order_no": "WO202401003",
            "pile_id": 4,
            "alert_id": 3,
            "order_type": "故障维修",
            "title": "B区2号桩充电模块故障",
            "description": "充电模块故障，无法启动充电",
            "status": WorkOrderStatus.PROCESSING,
            "assignee": "维修员C",
            "priority": 3,
            "due_date": now + timedelta(days=1),
            "actual_start_time": now - timedelta(hours=20),
            "actual_end_time": None,
            "duration_minutes": None,
            "created_by": 2
        },
        {
            "order_no": "WO202401004",
            "pile_id": 2,
            "alert_id": 4,
            "order_type": "巡检处理",
            "title": "A区2号桩温度过高预警",
            "description": "充电桩温度过高，需要检查散热系统",
            "status": WorkOrderStatus.PENDING,
            "assignee": "维修员A",
            "priority": 1,
            "due_date": now + timedelta(days=3),
            "actual_start_time": None,
            "actual_end_time": None,
            "duration_minutes": None,
            "created_by": 2
        }
    ]
    
    for wo_data in work_orders:
        existing = db.query(WorkOrder).filter(WorkOrder.order_no == wo_data["order_no"]).first()
        if not existing:
            db_wo = WorkOrder(**wo_data)
            db.add(db_wo)
            print(f"创建工单: {wo_data['order_no']} - {wo_data['title']}")
    
    db.commit()


def create_sample_inspections(db: Session):
    """创建样例巡检数据"""
    from app.models import Inspection, InspectionStatus, DataQuality
    
    now = datetime.now()
    
    inspections = [
        {
            "pile_id": 1,
            "inspection_date": now - timedelta(hours=3),
            "inspector": "巡检员甲",
            "status": InspectionStatus.NORMAL,
            "inspection_items": "外观检查, 电源检查, 通信检查, 充电测试",
            "abnormal_items": None,
            "remarks": "设备运行正常",
            "data_quality": DataQuality.VALID,
            "created_by": 3,
            "reviewed_by": 2
        },
        {
            "pile_id": 4,
            "inspection_date": now - timedelta(hours=22),
            "inspector": "巡检员乙",
            "status": InspectionStatus.ABNORMAL,
            "inspection_items": "外观检查, 电源检查, 通信检查, 充电测试",
            "abnormal_items": "充电模块指示灯不亮，充电测试失败",
            "remarks": "发现充电模块故障，已报修",
            "data_quality": DataQuality.VALID,
            "created_by": 3,
            "reviewed_by": 2
        },
        {
            "pile_id": 3,
            "inspection_date": now - timedelta(days=2),
            "inspector": "巡检员甲",
            "status": InspectionStatus.NORMAL,
            "inspection_items": "外观检查, 电源检查, 通信检查",
            "abnormal_items": None,
            "remarks": "正常",
            "data_quality": DataQuality.VALID,
            "created_by": 3,
            "reviewed_by": 2
        }
    ]
    
    for ins_data in inspections:
        db_ins = Inspection(**ins_data)
        db.add(db_ins)
        print(f"创建巡检记录: {ins_data['inspection_date'].strftime('%Y-%m-%d')} - 桩{ins_data['pile_id']}")
    
    db.commit()


def create_sample_complaints(db: Session):
    """创建样例投诉数据"""
    from app.models import CustomerComplaint, DataQuality
    
    now = datetime.now()
    
    complaints = [
        {
            "complaint_no": "C202401001",
            "pile_id": 4,
            "customer_name": "陈先生",
            "customer_phone": "13800138001",
            "complaint_type": "无法充电",
            "complaint_content": "车辆无法启动充电，屏幕显示故障代码",
            "complaint_time": now - timedelta(hours=20),
            "handler": "客服A",
            "handle_result": "已安排维修人员上门处理",
            "handle_time": now - timedelta(hours=18),
            "data_quality": DataQuality.VALID,
            "created_by": 3
        },
        {
            "complaint_no": "C202401002",
            "pile_id": 1,
            "customer_name": "李女士",
            "customer_phone": "13900139002",
            "complaint_type": "充电慢",
            "complaint_content": "充电速度比平时慢很多",
            "complaint_time": now - timedelta(days=2),
            "handler": "客服B",
            "handle_result": "检测发现电压波动，已恢复正常",
            "handle_time": now - timedelta(days=2, hours=2),
            "data_quality": DataQuality.VALID,
            "created_by": 3
        }
    ]
    
    for comp_data in complaints:
        existing = db.query(CustomerComplaint).filter(CustomerComplaint.complaint_no == comp_data["complaint_no"]).first()
        if not existing:
            db_comp = CustomerComplaint(**comp_data)
            db.add(db_comp)
            print(f"创建投诉记录: {comp_data['complaint_no']} - {comp_data['complaint_type']}")
    
    db.commit()


def create_sample_comments(db: Session):
    """创建样例主管批注"""
    from app.models import SupervisorComment
    
    comments = [
        {
            "related_type": "alert",
            "related_id": 3,
            "supervisor": "张主管",
            "comment": "此故障需要重点关注，已影响3位用户充电，需加快处理进度"
        },
        {
            "related_type": "work_order",
            "related_id": 3,
            "supervisor": "张主管",
            "comment": "请维修团队注意安全操作，确保彻底排查问题根源，避免再次发生"
        },
        {
            "related_type": "inspection",
            "related_id": 2,
            "supervisor": "李主管",
            "comment": "巡检记录完整，异常项已及时上报，后续持续跟踪处理情况"
        }
    ]
    
    for comment_data in comments:
        db_comment = SupervisorComment(**comment_data, created_by=1)
        db.add(db_comment)
        print(f"创建主管批注: {comment_data['related_type']} - {comment_data['comment'][:30]}...")
    
    db.commit()


def create_sample_failed_data(db: Session):
    """创建样例失败数据"""
    from app.models import FailedData
    import json
    
    failed_records = [
        {
            "data_type": "pile_alert",
            "source_data": json.dumps({
                "pile_id": 999,
                "alert_type": "offline",
                "start_time": "2024-01-01T00:00:00"
            }, ensure_ascii=False),
            "error_message": "充电桩ID 999 不存在"
        },
        {
            "data_type": "pile_alert",
            "source_data": json.dumps({
                "pile_id": 1,
                "alert_type": "offline",
                "start_time": "2024-01-02T10:00:00",
                "end_time": "2024-01-01T08:00:00"
            }, ensure_ascii=False),
            "error_message": "结束时间早于开始时间"
        }
    ]
    
    for failed_data in failed_records:
        db_failed = FailedData(**failed_data)
        db.add(db_failed)
        print(f"创建失败数据: {failed_data['error_message']}")
    
    db.commit()


def main():
    print("=" * 60)
    print("充电桩巡检验收回放链路系统 - 数据库初始化")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        print("\n1. 创建默认用户...")
        create_default_users(db)
        
        print("\n2. 创建样例充电桩数据...")
        create_sample_piles(db)
        
        print("\n3. 创建样例告警数据...")
        create_sample_alerts(db)
        
        print("\n4. 创建样例工单数据...")
        create_sample_work_orders(db)
        
        print("\n5. 创建样例巡检数据...")
        create_sample_inspections(db)
        
        print("\n6. 创建样例投诉数据...")
        create_sample_complaints(db)
        
        print("\n7. 创建样例主管批注...")
        create_sample_comments(db)
        
        print("\n8. 创建样例失败数据...")
        create_sample_failed_data(db)
        
        print("\n" + "=" * 60)
        print("数据库初始化完成!")
        print("=" * 60)
        print("\n默认账号:")
        print("  主管账号: admin / admin123")
        print("  复核账号: reviewer / reviewer123")
        print("  录入账号: operator / operator123")
        print("  只读账号: viewer / viewer123")
        print("\nAPI文档: http://localhost:8000/docs")
        
    except Exception as e:
        print(f"\n初始化失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
