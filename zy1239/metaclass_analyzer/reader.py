"""File readers for metaclass analyzer."""

import ast
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

import yaml

from .errors import (
    JsonlFormatError,
    PythonSyntaxError,
    YamlFormatError,
    MissingFieldError,
)
from .models import Event, EventType, FieldInfo, ClassInfo


class YamlReader:
    """Reader for class-cases.yaml files."""

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"YAML file not found: {file_path}")

    def read(self) -> Dict[str, Any]:
        """Read and parse the YAML file."""
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = yaml.safe_load(f)
        except yaml.YAMLError as e:
            line_number = getattr(e, "mark", None)
            line = line_number.line if line_number else None
            raise YamlFormatError(
                file_path=str(self.file_path),
                message="Failed to parse YAML",
                line_number=line,
                original_error=e,
            )

        if content is None:
            raise YamlFormatError(
                file_path=str(self.file_path),
                message="YAML file is empty",
            )

        return content

    def parse_classes(self, data: Dict[str, Any]) -> List[ClassInfo]:
        """Parse class definitions from YAML data."""
        classes = []
        raw_classes = data.get("classes", [])

        for idx, raw_class in enumerate(raw_classes):
            try:
                class_info = self._parse_single_class(raw_class, idx + 1)
                classes.append(class_info)
            except MissingFieldError as e:
                raise YamlFormatError(
                    file_path=str(self.file_path),
                    line_number=idx + 1,
                    message=str(e),
                )

        return classes

    def _parse_single_class(self, raw_class: Dict[str, Any], line_num: int) -> ClassInfo:
        """Parse a single class definition."""
        name = raw_class.get("name")
        if not name:
            raise MissingFieldError(
                field_name="name",
                context=f"class definition at line {line_num}",
            )

        bases = raw_class.get("bases", [])
        metaclass = raw_class.get("metaclass", "type")
        mro = raw_class.get("mro", [name, "object"])
        source_file = raw_class.get("source")

        fields = []
        raw_fields = raw_class.get("fields", [])
        for field_idx, raw_field in enumerate(raw_fields):
            field_name = raw_field.get("name")
            if field_name:
                fields.append(
                    FieldInfo(
                        name=field_name,
                        value=raw_field.get("value"),
                        defined_in_class=name,
                        order=raw_field.get("order", field_idx + 1),
                        descriptor_type=raw_field.get("descriptor_type"),
                        set_name_called=False,
                    )
                )

        has_conflict = raw_class.get("has_conflict", False)
        conflict_details = raw_class.get("conflict_details")

        return ClassInfo(
            name=name,
            bases=bases,
            metaclass=str(metaclass) if metaclass else "type",
            mro=mro,
            fields=fields,
            has_conflict=has_conflict,
            conflict_details=conflict_details,
            source_file=source_file,
            defined_at=datetime.now(),
        )


