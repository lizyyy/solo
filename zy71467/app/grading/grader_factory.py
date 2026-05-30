from typing import Dict, Optional
from ..models import QuestionType
from .base_grader import BaseGrader
from .interval_grader import IntervalGrader
from .chord_grader import ChordGrader
from .key_signature_grader import KeySignatureGrader


class GraderFactory:
    _graders: Dict[QuestionType, type] = {
        QuestionType.INTERVAL: IntervalGrader,
        QuestionType.CHORD: ChordGrader,
        QuestionType.KEY_SIGNATURE: KeySignatureGrader,
    }

    @classmethod
    def get_grader(cls, question_type: QuestionType, full_score: float = 10.0) -> BaseGrader:
        grader_class = cls._graders.get(question_type)
        if not grader_class:
            raise ValueError(f"不支持的题型：{question_type}")
        return grader_class(full_score=full_score)

    @classmethod
    def register_grader(cls, question_type: QuestionType, grader_class: type) -> None:
        cls._graders[question_type] = grader_class

    @classmethod
    def get_supported_types(cls) -> Dict[QuestionType, str]:
        descriptions = {
            QuestionType.INTERVAL: "音程题：判断两个音之间的音程度数和性质",
            QuestionType.CHORD: "和弦题：判断和弦的根音、组成音、类型和转位",
            QuestionType.KEY_SIGNATURE: "调号题：判断调的主音、调式、变音记号数量和类型",
        }
        return descriptions
