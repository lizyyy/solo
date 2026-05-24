from typing import Optional, Dict, List, Any
from pydantic import BaseModel, Field


class VersionEntry(BaseModel):
    name: str
    version: str
    is_dynamic: bool = False
    source_file: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "version": self.version,
            "is_dynamic": self.is_dynamic,
            "source_file": self.source_file,
        }


class LibraryEntry(BaseModel):
    name: str
    group: Optional[str] = None
    artifact: str
    version: Optional[str] = None
    version_ref: Optional[str] = None
    source_file: Optional[str] = None

    @property
    def canonical_name(self) -> str:
        if self.group:
            return f"{self.group}:{self.artifact}"
        return self.artifact

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "group": self.group,
            "artifact": self.artifact,
            "version": self.version,
            "version_ref": self.version_ref,
            "canonical_name": self.canonical_name,
            "source_file": self.source_file,
        }


class PluginEntry(BaseModel):
    name: str
    id: str
    version: Optional[str] = None
    version_ref: Optional[str] = None
    source_file: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "version": self.version,
            "version_ref": self.version_ref,
            "source_file": self.source_file,
        }


class BundleEntry(BaseModel):
    name: str
    libraries: List[str] = Field(default_factory=list)
    source_file: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "libraries": self.libraries,
            "source_file": self.source_file,
        }


class VersionCatalog(BaseModel):
    name: str
    source_file: str
    versions: Dict[str, VersionEntry] = Field(default_factory=dict)
    libraries: Dict[str, LibraryEntry] = Field(default_factory=dict)
    plugins: Dict[str, PluginEntry] = Field(default_factory=dict)
    bundles: Dict[str, BundleEntry] = Field(default_factory=dict)

    def get_resolved_version(self, version_ref: str) -> Optional[str]:
        if version_ref in self.versions:
            return self.versions[version_ref].version
        return None

    def get_library_version(self, library_name: str) -> Optional[str]:
        if library_name not in self.libraries:
            return None
        lib = self.libraries[library_name]
        if lib.version:
            return lib.version
        if lib.version_ref:
            return self.get_resolved_version(lib.version_ref)
        return None

    def get_plugin_version(self, plugin_name: str) -> Optional[str]:
        if plugin_name not in self.plugins:
            return None
        plugin = self.plugins[plugin_name]
        if plugin.version:
            return plugin.version
        if plugin.version_ref:
            return self.get_resolved_version(plugin.version_ref)
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "source_file": self.source_file,
            "versions": {k: v.to_dict() for k, v in self.versions.items()},
            "libraries": {k: v.to_dict() for k, v in self.libraries.items()},
            "plugins": {k: v.to_dict() for k, v in self.plugins.items()},
            "bundles": {k: v.to_dict() for k, v in self.bundles.items()},
        }
