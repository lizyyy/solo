import json
import re
from typing import Dict, Any, Tuple, Optional
from .models import BadRecord


class LogParser:
    JSON_PATTERN = re.compile(r'\{.*\}')
    KV_PATTERN = re.compile(r'(\w+)\s*=\s*("[^"]*"|\'[^\']*\'|\S+)')
    SERVICE_NAME_PATTERNS = [
        re.compile(r'service(?:_name)?\s*[:=]\s*["\']?([\w\-]+)["\']?', re.IGNORECASE),
        re.compile(r'^(\w+)\s*\|'),
        re.compile(r'\[(\w+)\]'),
    ]

    @classmethod
    def parse_line(cls, line: str, line_number: int) -> Tuple[Optional[Dict[str, Any]], Optional[BadRecord]]:
        line = line.strip()
        if not line:
            return None, BadRecord(
                line_number=line_number,
                raw_content=line,
                error_message="Empty line"
            )

        try:
            parsed = cls._try_json(line)
            if parsed:
                return parsed, None
        except Exception as e:
            pass

        try:
            parsed = cls._try_kv(line)
            if parsed:
                return parsed, None
        except Exception as e:
            pass

        return None, BadRecord(
            line_number=line_number,
            raw_content=line,
            error_message="Unrecognized log format (not JSON or key=value)"
        )

    @classmethod
    def _try_json(cls, line: str) -> Optional[Dict[str, Any]]:
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            match = cls.JSON_PATTERN.search(line)
            if match:
                try:
                    return json.loads(match.group(0))
                except json.JSONDecodeError:
                    pass
        return None

    @classmethod
    def _try_kv(cls, line: str) -> Dict[str, Any]:
        matches = cls.KV_PATTERN.findall(line)
        if not matches:
            return {}
        
        result = {}
        for key, value in matches:
            value = value.strip()
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            
            try:
                if '.' in value:
                    value = float(value)
                else:
                    value = int(value)
            except ValueError:
                pass
            
            result[key] = value
        
        return result if result else None

    @classmethod
    def extract_service_name(cls, parsed_fields: Dict[str, Any], raw_line: str) -> str:
        for key in ['service', 'service_name', 'app', 'app_name', 'module']:
            if key in parsed_fields:
                return str(parsed_fields[key])

        for pattern in cls.SERVICE_NAME_PATTERNS:
            match = pattern.search(raw_line)
            if match:
                return match.group(1)
        
        return "unknown"
