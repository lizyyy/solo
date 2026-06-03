import sys
import os
from datetime import datetime, date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src import (
    CounterFlow,
    MarginRecord,
    SettlementType,
    RecordSource,
    ApprovalStatus,
    DataImporter,
    ConflictDetector,
    SelfChecker,
    ApprovalFlow,
    ReconciliationManager
)


def create_sample_flows():
    flows = [
        CounterFlow(
            flow_id="FLOW202606030001",
            flow_tail="0001",
            trade_date=date(2026, 6, 3),
            amount=500000.00,
            counterparty="大宗商品交易所A",
            settlement_type=SettlementType.T1,
            remark="铜保证金缴纳",
            source=RecordSource.NORMAL
        ),
        CounterFlow(
            flow_id="FLOW202606030002",
            flow_tail="0002",
            trade_date=date(2026, 6, 3),
            amount=300000.00,
            counterparty="大宗商品交易所A",
            settlement_type=SettlementType.T1,
            remark="铝保证金缴纳",
            source=RecordSource.NORMAL
        ),
        CounterFlow(
            flow_id="FLOW202606030003",
            flow_tail="0003",
            trade_date=date(2026, 6, 3),
            amount=200000.00,
            counterparty="大宗商品交易所B",
            settlement_type=SettlementType.T1,
            remark="锌保证金缴纳",
            source=RecordSource.NORMAL
        ),
    ]
    return flows


def create_sample_records_with_conflict():
    records = [
        MarginRecord(
            record_id="MR202606030001",
            trade_date=date(2026, 6, 3),
            margin_type="铜保证金",
            amount=500000.00,
            direction="缴",
            linked_flow_id="FLOW202606030001",
            email_remark="""林姐您好：
今天铜保证金缴纳，流水尾号0005，金额50万，请核对。
附件是客户经理签字的确认单。""",
            email_attachment_info="铜保证金确认单_20260603.pdf",
            source=RecordSource.NORMAL
        ),
        MarginRecord(
            record_id="MR202606030002",
            trade_date=date(2026, 6, 3),
            margin_type="铝保证金",
            amount=300000.00,
            direction="缴",
            linked_flow_id="FLOW202606030002",
            email_remark="铝保证金缴纳无误，尾号0002",
            source=RecordSource.NORMAL
        ),
    ]
    return records


def create_supplement_record():
    return MarginRecord(
        record_id="MR202606030003",
        trade_date=date(2026, 6, 3),
        margin_type="锌保证金",
        amount=200000.00,
        direction="缴",
        linked_flow_id="FLOW202606030003",
        email_remark="补录：昨天漏记的锌保证金，金额20万，尾号0003",
        source=RecordSource.SUPPLEMENT
    )


def create_manual_modified_flow():
    return CounterFlow(
        flow_id="FLOW202606030004",
        flow_tail="0004",
        trade_date=date(2026, 6, 3),
        amount=400000.00,
        counterparty="大宗商品交易所A",
        settlement_type=SettlementType.T2,
        remark="铅保证金缴纳，客户要求T+2到账",
        source=RecordSource.MANUAL,
        is_manual_modified=True,
        modified_by="林姐",
        modified_time=datetime.now()
    )


def demo_workflow():
    print("=" * 70)
    print("📦 大宗商品保证金联动系统 - 完整流程演示")
    print("=" * 70)
    print()
    
    importer = DataImporter()
    conflict_detector = ConflictDetector(importer)
    self_checker = SelfChecker(conflict_detector)
    approval_flow = ApprovalFlow()
    recon_manager = ReconciliationManager()
    
    print("📥 步骤1: 导入正常材料")
    print("-" * 70)
    flows = create_sample_flows()
    records = create_sample_records_with_conflict()
    print(f"   导入柜台流水: {len(flows)} 笔")
    print(f"   导入保证金记录: {len(records)} 笔")
    print()
    
    print("🔍 步骤2: 冲突检测（柜台流水尾号 vs 邮件备注）")
    print("-" * 70)
    conflicts = conflict_detector.detect_conflicts(flows, records)
    print(f"   发现冲突: {len(conflicts)} 处")
    print()
    for conflict in conflicts:
        print(conflict_detector.format_conflict_for_user(conflict))
        print()
    
    print("✅ 步骤3: 林姐确认冲突")
    print("-" * 70)
    if conflicts:
        conflict = conflicts[0]
        record = next((r for r in records if r.linked_flow_id == conflict.flow_id), None)
        if record:
            approval_item = approval_flow.submit_for_approval(record, conflict, flows[0])
            print("   提交林姐审批...")
            success = approval_flow.approve_by_linjie(record.record_id, "核对无误，以柜台为准")
            print(f"   林姐审批结果: {'通过' if success else '失败'}")
            print(f"   记录状态: {record.approval_status.value}")
    print()
    
    print("📝 步骤4: 导入补录材料")
    print("-" * 70)
    supplement_record = create_supplement_record()
    records.append(supplement_record)
    print(f"   补录保证金记录: {supplement_record.margin_type} {supplement_record.amount:,.2f}")
    print(f"   来源: {supplement_record.source.value}")
    print()
    
    print("✏️  步骤5: 手工修改T+1为T+2")
    print("-" * 70)
    modified_flow = create_manual_modified_flow()
    flows.append(modified_flow)
    modified_record = MarginRecord(
        record_id="MR202606030004",
        trade_date=date(2026, 6, 3),
        margin_type="铅保证金",
        amount=400000.00,
        direction="缴",
        linked_flow_id="FLOW202606030004",
        email_remark="客户要求T+2到账，请林姐确认后提交基金经理复核",
        source=RecordSource.MANUAL
    )
    records.append(modified_record)
    approval_item = approval_flow.submit_for_approval(modified_record, None, modified_flow)
    approval_flow.approve_by_linjie(modified_record.record_id, "确认手工修改")
    print(f"   林姐确认修改，提交基金经理复核")
    print(f"   记录状态: {modified_record.approval_status.value}")
    print()
    
    print("🔬 步骤6: 系统自检")
    print("-" * 70)
    original_flows = create_sample_flows()
    check_result = self_checker.run_all_checks(flows, records, original_flows)
    print(self_checker.format_check_result(check_result))
    print()
    
    print("📝 步骤7: 创建对账说明")
    print("-" * 70)
    note = recon_manager.create_note(
        trade_date=date(2026, 6, 3),
        content="""2026年6月3日大宗商品保证金对账情况：
1. 铜保证金50万：尾号冲突已确认，以柜台系统为准
2. 铝保证金30万：核对无误
3. 锌保证金20万：补录材料
4. 铅保证金40万：手工改为T+2到账，待基金经理复核""",
        created_by="林姐",
        related_record_ids=[r.record_id for r in records],
        related_flow_ids=[f.flow_id for f in flows]
    )
    print(recon_manager.format_note_for_display(note, show_history=False))
    print()
    
    print("📊 步骤8: 生成对账报告")
    print("-" * 70)
    report = recon_manager.generate_reconciliation_report(date(2026, 6, 3), records, flows)
    print(report)
    print()
    
    print("📈 审批状态汇总")
    print("-" * 70)
    summary = approval_flow.get_approval_summary()
    for key, value in summary.items():
        print(f"   {key}: {value}")
    print()
    
    print("=" * 70)
    print("✅ 演示完成！")
    print("=" * 70)


if __name__ == "__main__":
    demo_workflow()
