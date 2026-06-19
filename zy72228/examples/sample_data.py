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
            flow_id="FLOW202606080001",
            flow_tail="0001",
            trade_date=date(2026, 6, 8),
            amount=500000.00,
            counterparty="大宗商品交易所A",
            settlement_type=SettlementType.T1,
            remark="铜保证金缴纳",
            source=RecordSource.NORMAL
        ),
        CounterFlow(
            flow_id="FLOW202606080002",
            flow_tail="0002",
            trade_date=date(2026, 6, 8),
            amount=300000.00,
            counterparty="大宗商品交易所A",
            settlement_type=SettlementType.T1,
            remark="铝保证金缴纳",
            source=RecordSource.NORMAL
        ),
        CounterFlow(
            flow_id="FLOW202606080003",
            flow_tail="0003",
            trade_date=date(2026, 6, 8),
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
            record_id="MR20260608001",
            trade_date=date(2026, 6, 8),
            margin_type="铜保证金",
            amount=500000.00,
            direction="缴",
            linked_flow_id="FLOW202606080001",
            email_remark="林姐您好：\n今天铜保证金缴纳，流水尾号0005，金额50万，请核对。\n附件是客户经理签字的确认单。",
            email_attachment_info="铜保证金确认单_20260608.pdf",
            source=RecordSource.NORMAL
        ),
        MarginRecord(
            record_id="MR20260608002",
            trade_date=date(2026, 6, 8),
            margin_type="铝保证金",
            amount=300000.00,
            direction="缴",
            linked_flow_id="FLOW202606080002",
            email_remark="铝保证金缴纳无误，尾号0002",
            source=RecordSource.NORMAL
        ),
    ]
    return records


def create_supplement_record():
    return MarginRecord(
        record_id="MR20260608003",
        trade_date=date(2026, 6, 8),
        margin_type="锌保证金",
        amount=200000.00,
        direction="缴",
        linked_flow_id="FLOW202606080003",
        email_remark="补录：昨天漏记的锌保证金，金额20万，尾号0003",
        source=RecordSource.SUPPLEMENT
    )


