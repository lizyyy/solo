from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class NodeStatus(Enum):
    NORMAL = "正常"
    TIMEOUT = "超时"
    RESIGNED = "离职"
    PROXY = "代理审批"
    TIMEZONE_ISSUE = "时区混乱"
    ROLLBACK = "节点回退"


@dataclass
class ApprovalRecord:
    file_name: str
    line_number: int
    approval_id: str
    node_name: str
    approver: str
    approver_id: str
    action_time: datetime
    raw_time_str: str
    status: NodeStatus = NodeStatus.NORMAL
    is_proxy: bool = False
    proxy_from: Optional[str] = None
    issues: List[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "原始文件名": self.file_name,
            "行号": self.line_number,
            "审批编号": self.approval_id,
            "节点名称": self.node_name,
            "审批人": self.approver,
            "审批人ID": self.approver_id,
            "操作时间": self.action_time.strftime("%Y-%m-%d %H:%M:%S") if self.action_time else "",
            "原始时间字符串": self.raw_time_str,
            "状态": self.status.value,
            "是否代理": "是" if self.is_proxy else "否",
            "代理来源": self.proxy_from or "",
            "问题描述": "; ".join(self.issues)
        }


@dataclass
class ScanResult:
    total_records: int = 0
    timeout_count: int = 0
    resigned_count: int = 0
    proxy_count: int = 0
    timezone_issue_count: int = 0
    rollback_count: int = 0
    bad_line_count: int = 0
    records: List[ApprovalRecord] = field(default_factory=list)
    bad_lines: List[dict] = field(default_factory=list)

    def add_record(self, record: ApprovalRecord):
        self.total_records += 1
        self.records.append(record)
        if record.status == NodeStatus.TIMEOUT:
            self.timeout_count += 1
        elif record.status == NodeStatus.RESIGNED:
            self.resigned_count += 1
        if record.is_proxy:
            self.proxy_count += 1
        if NodeStatus.TIMEZONE_ISSUE in [s for s in record.issues if "时区" in s]:
            self.timezone_issue_count += 1
        if NodeStatus.ROLLBACK in [s for s in record.issues if "回退" in s]:
            self.rollback_count += 1

    def add_bad_line(self, file_name: str, line_number: int, error: str, raw_content: str):
        self.bad_line_count += 1
        self.bad_lines.append({
            "原始文件名": file_name,
            "行号": line_number,
            "错误信息": error,
            "原始内容": raw_content
        })
