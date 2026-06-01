import math
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from .config import ParameterManager
from .estimator import HoleSample


class AnomalyDetector:
    def __init__(self, param_manager: ParameterManager):
        self.pm = param_manager

    def detect(self, samples: List[HoleSample]) -> List[HoleSample]:
        areas = [s.estimated_area for s in samples if s.estimated_area is not None]

        if not areas:
            return samples

        stats = self._calculate_statistics(areas)

        for sample in samples:
            self._detect_single(sample, stats)

        self._detect_boundary_samples(samples)
        return samples

    def _calculate_statistics(self, values: List[float]) -> Dict[str, float]:
        n = len(values)
        mean = sum(values) / n
        variance = sum((x - mean) ** 2 for x in values) / n
        std = math.sqrt(variance)

        sorted_vals = sorted(values)
        median = sorted_vals[n // 2] if n % 2 else (sorted_vals[n//2 - 1] + sorted_vals[n//2]) / 2

        q1 = sorted_vals[int(n * 0.25)]
        q3 = sorted_vals[int(n * 0.75)]
        iqr = q3 - q1

        return {
            "mean": mean,
            "median": median,
            "std": std,
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "min": min(values),
            "max": max(values),
            "count": n
        }

    def _detect_single(self, sample: HoleSample, stats: Dict[str, float]) -> None:
        if sample.estimated_area is None:
            sample.is_anomaly = True
            sample.anomaly_reasons.append("无法估算面积，缺少必要的几何数据")
            return

        area = sample.estimated_area
        reasons = []

        z_threshold = self.pm.get("hole_area_estimation.outlier_z_score_threshold")
        if stats["std"] > 0:
            z_score = abs(area - stats["mean"]) / stats["std"]
            if z_score > z_threshold:
                reasons.append(
                    f"Z分数 {z_score:.2f} 超过阈值 {z_threshold} "
                    f"(均值={stats['mean']:.2f}, 标准差={stats['std']:.2f})"
                )

        iqr_mult = self.pm.get("anomaly_detection.iqr_multiplier")
        lower_bound = stats["q1"] - iqr_mult * stats["iqr"]
        upper_bound = stats["q3"] + iqr_mult * stats["iqr"]

        if area < lower_bound:
            reasons.append(
                f"面积 {area:.2f} 低于IQR下界 {lower_bound:.2f} "
                f"(Q1={stats['q1']:.2f}, IQR={stats['iqr']:.2f})"
            )
        elif area > upper_bound:
            reasons.append(
                f"面积 {area:.2f} 高于IQR上界 {upper_bound:.2f} "
                f"(Q3={stats['q3']:.2f}, IQR={stats['iqr']:.2f})"
            )

        min_area = self.pm.get("hole_area_estimation.min_hole_area")
        max_area = self.pm.get("hole_area_estimation.max_hole_area")

        if area < min_area:
            reasons.append(
                f"面积 {area:.2f} 低于业务最小阈值 {min_area:.2f}"
            )
        elif area > max_area:
            reasons.append(
                f"面积 {area:.2f} 高于业务最大阈值 {max_area:.2f}"
            )

        quality = sample.raw_data.get("quality_score", 1.0)
        if quality < 0.3:
            reasons.append(
                f"数据质量分数 {quality:.2f} 过低 (阈值=0.3)"
            )

        sample.is_anomaly = len(reasons) > 0
        sample.anomaly_reasons = reasons
        sample.metadata["statistics_context"] = {
            "z_score": (area - stats["mean"]) / stats["std"] if stats["std"] > 0 else 0,
            "percentile": self._percentile(area, stats)
        }

    def _percentile(self, value: float, stats: Dict[str, float]) -> float:
        if stats["std"] == 0:
            return 50.0
        z = (value - stats["mean"]) / stats["std"]
        return 50 * (1 + math.erf(z / math.sqrt(2)))

    def _detect_boundary_samples(self, samples: List[HoleSample]) -> None:
        if not self.pm.get("anomaly_detection.flag_boundary_samples"):
            return

        threshold = self.pm.get("hole_area_estimation.boundary_sample_threshold")
        if len(samples) < threshold:
            for sample in samples:
                if not sample.is_anomaly:
                    sample.metadata["is_boundary"] = True
                    sample.anomaly_reasons.append(
                        f"样本量不足 (n={len(samples)} < 阈值={threshold})，"
                        f"结果可能存在偏差，建议人工复核"
                    )
                    sample.is_anomaly = True

    def get_anomaly_summary(self, samples: List[HoleSample]) -> Dict[str, Any]:
        anomalies = [s for s in samples if s.is_anomaly]
        normal = [s for s in samples if not s.is_anomaly]

        reason_counts: Dict[str, int] = defaultdict(int)
        for s in anomalies:
            for reason in s.anomaly_reasons:
                reason_counts[reason] += 1

        return {
            "total_samples": len(samples),
            "anomaly_count": len(anomalies),
            "normal_count": len(normal),
            "anomaly_rate": len(anomalies) / len(samples) if samples else 0,
            "anomaly_samples": [
                {
                    "sample_id": s.sample_id,
                    "estimated_area": s.estimated_area,
                    "manual_override": s.manual_override,
                    "final_area": s.manual_override if s.manual_override is not None else s.estimated_area,
                    "reasons": s.anomaly_reasons,
                    "source": s.source,
                    "processed_at": s.processed_at
                }
                for s in anomalies
            ],
            "reason_distribution": dict(reason_counts),
            "areas": {
                "min": min((s.estimated_area for s in samples if s.estimated_area is not None), default=None),
                "max": max((s.estimated_area for s in samples if s.estimated_area is not None), default=None),
                "mean": sum((s.estimated_area for s in samples if s.estimated_area is not None), 0.0) / max(1, sum(1 for s in samples if s.estimated_area is not None))
            }
        }
