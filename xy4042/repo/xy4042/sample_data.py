#!/usr/bin/env python3
"""
创建示例数据用于测试
"""

import sys
from pathlib import Path
from datetime import date, datetime

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from config.settings import Settings, set_settings
from models.database import init_db
from core.patient_repository import PatientRepository
from core.order_repository import OrderRepository
from core.measurement_repository import MeasurementRepository
from core.attachment_repository import AttachmentRepository
from core.fitting_repository import FittingRecordRepository
from core.rework_repository import ReworkRecordRepository
from models.patient import Patient
from models.order import Order
from models.measurement import Measurement
from models.fitting_record import FittingRecord
from models.rework_record import ReworkRecord


def create_sample_data(temp_dir: Path = None):
    if temp_dir:
        settings = Settings(
            base_dir=temp_dir,
            data_dir=temp_dir / "data",
            db_path=temp_dir / "data" / "orthotics.db",
            attachments_dir=temp_dir / "data" / "attachments",
            temp_dir=temp_dir / "data" / "temp"
        )
        set_settings(settings)
    
    init_db()
    
    patient_repo = PatientRepository()
    order_repo = OrderRepository()
    measurement_repo = MeasurementRepository()
    fitting_repo = FittingRecordRepository()
    rework_repo = ReworkRecordRepository()
    
    patients = [
        Patient(name="张三", phone="13800138001", diagnosis="小腿截肢"),
        Patient(name="李四", phone="13800138002", diagnosis="大腿截肢"),
        Patient(name="王五", phone="13800138003", diagnosis="脊柱侧弯"),
        Patient(name="赵六", phone="13800138004", diagnosis="足部畸形"),
        Patient(name="钱七", phone="13800138005", diagnosis="小腿矫形器"),
    ]
    
    saved_patients = []
    for patient in patients:
        saved = patient_repo.create(patient)
        saved_patients.append(saved)
    
    today = date.today()
    
    orders_data = [
        {
            "patient_idx": 0,
            "order_number": "ORD20260501001",
            "body_part": "小腿假肢",
            "side": "左侧",
            "status": "已交付",
            "impression_date": today.replace(day=today.day - 14),
            "follow_up_date": today.replace(day=today.day - 7),
            "technician": "王技师",
        },
        {
            "patient_idx": 1,
            "order_number": "ORD20260501002",
            "body_part": "大腿假肢",
            "side": "右侧",
            "status": "待试穿",
            "impression_date": today.replace(day=today.day - 7),
            "follow_up_date": today,
            "technician": "李技师",
        },
        {
            "patient_idx": 2,
            "order_number": "ORD20260501003",
            "body_part": "脊柱矫形器",
            "side": "双侧",
            "status": "制作中",
            "impression_date": today.replace(day=today.day - 5),
            "technician": "张技师",
        },
        {
            "patient_idx": 3,
            "order_number": "ORD20260501004",
            "body_part": "足部矫形器",
            "side": "左侧",
            "status": "待设计",
            "impression_date": today.replace(day=today.day - 3),
            "technician": "王技师",
        },
        {
            "patient_idx": 4,
            "order_number": "ORD20260501005",
            "body_part": "小腿矫形器",
            "side": "右侧",
            "status": "需返修",
            "impression_date": today.replace(day=today.day - 10),
            "technician": "李技师",
        },
        {
            "patient_idx": 0,
            "order_number": "ORD20260501006",
            "body_part": "小腿假肢",
            "side": "右侧",
            "status": "待取模",
            "technician": "王技师",
        },
    ]
    
    saved_orders = []
    for order_data in orders_data:
        order = Order(
            patient_id=saved_patients[order_data["patient_idx"]].id,
            order_number=order_data["order_number"],
            body_part=order_data["body_part"],
            side=order_data["side"],
            status=order_data["status"],
            impression_date=order_data.get("impression_date"),
            follow_up_date=order_data.get("follow_up_date"),
            technician=order_data.get("technician"),
        )
        saved = order_repo.create(order)
        saved_orders.append(saved)
    
    measurements_data = [
        {
            "order_idx": 0,
            "version": 1,
            "dims": {
                "残肢长度": "25cm",
                "残肢围度(近端)": "38cm",
                "残肢围度(中端)": "35cm",
                "残肢围度(远端)": "32cm",
            },
            "technician": "王技师",
        },
        {
            "order_idx": 0,
            "version": 2,
            "dims": {
                "残肢长度": "24.5cm",
                "残肢围度(近端)": "37cm",
                "残肢围度(中端)": "34cm",
                "残肢围度(远端)": "31cm",
                "对线角度": "5度",
            },
            "technician": "王技师",
            "notes": "试穿后调整",
        },
        {
            "order_idx": 1,
            "version": 1,
            "dims": {
                "残肢长度": "35cm",
                "残肢围度(近端)": "52cm",
                "残肢围度(中端)": "48cm",
                "残肢围度(远端)": "42cm",
                "坐骨结节高度": "85cm",
            },
            "technician": "李技师",
        },
        {
            "order_idx": 2,
            "version": 1,
            "dims": {
                "身高": "165cm",
                "体重": "55kg",
                "Cobb角": "25度",
                "主弯顶点": "T8",
                "躯干偏移": "2cm",
            },
            "technician": "张技师",
        },
        {
            "order_idx": 3,
            "version": 1,
            "dims": {
                "足长": "24cm",
                "足宽": "9cm",
                "足弓高度": "3cm",
                "后足外翻角": "8度",
            },
            "technician": "王技师",
        },
    ]
    
    for m_data in measurements_data:
        measurement = Measurement(
            order_id=saved_orders[m_data["order_idx"]].id,
            version=m_data["version"],
        )
        measurement.set_dimensions_dict(m_data["dims"])
        measurement.technician = m_data.get("technician")
        measurement.notes = m_data.get("notes")
        measurement_repo.create(measurement)
    
    fitting_data = [
        {
            "order_idx": 0,
            "fitting_date": today.replace(day=today.day - 10),
            "technician": "王技师",
            "feedback": "初次试穿，接受腔适配良好，对线需要微调",
            "adjustments": "调整对线角度",
            "next_follow_up": today.replace(day=today.day - 7),
        },
        {
            "order_idx": 0,
            "fitting_date": today.replace(day=today.day - 7),
            "technician": "王技师",
            "feedback": "二次试穿，步态良好，无不适",
            "adjustments": "无需调整",
        },
        {
            "order_idx": 4,
            "fitting_date": today.replace(day=today.day - 3),
            "technician": "李技师",
            "feedback": "试穿发现压迫点，需要调整",
            "adjustments": "标记压迫位置，准备返修",
            "next_follow_up": today.replace(day=today.day + 3),
        },
    ]
    
    saved_fittings = []
    for f_data in fitting_data:
        fitting = FittingRecord(
            order_id=saved_orders[f_data["order_idx"]].id,
            fitting_date=f_data["fitting_date"],
            technician=f_data["technician"],
            feedback=f_data["feedback"],
            adjustments=f_data["adjustments"],
            next_follow_up=f_data.get("next_follow_up"),
        )
        saved = fitting_repo.create(fitting)
        saved_fittings.append(saved)
    
    rework_data = [
        {
            "order_idx": 4,
            "fitting_idx": 2,
            "rework_reason": "尺寸不合适",
            "rework_details": "内侧有压迫点，需要打磨调整",
            "technician": "李技师",
            "rework_date": today.replace(day=today.day - 2),
        },
    ]
    
    for r_data in rework_data:
        rework = ReworkRecord(
            order_id=saved_orders[r_data["order_idx"]].id,
            fitting_record_id=saved_fittings[r_data["fitting_idx"]].id,
            rework_reason=r_data["rework_reason"],
            rework_details=r_data["rework_details"],
            technician=r_data["technician"],
            rework_date=r_data["rework_date"],
        )
        rework_repo.create(rework)
    
    print(f"示例数据创建完成！")
    print(f"  患者数: {len(saved_patients)}")
    print(f"  订单数: {len(saved_orders)}")
    print(f"  尺寸记录数: {len(measurements_data)}")
    print(f"  试穿记录数: {len(saved_fittings)}")
    print(f"  返修记录数: {len(rework_data)}")
    print()
    print("各状态订单分布:")
    status_counts = order_repo.get_status_counts()
    for status, count in status_counts.items():
        if count > 0:
            print(f"  {status}: {count}")
    
    return {
        "patients": saved_patients,
        "orders": saved_orders,
    }


if __name__ == "__main__":
    import tempfile
    
    use_temp = len(sys.argv) > 1 and sys.argv[1] == "--temp"
    
    if use_temp:
        temp_dir = Path(tempfile.mkdtemp(prefix="orthotics_test_"))
        print(f"使用临时目录: {temp_dir}")
        create_sample_data(temp_dir)
        
        os.environ["ORTHOTICS_TEST_DIR"] = str(temp_dir)
        print(f"\n设置环境变量: ORTHOTICS_TEST_DIR={temp_dir}")
    else:
        create_sample_data()
