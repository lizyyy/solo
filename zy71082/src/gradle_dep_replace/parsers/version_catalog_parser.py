import re
from pathlib import Path
from typing import Dict, Any, Optional

import toml

from ..models.version_catalog import (
    VersionCatalog,
    VersionEntry,
    LibraryEntry,
    PluginEntry,
    BundleEntry,
)


class VersionCatalogParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.path = Path(file_path)

    def parse(self) -> VersionCatalog:
        if not self.path.exists():
            raise FileNotFoundError(f"File not found: {self.file_path}")

        content = self.path.read_text(encoding="utf-8")
        data = toml.loads(content)

        name = data.get("metadata", {}).get("name", self.path.stem)

        catalog = VersionCatalog(
            name=name,
            source_file=str(self.path.absolute()),
        )

        catalog.versions = self._parse_versions(data.get("versions", {}))
        catalog.libraries = self._parse_libraries(data.get("libraries", {}))
        catalog.plugins = self._parse_plugins(data.get("plugins", {}))
        catalog.bundles = self._parse_bundles(data.get("bundles", {}))

        return catalog

    def _parse_versions(self, versions_data: Dict[str, Any]) -> Dict[str, VersionEntry]:
        versions = {}
        for name, value in versions_data.items():
            version_str = value if isinstance(value, str) else value.get("version", "")
            is_dynamic = self._is_dynamic_version(version_str)

            versions[name] = VersionEntry(
                name=name,
                version=version_str,
                is_dynamic=is_dynamic,
                source_file=str(self.path),
            )
        return versions

    def _parse_libraries(self, libraries_data: Dict[str, Any]) -> Dict[str, LibraryEntry]:
        libraries = {}
        for name, value in libraries_data.items():
            if isinstance(value, str):
                group, artifact, version = self._parse_coordinate(value)
                libraries[name] = LibraryEntry(
                    name=name,
                    group=group,
                    artifact=artifact,
                    version=version,
                    source_file=str(self.path),
                )
            elif isinstance(value, dict):
                module = value.get("module", "")
                group = value.get("group")
                artifact = value.get("artifact", name)

                if module:
                    parts = module.split(":")
                    if len(parts) >= 2:
                        group = parts[0]
                        artifact = parts[1]

                version = None
                version_ref = None

                if "version" in value:
                    version_data = value["version"]
                    if isinstance(version_data, str):
                        version = version_data
                    elif isinstance(version_data, dict):
                        if "ref" in version_data:
                            version_ref = version_data["ref"]
                        elif "version" in version_data:
                            version = version_data["version"]
                        elif "prefer" in version_data:
                            version = version_data["prefer"]

                libraries[name] = LibraryEntry(
                    name=name,
                    group=group,
                    artifact=artifact,
                    version=version,
                    version_ref=version_ref,
                    source_file=str(self.path),
                )
        return libraries

    def _parse_plugins(self, plugins_data: Dict[str, Any]) -> Dict[str, PluginEntry]:
        plugins = {}
        for name, value in plugins_data.items():
            if isinstance(value, str):
                plugins[name] = PluginEntry(
                    name=name,
                    id=value,
                    source_file=str(self.path),
                )
            elif isinstance(value, dict):
                plugin_id = value.get("id", name)
                version = None
                version_ref = None

                if "version" in value:
                    version_data = value["version"]
                    if isinstance(version_data, str):
                        version = version_data
                    elif isinstance(version_data, dict):
                        if "ref" in version_data:
                            version_ref = version_data["ref"]
                        elif "version" in version_data:
                            version = version_data["version"]

                plugins[name] = PluginEntry(
                    name=name,
                    id=plugin_id,
                    version=version,
                    version_ref=version_ref,
                    source_file=str(self.path),
                )
        return plugins

    def _parse_bundles(self, bundles_data: Dict[str, Any]) -> Dict[str, BundleEntry]:
        bundles = {}
        for name, value in bundles_data.items():
            libraries = value if isinstance(value, list) else []
            bundles[name] = BundleEntry(
                name=name,
                libraries=libraries,
                source_file=str(self.path),
            )
        return bundles

    def _parse_coordinate(self, coord: str) -> tuple:
        parts = coord.split(":")
        group = parts[0] if len(parts) > 0 else None
        artifact = parts[1] if len(parts) > 1 else ""
        version = parts[2] if len(parts) > 2 else None
        return group, artifact, version

    def _is_dynamic_version(self, version: str) -> bool:
        if not version:
            return False
        dynamic_patterns = ["+", "(", ")", "[", "]"]
        return any(pattern in version for pattern in dynamic_patterns)
