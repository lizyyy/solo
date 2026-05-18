from sqlalchemy.orm import Session
from database import SessionLocal, engine
from datetime import datetime, timedelta
import models

models.Base.metadata.create_all(bind=engine)


def init_sample_data():
    db = SessionLocal()
    try:
        if db.query(models.PrintUrgentOrder).count() > 0:
            print("数据库已存在数据，跳过初始化")
            return

        base_time = datetime.utcnow() + timedelta(hours=8)

        orders = [
            {
                "order_no": "URG-20240518-001",
                "customer_name": "张三",
                "customer_phone": "13800138001",
                "document_name": "毕业论文最终版.docx",
                "page_count": 50,
                "color_mode": "black_white",
                "paper_size": "A4",
                "double_sided": True,
                "binding_type": "胶装",
                "original_promised_time": base_time + timedelta(hours=4),
                "new_promised_time": base_time + timedelta(hours=2),
                "urgent_reason": "今天下午答辩需要用，非常紧急",
                "queue_position_before": 3,
                "queue_position_after": 1,
                "status": models.UrgentStatus.NORMAL,
                "reject_reason": None,
                "supplement_notes": None,
                "operator": "李店长",
                "created_at": base_time,
                "updated_at": base_time
            },
            {
                "order_no": "URG-20240518-002",
                "customer_name": "李四",
                "customer_phone": "13800138002",
                "document_name": "公司财务报表.xlsx",
                "page_count": 30,
                "color_mode": "color",
                "paper_size": "A4",
                "double_sided": False,
                "binding_type": "骑马钉",
                "original_promised_time": base_time + timedelta(hours=3),
                "new_promised_time": base_time + timedelta(hours=1),
                "urgent_reason": "老板临时要开会用",
                "queue_position_before": 4,
                "queue_position_after": 2,
                "status": models.UrgentStatus.REJECTED,
                "reject_reason": "当前机器正在维护，无法承接急单",
                "supplement_notes": None,
                "operator": "李店长",
                "created_at": base_time - timedelta(minutes=30),
                "updated_at": base_time - timedelta(minutes=15)
            },
            {
                "order_no": "URG-20240518-003",
                "customer_name": "王五",
                "customer_phone": "13800138003",
                "document_name": "项目投标书.pdf",
                "page_count": 80,
                "color_mode": "color",
                "paper_size": "A3",
                "double_sided": True,
                "binding_type": "精装",
                "original_promised_time": base_time + timedelta(hours=6),
                "new_promised_time": base_time + timedelta(hours=4),
                "urgent_reason": "明天早上要投标，今晚必须印好",
                "queue_position_before": 5,
                "queue_position_after": 3,
                "status": models.UrgentStatus.SUPPLEMENTED,
                "reject_reason": None,
                "supplement_notes": "客户补充提供了封面设计稿，已更新",
                "operator": "李店长",
                "created_at": base_time - timedelta(hours=1),
                "updated_at": base_time - timedelta(minutes=45)
            },
            {
                "order_no": "URG-20240518-004",
                "customer_name": "赵六",
                "customer_phone": "13800138004",
                "document_name": "产品宣传手册.pdf",
                "page_count": 20,
                "color_mode": "color",
                "paper_size": "A4",
                "double_sided": True,
                "binding_type": "无线胶装",
                "original_promised_time": base_time - timedelta(hours=2),
                "new_promised_time": base_time - timedelta(hours=4),
                "urgent_reason": "活动明天开始，今天必须拿到",
                "queue_position_before": 2,
                "queue_position_after": 1,
                "status": models.UrgentStatus.COMPLETED,
                "reject_reason": None,
                "supplement_notes": None,
                "operator": "李店长",
                "created_at": base_time - timedelta(hours=5),
                "updated_at": base_time - timedelta(hours=3)
            },
            {
                "order_no": "URG-20240518-005",
                "customer_name": "孙七",
                "customer_phone": "13800138005",
                "document_name": "个人简历集.docx",
                "page_count": 15,
                "color_mode": "color",
                "paper_size": "A4",
                "double_sided": False,
                "binding_type": "装订条",
                "original_promised_time": base_time + timedelta(hours=5),
                "new_promised_time": base_time + timedelta(hours=3),
                "urgent_reason": "下午有面试，急着用",
                "queue_position_before": 6,
                "queue_position_after": 4,
                "status": models.UrgentStatus.NORMAL,
                "reject_reason": None,
                "supplement_notes": None,
                "operator": "王店员",
                "created_at": base_time - timedelta(minutes=20),
                "updated_at": base_time - timedelta(minutes=20)
            }
        ]

        for order_data in orders:
            db_order = models.PrintUrgentOrder(**order_data)
            db.add(db_order)
            db.flush()

            if order_data["status"] == models.UrgentStatus.COMPLETED:
                log = models.CapacityLog(
                    log_no=f"CAP-{order_data['order_no']}-001",
                    urgent_order_id=db_order.id,
                    log_type="STATUS_CHANGE_COMPLETED",
                    affected_order_no=None,
                    original_delivery_time=None,
                    new_delivery_time=None,
                    capacity_impact=0,
                    impact_description=f"订单 {order_data['order_no']} 已完成打印",
                    is_rollback=False,
                    operator=order_data["operator"],
                    created_at=order_data["updated_at"]
                )
                db.add(log)

        db.commit()
        print(f"成功初始化 {len(orders)} 条急单数据")
        print("\n数据统计:")
        print(f"  正常状态: {db.query(models.PrintUrgentOrder).filter(models.PrintUrgentOrder.status == 'normal').count()} 条")
        print(f"  驳回状态: {db.query(models.PrintUrgentOrder).filter(models.PrintUrgentOrder.status == 'rejected').count()} 条")
        print(f"  补录状态: {db.query(models.PrintUrgentOrder).filter(models.PrintUrgentOrder.status == 'supplemented').count()} 条")
        print(f"  已完成状态: {db.query(models.PrintUrgentOrder).filter(models.PrintUrgentOrder.status == 'completed').count()} 条")

    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
