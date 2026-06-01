"""追溯模块 - 来源追踪、历史样本回溯"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json
import hashlib


@dataclass
class TraceRecord:
    """追溯记录 - 每条数据的来源和变更轨迹"""
    trace_id: str
    record_id: str
    source_type: str  # manual, imported, legacy, calculated
    source_file: str
    source_line: Optional[int] = None
    original_value: Any = None
    converted_value: Any = None
    conversion_rule: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: List[str] = field(default_factory=list)
    data_hash: str = ""

    def calculate_hash(self) -> str:
        """计算数据哈希用于校验"""
        data_str = json.dumps(
            {
                "record_id": self.record_id,
                "original_value": str(self.original_value),
                "converted_value": str(self.converted_value),
                "source_file": self.source_file,
                "notes": self.notes,
            },
            sort_keys=True,
        )
        return hashlib.sha256(data_str.encode()).hexdigest()[:16]


class DataTracer:
    """数据追溯器 - 追踪每条数据的来源和变更历史"""

    def __init__(self):
        self.trace_records: Dict[str, TraceRecord] = {}
        self.history_index: Dict[str, List[str]] = {}  # record_id -> trace_id列表

    def create_trace(
        self,
        record_id: str,
        source_type: str,
        source_file: str,
        original_value: Any = None,
        converted_value: Any = None,
        conversion_rule: Optional[str] = None,
        source_line: Optional[int] = None,
        notes: Optional[List[str]] = None,
    ) -> TraceRecord:
        """
        创建追溯记录

        Args:
            record_id: 记录ID
            source_type: 来源类型
            source_file: 来源文件
            original_value: 原始值
            converted_value: 转换后的值
            conversion_rule: 转换规则说明
            source_line: 来源文件行号
            notes: 备注信息

        Returns:
            TraceRecord
        """
        trace_id = f"TRACE-{record_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        trace = TraceRecord(
            trace_id=trace_id,
            record_id=record_id,
            source_type=source_type,
            source_file=source_file,
            source_line=source_line,
            original_value=original_value,
            converted_value=converted_value,
            conversion_rule=conversion_rule,
            notes=notes or [],
        )
        trace.data_hash = trace.calculate_hash()

        self.trace_records[trace_id] = trace

        if record_id not in self.history_index:
            self.history_index[record_id] = []
        self.history_index[record_id].append(trace_id)

        return trace

    def add_note(self, trace_id: str, note: str) -> None:
        """
        给追溯记录添加备注

        Args:
            trace_id: 追溯ID
            note: 备注内容
        """
        if trace_id in self.trace_records:
            timestamp = datetime.now().strftime("%H:%M:%S")
            self.trace_records[trace_id].notes.append(f"[{timestamp}] {note}")
            # 重新计算哈希
            self.trace_records[trace_id].data_hash = self.trace_records[trace_id].calculate_hash()

    def get_trace(self, trace_id: str) -> Optional[TraceRecord]:
        """根据追溯ID获取记录"""
        return self.trace_records.get(trace_id)

    def get_record_history(self, record_id: str) -> List[TraceRecord]:
        """
        获取某条记录的所有历史追溯

        Args:
            record_id: 记录ID

        Returns:
            追溯记录列表（按时间倒序）
        """
        trace_ids = self.history_index.get(record_id, [])
        records = [self.trace_records[tid] for tid in trace_ids if tid in self.trace_records]
        return sorted(records, key=lambda x: x.timestamp, reverse=True)

    def find_legacy_record(
        self,
        criteria: Dict,
        history_samples: List[Dict],
        record_id: str,
    ) -> Optional[Dict]:
        """
        从历史样本中查找匹配的旧口径记录

        Args:
            criteria: 匹配条件
            history_samples: 历史样本列表
            record_id: 新记录ID

        Returns:
            匹配的历史记录
        """
        for sample in history_samples:
            match = True
            for key, value in criteria.items():
                if sample.get(key) != value:
                    match = False
                    break

            if match:
                # 创建追溯记录
                self.create_trace(
                    record_id=record_id,
                    source_type="legacy",
                    source_file=sample.get("_source_file", "history_samples.json"),
                    original_value=sample,
                    converted_value=None,
                    conversion_rule="旧口径历史样本匹配",
                    notes=[f"从历史样本回溯: 匹配条件={criteria}"],
                )
                return sample

        return None

    def verify_trace_chain(self, record_id: str) -> Dict:
        """
        验证追溯链的完整性

        Args:
            record_id: 记录ID

        Returns:
            验证结果
        """
        history = self.get_record_history(record_id)

        if not history:
            return {
                "record_id": record_id,
                "is_complete": False,
                "trace_count": 0,
                "issues": ["无追溯记录"],
            }

        issues = []
        for i, trace in enumerate(history):
            expected_hash = trace.calculate_hash()
            if trace.data_hash != expected_hash:
                issues.append(f"追溯记录 {trace.trace_id} 哈希校验失败，数据可能被篡改")

        return {
            "record_id": record_id,
            "is_complete": len(issues) == 0,
            "trace_count": len(history),
            "issues": issues,
            "trace_ids": [t.trace_id for t in history],
        }

    def export_traces(self, record_id: Optional[str] = None) -> List[Dict]:
        """
        导出追溯记录（用于报告）

        Args:
            record_id: 可选，只导出特定记录

        Returns:
            追溯记录字典列表
        """
        if record_id:
            traces = self.get_record_history(record_id)
        else:
            traces = list(self.trace_records.values())

        return [
            {
                "trace_id": t.trace_id,
                "record_id": t.record_id,
                "source_type": t.source_type,
                "source_file": t.source_file,
                "source_line": t.source_line,
                "original_value": str(t.original_value)[:100] if t.original_value else None,
                "converted_value": str(t.converted_value)[:100] if t.converted_value else None,
                "conversion_rule": t.conversion_rule,
                "timestamp": t.timestamp,
                "notes": t.notes,
                "data_hash": t.data_hash,
            }
            for t in traces
        ]
