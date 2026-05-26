import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine
from app import models, schemas, services
from datetime import datetime


def init_data():
    db = SessionLocal()

    try:
        print("正在初始化样例数据...")

        batch1 = services.create_batch(db, schemas.BatchCreate(
            batch_no="DEMO_DEP_202401_001",
            store_code="SH001",
            batch_type="deposit",
            created_by="system",
            remarks="演示数据-缴存"
        ))
        print(f"创建批次: {batch1.batch_no}")

        deposit1 = models.DepositRecord(
            batch_id=batch1.id,
            store_code="SH001",
            deposit_date=datetime(2024, 1, 15),
            deposit_amount=12500.00,
            deposit_bank="工商银行",
            deposit_slip_no="DS20240115001",
            cashier="张三",
            status="matched",
            remarks="正常记录"
        )
        deposit2 = models.DepositRecord(
            batch_id=batch1.id,
            store_code="SH001",
            deposit_date=datetime(2024, 1, 14),
            deposit_amount=500.00,
            deposit_bank="工商银行",
            deposit_slip_no="DS20240114001",
            cashier="王五",
            is_holiday_delay=True,
            status="pending",
            mismatch_reason="周末缴存，可能延迟到账",
            remarks="需要人工确认"
        )
        deposit3 = models.DepositRecord(
            batch_id=batch1.id,
            store_code="SH001",
            deposit_date=datetime(2024, 1, 16),
            deposit_amount=8500.00,
            deposit_bank="工商银行",
            deposit_slip_no="DS20240116001",
            cashier="张三",
            status="short",
            mismatch_reason="短款1500.00元，销售现金10000.00元，实际缴存8500.00元"
        )

        db.add_all([deposit1, deposit2, deposit3])
        batch1.record_count = 3

        batch2 = services.create_batch(db, schemas.BatchCreate(
            batch_no="DEMO_SAL_202401_001",
            store_code="SH001",
            batch_type="sales",
            created_by="system",
            remarks="演示数据-销售"
        ))
        print(f"创建批次: {batch2.batch_no}")

        sales1 = models.SalesRecord(
            batch_id=batch2.id,
            store_code="SH001",
            sale_date=datetime(2024, 1, 15, 9, 30),
            sale_amount=5000.00,
            payment_method="cash",
            transaction_no="TX20240115001",
            cashier="张三"
        )
        sales2 = models.SalesRecord(
            batch_id=batch2.id,
            store_code="SH001",
            sale_date=datetime(2024, 1, 15, 10, 15),
            sale_amount=5000.00,
            payment_method="cash",
            transaction_no="TX20240115002",
            cashier="张三"
        )
        db.add_all([sales1, sales2])
        batch2.record_count = 2

        services.process_records(db, schemas.ProcessActionRequest(
            record_ids=[deposit3.id],
            action="approve",
            reason="经核对，短款为收银员个人原因造成，已由个人补足",
            handled_by="财务主管",
            action_type="manual_correction",
            remarks="短款已处理完成"
        ))
        print("已人工处理短款记录")

        db.commit()
        print("\n样例数据初始化完成！")
        print(f"缴存记录3条，其中包含1条需要人工修正")
        print(f"门店编码: SH001")
        print(f"短款记录ID: {deposit3.id}")
        print(f"处理日志已记录完整追踪")

    except Exception as e:
        print(f"错误: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    init_data()
