from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime

from .constants import HashAlgorithm, PackageSource


@dataclass
class PackageHash:
    algorithm: str
    value: str
    source: str = PackageSource.UNKNOWN
    verified: bool = False

    def __str__(self) -> str:
        return f"{self.algorithm}:{self.value}"


@dataclass
class PackageVersion:
    version: str
    hashes: List[PackageHash] = field(default_factory=list)
    source: str = PackageSource.UNKNOWN
    source_url: Optional[str] = None
    wheel_path: Optional[str] = None
    extras: Set[str] = field(default_factory=set)

    def add_hash(self, algorithm: str, value: str, source: str = PackageSource.UNKNOWN):
        existing = next(
            (h for h in self.hashes if h.algorithm == algorithm and h.value == value),
            None
        )
        if not existing:
            self.hashes.append(PackageHash(algorithm=algorithm, value=value, source=source))


@dataclass
class Requirement:
    name: str
    raw: str
    specifier: str = ""
    extras: Set[str] = field(default_factory=set)
    hashes: List[PackageHash] = field(default_factory=list)
    source: str = PackageSource.UNKNOWN
    source_line: Optional[int] = None
    from_constraint: bool = False

    def canonical_name(self) -> str:
        return self.name.lower().replace("-", "_").replace(".", "_")


@dataclass
class HashCheckResult:
    package_name: str
    version: str
    expected_hashes: List[PackageHash]
    actual_hashes: List[PackageHash]
    match: bool = False
    mismatch_details: List[str] = field(default_factory=list)


@dataclass
class SourceAttribution:
    package_name: str
    version: str
    primary_source: str
    all_sources: List[str]
    wheelhouse_match: Optional[str] = None
    custom_index_match: Optional[str] = None
    confidence: float = 0.0


@dataclass
class ConstraintConflict:
    package_name: str
    requirement_spec: str
    constraint_spec: str
    resolution: Optional[str] = None


@dataclass
class ValidationReport:
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    input_files: Dict[str, str] = field(default_factory=dict)
    packages: Dict[str, Dict[str, PackageVersion]] = field(default_factory=dict)
    requirements: List[Requirement] = field(default_factory=list)
    hash_checks: List[HashCheckResult] = field(default_factory=list)
    source_attributions: List[SourceAttribution] = field(default_factory=list)
    constraint_conflicts: List[ConstraintConflict] = field(default_factory=list)
    missing_packages: List[Dict[str, str]] = field(default_factory=list)
    missing_hashes: List[Dict[str, str]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    exit_code: int = 0
    exit_code_description: str = ""

    def get_package(self, name: str, version: Optional[str] = None) -> Optional[PackageVersion]:
        canonical = name.lower().replace("-", "_").replace(".", "_")
        versions = self.packages.get(canonical, {})
        if version:
            return versions.get(version)
        return next(iter(versions.values()), None) if versions else None
