"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class TransferStage(str, Enum):
    """移交阶段"""
    FILING = "filing"
    TRIAL = "trial"
    ARCHIVE = "archive"


class ReceiptStatus(str, Enum):
    """签收状态"""
    PENDING = "pending"
    RECEIVED = "received"
    RETURNED = "returned"


class ReturnReason(str, Enum):
    """退回原因"""
    MISSING_PAGES = "missing_pages"
    CATALOG_MISMATCH = "catalog_mismatch"
    DAMAGED = "damaged"
    INCOMPLETE = "incomplete"


@dataclass
class DossierCatalog:
    """卷宗目录条目"""
    case_id: str
    item_id: str
    item_name: str
    page_start: int
    page_end: int
    page_count: int
    notes: Optional[str] = None
    id: Optional[int] = None
    created_at: Optional[str] = None


@dataclass
class TransferBatch:
    """移交批次"""
    batch_id: str
    case_id: str
    from_stage: TransferStage
    to_stage: TransferStage
    total_pages: int
    dossier_count: int
    transfer_date: str
    transfer_person: str
    status: ReceiptStatus = ReceiptStatus.PENDING
    notes: Optional[str] = None
    id: Optional[int] = None
    created_at: Optional[str] = None
    
    def get_expected_page_range(self) -> tuple:
        return (1, self.total_pages)


@dataclass
class ReceiptRecord:
    """签收记录"""
    receipt_id: str
    batch_id: str
    case_id: str
    receipt_date: str
    receipt_person: str
    received_page_count: Optional[int] = None
    missing_pages: Optional[str] = None
    extra_pages: Optional[str] = None
    status: ReceiptStatus = ReceiptStatus.PENDING
    return_reason: Optional[ReturnReason] = None
    return_notes: Optional[str] = None
    id: Optional[int] = None
    created_at: Optional[str] = None
    
    def get_missing_pages_list(self) -> List[int]:
        if not self.missing_pages:
            return []
        return parse_page_range(self.missing_pages)
    
    def get_extra_pages_list(self) -> List[int]:
        if not self.extra_pages:
            return []
        return parse_page_range(self.extra_pages)


@dataclass
class CheckIssue:
    """检查问题"""
    type: str
    message: str
    details: Optional[str] = None
    severity: str = "error"


@dataclass
class BatchCheckResult:
    """批次检查结果"""
    batch_id: str
    case_id: str
    issues: List[CheckIssue] = field(default_factory=list)
    passed: bool = True


@dataclass
class CheckResult:
    """检查结果汇总"""
    success: bool
    total_batches: int
    passed_count: int
    failed_count: int
    failures: List[BatchCheckResult] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class ImportProblem:
    """导入问题"""
    line_number: int
    source: str
    message: str
    details: Optional[str] = None
    
    def __str__(self) -> str:
        return f"[第{self.line_number}行] {self.message}"


@dataclass
class ImportResult:
    """导入结果"""
    success: bool
    success_count: int
    problem_count: int
    problems: List[ImportProblem] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class InitResult:
    """初始化结果"""
    success: bool
    messages: List[str] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class HistoryRecord:
    """历史记录"""
    timestamp: str
    operation: str
    success: bool
    details: str


@dataclass
class ExportResult:
    """导出结果"""
    success: bool
    record_count: int
    error: Optional[str] = None


def parse_page_range(range_str: str) -> List[int]:
    """解析页码范围字符串，如 "1,3-5,7" -> [1, 3, 4, 5, 7]"""
    pages = []
    for part in range_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            try:
                start, end = part.split("-", 1)
                start, end = int(start), int(end)
                if start > end:
                    continue
                pages.extend(range(start, end + 1))
            except (ValueError, TypeError):
                continue
        else:
            try:
                pages.append(int(part))
            except (ValueError, TypeError):
                continue
    return sorted(set(pages))


def format_page_range(pages: List[int]) -> str:
    """将页码列表格式化为范围字符串"""
    if not pages:
        return ""
    
    pages = sorted(set(pages))
    ranges = []
    start = pages[0]
    end = pages[0]
    
    for page in pages[1:]:
        if page == end + 1:
            end = page
        else:
            if start == end:
                ranges.append(str(start))
            else:
                ranges.append(f"{start}-{end}")
            start = page
            end = page
    
    if start == end:
        ranges.append(str(start))
    else:
        ranges.append(f"{start}-{end}")
    
    return ",".join(ranges)
