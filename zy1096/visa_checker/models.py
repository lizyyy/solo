from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import List, Optional, Dict, Any


class RiskLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    OK = "ok"


class IssueType(Enum):
    MISSING_DOCUMENT = "missing_document"
    INVALID_FILENAME = "invalid_filename"
    PASSPORT_EXPIRED = "passport_expired"
    PASSPORT_EXPIRY_INSUFFICIENT = "passport_expiry_insufficient"
    PHOTO_SPEC_ISSUE = "photo_spec_issue"
    INSURANCE_COVERAGE_GAP = "insurance_coverage_gap"
    INSURANCE_EXPIRES_EARLY = "insurance_expires_early"
    HOTEL_DAYS_MISMATCH = "hotel_days_mismatch"
    EMPLOYMENT_CERT_DATE_ISSUE = "employment_cert_date_issue"
    ITINERARY_CONFLICT = "itinerary_conflict"
    DATE_FORMAT_ERROR = "date_format_error"
    APPLICANT_NOT_FOUND = "applicant_not_found"
    MATERIAL_DIR_EMPTY = "material_dir_empty"
    RULES_MISSING_FIELD = "rules_missing_field"
    UNKNOWN_DOCUMENT = "unknown_document"


@dataclass
class Issue:
    issue_type: IssueType
    severity: RiskLevel
    message: str
    evidence: Optional[str] = None
    document_type: Optional[str] = None
    file_path: Optional[str] = None


@dataclass
class MaterialFile:
    original_path: str
    filename: str
    extension: str
    file_size: int
    applicant_id: Optional[str] = None
    document_type: Optional[str] = None
    normalized_filename: Optional[str] = None


@dataclass
class Applicant:
    applicant_id: str
    name: str
    passport_number: str
    passport_expiry_date: date
    birth_date: Optional[date] = None
    nationality: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    materials: List[MaterialFile] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    missing_docs: List[str] = field(default_factory=list)

    @property
    def risk_level(self) -> RiskLevel:
        if not self.issues:
            return RiskLevel.OK
        critical = any(i.severity == RiskLevel.CRITICAL for i in self.issues)
        high = any(i.severity == RiskLevel.HIGH for i in self.issues)
        medium = any(i.severity == RiskLevel.MEDIUM for i in self.issues)
        low = any(i.severity == RiskLevel.LOW for i in self.issues)
        
        if critical:
            return RiskLevel.CRITICAL
        elif high:
            return RiskLevel.HIGH
        elif medium:
            return RiskLevel.MEDIUM
        elif low:
            return RiskLevel.LOW
        return RiskLevel.OK


@dataclass
class ItineraryDay:
    date: date
    city: str
    country: str
    hotel_name: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class Itinerary:
    applicant_id: str
    start_date: date
    end_date: date
    days: List[ItineraryDay] = field(default_factory=list)

    @property
    def duration_days(self) -> int:
        return (self.end_date - self.start_date).days + 1


@dataclass
class Rules:
    passport_min_validity_months: int = 6
    employment_cert_max_age_days: int = 30
    insurance_buffer_days: int = 2
    required_documents: List[str] = field(default_factory=list)
    photo_requirements: Dict[str, Any] = field(default_factory=dict)
    document_naming_pattern: str = "{applicant_id}_{document_type}.{ext}"

    @classmethod
    def default(cls) -> "Rules":
        return cls(
            passport_min_validity_months=6,
            employment_cert_max_age_days=30,
            insurance_buffer_days=2,
            required_documents=[
                "passport",
                "photo",
                "employment_cert",
                "bank_statement",
                "flight_itinerary",
                "hotel_booking",
                "insurance",
            ],
            photo_requirements={
                "size": "35x45mm",
                "background": "white",
                "max_age_months": 6,
            },
            document_naming_pattern="{applicant_id}_{document_type}.{ext}",
        )


@dataclass
class ValidationResult:
    applicants: List[Applicant]
    itineraries: Dict[str, Itinerary]
    rules: Rules
    materials: List[MaterialFile]
    unmatched_materials: List[MaterialFile] = field(default_factory=list)
    global_issues: List[Issue] = field(default_factory=list)

    @property
    def total_issues(self) -> int:
        count = len(self.global_issues)
        for applicant in self.applicants:
            count += len(applicant.issues)
        return count

    @property
    def has_critical_issues(self) -> bool:
        for issue in self.global_issues:
            if issue.severity == RiskLevel.CRITICAL:
                return True
        for applicant in self.applicants:
            for issue in applicant.issues:
                if issue.severity == RiskLevel.CRITICAL:
                    return True
        return False
