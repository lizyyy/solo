"""Reporter module for TinyML diagnostic."""
import csv
from pathlib import Path
from typing import Dict, List, Any
from metrics import MetricsResult


def generate_reports(metrics: MetricsResult, output_dir: Path) -> None:
    """Generate drift_report.md, bad_cases.csv, and comparison.html."""
    output_dir = Path(output_dir)

    _write_drift_report(metrics, output_dir / 'drift_report.md')
    _write_bad_cases_csv(metrics.bad_cases, output_dir / 'bad_cases.csv')
    _write_comparison_html(metrics, output_dir / 'comparison.html')


def _write_drift_report(metrics: MetricsResult, path: Path) -> None:
    summary = metrics.summary
    per_class = metrics.per_class

    lines = [
        "# TinyML Quantization Drift Report",
        "",
        "## Summary",
        "",
        f"- **Total Samples**: {summary['total_samples']}",
        f"- **Top-1 Accuracy (Baseline)**: {summary['top1_accuracy']:.4f}",
        f"- **Top-1 Accuracy (Quantized)**: {summary['top1_correct'] / max(summary['total_samples'], 1):.4f}",
        f"- **Top-1 Predictions Flipped**: {summary['top1_flipped_count']}",
        f"- **Average Confidence Drift**: {summary['avg_confidence_drift']:.4f}",
        f"- **Bad Cases**: {summary['bad_cases_count']}",
        "",
    ]

    if summary.get('warnings'):
        lines.append("## Warnings")
        lines.append("")
        for w in summary['warnings']:
            lines.append(f"- {w['message']}")
            if w['sample_ids']:
                lines.append(f"  - Sample IDs: {', '.join(w['sample_ids'])}")
        lines.append("")

    lines.extend([
        "## Per-Class Recall Changes",
        "",
        "| Class | Baseline Recall | Quantized Recall | Recall Change | Threshold | Samples |",
        "|-------|-----------------|------------------|---------------|-----------|---------|"
    ])

    for cls, data in sorted(per_class.items()):
        lines.append(
            f"| {cls} | {data['baseline_recall']:.4f} | {data['quantized_recall']:.4f} | "
            f"{data['recall_change']:+.4f} | {data['threshold']:.4f} | {data['total_samples']} |"
        )

    lines.append("")

    changed_classes = [(cls, data) for cls, data in per_class.items() if abs(data['recall_change']) > 0.01]
    if changed_classes:
        lines.extend([
            "## Classes with Significant Recall Changes (>1%)",
            ""
        ])
        for cls, data in sorted(changed_classes, key=lambda x: abs(x[1]['recall_change']), reverse=True):
            direction = "improved" if data['recall_change'] > 0 else "degraded"
            lines.append(f"- **{cls}**: {direction} by {abs(data['recall_change'])*100:.2f}%")
        lines.append("")

    lines.extend([
        "## Methodology",
        "",
        "1. **Top-1 Accuracy**: Percentage of samples where the top prediction matches the ground truth label.",
        "2. **Confidence Drift**: Absolute difference in confidence scores between baseline and quantized models.",
        "3. **Recall Change**: Difference in per-class recall between quantized and baseline models.",
        ""
    ])

    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def _write_bad_cases_csv(bad_cases: List[Dict], path: Path) -> None:
    if not bad_cases:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'sample_id', 'label', 'baseline_top1', 'baseline_conf',
                'quantized_top1', 'quantized_conf', 'max_confidence_drift', 'drift_classes'
            ])
            writer.writeheader()
        return

    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'sample_id', 'label', 'baseline_top1', 'baseline_conf',
            'quantized_top1', 'quantized_conf', 'max_confidence_drift', 'drift_classes'
        ])
        writer.writeheader()
        for case in bad_cases:
            row = {
                'sample_id': case['sample_id'],
                'label': case['label'],
                'baseline_top1': case['baseline_top1'],
                'baseline_conf': f"{case['baseline_conf']:.4f}",
                'quantized_top1': case['quantized_top1'],
                'quantized_conf': f"{case['quantized_conf']:.4f}",
                'max_confidence_drift': f"{case['max_confidence_drift']:.4f}",
                'drift_classes': ', '.join(case.get('drift_classes', [])),
            }
            writer.writerow(row)


