from datetime import datetime, timedelta

from blade_review.gap_detector import GapDetector
from blade_review.models import BladeReport, InspectionRecord, ReviewStatus


def _make_record(blade_id="B001", ts=None, value=1.0):
    return InspectionRecord(
        blade_id=blade_id,
        timestamp=ts or datetime.now(),
        value=value,
        metric_name="vibration",
    )


def _make_report(records=None):
    report = BladeReport(title="风机叶片报告复核", blade_ids=["B001"])
    if records:
        report.records = records
    return report


class TestGapDetectorDetect:
    def test_no_gap_returns_empty(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=12)),
        ]
        gaps = detector.detect_gaps(records)
        assert len(gaps) == 0

    def test_gap_detected(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=48)),
        ]
        gaps = detector.detect_gaps(records)
        assert len(gaps) == 1
        assert gaps[0].severity == "major"

    def test_critical_gap(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=100)),
        ]
        gaps = detector.detect_gaps(records)
        assert len(gaps) == 1
        assert gaps[0].severity == "critical"

    def test_single_record_no_gap(self):
        detector = GapDetector(max_gap_hours=24)
        records = [_make_record()]
        gaps = detector.detect_gaps(records)
        assert len(gaps) == 0


class TestGapDetectorSuspend:
    def test_gap_causes_suspension(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=48)),
        ]
        report = _make_report(records=records)
        suspensions = detector.check_and_suspend(report)
        assert len(suspensions) == 1
        assert report.status == ReviewStatus.SUSPENDED

    def test_no_gap_no_suspension(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=12)),
        ]
        report = _make_report(records=records)
        suspensions = detector.check_and_suspend(report)
        assert len(suspensions) == 0
        assert report.status == ReviewStatus.PENDING


class TestGapDetectorResolve:
    def test_resolve_unsuspends_when_all_resolved(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=48)),
        ]
        report = _make_report(records=records)
        suspensions = detector.check_and_suspend(report)
        assert report.status == ReviewStatus.SUSPENDED

        sid = suspensions[0].suspension_id
        ok = detector.resolve_suspension(report, sid, "现场老师", "确认数据有效")
        assert ok is True
        assert report.status == ReviewStatus.IN_REVIEW

    def test_partial_resolve_stays_suspended(self):
        detector = GapDetector(max_gap_hours=24)
        ts = datetime(2026, 6, 10, 10, 0, 0)
        records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=48)),
            _make_record(ts=ts + timedelta(hours=100)),
        ]
        report = _make_report(records=records)
        suspensions = detector.check_and_suspend(report)
        assert len(suspensions) == 2

        sid = suspensions[0].suspension_id
        detector.resolve_suspension(report, sid, "老师A", "确认")
        assert report.status == ReviewStatus.SUSPENDED
