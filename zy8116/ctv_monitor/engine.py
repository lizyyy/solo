"""Core engine for visit window calculation and deviation detection."""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple
import uuid

from .core import (
    Amendment,
    Deviation,
    DeviationType,
    ProtocolWindow,
    Subject,
    Visit,
)


class VisitWindowEngine:
    """Engine for calculating visit windows and detecting deviations."""

    def __init__(
        self,
        subjects: List[Subject],
        visits: List[Visit],
        protocol_windows: Dict[str, List[ProtocolWindow]],
        amendments: List[Amendment],
    ):
        self.subjects = {s.subject_id: s for s in subjects}
        self.visits_by_subject: Dict[str, List[Visit]] = defaultdict(list)
        for v in visits:
            self.visits_by_subject[v.subject_id].append(v)
        
        self.protocol_windows = protocol_windows
        self.amendments = sorted(amendments, key=lambda a: a.effective_date)
        
        self.deviations: List[Deviation] = []

    def get_applicable_protocol_version(self, subject: Subject) -> str:
        """Determine which protocol version applies to a subject.
        
        Subjects enrolled on or after an amendment's effective date
        use the newer protocol version.
        """
        version = subject.protocol_version_at_enrollment
        
        for amendment in self.amendments:
            if amendment.affects_subject(subject):
                version = amendment.protocol_version
        
        return version

    def get_windows_for_subject(self, subject: Subject) -> List[ProtocolWindow]:
        """Get protocol windows applicable to a specific subject."""
        version = self.get_applicable_protocol_version(subject)
        
        if version in self.protocol_windows:
            return self.protocol_windows[version]
        
        latest_version = max(self.protocol_windows.keys()) if self.protocol_windows else "1.0"
        return self.protocol_windows.get(latest_version, [])

    def calculate_visit_window(
        self,
        subject: Subject,
        window: ProtocolWindow,
    ) -> Tuple[date, date, date]:
        """Calculate the target and allowed range for a visit.
        
        Returns: (target_date, early_bound, late_bound)
        """
        enrollment_utc = subject.get_enrollment_utc().date()
        target_date = enrollment_utc + timedelta(days=window.target_days)
        early_bound = target_date - timedelta(days=window.window_early_days)
        late_bound = target_date + timedelta(days=window.window_late_days)
        
        return (target_date, early_bound, late_bound)

    def check_amendment_crossing(
        self,
        subject: Subject,
        visit: Visit,
        window: ProtocolWindow,
    ) -> Optional[Deviation]:
        """Check if a visit window spans an amendment effective date.
        
        This detects situations where:
        - The visit window starts before amendment effective date
        - The visit window ends after amendment effective date
        """
        if not self.amendments:
            return None
        
        target_date, early_bound, late_bound = self.calculate_visit_window(subject, window)
        
        for amendment in self.amendments:
            amend_utc_date = amendment.get_effective_utc().date()
            
            if early_bound < amend_utc_date <= late_bound:
                deviation_id = str(uuid.uuid4())[:8]
                return Deviation(
                    deviation_id=deviation_id,
                    subject_id=subject.subject_id,
                    site_id=subject.site_id,
                    deviation_type=DeviationType.AMENDMENT_CROSSING,
                    visit_name=visit.visit_name,
                    actual_date=visit.get_visit_utc().date(),
                    expected_start=early_bound,
                    expected_end=late_bound,
                    days_off_target=None,
                    protocol_version=self.get_applicable_protocol_version(subject),
                    amendment_id=amendment.amendment_id,
                    description=(
                        f"Visit window for {visit.visit_name} spans amendment "
                        f"{amendment.amendment_id} effective date {amend_utc_date}. "
                        f"Window: {early_bound} to {late_bound}"
                    ),
                    severity="high",
                    raw_visit_records=[visit.raw_record],
                )
        
        return None

    def check_visit_in_window(
        self,
        subject: Subject,
        visit: Visit,
        window: ProtocolWindow,
    ) -> Optional[Deviation]:
        """Check if a visit falls within its allowed window.
        
        Returns a Deviation if visit is early or late, None if on time.
        """
        if visit.is_missed:
            return None
        
        target_date, early_bound, late_bound = self.calculate_visit_window(subject, window)
        visit_utc_date = visit.get_visit_utc().date()
        
        days_from_target = (visit_utc_date - target_date).days
        
        if visit_utc_date < early_bound:
            deviation_id = str(uuid.uuid4())[:8]
            return Deviation(
                deviation_id=deviation_id,
                subject_id=subject.subject_id,
                site_id=subject.site_id,
                deviation_type=DeviationType.EARLY_VISIT,
                visit_name=visit.visit_name,
                actual_date=visit_utc_date,
                expected_start=early_bound,
                expected_end=late_bound,
                days_off_target=days_from_target,
                protocol_version=self.get_applicable_protocol_version(subject),
                amendment_id=None,
                description=(
                    f"Early visit: {visit.visit_name} occurred on {visit_utc_date}, "
                    f"which is {abs(days_from_target)} days before target. "
                    f"Allowed window: {early_bound} to {late_bound}"
                ),
                severity="medium",
                raw_visit_records=[visit.raw_record],
            )
        
        if visit_utc_date > late_bound:
            deviation_id = str(uuid.uuid4())[:8]
            return Deviation(
                deviation_id=deviation_id,
                subject_id=subject.subject_id,
                site_id=subject.site_id,
                deviation_type=DeviationType.LATE_VISIT,
                visit_name=visit.visit_name,
                actual_date=visit_utc_date,
                expected_start=early_bound,
                expected_end=late_bound,
                days_off_target=days_from_target,
                protocol_version=self.get_applicable_protocol_version(subject),
                amendment_id=None,
                description=(
                    f"Late visit: {visit.visit_name} occurred on {visit_utc_date}, "
                    f"which is {days_from_target} days after target. "
                    f"Allowed window: {early_bound} to {late_bound}"
                ),
                severity="medium",
                raw_visit_records=[visit.raw_record],
            )
        
        return None

    def check_duplicate_visits(
        self,
        subject_visits: List[Visit],
    ) -> List[Deviation]:
        """Check for duplicate visits (same subject + visit_name on same day)."""
        deviations: List[Deviation] = []
        
        grouped: Dict[Tuple[str, date], List[Visit]] = defaultdict(list)
        for visit in subject_visits:
            key = (visit.visit_name, visit.get_visit_utc().date())
            grouped[key].append(visit)
        
        for (visit_name, visit_date), visits in grouped.items():
            if len(visits) > 1:
                subject = self.subjects.get(visits[0].subject_id)
                if not subject:
                    continue
                
                deviation_id = str(uuid.uuid4())[:8]
                raw_records = [v.raw_record for v in visits]
                
                deviation = Deviation(
                    deviation_id=deviation_id,
                    subject_id=visits[0].subject_id,
                    site_id=subject.site_id,
                    deviation_type=DeviationType.DUPLICATE_VISIT,
                    visit_name=visit_name,
                    actual_date=visit_date,
                    expected_start=None,
                    expected_end=None,
                    days_off_target=None,
                    protocol_version=self.get_applicable_protocol_version(subject),
                    amendment_id=None,
                    description=(
                        f"Duplicate visit detected: {len(visits)} entries for "
                        f"{visit_name} on {visit_date}"
                    ),
                    severity="high",
                    raw_visit_records=raw_records,
                )
                deviations.append(deviation)
        
        return deviations

    def check_same_day_multiple_visits(
        self,
        subject_visits: List[Visit],
    ) -> List[Deviation]:
        """Check for multiple different visits on the same day.
        
        This is different from duplicates - these are different visit names
        recorded on the same day.
        """
        deviations: List[Deviation] = []
        
        grouped: Dict[date, List[Visit]] = defaultdict(list)
        for visit in subject_visits:
            key = visit.get_visit_utc().date()
            grouped[key].append(visit)
        
        for visit_date, visits in grouped.items():
            distinct_visits = {v.visit_name for v in visits}
            if len(distinct_visits) > 1:
                subject = self.subjects.get(visits[0].subject_id)
                if not subject:
                    continue
                
                deviation_id = str(uuid.uuid4())[:8]
                raw_records = [v.raw_record for v in visits]
                
                deviation = Deviation(
                    deviation_id=deviation_id,
                    subject_id=visits[0].subject_id,
                    site_id=subject.site_id,
                    deviation_type=DeviationType.SAME_DAY_MULTIPLE_VISITS,
                    visit_name=None,
                    actual_date=visit_date,
                    expected_start=None,
                    expected_end=None,
                    days_off_target=None,
                    protocol_version=self.get_applicable_protocol_version(subject),
                    amendment_id=None,
                    description=(
                        f"Multiple distinct visits on same day {visit_date}: "
                        f"{', '.join(sorted(distinct_visits))}"
                    ),
                    severity="low",
                    raw_visit_records=raw_records,
                )
                deviations.append(deviation)
        
        return deviations

    def check_missed_visits(
        self,
        subject: Subject,
        subject_visits: List[Visit],
        reference_date: Optional[date] = None,
    ) -> List[Deviation]:
        """Check for mandatory visits that are missed or past their window.
        
        A visit is considered missed if:
        1. It's marked as missed in the data, OR
        2. No visit record exists and we're past the late window bound
        """
        deviations: List[Deviation] = []
        
        if reference_date is None:
            reference_date = date.today()
        
        windows = self.get_windows_for_subject(subject)
        visit_names_recorded = {v.visit_name for v in subject_visits}
        
        missed_visits_in_data = [v for v in subject_visits if v.is_missed]
        for visit in missed_visits_in_data:
            window = next(
                (w for w in windows if w.visit_name == visit.visit_name),
                None
            )
            if window:
                target_date, early_bound, late_bound = self.calculate_visit_window(subject, window)
                deviation_id = str(uuid.uuid4())[:8]
                deviation = Deviation(
                    deviation_id=deviation_id,
                    subject_id=subject.subject_id,
                    site_id=subject.site_id,
                    deviation_type=DeviationType.MISSED_VISIT,
                    visit_name=visit.visit_name,
                    actual_date=None,
                    expected_start=early_bound,
                    expected_end=late_bound,
                    days_off_target=None,
                    protocol_version=self.get_applicable_protocol_version(subject),
                    amendment_id=None,
                    description=(
                        f"Missed visit: {visit.visit_name} explicitly marked as missed. "
                        f"Expected window: {early_bound} to {late_bound}"
                    ),
                    severity="high",
                    raw_visit_records=[visit.raw_record],
                )
                deviations.append(deviation)
        
        for window in windows:
            if not window.is_mandatory:
                continue
            
            if window.visit_name in visit_names_recorded:
                continue
            
            target_date, early_bound, late_bound = self.calculate_visit_window(subject, window)
            
            if reference_date > late_bound:
                deviation_id = str(uuid.uuid4())[:8]
                deviation = Deviation(
                    deviation_id=deviation_id,
                    subject_id=subject.subject_id,
                    site_id=subject.site_id,
                    deviation_type=DeviationType.MISSED_VISIT,
                    visit_name=window.visit_name,
                    actual_date=None,
                    expected_start=early_bound,
                    expected_end=late_bound,
                    days_off_target=None,
                    protocol_version=self.get_applicable_protocol_version(subject),
                    amendment_id=None,
                    description=(
                        f"Missed visit: {window.visit_name} not recorded and "
                        f"past expected window ({early_bound} to {late_bound}). "
                        f"Reference date: {reference_date}"
                    ),
                    severity="high",
                    raw_visit_records=[],
                )
                deviations.append(deviation)
        
        return deviations

    def analyze_subject(
        self,
        subject: Subject,
        reference_date: Optional[date] = None,
    ) -> List[Deviation]:
        """Analyze a single subject for all types of deviations."""
        subject_deviations: List[Deviation] = []
        subject_visits = self.visits_by_subject.get(subject.subject_id, [])
        
        subject_deviations.extend(self.check_duplicate_visits(subject_visits))
        subject_deviations.extend(self.check_same_day_multiple_visits(subject_visits))
        subject_deviations.extend(self.check_missed_visits(subject, subject_visits, reference_date))
        
        windows = self.get_windows_for_subject(subject)
        windows_by_name = {w.visit_name: w for w in windows}
        
        for visit in subject_visits:
            if visit.is_missed:
                continue
            
            window = windows_by_name.get(visit.visit_name)
            if not window:
                continue
            
            window_deviation = self.check_visit_in_window(subject, visit, window)
            if window_deviation:
                subject_deviations.append(window_deviation)
            
            amendment_deviation = self.check_amendment_crossing(subject, visit, window)
            if amendment_deviation:
                subject_deviations.append(amendment_deviation)
        
        return subject_deviations

    def run_analysis(self, reference_date: Optional[date] = None) -> List[Deviation]:
        """Run full analysis for all subjects."""
        all_deviations: List[Deviation] = []
        
        for subject in self.subjects.values():
            subject_deviations = self.analyze_subject(subject, reference_date)
            all_deviations.extend(subject_deviations)
        
        self.deviations = all_deviations
        return all_deviations

    def get_deviations_by_site(self) -> Dict[str, List[Deviation]]:
        """Group deviations by site."""
        by_site: Dict[str, List[Deviation]] = defaultdict(list)
        for d in self.deviations:
            by_site[d.site_id].append(d)
        return dict(by_site)

    def get_deviations_by_type(self) -> Dict[DeviationType, List[Deviation]]:
        """Group deviations by type."""
        by_type: Dict[DeviationType, List[Deviation]] = defaultdict(list)
        for d in self.deviations:
            by_type[d.deviation_type].append(d)
        return dict(by_type)

    def get_subject_visit_summary(self, subject: Subject) -> Dict[str, Any]:
        """Get a summary of visit information for a subject.
        
        Used for timeline generation.
        """
        windows = self.get_windows_for_subject(subject)
        subject_visits = self.visits_by_subject.get(subject.subject_id, [])
        
        enrollment_date = subject.get_enrollment_utc().date()
        
        visit_summary = []
        for window in windows:
            target_date, early_bound, late_bound = self.calculate_visit_window(subject, window)
            
            matching_visits = [v for v in subject_visits if v.visit_name == window.visit_name]
            
            visit_info = {
                "visit_name": window.visit_name,
                "target_date": target_date,
                "early_bound": early_bound,
                "late_bound": late_bound,
                "target_days": window.target_days,
                "is_mandatory": window.is_mandatory,
                "actual_visits": [
                    {
                        "date": v.get_visit_utc().date(),
                        "is_missed": v.is_missed,
                        "raw": v.raw_record,
                    }
                    for v in matching_visits
                ],
            }
            visit_summary.append(visit_info)
        
        return {
            "subject_id": subject.subject_id,
            "site_id": subject.site_id,
            "enrollment_date": enrollment_date,
            "protocol_version": self.get_applicable_protocol_version(subject),
            "visits": visit_summary,
        }
