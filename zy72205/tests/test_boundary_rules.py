from bank_nav_verification.boundary_rules import (
    BoundaryAction,
    BoundaryRuleEngine,
    OriginalSettlementDeviationRule,
    SettlementShiftRule,
)
from bank_nav_verification.models import RemarkStatus, SettlementType, TaxRateRemark


def _make_remark(settlement=SettlementType.T_PLUS_1):
    return TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=3.0,
        settlement_type=settlement,
    )


def test_t1_to_t2_flagged():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_1)
    results = engine.evaluate_settlement_change(remark, SettlementType.T_PLUS_2)
    assert any(r.action == BoundaryAction.FLAG_FOR_REVIEW for r in results)


def test_t2_to_t1_allowed():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_2)
    results = engine.evaluate_settlement_change(remark, SettlementType.T_PLUS_1)
    assert all(r.action == BoundaryAction.ALLOW for r in results)


def test_no_change_allowed():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_1)
    results = engine.evaluate_settlement_change(remark, SettlementType.T_PLUS_1)
    assert all(r.action == BoundaryAction.ALLOW for r in results)


def test_apply_t1_to_t2_flags_manager():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_1)
    applied, results = engine.apply_settlement_change(
        remark, SettlementType.T_PLUS_2, operator="阿南"
    )
    assert not applied
    assert remark.flagged_for_manager is True
    assert remark.status == RemarkStatus.FLAGGED_FOR_MANAGER
    assert remark.settlement_type == SettlementType.T_PLUS_2


def test_deviation_over_one_blocked():
    rule = OriginalSettlementDeviationRule()
    remark = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=1.0,
        settlement_type=SettlementType.T_PLUS_0,
    )
    remark.original_settlement_type = SettlementType.T_PLUS_0
    result = rule.evaluate(remark, SettlementType.T_PLUS_2)
    assert result.action == BoundaryAction.BLOCK


def test_rollback_to_original():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_1)
    engine.apply_settlement_change(remark, SettlementType.T_PLUS_2, operator="阿南")
    assert remark.settlement_type == SettlementType.T_PLUS_2

    rolled = engine.rollback_settlement(remark, operator="基金经理", reason="复核未通过")
    assert rolled is True
    assert remark.settlement_type == SettlementType.T_PLUS_1
    assert remark.flagged_for_manager is False
    assert remark.status == RemarkStatus.PENDING_REVIEW


def test_rollback_no_change():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_1)
    rolled = engine.rollback_settlement(remark)
    assert rolled is False


def test_flagged_remark_blocks_further_changes():
    engine = BoundaryRuleEngine()
    remark = _make_remark(SettlementType.T_PLUS_1)
    engine.apply_settlement_change(remark, SettlementType.T_PLUS_2, operator="阿南")
    assert remark.flagged_for_manager

    applied, results = engine.apply_settlement_change(
        remark, SettlementType.T_PLUS_3, operator="阿南"
    )
    assert not applied
    assert any(r.action == BoundaryAction.BLOCK for r in results)
