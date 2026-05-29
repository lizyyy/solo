from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

from .models import AnchorDef, LinkKind, LinkRef, MarkdownDoc

_LINK_PATTERN = re.compile(
    r"\[(?P<text>[^\]]*)\]\((?P<href>[^)\s]+)\)"
)

_HTML_LINK_PATTERN = re.compile(
    r'<a\s[^>]*href=["\'](?P<href>[^"\']+)["\']',
    re.IGNORECASE,
)

_HTML_ANCHOR_PATTERN = re.compile(
    r'<a\s[^>]*(?:id|name)=["\'](?P<anchor>[^"\']+)["\']',
    re.IGNORECASE,
)

_ATX_HEADING_PATTERN = re.compile(r"^#{1,6}\s+(?P<text>.+)$")

_FRONTMATTER_PATTERN = re.compile(r"^---\s*$", re.MULTILINE)

_MAINTAINER_PATTERN = re.compile(
    r"^\s*(?:maintainer|owner|author)\s*:\s*(?P<val>.+)$",
    re.IGNORECASE | re.MULTILINE,
)


def _slugify_anchor(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"[^\w\s\u4e00-\u9fff-]", "", cleaned)
    cleaned = re.sub(r"\s+", "-", cleaned)
    return cleaned.lower()


def parse_frontmatter(content: str) -> tuple[dict, str]:
    parts = _FRONTMATTER_PATTERN.split(content, maxsplit=2)
    if len(parts) >= 3 and parts[0].strip() == "":
        raw = parts[1].strip()
        body = parts[2]
    else:
        return {}, content

    meta: dict = {}
    for line in raw.splitlines():
        m = _MAINTAINER_PATTERN.match(line)
        if m:
            meta["maintainer"] = m.group("val").strip()
        elif ":" in line:
            key, _, val = line.partition(":")
            meta[key.strip()] = val.strip()
    return meta, body


def _classify_href(href: str) -> tuple[LinkKind, Optional[Path], Optional[str]]:
    if href.startswith(("http://", "https://")):
        return LinkKind.EXTERNAL, None, None

    if href.startswith("mailto:") or href.startswith("tel:"):
        return LinkKind.EXTERNAL, None, None

    if href.startswith("#"):
        return LinkKind.INTERNAL_ANCHOR, None, href[1:]

    parsed = urlparse(href)
    file_part = parsed.path
    anchor_part = parsed.fragment or None

    if file_part == "":
        return LinkKind.INTERNAL_ANCHOR, None, anchor_part

    p = Path(file_part)
    if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"):
        return LinkKind.IMAGE, p, anchor_part

    return LinkKind.INTERNAL_FILE, p, anchor_part


def extract_links(content: str, doc_path: Path) -> list[LinkRef]:
    refs: list[LinkRef] = []
    seen: set[tuple[str, int]] = set()

    for lineno, line in enumerate(content.splitlines(), start=1):
        for m in _LINK_PATTERN.finditer(line):
            href = m.group("href")
            key = (href, lineno)
            if key in seen:
                continue
            seen.add(key)
            kind, target, anchor = _classify_href(href)
            refs.append(
                LinkRef(
                    raw_href=href,
                    link_kind=kind,
                    line_number=lineno,
                    context_line=line.strip(),
                    target_file=target,
                    anchor=anchor,
                )
            )

        for m in _HTML_LINK_PATTERN.finditer(line):
            href = m.group("href")
            key = (href, lineno)
            if key in seen:
                continue
            seen.add(key)
            kind, target, anchor = _classify_href(href)
            refs.append(
                LinkRef(
                    raw_href=href,
                    link_kind=kind,
                    line_number=lineno,
                    context_line=line.strip(),
                    target_file=target,
                    anchor=anchor,
                )
            )

    return refs


def extract_anchors(content: str) -> list[AnchorDef]:
    anchors: list[AnchorDef] = []
    seen_ids: set[str] = set()

    for lineno, line in enumerate(content.splitlines(), start=1):
        m = _ATX_HEADING_PATTERN.match(line)
        if m:
            text = m.group("text")
            anchor_id = _slugify_anchor(text)
            if anchor_id and anchor_id not in seen_ids:
                seen_ids.add(anchor_id)
                anchors.append(
                    AnchorDef(
                        anchor_id=anchor_id,
                        line_number=lineno,
                        heading_text=text.strip(),
                    )
                )

        for am in _HTML_ANCHOR_PATTERN.finditer(line):
            aid = am.group("anchor").strip()
            if aid and aid not in seen_ids:
                seen_ids.add(aid)
                anchors.append(
                    AnchorDef(
                        anchor_id=aid,
                        line_number=lineno,
                        heading_text=aid,
                    )
                )

    return anchors


def parse_document(file_path: Path, root_dir: Path) -> MarkdownDoc:
    content = file_path.read_text(encoding="utf-8", errors="replace")
    meta, body = parse_frontmatter(content)

    doc = MarkdownDoc(
        file_path=file_path,
        rel_path=str(file_path.relative_to(root_dir)),
        maintainer=meta.get("maintainer"),
        frontmatter=meta,
    )

    doc.links = extract_links(body, file_path)
    doc.anchors = extract_anchors(body)
    return doc
