"""数据模型定义"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any


class ReferenceType(Enum):
    ARTICLE = "article"
    BOOK = "book"
    INCOLLECTION = "incollection"
    INPROCEEDINGS = "inproceedings"
    MISC = "misc"
    TECHREPORT = "techreport"
    UNPUBLISHED = "unpublished"
    PHDTHESIS = "phdthesis"
    MASTERSTHESIS = "mastersthesis"


@dataclass
class ReferenceEntry:
    key: str
    entry_type: ReferenceType
    source_file: str
    source_format: str
    
    title: Optional[str] = None
    author: Optional[str] = None
    year: Optional[str] = None
    doi: Optional[str] = None
    journal: Optional[str] = None
    booktitle: Optional[str] = None
    publisher: Optional[str] = None
    volume: Optional[str] = None
    pages: Optional[str] = None
    url: Optional[str] = None
    abstract: Optional[str] = None
    
    raw_fields: Dict[str, Any] = field(default_factory=dict)
    
    def get_normalized_doi(self) -> Optional[str]:
        if not self.doi:
            return None
        doi = self.doi.strip().lower()
        if doi.startswith("http://doi.org/"):
            doi = doi[len("http://doi.org/"):]
        if doi.startswith("https://doi.org/"):
            doi = doi[len("https://doi.org/"):]
        if doi.startswith("doi:"):
            doi = doi[len("doi:"):]
        return doi.strip()
    
    def get_authors_list(self) -> List[str]:
        if not self.author:
            return []
        authors = self.author.replace(" and ", " AND ").split(" AND ")
        return [a.strip() for a in authors if a.strip()]
    
    def get_first_author_lastname(self) -> Optional[str]:
        authors = self.get_authors_list()
        if not authors:
            return None
        first = authors[0]
        if "," in first:
            return first.split(",")[0].strip().lower()
        parts = first.split()
        if parts:
            return parts[-1].strip().lower()
        return None
    
    def to_bibtex(self) -> str:
        bib_type = self.entry_type.value.upper()
        lines = [f"@{bib_type}{{{self.key},"]
        
        field_order = [
            ("title", "title"),
            ("author", "author"),
            ("year", "year"),
            ("doi", "doi"),
            ("journal", "journal"),
            ("booktitle", "booktitle"),
            ("publisher", "publisher"),
            ("volume", "volume"),
            ("pages", "pages"),
            ("url", "url"),
        ]
        
        for attr_name, bib_field in field_order:
            value = getattr(self, attr_name, None)
            if value:
                lines.append(f"  {bib_field} = {{{value}}},")
        
        lines.append("}")
        return "\n".join(lines)


@dataclass
class Citation:
    key: str
    raw_text: str
    source_type: str
    line_number: Optional[int] = None
    context: Optional[str] = None


@dataclass
class CheckResult:
    missing_citations: List[Citation] = field(default_factory=list)
    unused_references: List[ReferenceEntry] = field(default_factory=list)
    duplicate_candidates: List[List[ReferenceEntry]] = field(default_factory=list)
    doi_conflicts: List[Dict] = field(default_factory=list)
    duplicate_keys: List[Dict] = field(default_factory=list)
    
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


@dataclass
class ProjectAnalysis:
    citations: List[Citation] = field(default_factory=list)
    references: List[ReferenceEntry] = field(default_factory=list)
    check_result: CheckResult = field(default_factory=CheckResult)
    
    def get_unique_citation_keys(self) -> List[str]:
        return sorted({c.key for c in self.citations})
    
    def get_unique_reference_keys(self) -> List[str]:
        return sorted({r.key for r in self.references})
    
    def get_references_by_key(self, key: str) -> List[ReferenceEntry]:
        return [r for r in self.references if r.key == key]
    
    def get_references_by_doi(self, doi: str) -> List[ReferenceEntry]:
        normalized = doi.lower().strip()
        return [
            r for r in self.references 
            if r.get_normalized_doi() and r.get_normalized_doi() == normalized
        ]
