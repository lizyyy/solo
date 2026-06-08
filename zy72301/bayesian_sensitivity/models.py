from __future__ import annotations

import enum
from datetime import datetime
from pydantic import BaseModel, Field


class EvidenceSource(str, enum.Enum):
    QUESTIONNAIRE = "问卷原始行"
    BOUNDARY_NOTE = "边界值说明"
    MANUAL_CORRECTION = "人工修正"


class ReviewStatus(str, enum.Enum):
    PENDING_IMPORT = "待导入"
    PENDING_BOUNDARY = "待补看边界值"
    PENDING_REVIEW = "待复核"
    DUPLICATE_FLAGGED = "两版答案待复核"
    CONFIRMED = "已确认"
    CORRECTED = "已修正"


class NextAction(str, enum.Enum):
    FIND_BUSINESS_OPS = "找业务运营复核"
    FIND_DIRECTOR_WU = "找教研负责人吴老师确认"
    SUPPLEMENT_BOUNDARY = "补录边界值说明"
    NO_ACTION = "无需操作"


class QuestionnaireRawRow(BaseModel):
    row_id: str = Field(description="原始行号")
    student_id: str = Field(description="学生ID")
    student_name: str = Field(default="", description="学生姓名")
    question_id: str = Field(description="题目ID")
    answer: str = Field(description="学生作答")
    score: float | None = Field(default=None, description="得分")
    max_score: float = Field(default=1.0, description="满分")
    submitted_at: datetime = Field(description="提交时间")
    version: int = Field(default=1, description="答案版本号")
    source: EvidenceSource = Field(default=EvidenceSource.QUESTIONNAIRE)
    raw_text: str = Field(default="", description="原始行文本")


class BoundaryValueNote(BaseModel):
    note_id: str = Field(description="说明ID")
    student_id: str = Field(description="关联学生ID")
    question_id: str | None = Field(default=None, description="关联题目ID，None表示全局")
    field_observation: str = Field(description="现场说法")
    prior_alpha_low: float | None = Field(default=None, description="先验α下界")
    prior_alpha_high: float | None = Field(default=None, description="先验α上界")
    prior_beta_low: float | None = Field(default=None, description="先验β下界")
    prior_beta_high: float | None = Field(default=None, description="先验β上界")
    submitted_at: datetime = Field(default_factory=datetime.now)
    source: EvidenceSource = Field(default=EvidenceSource.BOUNDARY_NOTE)


class CorrectionRecord(BaseModel):
    field: str = Field(description="被修正的字段名")
    original_value: str = Field(description="修正前的值(显示用)")
    corrected_value: str = Field(description="修正后的值(显示用)")
    reason: str = Field(description="修正原因")
    operator: str = Field(description="操作人")
    corrected_at: datetime = Field(default_factory=datetime.now)


class SensitivityResult(BaseModel):
    result_id: str = Field(description="结果ID")
    student_id: str = Field(description="学生ID")
    question_id: str = Field(description="题目ID")
    questionnaire_evidence: str = Field(default="", description="问卷原始行证据摘要")
    boundary_evidence: str = Field(default="", description="边界值说明证据摘要")
    posterior_mean: float = Field(description="后验均值")
    posterior_std: float = Field(default=0.0, description="后验标准差")
    sensitivity_range: float = Field(default=0.0, description="敏感性范围(先验变动时后验最大差)")
    is_duplicate: bool = Field(default=False, description="是否为两版答案")
    duplicate_versions: list[int] = Field(default_factory=list, description="重复版本号")
    status: ReviewStatus = Field(default=ReviewStatus.PENDING_IMPORT)
    calculated_at: datetime = Field(default_factory=datetime.now)
    corrected_fields: dict[str, str] = Field(
        default_factory=dict,
        description="人工修正过的字段 → 修正后值(序列化字符串)，重跑时不被覆盖",
    )
    corrections_history: list[CorrectionRecord] = Field(
        default_factory=list,
        description="该结果上发生的全部人工修正痕迹",
    )


class ErrorExplanation(BaseModel):
    explanation_id: str = Field(description="说明ID")
    result_id: str = Field(description="关联结果ID")
    student_id: str = Field(description="学生ID")
    why_kept: str = Field(description="为什么被留下")
    missing_materials: list[str] = Field(default_factory=list, description="还缺什么材料")
    next_action: NextAction = Field(default=NextAction.NO_ACTION, description="下一步该找谁")
    next_action_detail: str = Field(default="", description="下一步操作细节")
    is_duplicate_flag: bool = Field(default=False, description="是否标记为两版答案待复核")
    generated_at: datetime = Field(default_factory=datetime.now)


class AuditEntry(BaseModel):
    entry_id: str = Field(description="审计条目ID")
    operator: str = Field(description="操作人")
    action: str = Field(description="做了什么")
    reason: str = Field(description="为什么改")
    before_snapshot: str = Field(default="", description="修改前快照")
    after_snapshot: str = Field(default="", description="修改后快照")
    affected_result_ids: list[str] = Field(default_factory=list, description="影响的结果ID列表")
    timestamp: datetime = Field(default_factory=datetime.now)


class WorkflowState(BaseModel):
    session_id: str = Field(description="会话ID")
    current_step: int = Field(default=1, description="当前步骤(1/2/3)")
    step1_imported: bool = Field(default=False, description="步骤1：问卷原始行已导入")
    step2_boundary_reviewed: bool = Field(default=False, description="步骤2：边界值说明已补看")
    step3_error_updated: bool = Field(default=False, description="步骤3：误差说明已更新")
    questionnaire_rows: list[QuestionnaireRawRow] = Field(default_factory=list)
    boundary_notes: list[BoundaryValueNote] = Field(default_factory=list)
    results: list[SensitivityResult] = Field(default_factory=list)
    explanations: list[ErrorExplanation] = Field(default_factory=list)
    audit_trail: list[AuditEntry] = Field(default_factory=list)
