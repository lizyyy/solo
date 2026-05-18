import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from database import engine, SessionLocal
from models import Customer, Prescription, LensOrder, Frame, ProcessingStatus


def seed_database():
    db = SessionLocal()
    try:
        print("开始创建测试数据...")

        customers_data = [
            {"name": "张三", "phone": "13800138001", "email": "zhangsan@example.com", "wechat": "zhangsan_wx"},
            {"name": "李四", "phone": "13800138002", "email": "lisi@example.com", "wechat": "lisi_wx"},
            {"name": "王五", "phone": "13800138003", "email": "wangwu@example.com", "wechat": "wangwu_wx"},
        ]

        customers = []
        for data in customers_data:
            customer = Customer(**data)
            db.add(customer)
            customers.append(customer)
        db.flush()
        print(f"已创建 {len(customers)} 个顾客")

        prescriptions_data = [
            {
                "customer_idx": 0,
                "version": 1,
                "is_active": True,
                "optometrist": "王医生",
                "exam_date": datetime.now() - timedelta(days=7),
                "od_sphere": -2.0,
                "od_cylinder": -0.5,
                "od_axis": 180,
                "os_sphere": -2.5,
                "os_cylinder": -0.75,
                "os_axis": 170,
                "pd_distance": 62,
                "notes": "初诊验光"
            },
            {
                "customer_idx": 1,
                "version": 1,
                "is_active": True,
                "optometrist": "李医生",
                "exam_date": datetime.now() - timedelta(days=3),
                "od_sphere": -3.0,
                "od_cylinder": -1.0,
                "od_axis": 90,
                "od_add": 1.5,
                "os_sphere": -3.25,
                "os_cylinder": -1.25,
                "os_axis": 85,
                "os_add": 1.5,
                "pd_distance": 64,
                "notes": "渐进多焦点镜片"
            },
            {
                "customer_idx": 2,
                "version": 1,
                "is_active": True,
                "optometrist": "张医生",
                "exam_date": datetime.now() - timedelta(days=1),
                "od_sphere": -1.0,
                "os_sphere": -1.25,
                "pd_distance": 60,
                "notes": "轻度近视"
            },
        ]

        prescriptions = []
        for data in prescriptions_data:
            customer_idx = data.pop("customer_idx")
            data["customer_id"] = customers[customer_idx].id
            prescription = Prescription(**data)
            db.add(prescription)
            prescriptions.append(prescription)
        db.flush()
        print(f"已创建 {len(prescriptions)} 个验光单")

        frames_data = [
            {"sku": "RB5154-BLK", "brand": "雷朋", "model": "RB5154", "color": "黑色", "material": "板材",
             "size": "51", "bridge": "21", "temple_length": "145", "quantity": 10, "price": 580.0, "location": "A区-01"},
            {"sku": "RB5154-HV", "brand": "雷朋", "model": "RB5154", "color": "玳瑁色", "material": "板材",
             "size": "53", "bridge": "20", "temple_length": "145", "quantity": 5, "price": 620.0, "location": "A区-02"},
            {"sku": "OAKLEY345", "brand": "欧克利", "model": "OX345", "color": "枪灰色", "material": "金属",
             "size": "55", "bridge": "18", "temple_length": "140", "quantity": 3, "price": 890.0, "location": "B区-01"},
        ]

        frames = []
        for data in frames_data:
            frame = Frame(**data)
            db.add(frame)
            frames.append(frame)
        db.flush()
        print(f"已创建 {len(frames)} 个镜架")

        from services import OrderNumberGenerator

        orders_data = [
            {
                "customer_idx": 0,
                "prescription_idx": 0,
                "frame_idx": 0,
                "lens_type_od": "1.67非球面",
                "lens_type_os": "1.67非球面",
                "lens_brand": "依视路",
                "status": ProcessingStatus.PENDING.value,
                "rush_order": False,
                "created_by": "前台小王"
            },
            {
                "customer_idx": 1,
                "prescription_idx": 1,
                "frame_idx": 1,
                "lens_type_od": "1.74渐进多焦点",
                "lens_type_os": "1.74渐进多焦点",
                "lens_brand": "蔡司",
                "status": ProcessingStatus.LENS_CUTTING.value,
                "rush_order": True,
                "created_by": "前台小李"
            },
            {
                "customer_idx": 2,
                "prescription_idx": 2,
                "frame_idx": 2,
                "lens_type_od": "1.56非球面",
                "lens_type_os": "1.56非球面",
                "lens_brand": "明月",
                "status": ProcessingStatus.READY_FOR_PICKUP.value,
                "rush_order": False,
                "created_by": "前台小王"
            },
        ]

        orders = []
        for data in orders_data:
            customer_idx = data.pop("customer_idx")
            prescription_idx = data.pop("prescription_idx")
            frame_idx = data.pop("frame_idx")
            data["customer_id"] = customers[customer_idx].id
            data["prescription_id"] = prescriptions[prescription_idx].id
            data["frame_id"] = frames[frame_idx].id
            data["order_no"] = OrderNumberGenerator.generate()
            data["status_updated_at"] = datetime.now()
            data["status_updated_by"] = data["created_by"]
            order = LensOrder(**data)
            db.add(order)
            orders.append(order)
        db.flush()
        print(f"已创建 {len(orders)} 个镜片加工订单")

        db.commit()
        print("\n测试数据创建完成！")
        print(f"\n数据概览:")
        print(f"  - 顾客: {len(customers)} 人")
        print(f"  - 验光单: {len(prescriptions)} 份")
        print(f"  - 镜架: {len(frames)} 款")
        print(f"  - 加工订单: {len(orders)} 单")
        print(f"\n订单状态分布:")
        for status in ProcessingStatus:
            count = db.query(LensOrder).filter(LensOrder.status == status.value).count()
            if count > 0:
                print(f"  - {status.value}: {count} 单")

    except Exception as e:
        db.rollback()
        print(f"创建测试数据失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
