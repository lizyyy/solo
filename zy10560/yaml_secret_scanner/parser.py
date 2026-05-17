from pathlib import Path
from typing import Any, Dict, Generator, List, Tuple, Optional

import yaml

from .models import ParseError


class LocationMarkedLoader(yaml.SafeLoader):
    def construct_mapping(self, node, deep=False):
        mapping = super().construct_mapping(node, deep=deep)
        if hasattr(node, 'start_mark'):
            mapping['__line__'] = node.start_mark.line + 1
            mapping['__column__'] = node.start_mark.column + 1
        return mapping


class YAMLParser:
    def __init__(self):
        pass

    def parse(self, file_path: Path) -> Tuple[Dict[str, Any], List[ParseError]]:
        errors: List[ParseError] = []
        data = {}

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                lines = content.splitlines()
        except Exception as e:
            errors.append(ParseError(
                file_path=file_path,
                line=0,
                column=0,
                message=f"无法读取文件: {str(e)}",
                raw_line=None
            ))
            return {}, errors

        try:
            raw_data = yaml.load(content, Loader=LocationMarkedLoader)
            if raw_data:
                data = self._extract_locations(raw_data, "")
        except yaml.YAMLError as e:
            line = 0
            column = 0
            if hasattr(e, 'problem_mark'):
                line = e.problem_mark.line + 1
                column = e.problem_mark.column + 1
            raw_line = lines[line - 1] if 0 < line <= len(lines) else None
            errors.append(ParseError(
                file_path=file_path,
                line=line,
                column=column,
                message=f"YAML解析错误: {str(e)}",
                raw_line=raw_line
            ))

        return data, errors

    def _extract_locations(self, node: Any, path: str) -> Dict[str, Any]:
        result = {}
        if isinstance(node, dict):
            line = node.pop('__line__', 0)
            column = node.pop('__column__', 0)
            for key, value in node.items():
                current_path = f"{path}.{key}" if path else key
                if isinstance(value, dict):
                    nested = self._extract_locations(value, current_path)
                    result.update(nested)
                elif isinstance(value, list):
                    for idx, item in enumerate(value):
                        item_path = f"{current_path}[{idx}]"
                        if isinstance(item, dict):
                            nested = self._extract_locations(item, item_path)
                            result.update(nested)
                        else:
                            result[item_path] = (item, line, column)
                else:
                    result[current_path] = (value, line, column)
        return result

    def iter_fields(self, data: Dict[str, Any]) -> Generator[Tuple[str, Any, int, int], None, None]:
        for field_path, (value, line, column) in data.items():
            yield field_path, value, line, column
