from __future__ import annotations

from pathlib import Path
from typing import Optional

from .models import (
    AnchorDef,
    CheckResult,
    CheckStatus,
    LinkKind,
    LinkRef,
    MarkdownDoc,
    Severity,
    SEVERITY_MAP,
)


class AnchorChecker:
    def __init__(self, doc_index: dict[str, MarkdownDoc], root_dir: Path):
        self._doc_index = doc_index
        self._root_dir = root_dir
        self._anchor_index: dict[str, set[str]] = {}
        self._anchor_case_map: dict[str, dict[str, str]] = {}
        self._build_index()

    def _build_index(self) -> None:
        for rel_path, doc in self._doc_index.items():
            anchor_ids: set[str] = set()
            case_map: dict[str, str] = {}
            for a in doc.anchors:
                anchor_ids.add(a.anchor_id)
                case_map[a.anchor_id.lower()] = a.anchor_id
            self._anchor_index[rel_path] = anchor_ids
            self._anchor_case_map[rel_path] = case_map

    def _resolve_target_doc(self, source_doc: MarkdownDoc, link_ref: LinkRef) -> Optional[MarkdownDoc]:
        if link_ref.target_file is None:
            return source_doc

        target = link_ref.target_file
        if target.is_absolute():
            return None

        source_dir = source_doc.file_path.parent
        resolved = (source_dir / target).resolve()

        try:
            rel = resolved.relative_to(self._root_dir)
        except ValueError:
            return None

        return self._doc_index.get(str(rel))

    def check(self, link_ref: LinkRef, source_doc: MarkdownDoc) -> Optional[CheckResult]:
        if link_ref.link_kind == LinkKind.INTERNAL_ANCHOR:
            return self._check_same_file_anchor(link_ref, source_doc)

        if link_ref.link_kind == LinkKind.INTERNAL_FILE:
            return self._check_file_and_anchor(link_ref, source_doc)

        if link_ref.link_kind == LinkKind.IMAGE:
            return self._check_file_only(link_ref, source_doc)

        return None

    def _check_same_file_anchor(self, link_ref: LinkRef, source_doc: MarkdownDoc) -> CheckResult:
        anchor = link_ref.anchor
        if not anchor:
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.OK,
                severity=Severity.INFO,
                detail="页内空锚点(#)，跳过检查",
            )

        anchors = self._anchor_index.get(source_doc.rel_path, set())
        case_map = self._anchor_case_map.get(source_doc.rel_path, {})

        if anchor in anchors:
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.OK,
                severity=Severity.INFO,
                detail=f"锚点 #{anchor} 存在",
            )

        lower_anchor = anchor.lower()
        if lower_anchor in case_map and case_map[lower_anchor] != anchor:
            actual = case_map[lower_anchor]
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.ANCHOR_CASE_MISMATCH,
                severity=Severity.WARNING,
                detail=f"锚点 #{anchor} 大小写不匹配，实际为 #{actual}",
                suggestion=f"将 #{anchor} 修改为 #{actual}",
            )

        fuzzy_match = self._fuzzy_find_anchor(anchor, anchors)
        if fuzzy_match:
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.ANCHOR_MISSING,
                severity=Severity.CRITICAL,
                detail=f"锚点 #{anchor} 不存在，最接近的可能是 #{fuzzy_match}",
                suggestion=f"将 #{anchor} 修改为 #{fuzzy_match}",
            )

        return CheckResult(
            link_ref=link_ref,
            source_doc=source_doc,
            status=CheckStatus.ANCHOR_MISSING,
            severity=Severity.CRITICAL,
            detail=f"锚点 #{anchor} 不存在",
            suggestion=f"确认标题是否被删除或重命名，更新链接中的锚点",
        )

    def _check_file_and_anchor(self, link_ref: LinkRef, source_doc: MarkdownDoc) -> CheckResult:
        target_doc = self._resolve_target_doc(source_doc, link_ref)
        if target_doc is None:
            resolved_path = self._resolve_file_path(source_doc, link_ref)
            if resolved_path and resolved_path.exists():
                return CheckResult(
                    link_ref=link_ref,
                    source_doc=source_doc,
                    status=CheckStatus.PENDING_REVIEW,
                    severity=Severity.INFO,
                    detail=f"文件 {link_ref.target_file} 存在但未被扫描索引覆盖（可能是非Markdown文件）",
                    suggestion="确认该文件是否为文档的一部分",
                )
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.FILE_MISSING,
                severity=Severity.CRITICAL,
                detail=f"文件 {link_ref.target_file} 不存在",
                suggestion="确认文件路径是否正确，或文件是否被移动/删除",
            )

        anchor = link_ref.anchor
        if not anchor:
            return CheckResult(
                link_ref=link_ref,
                source_doc=target_doc,
                status=CheckStatus.OK,
                severity=Severity.INFO,
                detail=f"文件 {link_ref.target_file} 存在",
            )

        anchors = self._anchor_index.get(target_doc.rel_path, set())
        case_map = self._anchor_case_map.get(target_doc.rel_path, {})

        if anchor in anchors:
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.OK,
                severity=Severity.INFO,
                detail=f"文件 {link_ref.target_file} 中锚点 #{anchor} 存在",
            )

        lower_anchor = anchor.lower()
        if lower_anchor in case_map and case_map[lower_anchor] != anchor:
            actual = case_map[lower_anchor]
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.ANCHOR_CASE_MISMATCH,
                severity=Severity.WARNING,
                detail=f"文件 {link_ref.target_file} 中锚点 #{anchor} 大小写不匹配，实际为 #{actual}",
                suggestion=f"将 #{anchor} 修改为 #{actual}",
            )

        fuzzy_match = self._fuzzy_find_anchor(anchor, anchors)
        if fuzzy_match:
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.ANCHOR_MISSING,
                severity=Severity.CRITICAL,
                detail=f"文件 {link_ref.target_file} 中锚点 #{anchor} 不存在，最接近的可能是 #{fuzzy_match}",
                suggestion=f"将 #{anchor} 修改为 #{fuzzy_match}",
            )

        return CheckResult(
            link_ref=link_ref,
            source_doc=source_doc,
            status=CheckStatus.ANCHOR_MISSING,
            severity=Severity.CRITICAL,
            detail=f"文件 {link_ref.target_file} 中锚点 #{anchor} 不存在",
            suggestion=f"确认目标文件中是否有对应标题，更新链接中的锚点",
        )

    def _check_file_only(self, link_ref: LinkRef, source_doc: MarkdownDoc) -> CheckResult:
        resolved_path = self._resolve_file_path(source_doc, link_ref)
        if resolved_path and resolved_path.exists():
            return CheckResult(
                link_ref=link_ref,
                source_doc=source_doc,
                status=CheckStatus.OK,
                severity=Severity.INFO,
                detail=f"图片 {link_ref.target_file} 存在",
            )
        return CheckResult(
            link_ref=link_ref,
            source_doc=source_doc,
            status=CheckStatus.FILE_MISSING,
            severity=Severity.CRITICAL,
            detail=f"图片 {link_ref.target_file} 不存在",
            suggestion="确认图片路径是否正确，或图片是否被移动/删除",
        )

    def _resolve_file_path(self, source_doc: MarkdownDoc, link_ref: LinkRef) -> Optional[Path]:
        if link_ref.target_file is None:
            return None
        source_dir = source_doc.file_path.parent
        resolved = (source_dir / link_ref.target_file).resolve()
        return resolved

    @staticmethod
    def _fuzzy_find_anchor(anchor: str, candidates: set[str]) -> Optional[str]:
        anchor_lower = anchor.lower()
        anchor_norm = anchor_lower.replace("-", " ").replace("_", " ")
        best: Optional[str] = None
        best_score = 0.0

        for c in candidates:
            c_lower = c.lower()
            if c_lower == anchor_lower:
                continue
            c_norm = c_lower.replace("-", " ").replace("_", " ")

            if anchor_norm == c_norm:
                return c

            if anchor_lower in c_lower or c_lower in anchor_lower:
                score = min(len(anchor_lower), len(c_lower)) / max(len(anchor_lower), len(c_lower))
                if score > best_score:
                    best_score = score
                    best = c

            common = sum(1 for a, b in zip(anchor_norm, c_norm) if a == b)
            total = max(len(anchor_norm), len(c_norm))
            if total > 0:
                score = common / total
                if score > 0.6 and score > best_score:
                    best_score = score
                    best = c

        return best if best_score >= 0.5 else None
