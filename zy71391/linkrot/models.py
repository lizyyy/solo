from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


class LinkKind(enum.Enum):
    EXTERNAL = "external"
    INTERNAL_FILE = "internal_file"
    INTERNAL_ANCHOR = "internal_anchor"
    IMAGE = "image"


class CheckStatus(enum.Enum):
    OK = "ok"
    BROKEN = "broken"
    REDIRECT = "redirect"
    REDIRECT_LOOP = "redirect_loop"
    TIMEOUT = "timeout"
    ANCHOR_MISSING = "anchor_missing"
    ANCHOR_CASE_MISMATCH = "anchor_case_mismatch"
    FILE_MISSING = "file_missing"
    PENDING_REVIEW = "pending_review"


class Severity(enum.Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


SEVERITY_MAP = {
    CheckStatus.BROKEN: Severity.CRITICAL,
    CheckStatus.REDIRECT_LOOP: Severity.CRITICAL,
    CheckStatus.FILE_MISSING: Severity.CRITICAL,
    CheckStatus.ANCHOR_MISSING: Severity.CRITICAL,
    CheckStatus.ANCHOR_CASE_MISMATCH: Severity.WARNING,
    CheckStatus.REDIRECT: Severity.WARNING,
    CheckStatus.TIMEOUT: Severity.WARNING,
    CheckStatus.PENDING_REVIEW: Severity.INFO,
    CheckStatus.OK: Severity.INFO,
}

STATUS_LABEL = {
    CheckStatus.OK: "✅ 正常",
    CheckStatus.BROKEN: "❌ 失效",
    CheckStatus.REDIRECT: "⚠️ 重定向",
    CheckStatus.REDIRECT_LOOP: "🔴 重定向循环",
    CheckStatus.TIMEOUT: "⏱️ 超时",
    CheckStatus.ANCHOR_MISSING: "❌ 锚点缺失",
    CheckStatus.ANCHOR_CASE_MISMATCH: "⚠️ 锚点大小写不匹配",
    CheckStatus.FILE_MISSING: "❌ 文件缺失",
    CheckStatus.PENDING_REVIEW: "🔍 待复核",
}


@dataclass
class LinkRef:
    raw_href: str
    link_kind: LinkKind
    line_number: int
    context_line: str
    target_file: Optional[Path] = None
    anchor: Optional[str] = None


@dataclass
class AnchorDef:
    anchor_id: str
    line_number: int
    heading_text: str


@dataclass
class MarkdownDoc:
    file_path: Path
    rel_path: str
    links: list[LinkRef] = field(default_factory=list)
    anchors: list[AnchorDef] = field(default_factory=list)
    maintainer: Optional[str] = None
    frontmatter: dict = field(default_factory=dict)


@dataclass
class CheckResult:
    link_ref: Optional[LinkRef] = None
    source_doc: Optional[MarkdownDoc] = None
    status: Optional[CheckStatus] = None
    severity: Optional[Severity] = None
    detail: str = ""
    suggestion: str = ""
    redirect_chain: list[str] = field(default_factory=list)
    final_url: Optional[str] = None
    http_status: Optional[int] = None

    @property
    def status_label(self) -> str:
        return STATUS_LABEL.get(self.status, str(self.status.value))


@dataclass
class VersionDir:
    dir_path: Path
    version_label: str
    docs: list[MarkdownDoc] = field(default_factory=list)
    is_latest: bool = False


@dataclass
class MaintainerGroup:
    maintainer: str
    results: list[CheckResult] = field(default_factory=list)

    @property
    def critical_count(self) -> int:
        return sum(
            1 for r in self.results
            if r.severity == Severity.CRITICAL
            and r.status != CheckStatus.PENDING_REVIEW
        )

    @property
    def warning_count(self) -> int:
        return sum(
            1 for r in self.results
            if r.severity == Severity.WARNING
            and r.status != CheckStatus.PENDING_REVIEW
        )

    @property
    def review_count(self) -> int:
        return sum(1 for r in self.results if r.status == CheckStatus.PENDING_REVIEW)


@dataclass
class ScanReport:
    scan_time: datetime = field(default_factory=datetime.now)
    root_dir: Path = field(default_factory=lambda: Path("."))
    total_docs: int = 0
    total_links: int = 0
    results: list[CheckResult] = field(default_factory=list)
    versions: list[VersionDir] = field(default_factory=list)

    @property
    def broken_count(self) -> int:
        return sum(1 for r in self.results if r.severity == Severity.CRITICAL)

    @property
    def warning_count(self) -> int:
        return sum(1 for r in self.results if r.severity == Severity.WARNING)

    @property
    def ok_count(self) -> int:
        return sum(1 for r in self.results if r.status == CheckStatus.OK)

    @property
    def review_count(self) -> int:
        return sum(1 for r in self.results if r.status == CheckStatus.PENDING_REVIEW)

    @property
    def maintainer_groups(self) -> list[MaintainerGroup]:
        groups: dict[str, MaintainerGroup] = {}
        for r in self.results:
            name = r.source_doc.maintainer if r.source_doc and r.source_doc.maintainer else "未指定"
            if name not in groups:
                groups[name] = MaintainerGroup(maintainer=name)
            groups[name].results.append(r)
        return sorted(groups.values(), key=lambda g: g.critical_count, reverse=True)

    @property
    def fix_list(self) -> list[CheckResult]:
        return [r for r in self.results if r.severity in (Severity.CRITICAL, Severity.WARNING)]
