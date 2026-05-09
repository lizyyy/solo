"""质控规则引擎 - 空白样、平行样、加标回收验证"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import pandas as pd
import numpy as np
from scipy import stats
from .config import QCConfig


@dataclass
class SampleFailure:
    """样本失败原因记录 - 详细记录失败原因"""
    sample_id: str
    parameter: str
    sample_type: str
    failure_type: str
    rule_name: str
    message: str
    value: Optional[float] = None
    expected_range: Optional[Tuple[float, float]] = None
    calculated_value: Optional[float] = None
    threshold: Optional[float] = None
    affected_indices: List[int] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "parameter": self.parameter,
            "sample_type": self.sample_type,
            "failure_type": self.failure_type,
            "rule_name": self.rule_name,
            "message": self.message,
            "value": self.value,
            "expected_range": self.expected_range,
            "calculated_value": self.calculated_value,
            "threshold": self.threshold,
            "affected_indices": self.affected_indices,
            "raw_data": self.raw_data,
            "timestamp": self.timestamp,
        }


@dataclass
class QCCheck:
    """单项质控检查结果"""
    rule_name: str
    sample_type: str
    parameter: str
    passed: bool
    details: Dict[str, Any] = field(default_factory=dict)
    failures: List[SampleFailure] = field(default_factory=list)
    calculation_log: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QCResult:
    """完整质控结果"""
    checks: List[QCCheck] = field(default_factory=list)
    failures: List[SampleFailure] = field(default_factory=list)
    statistics: Dict[str, Any] = field(default_factory=dict)
    qc_summary: Dict[str, Any] = field(default_factory=dict)
    valid_samples: pd.DataFrame = field(default_factory=pd.DataFrame)
    invalid_samples: pd.DataFrame = field(default_factory=pd.DataFrame)
    config_used: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0

    def all_passed(self) -> bool:
        return len(self.failures) == 0

    def get_failures_by_type(self, failure_type: str) -> List[SampleFailure]:
        return [f for f in self.failures if f.failure_type == failure_type]

    def get_failures_by_parameter(self, parameter: str) -> List[SampleFailure]:
        return [f for f in self.failures if f.parameter == parameter]

    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "all_passed": self.all_passed(),
            "total_checks": len(self.checks),
            "passed_checks": sum(1 for c in self.checks if c.passed),
            "total_failures": len(self.failures),
            "failures_by_type": self._count_failures_by_type(),
            "statistics": self.statistics,
            "qc_summary": self.qc_summary,
        }

    def _count_failures_by_type(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for f in self.failures:
            counts[f.failure_type] = counts.get(f.failure_type, 0) + 1
        return counts


class QCEngine:
    """质控规则引擎"""

    def __init__(self, config: QCConfig):
        self.config = config

    def run_qc(self, df: pd.DataFrame) -> QCResult:
        """执行完整质控流程"""
        import time
        start_time = time.time()

        result = QCResult()
        result.config_used = self.config.to_dict()

        checks: List[QCCheck] = []
        all_failures: List[SampleFailure] = []

        if "sample_type" in df.columns:
            blank_df = df[df["sample_type"] == "blank"].copy()
            parallel_df = df[df["sample_type"] == "parallel"].copy()
            spike_df = df[df["sample_type"] == "spike"].copy()
            sample_df = df[df["sample_type"] == "sample"].copy()
        else:
            blank_df = parallel_df = spike_df = sample_df = pd.DataFrame()

        if not blank_df.empty:
            check, failures = self._check_blank_samples(blank_df)
            checks.append(check)
            all_failures.extend(failures)

        if not parallel_df.empty:
            check, failures = self._check_parallel_samples(parallel_df, df)
            checks.append(check)
            all_failures.extend(failures)

        if not spike_df.empty:
            check, failures = self._check_spike_recovery(spike_df, sample_df)
            checks.append(check)
            all_failures.extend(failures)

        outlier_check, outlier_failures = self._check_outliers(df)
        checks.append(outlier_check)
        all_failures.extend(outlier_failures)

        result.checks = checks
        result.failures = all_failures

        result.statistics = self._calculate_statistics(df, all_failures)
        result.qc_summary = self._generate_qc_summary(checks, all_failures)

        valid_mask = self._build_valid_mask(df, all_failures)
        result.valid_samples = df[valid_mask].reset_index(drop=True)
        result.invalid_samples = df[~valid_mask].reset_index(drop=True)

        result.execution_time = time.time() - start_time

        return result

    def _check_blank_samples(self, blank_df: pd.DataFrame) -> Tuple[QCCheck, List[SampleFailure]]:
        """检查空白样"""
        failures: List[SampleFailure] = []
        calculation_log: Dict[str, Any] = {}

        if "parameter" in blank_df.columns:
            for parameter, group in blank_df.groupby("parameter"):
                values = group["value"].dropna().values
                if len(values) == 0:
                    continue

                mean_val = float(np.mean(values))
                max_val = float(np.max(values))
                threshold = self.config.blank_threshold

                calculation_log[parameter] = {
                    "mean": mean_val,
                    "max": max_val,
                    "threshold": threshold,
                    "sample_count": len(values),
                    "values": values.tolist(),
                }

                if max_val > threshold:
                    for idx, row in group.iterrows():
                        if row["value"] > threshold:
                            failures.append(SampleFailure(
                                sample_id=str(row.get("sample_id", "unknown")),
                                parameter=parameter,
                                sample_type="blank",
                                failure_type="blank_exceed_threshold",
                                rule_name="空白样阈值检查",
                                message=f"空白样检测值 {row['value']:.4f} 超过阈值 {threshold}",
                                value=float(row["value"]),
                                expected_range=(0, threshold),
                                threshold=threshold,
                                affected_indices=[idx],
                                raw_data={
                                    "mean": mean_val,
                                    "all_values": values.tolist(),
                                    "max_value": max_val,
                                }
                            ))

        passed = len(failures) == 0
        check = QCCheck(
            rule_name="空白样检查",
            sample_type="blank",
            parameter="all",
            passed=passed,
            failures=failures,
            calculation_log=calculation_log,
        )

        return check, failures

    def _check_parallel_samples(self, parallel_df: pd.DataFrame, full_df: pd.DataFrame) -> Tuple[QCCheck, List[SampleFailure]]:
        """检查平行样 - 相对偏差 (RPD)"""
        failures: List[SampleFailure] = []
        calculation_log: Dict[str, Any] = {}

        if "sample_id" not in parallel_df.columns or "parameter" not in parallel_df.columns:
            check = QCCheck(
                rule_name="平行样检查",
                sample_type="parallel",
                parameter="all",
                passed=False,
                failures=failures,
                calculation_log={"error": "缺少 sample_id 或 parameter 列"},
            )
            return check, failures

        for (sample_id, parameter), group in parallel_df.groupby(["sample_id", "parameter"]):
            values = group["value"].dropna().values
            indices = group.index.tolist()

            if len(values) < 2:
                calculation_log[f"{sample_id}_{parameter}"] = {
                    "error": "平行样数量不足，需要至少2个",
                    "count": len(values),
                }
                failures.append(SampleFailure(
                    sample_id=str(sample_id),
                    parameter=str(parameter),
                    sample_type="parallel",
                    failure_type="parallel_insufficient",
                    rule_name="平行样配对检查",
                    message=f"平行样数量不足: {len(values)} 个，需要至少2个",
                    affected_indices=indices,
                    raw_data={"count": len(values)},
                ))
                continue

            mean_val = float(np.mean(values))
            max_rpd = 0.0
            worst_pair = None

            for i in range(len(values)):
                for j in range(i + 1, len(values)):
                    val1, val2 = values[i], values[j]
                    if mean_val == 0:
                        rpd = 0.0 if val1 == val2 else float("inf")
                    else:
                        rpd = abs(val1 - val2) / mean_val * 100

                    if rpd > max_rpd:
                        max_rpd = rpd
                        worst_pair = (i, j, val1, val2)

            threshold = self.config.parallel_max_rpd

            calculation_log[f"{sample_id}_{parameter}"] = {
                "values": values.tolist(),
                "mean": mean_val,
                "max_rpd": max_rpd,
                "threshold": threshold,
                "sample_count": len(values),
            }

            if max_rpd > threshold:
                failures.append(SampleFailure(
                    sample_id=str(sample_id),
                    parameter=str(parameter),
                    sample_type="parallel",
                    failure_type="parallel_rpd_exceed",
                    rule_name="平行样相对偏差检查",
                    message=f"平行样相对偏差 {max_rpd:.2f}% 超过阈值 {threshold}%",
                    value=mean_val,
                    calculated_value=max_rpd,
                    threshold=threshold,
                    expected_range=(0, threshold),
                    affected_indices=indices,
                    raw_data={
                        "values": values.tolist(),
                        "worst_pair": worst_pair,
                        "mean": mean_val,
                    }
                ))

        passed = len(failures) == 0
        check = QCCheck(
            rule_name="平行样检查",
            sample_type="parallel",
            parameter="all",
            passed=passed,
            failures=failures,
            calculation_log=calculation_log,
        )

        return check, failures

    def _check_spike_recovery(self, spike_df: pd.DataFrame, sample_df: pd.DataFrame) -> Tuple[QCCheck, List[SampleFailure]]:
        """检查加标回收"""
        failures: List[SampleFailure] = []
        calculation_log: Dict[str, Any] = {}

        required_cols = ["sample_id", "parameter", "value", "spike_amount", "original_concentration"]
        missing_cols = [c for c in required_cols if c not in spike_df.columns]
        if missing_cols:
            failures.append(SampleFailure(
                sample_id="unknown",
                parameter="all",
                sample_type="spike",
                failure_type="spike_missing_columns",
                rule_name="加标回收数据完整性",
                message=f"缺少加标回收必需列: {missing_cols}",
                raw_data={"missing_columns": missing_cols},
            ))
            check = QCCheck(
                rule_name="加标回收检查",
                sample_type="spike",
                parameter="all",
                passed=False,
                failures=failures,
            )
            return check, failures

        for idx, row in spike_df.iterrows():
            sample_id = str(row["sample_id"])
            parameter = str(row["parameter"])
            spike_value = float(row["value"])
            spike_amount = float(row["spike_amount"])
            original = float(row["original_concentration"])

            if spike_amount <= 0:
                failures.append(SampleFailure(
                    sample_id=sample_id,
                    parameter=parameter,
                    sample_type="spike",
                    failure_type="spike_invalid_amount",
                    rule_name="加标量有效性检查",
                    message=f"加标量 {spike_amount} 无效，必须大于0",
                    value=spike_amount,
                    affected_indices=[idx],
                ))
                continue

            recovery = (spike_value - original) / spike_amount * 100

            min_rec = self.config.recovery_min
            max_rec = self.config.recovery_max

            calculation_log[f"{sample_id}_{parameter}_{idx}"] = {
                "spike_value": spike_value,
                "original": original,
                "spike_amount": spike_amount,
                "recovery": recovery,
                "acceptable_range": (min_rec, max_rec),
            }

            if recovery < min_rec or recovery > max_rec:
                failures.append(SampleFailure(
                    sample_id=sample_id,
                    parameter=parameter,
                    sample_type="spike",
                    failure_type="spike_recovery_outside_range",
                    rule_name="加标回收率范围检查",
                    message=f"加标回收率 {recovery:.2f}% 超出范围 [{min_rec}%, {max_rec}%]",
                    value=spike_value,
                    calculated_value=recovery,
                    expected_range=(min_rec, max_rec),
                    threshold=None,
                    affected_indices=[idx],
                    raw_data={
                        "spike_value": spike_value,
                        "original": original,
                        "spike_amount": spike_amount,
                        "recovery_calculation": f"({spike_value} - {original}) / {spike_amount} * 100 = {recovery}",
                    }
                ))

        passed = len(failures) == 0
        check = QCCheck(
            rule_name="加标回收检查",
            sample_type="spike",
            parameter="all",
            passed=passed,
            failures=failures,
            calculation_log=calculation_log,
        )

        return check, failures

    def _check_outliers(self, df: pd.DataFrame) -> Tuple[QCCheck, List[SampleFailure]]:
        """检测异常值 - IQR 或 Z-score"""
        failures: List[SampleFailure] = []
        calculation_log: Dict[str, Any] = {}

        if "parameter" not in df.columns:
            check = QCCheck(
                rule_name="异常值检测",
                sample_type="all",
                parameter="all",
                passed=True,
                failures=failures,
                calculation_log={"skipped": "缺少 parameter 列"},
            )
            return check, failures

        method = self.config.outlier_method
        factor = self.config.outlier_factor

        for parameter, group in df.groupby("parameter"):
            values = group["value"].dropna().values
            if len(values) < 4:
                continue

            if method == "iqr":
                q1, q3 = np.percentile(values, [25, 75])
                iqr = q3 - q1
                lower_bound = q1 - factor * iqr
                upper_bound = q3 + factor * iqr

                calculation_log[parameter] = {
                    "method": "IQR",
                    "q1": float(q1),
                    "q3": float(q3),
                    "iqr": float(iqr),
                    "factor": factor,
                    "bounds": (float(lower_bound), float(upper_bound)),
                    "count": len(values),
                }

                outlier_mask = (group["value"] < lower_bound) | (group["value"] > upper_bound)
            else:
                mean_val = np.mean(values)
                std_val = np.std(values)
                if std_val == 0:
                    continue
                z_scores = (values - mean_val) / std_val

                calculation_log[parameter] = {
                    "method": "Z-score",
                    "mean": float(mean_val),
                    "std": float(std_val),
                    "threshold": factor,
                    "count": len(values),
                }

                outlier_mask = (z_scores > factor) | (z_scores < -factor)
                outlier_mask = pd.Series(outlier_mask, index=group.index)

            outliers = group[outlier_mask]
            for idx, row in outliers.iterrows():
                failures.append(SampleFailure(
                    sample_id=str(row.get("sample_id", "unknown")),
                    parameter=parameter,
                    sample_type=str(row.get("sample_type", "unknown")),
                    failure_type="outlier_detected",
                    rule_name=f"异常值检测 ({method.upper()})",
                    message=f"检测值 {row['value']:.4f} 被识别为异常值",
                    value=float(row["value"]),
                    expected_range=(float(lower_bound), float(upper_bound)) if method == "iqr" else None,
                    affected_indices=[idx],
                    raw_data={"method": method},
                ))

        passed = len(failures) == 0
        check = QCCheck(
            rule_name="异常值检测",
            sample_type="all",
            parameter="all",
            passed=passed,
            failures=failures,
            calculation_log=calculation_log,
        )

        return check, failures

    def _calculate_statistics(self, df: pd.DataFrame, failures: List[SampleFailure]) -> Dict[str, Any]:
        """计算统计数据"""
        stats_data: Dict[str, Any] = {}

        if "sample_type" in df.columns:
            stats_data["sample_type_counts"] = df["sample_type"].value_counts().to_dict()

        if "parameter" in df.columns:
            parameter_stats = {}
            for parameter, group in df.groupby("parameter"):
                vals = group["value"].dropna()
                if len(vals) > 0:
                    parameter_stats[parameter] = {
                        "count": len(vals),
                        "mean": float(vals.mean()),
                        "median": float(vals.median()),
                        "std": float(vals.std()) if len(vals) > 1 else 0,
                        "min": float(vals.min()),
                        "max": float(vals.max()),
                        "range": float(vals.max() - vals.min()),
                    }
            stats_data["parameter_statistics"] = parameter_stats

        return stats_data

    def _generate_qc_summary(self, checks: List[QCCheck], failures: List[SampleFailure]) -> Dict[str, Any]:
        """生成质控摘要"""
        summary: Dict[str, Any] = {
            "total_checks": len(checks),
            "passed_checks": sum(1 for c in checks if c.passed),
            "failed_checks": sum(1 for c in checks if not c.passed),
            "total_failures": len(failures),
            "check_details": [],
        }

        for check in checks:
            summary["check_details"].append({
                "rule_name": check.rule_name,
                "sample_type": check.sample_type,
                "passed": check.passed,
                "failure_count": len(check.failures),
            })

        return summary

    def _build_valid_mask(self, df: pd.DataFrame, failures: List[SampleFailure]) -> pd.Series:
        """构建有效样本掩码"""
        valid_mask = pd.Series(True, index=df.index)

        for failure in failures:
            for idx in failure.affected_indices:
                if idx in valid_mask.index:
                    valid_mask[idx] = False

        return valid_mask
