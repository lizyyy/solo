from bank_nav_verification.dedup import DedupService
from bank_nav_verification.models import SettlementType, TaxRateRemark


def _make_remarks():
    return [
        TaxRateRemark(
            original_line_number=1,
            product_code="P001",
            tax_rate=3.0,
            settlement_type=SettlementType.T_PLUS_1,
            remark_text="备注1",
        ),
        TaxRateRemark(
            original_line_number=2,
            product_code="P002",
            tax_rate=2.5,
            settlement_type=SettlementType.T_PLUS_1,
            remark_text="备注2",
        ),
    ]


def test_first_import_creates_new():
    svc = DedupService()
    remarks = _make_remarks()
    new, updated, batch = svc.dedup_import(remarks, operator="阿南")
    assert len(new) == 2
    assert len(updated) == 0
    assert batch.remark_count == 2


def test_duplicate_batch_skipped():
    svc = DedupService()
    remarks = _make_remarks()
    svc.dedup_import(remarks, operator="阿南")
    new2, updated2, batch2 = svc.dedup_import(remarks, operator="阿南")
    assert len(new2) == 0
    assert len(updated2) == 0


def test_partial_overlap_updates():
    svc = DedupService()
    remarks = _make_remarks()
    svc.dedup_import(remarks, operator="阿南")

    changed = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=4.0,
        settlement_type=SettlementType.T_PLUS_2,
        remark_text="备注1改了",
    )
    new_item = TaxRateRemark(
        original_line_number=3,
        product_code="P003",
        tax_rate=1.0,
        settlement_type=SettlementType.T_PLUS_0,
    )
    new, updated, batch = svc.dedup_import([changed, new_item], operator="阿南")
    assert len(new) == 1
    assert len(updated) == 1
    assert updated[0].tax_rate == 4.0
    assert updated[0].settlement_type == SettlementType.T_PLUS_2


def test_count_does_not_double():
    svc = DedupService()
    remarks = _make_remarks()
    svc.dedup_import(remarks, operator="阿南")
    svc.dedup_import(remarks, operator="阿南")
    svc.dedup_import(remarks, operator="阿南")
    assert len(svc._existing_keys) == 2


def test_reimport_with_one_field_changed_records_diff():
    svc = DedupService()
    r1 = TaxRateRemark(
        original_line_number=10,
        product_code="WH001",
        tax_rate=3.5,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="原始备注",
    )
    svc.dedup_import([r1], operator="阿南")

    r2 = TaxRateRemark(
        original_line_number=10,
        product_code="WH001",
        tax_rate=3.5,
        settlement_type=SettlementType.T_PLUS_2,
        remark_text="原始备注",
    )
    new, updated, batch = svc.dedup_import([r2], operator="阿南")
    assert len(new) == 0
    assert len(updated) == 1

    merged = updated[0]
    assert merged.settlement_type == SettlementType.T_PLUS_2
    assert len(merged.history) >= 1

    last = merged.history[-1]
    assert last.change_type.value == "import"
    fc_names = [fc.field_name for fc in last.field_changes]
    assert "settlement_type" in fc_names

    for fc in last.field_changes:
        if fc.field_name == "settlement_type":
            old_dict = fc.to_dict()
            assert old_dict["old_value"] != ""
            assert old_dict["new_value"] != ""
            assert old_dict["old_value"] != "N/A"
            assert old_dict["new_value"] != "N/A"


def test_same_identity_different_content_not_skipped():
    svc = DedupService()
    r1 = TaxRateRemark(
        original_line_number=10,
        product_code="WH001",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
        remark_text="旧",
    )
    svc.dedup_import([r1], operator="阿南")

    r2 = TaxRateRemark(
        original_line_number=10,
        product_code="WH001",
        tax_rate=4.0,
        settlement_type=SettlementType.T_PLUS_2,
        remark_text="新",
    )
    new, updated, batch = svc.dedup_import([r2], operator="阿南")
    assert len(updated) == 1
    assert updated[0].tax_rate == 4.0
