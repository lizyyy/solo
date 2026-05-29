import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, TypeVar, Generic

from .models import PluginManifest, ApiCallRef, HostVersion, Author, TestResult, TestStatus

T = TypeVar("T")

_PLUGIN_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")
_SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+([a-zA-Z0-9._+-]*)?$")
_VALID_TEST_STATUSES = {s.value for s in TestStatus}


@dataclass
class DirtyItem:
    raw_data: Any
    errors: List[str] = field(default_factory=list)
    source_file: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_data": self.raw_data,
            "errors": list(self.errors),
            "source_file": self.source_file,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DirtyItem":
        return cls(
            raw_data=d["raw_data"],
            errors=d.get("errors", []),
            source_file=d.get("source_file", ""),
        )


@dataclass
class IngestResult(Generic[T]):
    valid_items: List[T] = field(default_factory=list)
    dirty_items: List[DirtyItem] = field(default_factory=list)
    stats: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid_items": [
                item.to_dict() if hasattr(item, "to_dict") else item
                for item in self.valid_items
            ],
            "dirty_items": [di.to_dict() for di in self.dirty_items],
            "stats": dict(self.stats),
        }


def _load_json_file(filepath: str) -> List[Dict[str, Any]]:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return data
    return [data]


def _collect_files(directory_or_files: str) -> List[str]:
    if os.path.isfile(directory_or_files):
        return [directory_or_files]
    if os.path.isdir(directory_or_files):
        files = []
        for fname in sorted(os.listdir(directory_or_files)):
            fpath = os.path.join(directory_or_files, fname)
            if os.path.isfile(fpath) and fname.endswith(".json"):
                files.append(fpath)
        return files
    return []


def _validate_plugin_id(plugin_id: Any) -> Optional[str]:
    if not isinstance(plugin_id, str):
        return "plugin_id is not a string"
    if not _PLUGIN_ID_PATTERN.match(plugin_id):
        return f"plugin_id '{plugin_id}' does not match pattern [a-zA-Z0-9_-]+"
    return None


def _validate_version(version: Any) -> Optional[str]:
    if version is None:
        return None
    if not isinstance(version, str):
        return "version is not a string"
    if version.strip() == "":
        return None
    if not _SEMVER_PATTERN.match(version.strip()):
        return f"version '{version}' does not match semver pattern"
    return None


def _validate_api_calls(api_calls: Any) -> Optional[str]:
    if api_calls is None:
        return None
    if not isinstance(api_calls, list):
        return "api_calls is not a list"
    for item in api_calls:
        if not isinstance(item, dict):
            return "api_calls contains non-dict entries"
    return None


def _validate_test_status(status: Any) -> Optional[str]:
    if not isinstance(status, str):
        return "status is not a string"
    if status not in _VALID_TEST_STATUSES:
        return f"unknown test status '{status}', must be one of {sorted(_VALID_TEST_STATUSES)}"
    return None


