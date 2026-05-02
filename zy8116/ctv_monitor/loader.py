"""Data loading utilities for reading input files."""

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from .core import (
    Amendment,
    DateParser,
    ProtocolWindow,
    Subject,
    Visit,
)


class DataLoader:
    """Loader for all input data files."""

    def __init__(self, data_dir: Path, default_timezone: str = "UTC"):
        self.data_dir = data_dir
        self.default_timezone = default_timezone

    def load_subjects(self, filename: str = "subjects.csv") -> List[Subject]:
        """Load subjects from CSV file."""
        subjects: List[Subject] = []
        file_path = self.data_dir / filename
        
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tz = row.get("enrollment_timezone", self.default_timezone)
                enroll_date = DateParser.parse_date(
                    row["enrollment_date"],
                    timezone=tz
                )
                
                subject = Subject(
                    subject_id=row["subject_id"],
                    site_id=row["site_id"],
                    enrollment_date=enroll_date,
                    enrollment_tz=tz,
                    protocol_version_at_enrollment=row.get(
                        "protocol_version", "1.0"
                    ),
                )
                subjects.append(subject)
        
        return subjects

    def load_visits(self, filename: str = "visits.csv") -> List[Visit]:
        """Load visits from CSV file."""
        visits: List[Visit] = []
        file_path = self.data_dir / filename
        
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tz = row.get("visit_timezone", self.default_timezone)
                visit_date = DateParser.parse_date(
                    row["visit_date"],
                    timezone=tz
                )
                
                is_missed = row.get("is_missed", "false").lower() in ("true", "1", "yes")
                
                visit = Visit(
                    subject_id=row["subject_id"],
                    visit_name=row["visit_name"],
                    visit_date=visit_date,
                    visit_timezone=tz,
                    is_missed=is_missed,
                    raw_record=dict(row),
                )
                visits.append(visit)
        
        return visits

    def load_protocol_windows(self, filename: str = "protocol_windows.yaml") -> Dict[str, List[ProtocolWindow]]:
        """Load protocol windows from YAML file.
        
        Returns a dict mapping protocol_version -> list of ProtocolWindows.
        """
        file_path = self.data_dir / filename
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        
        windows_by_version: Dict[str, List[ProtocolWindow]] = {}
        
        if "versions" in data:
            for version_data in data["versions"]:
                version = version_data["version"]
                windows: List[ProtocolWindow] = []
                
                for win_data in version_data.get("windows", []):
                    window = ProtocolWindow(
                        visit_name=win_data["visit_name"],
                        protocol_version=version,
                        target_days=win_data["target_days"],
                        window_early_days=win_data.get("window_early_days", 0),
                        window_late_days=win_data.get("window_late_days", 0),
                        is_mandatory=win_data.get("is_mandatory", True),
                    )
                    windows.append(window)
                
                windows_by_version[version] = windows
        elif "windows" in data:
            version = data.get("version", "1.0")
            windows: List[ProtocolWindow] = []
            
            for win_data in data["windows"]:
                window = ProtocolWindow(
                    visit_name=win_data["visit_name"],
                    protocol_version=version,
                    target_days=win_data["target_days"],
                    window_early_days=win_data.get("window_early_days", 0),
                    window_late_days=win_data.get("window_late_days", 0),
                    is_mandatory=win_data.get("is_mandatory", True),
                )
                windows.append(window)
            
            windows_by_version[version] = windows
        
        return windows_by_version

    def load_amendments(self, filename: str = "amendments.json") -> List[Amendment]:
        """Load amendments from JSON file."""
        amendments: List[Amendment] = []
        file_path = self.data_dir / filename
        
        if not file_path.exists():
            return amendments
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for amend_data in data.get("amendments", data if isinstance(data, list) else []):
            tz = amend_data.get("effective_timezone", self.default_timezone)
            effective_date = DateParser.parse_date(
                amend_data["effective_date"],
                timezone=tz
            )
            
            amendment = Amendment(
                amendment_id=amend_data["amendment_id"],
                protocol_version=amend_data["protocol_version"],
                effective_date=effective_date,
                effective_tz=tz,
                description=amend_data.get("description", ""),
                visit_changes=amend_data.get("visit_changes", []),
            )
            amendments.append(amendment)
        
        return amendments

    def load_all(self) -> Dict[str, Any]:
        """Load all data files and return as a single dict."""
        return {
            "subjects": self.load_subjects(),
            "visits": self.load_visits(),
            "protocol_windows": self.load_protocol_windows(),
            "amendments": self.load_amendments(),
        }
