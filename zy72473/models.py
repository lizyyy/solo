from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import List, Optional, Dict
import json
import os
from copy import deepcopy


@dataclass
class Complaint:
    id: str
    complaint_no: str
    community_name: str
    content: str
    raw_conclusion: str
    status: str = "pending"
    has_photo: bool = False
    need_review: bool = False
    review_note: str = ""
    missing_materials: List[dict] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class Photo:
    id: str
    complaint_id: str
    file_name: str
    uploaded_by: str
    uploaded_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class CommunityAlias:
    new_name: str
    old_name: str
    confirmed: bool = False


@dataclass
class Summary:
    id: str
    complaint_id: str
    why_kept: str
    missing_materials: List[str]
    next_step: str
    next_contact: str
    version: int = 1
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class AuditLog:
    id: str
    action: str
    complaint_id: str
    operator: str
    detail: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class DataStore:
    def __init__(self, path: str = "data/store.json"):
        self.path = path
        self._data = self._load()

    def _load(self) -> dict:
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"complaints": [], "photos": [], "communities": {}, "audit_log": [], "summaries": []}

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def add_complaint(self, c: Complaint):
        self._data["complaints"].append(asdict(c))
        self.save()

    def get_complaint(self, cid: str) -> Optional[dict]:
        for c in self._data["complaints"]:
            if c["id"] == cid or c["complaint_no"] == cid:
                return c
        return None

    def update_complaint(self, cid: str, updates: dict):
        for i, c in enumerate(self._data["complaints"]):
            if c["id"] == cid or c["complaint_no"] == cid:
                self._data["complaints"][i].update(updates)
                self._data["complaints"][i]["updated_at"] = datetime.now().isoformat()
                self.save()
                return
        raise ValueError(f"Complaint {cid} not found")

    def add_photo(self, p: Photo):
        self._data["photos"].append(asdict(p))
        self.save()

    def add_summary(self, s: Summary):
        self._data["summaries"].append(asdict(s))
        self.save()

    def get_summaries(self, complaint_id: str) -> List[dict]:
        return [s for s in self._data["summaries"] if s["complaint_id"] == complaint_id]

    def add_audit(self, a: AuditLog):
        self._data["audit_log"].append(asdict(a))
        self.save()

    def get_audit_log(self, complaint_id: str = None) -> List[dict]:
        if complaint_id:
            return [a for a in self._data["audit_log"] if a["complaint_id"] == complaint_id]
        return list(self._data["audit_log"])

    def set_community_alias(self, alias: CommunityAlias):
        key = f"{alias.old_name}->{alias.new_name}"
        self._data["communities"][key] = asdict(alias)
        self.save()

    def check_alias(self, name: str) -> Optional[dict]:
        for key, val in self._data["communities"].items():
            if val["old_name"] == name or val["new_name"] == name:
                if not val["confirmed"]:
                    return val
        return None

    def get_all_complaints(self) -> List[dict]:
        return list(self._data["complaints"])

    def export_snapshot(self) -> dict:
        return deepcopy(self._data)
