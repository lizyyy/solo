from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

from .models import PluginManifest, HostVersion, TestResult, TestStatus


@dataclass
class ScanResult:
    plugin_id: str
    broken_apis: List[str] = field(default_factory=list)
    deprecated_apis: List[str] = field(default_factory=list)
    alias_resolved: Dict[str, str] = field(default_factory=dict)
    undeclared_version: bool = False
    untested_apis: List[str] = field(default_factory=list)
    trace: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plugin_id": self.plugin_id,
            "broken_apis": list(self.broken_apis),
            "deprecated_apis": list(self.deprecated_apis),
            "alias_resolved": dict(self.alias_resolved),
            "undeclared_version": self.undeclared_version,
            "untested_apis": list(self.untested_apis),
            "trace": dict(self.trace),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ScanResult":
        return cls(
            plugin_id=d["plugin_id"],
            broken_apis=d.get("broken_apis", []),
            deprecated_apis=d.get("deprecated_apis", []),
            alias_resolved=d.get("alias_resolved", {}),
            undeclared_version=d.get("undeclared_version", False),
            untested_apis=d.get("untested_apis", []),
            trace=d.get("trace", {}),
        )


class ApiScanner:
    def __init__(self, host_version: HostVersion) -> None:
        self.host_version = host_version

    def scan_plugin(
        self,
        plugin: PluginManifest,
        test_results: Optional[Dict[str, TestResult]] = None,
    ) -> ScanResult:
        removed_set = set(self.host_version.removed_apis)
        deprecated_set = set(self.host_version.deprecated_apis)
        alias_map = self.host_version.alias_map

        broken_apis: List[str] = []
        deprecated_apis: List[str] = []
        alias_resolved: Dict[str, str] = {}
        trace: Dict[str, Any] = {
            "api_checks": [],
            "alias_resolutions": [],
            "version_check": {},
        }

        all_resolved_apis: Dict[str, str] = {}

        for api_call in plugin.api_calls:
            api_name = api_call.api_name
            resolved_name = api_name
            is_alias = False

            if api_name in alias_map:
                resolved_name = alias_map[api_name]
                is_alias = True
                alias_resolved[api_name] = resolved_name
                trace["alias_resolutions"].append(
                    {
                        "original": api_name,
                        "canonical": resolved_name,
                        "call_site": api_call.call_site,
                    }
                )

            all_resolved_apis[api_name] = resolved_name

            check_entry = {
                "api_name": api_name,
                "resolved_name": resolved_name,
                "is_alias": is_alias,
                "in_removed": resolved_name in removed_set,
                "in_deprecated": resolved_name in deprecated_set,
            }
            trace["api_checks"].append(check_entry)

            if resolved_name in removed_set:
                broken_apis.append(resolved_name)
            elif resolved_name in deprecated_set:
                deprecated_apis.append(resolved_name)

        undeclared_version = False
        if plugin.version is None or (isinstance(plugin.version, str) and plugin.version.strip() == ""):
            undeclared_version = True
            trace["version_check"]["version"] = "missing or empty"
        else:
            trace["version_check"]["version"] = plugin.version

        if plugin.min_host_version is None:
            trace["version_check"]["min_host_version"] = "not declared"
        else:
            trace["version_check"]["min_host_version"] = plugin.min_host_version

        untested_apis: List[str] = []
        if test_results is not None:
            plugin_tests = test_results.get(plugin.plugin_id)
            if plugin_tests is not None:
                tested_set = set(plugin_tests.tested_apis)
                for api_name, resolved_name in all_resolved_apis.items():
                    if resolved_name in broken_apis or resolved_name in deprecated_apis:
                        if resolved_name not in tested_set and api_name not in tested_set:
                            untested_apis.append(resolved_name)
                trace["test_coverage"] = {
                    "test_result_found": True,
                    "test_status": plugin_tests.status.value,
                    "tested_apis_count": len(tested_set),
                    "untested_broken_or_deprecated": list(untested_apis),
                }
            else:
                problematic = list(set(broken_apis + deprecated_apis))
                untested_apis = problematic
                trace["test_coverage"] = {
                    "test_result_found": False,
                    "untested_broken_or_deprecated": problematic,
                }
        else:
            trace["test_coverage"] = {"test_results_provided": False}

        return ScanResult(
            plugin_id=plugin.plugin_id,
            broken_apis=broken_apis,
            deprecated_apis=deprecated_apis,
            alias_resolved=alias_resolved,
            undeclared_version=undeclared_version,
            untested_apis=untested_apis,
            trace=trace,
        )
