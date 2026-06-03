from enum import Enum
from datetime import datetime
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field, field_validator
import pandas as pd


class ProcessStatus(str, Enum):
    IMPORTED = "imported"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    MANUAL_UPDATED = "manual_updated"
    FINALIZED = "finalized"
    ROLLBACKED = "rollbacked"


class BoundaryRuleType(str, Enum):
    ZERO_DENOMINATOR_EMPTY_STRING = "zero_denominator_empty_string"
    MISSING_VALUE = "missing_value"
    OUTLIER_THRESHOLD = "outlier_threshold"


class AnomalyType(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    BOUNDARY_CASE = "boundary_case"
    PENDING_VERIFICATION = "pending_verification"


class TimeSeriesRecord(BaseModel):
    row_number: int = Field(description="原始行号，对应旧公式截图位置")
    timestamp: str
    metric_name: str
    numerator: float
    denominator: Any
    raw_denominator: Any = Field(description="原始分母值，保留导入时的原始数据")
    source_screenshot_ref: Optional[str] = Field(None, description="旧公式截图引用")
    teacher_comment: Optional[str] = Field(None, description="老师批注")

    @field_validator('denominator', mode='before')
    @classmethod
    def handle_empty_string_denominator(cls, v):
        if isinstance(v, str) and v.strip() == '':
            return None
        return v


class BoundaryRule(BaseModel):
    rule_type: BoundaryRuleType
    description: str
    judgment_criteria: str
    modification_method: str
    rollback_method: str
    is_active: bool = True


class ManualModification(BaseModel):
    modified_at: datetime = Field(default_factory=datetime.now)
    modified_by: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str


class AnomalyResult(BaseModel):
    row_number: int
    timestamp: str
    metric_name: str
    numerator: float
    denominator: Optional[float]
    raw_denominator: Any
    ratio: Optional[float]
    anomaly_type: AnomalyType
    process_status: ProcessStatus
    source_screenshot_ref: Optional[str]
    teacher_comment: Optional[str]
    manual_modifications: List[ManualModification] = Field(default_factory=list)
    boundary_rule_triggered: Optional[BoundaryRuleType] = None
    review_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = self.model_dump()
        data['created_at'] = self.created_at.isoformat()
        data['updated_at'] = self.updated_at.isoformat()
        for i, mod in enumerate(self.manual_modifications):
            data['manual_modifications'][i]['modified_at'] = mod.modified_at.isoformat()
        return data


class UnifiedDataExporter:
    def __init__(self, results: List[AnomalyResult]):
        self._results = results
        self._dataframe = None
        self._build_dataframe()

    def _build_dataframe(self):
        records = [r.to_dict() for r in self._results]
        self._dataframe = pd.DataFrame(records)

    def get_dataframe(self) -> pd.DataFrame:
        return self._dataframe.copy()

    def export_to_dict(self) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in self._results]

    def export_to_csv(self, filepath: str) -> None:
        self._dataframe.to_csv(filepath, index=False, encoding='utf-8-sig')

    def export_to_excel(self, filepath: str) -> None:
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            self._dataframe.to_excel(writer, sheet_name='异常分解结果', index=False)
            self._export_audit_trail(writer)

    def _export_audit_trail(self, writer):
        audit_records = []
        for result in self._results:
            for mod in result.manual_modifications:
                audit_records.append({
                    '行号': result.row_number,
                    '指标名称': result.metric_name,
                    '修改时间': mod.modified_at.isoformat(),
                    '修改人': mod.modified_by,
                    '修改字段': mod.field_name,
                    '原值': mod.old_value,
                    '新值': mod.new_value,
                    '修改原因': mod.reason
                })
        if audit_records:
            pd.DataFrame(audit_records).to_excel(
                writer, sheet_name='修改审计追踪', index=False
            )

    def get_pending_review_count(self) -> int:
        return sum(
            1 for r in self._results
            if r.process_status == ProcessStatus.PENDING_REVIEW
        )

    def get_boundary_case_count(self) -> int:
        return sum(
            1 for r in self._results
            if r.anomaly_type == AnomalyType.BOUNDARY_CASE
        )


BOUNDARY_RULES: List[BoundaryRule] = [
    BoundaryRule(
        rule_type=BoundaryRuleType.ZERO_DENOMINATOR_EMPTY_STRING,
        description="分母为0但被填成空字符串的情况",
        judgment_criteria="原始分母值为空字符串或'0'，转换后分母为0或None",
        modification_method="标记为待复核，不自动归为正常，保留原始值供数据复核人审查",
        rollback_method="恢复原始分母值，重置异常类型为待验证"
    ),
    BoundaryRule(
        rule_type=BoundaryRuleType.MISSING_VALUE,
        description="分子或分母缺失的情况",
        judgment_criteria="分子或分母为None或空值",
        modification_method="标记为边界案例，留待人工处理",
        rollback_method="恢复原始值，重置状态为已导入"
    ),
    BoundaryRule(
        rule_type=BoundaryRuleType.OUTLIER_THRESHOLD,
        description="比率超出正常阈值的情况",
        judgment_criteria="比率大于2.0或小于0.5",
        modification_method="标记为异常，待复核",
        rollback_method="重新计算比率，重置异常类型"
    )
]
