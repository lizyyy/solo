import re
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field

from ..models.dependency import DependencyCoordinate, DependencyType


class GradleFile(BaseModel):
    file_path: str
    file_type: str
    dependencies: List[DependencyCoordinate] = Field(default_factory=list)
    plugins: List[DependencyCoordinate] = Field(default_factory=list)
    platforms: List[DependencyCoordinate] = Field(default_factory=list)
    raw_content: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_type": self.file_type,
            "dependencies": [d.to_dict() for d in self.dependencies],
            "plugins": [p.to_dict() for p in self.plugins],
            "platforms": [p.to_dict() for p in self.platforms],
        }


class GradleParser:
    DEPENDENCY_PATTERNS = [
        r'(implementation|api|compileOnly|runtimeOnly|testImplementation|testApi|testCompileOnly|testRuntimeOnly|androidTestImplementation)\s+[\'"]?([^\'"\)\s]+)[\'"]?[,\)]?',
        r'implementation\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
        r'api\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
    ]

    PLUGIN_PATTERNS = [
        r'id\s+[\'"]([^\'"]+)[\'"]\s*(?:version\s+[\'"]([^\'"]+)[\'"])?',
        r'plugins\s*\{\s*id\s+[\'"]([^\'"]+)[\'"]\s*version\s+[\'"]([^\'"]+)[\'"]',
    ]

    PLATFORM_PATTERNS = [
        r'implementation\s+platform\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
        r'implementation\s+enforcedPlatform\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
    ]

    VERSION_REF_PATTERN = r'version\.ref\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)'
    LIBRARY_REF_PATTERN = r'libs\.([a-zA-Z0-9_.]+)'

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.path = Path(file_path)

    def parse(self) -> GradleFile:
        if not self.path.exists():
            raise FileNotFoundError(f"File not found: {self.file_path}")

        content = self.path.read_text(encoding="utf-8")
        file_type = self._detect_file_type()

        gradle_file = GradleFile(
            file_path=str(self.path.absolute()),
            file_type=file_type,
            raw_content=content,
        )

        gradle_file.dependencies = self._parse_dependencies(content)
        gradle_file.plugins = self._parse_plugins(content)
        gradle_file.platforms = self._parse_platforms(content)

        return gradle_file

    def _detect_file_type(self) -> str:
        name = self.path.name
        if name.startswith("build.gradle"):
            return "build"
        elif name.startswith("settings.gradle"):
            return "settings"
        elif "dependency" in name.lower():
            return "dependencies"
        return "unknown"

    def _parse_dependencies(self, content: str) -> List[DependencyCoordinate]:
        dependencies = []
        lines = content.split("\n")

        for line_num, line in enumerate(lines, 1):
            for pattern in self.DEPENDENCY_PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    try:
                        if len(match.groups()) == 2:
                            config = match.group(1)
                            coord_str = match.group(2)
                        else:
                            config = "implementation"
                            coord_str = match.group(1)

                        if coord_str and not coord_str.startswith("libs."):
                            dep = DependencyCoordinate.parse(coord_str, str(self.path))
                            dep.configuration = config
                            dep.source_line = line_num
                            dependencies.append(dep)
                    except (IndexError, ValueError):
                        continue

        return self._deduplicate_dependencies(dependencies)

    def _parse_plugins(self, content: str) -> List[DependencyCoordinate]:
        plugins = []
        lines = content.split("\n")

        for line_num, line in enumerate(lines, 1):
            for pattern in self.PLUGIN_PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    try:
                        plugin_id = match.group(1)
                        version = match.group(2) if len(match.groups()) > 1 and match.group(2) else None

                        dep = DependencyCoordinate(
                            name=plugin_id,
                            version=version,
                            type=DependencyType.PLUGIN,
                            source_file=str(self.path),
                            source_line=line_num,
                        )
                        plugins.append(dep)
                    except (IndexError, ValueError):
                        continue

        return self._deduplicate_dependencies(plugins)

    def _parse_platforms(self, content: str) -> List[DependencyCoordinate]:
        platforms = []
        lines = content.split("\n")

        for line_num, line in enumerate(lines, 1):
            for pattern in self.PLATFORM_PATTERNS:
                matches = re.finditer(pattern, line)
                for match in matches:
                    try:
                        coord_str = match.group(1)
                        dep = DependencyCoordinate.parse(coord_str, str(self.path))
                        dep.type = DependencyType.PLATFORM
                        dep.source_line = line_num
                        platforms.append(dep)
                    except (IndexError, ValueError):
                        continue

        return self._deduplicate_dependencies(platforms)

    def _deduplicate_dependencies(self, deps: List[DependencyCoordinate]) -> List[DependencyCoordinate]:
        seen = set()
        unique = []
        for dep in deps:
            key = (dep.group, dep.name, dep.version, dep.type)
            if key not in seen:
                seen.add(key)
                unique.append(dep)
        return unique

    def find_version_catalog_references(self, content: str) -> List[str]:
        refs = []
        matches = re.finditer(self.LIBRARY_REF_PATTERN, content)
        for match in matches:
            refs.append(match.group(1))
        return list(set(refs))
