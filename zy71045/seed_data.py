from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime, timedelta

models.Base.metadata.create_all(bind=engine)


def seed_data():
    db = SessionLocal()
    try:
        barrels = [
            {"barrel_code": "BARREL-001", "location": "A区-01排", "capacity": 225.0, "current_volume": 200.0},
            {"barrel_code": "BARREL-002", "location": "A区-01排", "capacity": 225.0, "current_volume": 195.0},
            {"barrel_code": "BARREL-003", "location": "A区-02排", "capacity": 225.0, "current_volume": 198.0},
            {"barrel_code": "BARREL-004", "location": "B区-01排", "capacity": 225.0, "current_volume": 205.0},
        ]

        for b in barrels:
            existing = db.query(models.OakBarrel).filter_by(barrel_code=b["barrel_code"]).first()
            if not existing:
                db.add(models.OakBarrel(**b))

        batches = [
            {"batch_code": "CAB-2023-001", "wine_type": "赤霞珠", "vintage": 2023, "initial_volume": 5000.0, "remaining_volume": 4800.0},
            {"batch_code": "MER-2023-001", "wine_type": "梅洛", "vintage": 2023, "initial_volume": 3000.0, "remaining_volume": 2850.0},
            {"batch_code": "SHZ-2022-001", "wine_type": "西拉", "vintage": 2022, "initial_volume": 4000.0, "remaining_volume": 3900.0},
        ]

        for batch in batches:
            existing = db.query(models.WineBatch).filter_by(batch_code=batch["batch_code"]).first()
            if not existing:
                db.add(models.WineBatch(**batch))

        db.commit()

        barrel1 = db.query(models.OakBarrel).filter_by(barrel_code="BARREL-001").first()
        barrel2 = db.query(models.OakBarrel).filter_by(barrel_code="BARREL-002").first()
        barrel3 = db.query(models.OakBarrel).filter_by(barrel_code="BARREL-003").first()
        barrel4 = db.query(models.OakBarrel).filter_by(barrel_code="BARREL-004").first()

        batch1 = db.query(models.WineBatch).filter_by(batch_code="CAB-2023-001").first()
        batch2 = db.query(models.WineBatch).filter_by(batch_code="MER-2023-001").first()
        batch3 = db.query(models.WineBatch).filter_by(batch_code="SHZ-2022-001").first()

        batch_records = [
            {"barrel_id": barrel1.id, "batch_id": batch1.id, "fill_date": datetime(2023, 10, 1), "initial_volume": 200.0},
            {"barrel_id": barrel2.id, "batch_id": batch1.id, "fill_date": datetime(2023, 10, 1), "initial_volume": 195.0},
            {"barrel_id": barrel3.id, "batch_id": batch2.id, "fill_date": datetime(2023, 10, 5), "initial_volume": 198.0},
            {"barrel_id": barrel4.id, "batch_id": batch3.id, "fill_date": datetime(2022, 11, 15), "initial_volume": 205.0},
        ]

        for br in batch_records:
            existing = db.query(models.BatchRecord).filter_by(
                barrel_id=br["barrel_id"],
                batch_id=br["batch_id"],
                is_active=True
            ).first()
            if not existing:
                db.add(models.BatchRecord(**br))

        db.commit()

        topping_date = datetime.now() - timedelta(days=7)
        toppings = [
            {
                "record_code": "TOP-SEED-001",
                "barrel_id": barrel1.id,
                "source_batch_id": batch1.id,
                "evaporation_volume": 3.5,
                "topping_volume": 3.5,
                "topping_date": topping_date,
                "operator": "张酿酒师",
                "status": "completed",
                "inspection_status": "passed",
                "is_valid": True,
                "version": 1,
                "notes": "每周例行添酒"
            },
            {
                "record_code": "TOP-SEED-002",
                "barrel_id": barrel2.id,
                "source_batch_id": batch1.id,
                "evaporation_volume": 4.2,
                "topping_volume": 4.2,
                "topping_date": topping_date,
                "operator": "张酿酒师",
                "status": "approved",
                "inspection_status": "passed",
                "is_valid": True,
                "version": 1,
                "notes": "蒸发量略高"
            },
            {
                "record_code": "TOP-SEED-003",
                "barrel_id": barrel3.id,
                "source_batch_id": batch2.id,
                "evaporation_volume": 2.8,
                "topping_volume": 2.8,
                "topping_date": topping_date,
                "operator": "李酿酒师",
                "status": "inspection_required",
                "inspection_status": "pending",
                "is_valid": True,
                "version": 1,
                "notes": "等待检验"
            },
        ]

        for t in toppings:
            existing = db.query(models.ToppingRecord).filter_by(record_code=t["record_code"]).first()
            if not existing:
                db.add(models.ToppingRecord(**t))

        db.commit()

        top1 = db.query(models.ToppingRecord).filter_by(record_code="TOP-SEED-001").first()
        top2 = db.query(models.ToppingRecord).filter_by(record_code="TOP-SEED-002").first()

        if top1 and not top1.inspection:
            db.add(models.InspectionResult(
                topping_record_id=top1.id,
                inspector="王检验员",
                inspection_date=topping_date + timedelta(hours=2),
                appearance="清澈，深宝石红色",
                aroma="黑醋栗、橡木香气浓郁",
                taste="口感饱满，单宁细腻",
                overall_score=88.5,
                passed=True,
                comments="品质优秀，可以入桶"
            ))

        if top2 and not top2.inspection:
            db.add(models.InspectionResult(
                topping_record_id=top2.id,
                inspector="王检验员",
                inspection_date=topping_date + timedelta(hours=3),
                appearance="清澈，深紫红色",
                aroma="黑樱桃、香草香气",
                taste="酒体中等，回味悠长",
                overall_score=85.0,
                passed=True,
                comments="品质良好"
            ))

        db.commit()
        print("测试数据已成功导入！")
        print(f"橡木桶: {len(barrels)} 个")
        print(f"酒液批次: {len(batches)} 个")
        print(f"添酒记录: {len(toppings)} 条")

    except Exception as e:
        print(f"导入数据时出错: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
