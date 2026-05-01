from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

import numpy as np
import pandas as pd

from .models import ProjectConfig, Sensor, Unit


class ValidationIssue:
    def __init__(
        self,
        issue_type: str,
        severity: str,
        reason: str,
        row: Optional[int] = None,
        column: Optional[str] = None,
        value: Any = None,
        sensor_id: Optional[str] = None,
    ):
        self.issue_type = issue_type
        self.severity = severity
        self.reason = reason
        self.row = row
        self.column = column
        self.value = value
        self.sensor_id = sensor_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type,
            "severity": self.severity,
            "reason": self.reason,
            "row": self.row,
            "column": self.column,
            "value": str(self.value) if self.value is not None else None,
            "sensor_id": self.sensor_id,
        }

    def to_quarantine_entry(self) -> Dict[str, Any]:
        return {
            "reason": self.reason,
            "severity": self.severity,
            "row": self.row,
            "column": self.column,
            "value": self.value,
            "sensor_id": self.sensor_id,
        }


class DataValidator:
    def __init__(self, config: ProjectConfig):
        self.config = config
        self.issues: List[ValidationIssue] = []
        self.quarantine_rows: List[Dict[str, Any]] = []

    def _add_issue(
        self,
        issue_type: str,
        severity: str,
        reason: str,
        row: Optional[int] = None,
        column: Optional[str] = None,
        value: Any = None,
        sensor_id: Optional[str] = None,
        quarantine_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        issue = ValidationIssue(
            issue_type=issue_type,
            severity=severity,
            reason=reason,
            row=row,
            column=column,
            value=value,
            sensor_id=sensor_id,
        )
        self.issues.append(issue)

        if quarantine_data is not None and severity in ["error", "critical"]:
            entry = issue.to_quarantine_entry()
            entry["raw_data"] = quarantine_data
            self.quarantine_rows.append(entry)

    def validate_time_order(self, df: pd.DataFrame, source_name: str = "") -> None:
        if df.empty:
            return

        times = df.index
        if not hasattr(times, "__iter__") or len(times) < 2:
            return

        prev_time = None
        for i, current_time in enumerate(times):
            if prev_time is not None:
                if current_time < prev_time:
                    self._add_issue(
                        issue_type="time_out_of_order",
                        severity="error",
                        reason=f"时间倒序: {prev_time} -> {current_time}",
                        row=i,
                        column="timestamp",
                        value=str(current_time),
                    )
                elif current_time == prev_time:
                    self._add_issue(
                        issue_type="duplicate_timestamp",
                        severity="warning",
                        reason=f"重复时间戳: {current_time}",
                        row=i,
                        column="timestamp",
                        value=str(current_time),
                    )
            prev_time = current_time

    def validate_sampling_rate(self, df: pd.DataFrame, source_name: str = "") -> None:
        if df.empty or len(df) < 2:
            return

        times = df.index
        if not hasattr(times, "__iter__"):
            return

        time_deltas = pd.Series(times).diff().dropna()
        if time_deltas.empty:
            return

        delta_seconds = time_deltas.dt.total_seconds()
        expected_interval = 1.0 / self.config.default_sampling_rate
        tolerance = expected_interval * 0.1

        for i, delta in enumerate(delta_seconds):
            if abs(delta - expected_interval) > tolerance:
                self._add_issue(
                    issue_type="sampling_rate_inconsistency",
                    severity="warning",
                    reason=f"采样间隔异常: 期望 {expected_interval:.3f}s, 实际 {delta:.3f}s",
                    row=i + 1,
                    column="timestamp",
                    value=f"间隔: {delta:.3f}s",
                )

    def validate_sensor_ids(self, df: pd.DataFrame, source_name: str = "") -> None:
        valid_sensor_ids = {s.sensor_id for s in self.config.sensors}

        for col in df.columns:
            if col == "timestamp" or col.startswith("_"):
                continue

            if col not in valid_sensor_ids:
                self._add_issue(
                    issue_type="unknown_sensor_id",
                    severity="warning",
                    reason=f"传感器编号 '{col}' 不在配置清单中",
                    column=col,
                    sensor_id=col,
                )

    def validate_missing_values(self, df: pd.DataFrame, source_name: str = "") -> None:
        for col in df.columns:
            missing_count = df[col].isna().sum()
            if missing_count > 0:
                missing_indices = df[df[col].isna()].index
                for i, idx in enumerate(missing_indices[:10]):
                    row_num = df.index.get_loc(idx) if hasattr(df.index, "get_loc") else i
                    self._add_issue(
                        issue_type="missing_value",
                        severity="warning",
                        reason=f"列 '{col}' 存在缺失值",
                        row=row_num,
                        column=col,
                        value="NaN",
                    )
                if missing_count > 10:
                    self._add_issue(
                        issue_type="missing_value",
                        severity="warning",
                        reason=f"列 '{col}' 共有 {missing_count} 个缺失值",
                        column=col,
                    )

    def validate_value_range(
        self,
        df: pd.DataFrame,
        source_name: str = "",
    ) -> None:
        thresholds = self.config.thresholds
        max_strain = thresholds.get("max_strain", 2000.0)
        max_displacement = thresholds.get("max_displacement", 100.0)

        sensor_map = {s.sensor_id: s for s in self.config.sensors}

        for col in df.columns:
            if col == "timestamp" or col.startswith("_"):
                continue

            sensor = sensor_map.get(col)
            if sensor is None:
                continue

            valid_data = df[col].dropna()
            if valid_data.empty:
                continue

            if sensor.type == "strain_gauge":
                exceed_high = valid_data[valid_data > max_strain]
                exceed_low = valid_data[valid_data < -max_strain]

                for idx in exceed_high.index[:5]:
                    row_num = df.index.get_loc(idx) if hasattr(df.index, "get_loc") else -1
                    self._add_issue(
                        issue_type="value_out_of_range",
                        severity="warning",
                        reason=f"应变值超出阈值 ({max_strain} microstrain)",
                        row=row_num,
                        column=col,
                        value=float(exceed_high[idx]),
                        sensor_id=col,
                    )

                for idx in exceed_low.index[:5]:
                    row_num = df.index.get_loc(idx) if hasattr(df.index, "get_loc") else -1
                    self._add_issue(
                        issue_type="value_out_of_range",
                        severity="warning",
                        reason=f"应变值超出阈值 (-{max_strain} microstrain)",
                        row=row_num,
                        column=col,
                        value=float(exceed_low[idx]),
                        sensor_id=col,
                    )

            elif sensor.type == "displacement_meter":
                exceed = valid_data[abs(valid_data) > max_displacement]
                for idx in exceed.index[:5]:
                    row_num = df.index.get_loc(idx) if hasattr(df.index, "get_loc") else -1
                    self._add_issue(
                        issue_type="value_out_of_range",
                        severity="warning",
                        reason=f"位移值超出阈值 (±{max_displacement} mm)",
                        row=row_num,
                        column=col,
                        value=float(exceed[idx]),
                        sensor_id=col,
                    )

    def validate_all(
        self,
        df: pd.DataFrame,
        source_name: str = "",
        checks: Optional[List[str]] = None,
    ) -> Tuple[pd.DataFrame, List[ValidationIssue]]:
        self.issues = []
        self.quarantine_rows = []

        if checks is None:
            checks = [
                "time_order",
                "sampling_rate",
                "sensor_ids",
                "missing_values",
                "value_range",
            ]

        if "time_order" in checks:
            self.validate_time_order(df, source_name)
        if "sampling_rate" in checks:
            self.validate_sampling_rate(df, source_name)
        if "sensor_ids" in checks:
            self.validate_sensor_ids(df, source_name)
        if "missing_values" in checks:
            self.validate_missing_values(df, source_name)
        if "value_range" in checks:
            self.validate_value_range(df, source_name)

        return df, self.issues

    def get_issues_summary(self) -> Dict[str, Any]:
        summary: Dict[str, Any] = {
            "total": len(self.issues),
            "by_severity": {},
            "by_type": {},
            "quarantine_count": len(self.quarantine_rows),
        }

        for issue in self.issues:
            summary["by_severity"][issue.severity] = (
                summary["by_severity"].get(issue.severity, 0) + 1
            )
            summary["by_type"][issue.issue_type] = (
                summary["by_type"].get(issue.issue_type, 0) + 1
            )

        return summary

    def get_quarantine_data(self) -> List[Dict[str, Any]]:
        return self.quarantine_rows
