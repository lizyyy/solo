from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from datetime import date


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Exploitability(Enum):
    PROOF_OF_CONCEPT = "proof_of_concept"
    ACTIVE = "active"
    UNPROVEN = "unproven"


class Status(Enum):
    NEW = "new"
    TRIAGED = "triaged"
    WAIVED = "waived"
    FIXED = "fixed"
    FALSE_POSITIVE = "false_positive"


class Ecosystem(Enum):
    NPM = "npm"
    PYPI = "pypi"
    RUBYGEMS = "rubygems"
    MAVEN = "maven"
    NUGET = "nuget"
    CARGO = "cargo"


@dataclass
class Service:
    name: str
    owner: str
    owner_email: str
    is_internal: bool = True
    is_exposed: bool = False
    description: str = ""


@dataclass
class Dependency:
    name: str
    version: str
    ecosystem: Ecosystem
    is_direct: bool = True
    parent_dependencies: List[str] = field(default_factory=list)
    service_name: str = ""


@dataclass
class Vulnerability:
    id: str
    cve_id: Optional[str]
    title: str
    description: str
    ecosystem: Ecosystem
    package_name: str
    severity: Severity
    exploitability: Exploitability
    fixed_version: str
    cwe: Optional[str] = ""
    cvss_score: Optional[float] = None
    references: List[str] = field(default_factory=list)
    import_date: Optional[date] = None
    scan_id: Optional[str] = None


@dataclass
class WaiveException:
    id: str
    vulnerability_id: str
    service_name: str
    reason: str
    owner: str
    approve_date: date
    expire_date: date
    notes: str = ""


@dataclass
class TriageResult:
    id: str
    vulnerability_id: str
    service_name: str
    status: Status
    triager: str
    triage_date: date
    notes: str = ""
    fixed_version: Optional[str] = None


@dataclass
class ImpactAnalysis:
    vulnerability: Vulnerability
    affected_services: List[Service]
    affected_dependencies: List[Dependency]
    status: Status
    triage_result: Optional[TriageResult] = None
    exception: Optional[WaiveException] = None
    is_exception_expired: bool = False
