import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .base import BaseParser, ParseResult
from ..models import Reference, ReferenceType


@dataclass
class TranscriptSection:
    section_type: str
    title: str
    content: str
    line_start: int
    line_end: int
    evidence_references: List[str] = field(default_factory=list)
    date_references: List[str] = field(default_factory=list)


class MarkdownTranscriptParser(BaseParser):
    EVIDENCE_PATTERNS = [
        r"证据[编号]?[：:]\s*([A-Za-z0-9\-_]+)",
        r"证据\s*([A-Za-z0-9\-_]+)",
        r"[（(]\s*证据\s*([A-Za-z0-9\-_]+)\s*[）)]",
        r"第\s*(\d+)\s*[号份份份份份]\s*证据",
        r"[（(]\s*(\d+)\s*[）)]\s*证据",
        r"\b(证\d+)\b",
        r"\b(Ev[A-Za-z0-9\-_]+)\b",
    ]

    DATE_PATTERNS = [
        r"(\d{4}年\d{1,2}月\d{1,2}日)",
        r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})",
        r"(\d{1,2}月\d{1,2}日)",
    ]

    def __init__(self):
        super().__init__()
        self.compiled_evidence_patterns = [re.compile(p) for p in self.EVIDENCE_PATTERNS]
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

    def _parse_sections(self, lines: List[str]) -> List[TranscriptSection]:
        sections = []
        current_section = None
        section_content_lines = []

        for i, line in enumerate(lines):
            line_num = i + 1

            if line.startswith("# ") or line.startswith("## ") or line.startswith("### "):
                if current_section is not None:
                    current_section.content = "\n".join(section_content_lines)
                    current_section.line_end = line_num - 1
                    current_section.evidence_references = self._extract_evidence_numbers(
                        current_section.content
                    )
                    current_section.date_references = self._extract_dates(
                        current_section.content
                    )
                    sections.append(current_section)

                section_level = line.count("#")
                section_type = self._determine_section_type(line, section_level)
                current_section = TranscriptSection(
                    section_type=section_type,
                    title=line.lstrip("# ").strip(),
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
            current_section.date_references = self._extract_dates(current_section.content)
            sections.append(current_section)

        return sections

    def _determine_section_type(self, line: str, level: int) -> str:
        line_lower = line.lower()

        section_keywords = {
            "court_opening": ["开庭", "宣布开庭", "法庭调查"],
            "court_investigation": ["法庭调查", "调查"],
            "evidence_presentation": ["举证", "出示证据", "证据"],
            "cross_examination": ["质证", "辩论"],
            "closing_statement": ["最后陈述", "陈述"],
            "court_decision": ["判决", "裁决", "宣判"],
            "adjournment": ["休庭", "闭庭"],
        }

        for sec_type, keywords in section_keywords.items():
            for kw in keywords:
                if kw in line:
                    return sec_type

        return f"level_{level}"

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

    def _extract_dates(self, text: str) -> List[str]:
        dates = set()

        for pattern in self.compiled_date_patterns:
            matches = pattern.findall(text)
            for match in matches:
                dates.add(match)

        return sorted(list(dates))

    def _extract_references(
        self, sections: List[TranscriptSection], source_file: str
    ) -> List[Reference]:
        references = []

        for section in sections:
            for ev_num in section.evidence_references:
                ref = Reference(
                    evidence_number=ev_num,
                    reference_type=ReferenceType.TRANSCRIPT,
                    source_file=source_file,
                    source_context=f"Section: {section.title}",
                    line_number=section.line_start,
                    description=section.content[:200] if len(section.content) > 200 else section.content,
                )
                references.append(ref)

        return references
