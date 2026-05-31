from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional

from .models import LicenseEntry, EvidenceRef, EvidenceType


class DependencyScanner:
    def __init__(self, base_path: str):
        self.base_path = base_path

    def scan(self, snapshot_id: str = "") -> list[LicenseEntry]:
        entries: list[LicenseEntry] = []
        entries.extend(self._scan_package_json(snapshot_id))
        entries.extend(self._scan_requirements_txt(snapshot_id))
        entries.extend(self._scan_pom_xml(snapshot_id))
        entries.extend(self._scan_go_mod(snapshot_id))
        return entries

    def _scan_package_json(self, snapshot_id: str) -> list[LicenseEntry]:
        entries: list[LicenseEntry] = []
        pkg_path = os.path.join(self.base_path, "package.json")
        if not os.path.isfile(pkg_path):
            return entries

        with open(pkg_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        deps = {}
        deps.update(data.get("dependencies", {}))
        deps.update(data.get("devDependencies", {}))

        for name, version_spec in deps.items():
            version = self._clean_version(str(version_spec))
            license_type = self._detect_license_from_node_modules(name)
            refs = []
            if snapshot_id:
                refs.append(
                    EvidenceRef(
                        evidence_type=EvidenceType.DIRECTORY_SNAPSHOT,
                        record_id=snapshot_id,
                        detail=f"package.json dependency: {name}@{version_spec}",
                    )
                )
            entries.append(
                LicenseEntry(
                    package_name=name,
                    version=version,
                    license_type=license_type,
                    source_file="package.json",
                    evidence_refs=refs,
                )
            )
        return entries

    def _scan_requirements_txt(self, snapshot_id: str) -> list[LicenseEntry]:
        entries: list[LicenseEntry] = []
        req_path = os.path.join(self.base_path, "requirements.txt")
        if not os.path.isfile(req_path):
            return entries

        with open(req_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        pattern = re.compile(r"^([a-zA-Z0-9_\-.]+)\s*([>=<~!]+\s*.+)?$")
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue
            match = pattern.match(line)
            if not match:
                continue
            name = match.group(1)
            version = self._clean_version(match.group(2) or "unknown")
            refs = []
            if snapshot_id:
                refs.append(
                    EvidenceRef(
                        evidence_type=EvidenceType.DIRECTORY_SNAPSHOT,
                        record_id=snapshot_id,
                        detail=f"requirements.txt entry: {line}",
                    )
                )
            entries.append(
                LicenseEntry(
                    package_name=name,
                    version=version,
                    license_type="unknown",
                    source_file="requirements.txt",
                    evidence_refs=refs,
                )
            )
        return entries

    def _scan_pom_xml(self, snapshot_id: str) -> list[LicenseEntry]:
        entries: list[LicenseEntry] = []
        pom_path = os.path.join(self.base_path, "pom.xml")
        if not os.path.isfile(pom_path):
            return entries

        with open(pom_path, "r", encoding="utf-8") as f:
            content = f.read()

        dep_pattern = re.compile(
            r"<dependency>\s*<groupId>([^<]+)</groupId>\s*"
            r"<artifactId>([^<]+)</artifactId>\s*"
            r"(?:<version>([^<]+)</version>)?",
            re.DOTALL,
        )
        for match in dep_pattern.finditer(content):
            group_id = match.group(1).strip()
            artifact_id = match.group(2).strip()
            version = self._clean_version(match.group(3) or "unknown")
            pkg_name = f"{group_id}:{artifact_id}"
            refs = []
            if snapshot_id:
                refs.append(
                    EvidenceRef(
                        evidence_type=EvidenceType.DIRECTORY_SNAPSHOT,
                        record_id=snapshot_id,
                        detail=f"pom.xml dependency: {pkg_name}",
                    )
                )
            entries.append(
                LicenseEntry(
                    package_name=pkg_name,
                    version=version,
                    license_type="unknown",
                    source_file="pom.xml",
                    evidence_refs=refs,
                )
            )
        return entries

    def _scan_go_mod(self, snapshot_id: str) -> list[LicenseEntry]:
        entries: list[LicenseEntry] = []
        go_mod_path = os.path.join(self.base_path, "go.mod")
        if not os.path.isfile(go_mod_path):
            return entries

        with open(go_mod_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        require_pattern = re.compile(r"^\s*([a-zA-Z0-9./\-]+)\s+(v[\d.]+(?:-\w+)?)")
        in_require_block = False

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("require ("):
                in_require_block = True
                continue
            if in_require_block and stripped == ")":
                in_require_block = False
                continue
            if in_require_block or stripped.startswith("require "):
                match = require_pattern.match(stripped)
                if match:
                    pkg_name = match.group(1)
                    version = match.group(2)
                    refs = []
                    if snapshot_id:
                        refs.append(
                            EvidenceRef(
                                evidence_type=EvidenceType.DIRECTORY_SNAPSHOT,
                                record_id=snapshot_id,
                                detail=f"go.mod require: {pkg_name}@{version}",
                            )
                        )
                    entries.append(
                        LicenseEntry(
                            package_name=pkg_name,
                            version=version,
                            license_type="unknown",
                            source_file="go.mod",
                            evidence_refs=refs,
                        )
                    )
        return entries

    def _clean_version(self, version: str) -> str:
        version = version.strip()
        version = re.sub(r"^[>=<~!]+\s*", "", version)
        return version or "unknown"

    def _detect_license_from_node_modules(self, package_name: str) -> str:
        license_path = os.path.join(
            self.base_path, "node_modules", package_name, "LICENSE"
        )
        mit_path = os.path.join(
            self.base_path, "node_modules", package_name, "LICENSE-MIT"
        )
        for path in [license_path, mit_path]:
            if os.path.isfile(path):
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()[:2000].lower()
                    if "mit license" in content or "mit license" in content:
                        return "MIT"
                    if "apache license" in content:
                        return "Apache-2.0"
                    if "gnu general public license" in content:
                        return "GPL"
                    if "bsd" in content:
                        return "BSD"
                except Exception:
                    pass

        pkg_json_path = os.path.join(
            self.base_path, "node_modules", package_name, "package.json"
        )
        if os.path.isfile(pkg_json_path):
            try:
                with open(pkg_json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                lic = data.get("license", "")
                if lic:
                    return str(lic)
            except Exception:
                pass

        return "unknown"
