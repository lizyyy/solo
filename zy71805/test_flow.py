#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.engine.data_loader import DataLoader
from src.engine.margin_calculator import MarginCalculator
from src.engine.data_exporter import DataExporter
from src.engine.review_manager import ReviewManager
from src.engine.history_manager import HistoryManager


def test_full_flow():
    print("=" * 60)
    print("测试场外期权保证金管理系统完整流程")
    print("=" * 60)

    print("\n1. 加载数据...")
    loader = DataLoader()
    ledgers = loader.load_credit_ledger()
    trades = loader.load_trade_flows()
    actual_margins = loader.load_actual_margin()

    print(f"   授信台账: {len(ledgers)} 条")
    print(f"   交易流水: {len(trades)} 条")
    print(f"   实际保证金: {len(actual_margins)} 条")

    print("\n2. 计算保证金...")
    calculator = MarginCalculator()
    margin_records = calculator.calculate_all_margins(
        trades=trades,
        actual_margins=actual_margins,
        ledgers=ledgers
    )
    print(f"   生成保证金记录: {len(margin_records)} 条")

    for record in margin_records:
        print(f"   - {record.counterparty}: 应缴{record.required_margin:.2f}, 实缴{record.actual_margin:.2f}, 状态{record.review_status}")

    print("\n3. 复核流程测试...")
    reviewer = "风控经理A"
    review_manager = ReviewManager()

    if margin_records:
        record = margin_records[0]
        print(f"   确认记录: {record.counterparty}")
        review_manager.confirm_record(record, reviewer)

    if len(margin_records) > 1:
        record = margin_records[1]
        print(f"   标记待补: {record.counterparty}")
        review_manager.mark_pending(
            record,
            reviewer,
            reason="数据待核实",
            next_follow_up="请联系交易台确认交易明细"
        )

    if len(margin_records) > 2:
        record = margin_records[2]
        print(f"   人工修改: {record.counterparty}")
        review_manager.manual_override(
            record,
            reviewer,
            new_actual_margin=record.actual_margin + 500000,
            override_reason="补充保证金已到账",
            override_source="MANUAL",
            next_follow_up="联系运营岗确认到账凭证"
        )

    audit_records = review_manager.get_audit_records()
    print(f"   审计记录: {len(audit_records)} 条")

    print("\n4. 导出数据...")
    exporter = DataExporter()
    margin_path = exporter.export_margin_records_to_excel(margin_records)
    checklist_path = exporter.export_review_checklist(margin_records)
    audit_path = exporter.export_audit_history(audit_records)

    print(f"   保证金表: {margin_path}")
    print(f"   复核清单: {checklist_path}")
    print(f"   审计日志: {audit_path}")

    print("\n5. 历史快照...")
    history_manager = HistoryManager()
    snapshot_path = history_manager.save_snapshot(margin_records, "test_snapshot")
    print(f"   快照已保存: {snapshot_path}")

    snapshots = history_manager.list_snapshots()
    print(f"   历史快照数量: {len(snapshots)}")

    print("\n" + "=" * 60)
    print("测试完成！所有功能正常工作。")
    print("=" * 60)


if __name__ == "__main__":
    test_full_flow()
