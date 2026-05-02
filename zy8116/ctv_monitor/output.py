"""Output generators for deviations CSV, report, and timeline HTML."""

import csv
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

from .core import Deviation, DeviationType, Subject
from .engine import VisitWindowEngine


class OutputGenerator:
    """Generator for all output artifacts."""

    def __init__(self, engine: VisitWindowEngine, output_dir: Path):
        self.engine = engine
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_deviations_csv(self, site_id: Optional[str] = None) -> Path:
        """Generate deviations CSV file.
        
        If site_id is provided, generate only for that site.
        Otherwise generate for all deviations.
        """
        deviations = self.engine.deviations
        
        if site_id:
            deviations = [d for d in deviations if d.site_id == site_id]
            filename = f"deviations_{site_id}.csv"
        else:
            filename = "deviations_all.csv"
        
        file_path = self.output_dir / filename
        
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "deviation_id",
                "subject_id",
                "site_id",
                "deviation_type",
                "visit_name",
                "actual_date",
                "expected_start",
                "expected_end",
                "days_off_target",
                "protocol_version",
                "amendment_id",
                "severity",
                "description",
            ])
            
            for d in deviations:
                writer.writerow([
                    d.deviation_id,
                    d.subject_id,
                    d.site_id,
                    d.deviation_type.value,
                    d.visit_name or "",
                    d.actual_date.isoformat() if d.actual_date else "",
                    d.expected_start.isoformat() if d.expected_start else "",
                    d.expected_end.isoformat() if d.expected_end else "",
                    d.days_off_target if d.days_off_target is not None else "",
                    d.protocol_version,
                    d.amendment_id or "",
                    d.severity,
                    d.description,
                ])
        
        return file_path

    def generate_report_md(self, reference_date: Optional[date] = None) -> Path:
        """Generate Markdown summary report."""
        if reference_date is None:
            reference_date = date.today()
        
        deviations = self.engine.deviations
        by_site = self.engine.get_deviations_by_site()
        by_type = self.engine.get_deviations_by_type()
        
        total_subjects = len(self.engine.subjects)
        total_deviations = len(deviations)
        
        high_severity = [d for d in deviations if d.severity == "high"]
        medium_severity = [d for d in deviations if d.severity == "medium"]
        low_severity = [d for d in deviations if d.severity == "low"]
        
        report_lines = []
        report_lines.append("# Clinical Trial Visit Window Deviation Report")
        report_lines.append("")
        report_lines.append(f"**Generated:** {date.today().isoformat()}")
        report_lines.append(f"**Reference Date:** {reference_date.isoformat()}")
        report_lines.append("")
        
        report_lines.append("## Summary")
        report_lines.append("")
        report_lines.append(f"- **Total Subjects:** {total_subjects}")
        report_lines.append(f"- **Total Deviations:** {total_deviations}")
        report_lines.append(f"- **High Severity:** {len(high_severity)}")
        report_lines.append(f"- **Medium Severity:** {len(medium_severity)}")
        report_lines.append(f"- **Low Severity:** {len(low_severity)}")
        report_lines.append("")
        
        report_lines.append("## Deviations by Type")
        report_lines.append("")
        report_lines.append("| Type | Count |")
        report_lines.append("|------|-------|")
        for dtype in DeviationType:
            count = len(by_type.get(dtype, []))
            report_lines.append(f"| {dtype.value} | {count} |")
        report_lines.append("")
        
        report_lines.append("## Deviations by Site")
        report_lines.append("")
        report_lines.append("| Site | Total | High | Medium | Low |")
        report_lines.append("|------|-------|------|--------|-----|")
        for site, site_devs in by_site.items():
            high = len([d for d in site_devs if d.severity == "high"])
            medium = len([d for d in site_devs if d.severity == "medium"])
            low = len([d for d in site_devs if d.severity == "low"])
            report_lines.append(f"| {site} | {len(site_devs)} | {high} | {medium} | {low} |")
        report_lines.append("")
        
        report_lines.append("## Detailed Deviations")
        report_lines.append("")
        
        if by_site:
            for site, site_devs in by_site.items():
                report_lines.append(f"### Site: {site}")
                report_lines.append("")
                
                for dtype in DeviationType:
                    type_devs = [d for d in site_devs if d.deviation_type == dtype]
                    if type_devs:
                        report_lines.append(f"#### {dtype.value} ({len(type_devs)})")
                        report_lines.append("")
                        
                        for d in type_devs:
                            severity_badge = f"**[{d.severity.upper()}]**"
                            report_lines.append(f"- {severity_badge} Subject {d.subject_id}")
                            if d.visit_name:
                                report_lines.append(f"  - Visit: {d.visit_name}")
                            if d.actual_date:
                                report_lines.append(f"  - Actual: {d.actual_date.isoformat()}")
                            if d.expected_start and d.expected_end:
                                report_lines.append(f"  - Expected: {d.expected_start.isoformat()} to {d.expected_end.isoformat()}")
                            report_lines.append(f"  - {d.description}")
                            report_lines.append("")
        else:
            report_lines.append("No deviations detected.")
            report_lines.append("")
        
        file_path = self.output_dir / "report.md"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))
        
        return file_path

    def generate_timeline_html(self, subject: Subject) -> Path:
        """Generate an HTML timeline for a single subject."""
        summary = self.engine.get_subject_visit_summary(subject)
        deviations = [d for d in self.engine.deviations if d.subject_id == subject.subject_id]
        
        html = self._render_timeline_template(summary, deviations)
        
        filename = f"timeline_{subject.subject_id}.html"
        file_path = self.output_dir / filename
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html)
        
        return file_path

    def _render_timeline_template(self, summary: Dict[str, Any], deviations: List[Deviation]) -> str:
        """Render the HTML timeline template."""
        subject_id = summary["subject_id"]
        site_id = summary["site_id"]
        enroll_date = summary["enrollment_date"]
        protocol_version = summary["protocol_version"]
        
        visits_html_parts = []
        min_date = enroll_date
        max_date = enroll_date
        
        for visit in summary["visits"]:
            visit_name = visit["visit_name"]
            target_date = visit["target_date"]
            early_bound = visit["early_bound"]
            late_bound = visit["late_bound"]
            actual_visits = visit["actual_visits"]
            is_mandatory = visit["is_mandatory"]
            
            if early_bound < min_date:
                min_date = early_bound
            if late_bound > max_date:
                max_date = late_bound
            
            for av in actual_visits:
                if av["date"] < min_date:
                    min_date = av["date"]
                if av["date"] > max_date:
                    max_date = av["date"]
            
            visit_devs = [d for d in deviations if d.visit_name == visit_name]
            has_deviation = len(visit_devs) > 0
            
            status_class = "visit-ok"
            status_text = "On Time"
            
            if has_deviation:
                for vd in visit_devs:
                    if vd.deviation_type == DeviationType.MISSED_VISIT:
                        status_class = "visit-missed"
                        status_text = "Missed"
                    elif vd.deviation_type == DeviationType.EARLY_VISIT:
                        status_class = "visit-early"
                        status_text = "Early"
                    elif vd.deviation_type == DeviationType.LATE_VISIT:
                        status_class = "visit-late"
                        status_text = "Late"
                    elif vd.deviation_type == DeviationType.DUPLICATE_VISIT:
                        status_class = "visit-duplicate"
                        status_text = "Duplicate"
            
            actual_dates_html = ""
            if actual_visits:
                actual_dates_html = "<ul class='actual-dates'>"
                for av in actual_visits:
                    date_label = "Missed" if av["is_missed"] else av["date"].isoformat()
                    actual_dates_html += f"<li>{date_label}</li>"
                actual_dates_html += "</ul>"
            
            visits_html_parts.append(f"""
            <div class="visit-row {status_class}">
                <div class="visit-name">
                    <strong>{visit_name}</strong>
                    {"<span class='mandatory-badge'>*</span>" if is_mandatory else ""}
                </div>
                <div class="visit-window">
                    <div class="window-range">
                        <span class="early">{early_bound.isoformat()}</span>
                        <span class="arrow">→</span>
                        <span class="target">Target: {target_date.isoformat()}</span>
                        <span class="arrow">→</span>
                        <span class="late">{late_bound.isoformat()}</span>
                    </div>
                    {actual_dates_html}
                </div>
                <div class="visit-status">
                    <span class="status-badge {status_class}">{status_text}</span>
                </div>
            </div>
            """)
        
        deviations_html = ""
        if deviations:
            deviations_html = """
            <div class="deviations-section">
                <h3>Detected Deviations</h3>
                <table class="deviations-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Visit</th>
                            <th>Severity</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
            """
            
            for d in deviations:
                deviations_html += f"""
                        <tr class="severity-{d.severity}">
                            <td>{d.deviation_type.value}</td>
                            <td>{d.visit_name or 'N/A'}</td>
                            <td><span class="badge-{d.severity}">{d.severity.upper()}</span></td>
                            <td>{d.description}</td>
                        </tr>
                """
            
            deviations_html += """
                    </tbody>
                </table>
            </div>
            """
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visit Timeline - Subject {subject_id}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }}
        .subject-info {{
            display: flex;
            gap: 30px;
            margin-bottom: 30px;
            padding: 15px;
            background: #ecf0f1;
            border-radius: 6px;
        }}
        .info-item {{
            display: flex;
            flex-direction: column;
        }}
        .info-label {{
            font-size: 12px;
            color: #7f8c8d;
            text-transform: uppercase;
            margin-bottom: 4px;
        }}
        .info-value {{
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
        }}
        .visit-timeline {{
            display: flex;
            flex-direction: column;
            gap: 10px;
        }}
        .visit-row {{
            display: grid;
            grid-template-columns: 200px 1fr 120px;
            align-items: center;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #bdc3c7;
            background: #fafafa;
        }}
        .visit-ok {{ border-left-color: #27ae60; }}
        .visit-early {{ border-left-color: #f39c12; }}
        .visit-late {{ border-left-color: #e74c3c; }}
        .visit-missed {{ border-left-color: #8e44ad; background: #f8f1fb; }}
        .visit-duplicate {{ border-left-color: #c0392b; background: #fdecea; }}
        .visit-name {{
            font-weight: 500;
            color: #2c3e50;
        }}
        .mandatory-badge {{
            color: #e74c3c;
            font-size: 14px;
            margin-left: 4px;
        }}
        .window-range {{
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: #7f8c8d;
        }}
        .window-range .target {{
            color: #3498db;
            font-weight: 500;
        }}
        .window-range .early {{ color: #27ae60; }}
        .window-range .late {{ color: #e74c3c; }}
        .actual-dates {{
            margin: 8px 0 0 0;
            padding-left: 20px;
            font-size: 13px;
        }}
        .actual-dates li {{
            color: #2c3e50;
        }}
        .status-badge {{
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .status-badge.visit-ok {{ background: #d5f5e3; color: #27ae60; }}
        .status-badge.visit-early {{ background: #fef9e7; color: #f39c12; }}
        .status-badge.visit-late {{ background: #fadbd8; color: #e74c3c; }}
        .status-badge.visit-missed {{ background: #f5eef8; color: #8e44ad; }}
        .status-badge.visit-duplicate {{ background: #fdecea; color: #c0392b; }}
        .deviations-section {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ecf0f1;
        }}
        .deviations-table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }}
        .deviations-table th,
        .deviations-table td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }}
        .deviations-table th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }}
        .severity-high {{ background: #fdecea; }}
        .severity-medium {{ background: #fef9e7; }}
        .severity-low {{ background: #e8f6f3; }}
        .badge-high {{ background: #e74c3c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
        .badge-medium {{ background: #f39c12; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
        .badge-low {{ background: #1abc9c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }}
        .legend {{
            display: flex;
            gap: 20px;
            margin-top: 30px;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
            font-size: 12px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 6px;
        }}
        .legend-color {{
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Visit Timeline - Subject {subject_id}</h1>
        
        <div class="subject-info">
            <div class="info-item">
                <span class="info-label">Subject ID</span>
                <span class="info-value">{subject_id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Site</span>
                <span class="info-value">{site_id}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Enrollment Date</span>
                <span class="info-value">{enroll_date.isoformat()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Protocol Version</span>
                <span class="info-value">{protocol_version}</span>
            </div>
        </div>
        
        <h2>Visit Schedule</h2>
        <div class="visit-timeline">
            {"".join(visits_html_parts)}
        </div>
        
        {deviations_html}
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #27ae60;"></div>
                <span>On Time</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #f39c12;"></div>
                <span>Early</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #e74c3c;"></div>
                <span>Late</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #8e44ad;"></div>
                <span>Missed</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #c0392b;"></div>
                <span>Duplicate</span>
            </div>
            <div class="legend-item">
                <span style="color: #e74c3c;">*</span>
                <span>= Mandatory Visit</span>
            </div>
        </div>
    </div>
</body>
</html>
"""
        return html

    def generate_all_timelines(self) -> List[Path]:
        """Generate timeline HTML for all subjects."""
        paths = []
        for subject in self.engine.subjects.values():
            path = self.generate_timeline_html(subject)
            paths.append(path)
        return paths

    def generate_all_outputs(
        self,
        reference_date: Optional[date] = None,
        by_site: bool = True,
    ) -> Dict[str, Any]:
        """Generate all output files.
        
        Returns a dict with paths to all generated files.
        """
        outputs: Dict[str, Any] = {
            "deviations_csv": [],
            "report_md": None,
            "timelines": [],
        }
        
        outputs["deviations_csv"].append(self.generate_deviations_csv())
        
        if by_site:
            by_site_devs = self.engine.get_deviations_by_site()
            for site_id in by_site_devs.keys():
                outputs["deviations_csv"].append(self.generate_deviations_csv(site_id))
        
        outputs["report_md"] = self.generate_report_md(reference_date)
        outputs["timelines"] = self.generate_all_timelines()
        
        return outputs
