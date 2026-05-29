import uuid
from datetime import datetime
from typing import List, Dict, Optional

from .models import (
    PluginManifest,
    HostVersion,
    TestResult,
    Author,
    CompatibilityReport,
    CompatEntry,
    RiskLevel,
)
from .scanner import ApiScanner


_THRESHOLD_CRITICAL = 80
_THRESHOLD_HIGH = 50
_THRESHOLD_MEDIUM = 25
_SCORE_REMOVED_API = 40
_SCORE_DEPRECATED_API = 15
_SCORE_UNDECLARED_VERSION = 20
_SCORE_NO_TEST_COVERAGE = 25
_SCORING_METHOD_VERSION = "1.0.0"


def _compute_risk_level(base_score: int) -> RiskLevel:
    if base_score >= _THRESHOLD_CRITICAL:
        return RiskLevel.critical
    if base_score >= _THRESHOLD_HIGH:
        return RiskLevel.high
    if base_score >= _THRESHOLD_MEDIUM:
        return RiskLevel.medium
    return RiskLevel.low


class CompatibilityMatrix:
    def __init__(
        self,
        plugins: List[PluginManifest],
        host_version: HostVersion,
        test_results: Optional[List[TestResult]] = None,
        authors: Optional[List[Author]] = None,
    ) -> None:
        self.plugins = plugins
        self.host_version = host_version
        self.test_results = test_results or []
        self.authors = authors or []

    def compute(self) -> CompatibilityReport:
        scanner = ApiScanner(self.host_version)

        test_by_plugin: Dict[str, TestResult] = {}
        for tr in self.test_results:
            if tr.host_version == self.host_version.version:
                test_by_plugin[tr.plugin_id] = tr

        entries: List[CompatEntry] = []
        risk_summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}

        plugins_with_undeclared_version = 0
        plugins_with_alias_apis = 0
        plugins_without_test_coverage = 0

        for plugin in self.plugins:
            scan_result = scanner.scan_plugin(plugin, test_by_plugin)

            base_score = 0
            score_breakdown: List[Dict[str, any]] = []

            for api in scan_result.broken_apis:
                base_score += _SCORE_REMOVED_API
                score_breakdown.append(
                    {
                        "reason": f"removed_api:{api}",
                        "points": _SCORE_REMOVED_API,
                        "running_total": base_score,
                    }
                )

            for api in scan_result.deprecated_apis:
                base_score += _SCORE_DEPRECATED_API
                score_breakdown.append(
                    {
                        "reason": f"deprecated_api:{api}",
                        "points": _SCORE_DEPRECATED_API,
                        "running_total": base_score,
                    }
                )

            if scan_result.undeclared_version:
                base_score += _SCORE_UNDECLARED_VERSION
                score_breakdown.append(
                    {
                        "reason": "undeclared_version",
                        "points": _SCORE_UNDECLARED_VERSION,
                        "running_total": base_score,
                    }
                )

            has_test_coverage = True
            broken_or_deprecated = set(scan_result.broken_apis + scan_result.deprecated_apis)
            if broken_or_deprecated and scan_result.untested_apis:
                has_test_coverage = False
                base_score += _SCORE_NO_TEST_COVERAGE
                score_breakdown.append(
                    {
                        "reason": "no_test_coverage_for_broken_apis",
                        "points": _SCORE_NO_TEST_COVERAGE,
                        "running_total": base_score,
                    }
                )

            risk_level = _compute_risk_level(base_score)
            compatible = base_score == 0

            threshold_check = {
                "score": base_score,
                "level": risk_level.value,
                "thresholds_used": {
                    "critical": _THRESHOLD_CRITICAL,
                    "high": _THRESHOLD_HIGH,
                    "medium": _THRESHOLD_MEDIUM,
                },
            }

            trace = {
                "score_breakdown": score_breakdown,
                "threshold_check": threshold_check,
                "scan_trace": scan_result.trace,
            }

            entry = CompatEntry(
                plugin_id=plugin.plugin_id,
                compatible=compatible,
                risk_level=risk_level,
                broken_apis=scan_result.broken_apis,
                alias_apis=list(scan_result.alias_resolved.keys()),
                undeclared_version=scan_result.undeclared_version,
                test_coverage=has_test_coverage,
                trace=trace,
            )
            entries.append(entry)
            risk_summary[risk_level.value] += 1

            if scan_result.undeclared_version:
                plugins_with_undeclared_version += 1
            if scan_result.alias_resolved:
                plugins_with_alias_apis += 1
            if not has_test_coverage:
                plugins_without_test_coverage += 1

        calculation_trace = {
            "total_plugins_scanned": len(self.plugins),
            "plugins_with_undeclared_version": plugins_with_undeclared_version,
            "plugins_with_alias_apis": plugins_with_alias_apis,
            "plugins_without_test_coverage": plugins_without_test_coverage,
            "scoring_method_version": _SCORING_METHOD_VERSION,
        }

        report_id = str(uuid.uuid4())
        generated_at = datetime.utcnow().isoformat() + "Z"

        return CompatibilityReport(
            report_id=report_id,
            generated_at=generated_at,
            host_version=self.host_version.version,
            entries=entries,
            risk_summary=risk_summary,
            calculation_trace=calculation_trace,
        )
