from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
import hashlib
import copy
import sys
sys.path.insert(0, '.')

from config import Config


@dataclass
class RevisionHistory:
    revision_id: str
    field_name: str
    old_value: str
    new_value: str
    operator: str
    reason: str
    operated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    next_step: str = ""
    next_contact: str = ""

    def __post_init__(self):
        if not self.revision_id:
            time_str = datetime.now().strftime('%H%M%S%f')[:8]
            self.revision_id = f"REV{time_str}"


@dataclass
class ReviewDetail:
    original_claim: str = ""
    corrected_value: str = ""
    handling_reason: str = ""
    next_step: str = ""
    next_contact: str = ""
    reviewed_score: Optional[float] = None
    review_opinion: str = ""


@dataclass
class BoundaryNote:
    boundary_type: str
    description: str
    threshold_ref: str = ""
    triggered_at: str = field(default_factory=lambda: datetime.now().isoformat())


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
    original_score: Optional[float] = None
    adjusted_score: Optional[float] = None
    revision_history: List[Dict] = field(default_factory=list)
    review_detail: Optional[Dict] = None
    boundary_notes: List[Dict] = field(default_factory=list)
    rerun_count: int = 0
    last_rerun_at: Optional[str] = None

    def __post_init__(self):
        if self.id is None:
            content_hash = hashlib.md5(
                f"{self.student_id}{self.question_id}{self.submitted_at}".encode()
            ).hexdigest()[:8]
            self.id = f"ANS{content_hash}"
        if self.original_score is None:
            self.original_score = self.score
        if self.review_detail is None:
            self.review_detail = asdict_safe(ReviewDetail())
        if isinstance(self.revision_history, list) and self.revision_history:
            pass
        if isinstance(self.boundary_notes, list) and self.boundary_notes:
            pass

    def add_revision(self, revision: RevisionHistory):
        self.revision_history.append(asdict_safe(revision))

    def add_boundary_note(self, note: BoundaryNote):
        self.boundary_notes.append(asdict_safe(note))

    def set_review_detail(self, detail: ReviewDetail):
        self.review_detail = asdict_safe(detail)


def asdict_safe(obj):
    if obj is None:
        return None
    if hasattr(obj, '__dataclass_fields__'):
        result = {}
        for f in obj.__dataclass_fields__:
            result[f] = asdict_safe(getattr(obj, f))
        return result
    if isinstance(obj, list):
        return [asdict_safe(x) for x in obj]
    if isinstance(obj, dict):
        return {k: asdict_safe(v) for k, v in obj.items()}
    return obj


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
    applied_count: int = 0
    last_applied_at: Optional[str] = None

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
    original_score: Optional[float] = None
    adjusted_score: Optional[float] = None
    weight_factor: Optional[float] = None

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
            sorted_group = sorted(group, key=lambda x: x.submitted_at)
            for idx, ans in enumerate(sorted_group):
                ans.version = idx + 1
                ans.status = "DUPLICATE_PENDING"
                ans.notes = (
                    f"同一学生提交{len(group)}版答案，"
                    f"当前为第{ans.version}版（提交时间：{ans.submitted_at}），"
                    f"待业务运营复核确认保留版本。"
                    f"【原始说法保留】各版得分："
                    + "、".join(
                        [f"第{g.version}版{g.score}分" for g in sorted_group]
                    )
                )
                detail = ReviewDetail(
                    original_claim=(
                        f"学生{ans.student_name}（{ans.student_id}）"
                        f"对题目{ans.question_id}共提交{len(group)}版答案，"
                        f"第{idx+1}版得分{ans.score}，提交时间{ans.submitted_at}"
                    ),
                    handling_reason="系统检测到重复提交，自动挂起待业务运营判断",
                    next_step="业务运营人工比对各版内容后，指定保留版本并填写复核意见",
                    next_contact="运营规划阿岚 或 业务运营组值班人"
                )
                ans.set_review_detail(detail)
        return answers


