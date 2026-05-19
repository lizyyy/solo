import hashlib
import json
import re
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass


@dataclass
class NormalizedParameter:
    key: str
    value_type: str
    normalized_value: str
    original_value: Any


class ParameterNormalizer:
    TYPE_PATTERNS = {
        'INTEGER': re.compile(r'^\d+$'),
        'FLOAT': re.compile(r'^\d+\.\d+$'),
        'DATE': re.compile(r'^\d{4}-\d{2}-\d{2}$'),
        'DATETIME': re.compile(r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}'),
        'BOOLEAN': re.compile(r'^(true|false|yes|no|1|0)$', re.IGNORECASE),
        'NULL': re.compile(r'^(null|none|)$', re.IGNORECASE),
    }

    def normalize_parameter_set(self, params: Dict[str, Any]) -> Tuple[str, List[NormalizedParameter]]:
        sorted_items = sorted(params.items(), key=lambda x: x[0])
        normalized_list = []

        for key, value in sorted_items:
            normalized = self._normalize_single(key, value)
            normalized_list.append(normalized)

        signature = self._generate_signature(normalized_list)
        return signature, normalized_list

    def _normalize_single(self, key: str, value: Any) -> NormalizedParameter:
        value_str = str(value).strip() if value is not None else ""

        value_type = self._detect_type(value_str)

        if value_type in ['INTEGER', 'FLOAT']:
            normalized_value = self._normalize_numeric(value_str)
        elif value_type in ['DATE', 'DATETIME']:
            normalized_value = self._normalize_datetime(value_str)
        elif value_type == 'BOOLEAN':
            normalized_value = self._normalize_boolean(value_str)
        elif value_type == 'NULL':
            normalized_value = 'NULL'
        else:
            normalized_value = self._normalize_string(value_str)

        return NormalizedParameter(
            key=key,
            value_type=value_type,
            normalized_value=normalized_value,
            original_value=value
        )

    def _detect_type(self, value_str: str) -> str:
        if not value_str or value_str.lower() in ['null', 'none', 'nil']:
            return 'NULL'

        for type_name, pattern in self.TYPE_PATTERNS.items():
            if pattern.match(value_str):
                return type_name

        return 'STRING'

    def _normalize_numeric(self, value_str: str) -> str:
        try:
            if '.' in value_str:
                return str(float(value_str))
            else:
                return str(int(value_str))
        except ValueError:
            return value_str

    def _normalize_datetime(self, value_str: str) -> str:
        normalized = value_str.replace('T', ' ').replace('Z', '').strip()
        return normalized

    def _normalize_boolean(self, value_str: str) -> str:
        lower_val = value_str.lower()
        if lower_val in ['true', 'yes', '1']:
            return 'true'
        else:
            return 'false'

    def _normalize_string(self, value_str: str) -> str:
        normalized = re.sub(r'\s+', ' ', value_str).strip()
        normalized = normalized.lower()
        return normalized

    def _generate_signature(self, normalized_params: List[NormalizedParameter]) -> str:
        signature_data = []
        for p in normalized_params:
            signature_data.append({
                'key': p.key,
                'type': p.value_type,
                'value': p.normalized_value
            })

        json_str = json.dumps(signature_data, sort_keys=True, ensure_ascii=False)
        hash_obj = hashlib.md5(json_str.encode('utf-8'))
        return hash_obj.hexdigest()

    def normalize_query_template(self, query: str) -> str:
        normalized = query.strip()

        normalized = re.sub(r'/\*.*?\*/', '', normalized, flags=re.DOTALL)
        normalized = re.sub(r'--.*$', '', normalized, flags=re.MULTILINE)

        normalized = re.sub(r'\s+', ' ', normalized)

        normalized = re.sub(r'\b\d+\b', '?', normalized)

        normalized = re.sub(r"'[^']*'", '?', normalized)
        normalized = re.sub(r'"[^"]*"', '?', normalized)

        normalized = normalized.strip()

        return normalized

    def generate_query_signature(self, query_template: str, param_signature: str) -> str:
        normalized_query = self.normalize_query_template(query_template)
        combined = f"{normalized_query}|{param_signature}"
        return hashlib.md5(combined.encode('utf-8')).hexdigest()
