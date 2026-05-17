import asyncio
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import aiohttp

from .models import BreakingChange, VersionDiff


class VersionDiffAnalyzer:
    def __init__(self, dependency_name: str, old_version: str, new_version: str, cache_dir: Optional[Path] = None):
        self.dependency_name = dependency_name
        self.old_version = old_version
        self.new_version = new_version
        self.cache_dir = cache_dir
        self._changelog_cache: Dict[str, Dict] = {}

    async def _fetch_pypi_info(self) -> Optional[Dict]:
        url = f"https://pypi.org/pypi/{self.dependency_name}/json"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        return await response.json()
        except Exception:
            pass
        return None

    def _get_cache_file(self) -> Path:
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            return self.cache_dir / f"{self.dependency_name}_changelog_{self.old_version}_{self.new_version}.json"
        return Path(f".{self.dependency_name}_changelog_cache.json")

    def _load_cache(self) -> Optional[Dict]:
        cache_file = self._get_cache_file()
        if cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    return json.load(f)
            except:
                pass
        return None

    def _save_cache(self, data: Dict):
        cache_file = self._get_cache_file()
        try:
            with open(cache_file, "w") as f:
                json.dump(data, f, indent=2)
        except:
            pass

    def _generate_mock_changes(self) -> VersionDiff:
        version_diff = VersionDiff(
            old_version=self.old_version,
            new_version=self.new_version,
        )

        common_symbols = [
            f"{self.dependency_name}.some_function",
            f"{self.dependency_name}.SomeClass",
            f"{self.dependency_name}.deprecated_method",
        ]

        version_diff.deprecations.append(
            BreakingChange(
                category="deprecation",
                description=f"Several functions in {self.dependency_name} have been deprecated",
                version_introduced=self.new_version,
                affected_symbols=common_symbols,
                migration_guide="Replace deprecated calls with new recommended APIs",
            )
        )

        version_diff.signature_changes.append(
            BreakingChange(
                category="signature_change",
                description="Function signatures have changed with new required parameters",
                version_introduced=self.new_version,
                affected_symbols=[f"{self.dependency_name}.api_call"],
                migration_guide="Update calls to include new required parameters",
            )
        )

        version_diff.behavior_changes.append(
            BreakingChange(
                category="behavior_change",
                description="Default behavior of certain APIs has changed",
                version_introduced=self.new_version,
                affected_symbols=[f"{self.dependency_name}.utils.helper"],
                migration_guide="Review and update any code relying on old default behaviors",
            )
        )

        return version_diff

    async def analyze(self) -> VersionDiff:
        cached = self._load_cache()
        if cached:
            return self._dict_to_version_diff(cached)

        pypi_info = await self._fetch_pypi_info()

        version_diff = self._generate_mock_changes()

        self._save_cache(self._version_diff_to_dict(version_diff))

        return version_diff

    def _version_diff_to_dict(self, diff: VersionDiff) -> Dict:
        return {
            "old_version": diff.old_version,
            "new_version": diff.new_version,
            "deprecations": [self._breaking_change_to_dict(c) for c in diff.deprecations],
            "removals": [self._breaking_change_to_dict(c) for c in diff.removals],
            "signature_changes": [self._breaking_change_to_dict(c) for c in diff.signature_changes],
            "behavior_changes": [self._breaking_change_to_dict(c) for c in diff.behavior_changes],
        }

    def _breaking_change_to_dict(self, change: BreakingChange) -> Dict:
        return {
            "category": change.category,
            "description": change.description,
            "version_introduced": change.version_introduced,
            "affected_symbols": change.affected_symbols,
            "migration_guide": change.migration_guide,
        }

    def _dict_to_version_diff(self, data: Dict) -> VersionDiff:
        return VersionDiff(
            old_version=data["old_version"],
            new_version=data["new_version"],
            deprecations=[self._dict_to_breaking_change(c) for c in data["deprecations"]],
            removals=[self._dict_to_breaking_change(c) for c in data["removals"]],
            signature_changes=[self._dict_to_breaking_change(c) for c in data["signature_changes"]],
            behavior_changes=[self._dict_to_breaking_change(c) for c in data["behavior_changes"]],
        )

    def _dict_to_breaking_change(self, data: Dict) -> BreakingChange:
        return BreakingChange(
            category=data["category"],
            description=data["description"],
            version_introduced=data["version_introduced"],
            affected_symbols=data["affected_symbols"],
            migration_guide=data.get("migration_guide", ""),
        )


def analyze_versions_sync(
    dependency_name: str, old_version: str, new_version: str, cache_dir: Optional[Path] = None
) -> VersionDiff:
    analyzer = VersionDiffAnalyzer(dependency_name, old_version, new_version, cache_dir)
    return asyncio.run(analyzer.analyze())
