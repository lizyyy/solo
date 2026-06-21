from __future__ import annotations

from datetime import datetime

from matrix_attr import (
    AttrResult,
    AttributionRecord,
    AuditTrail,
    MatrixDecomposer,
    Note,
    ParamVersion,
    RecalcEngine,
    SourceType,
    TeacherReport,
)
from matrix_attr.sources import FusionContext


def main() -> None:
    param = ParamVersion(
        version="param_acceptance_v1",
        created_at=datetime(2026, 6, 22),
        knowledge_points=["kp1", "kp2"],
        question_ids=["Q9"],
        weight_matrix={("Q9", "kp1"): 1.0},
    )
    error_vector = {"kp2": 1.0}

    later_note = Note(
        note_id="note-accept-1",
        source_type=SourceType.LATER_NOTE,
        author="叶老师",
        created_at=datetime(2026, 6, 22),
        content="kp1=0.6",
        weight=0.5,
    )

    ctx = FusionContext()
    ctx.add_param(param)
    ctx.add_note(later_note)

    dec = MatrixDecomposer()
    audit = AuditTrail()
    rec = AttributionRecord(record_id="R-ACC", question_id="Q9", student_id="S-ACC")
    rec = dec.apply_to_record(
        rec, param, SourceType.PARAM_CURRENT, "param_acceptance_v1", error_vector
    )

    applied = [(SourceType.PARAM_CURRENT, "param_acceptance_v1")]

    recalc = RecalcEngine(dec, audit)
    extra = Note(
        note_id="note-accept-extra",
        source_type=SourceType.LATER_NOTE,
        author="叶老师",
        created_at=datetime(2026, 6, 22),
        content="kp2=0.5",
    )
    rerun = recalc.rerun_with_note(rec, ctx, extra, operator="叶老师")

    result: AttrResult = recalc.make_attr_result(rec, applied)
    report = TeacherReport([result])

    print("=== 样例 ===")
    print(report.example_text())
    print()
    print("=== 重跑说明 ===")
    print(report.rerun_note_text(rerun))
    print()
    print("=== 材料处理清单（汇总） ===")
    print(report.summary_text())
    print()
    print("=== CSV 明细 ===")
    print(report.csv_detail())


if __name__ == "__main__":
    main()
