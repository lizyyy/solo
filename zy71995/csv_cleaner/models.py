"""核心数据结构定义"""
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
import hashlib
import json
import os


class RecordStatus(str, Enum):
    """记录状态枚举 - 用中文方便一线同事理解"""
    NORMAL = "正常"
    DUPLICATE = "重复项"
    LATE_ARRIVAL = "晚到附件"
    MANUAL_CORRECTION = "人工更正"
    INVALID = "无效数据"
    PENDING = "待处理"


class OperationType(str, Enum):
    """操作类型枚举"""
    IMPORT = "导入"
    DEDUP = "去重"
    LATE_MERGE = "晚到合并"
    PATH_FIX = "路径空格修复"
    MANUAL_APPLY = "应用人工更正"
    EXPORT = "导出"
    SCREEN_REFRESH = "刷新屏幕"
    FILTER_CHANGE = "变更筛选"


@dataclass
class CSVRecord:
    """CSV记录模型 - 每一条待处理的数据"""
    row_id: str
    source_file: str
    source_row_number: int
    data: Dict[str, Any]
    status: RecordStatus = RecordStatus.PENDING
    record_hash: str = ""
    original_path: str = ""
    normalized_path: str = ""
    has_path_space: bool = False
    duplicate_of: Optional[str] = None
    is_late_arrival: bool = False
    late_for_record_id: Optional[str] = None
    is_manual_correction: bool = False
    corrects_record_id: Optional[str] = None
    imported_at: datetime = field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None
    notes: str = ""

    def __post_init__(self):
        if not self.record_hash:
            self.record_hash = self._compute_hash()
        if "file_path" in self.data:
            self.original_path = str(self.data["file_path"])
            self._check_path_space()

    def _compute_hash(self) -> str:
        """计算记录内容哈希，用于去重判断"""
        hashable = {k: v for k, v in self.data.items() 
                    if k not in ["import_time", "process_time"]}
        content = json.dumps(hashable, sort_keys=True, default=str, ensure_ascii=False)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    def _check_path_space(self):
        """检查路径是否包含空格并记录"""
        path = self.original_path
        self.has_path_space = " " in path
        if self.has_path_space:
            self.normalized_path = os.path.normpath(path.strip())
            if not self.notes:
                self.notes = f"路径空格已修正：{path.strip()} → {self.normalized_path}"
        else:
            self.normalized_path = path

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["imported_at"] = self.imported_at.isoformat()
        if self.processed_at:
            result["processed_at"] = self.processed_at.isoformat()
        result["status"] = self.status.value
        return result

    def get_display_fields(self) -> Dict[str, Any]:
        """获取用于屏幕显示的字段"""
        return {
            "行号": self.source_row_number,
            "状态": self.status.value,
            **self.data,
            "路径空格": "是" if self.has_path_space else "否",
            "备注": self.notes
        }


@dataclass
class LedgerEntry:
    """运行账本条目 - 每一步操作都留痕"""
    timestamp: datetime
    operation: OperationType
    operator: str
    record_ids: List[str]
    details: Dict[str, Any] = field(default_factory=dict)
    screen_range_start: Optional[int] = None
    screen_range_end: Optional[int] = None
    filter_conditions: Dict[str, Any] = field(default_factory=dict)
    affected_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "操作时间": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "操作类型": self.operation.value,
            "操作人": self.operator,
            "影响记录数": self.affected_count,
            "涉及记录ID": ",".join(self.record_ids) if self.record_ids else "",
            "屏幕范围": self._format_screen_range(),
            "筛选条件": json.dumps(self.filter_conditions, ensure_ascii=False),
            "操作详情": json.dumps(self.details, ensure_ascii=False)
        }

    def _format_screen_range(self) -> str:
        if self.screen_range_start is not None and self.screen_range_end is not None:
            return f"第{self.screen_range_start}-{self.screen_range_end}行"
        return "全部"


@dataclass
class CleaningContext:
    """清洗上下文 - 维护当前会话状态"""
    session_id: str
    started_at: datetime = field(default_factory=datetime.now)
    operator: str = "系统"
    records: Dict[str, CSVRecord] = field(default_factory=dict)
    ledger: List[LedgerEntry] = field(default_factory=list)
    current_filter: Dict[str, Any] = field(default_factory=dict)
    screen_range_start: int = 0
    screen_range_end: int = 50
    page_size: int = 50
    current_page: int = 1
    last_refresh_at: Optional[datetime] = None
    processed_hashes: set = field(default_factory=set)

    def add_record(self, record: CSVRecord) -> bool:
        """添加记录，返回True表示是新记录，False表示是重复记录（但仍然会被添加）"""
        is_new = record.record_hash not in self.processed_hashes
        self.records[record.row_id] = record
        self.processed_hashes.add(record.record_hash)
        return is_new

    def add_ledger_entry(self, entry: LedgerEntry):
        """添加账本条目"""
        entry.screen_range_start = self.screen_range_start
        entry.screen_range_end = self.screen_range_end
        entry.filter_conditions = dict(self.current_filter)
        self.ledger.append(entry)

    def get_visible_records(self) -> List[CSVRecord]:
        """获取当前屏幕范围内的记录"""
        filtered = self._apply_filter(list(self.records.values()))
        self.screen_range_end = min(len(filtered), self.screen_range_start + self.page_size)
        return filtered[self.screen_range_start:self.screen_range_end]

    def _apply_filter(self, records: List[CSVRecord]) -> List[CSVRecord]:
        """应用筛选条件"""
        if not self.current_filter:
            return records
        
        filtered = []
        for rec in records:
            match = True
            for key, value in self.current_filter.items():
                if key == "status" and rec.status.value != value:
                    match = False
                elif key == "has_path_space" and rec.has_path_space != value:
                    match = False
                elif key == "source_file" and value not in rec.source_file:
                    match = False
                elif key in rec.data and str(value) not in str(rec.data[key]):
                    match = False
            if match:
                filtered.append(rec)
        return filtered

    def set_page(self, page: int):
        """设置当前页码，更新屏幕范围"""
        self.current_page = max(1, page)
        self.screen_range_start = (self.current_page - 1) * self.page_size
        self.last_refresh_at = datetime.now()

    def set_filter(self, **kwargs):
        """设置筛选条件，自动重置到第一页"""
        self.current_filter = kwargs
        self.current_page = 1
        self.screen_range_start = 0
        self.last_refresh_at = datetime.now()
