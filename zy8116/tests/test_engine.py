"""Tests for VisitWindowEngine - window calculation and deviation detection."""

from datetime import date

import pytest

from ctv_monitor.core import (
    Amendment,
    DeviationType,
    ProtocolWindow,
    Subject,
    Visit,
)
from ctv_monitor.engine import VisitWindowEngine


class TestVisitWindowEngine:
    """Tests for VisitWindowEngine class."""

    def create_basic_setup(self):
        """Create a basic test setup with one subject and visits."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
            protocol_version_at_enrollment="1.0",
        )
        
        windows_v1 = [
            ProtocolWindow(
                visit_name="Screening",
                protocol_version="1.0",
                target_days=0,
                window_early_days=7,
                window_late_days=0,
                is_mandatory=True,
            ),
            ProtocolWindow(
                visit_name="Day 1",
                protocol_version="1.0",
                target_days=0,
                window_early_days=0,
                window_late_days=0,
                is_mandatory=True,
            ),
            ProtocolWindow(
                visit_name="Day 7",
                protocol_version="1.0",
                target_days=7,
                window_early_days=1,
                window_late_days=1,
                is_mandatory=True,
            ),
            ProtocolWindow(
                visit_name="Day 14",
                protocol_version="1.0",
                target_days=14,
                window_early_days=2,
                window_late_days=2,
                is_mandatory=True,
            ),
        ]
        
        return subject, windows_v1

    def test_get_applicable_protocol_version_no_amendments(self):
        """Test protocol version when no amendments exist."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
            protocol_version_at_enrollment="1.0",
        )
        
        window = ProtocolWindow(
            visit_name="Day 1",
            protocol_version="1.0",
            target_days=0,
            window_early_days=0,
            window_late_days=0,
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[],
            protocol_windows={"1.0": [window]},
            amendments=[],
        )
        
        version = engine.get_applicable_protocol_version(subject)
        assert version == "1.0"

    def test_get_applicable_protocol_version_with_amendment(self):
        """Test protocol version when subject is enrolled after amendment."""
        amendment = Amendment(
            amendment_id="AM-001",
            protocol_version="2.0",
            effective_date=date(2026, 1, 20),
            effective_tz="UTC",
        )
        
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 25),
            enrollment_tz="UTC",
            protocol_version_at_enrollment="1.0",
        )
        
        window = ProtocolWindow(
            visit_name="Day 1",
            protocol_version="2.0",
            target_days=0,
            window_early_days=0,
            window_late_days=0,
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[],
            protocol_windows={"2.0": [window]},
            amendments=[amendment],
        )
        
        version = engine.get_applicable_protocol_version(subject)
        assert version == "2.0"

    def test_get_applicable_protocol_version_before_amendment(self):
        """Test protocol version when subject is enrolled before amendment."""
        amendment = Amendment(
            amendment_id="AM-001",
            protocol_version="2.0",
            effective_date=date(2026, 1, 20),
            effective_tz="UTC",
        )
        
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
            protocol_version_at_enrollment="1.0",
        )
        
        window = ProtocolWindow(
            visit_name="Day 1",
            protocol_version="1.0",
            target_days=0,
            window_early_days=0,
            window_late_days=0,
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[],
            protocol_windows={"1.0": [window]},
            amendments=[amendment],
        )
        
        version = engine.get_applicable_protocol_version(subject)
        assert version == "1.0"

    def test_calculate_visit_window(self):
        """Test calculation of visit window dates."""
        subject, windows = self.create_basic_setup()
        day7_window = next(w for w in windows if w.visit_name == "Day 7")
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[],
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        target_date, early_bound, late_bound = engine.calculate_visit_window(
            subject, day7_window
        )
        
        assert target_date == date(2026, 1, 22)
        assert early_bound == date(2026, 1, 21)
        assert late_bound == date(2026, 1, 23)

    def test_check_visit_in_window_on_time(self):
        """Test visit that falls exactly within window."""
        subject, windows = self.create_basic_setup()
        day7_window = next(w for w in windows if w.visit_name == "Day 7")
        
        visit = Visit(
            subject_id="S001",
            visit_name="Day 7",
            visit_date=date(2026, 1, 22),
            visit_timezone="UTC",
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[visit],
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        deviation = engine.check_visit_in_window(subject, visit, day7_window)
        assert deviation is None

    def test_check_visit_in_window_early(self):
        """Test visit that is early."""
        subject, windows = self.create_basic_setup()
        day7_window = next(w for w in windows if w.visit_name == "Day 7")
        
        visit = Visit(
            subject_id="S001",
            visit_name="Day 7",
            visit_date=date(2026, 1, 20),
            visit_timezone="UTC",
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[visit],
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        deviation = engine.check_visit_in_window(subject, visit, day7_window)
        assert deviation is not None
        assert deviation.deviation_type == DeviationType.EARLY_VISIT
        assert deviation.days_off_target == -2

    def test_check_visit_in_window_late(self):
        """Test visit that is late."""
        subject, windows = self.create_basic_setup()
        day7_window = next(w for w in windows if w.visit_name == "Day 7")
        
        visit = Visit(
            subject_id="S001",
            visit_name="Day 7",
            visit_date=date(2026, 1, 25),
            visit_timezone="UTC",
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[visit],
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        deviation = engine.check_visit_in_window(subject, visit, day7_window)
        assert deviation is not None
        assert deviation.deviation_type == DeviationType.LATE_VISIT
        assert deviation.days_off_target == 3

    def test_check_duplicate_visits(self):
        """Test detection of duplicate visits."""
        subject, windows = self.create_basic_setup()
        
        visits = [
            Visit(
                subject_id="S001",
                visit_name="Day 7",
                visit_date=date(2026, 1, 22),
                visit_timezone="UTC",
            ),
            Visit(
                subject_id="S001",
                visit_name="Day 7",
                visit_date=date(2026, 1, 22),
                visit_timezone="UTC",
            ),
        ]
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=visits,
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        deviations = engine.check_duplicate_visits(visits)
        assert len(deviations) == 1
        assert deviations[0].deviation_type == DeviationType.DUPLICATE_VISIT

    def test_check_same_day_multiple_visits(self):
        """Test detection of multiple different visits on same day."""
        subject, windows = self.create_basic_setup()
        
        visits = [
            Visit(
                subject_id="S001",
                visit_name="Screening",
                visit_date=date(2026, 1, 15),
                visit_timezone="UTC",
            ),
            Visit(
                subject_id="S001",
                visit_name="Day 1",
                visit_date=date(2026, 1, 15),
                visit_timezone="UTC",
            ),
        ]
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=visits,
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        deviations = engine.check_same_day_multiple_visits(visits)
        assert len(deviations) == 1
        assert deviations[0].deviation_type == DeviationType.SAME_DAY_MULTIPLE_VISITS

    def test_check_missed_visits_explicit_missed(self):
        """Test detection of explicitly marked missed visits."""
        subject, windows = self.create_basic_setup()
        
        visits = [
            Visit(
                subject_id="S001",
                visit_name="Day 7",
                visit_date=date(2026, 1, 22),
                visit_timezone="UTC",
                is_missed=True,
            ),
        ]
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=visits,
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        reference_date = date(2026, 2, 1)
        deviations = engine.check_missed_visits(subject, visits, reference_date)
        
        missed_visits = [d for d in deviations if d.deviation_type == DeviationType.MISSED_VISIT]
        assert len(missed_visits) >= 1
        assert any("explicitly marked" in d.description for d in missed_visits)

    def test_check_missed_visits_past_window(self):
        """Test detection of visits that are past their window and not recorded."""
        subject, windows = self.create_basic_setup()
        
        visits = []
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=visits,
            protocol_windows={"1.0": windows},
            amendments=[],
        )
        
        reference_date = date(2026, 2, 1)
        deviations = engine.check_missed_visits(subject, visits, reference_date)
        
        missed_visits = [d for d in deviations if d.deviation_type == DeviationType.MISSED_VISIT]
        assert len(missed_visits) >= 1

    def test_check_amendment_crossing(self):
        """Test detection of visit window spanning amendment date."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
            protocol_version_at_enrollment="1.0",
        )
        
        amendment = Amendment(
            amendment_id="AM-001",
            protocol_version="2.0",
            effective_date=date(2026, 1, 28),
            effective_tz="UTC",
        )
        
        windows_v1 = [
            ProtocolWindow(
                visit_name="Day 14",
                protocol_version="1.0",
                target_days=14,
                window_early_days=2,
                window_late_days=2,
                is_mandatory=True,
            ),
        ]
        
        visit = Visit(
            subject_id="S001",
            visit_name="Day 14",
            visit_date=date(2026, 1, 29),
            visit_timezone="UTC",
        )
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=[visit],
            protocol_windows={"1.0": windows_v1},
            amendments=[amendment],
        )
        
        deviation = engine.check_amendment_crossing(subject, visit, windows_v1[0])
        assert deviation is not None
        assert deviation.deviation_type == DeviationType.AMENDMENT_CROSSING
        assert deviation.amendment_id == "AM-001"

    def test_full_analysis_with_deviations(self):
        """Test full analysis with various deviation scenarios."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
            protocol_version_at_enrollment="1.0",
        )
        
        windows_v1 = [
            ProtocolWindow(
                visit_name="Screening",
                protocol_version="1.0",
                target_days=0,
                window_early_days=7,
                window_late_days=0,
                is_mandatory=True,
            ),
            ProtocolWindow(
                visit_name="Day 1",
                protocol_version="1.0",
                target_days=0,
                window_early_days=0,
                window_late_days=0,
                is_mandatory=True,
            ),
            ProtocolWindow(
                visit_name="Day 7",
                protocol_version="1.0",
                target_days=7,
                window_early_days=1,
                window_late_days=1,
                is_mandatory=True,
            ),
        ]
        
        visits = [
            Visit(
                subject_id="S001",
                visit_name="Screening",
                visit_date=date(2026, 1, 15),
                visit_timezone="UTC",
            ),
            Visit(
                subject_id="S001",
                visit_name="Day 1",
                visit_date=date(2026, 1, 15),
                visit_timezone="UTC",
            ),
            Visit(
                subject_id="S001",
                visit_name="Day 7",
                visit_date=date(2026, 1, 20),
                visit_timezone="UTC",
            ),
        ]
        
        engine = VisitWindowEngine(
            subjects=[subject],
            visits=visits,
            protocol_windows={"1.0": windows_v1},
            amendments=[],
        )
        
        reference_date = date(2026, 1, 25)
        deviations = engine.run_analysis(reference_date=reference_date)
        
        early_visits = [d for d in deviations if d.deviation_type == DeviationType.EARLY_VISIT]
        assert len(early_visits) == 1
        assert early_visits[0].visit_name == "Day 7"

    def test_get_deviations_by_site(self):
        """Test grouping deviations by site."""
        subjects = [
            Subject(
                subject_id="S001",
                site_id="Site-A",
                enrollment_date=date(2026, 1, 15),
                enrollment_tz="UTC",
            ),
            Subject(
                subject_id="S002",
                site_id="Site-B",
                enrollment_date=date(2026, 1, 16),
                enrollment_tz="UTC",
            ),
        ]
        
        window = ProtocolWindow(
            visit_name="Day 1",
            protocol_version="1.0",
            target_days=0,
            window_early_days=0,
            window_late_days=0,
        )
        
        visits = [
            Visit(
                subject_id="S001",
                visit_name="Day 1",
                visit_date=date(2026, 1, 14),
                visit_timezone="UTC",
            ),
            Visit(
                subject_id="S002",
                visit_name="Day 1",
                visit_date=date(2026, 1, 18),
                visit_timezone="UTC",
            ),
        ]
        
        engine = VisitWindowEngine(
            subjects=subjects,
            visits=visits,
            protocol_windows={"1.0": [window]},
            amendments=[],
        )
        
        engine.run_analysis()
        by_site = engine.get_deviations_by_site()
        
        assert "Site-A" in by_site
        assert "Site-B" in by_site
        assert len(by_site["Site-A"]) == 1
        assert len(by_site["Site-B"]) == 1
