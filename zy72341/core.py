from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
import hashlib
import sys
sys.path.insert(0, '.')


@dataclass
class StudentAnswer:
    answer_id: str
    student_id: str
    student_name: str
    question_id: str
    answer_content: str
    score: float
    submitted_at: str
    status: str = "NORMAL"
    version: int = 1
    import_batch: str = ""
    notes: str = ""
    id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None

    def __post_init__(self):
        if self.id is None:
            content_hash = hashlib.md5(
                f"{self.student_id}{self.question_id}{self.submitted_at}".encode()
            ).hexdigest()[:8]
            self.id = f"ANS{content_hash}"


@dataclass
class WeightTable:
    weight_id: str
    question_id: str
    dimension: str
    weight: float
    standard_version: str
    effective_date: str
    remarks: str = ""
    id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    is_active: bool = True

    def __post_init__(self):
        if self.id is None:
            self.id = f"W{self.weight_id}"


@dataclass
class ErrorLog:
    log_id: str
    answer_id: str
    error_type: str
    description: str
    weight_version: str
    source: str
    id: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    resolution_notes: str = ""

    def __post_init__(self):
        if self.id is None:
            self.id = f"ERR{self.log_id}"


class DuplicateDetector:
    @staticmethod
    def find_duplicates(answers: List[StudentAnswer]) -> Dict[str, List[StudentAnswer]]:
        groups: Dict[str, List[StudentAnswer]] = {}
        for ans in answers:
            key = f"{ans.student_id}_{ans.question_id}"
            if key not in groups:
                groups[key] = []
            groups[key].append(ans)

        return {k: v for k, v in groups.items() if len(v) > 1}

    @staticmethod
    def mark_duplicates(
        answers: List[StudentAnswer]
    ) -> List[StudentAnswer]:
        duplicates = DuplicateDetector.find_duplicates(answers)

        for key, group in duplicates.items():
            for idx, ans in enumerate(sorted(group, key=lambda x: x.submitted_at)):
                ans.version = idx + 1
                ans.status = "DUPLICATE_PENDING"
                ans.notes = (
                    f"同一学生提交{len(group)}版答案，"
                    f"当前为第{ans.version}版，待业务运营复核"
                )

        return answers


class WeightUpdater:
    @staticmethod
    def calculate_error(
        answer: StudentAnswer, weight: WeightTable
    ) -> Optional[ErrorLog]:
        if weight.standard_version not in answer.import_batch:
            old_score = answer.score
            adjusted_score = answer.score * weight.weight
            error_desc = (
                f"评分权重表补录说明：原评分标准版本{weight.standard_version}，"
                f"权重系数{weight.weight}，原得分{old_score}，"
                f"调整后得分{adjusted_score:.2f}。{weight.remarks}"
            )

            time_str = datetime.now().strftime('%Y%m%d%H%M%S')[-6:]
            return ErrorLog(
                log_id=f"ERR{time_str}",
                answer_id=answer.id,
                error_type="OLD_STANDARD",
                description=error_desc,
                weight_version=weight.standard_version,
                source="评分权重表补录",
            )
        return None

    @staticmethod
    def apply_old_standard_update(
        answers: List[StudentAnswer], weights: List[WeightTable]
    ) -> List[ErrorLog]:
        error_logs = []
        weight_map = {w.question_id: w for w in weights}

        for answer in answers:
            if answer.question_id in weight_map:
                weight = weight_map[answer.question_id]
                error_log = WeightUpdater.calculate_error(answer, weight)
                if error_log:
                    answer.status = "OLD_STANDARD"
                    answer.notes = (
                        f"根据评分权重表{weight.standard_version}口径补录"
                    )
                    error_logs.append(error_log)

        return error_logs
