import csv
import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union


@dataclass
class GlossaryEntry:
    chinese: str
    english: str
    abbreviation: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    source: str = "unknown"
    version: str = "v1"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chinese": self.chinese,
            "english": self.english,
            "abbreviation": self.abbreviation,
            "category": self.category,
            "notes": self.notes,
            "source": self.source,
            "version": self.version,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GlossaryEntry":
        return cls(
            chinese=data["chinese"],
            english=data["english"],
            abbreviation=data.get("abbreviation"),
            category=data.get("category"),
            notes=data.get("notes"),
            source=data.get("source", "unknown"),
            version=data.get("version", "v1"),
            created_at=data.get("created_at", datetime.now().isoformat()),
        )


@dataclass
class ForbiddenTerm:
    term: str
    reason: Optional[str] = None
    alternative: Optional[str] = None
    category: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "term": self.term,
            "reason": self.reason,
            "alternative": self.alternative,
            "category": self.category,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ForbiddenTerm":
        return cls(
            term=data["term"],
            reason=data.get("reason"),
            alternative=data.get("alternative"),
            category=data.get("category"),
        )


@dataclass
class GuestEntry:
    chinese_name: str
    english_name: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    title: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chinese_name": self.chinese_name,
            "english_name": self.english_name,
            "aliases": self.aliases,
            "title": self.title,
            "organization": self.organization,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GuestEntry":
        return cls(
            chinese_name=data["chinese_name"],
            english_name=data.get("english_name"),
            aliases=data.get("aliases", []),
            title=data.get("title"),
            organization=data.get("organization"),
            notes=data.get("notes"),
        )


