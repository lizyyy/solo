"""
Parser module for fumigation data.
Handles CSV, JSONL, YAML parsing with validation.
Deals with sensor drift correction, out-of-order records, and cross-midnight operations.
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
import csv
import json
import re


class ValidationError(Exception):
    pass


class SensorDriftError(Exception):
    def __init__(self, sensor_id: str, expected: float, actual: float, timestamp: str):
        self.sensor_id = sensor_id
        self.expected = expected
        self.actual = actual
        self.timestamp = timestamp
        super().__init__(
            f"Sensor {sensor_id} drift detected at {timestamp}: "
            f"expected ~{expected} ppm, got {actual} ppm"
        )


class WarehouseParser:
    REQUIRED_COLS = {"warehouse_id", "name", "volume_m3", "ventilation_rate"}

    def __init__(self, csv_path: str):
        self.csv_path = Path(csv_path)

    def parse(self) -> list[dict[str, Any]]:
        if not self.csv_path.exists():
            raise FileNotFoundError(f"仓房信息文件不存在: {self.csv_path}")

        warehouses = []
        with open(self.csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            self._validate_columns(reader.fieldnames)
            for row in reader:
                self._validate_row(row)
                warehouses.append({
                    "warehouse_id": row["warehouse_id"].strip(),
                    "name": row["name"].strip(),
                    "volume_m3": float(row["volume_m3"]),
                    "ventilation_rate": float(row["ventilation_rate"]),
                })
        return warehouses

    def _validate_columns(self, fieldnames):
        if fieldnames is None:
            raise ValidationError("仓房 CSV 文件为空或格式错误")
        missing = self.REQUIRED_COLS - set(fieldnames)
        if missing:
            raise ValidationError(f"仓房 CSV 缺少必需列: {missing}")

    def _validate_row(self, row):
        if not row["warehouse_id"].strip():
            raise ValidationError("仓房 ID 不能为空")
        if float(row["volume_m3"]) <= 0:
            raise ValidationError(f"仓房 {row['warehouse_id']} 体积必须大于 0")
        if float(row["ventilation_rate"]) < 0:
            raise ValidationError(f"仓房 {row['warehouse_id']} 通风率不能为负")


class SensorParser:
    REQUIRED_COLS = {"timestamp", "warehouse_id", "sensor_id", "concentration_ppm"}

    def __init__(self, jsonl_path: str, drift_threshold: float = 5.0):
        self.jsonl_path = Path(jsonl_path)
        self.drift_threshold = drift_threshold

    def parse(self) -> list[dict[str, Any]]:
        if not self.jsonl_path.exists():
            raise FileNotFoundError(f"传感器数据文件不存在: {self.jsonl_path}")

        records = []
        drift_warnings = []
        with open(self.jsonl_path, encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as e:
                    raise ValidationError(f"JSONL 解析错误 (行 {line_num}): {e}")

                self._validate_record(record, line_num)
                records.append(record)

        records = self._sort_and_fix_crossmidnight(records)

        for i in range(1, len(records)):
            prev = records[i - 1]
            curr = records[i]
            if prev["warehouse_id"] == curr["warehouse_id"] and prev["sensor_id"] == curr["sensor_id"]:
                diff = abs(curr["concentration_ppm"] - prev["concentration_ppm"])
                time_diff = self._parse_timestamp(curr["timestamp"]) - self._parse_timestamp(prev["timestamp"])
                if time_diff.total_seconds() > 0:
                    rate = diff / (time_diff.total_seconds() / 3600)
                    if rate > self.drift_threshold:
                        drift_warnings.append(
                            f"警告: 传感器 {curr['sensor_id']} 在 {curr['timestamp']} "
                            f"浓度变化率异常 ({rate:.1f} ppm/h)"
                        )

        if drift_warnings:
            print("传感器漂移警告:")
            for w in drift_warnings[:10]:
                print(f"  {w}")

        return records

    def _validate_record(self, record: dict, line_num: int):
        missing = self.REQUIRED_COLS - set(record.keys())
        if missing:
            raise ValidationError(f"传感器记录缺少必需字段 (行 {line_num}): {missing}")
        try:
            self._parse_timestamp(record["timestamp"])
        except Exception:
            raise ValidationError(f"传感器时间戳格式错误 (行 {line_num}): {record['timestamp']}")

    def _parse_timestamp(self, ts: str) -> datetime:
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"]:
            try:
                return datetime.strptime(ts, fmt)
            except ValueError:
                continue
        raise ValidationError(f"无法解析时间戳: {ts}")

    def _sort_and_fix_crossmidnight(self, records: list[dict]) -> list[dict]:
        def sort_key(r):
            return (
                r["warehouse_id"],
                r["sensor_id"],
                self._parse_timestamp(r["timestamp"])
            )

        sorted_records = sorted(records, key=sort_key)

        corrected = []
        for i, record in enumerate(sorted_records):
            if i > 0:
                prev_ts = self._parse_timestamp(sorted_records[i - 1]["timestamp"])
                curr_ts = self._parse_timestamp(record["timestamp"])
                if curr_ts < prev_ts and (prev_ts - curr_ts).total_seconds() > 3600:
                    record = dict(record)
                    record["timestamp"] = self._adjust_crossmidnight(
                        record["timestamp"], prev_ts
                    )
            corrected.append(record)
        return corrected

    def _adjust_crossmidnight(self, ts_str: str, ref_ts: datetime) -> str:
        ts = self._parse_timestamp(ts_str)
        if ts.hour < 6:
            ts += timedelta(days=1)
        return ts.strftime("%Y-%m-%d %H:%M:%S")


class VentilationParser:
    REQUIRED_COLS = {"warehouse_id", "vent_id", "start_time", "end_time", "flow_rate_m3h"}

    def __init__(self, csv_path: str):
        self.csv_path = Path(csv_path)

    def parse(self) -> list[dict[str, Any]]:
        if not self.csv_path.exists():
            raise FileNotFoundError(f"通风机记录文件不存在: {self.csv_path}")

        records = []
        with open(self.csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            self._validate_columns(reader.fieldnames)
            for row in reader:
                self._validate_row(row)
                records.append({
                    "warehouse_id": row["warehouse_id"].strip(),
                    "vent_id": row["vent_id"].strip(),
                    "start_time": row["start_time"].strip(),
                    "end_time": row["end_time"].strip(),
                    "flow_rate_m3h": float(row["flow_rate_m3h"]),
                })
        return self._sort_and_fix_crossmidnight(records)

    def _validate_columns(self, fieldnames):
        if fieldnames is None:
            raise ValidationError("通风机 CSV 文件为空或格式错误")
        missing = self.REQUIRED_COLS - set(fieldnames)
        if missing:
            raise ValidationError(f"通风机 CSV 缺少必需列: {missing}")

    def _validate_row(self, row):
        for t in ["start_time", "end_time"]:
            self._parse_time(row[t])

    def _parse_time(self, t: str) -> datetime:
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"]:
            try:
                return datetime.strptime(t, fmt)
            except ValueError:
                continue
        raise ValidationError(f"无法解析时间: {t}")

    def _sort_and_fix_crossmidnight(self, records: list[dict]) -> list[dict]:
        def sort_key(r):
            return (
                r["warehouse_id"],
                r["vent_id"],
                self._parse_time(r["start_time"])
            )

        sorted_records = sorted(records, key=sort_key)

        corrected = []
        for i, record in enumerate(sorted_records):
            if i > 0:
                prev_end = self._parse_time(sorted_records[i - 1]["end_time"])
                curr_start = self._parse_time(record["start_time"])
                if curr_start < prev_end and (prev_end - curr_start).total_seconds() > 3600:
                    record = dict(record)
                    record["start_time"] = self._adjust_crossmidnight(
                        record["start_time"], prev_end
                    )
                    record["end_time"] = self._adjust_crossmidnight(
                        record["end_time"], prev_end
                    )
            corrected.append(record)
        return corrected

    def _adjust_crossmidnight(self, t_str: str, ref_ts: datetime) -> str:
        t = self._parse_time(t_str)
        if t.hour < 6:
            t += timedelta(days=1)
        return t.strftime("%Y-%m-%d %H:%M:%S")


class RulesParser:
    REQUIRED_FIELDS = {"name", "condition", "action", "priority"}

    def __init__(self, yaml_path: str):
        self.yaml_path = Path(yaml_path)

    def parse(self) -> dict[str, Any]:
        if not self.yaml_path.exists():
            raise FileNotFoundError(f"规则文件不存在: {self.yaml_path}")

        try:
            import yaml
        except ImportError:
            raise ImportError("需要 pyyaml 库: pip install pyyaml")

        with open(self.yaml_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)

        if not data:
            raise ValidationError("规则文件为空")

        rules = []
        if isinstance(data, list):
            for idx, rule in enumerate(data):
                self._validate_rule(rule, idx)
                rules.append(rule)
        elif isinstance(data, dict) and "rules" in data:
            for idx, rule in enumerate(data["rules"]):
                self._validate_rule(rule, idx)
                rules.append(rule)

        rules.sort(key=lambda r: r.get("priority", 0), reverse=True)
        return {"rules": rules}

    def _validate_rule(self, rule: dict, idx: int):
        if not isinstance(rule, dict):
            raise ValidationError(f"规则 {idx} 格式错误: 应为字典")
        missing = self.REQUIRED_FIELDS - set(rule.keys())
        if missing:
            raise ValidationError(f"规则 {idx} 缺少必需字段: {missing}")
        if rule.get("condition") not in [
            "concentration_below",
            "concentration_above",
            "ventilation_active",
            "ventilation_inactive",
            "time_after_application",
            "combined",
        ]:
            raise ValidationError(f"规则 {idx} condition 类型不支持: {rule.get('condition')}")
