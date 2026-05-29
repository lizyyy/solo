import csv
import json
import os
from typing import Dict, Any, Optional

from .models import CompatibilityReport, CompatEntry, RiskLevel


class ReportExporter:
    def __init__(
        self,
        plugins_source_map: Optional[Dict[str, str]] = None,
        test_results_source_map: Optional[Dict[str, str]] = None,
    ) -> None:
        self._plugins_source_map = plugins_source_map or {}
        self._test_results_source_map = test_results_source_map or {}

    def to_json(self, report: CompatibilityReport, filepath: str) -> None:
        directory = os.path.dirname(filepath)
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, indent=2, ensure_ascii=False)

    def to_csv(self, report: CompatibilityReport, filepath: str) -> None:
        directory = os.path.dirname(filepath)
        if directory:
            os.makedirs(directory, exist_ok=True)
        fieldnames = [
            "report_id",
            "host_version",
            "plugin_id",
            "compatible",
            "risk_level",
            "broken_apis",
            "alias_apis",
            "undeclared_version",
            "test_coverage",
        ]
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for entry in report.entries:
                writer.writerow(
                    {
                        "report_id": report.report_id,
                        "host_version": report.host_version,
                        "plugin_id": entry.plugin_id,
                        "compatible": entry.compatible,
                        "risk_level": entry.risk_level.value,
                        "broken_apis": ";".join(entry.broken_apis),
                        "alias_apis": ";".join(entry.alias_apis),
                        "undeclared_version": entry.undeclared_version,
                        "test_coverage": entry.test_coverage,
                    }
                )

    def to_markdown(self, report: CompatibilityReport, filepath: str) -> None:
        directory = os.path.dirname(filepath)
        if directory:
            os.makedirs(directory, exist_ok=True)
        lines: list[str] = []
        lines.append(f"# Plugin Compatibility Report")
        lines.append("")
        lines.append(f"- **Report ID**: {report.report_id}")
        lines.append(f"- **Generated At**: {report.generated_at}")
        lines.append(f"- **Host Version**: {report.host_version}")
        lines.append("")

        lines.append("## Risk Summary")
        lines.append("")
        lines.append("| Risk Level | Count |")
        lines.append("|------------|-------|")
        for level in ("critical", "high", "medium", "low"):
            count = report.risk_summary.get(level, 0)
            lines.append(f"| {level} | {count} |")
        lines.append("")

        lines.append("## Per-Plugin Details")
        lines.append("")
        for entry in report.entries:
            lines.append(f"### {entry.plugin_id}")
            lines.append("")
            lines.append(f"- **Compatible**: {entry.compatible}")
            lines.append(f"- **Risk Level**: {entry.risk_level.value}")
            lines.append(f"- **Broken APIs**: {', '.join(entry.broken_apis) if entry.broken_apis else 'None'}")
            lines.append(f"- **Alias APIs**: {', '.join(entry.alias_apis) if entry.alias_apis else 'None'}")
            lines.append(f"- **Undeclared Version**: {entry.undeclared_version}")
            lines.append(f"- **Test Coverage**: {entry.test_coverage}")
            lines.append("")

            if entry.trace.get("score_breakdown"):
                lines.append("**Score Breakdown**:")
                lines.append("")
                for item in entry.trace["score_breakdown"]:
                    lines.append(f"- {item['reason']}: +{item['points']} (total: {item['running_total']})")
                lines.append("")

            if entry.trace.get("threshold_check"):
                tc = entry.trace["threshold_check"]
                lines.append(
                    f"**Threshold Check**: score={tc['score']}, level={tc['level']}"
                )
                lines.append("")
            lines.append("---")
            lines.append("")

        ct = report.calculation_trace
        if ct:
            lines.append("## Calculation Notes")
            lines.append("")
            lines.append(f"- Total plugins scanned: {ct.get('total_plugins_scanned', 0)}")
            lines.append(f"- Plugins with undeclared version: {ct.get('plugins_with_undeclared_version', 0)}")
            lines.append(f"- Plugins with alias APIs: {ct.get('plugins_with_alias_apis', 0)}")
            lines.append(f"- Plugins without test coverage: {ct.get('plugins_without_test_coverage', 0)}")
            lines.append(f"- Scoring method version: {ct.get('scoring_method_version', 'unknown')}")
            lines.append("")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def get_source_trace(
        self, report: CompatibilityReport, plugin_id: str
    ) -> Dict[str, Any]:
        entry = None
        for e in report.entries:
            if e.plugin_id == plugin_id:
                entry = e
                break

        if entry is None:
            return {"error": f"plugin_id '{plugin_id}' not found in report"}

        trace: Dict[str, Any] = {
            "report_id": report.report_id,
            "host_version": report.host_version,
            "plugin_id": plugin_id,
            "compat_entry": entry.to_dict(),
            "source_files": {},
        }

        plugin_source = self._plugins_source_map.get(plugin_id)
        if plugin_source:
            trace["source_files"]["plugin_manifest"] = plugin_source

        test_source = self._test_results_source_map.get(plugin_id)
        if test_source:
            trace["source_files"]["test_result"] = test_source

        if entry.trace.get("scan_trace"):
            trace["scan_trace"] = entry.trace["scan_trace"]

        return trace

    @classmethod
    def load_report(cls, filepath: str) -> CompatibilityReport:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return CompatibilityReport.from_dict(data)
