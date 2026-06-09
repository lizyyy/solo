import json
import os
from typing import Dict, Optional, Any
from datetime import datetime
import re


class FieldMapper:
    def __init__(self, mapping_path: str = None):
        if mapping_path is None:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            mapping_path = os.path.join(base, "config", "field_mapping.json")
        with open(mapping_path, "r", encoding="utf-8") as f:
            self.mapping = json.load(f)
        self._build_index()

    def _build_index(self):
        self.name_to_canonical = {}
        for category, rules in self.mapping.items():
            for rule in rules:
                canonical = rule["canonical_name"]
                for name in rule["source_names"]:
                    self.name_to_canonical[name.strip().lower()] = canonical

    def map_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        mapped = {}
        source_trace = {}
        for src_key, value in row.items():
            canonical = self.name_to_canonical.get(src_key.strip().lower())
            if canonical:
                mapped[canonical] = value
                source_trace[canonical] = {"original_field": src_key, "original_value": str(value)}
            else:
                mapped[f"__raw__{src_key}"] = value
        mapped["__source_trace__"] = source_trace
        return mapped

    def detect_canonical(self, header: str) -> Optional[str]:
        return self.name_to_canonical.get(header.strip().lower())

    def get_source_trace_field(self, mapped_row: Dict, canonical: str) -> Dict:
        trace = mapped_row.get("__source_trace__", {})
        return trace.get(canonical, {"original_field": "未知字段", "original_value": ""})
