from __future__ import annotations

from datetime import datetime

from .models import (
    BoundaryValueNote,
    EvidenceSource,
    QuestionnaireRawRow,
)
from .workflow import WorkflowSession


def _make_questionnaire_rows() -> list[QuestionnaireRawRow]:
    return [
        QuestionnaireRawRow(
            row_id="R001",
            student_id="S001",
            student_name="张三",
            question_id="Q01",
            answer="选B",
            score=0.8,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 30),
            version=1,
            raw_text="张三,Q01,B,0.8",
        ),
        QuestionnaireRawRow(
            row_id="R002",
            student_id="S002",
            student_name="李四",
            question_id="Q01",
            answer="选A",
            score=1.0,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 31),
            version=1,
            raw_text="李四,Q01,A,1.0",
        ),
        QuestionnaireRawRow(
            row_id="R003",
            student_id="S003",
            student_name="王五",
            question_id="Q01",
            answer="选C",
            score=0.0,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 32),
            version=1,
            raw_text="王五,Q01,C,0.0",
        ),
        QuestionnaireRawRow(
            row_id="R004",
            student_id="S001",
            student_name="张三",
            question_id="Q02",
            answer="选A",
            score=1.0,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 35),
            version=1,
            raw_text="张三,Q02,A,1.0",
        ),
        QuestionnaireRawRow(
            row_id="R005",
            student_id="S002",
            student_name="李四",
            question_id="Q02",
            answer="选B",
            score=0.5,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 36),
            version=1,
            raw_text="李四,Q02,B,0.5",
        ),
        QuestionnaireRawRow(
            row_id="R006",
            student_id="S002",
            student_name="李四",
            question_id="Q02",
            answer="选C",
            score=0.7,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 50),
            version=2,
            raw_text="李四,Q02,C,0.7",
        ),
        QuestionnaireRawRow(
            row_id="R007",
            student_id="S003",
            student_name="王五",
            question_id="Q02",
            answer="选A",
            score=0.9,
            max_score=1.0,
            submitted_at=datetime(2026, 5, 20, 10, 37),
            version=1,
            raw_text="王五,Q02,A,0.9",
        ),
    ]


def _make_boundary_notes() -> list[BoundaryValueNote]:
    return [
        BoundaryValueNote(
            note_id="BN001",
            student_id="S001",
            question_id="Q01",
            field_observation="考试时该生坐窗边，有阳光直射答题卡，可能影响涂卡识别",
            prior_alpha_low=1.0,
            prior_alpha_high=3.0,
            prior_beta_low=1.0,
            prior_beta_high=2.0,
            source=EvidenceSource.BOUNDARY_NOTE,
        ),
        BoundaryValueNote(
            note_id="BN002",
            student_id="S002",
            question_id=None,
            field_observation="该生中途换了笔，第二题重答了一版，两版都交了上来",
            prior_alpha_low=1.0,
            prior_alpha_high=2.0,
            prior_beta_low=1.0,
            prior_beta_high=2.0,
            source=EvidenceSource.BOUNDARY_NOTE,
        ),
        BoundaryValueNote(
            note_id="BN003",
            student_id="S003",
            question_id="Q01",
            field_observation="该题出题时选项C表述有歧义，教研组讨论后认为可能误导学生",
            prior_alpha_low=0.5,
            prior_alpha_high=4.0,
            prior_beta_low=0.5,
            prior_beta_high=4.0,
            source=EvidenceSource.BOUNDARY_NOTE,
        ),
    ]


def create_demo_session() -> WorkflowSession:
    session = WorkflowSession(session_id="demo001")

    rows = _make_questionnaire_rows()
    session.step1_import_questionnaire(rows, operator="系统自动导入")

    notes = _make_boundary_notes()
    session.step2_review_boundary(notes, operator="教研负责人吴老师")

    session.step3_update_error_explanations(operator="系统")

    if session.state.results:
        first_result = session.state.results[0]
        session.manual_correct(
            result_id=first_result.result_id,
            field="status",
            new_value_str="已确认",
            reason="教研负责人吴老师现场确认阳光影响可控，该结果可采信",
            operator="教研负责人吴老师",
        )

    session.rerun(
        reason="人工修正后重跑，验证结果一致性",
        operator="教研负责人吴老师",
    )

    return session
