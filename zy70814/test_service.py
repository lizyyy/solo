#!/usr/bin/env python3
"""
港口调度对账服务快速测试脚本
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, Base, engine
from app.services.import_service import ImportService
from app.services.reconciliation_service import ReconciliationService
from app.services.report_service import ReportService

def test_import():
    print("=" * 50)
    print("测试1: 数据导入")
    print("=" * 50)
    
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
    
    db.close()
    return batch.batch_id


def test_reconciliation(batch_id):
    print("\n" + "=" * 50)
    print("测试2: 自动对账")
    print("=" * 50)
    
    db = SessionLocal()
    service = ReconciliationService(db)
    
    result = service.run_reconciliation(batch_id)
    print(f"✓ 对账完成")
    print(f"  - 总记录数: {result['total_records']}")
    print(f"  - 通过数: {result['passed_count']}")
    print(f"  - 失败数: {result['failed_count']}")
    print(f"  - 警告数: {result['warning_count']}")
    
    records = service.get_batch_records(batch_id)
    print(f"\n  详细记录:")
    for r in records:
        status_icon = "✓" if not r.has_discrepancy else "!"
        print(f"    {status_icon} {r.vessel_name} - 泊位{r.berth_number} - 吃水{r.draft}m - 可用水深{r.available_depth}m")
        if r.has_discrepancy:
            for d in r.discrepancies:
                severity = "错误" if d.severity == "error" else "警告"
                print(f"        [{severity}] {d.description}")
    
    db.close()


def test_report(batch_id):
    print("\n" + "=" * 50)
    print("测试3: 报告生成")
    print("=" * 50)
    
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
    print("\n🚢 港口调度对账服务 - 快速测试")
    print("=" * 50)
    
    Base.metadata.create_all(bind=engine)
    
    try:
        batch_id = test_import()
        test_reconciliation(batch_id)
        test_report(batch_id)
        
        print("\n" + "=" * 50)
        print("✅ 所有测试通过!")
        print("=" * 50)
        print("\n💡 接下来可以:")
        print("  1. 运行 `python main.py` 启动服务")
        print("  2. 访问 http://localhost:8000/docs 查看API文档")
        print("  3. 使用 examples/ 目录下的示例数据进行完整测试")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
