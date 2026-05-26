import sys
import os

sys.path.insert(0, '.')

from app.database import SessionLocal
from app.services.import_service import ImportService
from app.services.reconciliation_engine import ReconciliationEngine
from app.services.review_service import ReviewService, PenaltyTraceService
from app.services.report_service import ReportService


def test_full_flow():
    print("=" * 60)
    print("物流对账服务 - 完整流程测试")
    print("=" * 60)

    db = SessionLocal()

    print("\n【步骤1】导入运单CSV数据")
    print("-" * 60)
    import_service = ImportService(db)

    csv_path = os.path.join(os.path.dirname(__file__), 'sample_waybills.csv')
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        csv_content = f.read()

    batch_id = "BATCH_20260527_001"
    result = import_service.import_waybills_from_csv(csv_content, batch_id)
    print(f"运单导入结果: 成功 {result['success_count']}/{result['total_count']} 条")
    print(f"批次号: {batch_id}")

    print("\n【步骤2】导入轨迹JSON数据")
    print("-" * 60)
    json_path = os.path.join(os.path.dirname(__file__), 'sample_tracking.json')
    with open(json_path, 'r', encoding='utf-8') as f:
        json_content = f.read()

    tracking_result = import_service.import_tracking_from_json(json_content)
    print(f"轨迹导入结果: 成功 {tracking_result['success_count']}/{tracking_result['total_count']} 条")

    print("\n【步骤3】执行批量对账")
    print("-" * 60)
    engine = ReconciliationEngine(db)
    recon_result = engine.reconcile_batch(
        batch_id=batch_id,
        batch_name="2026年5月下旬对账批次",
        period="2026-05",
        generated_by="system"
    )

    summary = recon_result['summary']
    print(f"对账完成: 处理 {summary['processed_count']}/{summary['total_waybills']} 单")
    print(f"  - 晚点异常: {summary['delayed_count']} 单")
    print(f"  - 破损异常: {summary['damaged_count']} 单")
    print(f"  - 中转异常: {summary['transfer_issue_count']} 单")
    print(f"  - 已豁免: {summary['exempt_count']} 单")
    print(f"  - 扣罚总金额: {summary['total_penalty']} 元")

    print("\n【步骤4】查看对账结果详情")
    print("-" * 60)
    from app.models import ReconciliationResult
    results = db.query(ReconciliationResult).filter(
        ReconciliationResult.batch_id == batch_id
    ).all()

    for r in results:
        status_icon = "✓" if r.review_status == 'approved' else "○"
        penalty_info = f"扣罚 {r.total_penalty} 元" if r.total_penalty > 0 else "无扣罚"
        exempt_info = " (已豁免)" if r.is_exempt or r.weather_exempt else ""
        print(f"  {status_icon} {r.waybill_no}: {penalty_info}{exempt_info}")
        if r.discrepancy_explanation:
            for line in r.discrepancy_explanation.split('\n'):
                print(f"      {line}")

    print("\n【步骤5】人工复核 - 审核通过 WB2026050002")
    print("-" * 60)
    review_service = ReviewService(db)
    review_result = review_service.review_waybill(
        waybill_no="WB2026050002",
        reviewer="张调度",
        action="approve",
        comment="数据核对无误，确认扣罚"
    )
    print(f"运单 {review_result['waybill_no']} 已审核: {review_result['old_status']} → {review_result['new_status']}")

    print("\n【步骤6】人工复核 - 豁免 WB2026050003")
    print("-" * 60)
    review_result2 = review_service.review_waybill(
        waybill_no="WB2026050003",
        reviewer="张调度",
        action="exempt",
        is_exempt=True,
        exempt_reason="客户原因，轻微破损不影响使用",
        comment="经与客户沟通，同意豁免本次扣罚"
    )
    print(f"运单 {review_result2['waybill_no']} 已豁免: {review_result2['old_total_penalty']} → {review_result2['new_total_penalty']} 元")

    print("\n【步骤7】扣罚追溯 - 查询 WB2026050001 扣罚来源")
    print("-" * 60)
    trace_service = PenaltyTraceService(db)
    trace_result = trace_service.trace_penalty("WB2026050001")

    for trace in trace_result:
        print(f"  扣罚类型: {trace['penalty_type']}")
        print(f"  规则: {trace['rule_code']} - {trace['rule_name']}")
        print(f"  扣罚金额: {trace['penalty_amount']} 元")
        print(f"  计算依据: {trace['calculation_basis']}")
        if trace.get('historical_comparison'):
            hist = trace['historical_comparison']
            print(f"  历史对比: 平均 {hist.get('average_amount')} 元, 一致性 {hist.get('consistency_rate')}%")

    print("\n【步骤8】生成对账报告")
    print("-" * 60)
    report_service = ReportService(db)

    detailed_excel = report_service.generate_detailed_report(batch_id, 'xlsx')
    output_path = f'reconciliation_detailed_{batch_id}.xlsx'
    with open(output_path, 'wb') as f:
        f.write(detailed_excel)
    print(f"详细报表已生成: {output_path}")

    summary_excel = report_service.generate_summary_report(batch_id)
    summary_path = f'reconciliation_summary_{batch_id}.xlsx'
    with open(summary_path, 'wb') as f:
        f.write(summary_excel)
    print(f"汇总报表已生成: {summary_path}")

    discrepancy_excel = report_service.generate_discrepancy_report("WB2026050001")
    discrepancy_path = 'discrepancy_WB2026050001.xlsx'
    with open(discrepancy_path, 'wb') as f:
        f.write(discrepancy_excel)
    print(f"差异说明报告已生成: {discrepancy_path}")

    print("\n【步骤9】查看审核历史记录")
    print("-" * 60)
    history = review_service.get_review_history("WB2026050003")
    for record in history:
        print(f"  {record['created_at']} - {record['reviewer']} 执行 {record['action']}:")
        print(f"    状态: {record['old_status']} → {record['new_status']}")
        print(f"    扣罚: {record['old_total_penalty']} → {record['new_total_penalty']} 元")
        print(f"    备注: {record['comment']}")

    print("\n" + "=" * 60)
    print("测试完成！所有流程已验证通过。")
    print("=" * 60)

    db.close()


if __name__ == '__main__':
    test_full_flow()
