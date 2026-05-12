import re
from pathlib import Path
from typing import List, Tuple

from kbcheck.models import Document, Link
from kbcheck.utils import generate_hash, generate_id


class MarkdownParser:
    LINK_PATTERN = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    IMAGE_PATTERN = re.compile(r'!\[([^\]]*)\]\(([^)]+)\)')
    REFERENCE_LINK_PATTERN = re.compile(r'\[([^\]]+)\]\[([^\]]*)\]')
    REFERENCE_DEF_PATTERN = re.compile(r'^\[([^\]]+)\]:\s*(\S+)', re.MULTILINE)
    ANGLE_BRACKET_PATTERN = re.compile(r'<(https?://[^>]+)>')

    def parse_file(self, file_path: str, owner_id: str, visibility: str = "internal") -> Tuple[Document, List[Link]]:
        path = Path(file_path)
        content = path.read_text(encoding="utf-8")

        title = self._extract_title(content, path.stem)
        content_hash = generate_hash(content)

        doc = Document(
            doc_id=generate_id("doc", str(path), content_hash),
            title=title,
            path=str(path),
            file_type="markdown",
            content_hash=content_hash,
            owner_id=owner_id,
            visibility=visibility,
        )

        links = self._extract_links(content, doc.doc_id, str(path))

        return doc, links

    def _extract_title(self, content: str, default: str) -> str:
        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('# '):
                return line[2:].strip()
        return default

    def _extract_links(self, content: str, doc_id: str, file_path: str) -> List[Link]:
        links = []
        references = self._extract_references(content)

        for line_num, line in enumerate(content.split('\n'), 1):
            line_links = []

            for match in self.LINK_PATTERN.finditer(line):
                link_text = match.group(1)
                url = match.group(2)
                if not self._is_fragment(url):
                    line_links.append((link_text, url, "inline"))

            for match in self.IMAGE_PATTERN.finditer(line):
                alt_text = match.group(1)
                url = match.group(2)
                if not self._is_fragment(url):
                    line_links.append((alt_text or "[image]", url, "image"))

            for match in self.REFERENCE_LINK_PATTERN.finditer(line):
                link_text = match.group(1)
                ref_key = match.group(2) or link_text
                if ref_key in references:
                    line_links.append((link_text, references[ref_key], "reference"))

            for match in self.ANGLE_BRACKET_PATTERN.finditer(line):
                url = match.group(1)
                line_links.append((url, url, "autolink"))

            for link_text, url, link_type in line_links:
                link = Link(
                    link_id=generate_id("link", doc_id, url, line_num),
                    source_doc_id=doc_id,
                    target_url=url,
                    link_text=link_text,
                    link_type=link_type,
                    line_number=line_num,
                    occurrences=[f"{file_path}:{line_num}"],
                )
                links.append(link)

        return links

    def _extract_references(self, content: str) -> dict:
        refs = {}
        for match in self.REFERENCE_DEF_PATTERN.finditer(content):
            refs[match.group(1)] = match.group(2)
        return refs

    def _is_fragment(self, url: str) -> bool:
        return url.startswith('#') or url.startswith('/#')