def create_manual_modified_flow():
    return CounterFlow(
        flow_id="FLOW202606080004",
        flow_tail="0004",
        trade_date=date(2026, 6, 8),
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
    print("大宗商品保证金联动系统 - 完整流程演示")
    print("=" * 70)
    print()

    importer = DataImporter()
    conflict_detector = ConflictDetector(importer)
    self_checker = SelfChecker(conflict_detector)
    approval_flow = ApprovalFlow(conflict_detector=conflict_detector)
    recon_manager = ReconciliationManager()

    # ====== 步骤1: 柜台流水第一次导入 ======
    print("[步骤1] 柜台流水第一次导入")
    print("-" * 70)
    flows = create_sample_flows()
    records = create_sample_records_with_conflict()
    print(f"  导入柜台流水: {len(flows)} 笔")
    for f in flows:
        print(f"    {f.flow_id}  尾号={f.flow_tail}  金额={f.amount:,.2f}  到账={f.settlement_type.value}  备注={f.remark}")
    print(f"  导入保证金记录: {len(records)} 笔")
    for r in records:
        print(f"    {r.record_id}  关联={r.linked_flow_id}  金额={r.amount:,.2f}")
        if r.email_remark:
            print(f"      邮件备注: {r.email_remark[:60]}...")
    print()

    # ====== 步骤2: 冲突检测 ======
    print("[步骤2] 冲突检测（柜台流水尾号 vs 客户经理邮件备注）")
    print("-" * 70)
    conflicts = conflict_detector.detect_conflicts(flows, records)
    print(f"  发现冲突: {len(conflicts)} 处")
    if len(conflicts) == 0:
        print("  (无冲突)")
    for conflict in conflicts:
        print(conflict_detector.format_conflict_for_user(conflict))
        print()
    assert len(conflicts) == 1, f"预期只有1处尾号冲突，实际得到{len(conflicts)}处"
    assert conflicts[0].flow_tail_counter == "0001", "冲突柜台尾号应为0001"
    assert conflicts[0].flow_tail_email == "0005", "冲突邮件尾号应为0005"
    assert conflicts[0].email_amount == 500000.0, f"邮件金额应为500000.00，实际为{conflicts[0].email_amount}"
    print("  >> 断言通过：冲突数=1, 柜台尾号=0001, 邮件尾号=0005, 邮件金额=500,000.00")
    print()

    # ====== 步骤3: 林姐补看客户经理邮件，确认冲突 ======
    print("[步骤3] 基金会计林姐补看邮件，确认冲突")
    print("-" * 70)
    if conflicts:
        conflict = conflicts[0]
        record = next((r for r in records if r.linked_flow_id == conflict.flow_id), None)
        if record:
            approval_item = approval_flow.submit_for_approval(record, conflict, flows[0])
            success = approval_flow.approve_by_linjie(record.record_id, "柜台尾号0001为准确值，邮件尾号0005为客户经理笔误")
            print(f"  林姐审批结果: {'通过' if success else '失败'}")
            print(f"  保证金记录状态: {record.approval_status.value}")
            assert record.approval_status == ApprovalStatus.APPROVED
            print("  >> 断言通过：保证金记录状态=已确认")

            conflict_after = conflict_detector.conflicts[0]
            print(f"  冲突记录状态: {conflict_after.resolution.value}")
            assert conflict_after.resolution == ApprovalStatus.APPROVED, \
                f"冲突确认后resolution应为'已确认'，实际为'{conflict_after.resolution.value}'"
            print("  >> 断言通过：冲突记录状态=已确认（与保证金记录一致）")

            conflict_summary = conflict_detector.get_conflict_summary()
            print(f"  冲突汇总: 总冲突={conflict_summary['总冲突数']}, "
                  f"待确认={conflict_summary['待确认']}, 已确认={conflict_summary['已确认']}, "
                  f"已驳回={conflict_summary['已驳回']}")
            assert conflict_summary["待确认"] == 0, \
                f"林姐确认后冲突待确认数应为0，实际为{conflict_summary['待确认']}"
            assert conflict_summary["已确认"] == 1, \
                f"林姐确认后冲突已确认数应为1，实际为{conflict_summary['已确认']}"
            print("  >> 断言通过：冲突汇总 待确认=0, 已确认=1（与明细一致）")
    print()

    # ====== 步骤4: 导入补录材料 ======
    print("[步骤4] 导入补录材料")
    print("-" * 70)
    supplement_record = create_supplement_record()
    records.append(supplement_record)
    print(f"  补录保证金记录: {supplement_record.margin_type} {supplement_record.amount:,.2f}")
    print(f"  来源: {supplement_record.source.value}")
    print()

    # ====== 步骤5: 手工修改T+1为T+2 ======
    print("[步骤5] 手工修改T+1为T+2（碰到T+1改T+2，不急着归正常，留给基金经理复核）")
    print("-" * 70)
    modified_flow = create_manual_modified_flow()
    flows.append(modified_flow)
    modified_record = MarginRecord(
        record_id="MR20260608004",
        trade_date=date(2026, 6, 8),
        margin_type="铅保证金",
        amount=400000.00,
        direction="缴",
        linked_flow_id="FLOW202606080004",
        email_remark="客户要求T+2到账，请林姐确认后提交基金经理复核",
        source=RecordSource.MANUAL
    )
    records.append(modified_record)
    approval_item = approval_flow.submit_for_approval(modified_record, None, modified_flow)
    linjie_ok = approval_flow.approve_by_linjie(modified_record.record_id, "确认手工修改，提交基金经理复核")
    print(f"  林姐确认修改 -> 提交基金经理复核")
    print(f"  记录状态: {modified_record.approval_status.value}")
    assert modified_record.approval_status == ApprovalStatus.PENDING_REVIEW, \
        f"T+2手工修改林姐确认后应为'待基金经理复核'，实际为{modified_record.approval_status.value}"
    print("  >> 断言通过：记录状态=待基金经理复核（不急着归正常）")
    print()

    # ====== 步骤6: 基金经理复核 ======
    print("[步骤6] 基金经理复核T+2手工修改")
    print("-" * 70)
    manager_ok = approval_flow.review_by_manager(modified_record.record_id, True, "确认客户要求T+2到账")
    print(f"  基金经理复核结果: {'通过' if manager_ok else '失败'}")
    print(f"  记录状态: {modified_record.approval_status.value}")
    assert modified_record.approval_status == ApprovalStatus.REVIEWED
    print("  >> 断言通过：记录状态=已复核")
    print()

    # ====== 步骤7: 对账说明更新 ======
    print("[步骤7] 对账说明更新")
    print("-" * 70)
    note = recon_manager.create_note(
        trade_date=date(2026, 6, 8),
        content="2026年6月8日大宗商品保证金对账情况：\n1. 铜保证金50万：尾号冲突已确认，以柜台系统为准\n2. 铝保证金30万：核对无误\n3. 锌保证金20万：补录材料",
        created_by="林姐",
        related_record_ids=[r.record_id for r in records[:3]],
        related_flow_ids=[f.flow_id for f in flows[:3]]
    )
    print(f"  创建对账说明: {note.note_id}")

    updated_note = recon_manager.update_note(
        note.note_id,
        new_content="2026年6月8日大宗商品保证金对账情况：\n1. 铜保证金50万：尾号冲突已确认，以柜台系统为准\n2. 铝保证金30万：核对无误\n3. 锌保证金20万：补录材料\n4. 铅保证金40万：手工改为T+2到账，基金经理已复核",
        updated_by="林姐",
        add_record_ids=[modified_record.record_id],
        add_flow_ids=[modified_flow.flow_id]
    )
    print(f"  更新对账说明: 版本v{updated_note.version}")
    assert updated_note.version == 2, f"对账说明版本应为2，实际为{updated_note.version}"
    assert modified_record.record_id in updated_note.related_record_ids
    print("  >> 断言通过：版本=v2, 铅保证金记录已关联")
    print(recon_manager.format_note_for_display(updated_note, show_history=True))
    print()

    # ====== 步骤8: 系统自检 ======
    print("[步骤8] 系统自检")
    print("-" * 70)
    original_flows = create_sample_flows()
    check_result = self_checker.run_all_checks(flows, records, original_flows)
    print(self_checker.format_check_result(check_result))

    failed = self_checker.get_failed_checks(check_result)
    t1_t2_check = next((c for c in check_result.check_items if c.check_name == "T+1→T+2手工修改检测"), None)
    assert t1_t2_check is not None, "应有T+1→T+2检查项"
    assert not t1_t2_check.passed, "手工T+2流水存在时，T+1→T+2检查不应通过"
    assert "FLOW202606080004" in t1_t2_check.affected_records, \
        f"受影响记录应包含FLOW202606080004，实际为{t1_t2_check.affected_records}"
    print("  >> 断言通过：T+1→T+2检查检出手工修改，FLOW202606080004在受影响列表中")
    print()

    # ====== 步骤9: 生成对账报告（含冲突状态） ======
    print("[步骤9] 生成对账报告（含冲突状态）")
    print("-" * 70)
    report = recon_manager.generate_reconciliation_report(
        date(2026, 6, 8), records, flows,
        conflicts=conflict_detector.conflicts
    )
    print(report)
    print()

    # ====== 交叉核对：明细、汇总、报告状态一致性 ======
    print("交叉核对：明细状态 vs 汇总 vs 报告")
    print("-" * 70)

    conflict_detail_status = conflict_detector.conflicts[0].resolution.value
    conflict_summary_data = conflict_detector.get_conflict_summary()
    conflict_summary_pending = conflict_summary_data["待确认"]
    conflict_summary_approved = conflict_summary_data["已确认"]
    print(f"  铜保证金冲突明细状态: {conflict_detail_status}")
    print(f"  冲突汇总: 待确认={conflict_summary_pending}, 已确认={conflict_summary_approved}")

    assert conflict_detail_status == "已确认", \
        f"冲突明细状态应为'已确认'，实际为'{conflict_detail_status}'"
    assert conflict_summary_pending == 0, \
        f"冲突汇总待确认应为0，实际为{conflict_summary_pending}"
    assert conflict_summary_approved == 1, \
        f"冲突汇总已确认应为1，实际为{conflict_summary_approved}"
    print("  >> 断言通过：明细=已确认, 汇总待确认=0, 汇总已确认=1（三者一致）")

    record_status = records[0].approval_status.value
    print(f"  铜保证金记录审批状态: {record_status}")
    assert record_status == "已确认", f"铜保证金记录状态应为'已确认'，实际为'{record_status}'"
    print("  >> 断言通过：冲突明细=已确认, 保证金记录=已确认（跨系统一致）")
    print()

    # ====== 审批状态汇总 ======
    print("审批状态汇总")
    print("-" * 70)
    summary = approval_flow.get_approval_summary()
    for key, value in summary.items():
        print(f"  {key}: {value}")
    assert summary["已通过"] >= 1, "应有至少1条已通过"
    assert summary["待基金经理复核"] == 0, "基金经理已复核，不应有待复核项"
    print("  >> 断言通过：已通过>=1, 待基金经理复核=0")
    print()

    # ====== 冲突状态汇总 ======
    print("冲突状态汇总")
    print("-" * 70)
    conflict_summary = conflict_detector.get_conflict_summary()
    for key, value in conflict_summary.items():
        print(f"  {key}: {value}")
    assert conflict_summary["总冲突数"] == 1, f"总冲突数应为1，实际为{conflict_summary['总冲突数']}"
    assert conflict_summary["待确认"] == 0, f"待确认应为0，实际为{conflict_summary['待确认']}"
    assert conflict_summary["已确认"] == 1, f"已确认应为1，实际为{conflict_summary['已确认']}"
    print("  >> 断言通过：总冲突=1, 待确认=0, 已确认=1")
    print()

    print("=" * 70)
    print("全部断言通过，演示完成！")
    print("=" * 70)


if __name__ == "__main__":
    demo_workflow()