class GlossaryParser:
    def __init__(self):
        self.entries: Dict[str, GlossaryEntry] = {}
        self.forbidden_terms: List[ForbiddenTerm] = []
        self.guests: List[GuestEntry] = []
        self.versions: Dict[str, List[str]] = {}

    def parse_csv(self, file_path: Union[str, Path], source: str = "unknown") -> List[GlossaryEntry]:
        file_path = Path(file_path)
        entries = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                chinese = self._clean_text(row.get("chinese", row.get("中文", "")))
                english = self._clean_text(row.get("english", row.get("英文", "")))

                if not chinese and not english:
                    continue

                entry = GlossaryEntry(
                    chinese=chinese,
                    english=english,
                    abbreviation=self._clean_text(row.get("abbreviation", row.get("缩写", ""))),
                    category=self._clean_text(row.get("category", row.get("分类", ""))),
                    notes=self._clean_text(row.get("notes", row.get("备注", ""))),
                    source=source,
                    version=self._generate_version(chinese, english),
                )
                entries.append(entry)

        return entries

    def parse_json(self, file_path: Union[str, Path], source: str = "unknown") -> List[GlossaryEntry]:
        file_path = Path(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        entries = []
        if isinstance(data, list):
            for item in data:
                chinese = self._clean_text(item.get("chinese", item.get("中文", "")))
                english = self._clean_text(item.get("english", item.get("英文", "")))

                if not chinese and not english:
                    continue

                entry = GlossaryEntry(
                    chinese=chinese,
                    english=english,
                    abbreviation=self._clean_text(item.get("abbreviation", item.get("缩写", ""))),
                    category=self._clean_text(item.get("category", item.get("分类", ""))),
                    notes=self._clean_text(item.get("notes", item.get("备注", ""))),
                    source=source,
                    version=item.get("version", self._generate_version(chinese, english)),
                    created_at=item.get("created_at", datetime.now().isoformat()),
                )
                entries.append(entry)
        elif isinstance(data, dict):
            if "glossary" in data:
                for item in data["glossary"]:
                    chinese = self._clean_text(item.get("chinese", item.get("中文", "")))
                    english = self._clean_text(item.get("english", item.get("英文", "")))
                    if chinese or english:
                        entry = GlossaryEntry(
                            chinese=chinese,
                            english=english,
                            abbreviation=self._clean_text(item.get("abbreviation", item.get("缩写", ""))),
                            category=self._clean_text(item.get("category", item.get("分类", ""))),
                            notes=self._clean_text(item.get("notes", item.get("备注", ""))),
                            source=source,
                            version=item.get("version", self._generate_version(chinese, english)),
                        )
                        entries.append(entry)

        return entries

    def parse_forbidden_terms_csv(self, file_path: Union[str, Path]) -> List[ForbiddenTerm]:
        file_path = Path(file_path)
        forbidden = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                term = self._clean_text(row.get("term", row.get("禁用词", "")))
                if not term:
                    continue

                ft = ForbiddenTerm(
                    term=term,
                    reason=self._clean_text(row.get("reason", row.get("原因", ""))),
                    alternative=self._clean_text(row.get("alternative", row.get("替代词", ""))),
                    category=self._clean_text(row.get("category", row.get("分类", ""))),
                )
                forbidden.append(ft)

        return forbidden

    def parse_forbidden_terms_json(self, file_path: Union[str, Path]) -> List[ForbiddenTerm]:
        file_path = Path(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        forbidden = []
        if isinstance(data, list):
            for item in data:
                term = self._clean_text(item.get("term", item.get("禁用词", "")))
                if term:
                    forbidden.append(ForbiddenTerm(
                        term=term,
                        reason=self._clean_text(item.get("reason", item.get("原因", ""))),
                        alternative=self._clean_text(item.get("alternative", item.get("替代词", ""))),
                        category=self._clean_text(item.get("category", item.get("分类", ""))),
                    ))
        elif isinstance(data, dict) and "forbidden_terms" in data:
            for item in data["forbidden_terms"]:
                term = self._clean_text(item.get("term", item.get("禁用词", "")))
                if term:
                    forbidden.append(ForbiddenTerm(
                        term=term,
                        reason=self._clean_text(item.get("reason", item.get("原因", ""))),
                        alternative=self._clean_text(item.get("alternative", item.get("替代词", ""))),
                        category=self._clean_text(item.get("category", item.get("分类", ""))),
                    ))

        return forbidden

    def parse_guest_list_csv(self, file_path: Union[str, Path]) -> List[GuestEntry]:
        file_path = Path(file_path)
        guests = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                chinese_name = self._clean_text(row.get("chinese_name", row.get("中文名", "")))
                if not chinese_name:
                    continue

                aliases_raw = self._clean_text(row.get("aliases", row.get("别名", "")))
                aliases = [a.strip() for a in aliases_raw.split(",") if a.strip()] if aliases_raw else []

                guest = GuestEntry(
                    chinese_name=chinese_name,
                    english_name=self._clean_text(row.get("english_name", row.get("英文名", ""))),
                    aliases=aliases,
                    title=self._clean_text(row.get("title", row.get("职位", ""))),
                    organization=self._clean_text(row.get("organization", row.get("单位", ""))),
                    notes=self._clean_text(row.get("notes", row.get("备注", ""))),
                )
                guests.append(guest)

        return guests

    def parse_guest_list_json(self, file_path: Union[str, Path]) -> List[GuestEntry]:
        file_path = Path(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        guests = []
        if isinstance(data, list):
            for item in data:
                chinese_name = self._clean_text(item.get("chinese_name", item.get("中文名", "")))
                if not chinese_name:
                    continue

                aliases = item.get("aliases", item.get("别名", []))
                if isinstance(aliases, str):
                    aliases = [a.strip() for a in aliases.split(",") if a.strip()]

                guests.append(GuestEntry(
                    chinese_name=chinese_name,
                    english_name=self._clean_text(item.get("english_name", item.get("英文名", ""))),
                    aliases=aliases if isinstance(aliases, list) else [],
                    title=self._clean_text(item.get("title", item.get("职位", ""))),
                    organization=self._clean_text(item.get("organization", item.get("单位", ""))),
                    notes=self._clean_text(item.get("notes", item.get("备注", ""))),
                ))
        elif isinstance(data, dict) and "guests" in data:
            for item in data["guests"]:
                chinese_name = self._clean_text(item.get("chinese_name", item.get("中文名", "")))
                if chinese_name:
                    aliases = item.get("aliases", item.get("别名", []))
                    if isinstance(aliases, str):
                        aliases = [a.strip() for a in aliases.split(",") if a.strip()]
                    guests.append(GuestEntry(
                        chinese_name=chinese_name,
                        english_name=self._clean_text(item.get("english_name", item.get("英文名", ""))),
                        aliases=aliases if isinstance(aliases, list) else [],
                        title=self._clean_text(item.get("title", item.get("职位", ""))),
                        organization=self._clean_text(item.get("organization", item.get("单位", ""))),
                        notes=self._clean_text(item.get("notes", item.get("备注", ""))),
                    ))

        return guests

    def import_glossary(self, file_path: Union[str, Path], source: str = "unknown") -> Tuple[List[GlossaryEntry], List[str]]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == ".csv":
            new_entries = self.parse_csv(file_path, source)
        elif suffix == ".json":
            new_entries = self.parse_json(file_path, source)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

        merged: List[GlossaryEntry] = []
        conflicts: List[str] = []

        for entry in new_entries:
            key = self._generate_key(entry.chinese, entry.english)

            if key in self.entries:
                existing = self.entries[key]
                if existing.english != entry.english or existing.chinese != entry.chinese:
                    conflict_msg = (
                        f"术语冲突: '{entry.chinese}' -> '{entry.english}' "
                        f"与现有译法 '{existing.chinese}' -> '{existing.english}' "
                        f"(来源: {existing.source} vs {entry.source})"
                    )
                    conflicts.append(conflict_msg)
                else:
                    existing.version = self._increment_version(existing.version)
                    existing.notes = entry.notes
                    merged.append(existing)
            else:
                self.entries[key] = entry
                merged.append(entry)

                if entry.chinese not in self.versions:
                    self.versions[entry.chinese] = []
                self.versions[entry.chinese].append(entry.version)

        return merged, conflicts

    def import_forbidden_terms(self, file_path: Union[str, Path]) -> List[ForbiddenTerm]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == ".csv":
            terms = self.parse_forbidden_terms_csv(file_path)
        elif suffix == ".json":
            terms = self.parse_forbidden_terms_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

        existing_terms = {ft.term for ft in self.forbidden_terms}
        for term in terms:
            if term.term not in existing_terms:
                self.forbidden_terms.append(term)
                existing_terms.add(term.term)

        return self.forbidden_terms

    def import_guest_list(self, file_path: Union[str, Path]) -> List[GuestEntry]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == ".csv":
            guests = self.parse_guest_list_csv(file_path)
        elif suffix == ".json":
            guests = self.parse_guest_list_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

        existing_names = {g.chinese_name for g in self.guests}
        for guest in guests:
            if guest.chinese_name not in existing_names:
                self.guests.append(guest)
                existing_names.add(guest.chinese_name)

        return self.guests

    def get_entries_by_category(self, category: str) -> List[GlossaryEntry]:
        return [e for e in self.entries.values() if e.category == category]

    def get_abbreviations(self) -> Dict[str, List[GlossaryEntry]]:
        abbrev_map: Dict[str, List[GlossaryEntry]] = {}
        for entry in self.entries.values():
            if entry.abbreviation:
                if entry.abbreviation not in abbrev_map:
                    abbrev_map[entry.abbreviation] = []
                abbrev_map[entry.abbreviation].append(entry)
        return abbrev_map

    def get_duplicate_abbreviations(self) -> Dict[str, List[GlossaryEntry]]:
        return {
            abbr: entries
            for abbr, entries in self.get_abbreviations().items()
            if len(entries) > 1
        }

    def export_to_json(self, file_path: Union[str, Path]):
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "glossary": [e.to_dict() for e in self.entries.values()],
            "forbidden_terms": [ft.to_dict() for ft in self.forbidden_terms],
            "guests": [g.to_dict() for g in self.guests],
            "versions": self.versions,
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _clean_text(self, text: Optional[str]) -> str:
        if not text:
            return ""
        text = str(text).strip()
        text = re.sub(r"\s+", " ", text)
        return text

    def _generate_key(self, chinese: str, english: str) -> str:
        return f"{chinese.lower()}|{english.lower()}"

    def _generate_version(self, chinese: str, english: str) -> str:
        key = f"{chinese.lower()}|{english.lower()}"
        if chinese not in self.versions:
            return "v1"
        count = len(self.versions[chinese])
        return f"v{count + 1}"

    def _increment_version(self, version: str) -> str:
        match = re.match(r"v(\d+)", version)
        if match:
            num = int(match.group(1))
            return f"v{num + 1}"
        return "v1"