class JsonlReader:
    """Reader for events.jsonl files."""

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"JSONL file not found: {file_path}")

    def read_lines(self) -> Iterator[Dict[str, Any]]:
        """Read and parse each line of the JSONL file."""
        with open(self.file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as e:
                    raise JsonlFormatError(
                        file_path=str(self.file_path),
                        message=f"Invalid JSON on line {line_num}",
                        line_number=line_num,
                        original_error=e,
                    )

    def parse_events(self) -> List[Event]:
        """Parse events from JSONL file."""
        events = []

        for raw_event in self.read_lines():
            event = self._parse_event(raw_event)
            events.append(event)

        return events

    def _parse_event(self, raw_event: Dict[str, Any]) -> Event:
        """Parse a single event."""
        event_type_str = raw_event.get("event_type")
        if not event_type_str:
            raise MissingFieldError(
                field_name="event_type",
                context="event in JSONL file",
            )

        try:
            event_type = EventType(event_type_str)
        except ValueError:
            raise JsonlFormatError(
                file_path=str(self.file_path),
                message=f"Unknown event type: {event_type_str}",
            )

        timestamp_str = raw_event.get("timestamp")
        if timestamp_str:
            try:
                timestamp = datetime.fromisoformat(timestamp_str)
            except ValueError:
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()

        class_name = raw_event.get("class_name", "")
        metaclass_name = raw_event.get("metaclass_name")
        details = raw_event.get("details", {})
        order = raw_event.get("order", 0)
        success = raw_event.get("success", True)
        error_message = raw_event.get("error_message")

        return Event(
            event_type=event_type,
            timestamp=timestamp,
            class_name=class_name,
            metaclass_name=metaclass_name,
            details=details,
            order=order,
            success=success,
            error_message=error_message,
        )


class PythonReader:
    """Reader for Python snippet files."""

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"Python file not found: {file_path}")

    def read_source(self) -> str:
        """Read the Python source code."""
        with open(self.file_path, "r", encoding="utf-8") as f:
            return f.read()

    def parse_ast(self) -> ast.Module:
        """Parse the Python file into AST."""
        source = self.read_source()
        try:
            return ast.parse(source, filename=str(self.file_path))
        except SyntaxError as e:
            raise PythonSyntaxError(
                file_path=str(self.file_path),
                message="Syntax error in Python file",
                line_number=e.lineno,
                column=e.offset,
                original_error=e,
            )

    def extract_classes(self) -> List[Dict[str, Any]]:
        """Extract class definitions from the Python file."""
        tree = self.parse_ast()
        classes = []

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_info = self._extract_class_info(node)
                classes.append(class_info)

        return classes

    def _extract_class_info(self, node: ast.ClassDef) -> Dict[str, Any]:
        """Extract information from a ClassDef AST node."""
        name = node.name
        bases = []
        metaclass = None

        for base in node.bases:
            if isinstance(base, ast.Name):
                bases.append(base.id)
            elif isinstance(base, ast.Attribute):
                bases.append(ast.unparse(base))

        for keyword in node.keywords:
            if keyword.arg == "metaclass":
                if isinstance(keyword.value, ast.Name):
                    metaclass = keyword.value.id
                elif isinstance(keyword.value, ast.Attribute):
                    metaclass = ast.unparse(keyword.value)

        fields = []
        methods = []

        for body_node in node.body:
            if isinstance(body_node, ast.AnnAssign) and isinstance(body_node.target, ast.Name):
                fields.append({
                    "name": body_node.target.id,
                    "type": ast.unparse(body_node.annotation) if body_node.annotation else None,
                    "value": ast.unparse(body_node.value) if body_node.value else None,
                })
            elif isinstance(body_node, ast.Assign):
                for target in body_node.targets:
                    if isinstance(target, ast.Name):
                        fields.append({
                            "name": target.id,
                            "value": ast.unparse(body_node.value) if body_node.value else None,
                        })
            elif isinstance(body_node, ast.FunctionDef):
                methods.append(body_node.name)

        uses_metaclass = metaclass is not None
        uses_init_subclass = any(m == "__init_subclass__" for m in methods)
        has_descriptors = False

        for field in fields:
            field_value = field.get("value", "")
            if "Descriptor" in field_value or "descriptor" in field_value.lower():
                has_descriptors = True
                field["is_descriptor"] = True

        return {
            "name": name,
            "bases": bases,
            "metaclass": metaclass or "type",
            "fields": fields,
            "methods": methods,
            "uses_metaclass": uses_metaclass,
            "uses_init_subclass": uses_init_subclass,
            "has_descriptors": has_descriptors,
            "lineno": node.lineno,
            "source_file": str(self.file_path),
        }


class SnippetsReader:
    """Reader for all Python snippets in a directory."""

    def __init__(self, snippets_dir: str):
        self.snippets_dir = Path(snippets_dir)
        if not self.snippets_dir.exists():
            raise FileNotFoundError(f"Snippets directory not found: {snippets_dir}")
        if not self.snippets_dir.is_dir():
            raise NotADirectoryError(f"Not a directory: {snippets_dir}")

    def get_python_files(self) -> List[Path]:
        """Get all Python files in the snippets directory."""
        return sorted(self.snippets_dir.glob("*.py"))

    def read_all_snippets(self) -> List[Dict[str, Any]]:
        """Read and parse all Python snippets."""
        all_classes = []

        for py_file in self.get_python_files():
            try:
                reader = PythonReader(str(py_file))
                classes = reader.extract_classes()
                all_classes.extend(classes)
            except (PythonSyntaxError, FileNotFoundError) as e:
                raise e

        return all_classes
