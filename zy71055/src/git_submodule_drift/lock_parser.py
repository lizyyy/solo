import json
import re
from pathlib import Path
from typing import Dict, Optional, Tuple
import yaml
from .models import LockFile


class LockParseError(Exception):
    pass


class LockParser:
    SUPPORTED_FORMATS = ["json", "yaml", "yml", "txt", "gradle", "makefile", "cmake"]

    @classmethod
    def detect_format(cls, path: Path) -> str:
        suffix = path.suffix.lower().lstrip(".")
        if suffix in cls.SUPPORTED_FORMATS:
            return suffix
        name = path.name.lower()
        if "gradle" in name:
            return "gradle"
        if name in ("makefile", "gnumakefile") or name.endswith(".mk"):
            return "makefile"
        if name.endswith(".cmake") or name == "cmakelists.txt":
            return "cmake"
        return "txt"

    @classmethod
    def parse(cls, path: Path) -> LockFile:
        if not path.exists():
            raise LockParseError(f"Lock file not found: {path}")

        fmt = cls.detect_format(path)
        entries: Dict[str, str] = {}

        try:
            if fmt in ("json",):
                entries = cls._parse_json(path)
            elif fmt in ("yaml", "yml"):
                entries = cls._parse_yaml(path)
            elif fmt == "gradle":
                entries = cls._parse_gradle(path)
            elif fmt == "makefile":
                entries = cls._parse_makefile(path)
            elif fmt == "cmake":
                entries = cls._parse_cmake(path)
            else:
                entries = cls._parse_text(path)
        except Exception as e:
            raise LockParseError(f"Failed to parse {path}: {e}") from e

        normalized = cls._normalize_entries(entries)
        return LockFile(path=path, format=fmt, entries=normalized)

    @classmethod
    def _normalize_entries(cls, entries: Dict[str, str]) -> Dict[str, str]:
        normalized = {}
        for path, commit in entries.items():
            clean_path = path.strip().rstrip("/").replace("\\", "/")
            clean_commit = commit.strip().lower() if commit else ""
            if clean_path and clean_commit:
                normalized[clean_path] = clean_commit
        return normalized

    @classmethod
    def _parse_json(cls, path: Path) -> Dict[str, str]:
        data = json.loads(path.read_text())
        entries: Dict[str, str] = {}

        if isinstance(data, dict):
            if "submodules" in data and isinstance(data["submodules"], dict):
                for sub_path, info in data["submodules"].items():
                    if isinstance(info, dict):
                        entries[sub_path] = info.get("commit") or info.get("revision") or info.get("hash") or ""
                    elif isinstance(info, str):
                        entries[sub_path] = info
            elif "dependencies" in data and isinstance(data["dependencies"], dict):
                for sub_path, info in data["dependencies"].items():
                    if isinstance(info, dict):
                        entries[sub_path] = info.get("commit") or ""
            else:
                for key, value in data.items():
                    if isinstance(value, str) and len(value) in (7, 40) and re.match(r"^[0-9a-f]+$", value):
                        entries[key] = value

        return entries

    @classmethod
    def _parse_yaml(cls, path: Path) -> Dict[str, str]:
        data = yaml.safe_load(path.read_text()) or {}
        entries: Dict[str, str] = {}

        if isinstance(data, dict):
            if "submodules" in data and isinstance(data["submodules"], dict):
                for sub_path, info in data["submodules"].items():
                    if isinstance(info, dict):
                        entries[sub_path] = info.get("commit") or info.get("revision") or ""
                    elif isinstance(info, str):
                        entries[sub_path] = info

        return entries

    @classmethod
    def _parse_text(cls, path: Path) -> Dict[str, str]:
        entries: Dict[str, str] = {}
        content = path.read_text()

        for line in content.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            match = re.match(r'^([0-9a-fA-F]{7,40})\s+(.+)$', line)
            if match:
                commit, sub_path = match.groups()
                entries[sub_path] = commit
                continue

            parts = re.split(r'[\s=:,]+', line, maxsplit=1)
            if len(parts) == 2:
                left, right = parts[0].strip(), parts[1].strip()
                if re.match(r'^[0-9a-fA-F]{7,40}$', left):
                    entries[right] = left
                elif re.match(r'^[0-9a-fA-F]{7,40}$', right):
                    entries[left] = right

        return entries

    @classmethod
    def _parse_gradle(cls, path: Path) -> Dict[str, str]:
        entries: Dict[str, str] = {}
        content = path.read_text()

        patterns = [
            r'commit\s*=\s*["\']([0-9a-fA-F]+)["\'].*?path\s*=\s*["\']([^"\']+)["\']',
            r'path\s*=\s*["\']([^"\']+)["\'].*?commit\s*=\s*["\']([0-9a-fA-F]+)["\']',
            r'git\s*\(\s*["\']([^"\']+)["\'].*?commit\s*["\']([0-9a-fA-F]+)["\']',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, content, re.DOTALL):
                groups = match.groups()
                if len(groups) == 2:
                    if re.match(r'^[0-9a-fA-F]{7,40}$', groups[0]):
                        commit, sub_path = groups
                    else:
                        sub_path, commit = groups
                    entries[sub_path] = commit

        return entries

    @classmethod
    def _parse_makefile(cls, path: Path) -> Dict[str, str]:
        entries: Dict[str, str] = {}
        content = path.read_text()

        for line in content.split("\n"):
            line = line.strip()
            match = re.match(r'^([A-Z0-9_]+)_COMMIT\s*[:?]?=\s*([0-9a-fA-F]+)', line)
            if match:
                var_name, commit = match.groups()
                path_hint = var_name.lower().replace("_", "-")
                entries[path_hint] = commit

        return entries

    @classmethod
    def _parse_cmake(cls, path: Path) -> Dict[str, str]:
        entries: Dict[str, str] = {}
        content = path.read_text()

        patterns = [
            r'FetchContent_Declare\s*\(\s*(\w+).*?GIT_TAG\s+([0-9a-fA-F]+)',
            r'set\s*\(\s*(\w+)_COMMIT\s+([0-9a-fA-F]+)\s*\)',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, content, re.DOTALL | re.IGNORECASE):
                name, commit = match.groups()
                entries[name.lower()] = commit

        return entries