class IngestionEngine:
    def ingest_plugins(
        self, directory_or_files: str
    ) -> IngestResult[PluginManifest]:
        files = _collect_files(directory_or_files)
        valid: List[PluginManifest] = []
        dirty: List[DirtyItem] = []
        seen_ids: Dict[str, str] = {}
        total = 0

        for filepath in files:
            try:
                records = _load_json_file(filepath)
            except (json.JSONDecodeError, OSError) as exc:
                dirty.append(
                    DirtyItem(
                        raw_data=None,
                        errors=[f"failed to read file: {exc}"],
                        source_file=filepath,
                    )
                )
                continue

            for raw in records:
                total += 1
                errors: List[str] = []

                if not isinstance(raw, dict):
                    dirty.append(
                        DirtyItem(
                            raw_data=raw,
                            errors=["record is not a dict"],
                            source_file=filepath,
                        )
                    )
                    continue

                for req_field in ("plugin_id", "name", "author_id"):
                    if req_field not in raw or raw[req_field] is None:
                        errors.append(f"missing required field: {req_field}")

                if "plugin_id" in raw and raw["plugin_id"] is not None:
                    pid_err = _validate_plugin_id(raw["plugin_id"])
                    if pid_err:
                        errors.append(pid_err)

                if "version" in raw and raw["version"] is not None:
                    ver_err = _validate_version(raw["version"])
                    if ver_err:
                        errors.append(ver_err)

                if "api_calls" in raw:
                    ac_err = _validate_api_calls(raw["api_calls"])
                    if ac_err:
                        errors.append(ac_err)

                if errors:
                    dirty.append(
                        DirtyItem(raw_data=raw, errors=errors, source_file=filepath)
                    )
                    continue

                plugin_id = raw["plugin_id"]
                if plugin_id in seen_ids:
                    dirty.append(
                        DirtyItem(
                            raw_data=raw,
                            errors=[
                                f"duplicate plugin_id '{plugin_id}', first seen in {seen_ids[plugin_id]}"
                            ],
                            source_file=filepath,
                        )
                    )
                    continue
                seen_ids[plugin_id] = filepath

                api_calls = []
                for ac_raw in raw.get("api_calls", []):
                    api_calls.append(ApiCallRef.from_dict(ac_raw))

                plugin = PluginManifest(
                    plugin_id=plugin_id,
                    name=raw["name"],
                    author_id=raw["author_id"],
                    api_calls=api_calls,
                    version=raw.get("version"),
                    min_host_version=raw.get("min_host_version"),
                    declared_apis=raw.get("declared_apis", []),
                    _source_file=filepath,
                )
                valid.append(plugin)

        stats = {
            "total_records": total,
            "valid": len(valid),
            "dirty": len(dirty),
            "files_processed": len(files),
        }
        return IngestResult(valid_items=valid, dirty_items=dirty, stats=stats)

    def ingest_host_versions(
        self, directory_or_files: str
    ) -> IngestResult[HostVersion]:
        files = _collect_files(directory_or_files)
        valid: List[HostVersion] = []
        dirty: List[DirtyItem] = []
        total = 0

        for filepath in files:
            try:
                records = _load_json_file(filepath)
            except (json.JSONDecodeError, OSError) as exc:
                dirty.append(
                    DirtyItem(
                        raw_data=None,
                        errors=[f"failed to read file: {exc}"],
                        source_file=filepath,
                    )
                )
                continue

            for raw in records:
                total += 1
                errors: List[str] = []

                if not isinstance(raw, dict):
                    dirty.append(
                        DirtyItem(
                            raw_data=raw,
                            errors=["record is not a dict"],
                            source_file=filepath,
                        )
                    )
                    continue

                if "version" not in raw or raw["version"] is None:
                    errors.append("missing required field: version")

                if errors:
                    dirty.append(
                        DirtyItem(raw_data=raw, errors=errors, source_file=filepath)
                    )
                    continue

                hv = HostVersion(
                    version=raw["version"],
                    released_apis=raw.get("released_apis", []),
                    deprecated_apis=raw.get("deprecated_apis", []),
                    removed_apis=raw.get("removed_apis", []),
                    alias_map=raw.get("alias_map", {}),
                    _source_file=filepath,
                )
                valid.append(hv)

        stats = {
            "total_records": total,
            "valid": len(valid),
            "dirty": len(dirty),
            "files_processed": len(files),
        }
        return IngestResult(valid_items=valid, dirty_items=dirty, stats=stats)

    def ingest_authors(self, directory_or_files: str) -> IngestResult[Author]:
        files = _collect_files(directory_or_files)
        valid: List[Author] = []
        dirty: List[DirtyItem] = []
        total = 0

        for filepath in files:
            try:
                records = _load_json_file(filepath)
            except (json.JSONDecodeError, OSError) as exc:
                dirty.append(
                    DirtyItem(
                        raw_data=None,
                        errors=[f"failed to read file: {exc}"],
                        source_file=filepath,
                    )
                )
                continue

            for raw in records:
                total += 1
                errors: List[str] = []

                if not isinstance(raw, dict):
                    dirty.append(
                        DirtyItem(
                            raw_data=raw,
                            errors=["record is not a dict"],
                            source_file=filepath,
                        )
                    )
                    continue

                for req_field in ("author_id", "name", "email"):
                    if req_field not in raw or raw[req_field] is None:
                        errors.append(f"missing required field: {req_field}")

                if errors:
                    dirty.append(
                        DirtyItem(raw_data=raw, errors=errors, source_file=filepath)
                    )
                    continue

                author = Author(
                    author_id=raw["author_id"],
                    name=raw["name"],
                    email=raw["email"],
                    plugin_ids=raw.get("plugin_ids", []),
                    _source_file=filepath,
                )
                valid.append(author)

        stats = {
            "total_records": total,
            "valid": len(valid),
            "dirty": len(dirty),
            "files_processed": len(files),
        }
        return IngestResult(valid_items=valid, dirty_items=dirty, stats=stats)

    def ingest_test_results(
        self, directory_or_files: str
    ) -> IngestResult[TestResult]:
        files = _collect_files(directory_or_files)
        valid: List[TestResult] = []
        dirty: List[DirtyItem] = []
        total = 0

        for filepath in files:
            try:
                records = _load_json_file(filepath)
            except (json.JSONDecodeError, OSError) as exc:
                dirty.append(
                    DirtyItem(
                        raw_data=None,
                        errors=[f"failed to read file: {exc}"],
                        source_file=filepath,
                    )
                )
                continue

            for raw in records:
                total += 1
                errors: List[str] = []

                if not isinstance(raw, dict):
                    dirty.append(
                        DirtyItem(
                            raw_data=raw,
                            errors=["record is not a dict"],
                            source_file=filepath,
                        )
                    )
                    continue

                for req_field in ("plugin_id", "host_version", "status"):
                    if req_field not in raw or raw[req_field] is None:
                        errors.append(f"missing required field: {req_field}")

                if "status" in raw and raw["status"] is not None:
                    st_err = _validate_test_status(raw["status"])
                    if st_err:
                        errors.append(st_err)

                if errors:
                    dirty.append(
                        DirtyItem(raw_data=raw, errors=errors, source_file=filepath)
                    )
                    continue

                tr = TestResult(
                    plugin_id=raw["plugin_id"],
                    host_version=raw["host_version"],
                    status=TestStatus(raw["status"]),
                    tested_apis=raw.get("tested_apis", []),
                    timestamp=raw.get("timestamp"),
                    notes=raw.get("notes"),
                    _source_file=filepath,
                )
                valid.append(tr)

        stats = {
            "total_records": total,
            "valid": len(valid),
            "dirty": len(dirty),
            "files_processed": len(files),
        }
        return IngestResult(valid_items=valid, dirty_items=dirty, stats=stats)
