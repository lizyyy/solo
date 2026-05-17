from datetime import datetime, timedelta
from database import SessionLocal, init_db
import schemas
from services import BatchService, StorageLocationService, SampleBoxService, InspectionService, DestructionService

def seed_data():
    init_db()
    db = SessionLocal()

    try:
        print("开始生成测试数据...")

        locations = [
            {"location_code": "LOC-001", "location_name": "冷藏柜A-01层", "refrigerator_no": "A01", "shelf_no": "1层", "temperature": -18},
            {"location_code": "LOC-002", "location_name": "冷藏柜A-02层", "refrigerator_no": "A01", "shelf_no": "2层", "temperature": -18},
            {"location_code": "LOC-003", "location_name": "冷藏柜B-01层", "refrigerator_no": "B01", "shelf_no": "1层", "temperature": -18},
        ]

        for loc in locations:
            StorageLocationService.create_location(db, schemas.StorageLocationCreate(**loc))
        print("已创建3个冷藏位置")

        batches = [
            {"batch_no": "BATCH-20240101-001", "dish_name": "红烧肉", "production_date": datetime.now(), "quantity": 100, "operator": "张三"},
            {"batch_no": "BATCH-20240101-002", "dish_name": "糖醋排骨", "production_date": datetime.now(), "quantity": 80, "operator": "李四"},
            {"batch_no": "BATCH-20240102-001", "dish_name": "鱼香肉丝", "production_date": datetime.now() - timedelta(days=1), "quantity": 120, "operator": "王五"},
        ]

        batch_ids = []
        for batch in batches:
            db_batch = BatchService.create_batch(db, schemas.BatchCreate(**batch))
            batch_ids.append(db_batch.id)
        print("已创建3个批次")

        samples = [
            {"box_no": "BOX-001", "batch_id": batch_ids[0], "storage_location_id": 1, "sample_date": datetime.now(), "retention_days": 48, "operator": "张三"},
            {"box_no": "BOX-002", "batch_id": batch_ids[0], "storage_location_id": 2, "sample_date": datetime.now(), "retention_days": 48, "operator": "张三"},
            {"box_no": "BOX-003", "batch_id": batch_ids[1], "storage_location_id": 3, "sample_date": datetime.now(), "retention_days": 48, "operator": "李四"},
        ]

        sample_ids = []
        for sample in samples:
            db_sample = SampleBoxService.create_sample_box(db, schemas.SampleBoxCreate(**sample))
            sample_ids.append(db_sample.id)
        print("已创建3个留样盒")

        inspections = [
            {"inspection_no": "INS-001", "batch_id": batch_ids[0], "sample_box_id": sample_ids[0], "inspection_date": datetime.now(), "inspector": "赵六", "result": "合格", "conclusion": "感官正常，无异味"},
            {"inspection_no": "INS-002", "batch_id": batch_ids[1], "sample_box_id": sample_ids[2], "inspection_date": datetime.now(), "inspector": "赵六", "result": "合格", "conclusion": "感官正常"},
        ]

        inspection_ids = []
        for inspection in inspections:
            db_inspection = InspectionService.create_inspection(db, schemas.InspectionCreate(**inspection))
            inspection_ids.append(db_inspection.id)
        print("已创建2个抽检记录")

        print("测试数据生成完成！")

    except Exception as e:
        print(f"生成数据失败: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
