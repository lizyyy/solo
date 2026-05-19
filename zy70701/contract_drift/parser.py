import json
import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple, Union
from pathlib import Path

import yaml

from .models import (
    FieldType,
    SourceLocation,
    Sample,
    SampleField,
    Contract,
    FieldDefinition,
)


def infer_field_type(value: Any) -> FieldType:
    if value is None:
        return FieldType.NULL
    elif isinstance(value, bool):
        return FieldType.BOOLEAN
    elif isinstance(value, int):
        return FieldType.INTEGER
    elif isinstance(value, float):
        return FieldType.NUMBER
    elif isinstance(value, str):
        return FieldType.STRING
    elif isinstance(value, list):
        return FieldType.ARRAY
    elif isinstance(value, dict):
        return FieldType.OBJECT
    else:
        return FieldType.STRING


class JsonLineMapper:
    def __init__(self, json_str: str):
        self.json_str = json_str
        self.lines = json_str.splitlines()
        self._build_position_map()

    def _build_position_map(self):
        self.char_to_line = {}
        char_idx = 0
        for line_num, line in enumerate(self.lines, 1):
            line_len = len(line) + 1
            for i in range(line_len):
                self.char_to_line[char_idx + i] = line_num
            char_idx += line_len

    def get_line_column(self, char_pos: int) -> Tuple[int, int]:
        line_num = self.char_to_line.get(char_pos, 1)
        line_start = 0
        for ln in range(1, line_num):
            line_start += len(self.lines[ln - 1]) + 1
        column = char_pos - line_start + 1
        return line_num, max(1, column)


class SampleParser:
    def __init__(self):
        pass

    def parse_file(self, file_path: str, contract_id: str) -> Sample:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Sample file not found: {file_path}")

        raw_content = path.read_text(encoding="utf-8")
        file_format = path.suffix.lower().lstrip(".")

        return self.parse_string(
            raw_content, file_format, file_path, contract_id, path.name
        )

    def parse_string(
        self,
        content: str,
        file_format: str,
        source_file: str,
        contract_id: str,
        name: Optional[str] = None,
    ) -> Sample:
        import_hash = self._compute_hash(content)

        if file_format in ["json", ""]:
            fields = self._parse_json_with_locations(content, source_file)
        elif file_format in ["yaml", "yml"]:
            fields = self._parse_yaml_with_locations(content, source_file)
        else:
            raise ValueError(f"Unsupported format: {file_format}")

        return Sample(
            id=import_hash[:16],
            name=name or Path(source_file).stem,
            contract_id=contract_id,
            fields=fields,
            raw_content=content,
            file_format=file_format,
            source_file=source_file,
            import_hash=import_hash,
        )

    def _compute_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _flatten_json(
        self,
        data: Any,
        path: str = "",
        locations: Optional[Dict[str, SourceLocation]] = None,
        mapper: Optional[JsonLineMapper] = None,
        json_str: Optional[str] = None,
    ) -> List[Tuple[str, Any, Optional[SourceLocation]]]:
        result = []

        if isinstance(data, dict):
            for key, value in sorted(data.items()):
                new_path = f"{path}.{key}" if path else key
                if locations and mapper:
                    pattern = rf'"\s*{re.escape(key)}\s*"\s*:'
                    matches = list(re.finditer(pattern, json_str))
                    if matches:
                        char_pos = matches[0].start()
                        line, col = mapper.get_line_column(char_pos)
                        locations[new_path] = SourceLocation(
                            file_path="",
                            line_start=line,
                            line_end=line,
                            column_start=col,
                            column_end=col + len(key) + 2,
                        )
                result.extend(
                    self._flatten_json(
                        value, new_path, locations, mapper, json_str
                    )
                )
        elif isinstance(data, list):
            for i, item in enumerate(sorted(data, key=lambda x: str(x))):
                new_path = f"{path}[{i}]"
                result.extend(
                    self._flatten_json(
                        item, new_path, locations, mapper, json_str
                    )
                )
        else:
            result.append((path, data, locations.get(path) if locations else None))

        return result

    def _parse_json_with_locations(
        self, content: str, source_file: str
    ) -> List[SampleField]:
        data = json.loads(content)
        mapper = JsonLineMapper(content)
        locations: Dict[str, SourceLocation] = {}
        flat_items = self._flatten_json(
            data, locations=locations, mapper=mapper, json_str=content
        )

        fields = []
        for path, value, _ in flat_items:
            line_num = self._find_field_line(content, path)
            field = SampleField(
                path=path,
                value=value,
                inferred_type=infer_field_type(value),
                source=SourceLocation(
                    file_path=source_file,
                    line_start=line_num,
                    line_end=line_num,
                ),
            )
            fields.append(field)

        return sorted(fields, key=lambda f: f.path)

    def _find_field_line(self, content: str, path: str) -> int:
        parts = path.split(".")
        current_pos = 0
        lines = content.splitlines()

        for i, line in enumerate(lines, 1):
            if any(part in line for part in parts[-1:]):
                return i
        return 1

    def _parse_yaml_with_locations(
        self, content: str, source_file: str
    ) -> List[SampleField]:
        class LocatingLoader(yaml.SafeLoader):
            pass

        def construct_mapping(loader, node):
            loader.flatten_mapping(node)
            value = loader.construct_mapping(node, deep=True)
            for key_node, value_node in node.value:
                key = loader.construct_object(key_node)
                if isinstance(value, dict):
                    value[f"__line_{key}__"] = key_node.start_mark.line + 1
            return value

        LocatingLoader.add_constructor(
            yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, construct_mapping
        )

        data = yaml.load(content, Loader=LocatingLoader)
        flat_items = self._flatten_yaml(data)

        fields = []
        for path, value, line_num in flat_items:
            field = SampleField(
                path=path,
                value=value,
                inferred_type=infer_field_type(value),
                source=SourceLocation(
                    file_path=source_file,
                    line_start=line_num or 1,
                    line_end=line_num or 1,
                ),
            )
            fields.append(field)

        return sorted(fields, key=lambda f: f.path)

    def _flatten_yaml(
        self,
        data: Any,
        path: str = "",
        line_num: Optional[int] = None,
    ) -> List[Tuple[str, Any, Optional[int]]]:
        result = []

        if isinstance(data, dict):
            for key, value in sorted(data.items()):
                if key.startswith("__line_"):
                    continue
                line_key = f"__line_{key}__"
                current_line = data.get(line_key, line_num)
                new_path = f"{path}.{key}" if path else key
                result.extend(self._flatten_yaml(value, new_path, current_line))
        elif isinstance(data, list):
            for i, item in enumerate(sorted(data, key=lambda x: str(x))):
                new_path = f"{path}[{i}]"
                result.extend(self._flatten_yaml(item, new_path, line_num))
        else:
            result.append((path, data, line_num))

        return result


