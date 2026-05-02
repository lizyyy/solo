import csv
from pathlib import Path
from datetime import datetime
from typing import Optional
from .models import OccupantTimeline, DoorUsage
from .rules import Violation, ViolationType


def export_markdown(
    output_path: Path,
    violations: list[Violation],
    timelines: dict[str, OccupantTimeline],
    total_occupants: int,
    drill_start: float,
    drill_end: float
):
    lines = []
    lines.append("# Evacuation Drill Audit Report")
    lines.append(f"\n**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"\n**Drill Duration:** {drill_end - drill_start:.1f} seconds")
    lines.append(f"\n**Total Occupants:** {total_occupants}")
    lines.append(f"\n**Evacuated:** {sum(1 for t in timelines.values() if t.exit_time)}")
    lines.append(f"\n**Violations Found:** {len(violations)}")

    high_sev = [v for v in violations if v.severity == "high"]
    medium_sev = [v for v in violations if v.severity == "medium"]
    low_sev = [v for v in violations if v.severity == "low"]
    lines.append(f"- High: {len(high_sev)}, Medium: {len(medium_sev)}, Low: {len(low_sev)}")

    if high_sev:
        lines.append("\n## High Severity Violations")
        for v in high_sev:
            lines.append(f"\n### {v.violation_type.value.replace('_', ' ').title()}")
            lines.append(f"- **Occupant:** {v.occupant_name} ({v.occupant_id})")
            lines.append(f"- **Time:** {v.timestamp:.1f}s")
            lines.append(f"- **Location:** {v.location}")
            lines.append(f"- **Details:** {v.details}")

    if medium_sev:
        lines.append("\n## Medium Severity Violations")
        for v in medium_sev:
            lines.append(f"\n### {v.violation_type.value.replace('_', ' ').title()}")
            lines.append(f"- **Occupant:** {v.occupant_name} ({v.occupant_id})")
            lines.append(f"- **Time:** {v.timestamp:.1f}s")
            lines.append(f"- **Location:** {v.location}")
            lines.append(f"- **Details:** {v.details}")

    if low_sev:
        lines.append("\n## Low Severity Violations")
        for v in low_sev:
            lines.append(f"\n### {v.violation_type.value.replace('_', ' ').title()}")
            lines.append(f"- **Occupant:** {v.occupant_name} ({v.occupant_id})")
            lines.append(f"- **Time:** {v.timestamp:.1f}s")
            lines.append(f"- **Location:** {v.location}")
            lines.append(f"- **Details:** {v.details}")

    lines.append("\n## Occupant Summary")
    lines.append("\n| Occupant ID | Name | Floor | Zone | Exit Time | Status |")
    lines.append("|-------------|------|-------|------|-----------|--------|")
    for occ_id, tl in sorted(timelines.items(), key=lambda x: x[1].exit_time or 9999):
        status = "Evacuated" if tl.exit_time else "Stranded"
        exit_str = f"{tl.exit_time:.1f}s" if tl.exit_time else "N/A"
        lines.append(f"| {occ_id} | {tl.name} | {tl.start_floor} | {tl.start_zone} | {exit_str} | {status} |")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def export_csv(output_path: Path, violations: list[Violation]):
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'violation_type', 'severity', 'occupant_id', 'occupant_name',
            'timestamp', 'location', 'details'
        ])
        for v in violations:
            writer.writerow([
                v.violation_type.value,
                v.severity,
                v.occupant_id,
                v.occupant_name,
                f"{v.timestamp:.2f}",
                v.location,
                v.details
            ])


def export_html(
    output_path: Path,
    violations: list[Violation],
    timelines: dict[str, OccupantTimeline],
    total_occupants: int,
    drill_start: float,
    drill_end: float
):
    html_parts = []
    html_parts.append("""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Evacuation Drill Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-box.high { border-left: 4px solid #dc3545; }
        .stat-box.medium { border-left: 4px solid #ffc107; }
        .stat-box.low { border-left: 4px solid #28a745; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { color: #666; font-size: 12px; }
        .violation { background: white; border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .violation.high { border-left: 4px solid #dc3545; }
        .violation.medium { border-left: 4px solid #ffc107; }
        .violation.low { border-left: 4px solid #28a745; }
        .violation-header { font-weight: bold; color: #333; margin-bottom: 5px; }
        .violation-detail { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #007bff; color: white; }
        tr:hover { background: #f5f5f5; }
        .timeline { margin: 20px 0; }
        .timeline-item { display: flex; margin: 5px 0; align-items: center; }
        .timeline-time { width: 80px; color: #007bff; font-weight: bold; }
        .timeline-content { flex: 1; }
        .status-evacuated { color: #28a745; }
        .status-stranded { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Evacuation Drill Audit Report</h1>
""")

    html_parts.append(f"""
        <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p><strong>Drill Duration:</strong> {drill_end - drill_start:.1f} seconds</p>
        <div class="summary">
            <div class="stat-box">
                <div class="stat-value">{total_occupants}</div>
                <div class="stat-label">Total Occupants</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">{sum(1 for t in timelines.values() if t.exit_time)}</div>
                <div class="stat-label">Evacuated</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">{sum(1 for t in timelines.values() if not t.exit_time)}</div>
                <div class="stat-label">Stranded</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">{len(violations)}</div>
                <div class="stat-label">Total Violations</div>
            </div>
        </div>
""")

    by_type = {}
    for v in violations:
        if v.violation_type not in by_type:
            by_type[v.violation_type] = []
        by_type[v.violation_type].append(v)

    if by_type:
        html_parts.append("        <h2>Violations by Type</h2>")
        for vtype, vlist in by_type.items():
            html_parts.append(f"        <h3>{vtype.value.replace('_', ' ').title()}</h3>")
            for v in vlist:
                html_parts.append(f"""
        <div class="violation {v.severity}">
            <div class="violation-header">{v.occupant_name} ({v.occupant_id}) - {v.location}</div>
            <div class="violation-detail">Time: {v.timestamp:.1f}s | Severity: {v.severity.upper()}</div>
            <div class="violation-detail">{v.details}</div>
        </div>
""")

    html_parts.append("        <h2>Occupant Timeline</h2>")
    html_parts.append("        <table>")
    html_parts.append("            <tr><th>ID</th><th>Name</th><th>Floor</th><th>Exit Time</th><th>Status</th><th>Violations</th></tr>")
    for occ_id, tl in sorted(timelines.items(), key=lambda x: x[1].exit_time or 9999):
        status_class = "status-evacuated" if tl.exit_time else "status-stranded"
        status_text = "Evacuated" if tl.exit_time else "Stranded"
        exit_str = f"{tl.exit_time:.1f}s" if tl.exit_time else "N/A"
        rev_count = len(tl.reverse_movements)
        html_parts.append(f"            <tr><td>{occ_id}</td><td>{tl.name}</td><td>{tl.start_floor}</td><td>{exit_str}</td><td class='{status_class}'>{status_text}</td><td>{rev_count}</td></tr>")
    html_parts.append("        </table>")

    html_parts.append("    </div>\n</body>\n</html>")

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(html_parts))
