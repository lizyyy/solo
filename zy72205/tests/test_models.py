from bank_nav_verification.models import (
    ChangeType,
    FieldChange,
    RemarkStatus,
    SettlementType,
    TaxRateRemark,
)


def test_create_remark():
    r = TaxRateRemark(
        original_line_number=5,
        product_code="WH001",
        product_name="稳惠1号",
        tax_rate=3.5,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="税费率备注测试",
    )
    assert r.original_line_number == 5
    assert r.product_code == "WH001"
    assert r.settlement_type == SettlementType.T_PLUS_1
    assert r.original_settlement_type == SettlementType.T_PLUS_1
    assert r.status == RemarkStatus.IMPORTED
    assert r.history == []


def test_record_change_detects_diff():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=2.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    record = r.record_change(
        change_type=ChangeType.MANUAL_EDIT,
        operator="阿南",
        reason="T+1改为T+2",
    )
    assert record is not None
    assert record.change_type == ChangeType.MANUAL_EDIT
    assert record.operator == "阿南"
    assert len(record.field_changes) == 1
    fc = record.field_changes[0]
    assert fc.field_name == "settlement_type"
    assert fc.old_value == SettlementType.T_PLUS_1
    assert fc.new_value == SettlementType.T_PLUS_2


def test_record_change_no_diff_returns_none():
    r = TaxRateRemark(original_line_number=1, product_code="P001", tax_rate=1.0)
    record = r.record_change(
        change_type=ChangeType.MANUAL_EDIT,
        operator="test",
        reason="no change",
    )
    assert record is None


def test_change_history_accumulates():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=1.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.settlement_type = SettlementType.T_PLUS_2
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="改1")
    r.remark_text = "新增备注"
    r.record_change(change_type=ChangeType.MANUAL_EDIT, operator="阿南", reason="改2")

    history = r.get_change_history()
    assert len(history) == 2
    assert history[0]["change_type"] == "manual_edit"
    assert history[1]["change_type"] == "manual_edit"


def test_to_dict():
    r = TaxRateRemark(
        original_line_number=10,
        product_code="P002",
        tax_rate=5.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    d = r.to_dict()
    assert d["original_line_number"] == 10
    assert d["product_code"] == "P002"
    assert d["settlement_type"] == "T+1"
    assert d["original_settlement_type"] == "T+1"
    assert d["status"] == "imported"
