from enum import Enum
from datetime import datetime
from typing import Optional, Any, Dict, List
from dataclasses import dataclass, field
from pydantic import BaseModel, Field, field_validator
import pandas as pd
import copy


class ProcessStatus(str, Enum):
    IMPORTED = "imported"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    MANUAL_UPDATED = "manual_updated"
    FINALIZED = "finalized"
    ROLLBACKED = "rollbacked"
    PENDING_VERIFICATION_STATUS = "pending_verification_status"


class BoundaryRuleType(str, Enum):
    ZERO_DENOMINATOR_EMPTY_STRING = "zero_denominator_empty_string"
    MISSING_VALUE = "missing_value"
    OUTLIER_THRESHOLD = "outlier_threshold"


class AnomalyType(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    BOUNDARY_CASE = "boundary_case"
    PENDING_VERIFICATION = "pending_verification"


class FieldMapping(BaseModel):
    row_number_col: str = "row_number"
    timestamp_col: str = "timestamp"
    metric_name_col: str = "metric_name"
    numerator_col: str = "numerator"
    denominator_col: str = "denominator"
    screenshot_ref_col: Optional[str] = None
    teacher_comment_col: Optional[str] = None


class ReviewRecord(BaseModel):
    reviewed_at: datetime = Field(default_factory=datetime.now)
    reviewed_by: str
    original_statement: str = Field(description="原始说法/当时的表述")
    corrected_value: Any = Field(description="改后的值")
    review_reason: str = Field(description="处理原因")
    next_owner: str = Field(description="下一步找谁/下一步动作")
    review_note: str = ""
    anomaly_type_after_review: AnomalyType

    def to_dict(self) -> Dict[str, Any]:
        data = self.model_dump()
        data['reviewed_at'] = self.reviewed_at.isoformat()
        return data


class TimeSeriesRecord(BaseModel):
    row_number: int = Field(description="原始行号，对应旧公式截图位置")
    timestamp: str
    metric_name: str
    numerator: float
    denominator: Any
    raw_denominator: Any = Field(description="原始分母值，保留导入时的原始数据")
    source_screenshot_ref: Optional[str] = Field(None, description="旧公式截图引用")
    teacher_comment: Optional[str] = Field(None, description="老师批注")
    import_source: Optional[str] = Field(None, description="导入来源文件路径")
    import_sheet_name: Optional[str] = Field(None, description="Excel Sheet 名称")

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

    def to_dict(self) -> Dict[str, Any]:
        return {
            "modified_at": self.modified_at.isoformat(),
            "modified_by": self.modified_by,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason
        }


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
    review_records: List[ReviewRecord] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    import_source: Optional[str] = None
    import_sheet_name: Optional[str] = None
    snapshot_version: int = Field(default=1, description="快照版本号，每次修改+1")

    def to_dict(self) -> Dict[str, Any]:
        data = self.model_dump()
        data['created_at'] = self.created_at.isoformat()
        data['updated_at'] = self.updated_at.isoformat()
        data['manual_modifications'] = [m.to_dict() for m in self.manual_modifications]
        data['review_records'] = [r.to_dict() for r in self.review_records]
        return data

    def to_flat_dict(self) -> Dict[str, Any]:
        d = self.to_dict()
        d['manual_modifications_count'] = len(d['manual_modifications'])
        d['manual_modifications_json'] = pd.io.json.dumps(d['manual_modifications'], ensure_ascii=False)
        d['review_records_count'] = len(d['review_records'])
        d['review_records_json'] = pd.io.json.dumps(d['review_records'], ensure_ascii=False)
        latest_review = d['review_records'][-1] if d['review_records'] else {}
        d['latest_reviewed_by'] = latest_review.get('reviewed_by', '')
        d['latest_review_reason'] = latest_review.get('review_reason', '')
        d['latest_next_owner'] = latest_review.get('next_owner', '')
        return d

    def clone(self) -> 'AnomalyResult':
        return AnomalyResult.model_validate(self.model_dump())


class SummaryStats(BaseModel):
    total: int = 0
    by_anomaly_type: Dict[str, int] = Field(default_factory=dict)
    by_process_status: Dict[str, int] = Field(default_factory=dict)
    by_boundary_rule: Dict[str, int] = Field(default_factory=dict)
    pending_verification_count: int = 0
    pending_review_count: int = 0
    finalized_count: int = 0
    manual_modifications_total: int = 0
    review_records_total: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return self.model_dump()


class UnifiedDataExporter:
    def __init__(self, results: List[AnomalyResult]):
        self._results = [r.clone() for r in results]
        self._dataframe = None
        self._flat_dataframe = None
        self._build_dataframe()

    def _build_dataframe(self):
        records = [r.to_dict() for r in self._results]
        self._dataframe = pd.DataFrame(records)
        flat_records = [r.to_flat_dict() for r in self._results]
        self._flat_dataframe = pd.DataFrame(flat_records)

    def get_results(self) -> List[AnomalyResult]:
        return [r.clone() for r in self._results]

    def get_result(self, row_number: int) -> Optional[AnomalyResult]:
        for r in self._results:
            if r.row_number == row_number:
                return r.clone()
        return None

    def get_dataframe(self, flat: bool = False) -> pd.DataFrame:
        df = self._flat_dataframe if flat else self._dataframe
        return df.copy()

    def export_to_dict(self) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in self._results]

    def export_to_csv(self, filepath: str, flat: bool = False) -> None:
        df = self._flat_dataframe if flat else self._dataframe
        df.to_csv(filepath, index=False, encoding='utf-8-sig')

    def export_to_excel(self, filepath: str) -> None:
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            self._flat_dataframe.to_excel(writer, sheet_name='异常分解结果', index=False)
            self._export_audit_trail(writer)
            self._export_review_records(writer)
            self._export_summary_sheet(writer)

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
                    '原值': str(mod.old_value),
                    '新值': str(mod.new_value),
                    '修改原因': mod.reason
                })
        if audit_records:
            pd.DataFrame(audit_records).to_excel(
                writer, sheet_name='人工修改审计追踪', index=False
            )

    def _export_review_records(self, writer):
        review_records = []
        for result in self._results:
            for rev in result.review_records:
                review_records.append({
                    '行号': result.row_number,
                    '指标名称': result.metric_name,
                    '原始分母值': str(result.raw_denominator),
                    '复核时间': rev.reviewed_at.isoformat(),
                    '复核人': rev.reviewed_by,
                    '原始说法': rev.original_statement,
                    '改后的值': str(rev.corrected_value),
                    '处理原因': rev.review_reason,
                    '下一步找谁': rev.next_owner,
                    '复核备注': rev.review_note,
                    '复核后异常类型': rev.anomaly_type_after_review.value
                })
        if review_records:
            pd.DataFrame(review_records).to_excel(
                writer, sheet_name='复核记录明细', index=False
            )

    def _export_summary_sheet(self, writer):
        summary = self.compute_summary()
        rows = [
            {'指标': '记录总数', '值': summary.total},
            {'指标': '待验证（分母0空字符串）', '值': summary.pending_verification_count},
            {'指标': '待复核', '值': summary.pending_review_count},
            {'指标': '已最终确认', '值': summary.finalized_count},
            {'指标': '人工修改次数', '值': summary.manual_modifications_total},
            {'指标': '复核记录数', '值': summary.review_records_total},
        ]
        pd.DataFrame(rows).to_excel(writer, sheet_name='汇总统计', index=False)

        at_rows = [{'异常类型': k, '数量': v} for k, v in summary.by_anomaly_type.items()]
        pd.DataFrame(at_rows).to_excel(writer, sheet_name='汇总统计', startrow=len(rows)+3, index=False)

    def compute_summary(self) -> SummaryStats:
        stats = SummaryStats()
        stats.total = len(self._results)

        for r in self._results:
            at = r.anomaly_type.value
            stats.by_anomaly_type[at] = stats.by_anomaly_type.get(at, 0) + 1

            ps = r.process_status.value
            stats.by_process_status[ps] = stats.by_process_status.get(ps, 0) + 1

            if r.boundary_rule_triggered:
                br = r.boundary_rule_triggered.value
                stats.by_boundary_rule[br] = stats.by_boundary_rule.get(br, 0) + 1

            if r.anomaly_type == AnomalyType.PENDING_VERIFICATION:
                stats.pending_verification_count += 1
            if r.process_status == ProcessStatus.PENDING_REVIEW:
                stats.pending_review_count += 1
            if r.process_status == ProcessStatus.FINALIZED:
                stats.finalized_count += 1

            stats.manual_modifications_total += len(r.manual_modifications)
            stats.review_records_total += len(r.review_records)

        return stats

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
        modification_method="标记为待验证（pending_verification），不自动归为正常，保留原始说法、改后值、原因、下一步找谁，必须走人工复核",
        rollback_method="恢复原始分母值、raw_denominator，重置异常类型为待验证，清空调入的复核记录但保留历史快照版本"
    ),
    BoundaryRule(
        rule_type=BoundaryRuleType.MISSING_VALUE,
        description="分子或分母缺失的情况",
        judgment_criteria="分子或分母为None或空值",
        modification_method="标记为边界案例，留待人工处理，不参与比率计算",
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

FIELD_ALIASES = {
    "row_number": ["row_number", "行号", "序号", "行号ID", "id", "no"],
    "timestamp": ["timestamp", "时间", "日期", "时间戳", "date", "dt", "年月"],
    "metric_name": ["metric_name", "指标名称", "指标", "项目", "名称", "name", "metric"],
    "numerator": ["numerator", "分子", "数量", "成交数", "点击数", "分子值"],
    "denominator": ["denominator", "分母", "总数", "曝光数", "访问数", "分母值"],
    "source_screenshot_ref": ["source_screenshot_ref", "截图引用", "截图", "公式截图", "screenshot"],
    "teacher_comment": ["teacher_comment", "老师批注", "批注", "老师意见", "remark", "comment"]
}


class AuditRecord(BaseModel):
    row_number: int
    action: str
    old_status: Optional[ProcessStatus]
    new_status: ProcessStatus
    actor: str
    timestamp: datetime = Field(default_factory=datetime.now)
    details: Dict[str, Any] = Field(default_factory=dict)
    comment: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "row_number": self.row_number,
            "action": self.action,
            "old_status": self.old_status.value if self.old_status else None,
            "new_status": self.new_status.value,
            "actor": self.actor,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
            "comment": self.comment,
        }

