from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    REVIEW_REQUIRED = "review_required"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    ROLLED_BACK = "rolled_back"


class AbnormalType(str, Enum):
    LEAVE_COUNTED_AS_CONSUMED = "leave_counted_as_consumed"
    MISMATCH_BETWEEN_SOURCES = "mismatch_between_sources"
    MANUAL_CORRECTION = "manual_correction"
    SUPPLEMENTARY_MATERIAL = "supplementary_material"


class ProcessStep(str, Enum):
    STEP1_IMPORT = "step1_import_engineer_message"
    STEP2_CHECK_GROUP = "step2_check_group_signup"
    STEP3_UPDATE_TRACKLIST = "step3_update_tracklist"
    STEP4_EXPORT = "step4_export_details"
    STEP5_SUPPLEMENT = "step5_supplementary_correction"


class FieldMapping:
    """
    统一业务字段映射 - 页面/导出/API 必须使用同一套字段定义
    核心原则：一个业务字段，多个展示名称，底层存储永远一致
    """
    FIELD_DEFINITIONS = {
        "id": {"display": "id", "export": "记录ID", "api": "id", "description": "记录唯一标识"},
        "episode_number": {"display": "episode", "export": "期数", "api": "episode_number", "description": "播客期数"},
        "track_name": {"display": "track", "export": "曲目名称", "api": "track_name", "description": "片头音乐名称"},
        "scheduled_date": {"display": "date", "export": "排期日期", "api": "scheduled_date", "description": "排期日期"},
        "scheduled_time": {"display": "time", "export": "排期时间", "api": "scheduled_time", "description": "排期时间"},
        "duration_minutes": {"display": "duration", "export": "时长(分钟)", "api": "duration_minutes", "description": "时长(分钟)"},
        "engineer_name": {"display": "engineer", "export": "调音师", "api": "engineer_name", "description": "调音师姓名"},
        "status": {"display": "status", "export": "状态", "api": "status", "description": "处理状态"},
        "status_text": {"display": "status_text", "export": "状态文本", "api": "status_text", "description": "状态中文说明"},
        "abnormal_type": {"display": "abnormal_type", "export": "异常类型", "api": "abnormal_type", "description": "异常类型编码"},
        "abnormal_note": {"display": "abnormal_note", "export": "异常说明", "api": "abnormal_note", "description": "异常详细说明"},
        "consumed": {"display": "consumed", "export": "是否已消耗", "api": "consumed", "description": "是否标记为已消耗"},
        "is_leave": {"display": "is_leave", "export": "是否请假", "api": "is_leave", "description": "是否标记为请假"},
        "current_step": {"display": "current_step", "export": "当前步骤", "api": "current_step", "description": "当前处理步骤"},
        "reviewer": {"display": "reviewer", "export": "复核人", "api": "reviewer", "description": "巡演统筹复核人"},
        "review_time": {"display": "review_time", "export": "复核时间", "api": "review_time", "description": "复核时间"},
        "review_conclusion": {"display": "review_conclusion", "export": "复核结论", "api": "review_conclusion", "description": "复核结论说明"},
        "export_status": {"display": "export_status", "export": "导出状态", "api": "export_status", "description": "导出明细状态"},
        "export_time": {"display": "export_time", "export": "导出时间", "api": "export_time", "description": "导出时间"},
        "export_operator": {"display": "export_operator", "export": "导出人", "api": "export_operator", "description": "导出操作人"},
        "export_note": {"display": "export_note", "export": "导出备注", "api": "export_note", "description": "导出备注说明"},
        "is_abnormal": {"display": "is_abnormal", "export": "是否异常", "api": "is_abnormal", "description": "是否异常记录"},
        "source_count": {"display": "source_count", "export": "证据来源数", "api": "source_count", "description": "证据来源数量"},
        "has_edits": {"display": "has_edits", "export": "有无人为改动", "api": "has_edits", "description": "是否有过人工改动"},
        "manual_edit_count": {"display": "manual_edit_count", "export": "人工改动次数", "api": "manual_edit_count", "description": "人工改动次数"},
    }

    @classmethod
    def get_field(cls, field_name: str, view_type: str) -> str:
        """获取指定视图的字段名"""
        if field_name not in cls.FIELD_DEFINITIONS:
            return field_name
        return cls.FIELD_DEFINITIONS[field_name].get(view_type, field_name)

    @classmethod
    def get_all_fields(cls, view_type: str) -> Dict[str, str]:
        """获取指定视图的所有字段映射"""
        return {k: v.get(view_type, k) for k, v in cls.FIELD_DEFINITIONS.items()}


