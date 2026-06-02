import csv
import json
import os
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class ValidationResult:
    null_ids: List[str] = field(default_factory=list)
    duplicate_ids: List[str] = field(default_factory=list)
    boundary_records: List[Dict[str, Any]] = field(default_factory=list)
    missing_fields: Dict[str, List[str]] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    def summary(self) -> str:
        lines = ["[数据校验结果]"]
        lines.append(f"  空值ID数: {len(self.null_ids)}")
        if self.null_ids:
            lines.append(f"    空值ID: {self.null_ids}")
        lines.append(f"  重复ID数: {len(self.duplicate_ids)}")
        if self.duplicate_ids:
            lines.append(f"    重复ID: {self.duplicate_ids}")
        lines.append(f"  边界记录数: {len(self.boundary_records)}")
        for rec in self.boundary_records:
            lines.append(f"    ID={rec.get('id', '?')}, 字段={rec.get('field', '?')}, 值={rec.get('value', '?')}, 原因={rec.get('reason', '?')}")
        lines.append(f"  缺失字段: {dict(self.missing_fields) if self.missing_fields else '无'}")
        if self.warnings:
            lines.append(f"  警告:")
            for w in self.warnings:
                lines.append(f"    - {w}")
        return "\n".join(lines)


@dataclass
class LoadedData:
    source_name: str
    records: List[Dict[str, Any]]
    id_field: str = "id"
    validation: ValidationResult = field(default_factory=ValidationResult)

    def get_ids(self) -> set:
        return {r[self.id_field] for r in self.records if self.id_field in r and r[self.id_field] is not None}

    def get_by_id(self, record_id: str) -> List[Dict[str, Any]]:
        return [r for r in self.records if r.get(self.id_field) == record_id]


BOUNDARY_RULES = {
    "score": {"min": 0.0, "max": 1.0, "inclusive": True},
    "model_score": {"min": 0.0, "max": 1.0, "inclusive": True},
    "manual_score": {"min": 0.0, "max": 1.0, "inclusive": True},
    "match_rate": {"min": 0.0, "max": 1.0, "inclusive": True},
    "age": {"min": 16, "max": 65, "inclusive": True},
    "experience_years": {"min": 0, "max": 45, "inclusive": True},
}


class DataLoader:
    def __init__(self, id_field: str = "id"):
        self.id_field = id_field
        self.loaded: Dict[str, LoadedData] = {}

    def load_csv(self, filepath: str, source_name: Optional[str] = None) -> LoadedData:
        if source_name is None:
            source_name = os.path.splitext(os.path.basename(filepath))[0]
        records = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cleaned = {}
                for k, v in row.items():
                    if k is None:
                        continue
                    v_stripped = v.strip() if v else v
                    if v_stripped == "" or v_stripped is None:
                        cleaned[k] = None
                    else:
                        cleaned[k] = self._try_cast(v_stripped)
                records.append(cleaned)
        loaded = LoadedData(source_name=source_name, records=records, id_field=self.id_field)
        loaded.validation = self._validate(loaded)
        self.loaded[source_name] = loaded
        return loaded

    def load_json(self, filepath: str, source_name: Optional[str] = None) -> LoadedData:
        if source_name is None:
            source_name = os.path.splitext(os.path.basename(filepath))[0]
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            records = [data]
        elif isinstance(data, list):
            records = data
        else:
            raise ValueError(f"JSON 文件 {filepath} 根元素必须是 dict 或 list")
        loaded = LoadedData(source_name=source_name, records=records, id_field=self.id_field)
        loaded.validation = self._validate(loaded)
        self.loaded[source_name] = loaded
        return loaded

    def _try_cast(self, value: str):
        try:
            if "." in value:
                return float(value)
            return int(value)
        except (ValueError, TypeError):
            return value

    def _validate(self, data: LoadedData) -> ValidationResult:
        result = ValidationResult()
        seen_ids = {}
        for i, rec in enumerate(data.records):
            rid = rec.get(self.id_field)
            if rid is None or (isinstance(rid, str) and rid.strip() == ""):
                result.null_ids.append(f"行{i+1}")
                continue
            rid_str = str(rid)
            if rid_str in seen_ids:
                result.duplicate_ids.append(rid_str)
            else:
                seen_ids[rid_str] = 0
            seen_ids[rid_str] += 1

            for field_name, rule in BOUNDARY_RULES.items():
                val = rec.get(field_name)
                if val is None:
                    continue
                try:
                    val_f = float(val)
                except (ValueError, TypeError):
                    continue
                lo, hi = rule["min"], rule["max"]
                if rule["inclusive"]:
                    is_boundary = (val_f == lo or val_f == hi)
                    is_out = (val_f < lo or val_f > hi)
                else:
                    is_boundary = (abs(val_f - lo) < 1e-9 or abs(val_f - hi) < 1e-9)
                    is_out = (val_f <= lo or val_f >= hi)
                if is_out:
                    result.boundary_records.append({
                        "id": rid_str,
                        "field": field_name,
                        "value": val,
                        "reason": "超出有效范围",
                        "evidence": f"source={data.source_name}, id={rid_str}, field={field_name}, value={val}, 范围=[{lo},{hi}]"
                    })
                elif is_boundary:
                    result.boundary_records.append({
                        "id": rid_str,
                        "field": field_name,
                        "value": val,
                        "reason": "处于边界值",
                        "evidence": f"source={data.source_name}, id={rid_str}, field={field_name}, value={val}, 范围=[{lo},{hi}]"
                    })

            missing = []
            for expected in [self.id_field, "score", "model_score"]:
                if expected not in rec or rec[expected] is None:
                    missing.append(expected)
            if missing:
                result.missing_fields[rid_str if rid else f"行{i+1}"] = missing

        if result.duplicate_ids:
            result.warnings.append(
                f"发现重复ID: {result.duplicate_ids}，重复记录将在对齐时取最后一条"
            )
        if result.null_ids:
            result.warnings.append(
                f"发现空值ID行: {result.null_ids}，这些记录将被跳过"
            )
        if result.boundary_records:
            out_of_range = [r for r in result.boundary_records if r["reason"] == "超出有效范围"]
            if out_of_range:
                result.warnings.append(
                    f"发现超出有效范围的记录: {[r['id'] for r in out_of_range]}"
                )
        return result

    def get_validation_summary(self) -> str:
        lines = []
        for name, data in self.loaded.items():
            lines.append(f"=== {name} ===")
            lines.append(data.validation.summary())
        return "\n".join(lines)
