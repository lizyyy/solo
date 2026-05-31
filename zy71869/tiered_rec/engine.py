from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from tiered_rec.models import (
    DifficultyTier,
    EquivalentAnswerIssue,
    EquivalentAnswerSource,
    ProcessingStatus,
    Question,
    RecommendationResult,
    ReviewRecord,
)

logger = logging.getLogger(__name__)


class TieredRecommendationEngine:
    def __init__(self) -> None:
        self._questions: dict[str, Question] = {}
        self._reviews: dict[str, ReviewRecord] = {}
        self._results: dict[str, RecommendationResult] = {}
        self._existing_idempotency_keys: set[str] = set()

    @property
    def questions(self) -> dict[str, Question]:
        return dict(self._questions)

    @property
    def reviews(self) -> dict[str, ReviewRecord]:
        return dict(self._reviews)

    @property
    def results(self) -> dict[str, RecommendationResult]:
        return dict(self._results)

    def load_questions(self, questions: list[Question]) -> dict[str, str]:
        report: dict[str, str] = {}
        for q in questions:
            ikey = q.idempotency_key()
            if ikey in self._existing_idempotency_keys:
                existing = self._find_question_by_ikey(ikey)
                if existing:
                    report[q.question_id] = "已存在，跳过覆盖"
                    logger.info("题目 %s 幂等命中，跳过覆盖 (ikey=%s)", q.question_id, ikey)
                    continue
            self._questions[q.question_id] = q
            self._existing_idempotency_keys.add(ikey)
            report[q.question_id] = "新增"
        return report

    def load_reviews(self, reviews: list[ReviewRecord]) -> dict[str, str]:
        report: dict[str, str] = {}
        for r in reviews:
            ikey = r.idempotency_key()
            if ikey in self._existing_idempotency_keys:
                report[r.record_id] = "已存在，跳过覆盖"
                logger.info("讲评记录 %s 幂等命中，跳过覆盖 (ikey=%s)", r.record_id, ikey)
                continue
            self._reviews[r.record_id] = r
            self._existing_idempotency_keys.add(ikey)
            report[r.record_id] = "新增"
        return report

    def run(
        self,
        batch_id: str,
        target_groups: Optional[dict[DifficultyTier, list[str]]] = None,
        contact_review_team: str = "讲评组",
        contact_question_admin: str = "题库管理员",
    ) -> list[RecommendationResult]:
        if target_groups is None:
            target_groups = {
                DifficultyTier.BASIC: ["基础组"],
                DifficultyTier.INTERMEDIATE: ["提高组"],
                DifficultyTier.ADVANCED: ["竞赛组"],
            }

        new_results: list[RecommendationResult] = []

        for qid, question in self._questions.items():
            reviews_for_q = [r for r in self._reviews.values() if r.question_id == qid]
            ikey = question.idempotency_key()

            existing_result = self._find_result_by_ikey(ikey)
            if existing_result is not None:
                logger.info("题目 %s 已有推荐结果(ikey=%s)，保留历史", qid, ikey)
                continue

            equivalent_issues = self._detect_equivalent_issues(
                question,
                reviews_for_q,
                contact_review_team,
                contact_question_admin,
            )

            score_summary = self._compute_score_summary(question, reviews_for_q)

            tier = question.tier
            recommended_to = target_groups.get(tier, [])

            has_pending = len(equivalent_issues) > 0
            status = ProcessingStatus.PENDING if has_pending else ProcessingStatus.CONFIRMED

            result = RecommendationResult(
                batch_id=batch_id,
                question_id=qid,
                tier=tier,
                recommended_to=recommended_to,
                status=status,
                equivalent_issues=equivalent_issues,
                score_summary=score_summary,
                source_idempotency_key=ikey,
            )
            self._results[result.result_id] = result
            new_results.append(result)

        return new_results

    def manual_override(
        self,
        result_id: str,
        new_status: ProcessingStatus,
        note: str,
    ) -> RecommendationResult:
        result = self._results.get(result_id)
        if result is None:
            raise ValueError(f"找不到推荐结果 {result_id}")
        result.status = new_status
        result.manual_override_note = note
        result.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
        return result

    def _detect_equivalent_issues(
        self,
        question: Question,
        reviews: list[ReviewRecord],
        contact_review_team: str,
        contact_question_admin: str,
    ) -> list[EquivalentAnswerIssue]:
        issues: list[EquivalentAnswerIssue] = []
        valid_answers = {question.standard_answer} | set(question.equivalent_answers)

        for review in reviews:
            if review.student_answer.strip() in valid_answers:
                continue
            if review.is_equivalent_judged:
                continue

            if review.awarded_score >= _total_max_score(question) * 0.5:
                source = review.source
                contact = (
                    contact_review_team
                    if source == EquivalentAnswerSource.REVIEW_RECORD
                    else contact_question_admin
                )
                issues.append(
                    EquivalentAnswerIssue(
                        question_id=question.question_id,
                        answer_text=review.student_answer,
                        source=source,
                        detail="学生答案得分较高但不在标准/等价答案列表中，可能为等价答案误判",
                        suggested_contact=contact,
                    )
                )

        for eq_ans in question.equivalent_answers:
            if not eq_ans.strip():
                issues.append(
                    EquivalentAnswerIssue(
                        question_id=question.question_id,
                        answer_text=eq_ans,
                        source=EquivalentAnswerSource.QUESTION_BANK,
                        detail="题库中存在空白等价答案条目，需核实",
                        suggested_contact=contact_question_admin,
                    )
                )

        return issues

    def _compute_score_summary(
        self,
        question: Question,
        reviews: list[ReviewRecord],
    ) -> dict:
        if not reviews:
            return {"total_reviews": 0, "avg_score": 0.0, "step_mismatch_count": 0}

        total = len(reviews)
        avg = sum(r.awarded_score for r in reviews) / total
        mismatches = 0

        for review in reviews:
            for step_award in review.step_breakdown:
                matching_step = None
                for ss in question.step_scores:
                    if ss.step_label == step_award.step_label:
                        matching_step = ss
                        break
                if matching_step and step_award.awarded > matching_step.max_score:
                    mismatches += 1

        return {
            "total_reviews": total,
            "avg_score": round(avg, 2),
            "step_mismatch_count": mismatches,
        }

    def _find_question_by_ikey(self, ikey: str) -> Optional[Question]:
        for q in self._questions.values():
            if q.idempotency_key() == ikey:
                return q
        return None

    def _find_result_by_ikey(self, ikey: str) -> Optional[RecommendationResult]:
        for r in self._results.values():
            if r.source_idempotency_key == ikey:
                return r
        return None


def _total_max_score(question: Question) -> float:
    if question.score_total > 0:
        return question.score_total
    return sum(s.max_score for s in question.step_scores) if question.step_scores else 1.0
