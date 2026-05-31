from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "正常"
    PENDING_CONFIRM = "待确认"
    DUPLICATE = "重复项"
    LATE_ATTACHMENT = "晚到附件"
    MANUAL_CORRECTION = "人工更正"
    ROLLBACK_SUCCESS = "回滚成功"
    ROLLBACK_FAILED = "回滚失败"


class IssueType(str, Enum):
    IDEMPOTENT_KEY_INVALID = "幂等键已失效"
    OLD_CLIENT_PARAMS_CORRUPTED = "旧客户端参数被破坏"
    AUDIT_LOG_GAP = "审计日志缺口"
    PERMISSION_TABLE_MISMATCH = "权限表版本不匹配"
    DUPLICATE_RECORD = "重复记录"
    LATE_ATTACHMENT_WARNING = "附件晚于审批到达"


@dataclass
class ApprovalRecord:
    record_id: str
    approval_id: str
    applicant: str
    approver: str
    approval_time: datetime
    status: str
    content: str
    idempotent_key: Optional[str] = None
    client_version: Optional[str] = None
    attachments: List["Attachment"] = field(default_factory=list)
    audit_log_ids: List[str] = field(default_factory=list)
    manual_corrections: List["ManualCorrection"] = field(default_factory=list)
    record_status: RecordStatus = RecordStatus.NORMAL
    issues: List["Issue"] = field(default_factory=list)
    permission_table_version: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Attachment:
    attachment_id: str
    name: str
    upload_time: datetime
    approval_id: str
    content_hash: str
    is_late: bool = False


@dataclass
class ManualCorrection:
    correction_id: str
    field_name: str
    old_value: str
    new_value: str
    operator: str
    correction_time: datetime
    reason: str


@dataclass
class PermissionTable:
    version: str
    effective_date: datetime
    entries: Dict[str, List[str]]
    source_file: str = ""

    def compare(self, other: "PermissionTable") -> "PermissionDiff":
        added = {}
        removed = {}
        changed = {}

        all_keys = set(self.entries.keys()) | set(other.entries.keys())
        for key in all_keys:
            old_perms = set(self.entries.get(key, []))
            new_perms = set(other.entries.get(key, []))
            if key not in self.entries:
                added[key] = sorted(new_perms)
            elif key not in other.entries:
                removed[key] = sorted(old_perms)
            elif old_perms != new_perms:
                changed[key] = {
                    "old": sorted(old_perms - new_perms),
                    "new": sorted(new_perms - old_perms)
                }

        return PermissionDiff(
            old_version=self.version,
            new_version=other.version,
            added=added,
            removed=removed,
            changed=changed
        )


@dataclass
class PermissionDiff:
    old_version: str
    new_version: str
    added: Dict[str, List[str]] = field(default_factory=dict)
    removed: Dict[str, List[str]] = field(default_factory=dict)
    changed: Dict[str, Dict[str, List[str]]] = field(default_factory=dict)

    @property
    def has_changes(self) -> bool:
        return bool(self.added or self.removed or self.changed)

    def human_readable_summary(self) -> List[str]:
        messages = []
        if self.added:
            for person, perms in self.added.items():
                messages.append(f"新增人员 {person}，权限：{'、'.join(perms)}")
        if self.removed:
            for person, perms in self.removed.items():
                messages.append(f"移除人员 {person}，原权限：{'、'.join(perms)}")
        if self.changed:
            for person, diff in self.changed.items():
                changes = []
                if diff["old"]:
                    changes.append(f"取消{'、'.join(diff['old'])}")
                if diff["new"]:
                    changes.append(f"增加{'、'.join(diff['new'])}")
                messages.append(f"{person} 权限变更：{'，'.join(changes)}")
        return messages


@dataclass
class Issue:
    issue_type: IssueType
    human_message: str
    detail: str = ""
    affected_fields: List[str] = field(default_factory=list)
    suggestion: str = ""


@dataclass
class RollbackResult:
    approval_id: str
    success: bool
    record_status: RecordStatus
    issues: List[Issue] = field(default_factory=list)
    permission_changes: Optional[PermissionDiff] = None
    actions_taken: List[str] = field(default_factory=list)
    needs_manual_confirm: bool = False

    def human_readable_report(self) -> str:
        lines = [f"审批单 {self.approval_id} 处理结果：{self.record_status.value}"]

        if self.needs_manual_confirm:
            lines.append("⚠️  此单需人工确认后才能完成回滚")

        for action in self.actions_taken:
            lines.append(f"  ✅ {action}")

        for issue in self.issues:
            icon = "❓" if issue.issue_type in (
                IssueType.IDEMPOTENT_KEY_INVALID,
                IssueType.OLD_CLIENT_PARAMS_CORRUPTED,
                IssueType.AUDIT_LOG_GAP
            ) else "⚠️"
            lines.append(f"  {icon} {issue.human_message}")
            if issue.suggestion:
                lines.append(f"     💡 建议：{issue.suggestion}")

        if self.permission_changes and self.permission_changes.has_changes:
            lines.append("  📋 权限表版本变更提醒：")
            for msg in self.permission_changes.human_readable_summary():
                lines.append(f"     🔄 {msg}")

        return "\n".join(lines)


@dataclass
class RollbackPackage:
    package_id: str
    received_time: datetime
    records: List[ApprovalRecord]
    permission_table: Optional[PermissionTable] = None
    source_description: str = ""
