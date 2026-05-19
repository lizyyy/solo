import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from pathlib import Path


@dataclass
class SourceLocation:
    env: str
    file_path: str
    line_number: int
    raw_line: str

    def __hash__(self):
        return hash((self.env, self.file_path, self.line_number))


@dataclass
class DNSRecord:
    name: str
    record_type: str
    value: str
    ttl: Optional[int]
    sources: List[SourceLocation] = field(default_factory=list)

    def key(self) -> Tuple[str, str, str]:
        return (self.normalized_name(), self.record_type, self.normalized_value())

    def normalized_name(self) -> str:
        name = self.name.lower().rstrip(".")
        if not name:
            name = "@"
        return name

    def normalized_value(self) -> str:
        if self.record_type in ["A", "AAAA", "NS", "CNAME", "PTR"]:
            return self.value.lower().rstrip(".")
        return self.value

    def __eq__(self, other):
        if not isinstance(other, DNSRecord):
            return False
        return self.key() == other.key()

    def __hash__(self):
        return hash(self.key())


@dataclass
class BadLine:
    source: SourceLocation
    error: str


@dataclass
class ZoneParseResult:
    env: str
    file_path: str
    records: List[DNSRecord]
    bad_lines: List[BadLine]
    origin: Optional[str] = None
    default_ttl: Optional[int] = None


class ZoneParser:
    SOI_RE = re.compile(r"^\$ORIGIN\s+(\S+)", re.IGNORECASE)
    TTL_RE = re.compile(r"^\$TTL\s+(\d+)", re.IGNORECASE)
    INCLUDE_RE = re.compile(r"^\$INCLUDE\s+(\S+)", re.IGNORECASE)
    
    RECORD_RE = re.compile(
        r"^(?P<name>\S+)?\s+"
        r"(?:(?P<ttl>\d+)\s+)?"
        r"(?:IN\s+)?"
        r"(?P<type>[A-Z]+)\s+"
        r"(?P<value>.+?)\s*$"
    )
    
    CONTINUATION_RE = re.compile(r"^\s*(\d+[smhdw]?)\s*$", re.IGNORECASE)

    def __init__(self, env: str, file_path: str):
        self.env = env
        self.file_path = file_path
        self.origin: Optional[str] = None
        self.default_ttl: Optional[int] = None
        self.last_name: Optional[str] = None
        self._in_multiline: bool = False
        self._multiline_record: Optional[DNSRecord] = None
        self._multiline_sources: List[SourceLocation] = []

    def parse(self) -> ZoneParseResult:
        records: List[DNSRecord] = []
        bad_lines: List[BadLine] = []
        path = Path(self.file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"Zone file not found: {self.file_path}")

        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for line_num, raw_line in enumerate(lines, 1):
            line = raw_line.strip()
            
            if not line or line.startswith(";"):
                continue

            source = SourceLocation(
                env=self.env,
                file_path=self.file_path,
                line_number=line_num,
                raw_line=raw_line.rstrip("\n")
            )

            try:
                record = self._parse_line(line, source)
                if record:
                    records.append(record)
            except Exception as e:
                bad_lines.append(BadLine(source=source, error=str(e)))

        return ZoneParseResult(
            env=self.env,
            file_path=self.file_path,
            records=records,
            bad_lines=bad_lines,
            origin=self.origin,
            default_ttl=self.default_ttl,
        )

    def _parse_line(self, line: str, source: SourceLocation) -> Optional[DNSRecord]:
        if line.startswith("$ORIGIN"):
            match = self.SOI_RE.match(line)
            if match:
                self.origin = match.group(1).rstrip(".")
            return None

        if line.startswith("$TTL"):
            match = self.TTL_RE.match(line)
            if match:
                self.default_ttl = int(match.group(1))
            return None

        if line.startswith("$INCLUDE"):
            return None

        if self._in_multiline:
            stripped_line = line.strip()
            if ")" in line:
                self._multiline_record.value += " " + stripped_line
                self._multiline_sources.append(source)
                self._multiline_record.sources.extend(self._multiline_sources)
                self._in_multiline = False
                result = self._multiline_record
                self._multiline_record = None
                self._multiline_sources = []
                return result
            else:
                self._multiline_record.value += " " + stripped_line
                self._multiline_sources.append(source)
                return None

        record = self._parse_record(line, source)
        if record:
            if "(" in record.value and ")" not in record.value:
                self._in_multiline = True
                self._multiline_record = record
                self._multiline_sources = []
                return None
            
            if record.name and record.name != "@":
                self.last_name = record.name
            return record

        raise ValueError(f"Unrecognized line format")

    def _parse_record(self, line: str, source: SourceLocation) -> Optional[DNSRecord]:
        match = self.RECORD_RE.match(line)
        if not match:
            return None

        groups = match.groupdict()
        
        name = groups.get("name") or self.last_name or "@"
        record_type = groups["type"]
        value = groups["value"].split(";")[0].strip()
        
        ttl_str = groups.get("ttl")
        ttl = int(ttl_str) if ttl_str else self.default_ttl

        record = DNSRecord(
            name=name,
            record_type=record_type,
            value=value,
            ttl=ttl,
            sources=[source]
        )
        
        return record


def parse_zone_file(env: str, file_path: str) -> ZoneParseResult:
    parser = ZoneParser(env, file_path)
    return parser.parse()
