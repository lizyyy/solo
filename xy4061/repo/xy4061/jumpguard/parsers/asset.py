import csv
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set


@dataclass
class AssetRecord:
    hostname: str
    ip_address: str = ""
    environment: str = "unknown"
    department: str = ""
    owner: str = ""
    status: str = "active"
    tags: List[str] = field(default_factory=list)
    raw_row: Dict[str, Any] = field(default_factory=dict)
    source_file: str = ""
    row_number: int = 0
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hostname": self.hostname,
            "ip_address": self.ip_address,
            "environment": self.environment,
            "department": self.department,
            "owner": self.owner,
            "status": self.status,
            "tags": self.tags,
            "source_file": self.source_file,
            "row_number": self.row_number,
            "is_valid": self.is_valid,
            "validation_errors": self.validation_errors,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AssetRecord":
        raw_row = data.get("raw_row", {}) or data
        return cls(
            hostname=data.get("hostname", ""),
            ip_address=data.get("ip_address", ""),
            environment=data.get("environment", "unknown"),
            department=data.get("department", ""),
            owner=data.get("owner", ""),
            status=data.get("status", "active"),
            tags=data.get("tags", []),
            raw_row=raw_row,
            source_file=data.get("source_file", ""),
            row_number=data.get("row_number", 0),
            is_valid=data.get("is_valid", True),
            validation_errors=data.get("validation_errors", []),
        )


class AssetParser:
    REQUIRED_COLUMNS = ["hostname", "environment"]

    DEFAULT_ENV_PRODUCTION = ["prod", "production", "线上"]
    DEFAULT_ENV_TEST = ["test", "testing", "测试"]
    DEFAULT_ENV_DEV = ["dev", "development", "开发"]

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.env_column = self.config.get("env_column", "environment")
        self.env_production = self.config.get("env_production", self.DEFAULT_ENV_PRODUCTION)
        self.env_test = self.config.get("env_test", self.DEFAULT_ENV_TEST)
        self.env_dev = self.config.get("env_dev", self.DEFAULT_ENV_DEV)

    def parse_file(self, file_path: str) -> List[AssetRecord]:
        records: List[AssetRecord] = []
        file_path = os.path.abspath(file_path)
        file_name = os.path.basename(file_path)

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames or []

            if not self._check_required_columns(header):
                raise ValueError(
                    f"Asset CSV missing required columns. "
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

    def _parse_row(self, row: Dict[str, str], source_file: str, row_number: int) -> AssetRecord:
        normalized = self._normalize_header(row)
        errors: List[str] = []

        hostname = normalized.get("hostname", "").strip()
        if not hostname:
            errors.append("Hostname is empty")

        ip_address = normalized.get("ip", "").strip() or normalized.get("ip_address", "").strip()

        env_value = normalized.get("environment", "").strip() or normalized.get("env", "").strip()
        environment = self._normalize_environment(env_value)

        department = normalized.get("department", "").strip()
        owner = normalized.get("owner", "").strip() or normalized.get("admin", "").strip()
        status = normalized.get("status", "active").strip().lower()

        tags_str = normalized.get("tags", "").strip() or normalized.get("label", "").strip()
        tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []

        is_valid = len(errors) == 0

        return AssetRecord(
            hostname=hostname,
            ip_address=ip_address,
            environment=environment,
            department=department,
            owner=owner,
            status=status,
            tags=tags,
            raw_row=dict(row),
            source_file=source_file,
            row_number=row_number,
            is_valid=is_valid,
            validation_errors=errors,
        )

    def _normalize_environment(self, env: str) -> str:
        e = env.lower().strip()
        if any(p.lower() in e for p in self.env_production):
            return "production"
        if any(t.lower() in e for t in self.env_test):
            return "test"
        if any(d.lower() in e for d in self.env_dev):
            return "dev"
        return e if e else "unknown"

    def is_production_env(self, env: str) -> bool:
        e = env.lower()
        return e == "production" or any(p.lower() in e for p in self.env_production)

    def is_test_env(self, env: str) -> bool:
        e = env.lower()
        return e == "test" or any(t.lower() in e for t in self.env_test)

    def is_dev_env(self, env: str) -> bool:
        e = env.lower()
        return e == "dev" or any(d.lower() in e for d in self.env_dev)

    def get_all_hostnames(self, records: List[AssetRecord]) -> Set[str]:
        return {r.hostname for r in records if r.hostname}

    def get_assets_by_env(self, records: List[AssetRecord], env: str) -> List[AssetRecord]:
        env_lower = env.lower()
        if env_lower == "production":
            return [r for r in records if self.is_production_env(r.environment)]
        elif env_lower == "test":
            return [r for r in records if self.is_test_env(r.environment)]
        elif env_lower == "dev":
            return [r for r in records if self.is_dev_env(r.environment)]
        return [r for r in records if r.environment.lower() == env_lower]
