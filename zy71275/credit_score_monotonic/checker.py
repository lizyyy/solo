from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from .models import (
    AnomalyFlag,
    BinRecord,
    FeatureCheckResult,
    MonotonicDirection,
    Severity,
    Violation,
    WeightInterpretation,
    compute_config_hash,
    compute_input_hash,
)


@dataclass(frozen=True)
class CheckConfig:
    min_sample_size: int = 50
    monotonic_direction: MonotonicDirection = MonotonicDirection.AUTO
    bad_rate_tolerance: float = 0.005
    missing_bin_threshold: float = 0.05

    def to_dict(self) -> dict:
        return {
            "min_sample_size": self.min_sample_size,
            "monotonic_direction": self.monotonic_direction.value,
            "bad_rate_tolerance": self.bad_rate_tolerance,
            "missing_bin_threshold": self.missing_bin_threshold,
        }


class MonotonicChecker:
    def __init__(self, config: Optional[CheckConfig] = None):
        self.config = config or CheckConfig()

    def check_feature(
        self,
        feature_name: str,
        model_version: str,
        bins: List[BinRecord],
    ) -> FeatureCheckResult:
        ordered_bins = list(bins)

        violations = self._detect_violations(ordered_bins)
        anomaly_flags = self._detect_anomalies(ordered_bins)

        detected_direction = self._detect_direction(ordered_bins)
        weight_interp = self._interpret_weights(ordered_bins, detected_direction)

        total_samples = sum(b.total_count for b in ordered_bins)
        total_bad = sum(b.bad_count for b in ordered_bins)
        overall_bad_rate = total_bad / total_samples if total_samples > 0 else 0.0

        overall_severity = self._determine_severity(violations, anomaly_flags)

        return FeatureCheckResult(
            feature_name=feature_name,
            model_version=model_version,
            bins=ordered_bins,
            detected_direction=detected_direction,
            overall_severity=overall_severity,
            violations=violations,
            anomaly_flags=anomaly_flags,
            weight_interpretation=weight_interp,
            total_samples=total_samples,
            total_bad=total_bad,
            overall_bad_rate=overall_bad_rate,
        )

    def check(
        self,
        feature_bins: Dict[str, List[BinRecord]],
        model_version: str,
    ) -> "CheckReport":
        from .models import CheckReport

        results: List[FeatureCheckResult] = []
        for feature_name in sorted(feature_bins.keys()):
            result = self.check_feature(
                feature_name=feature_name,
                model_version=model_version,
                bins=feature_bins[feature_name],
            )
            results.append(result)

        overall_pass = all(r.overall_severity != Severity.FAIL for r in results)

        input_hash = compute_input_hash(feature_bins, model_version)
        config_hash = compute_config_hash(self.config.to_dict())

        from datetime import datetime, timezone

        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        from .report import ReportGenerator

        summary = ReportGenerator.generate_summary(results, overall_pass)

        return CheckReport(
            model_version=model_version,
            check_timestamp=timestamp,
            input_hash=input_hash,
            config_hash=config_hash,
            results=results,
            overall_pass=overall_pass,
            summary=summary,
        )

    def _detect_direction(self, bins: List[BinRecord]) -> MonotonicDirection:
        if self.config.monotonic_direction != MonotonicDirection.AUTO:
            return self.config.monotonic_direction

        non_missing = [b for b in bins if not b.is_missing]
        if len(non_missing) < 2:
            return MonotonicDirection.ASCENDING

        bad_rates = [b.bad_rate for b in non_missing]
        asc_violations = sum(
            1 for i in range(1, len(bad_rates)) if bad_rates[i] < bad_rates[i - 1]
        )
        desc_violations = sum(
            1 for i in range(1, len(bad_rates)) if bad_rates[i] > bad_rates[i - 1]
        )

        if asc_violations <= desc_violations:
            return MonotonicDirection.ASCENDING
        return MonotonicDirection.DESCENDING

    def _detect_violations(self, bins: List[BinRecord]) -> List[Violation]:
        violations: List[Violation] = []
        non_missing = [(i, b) for i, b in enumerate(bins) if not b.is_missing]

        if len(non_missing) < 2:
            return violations

        direction = self._detect_direction(bins)

        for idx in range(1, len(non_missing)):
            prev_i, prev_bin = non_missing[idx - 1]
            curr_i, curr_bin = non_missing[idx]

            prev_rate = prev_bin.bad_rate
            curr_rate = curr_bin.bad_rate
            tolerance = self.config.bad_rate_tolerance

            is_violation = False
            reason = ""

            if direction == MonotonicDirection.ASCENDING:
                if curr_rate < prev_rate - tolerance:
                    is_violation = True
                    reason = (
                        f"单调递增约束违反: 箱[{prev_bin.bin_name}]坏账率{prev_rate:.4f} "
                        f"> 箱[{curr_bin.bin_name}]坏账率{curr_rate:.4f}, "
                        f"差值={prev_rate - curr_rate:.4f}"
                    )
            elif direction == MonotonicDirection.DESCENDING:
                if curr_rate > prev_rate + tolerance:
                    is_violation = True
                    reason = (
                        f"单调递减约束违反: 箱[{prev_bin.bin_name}]坏账率{prev_rate:.4f} "
                        f"< 箱[{curr_bin.bin_name}]坏账率{curr_rate:.4f}, "
                        f"差值={curr_rate - prev_rate:.4f}"
                    )

            if is_violation:
                severity = self._classify_violation_severity(
                    prev_rate, curr_rate, direction
                )
                violations.append(
                    Violation(
                        bin_index=curr_i,
                        bin_name=curr_bin.bin_name,
                        prev_bin_index=prev_i,
                        prev_bin_name=prev_bin.bin_name,
                        bad_rate=curr_rate,
                        prev_bad_rate=prev_rate,
                        severity=severity,
                        reason=reason,
                    )
                )

        return violations

    def _classify_violation_severity(
        self,
        prev_rate: float,
        curr_rate: float,
        direction: MonotonicDirection,
    ) -> Severity:
        if direction == MonotonicDirection.ASCENDING:
            delta = prev_rate - curr_rate
        else:
            delta = curr_rate - prev_rate

        if delta > 0.05:
            return Severity.FAIL
        return Severity.WARNING

    def _detect_anomalies(self, bins: List[BinRecord]) -> List[AnomalyFlag]:
        flags: List[AnomalyFlag] = []
        total_samples = sum(b.total_count for b in bins)

        for i, b in enumerate(bins):
            if b.total_count < self.config.min_sample_size:
                flags.append(
                    AnomalyFlag(
                        bin_index=i,
                        bin_name=b.bin_name,
                        flag_type="LOW_SAMPLE",
                        detail=(
                            f"样本量{b.total_count}低于阈值{self.config.min_sample_size}, "
                            f"坏账率{b.bad_rate:.4f}可能不稳定"
                        ),
                        severity=Severity.WARNING,
                    )
                )

            if b.is_missing:
                proportion = b.total_count / total_samples if total_samples > 0 else 0
                proportion_pct = proportion * 100
                if proportion > self.config.missing_bin_threshold:
                    flags.append(
                        AnomalyFlag(
                            bin_index=i,
                            bin_name=b.bin_name,
                            flag_type="HIGH_MISSING_RATIO",
                            detail=(
                                f"缺失箱占比{proportion_pct:.1f}%超过阈值"
                                f"{self.config.missing_bin_threshold * 100:.1f}%, "
                                f"样本量{b.total_count}"
                            ),
                            severity=Severity.FAIL,
                        )
                    )
                else:
                    flags.append(
                        AnomalyFlag(
                            bin_index=i,
                            bin_name=b.bin_name,
                            flag_type="MISSING_BIN",
                            detail=(
                                f"缺失箱占比{proportion_pct:.1f}%, "
                                f"样本量{b.total_count}, 坏账率{b.bad_rate:.4f}"
                            ),
                            severity=Severity.WARNING,
                        )
                    )

            if b.total_count == 0:
                flags.append(
                    AnomalyFlag(
                        bin_index=i,
                        bin_name=b.bin_name,
                        flag_type="EMPTY_BIN",
                        detail=f"箱[{b.bin_name}]样本量为0, 无法计算坏账率",
                        severity=Severity.FAIL,
                    )
                )

        return flags

    def _interpret_weights(
        self,
        bins: List[BinRecord],
        direction: MonotonicDirection,
    ) -> WeightInterpretation:
        non_missing = [b for b in bins if not b.is_missing]

        if len(non_missing) < 2:
            return WeightInterpretation(
                direction_aligned=True,
                weight_order=[b.bin_name for b in non_missing],
                risk_order=[b.bin_name for b in non_missing],
                explanation="非缺失箱不足2个, 无法判断权重与风险排序是否一致",
            )

        risk_sorted = sorted(non_missing, key=lambda b: b.bad_rate)
        weight_sorted = sorted(non_missing, key=lambda b: b.score_weight)

        risk_order = [b.bin_name for b in risk_sorted]
        weight_order = [b.bin_name for b in weight_sorted]

        weight_vals = {b.bin_name: b.score_weight for b in non_missing}

        direction_aligned = all(
            weight_vals[risk_sorted[i].bin_name]
            <= weight_vals[risk_sorted[i + 1].bin_name]
            for i in range(len(risk_sorted) - 1)
        )

        if direction_aligned:
            explanation = (
                "权重排序与风险排序一致: "
                "坏账率越高的箱, 评分权重越高, 高风险客群未被赋予更优评分"
            )
        else:
            explanation = (
                "⚠️ 权重排序与风险排序不一致: "
                "存在高风险客群获得更优(更低)评分权重的情况, "
                "需重新审视分箱或权重分配"
            )

        return WeightInterpretation(
            direction_aligned=direction_aligned,
            weight_order=weight_order,
            risk_order=risk_order,
            explanation=explanation,
        )

    def _determine_severity(
        self,
        violations: List[Violation],
        anomaly_flags: List[AnomalyFlag],
    ) -> Severity:
        if any(v.severity == Severity.FAIL for v in violations):
            return Severity.FAIL
        if any(a.severity == Severity.FAIL for a in anomaly_flags):
            return Severity.FAIL
        if violations or anomaly_flags:
            return Severity.WARNING
        return Severity.PASS
