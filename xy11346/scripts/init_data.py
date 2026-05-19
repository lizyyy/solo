#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.services import crud
from app.schemas import PaperBatchCreate, QualityThresholdCreate, QualityRecordCreate, LabMeasurementCreate

def init_data():
    db = SessionLocal()
    
    try:
        print("开始初始化数据...")
        
        paper_batches = [
            PaperBatchCreate(
                batch_number="PAPER-2024-001",
                paper_type="铜版纸157g",
                supplier="供应商A",
                notes="常规批次"
            ),
            PaperBatchCreate(
                batch_number="PAPER-2024-002",
                paper_type="哑粉纸200g",
                supplier="供应商B",
                notes="高端产品专用"
            )
        ]
        
        for batch in paper_batches:
            existing = crud.get_paper_batch(db, batch.batch_number)
            if not existing:
                crud.create_paper_batch(db, batch)
                print(f"创建纸张批次: {batch.batch_number}")
            else:
                print(f"纸张批次已存在: {batch.batch_number}")
        
        thresholds = [
            QualityThresholdCreate(
                product_type="包装彩盒",
                color_name="default",
                l_min=35.0,
                l_max=45.0,
                a_min=55.0,
                a_max=65.0,
                b_min=45.0,
                b_max=55.0,
                delta_e_max=2.0
            ),
            QualityThresholdCreate(
                product_type="宣传画册",
                color_name="default",
                l_min=85.0,
                l_max=95.0,
                a_min=-5.0,
                a_max=5.0,
                b_min=-5.0,
                b_max=5.0,
                delta_e_max=1.5
            ),
            QualityThresholdCreate(
                product_type="标签贴纸",
                color_name="default",
                l_min=20.0,
                l_max=30.0,
                a_min=20.0,
                a_max=30.0,
                b_min=10.0,
                b_max=20.0,
                delta_e_max=2.5
            )
        ]
        
        for threshold in thresholds:
            existing = crud.get_quality_thresholds(db, product_type=threshold.product_type)
            if not existing:
                crud.create_quality_threshold(db, threshold)
                print(f"创建品控阈值: {threshold.product_type}")
            else:
                print(f"品控阈值已存在: {threshold.product_type}")
        
        print("数据初始化完成！")
        
    except Exception as e:
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_data()
