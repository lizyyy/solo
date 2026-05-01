#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
配置模型模块
定义案件配置、证据类型、脱敏规则等数据结构
"""

import json
import os
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Set

from pydantic import BaseModel, Field, field_validator


class EvidenceType(str, Enum):
    """证据类型枚举"""
    HTML_PAGE = "html_page"
    MHTML_ARCHIVE = "mhtml_archive"
    HAR_LOG = "har_log"
    SCREENSHOT = "screenshot"
    PDF_DOCUMENT = "pdf_document"
    CHAT_LOG = "chat_log"
    ATTACHMENT = "attachment"


class TimeTrustLevel(str, Enum):
    """时间可信度等级"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNTRUSTED = "untrusted"


class TimeSourceRule(BaseModel):
    """时间来源可信度规则"""
    source: str
    trust_level: TimeTrustLevel
    description: str = ""


class RedactionRule(BaseModel):
    """脱敏规则"""
    name: str
    pattern: str
    replacement: str = "[REDACTED]"
    enabled: bool = True


class CaseConfig(BaseModel):
    """案件配置模型"""
    case_id: str = Field(..., description="案件唯一标识")
    case_name: str = Field(..., description="案件名称")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    timezone: str = "Asia/Shanghai"

    evidence_types: Dict[str, EvidenceType] = Field(
        default_factory=lambda: {
            "html": EvidenceType.HTML_PAGE,
            "htm": EvidenceType.HTML_PAGE,
            "mhtml": EvidenceType.MHTML_ARCHIVE,
            "mht": EvidenceType.MHTML_ARCHIVE,
            "har": EvidenceType.HAR_LOG,
            "png": EvidenceType.SCREENSHOT,
            "jpg": EvidenceType.SCREENSHOT,
            "jpeg": EvidenceType.SCREENSHOT,
            "pdf": EvidenceType.PDF_DOCUMENT,
            "txt": EvidenceType.CHAT_LOG,
        }
    )

    redaction_rules: List[RedactionRule] = Field(
        default_factory=lambda: [
            RedactionRule(
                name="手机号",
                pattern=r"1[3-9]\d{9}",
                replacement="[PHONE]",
            ),
            RedactionRule(
                name="邮箱",
                pattern=r"[\w.-]+@[\w.-]+\.\w+",
                replacement="[EMAIL]",
            ),
            RedactionRule(
                name="身份证号",
                pattern=r"\d{17}[\dXx]",
                replacement="[ID_CARD]",
            ),
            RedactionRule(
                name="地址",
                pattern=r"[\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|街道|路|号|楼|层|室)[\u4e00-\u9fa5\d]*",
                replacement="[ADDRESS]",
            ),
        ]
    )

    custom_redaction_keywords: List[str] = Field(default_factory=list)

    time_trust_rules: List[TimeSourceRule] = Field(
        default_factory=lambda: [
            TimeSourceRule(
                source="har_request_time",
                trust_level=TimeTrustLevel.HIGH,
                description="HAR日志中的请求时间",
            ),
            TimeSourceRule(
                source="har_response_time",
                trust_level=TimeTrustLevel.HIGH,
                description="HAR日志中的响应时间",
            ),
            TimeSourceRule(
                source="html_meta_time",
                trust_level=TimeTrustLevel.MEDIUM,
                description="HTML页面中的meta时间",
            ),
            TimeSourceRule(
                source="chat_message_time",
                trust_level=TimeTrustLevel.MEDIUM,
                description="聊天记录中的消息时间",
            ),
            TimeSourceRule(
                source="file_modified_time",
                trust_level=TimeTrustLevel.LOW,
                description="文件修改时间",
            ),
            TimeSourceRule(
                source="screenshot_exif_time",
                trust_level=TimeTrustLevel.LOW,
                description="截图EXIF时间",
            ),
        ]
    )

    max_attachment_size_mb: int = 100

    output_dir: str = "./output"

    evidence_evidence_dir: str = "./evidence"

    quarantine_dir: str = "./quarantine"

    redacted_dir: str = "./redacted"

    def get_extension_type(self, extension: str) -> Optional[EvidenceType]:
        """根据文件扩展名获取证据类型"""
        ext = extension.lower().lstrip(".")
        return self.evidence_types.get(ext)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """验证时区有效性"""
        import pytz
        try:
            pytz.timezone(v)
            return v
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"未知的时区: {v}")

    def to_json(self, indent: int = 2) -> str:
        """导出为JSON字符串"""
        return self.model_dump_json(
            indent=indent,
            by_alias=True,
            exclude_none=True,
        )

    @classmethod
    def from_json(cls, json_str: str) -> "CaseConfig":
        """从JSON字符串加载"""
        return cls.model_validate_json(json_str)

    def save(self, file_path: str) -> None:
        """保存配置到文件"""
        self.updated_at = datetime.now()
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    @classmethod
    def load(cls, file_path: str) -> "CaseConfig":
        """从文件加载配置"""
        with open(file_path, "r", encoding="utf-8") as f:
            return cls.from_json(f.read())


class EvidenceRecord(BaseModel):
    """证据记录模型"""
    evidence_id: str
    original_filename: str
    stored_filename: str
    file_path: str
    file_size: int
    sha256_hash: str
    evidence_type: EvidenceType
    imported_at: datetime
    source_directory: str
    metadata: Dict = Field(default_factory=dict)
    notes: str = ""


class TimelineEvent(BaseModel):
    """时间线事件模型"""
    event_id: str
    source: str
    source_file: str
    timestamp: datetime
    timezone: str
    trust_level: TimeTrustLevel
    event_type: str
    summary: str
    details: Dict = Field(default_factory=dict)
    evidence_id: Optional[str] = None


class QuarantineItem(BaseModel):
    """隔离区项目模型"""
    item_id: str
    evidence_id: Optional[str] = None
    file_path: str
    quarantine_reason: str
    quarantine_at: datetime
    severity: str = "warning"
    details: Dict = Field(default_factory=dict)
    original_evidence_record: Optional[Dict] = None


class ValidationIssue(BaseModel):
    """校验问题模型"""
    issue_id: str
    issue_type: str
    severity: str
    description: str
    evidence_id: Optional[str] = None
    file_path: Optional[str] = None
    details: Dict = Field(default_factory=dict)
    suggested_action: str = ""


class AuditLogEntry(BaseModel):
    """审计日志条目模型"""
    timestamp: datetime
    action: str
    user: str = "system"
    details: Dict = Field(default_factory=dict)
