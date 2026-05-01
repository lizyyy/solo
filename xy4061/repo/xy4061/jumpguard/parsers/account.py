import csv
import os
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from pathlib import Path


@dataclass
class AccountRecord:
    username: str
    department: str = ""
    status: str = "active"
    last_login: Optional[str] = None
    email: str = ""
    employee_id: str = ""
    role: str = ""
    raw_row: Dict[str, Any] = field(default_factory=dict)
    source_file: str = ""
    row_number: int = 0
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "username": self.username,
            "department": self.department,
            "status": self.status,
            "last_login": self.last_login,
            "email": self.email,
            "employee_id": self.employee_id,
            "role": self.role,
            "source_file": self.source_file,
            "row_number": self.row_number,
            "is_valid": self.is_valid,
            "validation_errors": self.validation_errors,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AccountRecord":
        raw_row = data.get("raw_row", {}) or data
        return cls(
            username=data.get("username", ""),
            department=data.get("department", ""),
            status=data.get("status", "active"),
            last_login=data.get("last_login"),
            email=data.get("email", ""),
            employee_id=data.get("employee_id", ""),
            role=data.get("role", ""),
            raw_row=raw_row,
            source_file=data.get("source_file", ""),
            row_number=data.get("row_number", 0),
            is_valid=data.get("is_valid", True),
            validation_errors=data.get("validation_errors", []),
        )


class AccountParser:
    REQUIRED_COLUMNS = ["username", "department", "status", "last_login"]

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.status_active = self.config.get("status_active", ["active", "enabled"])
        self.status_inactive = self.config.get("status_inactive", ["inactive", "disabled", "terminated"])

    def parse_file(self, file_path: str) -> List[AccountRecord]:
        records: List[AccountRecord] = []
        file_path = os.path.abspath(file_path)
        file_name = os.path.basename(file_path)

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames or []

            if not self._check_required_columns(header):
                raise ValueError(
                    f"Account CSV missing required columns. "
                    f"Required: {self.REQUIRED_COLUMNS}, Got: {header}"
                )

            for row_num, row in enumerate(reader, start=2):
                record = self._parse_row(row, file_name, row_num)
                records.append(record)

        return records

    def _check_required_columns(self, header: List[str]) -> bool:
        header_lower = [h.strip().lower() for h in header]
        for req in self.REQUIRED_COLUMNS:
            if req.lower() not in header_lower:
                return False
        return True

    def _normalize_header(self, row: Dict[str, str]) -> Dict[str, str]:
        return {k.strip().lower(): v.strip() for k, v in row.items()}

    def _parse_row(self, row: Dict[str, str], source_file: str, row_number: int) -> AccountRecord:
        normalized = self._normalize_header(row)
        errors: List[str] = []

        username = normalized.get("username", "").strip()
        if not username:
            errors.append("Username is empty")

        department = normalized.get("department", "").strip()
        status = normalized.get("status", "active").strip().lower()
        last_login = normalized.get("last_login", "").strip() or None
        email = normalized.get("email", "").strip()
        employee_id = normalized.get("employee_id", "").strip()
        role = normalized.get("role", "").strip()

        status = self._normalize_status(status)

        is_valid = len(errors) == 0

        return AccountRecord(
            username=username,
            department=department,
            status=status,
            last_login=last_login,
            email=email,
            employee_id=employee_id,
            role=role,
            raw_row=dict(row),
            source_file=source_file,
            row_number=row_number,
            is_valid=is_valid,
            validation_errors=errors,
        )

    def _normalize_status(self, status: str) -> str:
        s = status.lower().strip()
        if s in [x.lower() for x in self.status_inactive]:
            return "inactive"
        if s in [x.lower() for x in self.status_active]:
            return "active"
        return status

    def is_active_status(self, status: str) -> bool:
        return status.lower() in [x.lower() for x in self.status_active] or status == "active"

    def is_inactive_status(self, status: str) -> bool:
        return status.lower() in [x.lower() for x in self.status_inactive] or status == "inactive"
