import yaml
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class YamlError:
    file_path: str
    line_number: Optional[int]
    column: Optional[int]
    message: str
    raw_content: Optional[str] = None


@dataclass
class ValueSource:
    file_path: str
    line_number: Optional[int]
    value: Any
    is_overridden: bool = False


@dataclass
class LoadedValues:
    file_path: str
    values: Dict[str, Any]
    sources: Dict[str, ValueSource]
    errors: List[YamlError] = field(default_factory=list)
    is_valid: bool = True


class LineTrackingLoader(yaml.SafeLoader):
    def __init__(self, stream):
        super().__init__(stream)
        self.line_mapping = {}

    def construct_mapping(self, node, deep=False):
        mapping = super().construct_mapping(node, deep=deep)
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if hasattr(key_node, 'start_mark'):
                self.line_mapping[key] = key_node.start_mark.line + 1
        return mapping


class YamlLoaderWithLineInfo:
    def __init__(self):
        self._sources = {}
        self._current_file = None
        self._line_mapping = {}

    def _flatten_dict_with_lines(self, d, parent_key="", lines=None):
        items = {}
        if lines is None:
            lines = {}
        for k, v in d.items():
            new_key = f"{parent_key}.{k}" if parent_key else k
            if isinstance(v, dict):
                items.update(self._flatten_dict_with_lines(v, new_key, lines))
            else:
                items[new_key] = v
        return items

    def _get_line_numbers(self, node, prefix="", result=None):
        if result is None:
            result = {}
        if isinstance(node, yaml.MappingNode):
            for key_node, value_node in node.value:
                key = key_node.value
                current_path = f"{prefix}.{key}" if prefix else key
                if hasattr(key_node, 'start_mark'):
                    result[current_path] = key_node.start_mark.line + 1
                if isinstance(value_node, yaml.MappingNode):
                    self._get_line_numbers(value_node, current_path, result)
        return result

    def load_with_source_tracking(self, file_path):
        self._current_file = file_path
        self._sources = {}
        self._line_mapping = {}
        errors = []
        values = {}
        is_valid = True
        content = ""

        try:
            with open(file_path, 'r') as f:
                content = f.read()

            with open(file_path, 'r') as f:
                loader = LineTrackingLoader(f)
                values = loader.get_single_node()
                if values is not None:
                    self._line_mapping = self._get_line_numbers(values)
                    values = yaml.SafeLoader.construct_mapping(loader, values, deep=True)
                else:
                    values = {}

        except yaml.YAMLError as e:
            is_valid = False
            line = getattr(e, 'problem_mark', None)
            line_num = line.line + 1 if line else None
            col = line.column + 1 if line else None
            errors.append(YamlError(
                file_path=file_path,
                line_number=line_num,
                column=col,
                message=str(e),
                raw_content=content[:1000] if content else None
            ))
        except Exception as e:
            is_valid = False
            errors.append(YamlError(
                file_path=file_path,
                line_number=None,
                column=None,
                message=str(e)
            ))

        flat_sources = {}
        if values:
            flat_values = self._flatten_dict_with_lines(values)
            for key in flat_values:
                line_num = self._line_mapping.get(key)
                if line_num is None:
                    parts = key.split('.')
                    for i in range(len(parts), 0, -1):
                        parent = '.'.join(parts[:i])
                        if parent in self._line_mapping:
                            line_num = self._line_mapping[parent]
                            break
                flat_sources[key] = ValueSource(
                    file_path=file_path,
                    line_number=line_num,
                    value=flat_values[key]
                )

        return LoadedValues(
            file_path=file_path,
            values=values,
            sources=flat_sources,
            errors=errors,
            is_valid=is_valid
        )


def deep_merge(base, override):
    result = base.copy()
    for key, value in override.items():
        if isinstance(value, dict) and key in result and isinstance(result[key], dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
