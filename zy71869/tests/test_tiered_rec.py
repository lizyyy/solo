from tiered_rec.models import (
    DifficultyTier,
    EquivalentAnswerIssue,
    EquivalentAnswerSource,
    ProcessingStatus,
    Question,
    RecommendationResult,
    ReviewRecord,
    StepAward,
    StepScore,
)
from tiered_rec.engine import TieredRecommendationEngine
from tiered_rec.errors import friendly_error, FriendlyError, translate_field, issue_to_human
from tiered_rec.report import generate_review_draft
import pytest


def _make_question(
    qid="Q001",
    tier=DifficultyTier.ADVANCED,
    standard="x^2+1=0",
    equivalents=None,
    score_total=10.0,
    step_scores=None,
) -> Question:
    return Question(
        question_id=qid,
        source_exam="2025省赛",
        content="解方程",
        standard_answer=standard,
        equivalent_answers=equivalents or [],
        tier=tier,
        score_total=score_total,
        step_scores=step_scores or [
            StepScore("步骤1", 5.0, "设元"),
            StepScore("步骤2", 5.0, "求解"),
        ],
    )


def _make_review(
    qid="Q001",
    answer="x^2+1=0",
    score=10.0,
    source=EquivalentAnswerSource.REVIEW_RECORD,
    judged=False,
    step_breakdown=None,
) -> ReviewRecord:
    return ReviewRecord(
        question_id=qid,
        student_answer=answer,
        awarded_score=score,
        source=source,
        is_equivalent_judged=judged,
        step_breakdown=step_breakdown or [StepAward("步骤1", 5.0), StepAward("步骤2", 5.0)],
    )


class TestIdempotency:
    def test_duplicate_question_not_overwritten(self):
        engine = TieredRecommendationEngine()
        q1 = _make_question("Q001")
        report1 = engine.load_questions([q1])
        assert report1["Q001"] == "新增"

        q2 = _make_question("Q001")
        report2 = engine.load_questions([q2])
        assert report2["Q001"] == "已存在，跳过覆盖"

    def test_duplicate_review_not_overwritten(self):
        engine = TieredRecommendationEngine()
        r1 = _make_review("Q001", "ans", 8.0)
        report1 = engine.load_reviews([r1])
        assert report1[r1.record_id] == "新增"

        r2 = _make_review("Q001", "ans", 8.0)
        report2 = engine.load_reviews([r2])
        assert report2[r2.record_id] == "已存在，跳过覆盖"

    def test_run_idempotent_no_duplicate_results(self):
        engine = TieredRecommendationEngine()
        q = _make_question("Q001")
        engine.load_questions([q])
        r = _make_review("Q001")
        engine.load_reviews([r])

        results1 = engine.run(batch_id="B001")
        assert len(results1) == 1

        results2 = engine.run(batch_id="B002")
        assert len(results2) == 0

    def test_new_question_after_existing_gets_new_result(self):
        engine = TieredRecommendationEngine()
        q1 = _make_question("Q001")
        engine.load_questions([q1])
        engine.run(batch_id="B001")

        q2 = _make_question("Q002")
        engine.load_questions([q2])
        results = engine.run(batch_id="B002")
        assert len(results) == 1
        assert results[0].question_id == "Q002"


class TestEquivalentAnswerIssue:
    def test_high_score_non_standard_answer_triggers_issue(self):
        engine = TieredRecommendationEngine()
        q = _make_question(standard="x^2+1=0", equivalents=[], score_total=10.0)
        r = _make_review(answer="x²+1=0", score=9.0, judged=False)
        engine.load_questions([q])
        engine.load_reviews([r])
        results = engine.run(batch_id="B001")
        assert len(results) == 1
        assert len(results[0].equivalent_issues) == 1
        issue = results[0].equivalent_issues[0]
        assert issue.source == EquivalentAnswerSource.REVIEW_RECORD

    def test_judged_answer_no_issue(self):
        engine = TieredRecommendationEngine()
        q = _make_question(standard="x^2+1=0", equivalents=[])
        r = _make_review(answer="x²+1=0", score=9.0, judged=True)
        engine.load_questions([q])
        engine.load_reviews([r])
        results = engine.run(batch_id="B001")
        assert len(results[0].equivalent_issues) == 0

    def test_standard_answer_no_issue(self):
        engine = TieredRecommendationEngine()
        q = _make_question(standard="x^2+1=0")
        r = _make_review(answer="x^2+1=0", score=10.0)
        engine.load_questions([q])
        engine.load_reviews([r])
        results = engine.run(batch_id="B001")
        assert len(results[0].equivalent_issues) == 0

    def test_equivalent_in_list_no_issue(self):
        engine = TieredRecommendationEngine()
        q = _make_question(standard="x^2+1=0", equivalents=["x²+1=0"])
        r = _make_review(answer="x²+1=0", score=10.0)
        engine.load_questions([q])
        engine.load_reviews([r])
        results = engine.run(batch_id="B001")
        assert len(results[0].equivalent_issues) == 0

    def test_issue_from_question_bank_source(self):
        engine = TieredRecommendationEngine()
        q = _make_question(standard="x^2+1=0", equivalents=[""])
        engine.load_questions([q])
        results = engine.run(batch_id="B001")
        issues = results[0].equivalent_issues
        bank_issues = [i for i in issues if i.source == EquivalentAnswerSource.QUESTION_BANK]
        assert len(bank_issues) >= 1

    def test_issue_human_message_contains_source_and_contact(self):
        issue = EquivalentAnswerIssue(
            question_id="Q001",
            answer_text="some answer",
            source=EquivalentAnswerSource.REVIEW_RECORD,
            detail="可能误判",
            suggested_contact="张老师",
        )
        msg = issue.to_human_message()
        assert "讲评记录" in msg
        assert "张老师" in msg

    def test_issue_default_contact_by_source(self):
        issue_review = EquivalentAnswerIssue(
            question_id="Q001",
            answer_text="a",
            source=EquivalentAnswerSource.REVIEW_RECORD,
        )
        msg_review = issue_review.to_human_message()
        assert "讲评组" in msg_review

        issue_bank = EquivalentAnswerIssue(
            question_id="Q001",
            answer_text="a",
            source=EquivalentAnswerSource.QUESTION_BANK,
        )
        msg_bank = issue_bank.to_human_message()
        assert "题库管理员" in msg_bank