@dataclass
class ExportMeta:
    """
    导出明细元数据 - 必须写入单一数据源
    确保重启/重载后导出链路仍然可用，导出状态不丢失
    """
    exported: bool = False
    export_time: Optional[datetime] = None
    export_operator: Optional[str] = None
    export_format: Optional[str] = None
    export_file_path: Optional[str] = None
    export_note: Optional[str] = None
    export_conclusion: Optional[str] = None
    include_sources: bool = True
    include_audit_logs: bool = True

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["export_time"] = self.export_time.isoformat() if self.export_time else None
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExportMeta":
        meta = cls()
        for key, value in data.items():
            if hasattr(meta, key):
                if key == "export_time" and value:
                    setattr(meta, key, datetime.fromisoformat(value))
                else:
                    setattr(meta, key, value)
        return meta


@dataclass
class AuditLog:
    timestamp: datetime
    step: ProcessStep
    operator: str
    action: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat() if self.timestamp else None
        d["step"] = self.step.value if isinstance(self.step, ProcessStep) else self.step
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditLog":
        data = dict(data)
        data["timestamp"] = datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else None
        if isinstance(data.get("step"), str):
            data["step"] = ProcessStep(data["step"])
        return cls(**data)


@dataclass
class SourceLine:
    source_name: str
    line_number: int
    raw_content: str
    parsed_data: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SourceLine":
        return cls(**data)


@dataclass
class ScheduleRecord:
    id: str
    episode_number: str
    track_name: str
    scheduled_date: str
    scheduled_time: str
    duration_minutes: int
    engineer_name: str
    status: RecordStatus = RecordStatus.PENDING
    abnormal_type: Optional[AbnormalType] = None
    abnormal_note: Optional[str] = None
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    review_conclusion: Optional[str] = None
    consumed: bool = False
    is_leave: bool = False
    sources: List[SourceLine] = field(default_factory=list)
    audit_logs: List[AuditLog] = field(default_factory=list)
    current_step: ProcessStep = ProcessStep.STEP1_IMPORT
    manual_edits: List[Dict[str, Any]] = field(default_factory=list)
    export_meta: ExportMeta = field(default_factory=ExportMeta)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value if isinstance(self.status, RecordStatus) else self.status
        d["abnormal_type"] = self.abnormal_type.value if isinstance(self.abnormal_type, AbnormalType) else self.abnormal_type
        d["current_step"] = self.current_step.value if isinstance(self.current_step, ProcessStep) else self.current_step
        d["sources"] = [s.to_dict() for s in self.sources]
        d["audit_logs"] = [a.to_dict() for a in self.audit_logs]
        if isinstance(self.review_time, datetime):
            d["review_time"] = self.review_time.isoformat()
        elif isinstance(self.review_time, str):
            d["review_time"] = self.review_time
        else:
            d["review_time"] = None
        d["export_meta"] = self.export_meta.to_dict()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScheduleRecord":
        data = dict(data)
        if isinstance(data.get("status"), str):
            data["status"] = RecordStatus(data["status"])
        if isinstance(data.get("abnormal_type"), str):
            data["abnormal_type"] = AbnormalType(data["abnormal_type"]) if data["abnormal_type"] else None
        if isinstance(data.get("current_step"), str):
            data["current_step"] = ProcessStep(data["current_step"])
        if data.get("review_time"):
            data["review_time"] = datetime.fromisoformat(data["review_time"])
        if "sources" in data:
            data["sources"] = [SourceLine.from_dict(s) for s in data.pop("sources")]
        if "audit_logs" in data:
            data["audit_logs"] = [AuditLog.from_dict(a) for a in data.pop("audit_logs")]
        if "export_meta" in data:
            data["export_meta"] = ExportMeta.from_dict(data.pop("export_meta"))
        return cls(**data)
