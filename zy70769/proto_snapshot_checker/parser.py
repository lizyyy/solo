import re
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from pathlib import Path


@dataclass
class FieldLocation:
    file_path: str
    line_start: int
    line_end: int
    column_start: int = 0
    column_end: int = 0

    def to_dict(self) -> Dict:
        return {
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "column_start": self.column_start,
            "column_end": self.column_end,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "FieldLocation":
        return cls(**data)


@dataclass
class ProtoField:
    name: str
    number: int
    type: str
    label: str
    location: FieldLocation

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "number": self.number,
            "type": self.type,
            "label": self.label,
            "location": self.location.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ProtoField":
        return cls(
            name=data["name"],
            number=data["number"],
            type=data["type"],
            label=data["label"],
            location=FieldLocation.from_dict(data["location"]),
        )


@dataclass
class ProtoMessage:
    name: str
    full_name: str
    fields: Dict[int, ProtoField] = field(default_factory=dict)
    nested_messages: Dict[str, "ProtoMessage"] = field(default_factory=dict)
    location: Optional[FieldLocation] = None

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "full_name": self.full_name,
            "fields": {str(k): v.to_dict() for k, v in sorted(self.fields.items())},
            "nested_messages": {k: v.to_dict() for k, v in sorted(self.nested_messages.items())},
            "location": self.location.to_dict() if self.location else None,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ProtoMessage":
        msg = cls(
            name=data["name"],
            full_name=data["full_name"],
            location=FieldLocation.from_dict(data["location"]) if data["location"] else None,
        )
        msg.fields = {int(k): ProtoField.from_dict(v) for k, v in data["fields"].items()}
        msg.nested_messages = {k: ProtoMessage.from_dict(v) for k, v in data["nested_messages"].items()}
        return msg


@dataclass
class ProtoFile:
    file_path: str
    package: str
    messages: Dict[str, ProtoMessage] = field(default_factory=dict)
    imports: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "file_path": self.file_path,
            "package": self.package,
            "messages": {k: v.to_dict() for k, v in sorted(self.messages.items())},
            "imports": sorted(self.imports),
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ProtoFile":
        pf = cls(
            file_path=data["file_path"],
            package=data["package"],
            imports=data["imports"],
        )
        pf.messages = {k: ProtoMessage.from_dict(v) for k, v in data["messages"].items()}
        return pf


class ProtoParser:
    FIELD_PATTERN = re.compile(
        r"^\s*(optional|repeated|required)?\s*([a-zA-Z0-9_.]+)\s+([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*[;{]"
    )
    MESSAGE_PATTERN = re.compile(r"^\s*message\s+([a-zA-Z0-9_]+)\s*\{")
    PACKAGE_PATTERN = re.compile(r"^\s*package\s+([a-zA-Z0-9_.]+)\s*;")
    IMPORT_PATTERN = re.compile(r'^\s*import\s+["\']([^"\']+)["\']\s*;')
    ENUM_PATTERN = re.compile(r"^\s*enum\s+([a-zA-Z0-9_]+)\s*\{")

    def __init__(self):
        self.proto_files: Dict[str, ProtoFile] = {}

    def parse_file(self, file_path: str) -> ProtoFile:
        file_path = os.path.abspath(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        package = ""
        imports: List[str] = []
        messages: Dict[str, ProtoMessage] = {}

        for i, line in enumerate(lines, 1):
            pkg_match = self.PACKAGE_PATTERN.match(line)
            if pkg_match:
                package = pkg_match.group(1)
                continue

            import_match = self.IMPORT_PATTERN.match(line)
            if import_match:
                imports.append(import_match.group(1))
                continue

        message_stack: List[Tuple[str, int, ProtoMessage]] = []
        brace_count = 0
        in_enum = False

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            if stripped.startswith("enum "):
                in_enum = True

            if in_enum:
                if "}" in line:
                    brace_count -= 1
                    if brace_count == 0:
                        in_enum = False
                if "{" in line:
                    brace_count += 1
                continue

            msg_match = self.MESSAGE_PATTERN.match(line)
            if msg_match:
                msg_name = msg_match.group(1)
                if message_stack:
                    parent_full = message_stack[-1][0]
                    full_name = f"{parent_full}.{msg_name}"
                else:
                    full_name = msg_name
                if package:
                    full_name = f"{package}.{full_name}"

                location = FieldLocation(
                    file_path=file_path,
                    line_start=i,
                    line_end=0,
                )
                msg = ProtoMessage(
                    name=msg_name,
                    full_name=full_name,
                    location=location,
                )

                if len(message_stack) == 0:
                    messages[msg_name] = msg
                else:
                    parent_msg = message_stack[-1][2]
                    parent_msg.nested_messages[msg_name] = msg

                message_stack.append((full_name, i, msg))
                brace_count = 0
                continue

            if message_stack:
                if "{" in line:
                    brace_count += 1
                if "}" in line:
                    brace_count -= 1
                    if brace_count < 0:
                        full_name, start_line, msg = message_stack.pop()
                        msg.location.line_end = i
                        continue

                field_match = self.FIELD_PATTERN.match(line)
                if field_match and message_stack:
                    label = field_match.group(1) or ""
                    field_type = field_match.group(2)
                    field_name = field_match.group(3)
                    field_number = int(field_match.group(4))

                    location = FieldLocation(
                        file_path=file_path,
                        line_start=i,
                        line_end=i,
                        column_start=line.find(field_name),
                        column_end=line.find("="),
                    )

                    field = ProtoField(
                        name=field_name,
                        number=field_number,
                        type=field_type,
                        label=label,
                        location=location,
                    )

                    current_msg = message_stack[-1][2]
                    current_msg.fields[field_number] = field

        proto_file = ProtoFile(
            file_path=file_path,
            package=package,
            messages=messages,
            imports=imports,
        )

        self.proto_files[file_path] = proto_file
        return proto_file

    def _find_message_by_full_name(
        self, messages: Dict[str, ProtoMessage], full_name: str
    ) -> Optional[ProtoMessage]:
        pkg_parts = full_name.split(".")
        msg_parts = []
        for i, part in enumerate(pkg_parts):
            if part[0].isupper():
                msg_parts = pkg_parts[i:]
                break

        if not msg_parts:
            return None

        current = messages.get(msg_parts[0])
        if not current:
            return None

        for part in msg_parts[1:]:
            current = current.nested_messages.get(part)
            if not current:
                return None

        return current

    def parse_directory(self, dir_path: str, pattern: str = "**/*.proto") -> List[ProtoFile]:
        path = Path(dir_path)
        proto_files = list(path.glob(pattern))
        results = []
        for pf in sorted(proto_files):
            results.append(self.parse_file(str(pf)))
        return results
