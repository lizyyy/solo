import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
from scipy import stats
from .exceptions import QCError


QC_RULES = [
    "RANGE_CHECK",
    "TREND_CHECK",
    "DRIFT_CHECK",
    "SPIKE_CHECK",
    "FLATLINE_CHECK",
    "CORRELATION_CHECK",
    "PHASE_CONSISTENCY_CHECK",
]


DEFAULT_QC_CONFIG = {
    "pH": {
        "normal_range": (5.0, 8.5),
        "warning_range": (4.0, 9.5),
        "max_rate_of_change": 1.0,
        "max_drift_per_hour": 0.5,
    },
    "temperature": {
        "normal_range": (25.0, 40.0),
        "warning_range": (20.0, 45.0),
        "max_rate_of_change": 3.0,
        "max_drift_per_hour": 2.0,
    },
    "dissolved_oxygen": {
        "normal_range": (10.0, 90.0),
        "warning_range": (0.0, 100.0),
        "max_rate_of_change": 40.0,
        "max_drift_per_hour": 20.0,
    },
    "general": {
        "spike_threshold": 4.0,
        "flatline_min_points": 8,
        "flatline_tolerance": 0.02,
        "trend_window_hours": 4,
        "correlation_min_points": 10,
    },
}


class QualityControlEngine:
    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        rules_to_apply: Optional[List[str]] = None,
    ):
        self.config = config or DEFAULT_QC_CONFIG
        self.rules_to_apply = rules_to_apply or QC_RULES
        self.qc_log = []
        self.rule_results = {}

    def _log_rule(
        self,
        sample_id: str,
        rule_name: str,
        parameter: str,
        status: str,
        message: str,
        details: Optional[Dict] = None,
    ):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "sample_id": sample_id,
            "rule_name": rule_name,
            "parameter": parameter,
            "status": status,
            "message": message,
            "details": details or {},
        }
        self.qc_log.append(entry)

    def _get_param_config(self, parameter: str) -> Dict[str, Any]:
        return self.config.get(parameter, {})

    def _get_general_config(self) -> Dict[str, Any]:
        return self.config.get("general", {})

    def rule_range_check(
        self,
        series: pd.Series,
        parameter: str,
        sample_id: str,
    ) -> Dict[str, Any]:
        config = self._get_param_config(parameter)
        normal_range = config.get("normal_range")
        warning_range = config.get("warning_range")

        result = {
            "rule": "RANGE_CHECK",
            "parameter": parameter,
            "status": "PASS",
            "violations": [],
            "summary": {},
        }

        if normal_range is None:
            return result

        min_normal, max_normal = normal_range
        min_warn, max_warn = warning_range if warning_range else normal_range

        violations = []
        for idx, value in series.items():
            if pd.isna(value):
                continue

            if value < min_normal or value > max_normal:
                severity = "ERROR" if value < min_warn or value > max_warn else "WARNING"
                violations.append({
                    "index": idx,
                    "value": value,
                    "severity": severity,
                    "time": idx,
                })

        if violations:
            error_count = sum(1 for v in violations if v["severity"] == "ERROR")
            warning_count = len(violations) - error_count

            result["status"] = "FAIL" if error_count > 0 else "WARNING"
            result["violations"] = violations
            result["summary"] = {
                "total_violations": len(violations),
                "error_count": error_count,
                "warning_count": warning_count,
                "normal_range": normal_range,
            }

            self._log_rule(
                sample_id,
                "RANGE_CHECK",
                parameter,
                result["status"],
                f"发现 {len(violations)} 个范围违规点",
                details={"normal_range": normal_range},
            )

        return result

    def rule_trend_check(
        self,
        series: pd.Series,
        time_series: pd.Series,
        parameter: str,
        sample_id: str,
    ) -> Dict[str, Any]:
        config = self._get_param_config(parameter)
        max_rate = config.get("max_rate_of_change")
        window_hours = self._get_general_config().get("trend_window_hours", 4)

        result = {
            "rule": "TREND_CHECK",
            "parameter": parameter,
            "status": "PASS",
            "violations": [],
            "summary": {},
        }

        if max_rate is None or len(series) < 2:
            return result

        valid_mask = (~pd.isna(series)) & (~pd.isna(time_series))
        if valid_mask.sum() < 2:
            return result

        clean_series = series[valid_mask].reset_index(drop=True)
        clean_time = time_series[valid_mask].reset_index(drop=True)

        time_diff = clean_time.diff().fillna(0)
        value_diff = clean_series.diff().fillna(0)

        rate_of_change = (value_diff / time_diff.replace(0, np.nan)).abs()

        violations = []
        for idx, (rate, time, value) in enumerate(zip(rate_of_change, clean_time, clean_series)):
            if pd.isna(rate) or idx == 0:
                continue
            if rate > max_rate:
                violations.append({
                    "index": idx,
                    "time": time,
                    "value": value,
                    "rate_of_change": rate,
                    "threshold": max_rate,
                })

        if violations:
            result["status"] = "FAIL"
            result["violations"] = violations
            result["summary"] = {
                "total_violations": len(violations),
                "max_rate_of_change": max_rate,
                "average_rate": rate_of_change.mean(),
            }

            self._log_rule(
                sample_id,
                "TREND_CHECK",
                parameter,
                "FAIL",
                f"发现 {len(violations)} 个速率异常点",
                details={"max_rate": max_rate},
            )

        return result

    def rule_drift_check(
        self,
        series: pd.Series,
        time_series: pd.Series,
        parameter: str,
        sample_id: str,
    ) -> Dict[str, Any]:
        config = self._get_param_config(parameter)
        max_drift = config.get("max_drift_per_hour")
        window_hours = self._get_general_config().get("trend_window_hours", 4)

        result = {
            "rule": "DRIFT_CHECK",
            "parameter": parameter,
            "status": "PASS",
            "violations": [],
            "summary": {},
        }

        if max_drift is None or len(series) < 5:
            return result

        valid_mask = (~pd.isna(series)) & (~pd.isna(time_series))
        if valid_mask.sum() < 5:
            return result

        clean_series = series[valid_mask].reset_index(drop=True)
        clean_time = time_series[valid_mask].reset_index(drop=True)

        total_duration = clean_time.max() - clean_time.min()
        if total_duration <= 0:
            return result

        overall_change = clean_series.iloc[-1] - clean_series.iloc[0]
        drift_per_hour = abs(overall_change) / total_duration

        if drift_per_hour > max_drift:
            result["status"] = "FAIL"
            result["violations"] = [{
                "type": "overall_drift",
                "total_duration_hours": total_duration,
                "total_change": overall_change,
                "drift_per_hour": drift_per_hour,
                "threshold": max_drift,
            }]
            result["summary"] = {
                "drift_per_hour": drift_per_hour,
                "threshold": max_drift,
                "total_change": overall_change,
            }

            self._log_rule(
                sample_id,
                "DRIFT_CHECK",
                parameter,
                "FAIL",
                f"整体漂移 {drift_per_hour:.3f}/小时 超过阈值 {max_drift}",
                details={"drift_per_hour": drift_per_hour},
            )

        return result

    def rule_spike_check(
        self,
        series: pd.Series,
        parameter: str,
        sample_id: str,
    ) -> Dict[str, Any]:
        spike_threshold = self._get_general_config().get("spike_threshold", 3.0)

        result = {
            "rule": "SPIKE_CHECK",
            "parameter": parameter,
            "status": "PASS",
            "violations": [],
            "summary": {},
        }

        if len(series) < 5:
            return result

        clean_series = series.dropna().reset_index(drop=True)
        if len(clean_series) < 5:
            return result

        z_scores = np.abs(stats.zscore(clean_series))
        violations = []

        for idx, (z_score, value) in enumerate(zip(z_scores, clean_series)):
            if z_score > spike_threshold:
                violations.append({
                    "index": idx,
                    "value": value,
                    "z_score": z_score,
                    "threshold": spike_threshold,
                })

        if violations:
            result["status"] = "FAIL"
            result["violations"] = violations
            result["summary"] = {
                "total_violations": len(violations),
                "zscore_threshold": spike_threshold,
                "mean": float(clean_series.mean()),
                "std": float(clean_series.std()),
            }

            self._log_rule(
                sample_id,
                "SPIKE_CHECK",
                parameter,
                "FAIL",
                f"发现 {len(violations)} 个异常尖峰",
                details={"spike_threshold": spike_threshold},
            )

        return result

    def rule_flatline_check(
        self,
        series: pd.Series,
        parameter: str,
        sample_id: str,
    ) -> Dict[str, Any]:
        general_config = self._get_general_config()
        min_points = general_config.get("flatline_min_points", 5)
        tolerance = general_config.get("flatline_tolerance", 0.01)

        result = {
            "rule": "FLATLINE_CHECK",
            "parameter": parameter,
            "status": "PASS",
            "violations": [],
            "summary": {},
        }

        if len(series) < min_points:
            return result

        clean_series = series.dropna().reset_index(drop=True)
        if len(clean_series) < min_points:
            return result

        violations = []
        current_streak = 1
        streak_start = 0
        current_value = clean_series.iloc[0]

        for idx in range(1, len(clean_series)):
            value = clean_series.iloc[idx]
            if abs(value - current_value) <= tolerance:
                current_streak += 1
            else:
                if current_streak >= min_points:
                    violations.append({
                        "start_index": streak_start,
                        "end_index": idx - 1,
                        "duration": current_streak,
                        "value": current_value,
                    })
                current_streak = 1
                streak_start = idx
                current_value = value

        if current_streak >= min_points:
            violations.append({
                "start_index": streak_start,
                "end_index": len(clean_series) - 1,
                "duration": current_streak,
                "value": current_value,
            })

        if violations:
            result["status"] = "FAIL"
            result["violations"] = violations
            result["summary"] = {
                "total_flatlines": len(violations),
                "min_points": min_points,
                "tolerance": tolerance,
            }

            self._log_rule(
                sample_id,
                "FLATLINE_CHECK",
                parameter,
                "FAIL",
                f"发现 {len(violations)} 个异常平台段",
                details={"min_points": min_points},
            )

        return result

    def rule_phase_consistency_check(
        self,
        df: pd.DataFrame,
        sample_id: str,
    ) -> Dict[str, Any]:
        result = {
            "rule": "PHASE_CONSISTENCY_CHECK",
            "parameter": "multi",
            "status": "PASS",
            "violations": [],
            "summary": {},
        }

        required_cols = ["pH", "temperature", "dissolved_oxygen"]
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            return result

        ph_series = df["pH"].dropna()
        temp_series = df["temperature"].dropna()
        do_series = df["dissolved_oxygen"].dropna()

        violations = []

        if len(ph_series) > 10 and len(do_series) > 10:
            ph_decreasing = ph_series.diff().mean() < -0.05
            do_increasing = do_series.diff().mean() > 2

            if ph_decreasing and do_increasing:
                violations.append({
                    "type": "growth_phase_mismatch",
                    "description": "pH下降且溶氧上升，可能发酵异常",
                })

        if len(temp_series) > 5:
            temp_std = temp_series.std()
            if temp_std > 3.0:
                violations.append({
                    "type": "temperature_instability",
                    "description": f"温度波动过大 (std={temp_std:.2f}°C)",
                    "temperature_std": float(temp_std),
                })

        if violations:
            result["status"] = "FAIL"
            result["violations"] = violations
            result["summary"] = {
                "total_violations": len(violations),
            }

            self._log_rule(
                sample_id,
                "PHASE_CONSISTENCY_CHECK",
                "multi",
                "FAIL",
                f"发现 {len(violations)} 个阶段一致性问题",
            )

        return result

    def analyze_sample(
        self,
        df: pd.DataFrame,
        sample_id: str,
    ) -> Dict[str, Any]:
        result = {
            "sample_id": sample_id,
            "overall_status": "PASS",
            "rules_applied": [],
            "parameters": {},
            "requires_recheck": False,
            "recheck_reason": None,
        }

        parameters = ["pH", "temperature", "dissolved_oxygen"]
        time_col = "time" if "time" in df.columns else df.columns[0]

        for param in parameters:
            if param not in df.columns:
                continue

            series = df[param]
            time_series = df[time_col] if time_col in df.columns else pd.Series(range(len(df)))

            param_results = {}

            if "RANGE_CHECK" in self.rules_to_apply:
                param_results["RANGE_CHECK"] = self.rule_range_check(
                    series, param, sample_id
                )

            if "TREND_CHECK" in self.rules_to_apply:
                param_results["TREND_CHECK"] = self.rule_trend_check(
                    series, time_series, param, sample_id
                )

            if "DRIFT_CHECK" in self.rules_to_apply:
                param_results["DRIFT_CHECK"] = self.rule_drift_check(
                    series, time_series, param, sample_id
                )

            if "SPIKE_CHECK" in self.rules_to_apply:
                param_results["SPIKE_CHECK"] = self.rule_spike_check(
                    series, param, sample_id
                )

            if "FLATLINE_CHECK" in self.rules_to_apply:
                param_results["FLATLINE_CHECK"] = self.rule_flatline_check(
                    series, param, sample_id
                )

            result["parameters"][param] = param_results

            for rule_name, rule_result in param_results.items():
                result["rules_applied"].append(rule_name)
                if rule_result["status"] == "FAIL":
                    if result["overall_status"] != "ERROR":
                        result["overall_status"] = "FAIL"
                elif rule_result["status"] == "WARNING":
                    if result["overall_status"] == "PASS":
                        result["overall_status"] = "WARNING"

        if "PHASE_CONSISTENCY_CHECK" in self.rules_to_apply:
            phase_result = self.rule_phase_consistency_check(df, sample_id)
            result["phase_consistency"] = phase_result
            if phase_result["status"] == "FAIL" and result["overall_status"] == "PASS":
                result["overall_status"] = "WARNING"

        if result["overall_status"] in ["FAIL", "ERROR"]:
            result["requires_recheck"] = True
            result["recheck_reason"] = "质控规则判定异常，建议复检"
        elif result["overall_status"] == "WARNING":
            result["requires_recheck"] = True
            result["recheck_reason"] = "存在潜在异常，建议人工审核"

        return result

    def analyze_batch(
        self,
        processed_samples: Dict[str, Any],
    ) -> Dict[str, Any]:
        results = {}
        summary = {
            "total_samples": 0,
            "pass_count": 0,
            "warning_count": 0,
            "fail_count": 0,
            "requires_recheck_count": 0,
            "failed_samples": [],
            "recheck_samples": [],
        }

        for sample_id, sample_data in processed_samples.items():
            if not sample_data.get("success", False):
                summary["failed_samples"].append({
                    "sample_id": sample_id,
                    "reason": "预处理失败",
                    "errors": sample_data.get("errors", []),
                })
                continue

            df = sample_data["dataframe"]
            qc_result = self.analyze_sample(df, sample_id)
            results[sample_id] = qc_result

            summary["total_samples"] += 1

            if qc_result["overall_status"] == "PASS":
                summary["pass_count"] += 1
            elif qc_result["overall_status"] == "WARNING":
                summary["warning_count"] += 1
            else:
                summary["fail_count"] += 1

            if qc_result["requires_recheck"]:
                summary["requires_recheck_count"] += 1
                summary["recheck_samples"].append({
                    "sample_id": sample_id,
                    "reason": qc_result.get("recheck_reason", ""),
                    "status": qc_result["overall_status"],
                })

        summary["pass_rate"] = (
            summary["pass_count"] / summary["total_samples"]
            if summary["total_samples"] > 0 else 0
        )
        summary["recheck_rate"] = (
            summary["requires_recheck_count"] / summary["total_samples"]
            if summary["total_samples"] > 0 else 0
        )

        return {
            "results": results,
            "summary": summary,
            "qc_log": self.qc_log,
        }
