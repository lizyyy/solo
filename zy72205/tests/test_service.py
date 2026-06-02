from bank_nav_verification.models import SettlementType, TaxRateRemark
from bank_nav_verification.service import VerificationService
from bank_nav_verification.workflow import WorkflowStep


def _make_remark():
    return TaxRateRemark(
        original_line_number=5,
        product_code="WH001",
        product_name="稳惠1号",
        tax_rate=3.5,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="税费率备注",
    )


def test_import_then_t1_to_t2_flow():
    svc = VerificationService()
    remark = _make_remark()

    import_result = svc.import_remarks([remark], operator="阿南")
    assert import_result["status"] == "imported"
    assert import_result["new_count"] == 1
    remark_id = import_result["new_ids"][0]

    change_result = svc.change_settlement(
        remark_id, SettlementType.T_PLUS_2, operator="阿南", reason="银行要求延迟到账"
    )
    assert change_result["status"] == "flagged_for_manager"

    loaded = svc.get_remark(remark_id)
    assert loaded.flagged_for_manager is True
    assert loaded.original_settlement_type == SettlementType.T_PLUS_1
    assert loaded.settlement_type == SettlementType.T_PLUS_2

    audit = svc.get_audit_trail(remark_id)
    assert audit["original_line_number"] == 5
    assert audit["original_settlement_type"] == "T+1"
    assert audit["current_settlement_type"] == "T+2"
    assert audit["total_changes"] >= 1

    evidence = svc.get_evidence(remark_id, keyword="T+2")
    assert len(evidence["evidence"]) >= 1


def test_duplicate_import_no_double():
    svc = VerificationService()
    r1 = _make_remark()
    r2 = _make_remark()

    result1 = svc.import_remarks([r1], operator="阿南")
    assert result1["new_count"] == 1

    result2 = svc.import_remarks([r2], operator="阿南")
    assert result2["new_count"] == 0 or result2["updated_count"] == 1

    assert len(svc._remarks) == 1


def test_full_three_step_workflow():
    svc = VerificationService()
    remark = _make_remark()

    import_result = svc.import_remarks([remark], operator="阿南")
    remark_id = import_result["new_ids"][0]

    svc.fill_counter_flow_tail(remark_id, "A001", operator="阿南")
    svc.advance_workflow(remark_id, WorkflowStep.STEP_2_TAIL_REVIEW, operator="阿南")

    svc.update_reconciliation_note(remark_id, "对账完成", operator="阿南")
    svc.advance_workflow(remark_id, WorkflowStep.STEP_3_RECONCILIATION, operator="阿南")

    loaded = svc.get_remark(remark_id)
    assert loaded.status.value == "reconciliation_updated"
    assert len(loaded.history) >= 4


def test_t1_to_t2_then_rollback():
    svc = VerificationService()
    remark = _make_remark()

    import_result = svc.import_remarks([remark], operator="阿南")
    remark_id = import_result["new_ids"][0]

    svc.change_settlement(
        remark_id, SettlementType.T_PLUS_2, operator="阿南", reason="银行延迟"
    )
    loaded = svc.get_remark(remark_id)
    assert loaded.flagged_for_manager is True

    rollback_result = svc.rollback_settlement(
        remark_id, operator="基金经理", reason="复核未通过，改回T+1"
    )
    assert rollback_result["status"] == "rolled_back"
    loaded = svc.get_remark(remark_id)
    assert loaded.settlement_type == SettlementType.T_PLUS_1
    assert loaded.flagged_for_manager is False


def test_manager_approve_then_continue():
    svc = VerificationService()
    remark = _make_remark()

    import_result = svc.import_remarks([remark], operator="阿南")
    remark_id = import_result["new_ids"][0]

    svc.change_settlement(
        remark_id, SettlementType.T_PLUS_2, operator="阿南", reason="银行延迟"
    )

    approve_result = svc.manager_review(
        remark_id, approved=True, manager_operator="张经理", reason="确认T+2合理"
    )
    assert approve_result["status"] == "approved"

    svc.fill_counter_flow_tail(remark_id, "A001", operator="阿南")
    advance_result = svc.advance_workflow(
        remark_id, WorkflowStep.STEP_2_TAIL_REVIEW, operator="阿南"
    )
    assert advance_result["status"] == "advanced"


def test_evidence_chain_intact():
    svc = VerificationService()
    remark = _make_remark()

    import_result = svc.import_remarks([remark], operator="阿南")
    remark_id = import_result["new_ids"][0]

    svc.change_settlement(
        remark_id, SettlementType.T_PLUS_2, operator="阿南", reason="T+1到账改T+2"
    )

    svc.fill_counter_flow_tail(remark_id, "B123", operator="阿南")
    svc.update_reconciliation_note(remark_id, "对账说明已更新", operator="阿南")

    audit = svc.get_audit_trail(remark_id)
    assert audit["total_changes"] >= 3
    assert audit["original_line_number"] == 5
    assert audit["original_settlement_type"] == "T+1"

    evidence_t2 = svc.get_evidence(remark_id, keyword="T+2")
    assert len(evidence_t2["evidence"]) >= 1
