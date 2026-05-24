import hashlib
from pathlib import Path
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict

from .models.dependency import DependencyCoordinate, DependencyType
from .models.version_catalog import VersionCatalog
from .models.replacement import (
    ReplacementRule,
    ReplacementChain,
    ReplacementResult,
)
from .models.conflict import Conflict, ConflictType, ConflictSeverity
from .parsers.gradle_parser import GradleFile


class DependencyProcessor:
    def __init__(
        self,
        gradle_files: List[GradleFile],
        version_catalogs: List[VersionCatalog],
        rules: List[ReplacementRule],
    ):
        self.gradle_files = gradle_files
        self.version_catalogs = version_catalogs
        self.rules = rules
        self.all_dependencies: List[DependencyCoordinate] = []
        self.all_plugins: List[DependencyCoordinate] = []
        self.conflicts: List[Conflict] = []

    def collect_all_dependencies(self) -> None:
        for gf in self.gradle_files:
            self.all_dependencies.extend(gf.dependencies)
            self.all_plugins.extend(gf.plugins)
            self.all_dependencies.extend(gf.platforms)

        for vc in self.version_catalogs:
            for lib_name, lib in vc.libraries.items():
                version = vc.get_library_version(lib_name)
                dep = DependencyCoordinate(
                    group=lib.group,
                    name=lib.artifact,
                    version=version,
                    type=DependencyType.LIBRARY,
                    source_file=lib.source_file,
                    is_managed=True,
                )
                self.all_dependencies.append(dep)

            for plugin_name, plugin in vc.plugins.items():
                version = vc.get_plugin_version(plugin_name)
                dep = DependencyCoordinate(
                    name=plugin.id,
                    version=version,
                    type=DependencyType.PLUGIN,
                    source_file=plugin.source_file,
                    is_managed=True,
                )
                self.all_plugins.append(dep)

    def normalize_dependencies(self) -> List[DependencyCoordinate]:
        normalized: Dict[str, List[DependencyCoordinate]] = defaultdict(list)

        for dep in self.all_dependencies:
            key = dep.canonical_name
            normalized[key].append(dep)

        result = []
        for canonical_name, deps in normalized.items():
            versions = set(d.version for d in deps if d.version)
            if len(versions) > 1:
                self._add_version_conflict(canonical_name, deps, versions)

            selected = self._select_version(deps)
            result.append(selected)

        return result

    def _select_version(self, deps: List[DependencyCoordinate]) -> DependencyCoordinate:
        version_priority = defaultdict(int)
        for dep in deps:
            if dep.version:
                version_priority[dep.version] += 1
                if dep.is_managed:
                    version_priority[dep.version] += 2
                if not dep.is_dynamic:
                    version_priority[dep.version] += 1

        if version_priority:
            best_version = max(version_priority.keys(), key=lambda v: version_priority[v])
            for dep in deps:
                if dep.version == best_version:
                    return dep

        return deps[0]

    def _add_version_conflict(
        self, canonical_name: str, deps: List[DependencyCoordinate], versions: Set[str]
    ) -> None:
        conflict_id = hashlib.md5(canonical_name.encode()).hexdigest()[:8]
        source_files = list(set(d.source_file for d in deps if d.source_file))

        dep_type = deps[0].type if deps else DependencyType.LIBRARY
        conflict_type = (
            ConflictType.PLUGIN_VERSION_CONFLICT
            if dep_type == DependencyType.PLUGIN
            else ConflictType.VERSION_CONFLICT
        )

        self.conflicts.append(
            Conflict(
                id=f"conflict-{conflict_id}",
                type=conflict_type,
                severity=ConflictSeverity.WARNING,
                message=f"依赖 {canonical_name} 存在多个版本: {', '.join(sorted(versions))}",
                dependencies=deps,
                source_files=source_files,
                suggestion="建议统一使用同一版本，或在 version catalog 中声明管理版本",
            )
        )

    def apply_replacements(self, dependencies: List[DependencyCoordinate]) -> ReplacementResult:
        result = ReplacementResult()

        for dep in dependencies:
            chain = ReplacementChain(original=dep)
            current = dep

            max_iterations = 10
            iterations = 0
            applied_this_run = set()

            while iterations < max_iterations:
                applied = False

                for rule in self.rules:
                    if rule.id in applied_this_run:
                        continue

                    if rule.matches(current):
                        new_dep = rule.apply(current)

                        if new_dep != current:
                            chain.add_step(new_dep, rule.id)
                            applied_this_run.add(rule.id)
                            current = new_dep
                            applied = True
                            break

                if not applied:
                    break

                iterations += 1

                if iterations >= max_iterations:
                    result.warnings.append(
                        f"依赖 {dep.full_coordinate} 可能存在替换循环，已停止继续应用规则"
                    )
                    self.conflicts.append(
                        Conflict(
                            id=f"cycle-{hashlib.md5(dep.full_coordinate.encode()).hexdigest()[:8]}",
                            type=ConflictType.REPLACEMENT_CYCLE,
                            severity=ConflictSeverity.WARNING,
                            message=f"依赖 {dep.full_coordinate} 可能存在替换循环",
                            dependencies=[dep],
                            source_files=[dep.source_file] if dep.source_file else [],
                            suggestion="检查替换规则，避免循环依赖",
                        )
                    )

            result.add_chain(chain)

        return result

    def check_dynamic_versions(self, dependencies: List[DependencyCoordinate]) -> None:
        for dep in dependencies:
            if dep.is_dynamic:
                conflict_id = hashlib.md5(dep.full_coordinate.encode()).hexdigest()[:8]
                self.conflicts.append(
                    Conflict(
                        id=f"dynamic-{conflict_id}",
                        type=ConflictType.DYNAMIC_VERSION,
                        severity=ConflictSeverity.INFO,
                        message=f"依赖 {dep.full_coordinate} 使用动态版本",
                        dependencies=[dep],
                        source_files=[dep.source_file] if dep.source_file else [],
                        suggestion="建议使用固定版本以确保构建可重复性",
                    )
                )

    def check_cross_source_conflicts(self) -> None:
        all_deps = self.all_dependencies + self.all_plugins
        canonical_map: Dict[str, List[DependencyCoordinate]] = defaultdict(list)

        for dep in all_deps:
            canonical_map[dep.canonical_name].append(dep)

        for canonical_name, deps in canonical_map.items():
            sources = set()
            for dep in deps:
                if dep.source_file:
                    src = Path(dep.source_file).name
                    if src.endswith(".toml"):
                        sources.add("version catalog")
                    else:
                        sources.add("build.gradle")

            if len(sources) > 1:
                conflict_id = hashlib.md5(canonical_name.encode()).hexdigest()[:8]
                self.conflicts.append(
                    Conflict(
                        id=f"cross-{conflict_id}",
                        type=ConflictType.CROSS_SOURCE_CONFLICT,
                        severity=ConflictSeverity.WARNING,
                        message=f"依赖 {canonical_name} 在多个源中声明: {', '.join(sources)}",
                        dependencies=deps,
                        source_files=list(set(d.source_file for d in deps if d.source_file)),
                        suggestion="建议统一在 version catalog 中管理依赖版本",
                    )
                )

    def process(self) -> Tuple[ReplacementResult, List[Conflict]]:
        self.collect_all_dependencies()
        normalized = self.normalize_dependencies()
        self.check_dynamic_versions(normalized)
        self.check_cross_source_conflicts()
        result = self.apply_replacements(normalized)
        return result, self.conflicts
