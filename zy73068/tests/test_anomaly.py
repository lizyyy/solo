from datetime import datetime, timedelta

from blade_review.anomaly import AnomalyDetector
from blade_review.models import BladeReport, InspectionRecord


def _rec(blade_id="B001", metric="vibration", value=1.0, offset_hours=0):
    return InspectionRecord(
        blade_id=blade_id,
        metric_name=metric,
        value=value,
        timestamp=datetime(2026, 6, 10, 10, 0, 0) + timedelta(hours=offset_hours),
    )


class TestAnomalyDetector:
    def test_no_anomaly_clean_series(self):
        det = AnomalyDetector()
        report = BladeReport(blade_ids=["B001"])
        for i in range(8):
            report.records.append(_rec(offset_hours=i * 2))
        ar = det.detect(report)
        assert ar.is_stable is True
        assert len(ar.anomalies) == 0

    def test_single_point_spike(self):
        det = AnomalyDetector()
        report = BladeReport(blade_ids=["B001"])
        values = [1.0, 1.02, 0.98, 1.01, 8.0, 0.99, 1.03, 1.0]
        for i, v in enumerate(values):
            report.records.append(_rec(offset_hours=i * 2, value=v))
        ar = det.detect(report)
        kinds = [a.kind for a in ar.anomalies]
        assert "single_point_spike" in kinds
        spike = next(a for a in ar.anomalies if a.kind == "single_point_spike")
        assert spike.value == 8.0

    def test_mean_masked_anomaly_cross_blade(self):
        det = AnomalyDetector()
        report = BladeReport(blade_ids=["B001", "B002"])
        for i in range(6):
            report.records.append(_rec(blade_id="B001", offset_hours=i * 2, value=1.0 + i * 0.01))
            report.records.append(_rec(blade_id="B002", offset_hours=i * 2, value=5.0 + i * 0.01))
        ar = det.detect(report)
        kinds = [a.kind for a in ar.anomalies]
        assert "mean_masked_anomaly" in kinds

    def test_sampling_gap(self):
        det = AnomalyDetector()
        report = BladeReport(blade_ids=["B001"])
        report.records.append(_rec(offset_hours=0))
        report.records.append(_rec(offset_hours=100))
        ar = det.detect(report, gap_hours=24)
        kinds = [a.kind for a in ar.anomalies]
        assert "sampling_gap" in kinds
        assert ar.is_stable is False
        assert "待确认" in ar.conclusion
