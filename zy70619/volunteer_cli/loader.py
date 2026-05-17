import json
import csv
from datetime import datetime, date, time
from typing import List, Dict, Any, Optional
from pathlib import Path

from models import (
    Volunteer, Shift, CheckIn, SubstituteRequest, DurationCertification,
    Location, VolunteerStatus, ShiftStatus, SubstituteStatus, CertificationStatus
)


def parse_date(s: str) -> date:
    for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"]:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {s}")


def parse_time(s: str) -> time:
    for fmt in ["%H:%M", "%H:%M:%S", "%H%M"]:
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    raise ValueError(f"无法解析时间: {s}")


def parse_datetime(s: str) -> datetime:
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y%m%d_%H%M%S", "%Y-%m-%dT%H:%M:%S"]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期时间: {s}")


class DataLoader:
    def __init__(self):
        self.errors: List[Dict] = []

    def load_volunteers_from_json(self, file_path: str) -> List[Volunteer]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        volunteers = []
        for i, item in enumerate(data):
            try:
                volunteers.append(Volunteer(
                    volunteer_id=item["volunteer_id"],
                    name=item["name"],
                    phone=item["phone"],
                    email=item.get("email"),
                    status=VolunteerStatus(item.get("status", "active")),
                    join_date=parse_date(item["join_date"]),
                    skills=item.get("skills", [])
                ))
            except Exception as e:
                self.errors.append({
                    "type": "volunteer_parse_error",
                    "row": i,
                    "error": str(e)
                })
        return volunteers

    def load_locations_from_json(self, file_path: str) -> List[Location]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        locations = []
        for i, item in enumerate(data):
            try:
                locations.append(Location(
                    location_id=item["location_id"],
                    name=item["name"],
                    address=item["address"],
                    latitude=float(item["latitude"]),
                    longitude=float(item["longitude"]),
                    radius_meters=int(item.get("radius_meters", 100))
                ))
            except Exception as e:
                self.errors.append({
                    "type": "location_parse_error",
                    "row": i,
                    "error": str(e)
                })
        return locations

    def load_shifts_from_json(self, file_path: str) -> List[Shift]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        shifts = []
        for i, item in enumerate(data):
            try:
                shifts.append(Shift(
                    shift_id=item["shift_id"],
                    activity_name=item["activity_name"],
                    location_id=item["location_id"],
                    date=parse_date(item["date"]),
                    start_time=parse_time(item["start_time"]),
                    end_time=parse_time(item["end_time"]),
                    capacity=int(item["capacity"]),
                    status=ShiftStatus(item.get("status", "planned")),
                    required_skills=item.get("required_skills", []),
                    volunteer_ids=item.get("volunteer_ids", [])
                ))
            except Exception as e:
                self.errors.append({
                    "type": "shift_parse_error",
                    "row": i,
                    "error": str(e)
                })
        return shifts

    def load_checkins_from_json(self, file_path: str) -> List[CheckIn]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        checkins = []
        for i, item in enumerate(data):
            try:
                checkout_time = item.get("checkout_time")
                checkins.append(CheckIn(
                    checkin_id=item["checkin_id"],
                    volunteer_id=item["volunteer_id"],
                    shift_id=item["shift_id"],
                    checkin_time=parse_datetime(item["checkin_time"]),
                    checkout_time=parse_datetime(checkout_time) if checkout_time else None,
                    latitude=float(item["latitude"]) if item.get("latitude") else None,
                    longitude=float(item["longitude"]) if item.get("longitude") else None,
                    notes=item.get("notes")
                ))
            except Exception as e:
                self.errors.append({
                    "type": "checkin_parse_error",
                    "row": i,
                    "error": str(e)
                })
        return checkins

    def load_substitutes_from_json(self, file_path: str) -> List[SubstituteRequest]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        substitutes = []
        for i, item in enumerate(data):
            try:
                approval_time = item.get("approval_time")
                substitutes.append(SubstituteRequest(
                    request_id=item["request_id"],
                    original_volunteer_id=item["original_volunteer_id"],
                    substitute_volunteer_id=item["substitute_volunteer_id"],
                    shift_id=item["shift_id"],
                    request_time=parse_datetime(item["request_time"]),
                    approver_id=item.get("approver_id"),
                    approval_time=parse_datetime(approval_time) if approval_time else None,
                    status=SubstituteStatus(item.get("status", "pending")),
                    reason=item.get("reason")
                ))
            except Exception as e:
                self.errors.append({
                    "type": "substitute_parse_error",
                    "row": i,
                    "error": str(e)
                })
        return substitutes

    def load_certifications_from_json(self, file_path: str) -> List[DurationCertification]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        certifications = []
        for i, item in enumerate(data):
            try:
                verify_time = item.get("verify_time")
                certifications.append(DurationCertification(
                    certification_id=item["certification_id"],
                    volunteer_id=item["volunteer_id"],
                    shift_id=item["shift_id"],
                    checkin_id=item["checkin_id"],
                    claimed_duration_minutes=int(item["claimed_duration_minutes"]),
                    verified_duration_minutes=int(item["verified_duration_minutes"]) if item.get("verified_duration_minutes") else None,
                    status=CertificationStatus(item.get("status", "pending")),
                    verifier_id=item.get("verifier_id"),
                    verify_time=parse_datetime(verify_time) if verify_time else None,
                    notes=item.get("notes")
                ))
            except Exception as e:
                self.errors.append({
                    "type": "certification_parse_error",
                    "row": i,
                    "error": str(e)
                })
        return certifications

    def load_all(self, data_dir: str) -> Dict[str, List]:
        path = Path(data_dir)
        
        result = {
            "volunteers": [],
            "locations": [],
            "shifts": [],
            "checkins": [],
            "substitutes": [],
            "certifications": [],
            "parse_errors": []
        }
        
        mappings = [
            ("volunteers.json", "volunteers", self.load_volunteers_from_json),
            ("locations.json", "locations", self.load_locations_from_json),
            ("shifts.json", "shifts", self.load_shifts_from_json),
            ("checkins.json", "checkins", self.load_checkins_from_json),
            ("substitutes.json", "substitutes", self.load_substitutes_from_json),
            ("certifications.json", "certifications", self.load_certifications_from_json),
        ]
        
        for filename, key, loader in mappings:
            file_path = path / filename
            if file_path.exists():
                try:
                    result[key] = loader(str(file_path))
                except Exception as e:
                    self.errors.append({
                        "type": f"{key}_load_error",
                        "error": str(e)
                    })
        
        result["parse_errors"] = self.errors
        return result
