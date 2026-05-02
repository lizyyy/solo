"""Tests for core data models and date handling."""

from datetime import date, timedelta

import pytest
import pytz

from ctv_monitor.core import (
    Amendment,
    DateParser,
    Deviation,
    DeviationType,
    ProtocolWindow,
    Subject,
    Visit,
)


class TestDateParser:
    """Tests for DateParser class."""

    def test_parse_date_iso_format(self):
        """Test parsing ISO format dates."""
        result = DateParser.parse_date("2026-01-15", "UTC")
        assert result == date(2026, 1, 15)

    def test_parse_date_slash_format(self):
        """Test parsing dates with slashes."""
        result = DateParser.parse_date("2026/01/15", "UTC")
        assert result == date(2026, 1, 15)

    def test_parse_date_with_timezone_conversion(self):
        """Test that dates are properly converted to UTC."""
        result_ny = DateParser.parse_date("2026-01-15", "America/New_York")
        result_utc = DateParser.parse_date("2026-01-15", "UTC")
        
        assert result_ny == result_utc

    def test_parse_date_with_fallback_success(self):
        """Test parse_date_with_fallback with valid date."""
        result = DateParser.parse_date_with_fallback("2026-01-15", "UTC")
        assert result == date(2026, 1, 15)

    def test_parse_date_with_fallback_failure(self):
        """Test parse_date_with_fallback with invalid date."""
        result = DateParser.parse_date_with_fallback("invalid-date", "UTC")
        assert result is None

    def test_parse_date_invalid_format_raises(self):
        """Test that invalid date format raises ValueError."""
        with pytest.raises(ValueError):
            DateParser.parse_date("not-a-date", "UTC")


class TestSubject:
    """Tests for Subject class."""

    def test_subject_creation(self):
        """Test basic subject creation."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="America/New_York",
            protocol_version_at_enrollment="1.0",
        )
        
        assert subject.subject_id == "S001"
        assert subject.site_id == "Site-A"
        assert subject.enrollment_date == date(2026, 1, 15)
        assert subject.enrollment_tz == "America/New_York"
        assert subject.protocol_version_at_enrollment == "1.0"

    def test_get_enrollment_utc(self):
        """Test conversion of enrollment date to UTC."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="America/New_York",
        )
        
        utc_dt = subject.get_enrollment_utc()
        assert utc_dt.tzinfo == pytz.UTC


class TestVisit:
    """Tests for Visit class."""

    def test_visit_creation(self):
        """Test basic visit creation."""
        visit = Visit(
            subject_id="S001",
            visit_name="Day 7",
            visit_date=date(2026, 1, 22),
            visit_timezone="America/New_York",
            is_missed=False,
        )
        
        assert visit.subject_id == "S001"
        assert visit.visit_name == "Day 7"
        assert visit.visit_date == date(2026, 1, 22)
        assert visit.is_missed is False

    def test_days_since_enrollment(self):
        """Test calculation of days since enrollment."""
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
        )
        
        visit = Visit(
            subject_id="S001",
            visit_name="Day 7",
            visit_date=date(2026, 1, 22),
            visit_timezone="UTC",
        )
        
        days = visit.days_since_enrollment(subject)
        assert days == 7

    def test_get_visit_utc(self):
        """Test conversion of visit date to UTC."""
        visit = Visit(
            subject_id="S001",
            visit_name="Day 7",
            visit_date=date(2026, 1, 22),
            visit_timezone="Europe/London",
        )
        
        utc_dt = visit.get_visit_utc()
        assert utc_dt.tzinfo == pytz.UTC


class TestProtocolWindow:
    """Tests for ProtocolWindow class."""

    def test_window_creation(self):
        """Test basic window creation."""
        window = ProtocolWindow(
            visit_name="Day 7",
            protocol_version="1.0",
            target_days=7,
            window_early_days=1,
            window_late_days=1,
            is_mandatory=True,
        )
        
        assert window.visit_name == "Day 7"
        assert window.target_days == 7
        assert window.window_early_days == 1
        assert window.window_late_days == 1

    def test_get_allowed_range(self):
        """Test calculation of allowed date range."""
        window = ProtocolWindow(
            visit_name="Day 7",
            protocol_version="1.0",
            target_days=7,
            window_early_days=1,
            window_late_days=1,
        )
        
        enrollment = date(2026, 1, 15)
        early_bound, late_bound = window.get_allowed_range(enrollment)
        
        assert early_bound == date(2026, 1, 21)
        assert late_bound == date(2026, 1, 23)


class TestAmendment:
    """Tests for Amendment class."""

    def test_amendment_creation(self):
        """Test basic amendment creation."""
        amendment = Amendment(
            amendment_id="AM-001",
            protocol_version="2.0",
            effective_date=date(2026, 1, 23),
            effective_tz="UTC",
            description="Extended windows",
            visit_changes=[{"visit_name": "Day 7", "change": "Extended"}],
        )
        
        assert amendment.amendment_id == "AM-001"
        assert amendment.protocol_version == "2.0"
        assert amendment.effective_date == date(2026, 1, 23)

    def test_affects_subject_before_effective(self):
        """Test subject enrolled before amendment effective date."""
        amendment = Amendment(
            amendment_id="AM-001",
            protocol_version="2.0",
            effective_date=date(2026, 1, 23),
            effective_tz="UTC",
        )
        
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 15),
            enrollment_tz="UTC",
        )
        
        assert amendment.affects_subject(subject) is False

    def test_affects_subject_after_effective(self):
        """Test subject enrolled on or after amendment effective date."""
        amendment = Amendment(
            amendment_id="AM-001",
            protocol_version="2.0",
            effective_date=date(2026, 1, 23),
            effective_tz="UTC",
        )
        
        subject = Subject(
            subject_id="S001",
            site_id="Site-A",
            enrollment_date=date(2026, 1, 25),
            enrollment_tz="UTC",
        )
        
        assert amendment.affects_subject(subject) is True


class TestDeviation:
    """Tests for Deviation class."""

    def test_deviation_creation(self):
        """Test basic deviation creation."""
        deviation = Deviation(
            deviation_id="abc123",
            subject_id="S001",
            site_id="Site-A",
            deviation_type=DeviationType.EARLY_VISIT,
            visit_name="Day 7",
            actual_date=date(2026, 1, 20),
            expected_start=date(2026, 1, 21),
            expected_end=date(2026, 1, 23),
            days_off_target=-2,
            protocol_version="1.0",
            amendment_id=None,
            description="Early visit detected",
            severity="medium",
        )
        
        assert deviation.deviation_id == "abc123"
        assert deviation.deviation_type == DeviationType.EARLY_VISIT
        assert deviation.severity == "medium"

    def test_deviation_type_values(self):
        """Test that all deviation types have correct string values."""
        assert DeviationType.MISSED_VISIT.value == "missed_visit"
        assert DeviationType.EARLY_VISIT.value == "early_visit"
        assert DeviationType.LATE_VISIT.value == "late_visit"
        assert DeviationType.DUPLICATE_VISIT.value == "duplicate_visit"
        assert DeviationType.AMENDMENT_CROSSING.value == "amendment_crossing"
        assert DeviationType.SAME_DAY_MULTIPLE_VISITS.value == "same_day_multiple_visits"
