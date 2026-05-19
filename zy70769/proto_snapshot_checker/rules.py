from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
from copy import deepcopy

from .parser import ProtoFile, ProtoMessage, ProtoField
from .snapshot import Snapshot, collect_all_fields_from_snapshot


class Severity(Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class RuleType(Enum):
    FIELD_NUMBER_REUSE = "FIELD_NUMBER_REUSE"
    FIELD_DELETED = "FIELD_DELETED"
    FIELD_TYPE_CHANGED = "FIELD_TYPE_CHANGED"
    FIELD_LABEL_CHANGED = "FIELD_LABEL_CHANGED"
    FIELD_NAME_CHANGED = "FIELD_NAME_CHANGED"
    MESSAGE_DELETED = "MESSAGE_DELETED"


@dataclass
class Violation:
    rule_type: RuleType
    severity: Severity
    message: str
    message_name: str
    field_number: Optional[int] = None
    field_name: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    location: Optional[Dict] = None
    old_location: Optional[Dict] = None

    def to_dict(self) -> Dict:
        result = {
            "rule_type": self.rule_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "message_name": self.message_name,
        }
        if self.field_number is not None:
            result["field_number"] = self.field_number
        if self.field_name is not None:
            result["field_name"] = self.field_name
        if self.old_value is not None:
            result["old_value"] = self.old_value
        if self.new_value is not None:
            result["new_value"] = self.new_value
        if self.location is not None:
            result["location"] = self.location
        if self.old_location is not None:
            result["old_location"] = self.old_location
        return result


@dataclass
class CompatibilityResult:
    violations: List[Violation] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)

    def add_violation(self, violation: Violation):
        self.violations.append(violation)
        key = f"{violation.severity.value}_{violation.rule_type.value}"
        self.summary[key] = self.summary.get(key, 0) + 1

    def has_errors(self) -> bool:
        return any(v.severity == Severity.ERROR for v in self.violations)

    def to_dict(self) -> Dict:
        return {
            "violations": [v.to_dict() for v in sorted(self.violations, key=lambda x: (x.severity.value, x.message_name, x.field_number or 0))],
            "summary": dict(sorted(self.summary.items())),
            "has_errors": self.has_errors(),
        }


INCOMPATIBLE_TYPE_CHANGES = {
    ("int32", "string"),
    ("int64", "string"),
    ("uint32", "string"),
    ("uint64", "string"),
    ("bool", "string"),
    ("float", "string"),
    ("double", "string"),
    ("bytes", "string"),
    ("string", "int32"),
    ("string", "int64"),
    ("string", "uint32"),
    ("string", "uint64"),
    ("string", "bool"),
    ("string", "float"),
    ("string", "double"),
    ("string", "bytes"),
}


