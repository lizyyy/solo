from typing import Dict, List


def generate_markdown_report(
    issues: List[dict],
    balance_stats: dict,
    manifest_stats: dict,
    output_path: str
) -> None:
    content = []
    
    content.append("# Dataset Audit Report")
    content.append("")
    content.append("## Overview")
    content.append("")
    content.append(f"- **Total Images**: {manifest_stats.get('total_images', 0)}")
    content.append(f"- **Total Annotations**: {balance_stats.get('balance_metrics', {}).get('total_annotations', 0)}")
    content.append(f"- **Number of Categories**: {balance_stats.get('balance_metrics', {}).get('num_categories', 0)}")
    content.append("")
    
    content.append("## Class Balance Analysis")
    content.append("")
    
    if "balance_metrics" in balance_stats:
        metrics = balance_stats["balance_metrics"]
        content.append(f"- **Balance Ratio**: {metrics.get('balance_ratio', 0):.2f}")
        content.append(f"- **Imbalance Ratio**: {metrics.get('imbalance_ratio', 0):.2f}:1")
        content.append(f"- **Max Samples per Class**: {metrics.get('max_count', 0)}")
        content.append(f"- **Min Samples per Class**: {metrics.get('min_count', 0)}")
    content.append("")
    
    content.append("### Category Distribution")
    content.append("")
    content.append("| Category | Count |")
    content.append("|----------|-------|")
    for cat, count in balance_stats.get("category_distribution", {}).items():
        content.append(f"| {cat} | {count} |")
    content.append("")
    
    content.append("### Split Distribution")
    content.append("")
    for split, dist in balance_stats.get("split_distribution", {}).items():
        content.append(f"#### {split}")
        content.append("")
        content.append("| Category | Count |")
        content.append("|----------|-------|")
        for cat, count in dist.items():
            content.append(f"| {cat} | {count} |")
        content.append("")
    
    content.append("## Issues Found")
    content.append("")
    
    error_count = sum(1 for i in issues if i["severity"] == "error")
    warning_count = sum(1 for i in issues if i["severity"] == "warning")
    
    content.append(f"- **Errors**: {error_count}")
    content.append(f"- **Warnings**: {warning_count}")
    content.append("")
    
    content.append("### Error Issues")
    content.append("")
    errors = [i for i in issues if i["severity"] == "error"]
    if errors:
        for issue in errors:
            content.append(f"- **{issue['issue_type']}**: {issue['message']}")
    else:
        content.append("- No errors found")
    content.append("")
    
    content.append("### Warning Issues")
    content.append("")
    warnings = [i for i in issues if i["severity"] == "warning"]
    if warnings:
        for issue in warnings:
            content.append(f"- **{issue['issue_type']}**: {issue['message']}")
    else:
        content.append("- No warnings found")
    content.append("")
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))