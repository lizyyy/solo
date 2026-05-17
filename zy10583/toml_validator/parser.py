from typing import Any, Dict, Optional, Tuple
import tomlkit
from tomlkit.exceptions import TOMLKitError


class TomlParser:
    def __init__(self):
        self.document = None
        self._line_map: Dict[str, Tuple[int, int]] = {}

    def parse(self, content: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        try:
            self.document = tomlkit.parse(content)
            self._build_line_map()
            return dict(self.document), None
        except TOMLKitError as e:
            return None, str(e)

    def _build_line_map(self, prefix: str = "", node: Any = None):
        if node is None:
            node = self.document

        if isinstance(node, tomlkit.items.Table):
            for key, value in node.items():
                full_path = f"{prefix}.{key}" if prefix else key
                if hasattr(value, '_trivia'):
                    line = getattr(value._trivia, 'line', None)
                    if line is not None:
                        self._line_map[full_path] = (line + 1, 0)
                self._build_line_map(full_path, value)
        elif isinstance(node, tomlkit.items.Array):
            for idx, item in enumerate(node):
                full_path = f"{prefix}[{idx}]"
                if hasattr(item, '_trivia'):
                    line = getattr(item._trivia, 'line', None)
                    if line is not None:
                        self._line_map[full_path] = (line + 1, 0)
                self._build_line_map(full_path, item)

    def get_location(self, field_path: str) -> Tuple[Optional[int], Optional[int]]:
        return self._line_map.get(field_path, (None, None))

    @staticmethod
    def get_nested_value(data: Dict[str, Any], path: str) -> Optional[Any]:
        keys = path.split('.')
        current = data
        for key in keys:
            if '[' in key:
                base_key = key[:key.index('[')]
                idx = int(key[key.index('[') + 1:key.index(']')])
                if base_key not in current or not isinstance(current[base_key], list):
                    return None
                if idx >= len(current[base_key]):
                    return None
                current = current[base_key][idx]
            else:
                if key not in current:
                    return None
                current = current[key]
        return current
