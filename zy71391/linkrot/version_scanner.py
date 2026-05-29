from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

from .models import CheckResult, CheckStatus, MarkdownDoc, Severity, VersionDir

_VERSION_PATTERN = re.compile(
    r"^(v?(?:\d+\.){0,2}\d+|latest|stable|master|main|dev)$",
    re.IGNORECASE,
)

_VERSION_NUM_PATTERN = re.compile(
    r"v?(\d+)(?:\.(\d+))?(?:\.(\d+))?"
)


def _parse_version_number(label: str) -> Optional[tuple[int, ...]]:
    m = _VERSION_NUM_PATTERN.match(label)
    if not m:
        return None
    parts = []
    for g in m.groups():
        if g is not None:
            parts.append(int(g))
        else:
            parts.append(0)
    return tuple(parts)


def detect_version_dirs(root_dir: Path, docs: list[MarkdownDoc]) -> list[VersionDir]:
    doc_path_map: dict[str, list[MarkdownDoc]] = {}
    for doc in docs:
        parent = doc.file_path.parent
        rel = str(parent.relative_to(root_dir)) if parent != root_dir else "."
        if rel not in doc_path_map:
            doc_path_map[rel] = []
        doc_path_map[rel].append(doc)

    versions: list[VersionDir] = []
    seen_dirs: set[str] = set()

    for path in sorted(root_dir.rglob("*")):
        if not path.is_dir():
            continue
        if any(part.startswith(".") for part in path.parts):
            continue

        rel_path = path.relative_to(root_dir)
        dir_name = path.name

        if _VERSION_PATTERN.match(dir_name):
            rel_str = str(rel_path)
            if rel_str in seen_dirs:
                continue
            seen_dirs.add(rel_str)

            vdir_docs = []
            for d in docs:
                try:
                    _ = d.file_path.relative_to(path)
                    vdir_docs.append(d)
                except ValueError:
                    continue

            if not vdir_docs:
                continue

            vdir = VersionDir(
                dir_path=path,
                version_label=dir_name,
                docs=vdir_docs,
                is_latest=_is_latest_label(dir_name),
            )
            versions.append(vdir)

    versions.sort(key=_version_sort_key, reverse=True)
    if versions and not any(v.is_latest for v in versions):
        versions[0].is_latest = True

    return versions


def _is_latest_label(label: str) -> bool:
    return label.lower() in ("latest", "stable")


def _version_sort_key(vdir: VersionDir) -> tuple:
    label = vdir.version_label.lower()
    if label == "latest":
        return (9999, 9999, 9999)
    if label == "stable":
        return (9998, 9998, 9998)
    if label == "master":
        return (9997, 9997, 9997)
    if label == "main":
        return (9996, 9996, 9996)
    if label == "dev":
        return (9995, 9995, 9995)

    num = _parse_version_number(label)
    if num:
        return num + (0,) * (3 - len(num))
    return (0, 0, 0)


def detect_missing_version_docs(
    versions: list[VersionDir],
    expected_file_patterns: Optional[list[str]] = None,
) -> list[CheckResult]:
    if expected_file_patterns is None:
        expected_file_patterns = ["README.md", "index.md", "overview.md"]

    latest = next((v for v in versions if v.is_latest), versions[0] if versions else None)
    if not latest:
        return []

    latest_files = {d.rel_path.split("/")[-1] for d in latest.docs}
    latest_files.update(expected_file_patterns)

    issues: list[CheckResult] = []

    for v in versions:
        if v.is_latest:
            continue

        v_files = {d.rel_path.split("/")[-1] for d in v.docs}

        for expected in latest_files:
            if expected not in v_files and expected.lower() not in (f.lower() for f in v_files):
                issues.append(
                    CheckResult(
                        link_ref=None,
                        source_doc=None,
                        status=CheckStatus.PENDING_REVIEW,
                        severity=Severity.WARNING,
                        detail=(
                            f"版本 {v.version_label} 缺少文档 {expected}，"
                            f"而 latest 版本中有该文档"
                        ),
                        suggestion=(
                            f"确认 {expected} 是否需要移植到 {v.version_label}，"
                            f"或标记该版本为已废弃"
                        ),
                        http_status=None,
                    )
                )

    return issues
