"""Report layer for generating CSV details and summary markdown."""

import csv
from pathlib import Path
from typing import Any, Dict, List, Union

from .rules import ValidationIssue


class ReportGenerator:
    def __init__(self, output_dir: Union[str, Path]):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def write_issues_csv(self, issues: List[ValidationIssue], filename: str = "route_issues.csv") -> Path:
        output_path = self.output_dir / filename
        fieldnames = ["route_id", "photo_id", "issue_type", "severity", "message", "details"]
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for issue in issues:
                writer.writerow({
                    "route_id": issue.route_id,
                    "photo_id": issue.photo_id or "",
                    "issue_type": issue.issue_type,
                    "severity": issue.severity,
                    "message": issue.message,
                    "details": str(issue.details) if issue.details else "",
                })
        return output_path

    def write_summary_md(
        self,
        summary: Dict[str, Any],
        coverage: Dict[str, Any],
        filename: str = "summary.md",
    ) -> Path:
        output_path = self.output_dir / filename
        routes = summary.get("routes", {})
        total_photos = sum(r.get("photo_count", 0) for r in routes.values())
        total_issues = sum(len(r.get("issues", [])) for r in routes.values())

        lines = [
            "# Survey Quality Inspection Report",
            "",
            f"**Generated**: {summary.get('generated_at', 'N/A')}",
            f"**Package**: {summary.get('package_name', 'Unknown')}",
            "",
            "## Overview",
            "",
            f"- **Total Routes**: {len(routes)}",
            f"- **Total Photos**: {total_photos}",
            f"- **Total Issues**: {total_issues}",
            "",
            "## Coverage Summary",
            "",
        ]

        for route_id, cov in coverage.items():
            lines.append(f"### Route: {route_id}")
            lines.append(f"- **Status**: {cov.get('status', 'UNKNOWN')}")
            lines.append(f"- **Photos on Route**: {cov.get('photos_on_route', 0)}")
            lines.append(f"- **Coverage**: {cov.get('coverage_percent', 0.0):.1f}%")
            lines.append("")

        lines.append("## Route Details")
        lines.append("")

        for route_id, route_data in routes.items():
            lines.append(f"### Route: {route_id}")
            lines.append(f"- **Photos**: {route_data.get('photo_count', 0)}")
            lines.append(f"- **Issues**: {len(route_data.get('issues', []))}")
            issues = route_data.get("issues", [])
            if issues:
                lines.append("- **Issue Summary**:")
                issue_types: Dict[str, int] = {}
                for issue in issues:
                    issue_types[issue.issue_type] = issue_types.get(issue.issue_type, 0) + 1
                for itype, count in issue_types.items():
                    lines.append(f"  - {itype}: {count}")
            lines.append("")

        lines.append("## Recommendations")
        lines.append("")
        if total_issues == 0:
            lines.append("All routes passed validation. Data quality is acceptable.")
        else:
            high_severity = any(
                issue.severity == "HIGH"
                for r in routes.values()
                for issue in r.get("issues", [])
            )
            if high_severity:
                lines.append("⚠️ **Action Required**: High severity issues detected. Review and re-fly affected routes.")
            else:
                lines.append("✓ Minor issues detected. Review recommendations below.")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return output_path

    def write_route_csv(self, route_id: str, issues: List[ValidationIssue]) -> Path:
        output_path = self.output_dir / f"{route_id}_issues.csv"
        fieldnames = ["photo_id", "issue_type", "severity", "message", "details"]
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for issue in issues:
                writer.writerow({
                    "photo_id": issue.photo_id or "",
                    "issue_type": issue.issue_type,
                    "severity": issue.severity,
                    "message": issue.message,
                    "details": str(issue.details) if issue.details else "",
                })
        return output_path
