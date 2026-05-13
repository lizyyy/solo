import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime

import sys
sys.path.insert(0, '.')

from app.models.models import Base, ImportBatch, ImportItem, WriteDetail, StageType
from app.models.models import BatchStatus, StageRecord

DATABASE_URL = "sqlite+aiosqlite:///./async_rollback.db"

engine = create_async_engine(DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_sample_batch():
    async with AsyncSessionLocal() as session:
        batch = ImportBatch(
            batch_no="BATCH-2024-001",
            source_system="ERP-SYSTEM",
            import_type="USER_IMPORT",
            request_idempotent_key="BATCH-2024-001-IDEMP",
            created_by="admin",
            total_count=3,
            success_count=2,
            failed_count=1,
            status=BatchStatus.PARTIAL_SUCCESS,
            current_stage=StageType.WRITE_MAIN,
            extra_metadata={"import_source": "file_upload"}
        )
        session.add(batch)
        await session.flush()

        items_data = [
            {"item_no": "USER-001", "item_type": "USER", "source_data": {"name": "张三", "email": "zhangsan@example.com", "dept": "IT"}, "status": "success", "target_id": "1001"},
            {"item_no": "USER-002", "item_type": "USER", "source_data": {"name": "李四", "email": "lisi@example.com", "dept": "HR"}, "status": "success", "target_id": "1002"},
            {"item_no": "USER-003", "item_type": "USER", "source_data": {"name": "王五", "email": "wangwu@example.com", "dept": "Finance"}, "status": "failed", "error_message": "邮箱格式错误"}
        ]

        created_items = []
        for idx, item_data in enumerate(items_data):
            item = ImportItem(
                batch_id=batch.id,
                **item_data
            )
            session.add(item)
            created_items.append(item)

        await session.flush()

        write_details = [
            {"item_id": created_items[0].id, "table_name": "users", "record_id": "1001", "operation_type": "INSERT", "before_data": {}, "after_data": created_items[0].source_data},
            {"item_id": created_items[0].id, "table_name": "user_roles", "record_id": "2001", "operation_type": "INSERT", "before_data": {}, "after_data": {"user_id": "1001", "role": "employee"}},
            {"item_id": created_items[1].id, "table_name": "users", "record_id": "1002", "operation_type": "INSERT", "before_data": {}, "after_data": created_items[1].source_data}
        ]

        for detail in write_details:
            wd = WriteDetail(**detail)
            session.add(wd)

        stages = [
            {"stage": StageType.VALIDATION, "status": "success", "started_at": datetime.utcnow(), "completed_at": datetime.utcnow()},
            {"stage": StageType.DATA_PREPARE, "status": "success", "started_at": datetime.utcnow(), "completed_at": datetime.utcnow()},
            {"stage": StageType.WRITE_MAIN, "status": "failed", "started_at": datetime.utcnow(), "completed_at": datetime.utcnow(), "error_message": "部分数据写入失败"},
            {"stage": StageType.WRITE_RELATED, "status": "pending"},
            {"stage": StageType.POST_PROCESS, "status": "pending"},
            {"stage": StageType.NOTIFY, "status": "pending"}
        ]

        for stage_data in stages:
            sr = StageRecord(batch_id=batch.id, **stage_data)
            session.add(sr)

        await session.commit()
        print(f"Created sample batch: {batch.batch_no} (ID: {batch.id})")
        return batch.id


async def create_second_batch():
    async with AsyncSessionLocal() as session:
        batch = ImportBatch(
            batch_no="BATCH-2024-002",
            source_system="CRM-SYSTEM",
            import_type="CUSTOMER_IMPORT",
            request_idempotent_key="BATCH-2024-002-IDEMP",
            created_by="operator",
            total_count=5,
            success_count=5,
            failed_count=0,
            status=BatchStatus.SUCCESS,
            current_stage=StageType.NOTIFY,
            extra_metadata={"import_source": "api_push"}
        )
        session.add(batch)
        await session.flush()

        created_items = []
        for i in range(1, 6):
            item = ImportItem(
                batch_id=batch.id,
                item_no=f"CUST-{i:03d}",
                item_type="CUSTOMER",
                source_data={"name": f"客户{i}", "phone": f"1380000000{i}"},
                status="success",
                target_id=f"CUST{i:05d}"
            )
            session.add(item)
            created_items.append(item)

        await session.flush()

        for i in range(1, 6):
            wd = WriteDetail(
                item_id=created_items[i-1].id,
                table_name="customers",
                record_id=f"CUST{i:05d}",
                operation_type="INSERT",
                before_data={},
                after_data=created_items[i-1].source_data
            )
            session.add(wd)

        for stage in StageType:
            sr = StageRecord(
                batch_id=batch.id,
                stage=stage,
                status="success",
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow()
            )
            session.add(sr)

        await session.commit()
        print(f"Created second batch: {batch.batch_no} (ID: {batch.id})")


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    batch1_id = await create_sample_batch()
    await create_second_batch()

    print("\nSample data created successfully!")
    print(f"Batch 1 ID: {batch1_id} - This batch has failed items, ready for rollback testing")

    print("\nNext steps:")
    print("1. Start the server: uvicorn app.main:app --reload")
    print("2. Check API docs: http://localhost:8000/docs")


if __name__ == "__main__":
    asyncio.run(main())
