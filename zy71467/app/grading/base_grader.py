from abc import ABC, abstractmethod
from typing import Dict, List, Any, Tuple
from ..models import RiskType
from ..schemas import PartialScoreItem, ErrorExplanation, RiskFlag
from .music_theory import is_enharmonic


class BaseGrader(ABC):
    def __init__(self, full_score: float = 10.0):
        self.full_score = full_score
        self.partial_scores: List[PartialScoreItem] = []
        self.error_explanations: List[ErrorExplanation] = []
        self.risk_flags: List[RiskFlag] = []
        self.needs_manual_review = False
        self.review_reason = None

    @abstractmethod
    def get_scoring_dimensions(self) -> Dict[str, float]:
        pass

    @abstractmethod
    def validate_answer_format(self, answer: Dict[str, Any], is_standard: bool = False) -> Tuple[bool, List[str]]:
        pass

    @abstractmethod
    def grade(self, student_answer: Dict[str, Any], standard_answer: Dict[str, Any]) -> Tuple[float, bool]:
        pass

    def check_enharmonic_equivalence(self, student_note: str, standard_note: str, position: str) -> None:
        if student_note and standard_note and is_enharmonic(student_note, standard_note):
            self.risk_flags.append(RiskFlag(
                risk_type=RiskType.ENHARMONIC_MISJUDGE,
                severity="medium",
                description=f"在{position}处，学生答案「{student_note}」与标准答案「{standard_note}」为等音，音高相同但记法不同。业务规则需明确：是否要求记法完全一致，还是只要音高正确即可得分。",
                suggestion="请业务老师确认该题型是否接受等音答案。如要求记法准确，当前扣分正确；如仅要求音高正确，需调整判分规则。"
            ))
            self.needs_manual_review = True
            if not self.review_reason:
                self.review_reason = "存在等音答案，需业务确认判分规则"

    def check_missing_scoring_dimensions(self, student_dimensions: List[str], required_dimensions: List[str]) -> None:
        missing = [d for d in required_dimensions if d not in student_dimensions]
        if missing:
            self.risk_flags.append(RiskFlag(
                risk_type=RiskType.PARTIAL_SCORE_MISS,
                severity="high",
                description=f"学生答案缺少得分维度：{missing}。这些维度的得分可能未被正确计算。",
                suggestion="请检查学生答案是否完整，或调整判分维度的必填性配置。"
            ))
            self.needs_manual_review = True
            if not self.review_reason:
                self.review_reason = "部分得分维度缺失，需人工复核"

    def check_question_type_compatibility(self, answer: Dict[str, Any], expected_keys: List[str]) -> None:
        answer_keys = set(answer.keys())
        expected = set(expected_keys)
        if not expected.issubset(answer_keys):
            missing = expected - answer_keys
            self.risk_flags.append(RiskFlag(
                risk_type=RiskType.QUESTION_TYPE_MISMATCH,
                severity="high",
                description=f"答案格式与题型不匹配。期望包含字段：{expected}，实际缺失：{missing}。可能是题型映射错误。",
                suggestion="请检查题目类型映射是否正确，学生是否答错题号。"
            ))
            self.needs_manual_review = True
            self.review_reason = "题型与答案格式不匹配，需确认题目映射"

    def add_partial_score(self, dimension: str, max_score: float, actual_score: float, explanation: str) -> None:
        self.partial_scores.append(PartialScoreItem(
            dimension=dimension,
            max_score=max_score,
            actual_score=actual_score,
            explanation=explanation
        ))

    def add_error(self, error_type: str, position: str = None,
                  student_value: Any = None, standard_value: Any = None,
                  explanation: str = "") -> None:
        self.error_explanations.append(ErrorExplanation(
            error_type=error_type,
            position=position,
            student_value=student_value,
            standard_value=standard_value,
            explanation=explanation
        ))

    def calculate_total_score(self) -> float:
        return sum(item.actual_score for item in self.partial_scores)

    def reset(self) -> None:
        self.partial_scores = []
        self.error_explanations = []
        self.risk_flags = []
        self.needs_manual_review = False
        self.review_reason = None
