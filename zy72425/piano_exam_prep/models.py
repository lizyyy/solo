from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import hashlib
import json


class WorkflowStage(str, Enum):
    """工作流阶段"""
    IMPORTED = "imported"
    CONTRACT_SUPPLEMENTED = "contract_supplemented"
    WEEKLY_REPORT_GENERATED = "weekly_report_generated"


class ReviewStatus(str, Enum):
    """审核状态"""
    PENDING = "pending"
    NEEDS_REVIEW = "needs_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class DiscrepancyType(str, Enum):
    """不一致类型"""
    NAME_MISMATCH = "name_mismatch"
    DUPLICATE_SONG = "duplicate_song"
    MISSING_CONTRACT = "missing_contract"


@dataclass
class RehearsalSignUp:
    """排练群接龙原始记录 - 证据留存的第一手资料"""
    batch_id: str
    original_line_number: int
    student_name: str
    song_name_raw: str
    raw_text: str
    imported_at: datetime = field(default_factory=datetime.now)
    import_note: Optional[str] = None

    def dedupe_key(self) -> str:
        """按真实报名对象去重的 key（批次+学生+歌名），不包含原始行号
        同一批接龙里"小明 - 小星星"出现在多行，dedupe_key 相同，判定为本次重复
        """
        content = f"{self.batch_id}:{self.student_name}:{self.song_name_raw}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    def source_hash(self) -> str:
        """原始记录哈希 - 用于证据行的独立存储
        包含原始行号，保证接龙里每一行都有独立的证据文件
        注意：不用于去重判定，去重用 dedupe_key
        """
        content = f"{self.batch_id}:{self.original_line_number}:{self.student_name}:{self.song_name_raw}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


@dataclass
class ContractInfo:
    """合同页截图补录信息"""
    contract_id: str
    song_copyright_name: str
    screenshot_path: str
    supplemented_by: str
    supplemented_at: datetime = field(default_factory=datetime.now)
    note: Optional[str] = None

    def is_valid(self) -> bool:
        """合同信息是否有效（至少有合同号或版权名或截图路径任一非空）
        用于判断是否该把整个 contract_info 清空，避免回滚后残留空壳
        """
        return any([
            self.contract_id and self.contract_id.strip(),
            self.song_copyright_name and self.song_copyright_name.strip(),
            self.screenshot_path and self.screenshot_path.strip(),
        ])


@dataclass
class RepertoireRecord:
    """曲目准备记录 - 每首歌一条主记录"""
    record_id: str
    student_name: str
    song_display_name: str
    workflow_stage: WorkflowStage = WorkflowStage.IMPORTED
    review_status: ReviewStatus = ReviewStatus.PENDING
    discrepancy_type: Optional[DiscrepancyType] = None
    discrepancy_note: Optional[str] = None

    source_signup_hashes: List[str] = field(default_factory=list)
    contract_info: Optional[ContractInfo] = None

    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None

    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def has_name_discrepancy(self) -> bool:
        """是否存在现场名/版权名不一致"""
        if not self.contract_info:
            return False
        return self.song_display_name != self.contract_info.song_copyright_name

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["workflow_stage"] = self.workflow_stage.value
        d["review_status"] = self.review_status.value
        if self.discrepancy_type:
            d["discrepancy_type"] = self.discrepancy_type.value
        return d


@dataclass
class ChangeEntry:
    """单条变更记录 - 用于改前改后对比"""
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]


@dataclass
class ChangeHistory:
    """变更历史 - 每一次操作留下一条完整记录"""
    history_id: str
    record_id: str
    operator: str
    operation: str
    changes: List[ChangeEntry]
    timestamp: datetime = field(default_factory=datetime.now)
    note: Optional[str] = None

    def human_readable(self) -> str:
        parts = [f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {self.operator} {self.operation}"]
        for c in self.changes:
            parts.append(f"  - {c.field_name}: {c.old_value or '(空)'} → {c.new_value or '(空)'}")
        if self.note:
            parts.append(f"  备注: {self.note}")
        return "\n".join(parts)


@dataclass
class WeeklyReportEntry:
    """周报条目"""
    student_name: str
    song_display_name: str
    review_status: ReviewStatus
    discrepancy_note: Optional[str]
    has_contract: bool


class ImportResultType(str, Enum):
    """单条接龙导入结果类型"""
    NEW = "new"
    HISTORY_DUPLICATE = "history_duplicate"
    BATCH_DUPLICATE = "batch_duplicate"


@dataclass
class ImportResultItem:
    """单条接龙导入结果 - 明细到每一行，不靠总数糊过去"""
    original_line_number: int
    student_name: str
    song_name_raw: str
    result_type: ImportResultType
    record_id: Optional[str] = None
    source_hash: Optional[str] = None
    note: Optional[str] = None
