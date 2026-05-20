#!/usr/bin/env python3
import sys
from models import ReviewAction
from importer import FileImporter
from reconciler import ReconciliationEngine
from reviewer import ReviewerService
from reporter import ReportGenerator
from datetime import datetime
import uuid


def main():
    print("=" * 60)
    print("       网点尾箱对账服务 - 命令行示例")
    print("=" * 60)
    print("\n[1] 生成示例数据...")
    sample_files = FileImporter.create_sample_files()
    print(f"   交接记录: {sample_files['transfers']}")
    print(f"   排班记录: {sample_files['schedules']}")
    print(f"   差错记录: {sample_files['errors']}")
    print("\n[2] 导入数据...")
    importer = FileImporter()
    transfers = importer.import_transfers(sample_files['transfers'])
    schedules = importer.import_schedules(sample_files['schedules'])
    errors = importer.import_errors(sample_files['errors'])
    print(f"   交接记录数: {len(transfers)}")
    print(f"   排班记录数: {len(schedules)}")
    print(f"   差错记录数: {len(errors)}")
    print("\n[3] 执行自动对账...")
    reconciler = ReconciliationEngine()
    reviewer = ReviewerService()
    reporter = ReportGenerator()
    reconciled_records = reconciler.reconcile(transfers, schedules, errors)
    summary = reviewer.generate_summary(reconciled_records)
    print(f"   总记录数: {summary.total_records}")
    print(f"   核对通过: {summary.matched_records}")
    print(f"   存在差异: {summary.discrepancy_records}")
    print(f"   现金总额: {summary.total_cash_amount:,.2f}")
    print(f"   支票总额: {summary.total_check_amount:,.2f}")
    print(f"   总计金额: {summary.grand_total:,.2f}")
    if summary.discrepancy_breakdown:
        print("\n   差异类型统计:")
        for dtype, count in summary.discrepancy_breakdown.items():
            print(f"     - {dtype}: {count} 条")
    print("\n[4] 查看单条记录说明 (T002):")
    record_t002 = next(r for r in reconciled_records if r.transfer_id == 'T002')
    print(reviewer.get_record_explanation(record_t002))
    print("\n[5] 复核记录 T002 - 放行 (补充双签说明):")
    reviewed = reviewer.review_record(
        record_t002,
        action=ReviewAction.APPROVE,
        reviewer_id='M001',
        reviewer_name='运营主管',
        notes='已核实，当天系统故障，双签已补签，准予放行',
        adjusted_cash=None,
        adjusted_check=None
    )
    print("   复核后状态:")
    print(reviewer.get_record_explanation(reviewed))
    print("\n[6] 重新计算 T003 金额:")
    record_t003 = next(r for r in reconciled_records if r.transfer_id == 'T003')
    print("   调整前:")
    print(reviewer.get_record_explanation(record_t003))
    recalculated = reconciler.recalculate_record(
        record_t003,
        new_cash=55000.00,
        new_check=15000.00,
        notes='核实原始凭证，确认为55000现金+15000支票'
    )
    print("\n   调整后:")
    print(reviewer.get_record_explanation(recalculated))
    print("\n[7] 生成对账报告...")
    from models import ReconciliationResult
    result = ReconciliationResult(
        reconciliation_id=str(uuid.uuid4()),
        batch_date=datetime.now().strftime("%Y-%m-%d"),
        created_at=datetime.now(),
        summary=reviewer.generate_summary(reconciled_records),
        records=reconciled_records
    )
    report = reporter.generate_explanation_report(result)
    report_path = '对账报告_示例.txt'
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"   文字报告已保存: {report_path}")
    csv_path = '对账报告_示例.csv'
    reporter.export_csv(result, csv_path)
    print(f"   CSV报告已保存: {csv_path}")
    json_path = '对账报告_示例.json'
    reporter.export_json(result, json_path)
    print(f"   JSON报告已保存: {json_path}")
    print("\n" + "=" * 60)
    print("示例运行完成！")
    print("启动Web服务: python main.py")
    print("API文档地址: http://localhost:8000/docs")
    print("=" * 60)


if __name__ == '__main__':
    main()
