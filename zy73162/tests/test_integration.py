from __future__ import annotations

from datetime import datetime

from matrix_attr import (
    AttrResult,
    AttrStatus,
    AttributionRecord,
    AuditTrail,
    MatrixDecomposer,
    Note,
    ParamVersion,
    RecalcEngine,
    SourceFusion,
    SourceType,
    TeacherReport,
)
from matrix_attr.decomposition import EmptyInputError, ZeroDivisionSuspend
from matrix_attr.sources import FusionContext


def _make_param_old() -> ParamVersion:
    return ParamVersion(
        version="param_old_v1",
        created_at=datetime(2026, 6, 1),
        knowledge_points=["代数::因式分解", "几何::三角形", "代数::方程"],
        question_ids=["Q1001", "Q1002", "Q1003"],
        weight_matrix={
            ("Q1001", "代数::因式分解"): 0.7,
            ("Q1001", "代数::方程"): 0.3,
            ("Q1002", "几何::三角形"): 1.0,
            ("Q1003", "代数::方程"): 0.5,
            ("Q1003", "代数::因式分解"): 0.5,
        },
    )


def _make_param_current() -> ParamVersion:
    return ParamVersion(
        version="param_current_v2",
        created_at=datetime(2026, 6, 15),
        knowledge_points=["代数::因式分解", "几何::三角形", "代数::方程"],
        question_ids=["Q1001", "Q1002", "Q1003"],
        weight_matrix={
            ("Q1001", "代数::因式分解"): 0.4,
            ("Q1001", "代数::方程"): 0.6,
            ("Q1002", "几何::三角形"): 1.0,
            ("Q1003", "代数::方程"): 0.3,
            ("Q1003", "代数::因式分解"): 0.7,
        },
    )


def test_empty_param_raises() -> None:
    empty = ParamVersion(
        version="empty_v0",
        created_at=datetime.now(),
        knowledge_points=[],
        question_ids=[],
        weight_matrix={},
    )
    assert empty.is_empty() is True
    dec = MatrixDecomposer()
    rec = AttributionRecord(record_id="R0", question_id="Q1", student_id="S1")
    try:
        dec.apply_to_record(rec, empty, SourceType.PARAM_OLD, "empty_v0")
    except Exception as exc:
        assert isinstance(exc, (EmptyInputError,)) or rec.status == AttrStatus.SUSPENDED
    else:
        assert rec.status == AttrStatus.SUSPENDED, "空集合必须被拦截或挂起"


def test_zero_division_suspends() -> None:
    param = ParamVersion(
        version="zero_w",
        created_at=datetime.now(),
        knowledge_points=["kp1"],
        question_ids=["Q1"],
        weight_matrix={("Q1", "kp1"): 0.0},
    )
    dec = MatrixDecomposer()
    try:
        dec.decompose(param, "Q1", {"kp1": 1.0})
    except (ZeroDivisionSuspend, EmptyInputError):
        pass
    else:
        raise AssertionError("除零或空权重必须挂起")


def test_full_pipeline() -> None:
    param_old = _make_param_old()
    param_cur = _make_param_current()

    later_note = Note(
        note_id="note-001",
        source_type=SourceType.LATER_NOTE,
        author="叶老师",
        created_at=datetime(2026, 6, 18),
        content="代数::因式分解=0.9\n代数::方程=0.1",
        affects=["Q1001"],
        weight=0.8,
    )
    verbal_note = Note(
        note_id="note-verbal-002",
        source_type=SourceType.VERBAL_NOTE,
        author="排班同事",
        created_at=datetime(2026, 6, 18),
        content="学生记错公式",
    )

    ctx = FusionContext()
    ctx.add_param(param_old)
    ctx.add_param(param_cur)
    ctx.add_note(later_note)
    ctx.add_note(verbal_note)

    record = AttributionRecord(
        record_id="R-1001",
        question_id="Q1001",
        student_id="S-42",
    )

    dec = MatrixDecomposer()
    fusion = SourceFusion()
    audit = AuditTrail()

    record = fusion.apply(record, ctx, dec)
    audit.log(
        record,
        operator="system",
        source_ref="pipeline:auto",
        note="初次融合",
    )

    assert record.primary_cause is not None
    assert record.status in (AttrStatus.NORMAL, AttrStatus.SUSPENDED)
    assert len(record.influences) == 4

    recalc = RecalcEngine(dec, audit)
    extra = Note(
        note_id="note-extra-999",
        source_type=SourceType.LATER_NOTE,
        author="叶老师",
        created_at=datetime(2026, 6, 19),
        content="代数::方程=0.95",
        weight=0.5,
    )
    rerun_result = recalc.rerun_with_note(record, ctx, extra, operator="叶老师")
    assert rerun_result.chart_detail_consistent is True

    result: AttrResult = recalc.make_attr_result(record, fusion.applied)
    report = TeacherReport([result])

    example = report.example_text()
    assert "样例" in example
    assert "学生 S-42" in example

    rerun_text = report.rerun_note_text(rerun_result)
    assert "重跑说明" in rerun_text

    csv_txt = report.csv_detail()
    assert "knowledge_point" in csv_txt
    assert "代数::因式分解" in csv_txt

    summary = report.summary_text()
    assert "材料处理清单" in summary

    actions = report.material_actions()
    assert any(a.source_type == "参数表旧版" for a in actions)
    assert any(a.source_type == "后补备注" for a in actions)

    audit.mark_released(record, operator="叶老师", note="核对无误放行")
    assert record.status == AttrStatus.RELEASED
    hist = audit.history(record.record_id)
    assert len(hist) >= 2


def test_audit_sources_of_change() -> None:
    audit = AuditTrail()
    rec = AttributionRecord(record_id="R-x", question_id="Qx", student_id="Sx")
    audit.log(rec, operator="sys", source_ref="auto", new_cause="kp1")
    audit.log(rec, operator="叶老师", source_ref="note:x", new_cause="kp2")
    changes = audit.sources_of_change("R-x")
    assert len(changes) == 2
    assert changes[-1]["operator"] == "叶老师"
    assert changes[-1]["new_cause"] == "kp2"


def run_all() -> None:
    test_empty_param_raises()
    test_zero_division_suspends()
    test_full_pipeline()
    test_audit_sources_of_change()
    print("ALL TESTS PASSED")


if __name__ == "__main__":
    run_all()
