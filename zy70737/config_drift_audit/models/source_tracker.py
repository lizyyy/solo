from dataclasses import dataclass, field
from typing import Dict, List, Optional
from pathlib import Path


@dataclass
class SourceLocation:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: int = 0
    raw_content: str = ""

    def __str__(self) -> str:
        if self.sheet_name:
            return f"{self.file_path}:{self.sheet_name}:{self.row_number}"
        return f"{self.file_path}:{self.row_number}"


@dataclass
class SourceTracker:
    locations: Dict[str, SourceLocation] = field(default_factory=dict)
    bad_rows: List[SourceLocation] = field(default_factory=list)

    def add_location(self, record_id: str, location: SourceLocation) -> None:
        self.locations[record_id] = location

    def add_bad_row(self, location: SourceLocation) -> None:
        self.bad_rows.append(location)

    def get_location(self, record_id: str) -> Optional[SourceLocation]:
        return self.locations.get(record_id)

    def get_all_locations(self) -> Dict[str, SourceLocation]:
        return self.locations.copy()
