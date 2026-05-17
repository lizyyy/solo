import re
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Union, Tuple


@dataclass
class FieldInfo:
    name: str
    number: int
    type: str
    label: str
    line: int
    column: int = 0


@dataclass
class ReservedRange:
    start: int
    end: Optional[int] = None

    def contains(self, num: int) -> bool:
        if self.end is None:
            return num == self.start
        return self.start <= num <= self.end

    def to_tuple(self) -> Tuple[int, Optional[int]]:
        return (self.start, self.end)


@dataclass
class MessageInfo:
    name: str
    fields: List[FieldInfo] = field(default_factory=list)
    reserved_numbers: List[ReservedRange] = field(default_factory=list)
    reserved_names: List[str] = field(default_factory=list)
    nested_messages: Dict[str, 'MessageInfo'] = field(default_factory=dict)
    line: int = 0
    parent: Optional['MessageInfo'] = None

    def get_full_name(self) -> str:
        if self.parent:
            return f"{self.parent.get_full_name()}.{self.name}"
        return self.name

    def get_all_field_numbers(self) -> Set[int]:
        nums = set(f.number for f in self.fields)
        for msg in self.nested_messages.values():
            nums.update(msg.get_all_field_numbers())
        return nums

    def is_number_reserved(self, num: int) -> bool:
        for r in self.reserved_numbers:
            if r.contains(num):
                return True
        if self.parent:
            return self.parent.is_number_reserved(num)
        return False


@dataclass
class ProtoFile:
    path: str
    package: str = ""
    messages: Dict[str, MessageInfo] = field(default_factory=dict)
    syntax: str = ""
    imports: List[str] = field(default_factory=list)
    raw_lines: List[str] = field(default_factory=list)

    def get_all_messages(self) -> Dict[str, MessageInfo]:
        result = dict(self.messages)
        for msg in self.messages.values():
            result.update(self._get_nested_messages(msg))
        return result

    def _get_nested_messages(self, msg: MessageInfo) -> Dict[str, MessageInfo]:
        result = {}
        for nested in msg.nested_messages.values():
            result[nested.get_full_name()] = nested
            result.update(self._get_nested_messages(nested))
        return result


class ProtoParser:
    def __init__(self):
        self._syntax_pattern = re.compile(r'^\s*syntax\s*=\s*"([^"]+)"\s*;')
        self._package_pattern = re.compile(r'^\s*package\s+([a-zA-Z0-9_.]+)\s*;')
        self._import_pattern = re.compile(r'^\s*import\s+(?:public\s+)?(?:"([^"]+)"|' + r"'([^']+)')\s*;")
        self._message_pattern = re.compile(r'^\s*(message|enum)\s+([a-zA-Z0-9_]+)\s*\{')
        self._field_pattern = re.compile(
            r'^\s*(optional|required|repeated)?\s*([a-zA-Z0-9_.]+)\s+([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*'
        )
        self._reserved_pattern = re.compile(r'^\s*reserved\s+(.+?)\s*;')
        self._enum_field_pattern = re.compile(r'^\s*([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*;')

    def parse(self, filepath: str) -> ProtoFile:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Proto file not found: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        proto = ProtoFile(path=os.path.abspath(filepath))
        proto.raw_lines = lines

        message_stack: List[MessageInfo] = []
        current_message: Optional[MessageInfo] = None
        brace_level = 0
        in_enum = False

        for line_idx, line in enumerate(lines, 1):
            stripped = line.strip()

            if not stripped or stripped.startswith('//'):
                continue

            if self._syntax_pattern.match(stripped):
                match = self._syntax_pattern.match(stripped)
                proto.syntax = match.group(1)
                continue

            if self._package_pattern.match(stripped):
                match = self._package_pattern.match(stripped)
                proto.package = match.group(1)
                continue

            if self._import_pattern.match(stripped):
                match = self._import_pattern.match(stripped)
                imp = match.group(1) or match.group(2)
                proto.imports.append(imp)
                continue

            msg_match = self._message_pattern.match(stripped)
            if msg_match:
                msg_type = msg_match.group(1)
                msg_name = msg_match.group(2)
                new_msg = MessageInfo(name=msg_name, line=line_idx, parent=current_message)
                in_enum = (msg_type == 'enum')

                if current_message:
                    current_message.nested_messages[msg_name] = new_msg
                else:
                    proto.messages[msg_name] = new_msg

                message_stack.append(current_message)
                current_message = new_msg
                brace_level = 0
                continue

            brace_level += line.count('{')
            brace_level -= line.count('}')

            if '}' in stripped and brace_level <= 0:
                if message_stack:
                    current_message = message_stack.pop()
                    in_enum = False
                continue

            if current_message and not in_enum:
                self._parse_message_content(line, line_idx, current_message)

            if current_message and in_enum:
                self._parse_enum_field(line, line_idx, current_message)

        return proto

    def _parse_message_content(self, line: str, line_idx: int, msg: MessageInfo):
        stripped = line.strip()

        if stripped.startswith('reserved'):
            self._parse_reserved(line, line_idx, msg)
            return

        field_match = self._field_pattern.match(stripped)
        if field_match:
            label = field_match.group(1) or ""
            field_type = field_match.group(2)
            field_name = field_match.group(3)
            field_number = int(field_match.group(4))

            field = FieldInfo(
                name=field_name,
                number=field_number,
                type=field_type,
                label=label,
                line=line_idx
            )
            msg.fields.append(field)

    def _parse_enum_field(self, line: str, line_idx: int, msg: MessageInfo):
        enum_match = self._enum_field_pattern.match(line.strip())
        if enum_match:
            field_name = enum_match.group(1)
            field_number = int(enum_match.group(2))
            field = FieldInfo(
                name=field_name,
                number=field_number,
                type="enum_value",
                label="",
                line=line_idx
            )
            msg.fields.append(field)

    def _parse_reserved(self, line: str, line_idx: int, msg: MessageInfo):
        match = self._reserved_pattern.search(line)
        if not match:
            return

        content = match.group(1).strip()
        parts = [p.strip() for p in content.split(',')]

        for part in parts:
            part = part.strip()
            if part.startswith('"') or part.startswith("'"):
                name = part.strip('"\'')
                msg.reserved_names.append(name)
            else:
                self._parse_reserved_number(part, msg)

    def _parse_reserved_number(self, part: str, msg: MessageInfo):
        if 'to' in part:
            start_str, end_str = part.split('to', 1)
            start = int(start_str.strip())
            end_str = end_str.strip()
            if end_str.lower() == 'max':
                end = 536870911
            else:
                end = int(end_str)
            msg.reserved_numbers.append(ReservedRange(start, end))
        elif '-' in part:
            start_str, end_str = part.split('-', 1)
            start = int(start_str.strip())
            end = int(end_str.strip())
            msg.reserved_numbers.append(ReservedRange(start, end))
        else:
            num = int(part)
            msg.reserved_numbers.append(ReservedRange(num))