def _write_comparison_html(metrics: MetricsResult, path: Path) -> None:
    summary = metrics.summary
    per_class = metrics.per_class
    bad_cases = metrics.bad_cases

    drift_details_json = _escape_json(str(metrics.drift_details))

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TinyML Quantization Comparison</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; border-bottom: 2px solid #007bff; padding-bottom: 0.5rem; }}
        h2 {{ color: #555; margin-top: 2rem; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }}
        .summary-card {{ background: #f8f9fa; padding: 1rem; border-radius: 4px; border-left: 4px solid #007bff; }}
        .summary-card .value {{ font-size: 2rem; font-weight: bold; color: #007bff; }}
        .summary-card .label {{ color: #666; font-size: 0.9rem; }}
        table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
        th, td {{ padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        tr:hover {{ background: #f8f9fa; }}
        .positive {{ color: #28a745; }}
        .negative {{ color: #dc3545; }}
        .badge {{ display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }}
        .badge-success {{ background: #d4edda; color: #155724; }}
        .badge-danger {{ background: #f8d7da; color: #721c24; }}
        .badge-warning {{ background: #fff3cd; color: #856404; }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .tabs {{ margin-bottom: 1rem; }}
        .tab-btn {{ padding: 0.5rem 1rem; border: none; background: #e9ecef; cursor: pointer; border-radius: 4px 4px 0 0; }}
        .tab-btn.active {{ background: #007bff; color: white; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>TinyML Quantization Comparison Report</h1>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="value">{summary['total_samples']}</div>
                <div class="label">Total Samples</div>
            </div>
            <div class="summary-card">
                <div class="value">{summary['top1_accuracy']:.2%}</div>
                <div class="label">Top-1 Accuracy</div>
            </div>
            <div class="summary-card">
                <div class="value">{summary['avg_confidence_drift']:.4f}</div>
                <div class="label">Avg Confidence Drift</div>
            </div>
            <div class="summary-card">
                <div class="value">{summary['bad_cases_count']}</div>
                <div class="label">Bad Cases</div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab-btn active" onclick="showTab('per-class')">Per-Class Recall</button>
            <button class="tab-btn" onclick="showTab('bad-cases')">Bad Cases ({summary['bad_cases_count']})</button>
        </div>

        <div id="per-class" class="tab-content active">
            <h2>Per-Class Recall Changes</h2>
            <table>
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Baseline Recall</th>
                        <th>Quantized Recall</th>
                        <th>Recall Change</th>
                        <th>Samples</th>
                    </tr>
                </thead>
                <tbody>
"""

    for cls, data in sorted(per_class.items()):
        change = data['recall_change']
        change_class = 'positive' if change > 0 else 'negative' if change < 0 else ''
        change_sign = '+' if change > 0 else ''
        html_content += f"""
                    <tr>
                        <td><strong>{cls}</strong></td>
                        <td>{data['baseline_recall']:.4f}</td>
                        <td>{data['quantized_recall']:.4f}</td>
                        <td class="{change_class}">{change_sign}{change:.4f}</td>
                        <td>{data['total_samples']}</td>
                    </tr>
"""

    html_content += """
                </tbody>
            </table>
        </div>

        <div id="bad-cases" class="tab-content">
            <h2>Bad Cases</h2>
            <table>
                <thead>
                    <tr>
                        <th>Sample ID</th>
                        <th>Label</th>
                        <th>Baseline Top-1</th>
                        <th>Baseline Conf</th>
                        <th>Quantized Top-1</th>
                        <th>Quantized Conf</th>
                        <th>Max Drift</th>
                    </tr>
                </thead>
                <tbody>
"""

    for case in bad_cases:
        html_content += f"""
                    <tr>
                        <td>{case['sample_id']}</td>
                        <td><span class="badge badge-warning">{case['label']}</span></td>
                        <td>{case['baseline_top1']}</td>
                        <td>{case['baseline_conf']:.4f}</td>
                        <td>{case['quantized_top1']}</td>
                        <td>{case['quantized_conf']:.4f}</td>
                        <td><span class="badge badge-danger">{case['max_confidence_drift']:.4f}</span></td>
                    </tr>
"""

    html_content += """
                </tbody>
            </table>
        </div>
    </div>

    <script>
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }
    </script>
</body>
</html>
"""

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def _escape_json(s: str) -> str:
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')