class ContractParser:
    def parse_openapi_file(self, file_path: str) -> List[Contract]:
        path = Path(file_path)
        content = path.read_text(encoding="utf-8")

        if path.suffix.lower() in [".yaml", ".yml"]:
            spec = yaml.safe_load(content)
        else:
            spec = json.loads(content)

        contracts = []

        for api_path, methods in spec.get("paths", {}).items():
            for method, operation in methods.items():
                if method.lower() not in [
                    "get",
                    "post",
                    "put",
                    "delete",
                    "patch",
                ]:
                    continue

                contract_id = self._generate_contract_id(
                    api_path, method, spec.get("info", {}).get("version", "1.0.0")
                )
                fields = self._extract_response_fields(operation)

                contract = Contract(
                    id=contract_id,
                    name=operation.get("summary", api_path),
                    version=spec.get("info", {}).get("version", "1.0.0"),
                    api_path=api_path,
                    method=method.upper(),
                    fields=fields,
                    description=operation.get("description"),
                    source_file=file_path,
                )
                contracts.append(contract)

        return contracts

    def _generate_contract_id(self, path: str, method: str, version: str) -> str:
        key = f"{method.upper()}:{path}:{version}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def _extract_response_fields(self, operation: Dict) -> List[FieldDefinition]:
        fields = []
        responses = operation.get("responses", {})

        for status_code, response in sorted(responses.items()):
            if int(status_code) >= 400:
                continue

            content = response.get("content", {})
            for content_type, media_type in sorted(content.items()):
                schema = media_type.get("schema", {})
                fields.extend(self._traverse_schema(schema))

        return sorted(fields, key=lambda f: f.path)

    def _traverse_schema(
        self, schema: Dict, path: str = "", required: List[str] = None
    ) -> List[FieldDefinition]:
        fields = []
        required = required or []

        if not isinstance(schema, dict):
            return fields

        schema_type = schema.get("type", "object")

        if schema_type == "object" and "properties" in schema:
            for prop_name, prop_schema in sorted(schema["properties"].items()):
                if not isinstance(prop_schema, dict):
                    continue

                new_path = f"{path}.{prop_name}" if path else prop_name
                is_required = prop_name in required

                fields.append(
                    FieldDefinition(
                        path=new_path,
                        type=FieldType(prop_schema.get("type", "string")),
                        required=is_required,
                        description=prop_schema.get("description"),
                        format=prop_schema.get("format"),
                        enum_values=prop_schema.get("enum"),
                        nullable=prop_schema.get("nullable", False),
                    )
                )

                if prop_schema.get("type") == "object":
                    fields.extend(
                        self._traverse_schema(
                            prop_schema,
                            new_path,
                            prop_schema.get("required", []),
                        )
                    )
                elif prop_schema.get("type") == "array" and "items" in prop_schema:
                    items_schema = prop_schema["items"]
                    if isinstance(items_schema, dict):
                        array_path = f"{new_path}[*]"
                        fields.extend(
                            self._traverse_schema(
                                items_schema,
                                array_path,
                                items_schema.get("required", []),
                            )
                        )

        return fields
