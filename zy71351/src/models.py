from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


class PrintStatus(str, Enum):
    AVAILABLE = "available"
    SOLD = "sold"
    RETURNED = "returned"
    RESERVED = "reserved"


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class PrintRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")

    series: str = Field(..., description="作品系列名称")
    edition_number: str = Field(..., description="版号，如 '3/50' 或 'AP 2/5'")
    is_ap: bool = Field(default=False, description="是否为AP版")
    buyer: Optional[str] = Field(default=None, description="购买人")
    certificate_number: Optional[str] = Field(default=None, description="证书号")
    verification_report: Optional[str] = Field(default=None, description="核对报告")
    remarks: Optional[str] = Field(default=None, description="备注")
    receipt: Optional[str] = Field(default=None, description="回执")
    status: PrintStatus = Field(default=PrintStatus.AVAILABLE, description="作品状态")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    batch_id: Optional[str] = Field(default=None, description="批次ID")
    record_id: str = Field(..., description="记录唯一ID")

    @field_validator("edition_number")
    @classmethod
    def validate_edition_format(cls, v: str) -> str:
        if not v:
            raise ValueError("版号不能为空")
        regular_pattern = r"^(\d+)/(\d+)$"
        ap_pattern = r"^AP\s+(\d+)/(\d+)$"
        if not re.match(regular_pattern, v) and not re.match(ap_pattern, v):
            raise ValueError(f"版号格式错误: {v}，应为 '数字/总数' 或 'AP 数字/总数'")
        return v

    def get_edition_key(self) -> str:
        return f"{self.series}::{self.edition_number}"

    def is_sold_without_certificate(self) -> bool:
        return self.status == PrintStatus.SOLD and not self.certificate_number

    def is_returned_with_wrong_status(self) -> bool:
        return self.status == PrintStatus.RETURNED and self.buyer and self.certificate_number


class Conflict(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conflict_type: str = Field(..., description="冲突类型")
    severity: Severity = Field(..., description="严重程度")
    description: str = Field(..., description="冲突描述")
    affected_records: List[str] = Field(default_factory=list, description="受影响的记录ID")
    details: Dict[str, Any] = Field(default_factory=dict, description="详细信息")


class BatchValidationResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    batch_id: str = Field(..., description="批次ID")
    total_records: int = Field(default=0, description="总记录数")
    conflicts: List[Conflict] = Field(default_factory=list, description="冲突列表")
    processed_at: datetime = Field(default_factory=datetime.now)
    is_valid: bool = Field(default=True, description="是否通过校验")

    def get_conflicts_by_severity(self, severity: Severity) -> List[Conflict]:
        return [c for c in self.conflicts if c.severity == severity]

    def has_critical_conflicts(self) -> bool:
        return any(c.severity == Severity.CRITICAL for c in self.conflicts)


class HistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    operation: str = Field(..., description="操作类型")
    batch_id: str = Field(..., description="批次ID")
    timestamp: datetime = Field(default_factory=datetime.now)
    record_count: int = Field(default=0, description="记录数量")
    conflict_count: int = Field(default=0, description="冲突数量")
    export_count: Optional[int] = Field(default=None, description="导出数量")
    user: Optional[str] = Field(default=None, description="操作人")
    details: Dict[str, Any] = Field(default_factory=dict, description="详细信息")