class TestFriendlyError:
    def test_known_keyerror(self):
        exc = KeyError("question_id")
        msg = friendly_error(exc)
        assert "题目编号" in msg
        assert "question_id" not in msg

    def test_known_value_error(self):
        exc = ValueError("score_exceeds_max")
        msg = friendly_error(exc)
        assert "满分" in msg

    def test_unknown_exception(self):
        exc = RuntimeError("数据库连接超时")
        msg = friendly_error(exc)
        assert "数据库连接超时" in msg

    def test_translate_field(self):
        assert translate_field("question_id") == "题目编号"
        assert translate_field("unknown_field") == "unknown_field"


class TestReviewDraft:
    def test_three_sections_separated(self):
        results = [
            RecommendationResult(
                question_id="Q001",
                tier=DifficultyTier.BASIC,
                recommended_to=["基础组"],
                status=ProcessingStatus.CONFIRMED,
                source_idempotency_key="k1",
            ),
            RecommendationResult(
                question_id="Q002",
                tier=DifficultyTier.INTERMEDIATE,
                recommended_to=["提高组"],
                status=ProcessingStatus.PENDING,
                equivalent_issues=[
                    EquivalentAnswerIssue(
                        question_id="Q002",
                        answer_text="alt ans",
                        source=EquivalentAnswerSource.REVIEW_RECORD,
                        detail="得分高但不在等价列表",
                        suggested_contact="讲评组",
                    )
                ],
                source_idempotency_key="k2",
            ),
            RecommendationResult(
                question_id="Q003",
                tier=DifficultyTier.ADVANCED,
                recommended_to=["竞赛组"],
                status=ProcessingStatus.MANUAL_OVERRIDE,
                manual_override_note="调整难度层级",
                source_idempotency_key="k3",
            ),
        ]
        draft = generate_review_draft(results)
        assert "已确认记录" in draft
        assert "待补充记录" in draft
        assert "人工修改记录" in draft
        assert "处理口径说明" in draft
        assert "等价答案误判清单" in draft
        assert "Q001" in draft
        assert "Q002" in draft
        assert "Q003" in draft
        assert "调整难度层级" in draft

    def test_empty_results(self):
        draft = generate_review_draft([])
        assert "已确认记录" in draft
        assert "（无）" in draft


class TestManualOverride:
    def test_manual_override_changes_status(self):
        engine = TieredRecommendationEngine()
        q = _make_question()
        engine.load_questions([q])
        results = engine.run(batch_id="B001")
        result_id = results[0].result_id

        updated = engine.manual_override(
            result_id,
            ProcessingStatus.MANUAL_OVERRIDE,
            "经备课组讨论调整",
        )
        assert updated.status == ProcessingStatus.MANUAL_OVERRIDE
        assert updated.manual_override_note == "经备课组讨论调整"

    def test_manual_override_nonexistent_raises(self):
        engine = TieredRecommendationEngine()
        with pytest.raises(ValueError):
            engine.manual_override("nonexistent", ProcessingStatus.CONFIRMED, "note")


class TestStepScoreMismatch:
    def test_step_mismatch_detected(self):
        engine = TieredRecommendationEngine()
        q = _make_question(step_scores=[StepScore("步骤1", 5.0), StepScore("步骤2", 5.0)])
        r = _make_review(
            step_breakdown=[StepAward("步骤1", 5.0), StepAward("步骤2", 8.0)]
        )
        engine.load_questions([q])
        engine.load_reviews([r])
        results = engine.run(batch_id="B001")
        assert results[0].score_summary["step_mismatch_count"] == 1

    def test_no_step_mismatch(self):
        engine = TieredRecommendationEngine()
        q = _make_question(step_scores=[StepScore("步骤1", 5.0), StepScore("步骤2", 5.0)])
        r = _make_review(
            step_breakdown=[StepAward("步骤1", 5.0), StepAward("步骤2", 5.0)]
        )
        engine.load_questions([q])
        engine.load_reviews([r])
        results = engine.run(batch_id="B001")
        assert results[0].score_summary["step_mismatch_count"] == 0
