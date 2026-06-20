from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from .models import BladeReport, InspectionRecord


@dataclass
class Anomaly:
    kind: str = ""
    blade_id: str = ""
    metric_name: str = ""
    timestamp: Optional[datetime] = None
    value: float = 0.0
    explanation: str = ""
    severity: str = "minor"


@dataclass
class AnomalyReport:
    anomalies: list[Anomaly] = field(default_factory=list)
    conclusion: str = ""
    is_stable: bool = True

    def has_blocking(self) -> bool:
        return any(a.severity in ("major", "critical") for a in self.anomalies)


class AnomalyDetector:
    SPIKE_Z_THRESHOLD = 3.0
    GROUP_DEVIATION_RATIO = 0.5

    def detect(self, report: BladeReport, gap_hours: float = 24.0) -> AnomalyReport:
        anomalies: list[Anomaly] = []
        gaps = self._detect_sampling_gaps(report.records, gap_hours)
        anomalies.extend(gaps)
        spikes = self._detect_single_point_spikes(report.records)
        anomalies.extend(spikes)
        masked = self._detect_mean_masked_anomaly(report.records)
        anomalies.extend(masked)

        has_gap = bool(gaps)
        if has_gap:
            conclusion = "采样断档，结论待确认（不可出具稳定结论）"
            is_stable = False
        elif anomalies:
            blocking = [a for a in anomalies if a.severity in ("major", "critical")]
            if blocking:
                conclusion = f"发现 {len(blocking)} 项严重异常，需现场确认"
                is_stable = False
            else:
                conclusion = f"发现 {len(anomalies)} 项提示性异常，建议复核"
                is_stable = True
        else:
            conclusion = "数据连续，未发现异常，可出具稳定结论"
            is_stable = True

        return AnomalyReport(anomalies=anomalies, conclusion=conclusion, is_stable=is_stable)

    def _detect_sampling_gaps(
        self, records: list[InspectionRecord], gap_hours: float
    ) -> list[Anomaly]:
        if len(records) < 2:
            return []
        sorted_recs = sorted(records, key=lambda r: r.timestamp)
        max_gap = timedelta(hours=gap_hours)
        out: list[Anomaly] = []
        for i in range(1, len(sorted_recs)):
            prev = sorted_recs[i - 1]
            curr = sorted_recs[i]
            delta = curr.timestamp - prev.timestamp
            if delta > max_gap:
                hours = delta.total_seconds() / 3600
                severity = "critical" if hours > gap_hours * 3 else "major"
                out.append(
                    Anomaly(
                        kind="sampling_gap",
                        blade_id=curr.blade_id,
                        metric_name=curr.metric_name,
                        timestamp=curr.timestamp,
                        value=curr.value,
                        explanation=(
                            f"采样断档 {hours:.1f}h "
                            f"({prev.timestamp.isoformat()} -> {curr.timestamp.isoformat()})，"
                            f"均值无法补全，结论须挂起待现场确认"
                        ),
                        severity=severity,
                    )
                )
        return out

    def _detect_single_point_spikes(
        self, records: list[InspectionRecord]
    ) -> list[Anomaly]:
        groups = self._group_by_blade_metric(records)
        out: list[Anomaly] = []
        for (blade_id, metric), recs in groups.items():
            if len(recs) < 4:
                continue
            values = [r.value for r in recs]
            median = statistics.median(values)
            mad = statistics.median([abs(v - median) for v in values]) or 1e-9
            for r in recs:
                z = abs(r.value - median) / (1.4826 * mad)
                if z >= self.SPIKE_Z_THRESHOLD:
                    out.append(
                        Anomaly(
                            kind="single_point_spike",
                            blade_id=blade_id,
                            metric_name=metric,
                            timestamp=r.timestamp,
                            value=r.value,
                            explanation=(
                                f"单点突变：值 {r.value} 偏离中位数 {median:.3f} "
                                f"(稳健z={z:.2f})，被序列均值掩盖"
                            ),
                            severity="major",
                        )
                    )
        return out

    def _detect_mean_masked_anomaly(
        self, records: list[InspectionRecord]
    ) -> list[Anomaly]:
        groups = self._group_by_blade_metric(records)
        metric_to_blades: dict[str, list[tuple[str, float, list[float]]]] = {}
        for (blade_id, metric), recs in groups.items():
            if len(recs) < 2:
                continue
            values = [r.value for r in recs]
            mean = statistics.mean(values)
            metric_to_blades.setdefault(metric, []).append((blade_id, mean, values))

        out: list[Anomaly] = []
        for metric, entries in metric_to_blades.items():
            if len(entries) < 2:
                continue
            overall = statistics.mean([m for _, m, _ in entries])
            for blade_id, mean, values in entries:
                if overall == 0:
                    continue
                ratio = abs(mean - overall) / abs(overall)
                if ratio >= self.GROUP_DEVIATION_RATIO:
                    worst = max(values, key=lambda v: abs(v - overall))
                    out.append(
                        Anomaly(
                            kind="mean_masked_anomaly",
                            blade_id=blade_id,
                            metric_name=metric,
                            value=mean,
                            explanation=(
                                f"局部异常被均值掩盖：{blade_id} 均值 {mean:.3f} "
                                f"偏离整体均值 {overall:.3f} ({ratio:.0%})，"
                                f"最差点位值 {worst}；整体均值看似正常"
                            ),
                            severity="major",
                        )
                    )
        return out

    @staticmethod
    def _group_by_blade_metric(
        records: list[InspectionRecord],
    ) -> dict[tuple[str, str], list[InspectionRecord]]:
        groups: dict[tuple[str, str], list[InspectionRecord]] = {}
        for r in records:
            key = (r.blade_id, r.metric_name)
            groups.setdefault(key, []).append(r)
        return groups
