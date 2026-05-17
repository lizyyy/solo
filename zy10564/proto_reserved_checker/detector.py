import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Tuple
from enum import Enum

from .parser import ProtoParser, ProtoFile, MessageInfo, FieldInfo, ReservedRange


class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskType(Enum):
    FIELD_NUMBER_REUSE = "field_number_reuse"
    RESERVED_MISSING_FOR_DELETED = "reserved_missing_for_deleted"
    FIELD_IN_RESERVED_RANGE = "field_in_reserved_range"
    DUPLICATE_FIELD_NUMBER = "duplicate_field_number"
    RESERVED_NAME_CONFLICT = "reserved_name_conflict"


@dataclass
class RiskItem:
    risk_type: RiskType
    level: RiskLevel
    message: str
    file_path: str
    line: int
    column: int = 0
    message_name: str = ""
    field_name: str = ""
    field_number: Optional[int] = None
    raw_line: str = ""
    details: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "risk_type": self.risk_type.value,
            "level": self.level.value,
            "message": self.message,
            "file_path": self.file_path,
            "line": self.line,
            "column": self.column,
            "message_name": self.message_name,
            "field_name": self.field_name,
            "field_number": self.field_number,
            "raw_line": self.raw_line.rstrip() if self.raw_line else "",
            "details": self.details
        }


@dataclass
class DeletedFieldInfo:
    field_name: str
    field_number: int
    message_name: str
    file_path: str
    snapshot_version: str = ""


