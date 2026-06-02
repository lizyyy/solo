from bank_nav_verification.history import HistoryService
from bank_nav_verification.models import ChangeType, SettlementType, TaxRateRemark


def test_full_diff():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="改T+2")
    r.remark_text = "加备注"
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="加备注")

    svc = HistoryService()
    diffs = svc.get_full_diff(r)
    assert len(diffs) == 2
    assert diffs[0].field_name == "settlement_type"
    assert diffs[1].field_name == "remark_text"


def test_settlement_changes_only():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="改T+2")
    r.remark_text = "xxx"
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="加备注")

    svc = HistoryService()
    changes = svc.get_settlement_changes(r)
    assert len(changes) == 1
    assert changes[0].field_name == "settlement_type"


def test_audit_trail():
    r = TaxRateRemark(
        original_line_number=7,
        product_code="P001",
        product_name="稳惠1号",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="T+1改T+2")

    svc = HistoryService()
    trail = svc.get_audit_trail(r)
    assert trail["original_line_number"] == 7
    assert trail["original_settlement_type"] == "T+1"
    assert trail["current_settlement_type"] == "T+2"
    assert trail["total_changes"] == 1
    assert trail["settlement_override_count"] == 0


def test_find_evidence_by_keyword():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="T+1改T+2")
    r.remark_text = "普通修改"
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="加备注")

    svc = HistoryService()
    evidence = svc.find_evidence(r, keyword="T+2")
    assert len(evidence) == 1
    assert evidence[0]["reason"] == "T+1改T+2"


def test_before_after():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    record = r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="改")

    svc = HistoryService()
    result = svc.get_before_after(r, record.id)
    assert result is not None
    assert result["change_id"] == record.id
    assert len(result["field_changes"]) == 1
