from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import List, Dict, Optional, Any


class TestStatus(Enum):
    passed = "passed"
    failed = "failed"
    missing = "missing"
    skipped = "skipped"


class RiskLevel(Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


@dataclass
class ApiCallRef:
    api_name: str
    call_site: str
    is_alias: bool = False
    canonical_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.canonical_name is None:
            d["canonical_name"] = None
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ApiCallRef":
        return cls(
            api_name=d["api_name"],
            call_site=d["call_site"],
            is_alias=d.get("is_alias", False),
            canonical_name=d.get("canonical_name"),
        )


@dataclass
class PluginManifest:
    plugin_id: str
    name: str
    author_id: str
    api_calls: List[ApiCallRef] = field(default_factory=list)
    version: Optional[str] = None
    min_host_version: Optional[str] = None
    declared_apis: List[str] = field(default_factory=list)
    _source_file: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "plugin_id": self.plugin_id,
            "name": self.name,
            "author_id": self.author_id,
            "api_calls": [ac.to_dict() for ac in self.api_calls],
            "version": self.version,
            "min_host_version": self.min_host_version,
            "declared_apis": list(self.declared_apis),
        }
        if self._source_file:
            d["_source_file"] = self._source_file
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "PluginManifest":
        api_calls = []
        raw_calls = d.get("api_calls", [])
        for ac in raw_calls:
            if isinstance(ac, dict):
                api_calls.append(ApiCallRef.from_dict(ac))
            elif isinstance(ac, ApiCallRef):
                api_calls.append(ac)
        return cls(
            plugin_id=d["plugin_id"],
            name=d["name"],
            author_id=d["author_id"],
            api_calls=api_calls,
            version=d.get("version"),
            min_host_version=d.get("min_host_version"),
            declared_apis=d.get("declared_apis", []),
            _source_file=d.get("_source_file", ""),
        )


@dataclass
class HostVersion:
    version: str
    released_apis: List[str] = field(default_factory=list)
    deprecated_apis: List[str] = field(default_factory=list)
    removed_apis: List[str] = field(default_factory=list)
    alias_map: Dict[str, str] = field(default_factory=dict)
    _source_file: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "version": self.version,
            "released_apis": list(self.released_apis),
            "deprecated_apis": list(self.deprecated_apis),
            "removed_apis": list(self.removed_apis),
            "alias_map": dict(self.alias_map),
        }
        if self._source_file:
            d["_source_file"] = self._source_file
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "HostVersion":
        return cls(
            version=d["version"],
            released_apis=d.get("released_apis", []),
            deprecated_apis=d.get("deprecated_apis", []),
            removed_apis=d.get("removed_apis", []),
            alias_map=d.get("alias_map", {}),
            _source_file=d.get("_source_file", ""),
        )


@dataclass
class Author:
    author_id: str
    name: str
    email: str
    plugin_ids: List[str] = field(default_factory=list)
    _source_file: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "author_id": self.author_id,
            "name": self.name,
            "email": self.email,
            "plugin_ids": list(self.plugin_ids),
        }
        if self._source_file:
            d["_source_file"] = self._source_file
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Author":
        return cls(
            author_id=d["author_id"],
            name=d["name"],
            email=d["email"],
            plugin_ids=d.get("plugin_ids", []),
            _source_file=d.get("_source_file", ""),
        )


@dataclass
class TestResult:
    plugin_id: str
    host_version: str
    status: TestStatus
    tested_apis: List[str] = field(default_factory=list)
    timestamp: Optional[str] = None
    notes: Optional[str] = None
    _source_file: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "plugin_id": self.plugin_id,
            "host_version": self.host_version,
            "status": self.status.value,
            "tested_apis": list(self.tested_apis),
            "timestamp": self.timestamp,
            "notes": self.notes,
        }
        if self._source_file:
            d["_source_file"] = self._source_file
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TestResult":
        status = d["status"]
        if isinstance(status, str):
            status = TestStatus(status)
        return cls(
            plugin_id=d["plugin_id"],
            host_version=d["host_version"],
            status=status,
            tested_apis=d.get("tested_apis", []),
            timestamp=d.get("timestamp"),
            notes=d.get("notes"),
            _source_file=d.get("_source_file", ""),
        )


@dataclass
class CompatEntry:
    plugin_id: str
    compatible: bool
    risk_level: RiskLevel
    broken_apis: List[str] = field(default_factory=list)
    alias_apis: List[str] = field(default_factory=list)
    undeclared_version: bool = False
    test_coverage: bool = True
    trace: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plugin_id": self.plugin_id,
            "compatible": self.compatible,
            "risk_level": self.risk_level.value,
            "broken_apis": list(self.broken_apis),
            "alias_apis": list(self.alias_apis),
            "undeclared_version": self.undeclared_version,
            "test_coverage": self.test_coverage,
            "trace": dict(self.trace),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "CompatEntry":
        risk_level = d["risk_level"]
        if isinstance(risk_level, str):
            risk_level = RiskLevel(risk_level)
        return cls(
            plugin_id=d["plugin_id"],
            compatible=d["compatible"],
            risk_level=risk_level,
            broken_apis=d.get("broken_apis", []),
            alias_apis=d.get("alias_apis", []),
            undeclared_version=d.get("undeclared_version", False),
            test_coverage=d.get("test_coverage", True),
            trace=d.get("trace", {}),
        )


@dataclass
class CompatibilityReport:
    report_id: str
    generated_at: str
    host_version: str
    entries: List[CompatEntry] = field(default_factory=list)
    risk_summary: Dict[str, int] = field(default_factory=dict)
    calculation_trace: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "generated_at": self.generated_at,
            "host_version": self.host_version,
            "entries": [e.to_dict() for e in self.entries],
            "risk_summary": dict(self.risk_summary),
            "calculation_trace": dict(self.calculation_trace),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "CompatibilityReport":
        entries = []
        for e in d.get("entries", []):
            if isinstance(e, dict):
                entries.append(CompatEntry.from_dict(e))
            elif isinstance(e, CompatEntry):
                entries.append(e)
        return cls(
            report_id=d["report_id"],
            generated_at=d["generated_at"],
            host_version=d["host_version"],
            entries=entries,
            risk_summary=d.get("risk_summary", {}),
            calculation_trace=d.get("calculation_trace", {}),
        )
