import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .base import BaseParser, ParseResult
from ..models import Reference, ReferenceType


@dataclass
class JudgmentSection:
    section_type: str
    title: str
    content: str
    line_start: int
    line_end: int
    evidence_references: List[str] = field(default_factory=list)
    legal_references: List[str] = field(default_factory=list)
    date_references: List[str] = field(default_factory=list)


class JudgmentDraftParser(BaseParser):
    EVIDENCE_PATTERNS = [
        r"证据[编号]?[：:]\s*([A-Za-z0-9\-_]+)",
        r"证据\s*([A-Za-z0-9\-_]+)",
        r"[（(]\s*证据\s*([A-Za-z0-9\-_]+)\s*[）)]",
        r"第\s*(\d+)\s*[号份]\s*证据",
        r"[（(]\s*(\d+)\s*[）)]\s*证据",
        r"\b(证\d+)\b",
    ]

    LEGAL_PATTERNS = [
        r"《([^》]+)》",
        r"第\s*(\d+)\s*条",
        r"第\s*(\d+)\s*款",
    ]

    DATE_PATTERNS = [
        r"(\d{4}年\d{1,2}月\d{1,2}日)",
        r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})",
    ]

    def __init__(self):
        super().__init__()
        self.compiled_evidence_patterns = [re.compile(p) for p in self.EVIDENCE_PATTERNS]
        self.compiled_legal_patterns = [re.compile(p) for p in self.LEGAL_PATTERNS]
        self.compiled_date_patterns = [re.compile(p) for p in self.DATE_PATTERNS]

    def parse(self, file_path: Path) -> ParseResult:
        if not self._validate_file(file_path):
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

        content = self._read_file(file_path)
        if content is None:
            return ParseResult(
                success=False,
                errors=self.errors,
                warnings=self.warnings,
            )

        return self.parse_string(content, str(file_path))

    def parse_string(self, content: str, source_file: str = "string") -> ParseResult:
        lines = content.split("\n")
        sections = self._parse_sections(lines)
        references = self._extract_references(sections, source_file)

        metadata = {
            "source_file": source_file,
            "total_lines": len(lines),
            "total_sections": len(sections),
            "total_evidence_references": sum(
                len(s.evidence_references) for s in sections
            ),
            "parse_timestamp": datetime.now().isoformat(),
        }

        result = ParseResult(
            success=True,
            data={
                "sections": [s.__dict__ for s in sections],
                "references": [r.to_dict() for r in references],
                "raw_content": content,
            },
            errors=self.errors,
            warnings=self.warnings,
            metadata=metadata,
        )
        result.references = references
        result.raw_content = content
        return result

    def _parse_sections(self, lines: List[str]) -> List[JudgmentSection]:
        sections = []
        current_section = None
        section_content_lines = []

        for i, line in enumerate(lines):
            line_num = i + 1

            if self._is_section_heading(line):
                if current_section is not None:
                    current_section.content = "\n".join(section_content_lines)
                    current_section.line_end = line_num - 1
                    current_section.evidence_references = self._extract_evidence_numbers(
                        current_section.content
                    )
                    current_section.legal_references = self._extract_legal_refs(
                        current_section.content
                    )
                    current_section.date_references = self._extract_dates(
                        current_section.content
                    )
                    sections.append(current_section)

                section_type = self._determine_section_type(line)
                current_section = JudgmentSection(
                    section_type=section_type,
                    title=line.strip(),
                    content="",
                    line_start=line_num,
                    line_end=line_num,
                )
                section_content_lines = []
            else:
                if current_section is not None:
                    section_content_lines.append(line)

        if current_section is not None and section_content_lines:
            current_section.content = "\n".join(section_content_lines)
            current_section.line_end = len(lines)
            current_section.evidence_references = self._extract_evidence_numbers(
                current_section.content
            )
            current_section.legal_references = self._extract_legal_refs(
                current_section.content
            )
            current_section.date_references = self._extract_dates(current_section.content)
            sections.append(current_section)

        return sections

    def _is_section_heading(self, line: str) -> bool:
        stripped = line.strip()
        if not stripped:
            return False

        if line.startswith("# ") or line.startswith("## ") or line.startswith("### "):
            return True

        heading_keywords = [
            "本院认为", "本院查明", "判决如下", "裁定如下",
            "事实认定", "证据分析", "法律适用", "裁判理由",
            "经审理查明", "审理查明", "上述事实",
            "综上所述", "本院裁判", "一、", "二、", "三、",
            "（一）", "（二）", "（三）",
        ]

        for kw in heading_keywords:
            if stripped.startswith(kw):
                return True

        if stripped.endswith("：") or stripped.endswith(":"):
            if len(stripped) < 30:
                return True

        return False

    def _determine_section_type(self, line: str) -> str:
        line_lower = line.lower()

        type_keywords = {
            "facts": ["查明", "事实", "审理查明", "经审理查明"],
            "evidence_analysis": ["证据", "证据分析", "证据认定"],
            "legal_reasoning": ["本院认为", "本院认为", "裁判理由", "法律适用"],
            "judgment": ["判决如下", "裁定如下", "本院裁判"],
            "summary": ["综上所述", "综上"],
        }

        for sec_type, keywords in type_keywords.items():
            for kw in keywords:
                if kw in line:
                    return sec_type

        return "general"

    def _extract_evidence_numbers(self, text: str) -> List[str]:
        evidence_numbers = set()

        for pattern in self.compiled_evidence_patterns:
            matches = pattern.findall(text)
            for match in matches:
                if isinstance(match, tuple):
                    for group in match:
                        if group:
                            evidence_numbers.add(group.strip())
                else:
                    if match:
                        evidence_numbers.add(match.strip())

        return sorted(list(evidence_numbers))

    def _extract_legal_refs(self, text: str) -> List[str]:
        legal_refs = set()

        for pattern in self.compiled_legal_patterns:
            matches = pattern.findall(text)
            for match in matches:
                if isinstance(match, tuple):
                    for group in match:
                        if group:
                            legal_refs.add(group.strip())
                else:
                    if match:
                        legal_refs.add(match.strip())

        return sorted(list(legal_refs))

    def _extract_dates(self, text: str) -> List[str]:
        dates = set()

        for pattern in self.compiled_date_patterns:
            matches = pattern.findall(text)
            for match in matches:
                dates.add(match)

        return sorted(list(dates))

    def _extract_references(
        self, sections: List[JudgmentSection], source_file: str
    ) -> List[Reference]:
        references = []

        for section in sections:
            for ev_num in section.evidence_references:
                ref = Reference(
                    evidence_number=ev_num,
                    reference_type=ReferenceType.JUDGMENT_DRAFT,
                    source_file=source_file,
                    source_context=f"Section: {section.title}",
                    line_number=section.line_start,
                    description=section.content[:200] if len(section.content) > 200 else section.content,
                )
                references.append(ref)

        return references
