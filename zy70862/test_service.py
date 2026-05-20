#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.services.import_service import ImportService
from app.services.reconciliation_service import ReconciliationService
from app.services.review_service import ReviewService
from app.services.batch_trace_service import BatchTraceService
from app.services.report_service import ReportService


def test_import_service():
    print("=" * 60)
    print("测试1: 数据导入服务")
    print("=" * 60)

    db = SessionLocal()

    print("\n1.1 导入领料单CSV...")
    result = ImportService.import_requisitions_from_csv(db, "data/requisitions_sample.csv")
    print(f"   结果: {result}")
    assert result["success"], "领料单导入失败"
    print(f"   成功导入 {result['imported_count']} 条领料单")

    print("\n1.2 导入车辆物资JSON...")
    result = ImportService.import_vehicle_materials_from_json(db, "data/vehicle_materials_sample.json")
    print(f"   结果: {result}")
    assert result["success"], "车辆物资导入失败"
    print(f"   成功导入 {result['imported_count']} 条车辆物资记录")

    print("\n1.3 导入库存CSV...")
    result = ImportService.import_inventory_from_csv(db, "data/inventory_sample.csv")
    print(f"   结果: {result}")
    assert result["success"], "库存导入失败"
    print(f"   成功导入 {result['imported_count']} 条，更新 {result['updated_count']} 条库存记录")

    db.close()
    print("\n✓ 数据导入服务测试通过!")


def test_reconciliation_service():
    print("\n" + "=" * 60)
    print("测试2: 自动对账服务")
    print("=" * 60)

    db = SessionLocal()

    print("\n2.1 运行自动对账...")
    result = ReconciliationService.run_auto_reconciliation(db)
    print(f"   结果: {result}")
    assert result["success"], "自动对账失败"
    print(f"   发现 {result['total_diffs']} 个差异")

    print("\n2.2 获取差异列表...")
    diffs = ReconciliationService.get_diff_list(db)
    print(f"   共 {len(diffs)} 条差异记录")
    for diff in diffs[:3]:
        print(f"   - {diff['diff_type_name']}: {diff['material_name']}, 差异数量: {diff['diff_quantity']}")

    db.close()
    print("\n✓ 自动对账服务测试通过!")


def test_review_service():
    print("\n" + "=" * 60)
    print("测试3: 人工复核服务")
    print("=" * 60)

    db = SessionLocal()

    diffs = ReconciliationService.get_diff_list(db)
    if diffs:
        diff_id = diffs[0]["id"]
        print(f"\n3.1 复核差异ID: {diff_id}...")
        result = ReviewService.review_diff(
            db, diff_id, "张经理", "approved",
            "数据核对无误，紧急领用已核实", "夜间抢修应急出库，手续后补"
        )
        print(f"   结果: {result}")
        assert result["success"], "复核失败"

    print("\n3.2 获取领料单详情...")
    requisitions = db.query(MaterialRequisition).all()
    if requisitions:
        req_id = requisitions[0].id
        result = ReviewService.get_requisition_detail(db, req_id)
        print(f"   领料单ID: {req_id}")
        print(f"   包含 {len(result.get('diffs', []))} 个差异")
        print(f"   包含 {len(result.get('review_records', []))} 条复核记录")

    print("\n3.3 获取复核历史...")
    history = ReviewService.get_review_history(db)
    print(f"   共 {len(history)} 条复核记录")

    db.close()
    print("\n✓ 人工复核服务测试通过!")


def test_batch_trace_service():
    print("\n" + "=" * 60)
    print("测试4: 批次追踪服务")
    print("=" * 60)

    db = SessionLocal()

    print("\n4.1 追踪批次历史...")
    result = BatchTraceService.trace_batch_history(db, "B202401001")
    print(f"   批次号: B202401001")
    print(f"   追踪记录数: {result.get('total_records', 0)}")
    if result.get("timeline"):
        for record in result["timeline"]:
            print(f"   - {record['action_type']}: {record['quantity']} 个, 操作人: {record['operator']}")

    print("\n4.2 获取批次列表...")
    batches = BatchTraceService.get_material_batch_list(db)
    print(f"   共 {len(batches)} 个批次")
    for batch in batches[:3]:
        print(f"   - {batch['batch_no']}: {batch['material_name']}, 结存: {batch['balance']}")

    db.close()
    print("\n✓ 批次追踪服务测试通过!")


def test_report_service():
    print("\n" + "=" * 60)
    print("测试5: 报告生成服务")
    print("=" * 60)

    db = SessionLocal()

    print("\n5.1 生成对账汇总报告...")
    report = ReportService.generate_reconciliation_report(db)
    print(f"   报告生成日期: {report.get('report_date')}")
    if report.get("success"):
        summary = report["summary"]
        print(f"   领料单总数: {summary['total_requisitions']}")
        print(f"   紧急领用数: {summary['emergency_requisitions']}")
        print(f"   差异总数: {summary['total_diffs']}")
        print(f"   解决率: {summary['resolution_rate']}%")

    print("\n5.2 导出差异明细Excel...")
    output = ReportService.export_diffs_to_excel(db)
    print(f"   Excel文件已生成，大小: {len(output.getvalue())} bytes")

    print("\n5.3 导出完整对账报告...")
    output = ReportService.export_full_reconciliation_report(db)
    print(f"   完整报告已生成，大小: {len(output.getvalue())} bytes")
    with open("对账完整报告_测试.xlsx", "wb") as f:
        f.write(output.getvalue())
    print("   已保存到: 对账完整报告_测试.xlsx")

    db.close()
    print("\n✓ 报告生成服务测试通过!")


def init_database():
    print("\n初始化数据库...")
    from app.database import Base, engine
    from app.models.models import (
        MaterialRequisition, VehicleMaterial, Inventory,
        BatchTrace, ReviewRecord, ReconciliationDiff, ReconciliationSummary
    )
    Base.metadata.create_all(bind=engine)
    print("✓ 数据库表创建完成")


if __name__ == "__main__":
    print("\n供水抢修对账服务 - 功能测试套件")
    print("=" * 60)

    try:
        init_database()
        from app.models.models import MaterialRequisition

        test_import_service()
        test_reconciliation_service()
        test_review_service()
        test_batch_trace_service()
        test_report_service()

        print("\n" + "=" * 60)
        print("✓ 所有测试通过!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
