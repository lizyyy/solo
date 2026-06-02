import pytest

from bank_nav_verification.models import RemarkStatus, SettlementType, TaxRateRemark
from bank_nav_verification.workflow import WorkflowEngine, WorkflowError, WorkflowStep


def _make_imported_remark():
    r = TaxRateRemark(
        original_line_number=1,
        product_code="P001",
        tax_rate=3.0,
        settlement_type=SettlementType.T_PLUS_1,
    )
    r.status = RemarkStatus.IMPORTED
    return r


def test_initial_step():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    assert engine.get_current_step(remark) == WorkflowStep.STEP_1_IMPORT


def test_cannot_skip_steps():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    can, msg = engine.can_advance(remark, WorkflowStep.STEP_3_RECONCILIATION)
    assert not can
    assert "跳过" in msg


def test_cannot_advance_without_tail():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    can, msg = engine.can_advance(remark, WorkflowStep.STEP_2_TAIL_REVIEW)
    assert not can
    assert "柜台流水尾号" in msg


def test_advance_to_step2():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    remark.counter_flow_tail = "A001"
    transition = engine.advance(
        remark, WorkflowStep.STEP_2_TAIL_REVIEW, operator="阿南"
    )
    assert transition.from_step == WorkflowStep.STEP_1_IMPORT
    assert transition.to_step == WorkflowStep.STEP_2_TAIL_REVIEW
    assert remark.status == RemarkStatus.TAIL_REVIEWED


def test_advance_to_step3():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    remark.counter_flow_tail = "A001"
    engine.advance(remark, WorkflowStep.STEP_2_TAIL_REVIEW, operator="阿南")

    remark.reconciliation_note = "对账完成"
    transition = engine.advance(
        remark, WorkflowStep.STEP_3_RECONCILIATION, operator="阿南"
    )
    assert remark.status == RemarkStatus.RECONCILIATION_UPDATED


def test_flagged_remark_cannot_advance():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    remark.flagged_for_manager = True
    remark.flag_reason = "T+1改T+2待复核"
    can, msg = engine.can_advance(remark, WorkflowStep.STEP_2_TAIL_REVIEW)
    assert not can
    assert "基金经理复核" in msg


def test_manager_approve():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    remark.flagged_for_manager = True
    remark.flag_reason = "待复核"

    ok, msg = engine.manager_review_resolve(
        remark, approved=True, manager_operator="张经理", reason="确认T+2合理"
    )
    assert ok
    assert not remark.flagged_for_manager
    assert remark.status == RemarkStatus.PENDING_REVIEW


def test_manager_reject():
    engine = WorkflowEngine()
    remark = _make_imported_remark()
    remark.flagged_for_manager = True
    remark.flag_reason = "待复核"

    ok, msg = engine.manager_review_resolve(
        remark, approved=False, manager_operator="张经理", reason="要求改回T+1"
    )
    assert not ok
    assert remark.flagged_for_manager is True


def test_full_three_step_flow():
    engine = WorkflowEngine()
    remark = _make_imported_remark()

    remark.counter_flow_tail = "A001"
    engine.advance(remark, WorkflowStep.STEP_2_TAIL_REVIEW, operator="阿南")

    remark.reconciliation_note = "对账OK"
    engine.advance(remark, WorkflowStep.STEP_3_RECONCILIATION, operator="阿南")

    assert remark.status == RemarkStatus.RECONCILIATION_UPDATED
    assert len(remark.history) == 2