class WeightUpdater:
    @staticmethod
    def calculate_error(
        answer: StudentAnswer, weight: WeightTable,
        old_status_label: str = "NORMAL",
        operator: str = "系统（运营规划阿岚补录权重表触发）",
        is_rerun: bool = False,
    ) -> Optional[ErrorLog]:
        if weight.standard_version not in answer.import_batch or is_rerun:
            old_score = answer.score
            adjusted_score = answer.score * weight.weight
            run_kind = "重跑" if is_rerun else "补录"
            error_desc = (
                f"评分权重表{run_kind}说明：原评分标准版本{weight.standard_version}，"
                f"权重系数{weight.weight}，原得分{old_score}，"
                f"调整后得分{adjusted_score:.2f}。{weight.remarks}"
                f"（维度：{weight.dimension}，生效日期：{weight.effective_date}）"
            )
            time_str = datetime.now().strftime('%Y%m%d%H%M%S')[-6:]
            log = ErrorLog(
                log_id=time_str,
                answer_id=answer.id,
                error_type="OLD_STANDARD" if not is_rerun else "RERUN",
                description=error_desc,
                weight_version=weight.standard_version,
                source=f"评分权重表{run_kind}",
                original_score=old_score,
                adjusted_score=adjusted_score,
                weight_factor=weight.weight,
            )
            new_status_label = "RERUN_DONE" if is_rerun else "OLD_STANDARD"
            revision = RevisionHistory(
                revision_id="",
                field_name="status/误差说明",
                old_value=f"{old_status_label}，得分{old_score}",
                new_value=f"{new_status_label}，调整后得分{adjusted_score:.2f}",
                operator=operator,
                reason=f"根据评分权重表{weight.standard_version}口径{run_kind}：{weight.remarks}",
                next_step="如需申诉，联系运营规划阿岚核对权重口径",
                next_contact="运营规划阿岚"
            )
            answer.add_revision(revision)
            return log
        return None

    @staticmethod
    def apply_old_standard_update(
        answers: List[StudentAnswer], weights: List[WeightTable], rerun: bool = False,
        operator: str = "系统"
    ) -> List[ErrorLog]:
        error_logs = []
        weight_map = {w.question_id: w for w in weights}
        for answer in answers:
            if answer.question_id in weight_map:
                weight = weight_map[answer.question_id]
                old_status = answer.status
                old_status_label = Config.STATUS_TYPES.get(old_status, old_status)
                error_log = WeightUpdater.calculate_error(
                    answer, weight,
                    old_status_label=old_status_label,
                    operator=f"{operator}（运营规划阿岚补录权重表触发）",
                    is_rerun=rerun,
                )
                if error_log:
                    if rerun:
                        answer.status = "RERUN_DONE"
                    else:
                        if answer.status == "NORMAL" or answer.status == "BOUNDARY_ALERT":
                            answer.status = "OLD_STANDARD"
                    answer.adjusted_score = error_log.adjusted_score
                    run_kind = "重跑" if rerun else "补录"
                    existing_notes = answer.notes or ""
                    append_note = (
                        f"【评分权重表{run_kind}·第{answer.rerun_count + 1}次】"
                        f"根据{weight.standard_version}口径，调整后得分{error_log.adjusted_score:.2f}。"
                        f"备注：{weight.remarks}"
                    )
                    if existing_notes:
                        answer.notes = f"{existing_notes}\n{append_note}"
                    else:
                        answer.notes = append_note
                    answer.rerun_count += 1
                    answer.last_rerun_at = datetime.now().isoformat()
                    weight.applied_count += 1
                    weight.last_applied_at = datetime.now().isoformat()
                    error_logs.append(error_log)
        return error_logs


class BoundaryChecker:
    @staticmethod
    def check_boundaries(answer: StudentAnswer) -> List[BoundaryNote]:
        notes = []
        if answer.score >= 100:
            notes.append(BoundaryNote(
                boundary_type="FULL_SCORE",
                description=f"边界值触发：满分/超满分（{answer.score}分），需人工核阅是否存在给分溢出",
                threshold_ref="满分≥100"
            ))
        elif answer.score <= 0:
            notes.append(BoundaryNote(
                boundary_type="ZERO_SCORE",
                description=f"边界值触发：零分/负分（{answer.score}分），需确认是否缺考或答案空",
                threshold_ref="零分≤0"
            ))
        elif 59.5 <= answer.score <= 60.5:
            notes.append(BoundaryNote(
                boundary_type="PASS_LINE",
                description=f"边界值触发：及格线附近（{answer.score}分），建议复核评分是否公允",
                threshold_ref="及格线区间59.5-60.5"
            ))
        if len(answer.answer_content) < 10:
            notes.append(BoundaryNote(
                boundary_type="SHORT_ANSWER",
                description=f"边界值触发：答案内容过短（仅{len(answer.answer_content)}字符），需确认是否完整提交",
                threshold_ref="答案长度<10字符"
            ))
        return notes