class RiskDetector:
    def __init__(self):
        self.parser = ProtoParser()
        self.historical_snapshots: Dict[str, ProtoFile] = {}

    def load_historical_snapshot(self, filepath: str, version_label: str) -> Optional[ProtoFile]:
        try:
            proto = self.parser.parse(filepath)
            self.historical_snapshots[version_label] = proto
            return proto
        except Exception:
            return None

    def detect_risks(self, current_proto: ProtoFile, historical_proto: Optional[ProtoFile] = None) -> List[RiskItem]:
        risks: List[RiskItem] = []

        risks.extend(self._detect_duplicate_field_numbers(current_proto))
        risks.extend(self._detect_fields_in_reserved_range(current_proto))
        risks.extend(self._detect_reserved_name_conflicts(current_proto))

        if historical_proto:
            risks.extend(self._detect_field_number_reuse(current_proto, historical_proto))
            risks.extend(self._detect_missing_reserved_for_deleted(current_proto, historical_proto))

        return risks

    def _detect_duplicate_field_numbers(self, proto: ProtoFile) -> List[RiskItem]:
        risks: List[RiskItem] = []
        all_messages = proto.get_all_messages()

        for msg_name, msg in all_messages.items():
            number_map: Dict[int, List[FieldInfo]] = {}
            for field in msg.fields:
                if field.number not in number_map:
                    number_map[field.number] = []
                number_map[field.number].append(field)

            for num, fields in number_map.items():
                if len(fields) > 1:
                    for field in fields:
                        risks.append(RiskItem(
                            risk_type=RiskType.DUPLICATE_FIELD_NUMBER,
                            level=RiskLevel.CRITICAL,
                            message=f"字段编号 {num} 在消息 '{msg_name}' 中被重复定义",
                            file_path=proto.path,
                            line=field.line,
                            message_name=msg_name,
                            field_name=field.name,
                            field_number=num,
                            raw_line=proto.raw_lines[field.line - 1] if field.line <= len(proto.raw_lines) else "",
                            details={
                                "duplicate_fields": [f.name for f in fields]
                            }
                        ))

        return risks

    def _detect_fields_in_reserved_range(self, proto: ProtoFile) -> List[RiskItem]:
        risks: List[RiskItem] = []
        all_messages = proto.get_all_messages()

        for msg_name, msg in all_messages.items():
            for field in msg.fields:
                if msg.is_number_reserved(field.number):
                    reserved_info = self._find_reserved_range_info(msg, field.number)
                    risks.append(RiskItem(
                        risk_type=RiskType.FIELD_IN_RESERVED_RANGE,
                        level=RiskLevel.CRITICAL,
                        message=f"字段 '{field.name}' (编号 {field.number}) 使用了 reserved 范围内的编号",
                        file_path=proto.path,
                        line=field.line,
                        message_name=msg_name,
                        field_name=field.name,
                        field_number=field.number,
                        raw_line=proto.raw_lines[field.line - 1] if field.line <= len(proto.raw_lines) else "",
                        details={
                            "reserved_range": reserved_info
                        }
                    ))

        return risks

    def _find_reserved_range_info(self, msg: MessageInfo, num: int) -> Optional[Tuple[int, Optional[int]]]:
        for r in msg.reserved_numbers:
            if r.contains(num):
                return r.to_tuple()
        if msg.parent:
            return self._find_reserved_range_info(msg.parent, num)
        return None

    def _detect_reserved_name_conflicts(self, proto: ProtoFile) -> List[RiskItem]:
        risks: List[RiskItem] = []
        all_messages = proto.get_all_messages()

        for msg_name, msg in all_messages.items():
            field_names = set(f.name for f in msg.fields)
            for reserved_name in msg.reserved_names:
                if reserved_name in field_names:
                    field = next(f for f in msg.fields if f.name == reserved_name)
                    risks.append(RiskItem(
                        risk_type=RiskType.RESERVED_NAME_CONFLICT,
                        level=RiskLevel.HIGH,
                        message=f"字段名 '{reserved_name}' 在消息 '{msg_name}' 中被标记为 reserved 但仍在使用",
                        file_path=proto.path,
                        line=field.line,
                        message_name=msg_name,
                        field_name=field.name,
                        field_number=field.number,
                        raw_line=proto.raw_lines[field.line - 1] if field.line <= len(proto.raw_lines) else ""
                    ))

        return risks

    def _detect_field_number_reuse(self, current_proto: ProtoFile, historical_proto: ProtoFile) -> List[RiskItem]:
        risks: List[RiskItem] = []

        current_messages = current_proto.get_all_messages()
        historical_messages = historical_proto.get_all_messages()

        for msg_name, current_msg in current_messages.items():
            if msg_name not in historical_messages:
                continue

            historical_msg = historical_messages[msg_name]
            historical_field_map = {f.number: f for f in historical_msg.fields}
            current_field_map = {f.number: f for f in current_msg.fields}

            common_numbers = set(historical_field_map.keys()) & set(current_field_map.keys())

            for num in common_numbers:
                historical_field = historical_field_map[num]
                current_field = current_field_map[num]
                if historical_field.name != current_field.name:
                    if not current_msg.is_number_reserved(num):
                        risks.append(RiskItem(
                            risk_type=RiskType.FIELD_NUMBER_REUSE,
                            level=RiskLevel.CRITICAL,
                            message=f"字段编号 {num} 被复用: 原字段 '{historical_field.name}' 被删除或重命名，但未添加 reserved，新字段 '{current_field.name}' 使用了该编号",
                            file_path=current_proto.path,
                            line=current_field.line,
                            message_name=msg_name,
                            field_name=current_field.name,
                            field_number=num,
                            raw_line=current_proto.raw_lines[current_field.line - 1] if current_field.line <= len(current_proto.raw_lines) else "",
                            details={
                                "original_field": historical_field.name,
                                "new_field": current_field.name,
                                "field_number": num
                            }
                        ))

        return risks

    def _detect_missing_reserved_for_deleted(self, current_proto: ProtoFile, historical_proto: ProtoFile) -> List[RiskItem]:
        risks: List[RiskItem] = []

        current_messages = current_proto.get_all_messages()
        historical_messages = historical_proto.get_all_messages()

        for msg_name, historical_msg in historical_messages.items():
            if msg_name not in current_messages:
                continue

            current_msg = current_messages[msg_name]
            historical_field_numbers = {f.number: f for f in historical_msg.fields}
            current_field_numbers = {f.number for f in current_msg.fields}

            deleted_numbers = set(historical_field_numbers.keys()) - current_field_numbers

            for num in deleted_numbers:
                if not current_msg.is_number_reserved(num):
                    deleted_field = historical_field_numbers[num]
                    risks.append(RiskItem(
                        risk_type=RiskType.RESERVED_MISSING_FOR_DELETED,
                        level=RiskLevel.HIGH,
                        message=f"已删除字段 '{deleted_field.name}' (编号 {num}) 未添加 reserved 声明",
                        file_path=current_proto.path,
                        line=current_msg.line,
                        message_name=msg_name,
                        field_name=deleted_field.name,
                        field_number=num,
                        raw_line=current_proto.raw_lines[current_msg.line - 1] if current_msg.line <= len(current_proto.raw_lines) else "",
                        details={
                            "deleted_field": deleted_field.name,
                            "field_number": num,
                            "suggestion": f"建议添加: reserved {num};"
                        }
                    ))

        return risks
