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


class YamlLoaderWithLineInfo:
    def __init__(self):
        self._sources = {}
        self._current_file = None

    def _flatten_dict(self, d, parent_key=""):
        items = {}
        for k, v in d.items():
            new_key = f"{parent_key}.{k}" if parent_key else k
            if isinstance(v, dict):
                items.update(self._flatten_dict(v, new_key))
            else:
                items[new_key] = v
        return items

    def load_with_source_tracking(self, file_path):
        self._current_file = file_path
        self._sources = {}
        errors = []
        values = {}
        is_valid = True

        try:
            with open(file_path, 'r') as f:
                content = f.read()

            values = yaml.safe_load(content) or {}

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
            flat_values = self._flatten_dict(values)
            for key in flat_values:
                flat_sources[key] = ValueSource(
                    file_path=file_path,
                    line_number=None,
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
