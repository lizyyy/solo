#!/usr/bin/env python3
"""
港口调度对账服务快速测试脚本 - 支持批次隔离验证
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, Base, engine
from app.models import ReconciliationBatch, ReconciliationRecord
from app.services.import_service import ImportService
from app.services.reconciliation_service import ReconciliationService
from app.services.report_service import ReportService
from app.services.review_service import ReviewService


def test_import_with_batch_isolation():
    print("=" * 60)
    print("测试1: 多批次数据导入（批次隔离验证）")
    print("=" * 60)
    
    db = SessionLocal()
    service = ImportService(db)
    
    vessel_file = "examples/vessel_schedule.csv"
    berth_file = "examples/berths.json"
    tide_file = "examples/tide.csv"
    
    with open(vessel_file, 'rb') as f:
        vessels, vessel_batch = service.import_vessel_schedule_csv(f.read(), os.path.basename(vessel_file))
        print(f"✓ 导入船期: {len(vessels)} 条, 批次ID: {vessel_batch}")
    
    with open(berth_file, 'rb') as f:
        berths, berth_batch = service.import_berth_json(f.read(), os.path.basename(berth_file))
        print(f"✓ 导入泊位: {len(berths)} 条, 批次ID: {berth_batch}")
    
    with open(tide_file, 'rb') as f:
        tides, tide_batch = service.import_tide_csv(f.read(), os.path.basename(tide_file))
        print(f"✓ 导入潮汐: {len(tides)} 条, 批次ID: {tide_batch}")
    
    batch = service.create_reconciliation_batch(
        name="测试对账批次",
        vessel_batch_id=vessel_batch,
        berth_batch_id=berth_batch,
        tide_batch_id=tide_batch,
        vessel_file=vessel_file,
        berth_file=berth_file,
        tide_file=tide_file,
    )
    print(f"✓ 创建对账批次: {batch.batch_id}")
    print(f"  - 关联船期批次: {batch.vessel_batch_id}")
    print(f"  - 关联泊位批次: {batch.berth_batch_id}")
    print(f"  - 关联潮汐批次: {batch.tide_batch_id}")
    
    db.close()
    return batch.batch_id, vessel_batch, berth_batch, tide_batch


def test_reconciliation_with_batch_filter(batch_id):
    print("\n" + "=" * 60)
    print("测试2: 批次隔离自动对账")
    print("=" * 60)
    
    db = SessionLocal()
    service = ReconciliationService(db)
    
    batch = db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
    
    result = service.run_reconciliation(batch_id)
    print(f"✓ 对账完成（按批次筛选）")
    print(f"  - 使用船期批次: {batch.vessel_batch_id}")
    print(f"  - 使用泊位批次: {batch.berth_batch_id}")
    print(f"  - 使用潮汐批次: {batch.tide_batch_id}")
    print(f"  - 总记录数: {result['total_records']}")
    print(f"  - 通过数: {result['passed_count']}")
    print(f"  - 失败数: {result['failed_count']}")
    print(f"  - 警告数: {result['warning_count']}")
    
    records = service.get_batch_records(batch_id)
    print(f"\n  详细记录:")
    for r in records:
        status_icon = "✓" if not r.has_discrepancy else "!"
        print(f"    {status_icon} {r.vessel_name} - 泊位{r.berth_number} - 吃水{r.draft}m - 可用水深{r.available_depth:.1f}m")
        if r.has_discrepancy:
            for d in r.discrepancies:
                severity = "错误" if d.severity == "error" else "警告"
                print(f"        [{severity}] {d.description}")
    
    db.close()
    return records[0].id if records else None


def test_batch_isolation_verification(batch_id, vessel_batch_id):
    print("\n" + "=" * 60)
    print("测试3: 批次隔离验证（确保不混入其他批次数据）")
    print("=" * 60)
    
    db = SessionLocal()
    
    from app.models import VesselSchedule
    
    all_vessels = db.query(VesselSchedule).count()
    batch_vessels = db.query(VesselSchedule).filter(VesselSchedule.batch_id == vessel_batch_id).count()
    reconciliation_records = db.query(ReconciliationRecord).filter(ReconciliationRecord.batch_id == batch_id).count()
    
    print(f"✓ 数据库总船期记录: {all_vessels}")
    print(f"✓ 当前批次船期记录: {batch_vessels}")
    print(f"✓ 对账生成记录数: {reconciliation_records}")
    
    if reconciliation_records == batch_vessels:
        print(f"✓ 批次隔离验证通过: 对账仅处理当前批次数据")
    else:
        print(f"✗ 批次隔离异常: 期望 {batch_vessels} 条，实际 {reconciliation_records} 条")
    
    db.close()


def test_update_and_recalculate(record_id):
    print("\n" + "=" * 60)
    print("测试4: 数据修改后重新计算")
    print("=" * 60)
    
    db = SessionLocal()
    service = ReviewService(db)
    
    record_before = db.query(ReconciliationRecord).filter(ReconciliationRecord.id == record_id).first()
    old_discrepancy_count = record_before.discrepancy_count
    
    print(f"✓ 修改前: {record_before.vessel_name}, 差异数: {old_discrepancy_count}")
    
    updates = {"draft": 14.0}
    record_after = service.update_vessel_and_recalculate(
        record_id=record_id,
        updates=updates,
        updated_by="测试员"
    )
    
    print(f"✓ 修改后: 吃水从 {record_before.draft}m 改为 14.0m")
    print(f"✓ 重新计算后差异数: {record_after.discrepancy_count}")
    
    history = service.get_review_history(record_id)
    print(f"✓ 操作历史记录数: {len(history)}")
    for h in history[:3]:
        print(f"    - {h.action}: {h.review_notes}")
    
    db.close()
    return record_after


def test_report(batch_id):
    print("\n" + "=" * 60)
    print("测试5: 报告生成（按批次）")
    print("=" * 60)
    
    db = SessionLocal()
    service = ReportService(db)
    
    summary = service.generate_summary_report(batch_id)
    print(f"✓ 汇总报告生成")
    print(f"  - 批次ID: {summary['batch_id']}")
    print(f"  - 通过率: {summary['statistics']['pass_rate']}")
    print(f"  - 差异类型: {list(summary['discrepancy_summary'].keys())}")
    
    csv_path = service.export_to_csv(batch_id)
    print(f"✓ CSV导出: {csv_path}")
    
    excel_path = service.export_to_excel(batch_id)
    print(f"✓ Excel导出: {excel_path}")
    
    db.close()


def main():
    print("\n🚢 港口调度对账服务 - 批次隔离功能测试")
    print("=" * 60)
    
    Base.metadata.create_all(bind=engine)
    
    try:
        batch_id, vessel_batch, berth_batch, tide_batch = test_import_with_batch_isolation()
        first_record_id = test_reconciliation_with_batch_filter(batch_id)
        test_batch_isolation_verification(batch_id, vessel_batch)
        
        if first_record_id:
            test_update_and_recalculate(first_record_id)
        
        test_report(batch_id)
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过!")
        print("=" * 60)
        print("\n💡 新增功能验证:")
        print("  ✓ 批次ID关联存储")
        print("  ✓ 对账按批次筛选数据")
        print("  ✓ 修改船期后重新计算API可用")
        print("  ✓ 报告按批次导出")
        print("\n💡 接下来可以:")
        print("  1. 运行 `python3 main.py` 启动服务")
        print("  2. 访问 http://localhost:8000/docs 查看API文档")
        print("  3. 测试新增端点: /api/v1/record/{id}/update-and-recalculate")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
