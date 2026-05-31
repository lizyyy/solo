from __future__ import annotations

import enum
import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class ProcessingStatus(enum.Enum):
    CONFIRMED = "confirmed"
    PENDING = "pending"
    MANUAL_OVERRIDE = "manual_override"


class DifficultyTier(enum.Enum):
    BASIC = "基础"
    INTERMEDIATE = "提高"
    ADVANCED = "竞赛"


class EquivalentAnswerSource(enum.Enum):
    REVIEW_RECORD = "讲评记录"
    QUESTION_BANK = "题库表"


@dataclass
class Question:
    question_id: str
    source_exam: str
    content: str
    standard_answer: str
    equivalent_answers: list[str] = field(default_factory=list)
    tier: DifficultyTier = DifficultyTier.BASIC
    score_total: float = 0.0
    step_scores: list[StepScore] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def idempotency_key(self) -> str:
        raw = f"{self.source_exam}:{self.question_id}:{self.content}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


@dataclass
class StepScore:
    step_label: str
    max_score: float
    description: str = ""


@dataclass
class ReviewRecord:
    record_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    question_id: str = ""
    student_answer: str = ""
    awarded_score: float = 0.0
    step_breakdown: list[StepAward] = field(default_factory=list)
    reviewer: str = ""
    review_date: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    source: EquivalentAnswerSource = EquivalentAnswerSource.REVIEW_RECORD
    is_equivalent_judged: bool = False
    equivalent_note: str = ""
    metadata: dict = field(default_factory=dict)

    def idempotency_key(self) -> str:
        raw = f"{self.question_id}:{self.student_answer}:{self.reviewer}:{self.review_date}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


@dataclass
class StepAward:
    step_label: str
    awarded: float
    note: str = ""


@dataclass
class EquivalentAnswerIssue:
    question_id: str
    answer_text: str
    source: EquivalentAnswerSource
    detail: str = ""
    suggested_contact: str = ""

    def to_human_message(self) -> str:
        source_label = self.source.value
        parts = [
            f"【等价答案误判】题目 {self.question_id} 的答案「{self.answer_text[:30]}…」被误判。",
            f"来源：{source_label}",
        ]
        if self.detail:
            parts.append(f"原因：{self.detail}")
        if self.suggested_contact:
            parts.append(f"下一步：请联系 {self.suggested_contact} 补充等价答案。")
        else:
            if self.source == EquivalentAnswerSource.REVIEW_RECORD:
                parts.append("下一步：请联系讲评组确认该答案是否应加入等价答案列表。")
            else:
                parts.append("下一步：请联系题库管理员在题库表中补录等价答案。")
        return "；".join(parts)


@dataclass
class RecommendationResult:
    result_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    batch_id: str = ""
    question_id: str = ""
    tier: DifficultyTier = DifficultyTier.BASIC
    recommended_to: list[str] = field(default_factory=list)
    status: ProcessingStatus = ProcessingStatus.PENDING
    equivalent_issues: list[EquivalentAnswerIssue] = field(default_factory=list)
    score_summary: dict = field(default_factory=dict)
    manual_override_note: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    updated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    source_idempotency_key: str = ""
    metadata: dict = field(default_factory=dict)
