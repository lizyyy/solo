"""
校验规则定义
定义证据锚点的各种校验规则
"""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
from enum import Enum


class ErrorType(Enum):
    EVIDENCE_NUMBER_INVALID = "证据编号无效"
    EVIDENCE_NUMBER_NOT_EXIST = "证据编号不存在于证据目录"
    PAGE_MISSING = "引用页码缺失"
    PAGE_INVALID = "引用页码无效"
    DUPLICATE_ANCHOR = "同一发言段落重复锚定"
    SPEAKER_MISMATCH = "发言人不匹配"
    TIMESTAMP_MISMATCH = "时间码不匹配"
    TIMESTAMP_INVALID = "时间码格式无效"
    FIELD_MISSING = "必需字段缺失"
    FORMAT_ERROR = "格式错误"


@dataclass
class ValidationError:
    error_type: ErrorType
    message: str
    location: str
    severity: str = "error"
    suggestion: Optional[str] = None


@dataclass
class EvidenceAnchor:
    evidence_number: str
    page_numbers: List[str]
    speaker: str
    timestamp: str
    transcript_line: int
    raw_text: str


class ValidationRules:
    EVIDENCE_NUMBER_PATTERN = re.compile(r"^[证Z]?\d{1,4}(-\d+)?$")
    TIMESTAMP_PATTERN = re.compile(r"^(\d{1,2}):(\d{2}):(\d{2})$")
    PAGE_RANGE_PATTERN = re.compile(r"^(\d+)(-(\d+))?$")

    @classmethod
    def validate_evidence_number(cls, evidence_num: str) -> Tuple[bool, Optional[str]]:
        if not evidence_num or not evidence_num.strip():
            return False, "证据编号不能为空"
        
        normalized = cls._normalize_evidence_number(evidence_num)
        if not cls.EVIDENCE_NUMBER_PATTERN.match(normalized):
            return False, f"证据编号格式无效: {evidence_num}，应为 证1 或 1 或 1-1 格式"
        
        return True, None

    @classmethod
    def validate_page_number(cls, page_str: str) -> Tuple[bool, Optional[str]]:
        if not page_str or not page_str.strip():
            return False, "页码不能为空"
        
        match = cls.PAGE_RANGE_PATTERN.match(page_str.strip())
        if not match:
            return False, f"页码格式无效: {page_str}，应为 1 或 1-5 格式"
        
        start = int(match.group(1))
        end = int(match.group(3)) if match.group(3) else start
        
        if start <= 0:
            return False, f"页码起始值无效: {page_str}"
        
        if end < start:
            return False, f"页码范围无效: {page_str}，结束页码应大于等于起始页码"
        
        return True, None

    @classmethod
    def validate_timestamp(cls, timestamp: str) -> Tuple[bool, Optional[str]]:
        if not timestamp or not timestamp.strip():
            return False, "时间码不能为空"
        
        match = cls.TIMESTAMP_PATTERN.match(timestamp.strip())
        if not match:
            return False, f"时间码格式无效: {timestamp}，应为 HH:MM:SS 格式"
        
        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds = int(match.group(3))
        
        if hours < 0 or hours > 24:
            return False, f"小时值无效: {hours}"
        if minutes < 0 or minutes > 59:
            return False, f"分钟值无效: {minutes}"
        if seconds < 0 or seconds > 59:
            return False, f"秒值无效: {seconds}"
        
        return True, None

    @classmethod
    def _normalize_evidence_number(cls, evidence_num: str) -> str:
        normalized = evidence_num.strip().upper()
        normalized = normalized.replace("证", "Z")
        normalized = normalized.replace("Z", "")
        return normalized

    @classmethod
    def evidence_numbers_match(cls, num1: str, num2: str) -> bool:
        norm1 = cls._normalize_evidence_number(num1)
        norm2 = cls._normalize_evidence_number(num2)
        return norm1 == norm2

    @classmethod
    def timestamp_to_seconds(cls, timestamp: str) -> int:
        match = cls.TIMESTAMP_PATTERN.match(timestamp.strip())
        if not match:
            return -1
        
        hours = int(match.group(1))
        minutes = int(match.group(2))
        seconds = int(match.group(3))
        
        return hours * 3600 + minutes * 60 + seconds

    @classmethod
    def check_duplicate_anchors(cls, anchors: List[EvidenceAnchor]) -> List[ValidationError]:
        errors = []
        seen_combinations = {}
        
        for anchor in anchors:
            key = (anchor.speaker, anchor.transcript_line, anchor.evidence_number)
            
            if key in seen_combinations:
                errors.append(ValidationError(
                    error_type=ErrorType.DUPLICATE_ANCHOR,
                    message=f"同一发言段落被重复锚定证据编号: {anchor.evidence_number}",
                    location=f"第{anchor.transcript_line}行 - {anchor.speaker}的发言",
                    suggestion="检查并删除重复的锚定标记"
                ))
            else:
                seen_combinations[key] = anchor
        
        return errors

    @classmethod
    def validate_anchor(
        cls,
        anchor: EvidenceAnchor,
        valid_evidence_numbers: List[str],
        max_page: int = 1000
    ) -> List[ValidationError]:
        errors = []
        
        valid, msg = cls.validate_evidence_number(anchor.evidence_number)
        if not valid:
            errors.append(ValidationError(
                error_type=ErrorType.EVIDENCE_NUMBER_INVALID,
                message=msg,
                location=f"第{anchor.transcript_line}行 - 证据编号: {anchor.evidence_number}",
                suggestion="检查证据编号格式，应为 证1、1 或 1-1 格式"
            ))
        
        evidence_exists = any(
            cls.evidence_numbers_match(anchor.evidence_number, valid_num)
            for valid_num in valid_evidence_numbers
        )
        if not evidence_exists:
            errors.append(ValidationError(
                error_type=ErrorType.EVIDENCE_NUMBER_NOT_EXIST,
                message=f"证据编号不存在于证据目录: {anchor.evidence_number}",
                location=f"第{anchor.transcript_line}行",
                suggestion="核对证据目录，确认该证据编号是否存在"
            ))
        
        if not anchor.page_numbers:
            errors.append(ValidationError(
                error_type=ErrorType.PAGE_MISSING,
                message=f"证据 {anchor.evidence_number} 缺少引用页码",
                location=f"第{anchor.transcript_line}行",
                suggestion="为每个证据锚定添加页码引用，如 证1 第3页"
            ))
        else:
            for page in anchor.page_numbers:
                valid_page, page_msg = cls.validate_page_number(page)
                if not valid_page:
                    errors.append(ValidationError(
                        error_type=ErrorType.PAGE_INVALID,
                        message=f"页码错误: {page_msg}",
                        location=f"第{anchor.transcript_line}行 - 证据 {anchor.evidence_number}",
                        suggestion="检查页码格式，应为 1 或 1-5 范围"
                    ))
        
        valid_ts, ts_msg = cls.validate_timestamp(anchor.timestamp)
        if not valid_ts:
            errors.append(ValidationError(
                error_type=ErrorType.TIMESTAMP_INVALID,
                message=ts_msg,
                location=f"第{anchor.transcript_line}行 - 时间码: {anchor.timestamp}",
                suggestion="检查时间码格式，应为 HH:MM:SS 格式"
            ))
        
        return errors


@dataclass
class EvidenceCatalogEntry:
    evidence_number: str
    evidence_name: str
    page_count: int
    submission_party: str
    category: str
    remarks: Optional[str] = None


@dataclass
class TranscriptSegment:
    timestamp: str
    speaker: str
    content: str
    line_number: int
    anchors: List[EvidenceAnchor] = None

    def __post_init__(self):
        if self.anchors is None:
            self.anchors = []


@dataclass
class TimestampEntry:
    timestamp: str
    speaker: str
    event_type: str
    description: str
    duration_seconds: int = 0