class CompatibilityChecker:
    def check(
        self,
        old_snapshot: Snapshot,
        new_snapshot: Snapshot,
    ) -> CompatibilityResult:
        result = CompatibilityResult()

        old_fields = collect_all_fields_from_snapshot(old_snapshot)
        new_fields = collect_all_fields_from_snapshot(new_snapshot)

        all_message_names = sorted(set(old_fields.keys()) | set(new_fields.keys()))

        for msg_name in all_message_names:
            old_msg_fields = old_fields.get(msg_name, {})
            new_msg_fields = new_fields.get(msg_name, {})

            if msg_name not in new_fields:
                self._check_message_deleted(result, msg_name, old_msg_fields)
                continue

            if msg_name not in old_fields:
                continue

            self._check_message_fields(result, msg_name, old_msg_fields, new_msg_fields)

        return result

    def _check_message_deleted(
        self,
        result: CompatibilityResult,
        msg_name: str,
        old_msg_fields: Dict[int, Dict],
    ):
        for field_num in sorted(old_msg_fields.keys()):
            old_field = old_msg_fields[field_num]
            violation = Violation(
                rule_type=RuleType.MESSAGE_DELETED,
                severity=Severity.WARNING,
                message=f"消息 '{msg_name}' 已删除，字段编号 {field_num} 已被释放",
                message_name=msg_name,
                field_number=field_num,
                field_name=old_field["name"],
                old_location=old_field["location"],
            )
            result.add_violation(violation)

    def _check_message_fields(
        self,
        result: CompatibilityResult,
        msg_name: str,
        old_msg_fields: Dict[int, Dict],
        new_msg_fields: Dict[int, Dict],
    ):
        all_field_numbers = sorted(set(old_msg_fields.keys()) | set(new_msg_fields.keys()))

        for field_num in all_field_numbers:
            old_field = old_msg_fields.get(field_num)
            new_field = new_msg_fields.get(field_num)

            if old_field is None and new_field is not None:
                self._check_new_field(result, msg_name, field_num, new_field, old_msg_fields)
            elif old_field is not None and new_field is None:
                self._check_deleted_field(result, msg_name, field_num, old_field)
            elif old_field is not None and new_field is not None:
                self._check_existing_field(result, msg_name, field_num, old_field, new_field)

    def _check_new_field(
        self,
        result: CompatibilityResult,
        msg_name: str,
        field_num: int,
        new_field: Dict,
        old_msg_fields: Dict[int, Dict],
    ):
        used_names = {f["name"] for f in old_msg_fields.values()}

        if new_field["name"] in used_names:
            for old_num, old_f in sorted(old_msg_fields.items()):
                if old_f["name"] == new_field["name"] and old_num != field_num:
                    violation = Violation(
                        rule_type=RuleType.FIELD_NUMBER_REUSE,
                        severity=Severity.ERROR,
                        message=f"字段 '{new_field['name']}' 编号从 {old_num} 改为 {field_num}，旧编号被释放可能导致兼容性问题",
                        message_name=msg_name,
                        field_number=field_num,
                        field_name=new_field["name"],
                        old_value=old_num,
                        new_value=field_num,
                        location=new_field["location"],
                        old_location=old_f["location"],
                    )
                    result.add_violation(violation)

    def _check_deleted_field(
        self,
        result: CompatibilityResult,
        msg_name: str,
        field_num: int,
        old_field: Dict,
    ):
        violation = Violation(
            rule_type=RuleType.FIELD_DELETED,
            severity=Severity.WARNING,
            message=f"字段编号 {field_num} ('{old_field['name']}') 已被删除，编号已被释放",
            message_name=msg_name,
            field_number=field_num,
            field_name=old_field["name"],
            old_location=old_field["location"],
        )
        result.add_violation(violation)

    def _check_existing_field(
        self,
        result: CompatibilityResult,
        msg_name: str,
        field_num: int,
        old_field: Dict,
        new_field: Dict,
    ):
        if old_field["name"] != new_field["name"]:
            violation = Violation(
                rule_type=RuleType.FIELD_NUMBER_REUSE,
                severity=Severity.ERROR,
                message=f"字段编号 {field_num} 被复用：旧字段 '{old_field['name']}' -> 新字段 '{new_field['name']}'",
                message_name=msg_name,
                field_number=field_num,
                field_name=new_field["name"],
                old_value=old_field["name"],
                new_value=new_field["name"],
                location=new_field["location"],
                old_location=old_field["location"],
            )
            result.add_violation(violation)

        if old_field["type"] != new_field["type"]:
            type_change = (old_field["type"], new_field["type"])
            if type_change in INCOMPATIBLE_TYPE_CHANGES:
                violation = Violation(
                    rule_type=RuleType.FIELD_TYPE_CHANGED,
                    severity=Severity.ERROR,
                    message=f"字段 {field_num} ('{new_field['name']}') 类型不兼容变更：{old_field['type']} -> {new_field['type']}",
                    message_name=msg_name,
                    field_number=field_num,
                    field_name=new_field["name"],
                    old_value=old_field["type"],
                    new_value=new_field["type"],
                    location=new_field["location"],
                    old_location=old_field["location"],
                )
                result.add_violation(violation)
            else:
                violation = Violation(
                    rule_type=RuleType.FIELD_TYPE_CHANGED,
                    severity=Severity.WARNING,
                    message=f"字段 {field_num} ('{new_field['name']}') 类型变更：{old_field['type']} -> {new_field['type']}",
                    message_name=msg_name,
                    field_number=field_num,
                    field_name=new_field["name"],
                    old_value=old_field["type"],
                    new_value=new_field["type"],
                    location=new_field["location"],
                    old_location=old_field["location"],
                )
                result.add_violation(violation)

        if old_field["label"] != new_field["label"]:
            violation = Violation(
                rule_type=RuleType.FIELD_LABEL_CHANGED,
                severity=Severity.WARNING,
                message=f"字段 {field_num} ('{new_field['name']}') 标签变更：{old_field['label'] or 'default'} -> {new_field['label'] or 'default'}",
                message_name=msg_name,
                field_number=field_num,
                field_name=new_field["name"],
                old_value=old_field["label"] or "default",
                new_value=new_field["label"] or "default",
                location=new_field["location"],
                old_location=old_field["location"],
            )
            result.add_violation(violation)
