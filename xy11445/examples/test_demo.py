#!/usr/bin/env python3
"""
演示脚本：充电桩巡检异常回执状态机完整流程
"""
import sys
import json
from datetime import datetime

sys.path.insert(0, ".")

from app.models.database import init_db, SessionLocal
from app.models.enums import DataSource, BatchStrategy, WorkOrderStatus
from app.schemas import BatchCreate, WorkOrderCreate
from app.services.batch_service import BatchService
from app.services.work_order_service import WorkOrderService
from app.services.export_service import ExportService


def demo():
    print("=" * 60)
    print("充电桩巡检异常回执状态机 - 完整流程演示")
    print("=" * 60)

    init_db()
    db = SessionLocal()

    try:
        print("\n1. 创建批次...")
        batch_service = BatchService(db)
        batch_data = BatchCreate(
            batch_no=f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            source=DataSource.PILE_ALARM,
            strategy=BatchStrategy.IGNORE,
            created_by="demo_script",
            remark="演示批次 - 桩端告警数据导入",
        )
        batch = batch_service.create_batch(batch_data)
        print(f"   ✓ 批次创建成功: {batch.batch_no}")
        print(f"   ✓ 批次ID: {batch.id}")

        print("\n2. 导入示例工单数据...")
        with open("examples/sample_data.json", "r", encoding="utf-8") as f:
            sample_data = json.load(f)

        work_orders = [WorkOrderCreate(**item) for item in sample_data]
        result = batch_service.import_work_orders(batch.id, work_orders, BatchStrategy.IGNORE)
        print(f"   ✓ 导入完成: 总数={result.total_count}, 成功={result.success_count}, 忽略={result.ignored_count}, 失败={result.failed_count}")

        print("\n3. 查询工单列表...")
        wo_service = WorkOrderService(db)
        orders = wo_service.list_work_orders(limit=5, area="南山片区")
        print(f"   ✓ 南山片区工单数量: {len(orders)}")
        for wo in orders:
            print(f"     - {wo.order_no}: {wo.pile_no} ({wo.status})")

        if orders:
            test_wo = orders[0]
            print(f"\n4. 工单状态流转演示 ({test_wo.order_no}):")

            print(f"   当前状态: {test_wo.status}")

            print("   开始处理...")
            success, msg = wo_service.change_status(
                test_wo.id, WorkOrderStatus.PROCESSING, "张经理", "开始排查故障"
            )
            print(f"   ✓ {msg}")

            print("   提交复核...")
            success, msg = wo_service.change_status(
                test_wo.id, WorkOrderStatus.PENDING_REVIEW, "张经理", "故障已修复，申请复核"
            )
            print(f"   ✓ {msg}")

            print("   复核通过...")
            success, msg = wo_service.review(
                test_wo.id, "李总监", True, "复核通过，故障已确认修复", "经核实故障时长修正为4小时"
            )
            print(f"   ✓ {msg}")

            print("   冻结结算...")
            success, msg = wo_service.freeze(
                test_wo.id, "财务小王", "月度结算冻结"
            )
            print(f"   ✓ {msg}")

            detail = wo_service.get_work_order_detail(test_wo.id)
            wo = detail["work_order"]
            print(f"   当前状态: {wo.status}")
            print(f"   冻结前状态: {wo.status_before_freeze}")

        print("\n5. 处理离线告警恢复演示...")
        pending_orders = wo_service.list_work_orders(limit=1, status="pending")
        if pending_orders:
            offline_wo = pending_orders[0]
            print(f"   工单 {offline_wo.order_no} 原始故障时长: {offline_wo.fault_duration}小时")
            success, msg = wo_service.handle_offline_recovery(
                offline_wo.id, "运维主管", 4.5
            )
            print(f"   ✓ {msg}")

            updated = wo_service.get_work_order_by_id(offline_wo.id)
            print(f"   更新后故障时长: {updated.fault_duration}小时")
            print(f"   人工理由: {updated.manual_reason}")

        print("\n6. 导出汇总报表...")
        export_service = ExportService(db)
        stats = export_service.get_statistics_summary()
        print("   统计汇总:")
        for k, v in stats["汇总信息"].items():
            print(f"     {k}: {v}")

        print("\n   按状态统计:")
        for k, v in stats["按状态统计"].items():
            print(f"     {k}: {v}")

        print("\n   按片区统计:")
        for k, v in stats["按片区统计"].items():
            print(f"     {k}: {v}")

        excel_path = f"examples/export_demo_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        export_service.export_to_excel(output_path=excel_path)
        print(f"\n   ✓ Excel报表已导出: {excel_path}")

        print("\n7. 查询审计日志...")
        if orders:
            logs = detail["audit_logs"]
            print(f"   工单操作记录共 {len(logs)} 条:")
            for log in logs[:5]:
                print(f"     {log['operation_time']} - {log['operator']}: {log['operation_type']}")

        print("\n" + "=" * 60)
        print("演示完成！所有功能正常运行。")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ 错误: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    demo()
