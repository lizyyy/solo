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


def test_upgrade_note_e2e():
    svc = VerificationService()
    remark = _make_remark()

    import_result = svc.import_remarks([remark], operator="阿南")
    remark_id = import_result["new_ids"][0]

    upgrade_result = svc.add_upgrade_note(
        remark_id, "T+1到账手工改为T+2，银行确认需延迟", operator="阿南"
    )
    assert upgrade_result["status"] == "updated"
    loaded = svc.get_remark(remark_id)
    assert loaded.upgrade_note == "T+1到账手工改为T+2，银行确认需延迟"

    audit = svc.get_audit_trail(remark_id)
    last_history = audit["history"][-1]
    assert last_history["change_type"] == "upgrade_note"

    fc_list = last_history["field_changes"]
    assert len(fc_list) >= 1
    for fc in fc_list:
        if fc["field_name"] == "upgrade_note":
            assert fc["old_value"] == ""
            assert fc["new_value"] != ""
            assert fc["old_value"] != "N/A"
            assert fc["new_value"] != "N/A"


def test_anan_changes_one_remark_history_readable():
    svc = VerificationService()
    r1 = TaxRateRemark(
        original_line_number=5,
        product_code="WH001",
        product_name="稳惠1号",
        tax_rate=3.5,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="原始备注",
    )
    r2 = TaxRateRemark(
        original_line_number=6,
        product_code="WH002",
        product_name="稳惠2号",
        tax_rate=2.0,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="另一条",
    )
    svc.import_remarks([r1, r2], operator="阿南")
    id1 = [rid for rid, r in svc._remarks.items() if r.product_code == "WH001"][0]

    svc.change_settlement(id1, SettlementType.T_PLUS_2, operator="阿南", reason="银行延迟")

    audit = svc.get_audit_trail(id1)
    settlement_history = [
        h for h in audit["history"]
        if any(fc["field_name"] == "settlement_type" for fc in h["field_changes"])
    ]
    assert len(settlement_history) >= 1
    for h in settlement_history:
        for fc in h["field_changes"]:
            if fc["field_name"] == "settlement_type":
                assert fc["old_value"] not in ("", "N/A", "None", "repr")
                assert fc["new_value"] not in ("", "N/A", "None", "repr")
                assert fc["old_value"] == "T+1"
                assert fc["new_value"] == "T+2"


def test_reimport_changed_one_remark_diff_not_na():
    svc = VerificationService()
    r1 = TaxRateRemark(
        original_line_number=10,
        product_code="WH001",
        tax_rate=3.5,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="旧备注",
    )
    svc.import_remarks([r1], operator="阿南")
    id1 = [rid for rid, r in svc._remarks.items() if r.product_code == "WH001"][0]

    r1_updated = TaxRateRemark(
        original_line_number=10,
        product_code="WH001",
        tax_rate=4.0,
        settlement_type=SettlementType.T_PLUS_2,
        remark_text="新备注",
    )
    svc.import_remarks([r1_updated], operator="阿南")

    loaded = svc.get_remark(id1)
    import_changes = [
        h for h in loaded.get_change_history()
        if h["change_type"] == "import" and len(h["field_changes"]) > 0
    ]
    assert len(import_changes) >= 1

    last_import = import_changes[-1]
    for fc in last_import["field_changes"]:
        assert fc["old_value"] != "N/A"
        assert fc["new_value"] != "N/A"
        if fc["field_name"] == "settlement_type":
            assert fc["old_value"] == "T+1"
            assert fc["new_value"] == "T+2"
        if fc["field_name"] == "tax_rate":
            assert fc["old_value"] == "3.5"
            assert fc["new_value"] == "4.0"


def test_diff_description_not_na():
    svc = VerificationService()
    remark = _make_remark()
    import_result = svc.import_remarks([remark], operator="阿南")
    remark_id = import_result["new_ids"][0]

    svc.change_settlement(
        remark_id, SettlementType.T_PLUS_2, operator="阿南", reason="银行延迟"
    )
    svc.add_upgrade_note(remark_id, "升阻: T+1改T+2", operator="阿南")

    loaded = svc.get_remark(remark_id)
    from bank_nav_verification.history import HistoryService
    hist = HistoryService()
    diffs = hist.get_full_diff(loaded)
    assert len(diffs) >= 2

    for d in diffs:
        assert d.old_value != "N/A"
        assert d.new_value != "N/A"
        assert d.diff_description != ""
        assert "N/A" not in d.diff_description
        d_dict = d.to_dict()
        assert d_dict["old_value"] != "N/A"
        assert d_dict["new_value"] != "N/A"
        assert d_dict["diff_description"] != ""
