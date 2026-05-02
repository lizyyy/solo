"""
Report Exporter Module

Exports audit reports in various formats including markdown and CSV.
"""

import csv
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from dataclasses import dataclass


@dataclass
class ExportResult:
    """Result of an export operation."""
    report_path: Optional[str]
    csv_path: Optional[str]
    cleaned_notebooks: List[str]
    errors: List[str]


class ReportExporter:
    """Exports audit results to various formats."""

    def __init__(self, output_dir: Path):
        """
        Initialize the report exporter.

        Args:
            output_dir: Directory to save exported reports
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_markdown_report(
        self,
        notebook_analyses: List[Any],
        scan_results: List[Any],
        audit_score: Any,
        datasets_manifest: Optional[Dict] = None
    ) -> str:
        """
        Export a comprehensive markdown audit report.

        Args:
            notebook_analyses: List of NotebookAnalysis objects
            scan_results: List of ScanResult objects
            audit_score: AuditScore object
            datasets_manifest: Optional datasets manifest

        Returns:
            Path to the generated report
        """
        report_lines = []

        report_lines.append("# Notebook Reproducibility Audit Report")
        report_lines.append("")
        report_lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")

        report_lines.append("## Executive Summary")
        report_lines.append("")
        report_lines.append(f"| Metric | Value |")
        report_lines.append(f"|--------|-------|")
        report_lines.append(f"| Total Notebooks | {len(notebook_analyses)} |")
        report_lines.append(f"| Total Risk Score | {audit_score.total_score} |")
        report_lines.append(f"| Risk Rating | {audit_score.risk_rating} |")
        report_lines.append(f"| Risk Percentage | {audit_score.risk_percentage:.2f}% |")
        report_lines.append(f"| Total Findings | {len(audit_score.risk_findings)} |")
        report_lines.append("")

        if audit_score.category_scores:
            report_lines.append("### Risk by Category")
            report_lines.append("")
            report_lines.append("| Category | Score |")
            report_lines.append("|----------|-------|")
            for cat, score in sorted(audit_score.category_scores.items(), key=lambda x: -x[1]):
                report_lines.append(f"| {cat} | {score} |")
            report_lines.append("")

        if notebook_analyses:
            report_lines.append("## Notebook Details")
            report_lines.append("")

            for analysis in notebook_analyses:
                report_lines.append(f"### {Path(analysis.notebook_path).name}")
                report_lines.append("")
                report_lines.append(f"- **Path:** `{analysis.notebook_path}`")
                report_lines.append(f"- **Total Cells:** {analysis.total_cells}")
                report_lines.append(f"- **Executed Cells:** {analysis.executed_cells}")
                report_lines.append(f"- **Cells with Large Output:** {analysis.large_output_cells}")
                report_lines.append(f"- **Total Output Size:** {analysis.total_output_size:,} bytes")
                report_lines.append("")

                if analysis.execution_order_issues:
                    report_lines.append("#### Execution Order Issues")
                    report_lines.append("")
                    for issue in analysis.execution_order_issues:
                        severity_badge = "🔴" if issue['severity'] == 'error' else "🟡"
                        report_lines.append(f"{severity_badge} Cell {issue['cell_index']}: {issue['message']}")
                    report_lines.append("")

                if analysis.path_escape_issues:
                    report_lines.append("#### Path Escape Issues")
                    report_lines.append("")
                    for issue in analysis.path_escape_issues:
                        report_lines.append(f"- Cell {issue['cell_index']}: Pattern `{issue['pattern']}`")
                        report_lines.append(f"  - Source preview: `{issue['source_preview'][:80]}...`")
                    report_lines.append("")

                if analysis.random_seed_cells:
                    report_lines.append("#### Random Seed Usage")
                    report_lines.append("")
                    for seed_info in analysis.random_seed_cells:
                        report_lines.append(f"- Cell {seed_info['cell_index']}: Found seed setting")
                    report_lines.append("")

                if analysis.library_imports:
                    report_lines.append("#### Library Imports")
                    report_lines.append("```python")
                    for lib in sorted(set(analysis.library_imports)):
                        report_lines.append(f"import {lib}")
                    report_lines.append("```")
                    report_lines.append("")

                if analysis.data_file_refs:
                    report_lines.append("#### Data File References")
                    for ref in analysis.data_file_refs:
                        report_lines.append(f"- `{ref}`")
                    report_lines.append("")

        if scan_results:
            report_lines.append("## Data Reference Audit")
            report_lines.append("")

            total_missing = sum(len(sr.missing_data_files) for sr in scan_results)
            if total_missing > 0:
                report_lines.append(f"⚠️ **{total_missing} missing data files detected**")
                report_lines.append("")

                for sr in scan_results:
                    if sr.missing_data_files:
                        notebook_name = Path(sr.notebook_path).name
                        report_lines.append(f"### {notebook_name}")
                        for missing in sr.missing_data_files:
                            report_lines.append(f"- `{missing.file_path}` (line {missing.line_number})")
                        report_lines.append("")
            else:
                report_lines.append("✅ *All referenced data files found*")
                report_lines.append("")

        if audit_score.risk_findings:
            report_lines.append("## Risk Findings")
            report_lines.append("")

            for level in ['critical', 'error', 'warning', 'info']:
                level_findings = [f for f in audit_score.risk_findings if f.risk_level.value == level]
                if level_findings:
                    emoji = {"critical": "🔴", "error": "🔴", "warning": "🟡", "info": "ℹ️"}.get(level, "•")
                    report_lines.append(f"### {emoji} {level.upper()}")
                    report_lines.append("")
                    for finding in level_findings:
                        location = ""
                        if finding.notebook_path:
                            location = f" in `{Path(finding.notebook_path).name}`"
                        if finding.cell_index is not None:
                            location += f" (cell {finding.cell_index})"
                        report_lines.append(f"- **{finding.rule_name}**{location}")
                        report_lines.append(f"  - {finding.message}")
                    report_lines.append("")

        if datasets_manifest:
            report_lines.append("## Datasets Manifest")
            report_lines.append("")
            report_lines.append("```yaml")
            for key, value in datasets_manifest.items():
                if isinstance(value, dict):
                    report_lines.append(f"{key}:")
                    for k, v in value.items():
                        report_lines.append(f"  {k}: {v}")
                else:
                    report_lines.append(f"{key}: {value}")
            report_lines.append("```")
            report_lines.append("")

        report_lines.append("## Recommendations")
        report_lines.append("")
        if audit_score.risk_percentage > 50:
            report_lines.append("1. 🔴 **High risk detected** - Review all error-level findings before submission")
            report_lines.append("2. Fix execution order issues by re-running cells in sequence")
            report_lines.append("3. Clean large outputs to reduce notebook size")
        if any(f.risk_level.value == 'error' for f in audit_score.risk_findings):
            report_lines.append("4. Address missing data file references")
        if not any('seed' in f.message.lower() for f in audit_score.risk_findings):
            report_lines.append("5. Consider adding random seeds for reproducibility")
        report_lines.append("")

        report_lines.append("---")
        report_lines.append("*Report generated by nb_repro_audit*")

        report_content = '\n'.join(report_lines)
        report_path = self.output_dir / "audit_report.md"

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        return str(report_path)

    def export_missing_assets_csv(
        self,
        scan_results: List[Any]
    ) -> str:
        """
        Export missing assets to CSV file.

        Args:
            scan_results: List of ScanResult objects

        Returns:
            Path to the generated CSV file
        """
        csv_path = self.output_dir / "missing_assets.csv"

        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['notebook', 'file_path', 'reference_type', 'line_number', 'context'])

            for sr in scan_results:
                notebook_name = Path(sr.notebook_path).name
                for missing in sr.missing_data_files:
                    context = missing.context.replace('\n', ' ').replace('"', "'")[:200]
                    writer.writerow([
                        notebook_name,
                        missing.file_path,
                        missing.reference_type,
                        missing.line_number or '',
                        context
                    ])

        return str(csv_path)

    def export_full_report(
        self,
        notebook_analyses: List[Any],
        scan_results: List[Any],
        audit_score: Any,
        datasets_manifest: Optional[Dict] = None
    ) -> ExportResult:
        """
        Export all reports at once.

        Args:
            notebook_analyses: List of NotebookAnalysis objects
            scan_results: List of ScanResult objects
            audit_score: AuditScore object
            datasets_manifest: Optional datasets manifest

        Returns:
            ExportResult with paths to all generated files
        """
        result = ExportResult(
            report_path=None,
            csv_path=None,
            cleaned_notebooks=[],
            errors=[]
        )

        try:
            result.report_path = self.export_markdown_report(
                notebook_analyses, scan_results, audit_score, datasets_manifest
            )
        except Exception as e:
            result.errors.append(f"Failed to export markdown report: {str(e)}")

        try:
            result.csv_path = self.export_missing_assets_csv(scan_results)
        except Exception as e:
            result.errors.append(f"Failed to export CSV: {str(e)}")

        return result

    def generate_summary_table(
        self,
        notebook_analyses: List[Any],
        scan_results: List[Any]
    ) -> str:
        """Generate a summary table for console output."""
        lines = []
        lines.append("")
        lines.append("=" * 80)
        lines.append("NOTEBOOK AUDIT SUMMARY")
        lines.append("=" * 80)
        lines.append("")

        for analysis in notebook_analyses:
            name = Path(analysis.notebook_path).name
            lines.append(f"Notebook: {name}")
            lines.append(f"  Cells: {analysis.executed_cells}/{analysis.total_cells} executed")
            lines.append(f"  Execution Issues: {len(analysis.execution_order_issues)}")
            lines.append(f"  Path Escapes: {len(analysis.path_escape_issues)}")
            lines.append(f"  Large Outputs: {analysis.large_output_cells}")
            lines.append(f"  Random Seeds: {len(analysis.random_seed_cells)}")
            lines.append("")

        if scan_results:
            total_missing = sum(len(sr.missing_data_files) for sr in scan_results)
            lines.append(f"Missing Data Files: {total_missing}")

        lines.append("=" * 80)

        return '\n'.join(lines)
