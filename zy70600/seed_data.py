from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import ColdChainBox, TemperatureSample, StoreSignoff, PhotoEvidence, ExceptionReview, CompensationConclusion


def seed_data():
    db = SessionLocal()
    
    print("开始初始化测试数据...")
    
    box1 = ColdChainBox(
        box_code="BOX-TEST-001",
        batch_no="BATCH-2024-001",
        product_name="进口冷冻牛肉",
        temperature_min=-25.0,
        temperature_max=-15.0,
        expected_arrival=datetime.now() + timedelta(days=2),
        status="SIGNED_OFF"
    )
    db.add(box1)
    db.flush()
    
    for i in range(5):
        sample = TemperatureSample(
            box_id=box1.id,
            sample_time=datetime.now() - timedelta(hours=i*2),
            temperature=-20.0 - i*0.5,
            probe_id=f"PROBE-{i:03d}",
            is_anomaly=False
        )
        db.add(sample)
    
    signoff1 = StoreSignoff(
        box_id=box1.id,
        store_code="STORE-001",
        store_name="北京朝阳门店",
        signoff_person="张三",
        signoff_time=datetime.now(),
        temperature_arrival=-18.0,
        has_exception=False,
        status="CONFIRMED"
    )
    db.add(signoff1)
    db.flush()
    
    photo1 = PhotoEvidence(
        box_id=box1.id,
        signoff_id=signoff1.id,
        photo_key="PHOTO-BOX001-001",
        photo_type="ARRIVAL",
        photo_url="/photos/BOX-TEST-001/arrival.jpg",
        uploader="system",
        description="冷链箱到货照片"
    )
    db.add(photo1)
    
    box2 = ColdChainBox(
        box_code="BOX-TEST-002",
        batch_no="BATCH-2024-001",
        product_name="进口冷冻三文鱼",
        temperature_min=-20.0,
        temperature_max=-10.0,
        expected_arrival=datetime.now() + timedelta(days=1),
        status="EXCEPTION"
    )
    db.add(box2)
    db.flush()
    
    for i in range(5):
        temp = -18.0 - i*2 if i >= 3 else -18.0
        sample = TemperatureSample(
            box_id=box2.id,
            sample_time=datetime.now() - timedelta(hours=i*2),
            temperature=temp,
            probe_id=f"PROBE-{i:03d}",
            is_anomaly=temp < -20.0
        )
        db.add(sample)
    
    signoff2 = StoreSignoff(
        box_id=box2.id,
        store_code="STORE-002",
        store_name="上海浦东门店",
        signoff_person="李四",
        signoff_time=datetime.now(),
        temperature_arrival=-8.0,
        has_exception=True,
        exception_desc="冷链箱表面有水珠，内部温度超标，部分产品可能解冻",
        status="CONFIRMED"
    )
    db.add(signoff2)
    db.flush()
    
    photo2 = PhotoEvidence(
        box_id=box2.id,
        signoff_id=signoff2.id,
        photo_key="PHOTO-BOX002-001",
        photo_type="EXCEPTION",
        photo_url="/photos/BOX-TEST-002/exception.jpg",
        uploader="李四",
        description="异常现场照片，可见箱内有水珠"
    )
    db.add(photo2)
    
    box3 = ColdChainBox(
        box_code="BOX-TEST-003",
        batch_no="BATCH-2024-002",
        product_name="进口冷冻龙虾",
        temperature_min=-25.0,
        temperature_max=-15.0,
        expected_arrival=datetime.now() + timedelta(days=3),
        status="COMPENSATED"
    )
    db.add(box3)
    db.flush()
    
    signoff3 = StoreSignoff(
        box_id=box3.id,
        store_code="STORE-003",
        store_name="广州天河门店",
        signoff_person="王五",
        signoff_time=datetime.now(),
        temperature_arrival=-5.0,
        has_exception=True,
        exception_desc="温度严重超标，产品解冻变质",
        status="CONFIRMED"
    )
    db.add(signoff3)
    db.flush()
    
    review3 = ExceptionReview(
        box_id=box3.id,
        signoff_id=signoff3.id,
        reviewer="质量主管-赵六",
        review_time=datetime.now(),
        review_result="确认温度超标，产品已无法销售",
        review_comment="运输过程冷链中断4小时以上，建议全额赔付",
        temperature_violation=True,
        compensation_eligible=True,
        status="COMPLETED"
    )
    db.add(review3)
    db.flush()
    
    compensation3 = CompensationConclusion(
        box_id=box3.id,
        review_id=review3.id,
        compensation_amount=5000.0,
        compensation_reason="冷链中断导致产品变质，全额赔付",
        processor="财务-孙七",
        approved_by="经理-周八",
        status="CONFIRMED"
    )
    db.add(compensation3)
    
    db.commit()
    print("测试数据初始化完成！")
    print(f"- 创建冷链箱: 3个")
    print(f"- 创建温度采样记录: 10条")
    print(f"- 创建签收记录: 3条")
    print(f"- 创建照片凭证: 2条")
    print(f"- 创建异常复核: 1条")
    print(f"- 创建赔付结论: 1条")
    print("\n测试箱号: BOX-TEST-001, BOX-TEST-002, BOX-TEST-003")
    
    db.close()


if __name__ == "__main__":
    seed_data()
