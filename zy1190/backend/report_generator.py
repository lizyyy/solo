import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from data_manager import DataManager, Experiment, Comparison

class ReportGenerator:
    def __init__(self, data_manager: DataManager):
        self.dm = data_manager
    
    def generate_markdown_report(self, exp_id: str) -> str:
        experiment = self.dm.get_experiment(exp_id)
        if experiment is None:
            return "# Error: Experiment not found"
        
        result = experiment.result
        
        report_lines = [
            f"# Cache Performance Experiment Report: {experiment.name}",
            "",
            f"> Generated at: {datetime.now().isoformat()}",
            f"> Experiment ID: {experiment.id}",
            "",
        ]
        
        if experiment.description:
            report_lines.extend([
                "## Description",
                "",
                experiment.description,
                "",
            ])
        
        report_lines.extend([
            "## Configuration",
            "",
            "| Parameter | Value |",
            "|-----------|-------|",
        ])
        
        config = experiment.config or {}
        for key, value in sorted(config.items()):
            display_key = key.replace('_', ' ').title()
            report_lines.append(f"| {display_key} | {value} |")
        
        report_lines.append("")
        
        if result:
            report_lines.extend([
                "## Results Summary",
                "",
                "| Metric | Value |",
                "|--------|-------|",
                f"| Total Time | {result.get('total_time_ms', 0):.2f} ms |",
                f"| Throughput | {result.get('throughput_mbs', 0):.2f} MB/s |",
                f"| Average Latency | {result.get('avg_latency_ns', 0):.2f} ns |",
                f"| Cache Hits | {result.get('cache_hits', 0):,} |",
                f"| Cache Misses | {result.get('cache_misses', 0):,} |",
            ])
            
            total_accesses = result.get('cache_hits', 0) + result.get('cache_misses', 0)
            if total_accesses > 0:
                hit_rate = (result.get('cache_hits', 0) / total_accesses) * 100
                miss_rate = (result.get('cache_misses', 0) / total_accesses) * 100
                report_lines.extend([
                    f"| Hit Rate | {hit_rate:.2f}% |",
                    f"| Miss Rate | {miss_rate:.2f}% |",
                ])
            
            report_lines.append("")
            
            metadata = result.get('metadata', {})
            if metadata:
                report_lines.extend([
                    "## Analysis",
                    "",
                ])
                
                layout_analysis = metadata.get('layout_analysis')
                if layout_analysis:
                    report_lines.extend([
                        "### Layout Analysis",
                        "",
                        f"- **Layout Type**: {layout_analysis.get('layout_type', 'unknown')}",
                        f"- **Issue**: {layout_analysis.get('issue', 'none')}",
                        f"- **Description**: {layout_analysis.get('description', '')}",
                        "",
                    ])
                
                numa_slowdown = metadata.get('numa_slowdown')
                if numa_slowdown:
                    report_lines.extend([
                        "### NUMA Slowdown Analysis",
                        "",
                        f"- **Local Access Time**: {numa_slowdown.get('local_local_ms', 0):.2f} ms",
                        f"- **Remote Access Time**: {numa_slowdown.get('local_remote_ms', 0):.2f} ms",
                        f"- **Slowdown Factor**: {numa_slowdown.get('slowdown_factor', 1.0):.2f}x",
                        f"- **Slowdown**: {numa_slowdown.get('slowdown_percent', 0):.2f}%",
                        "",
                    ])
                
                suggestions = metadata.get('optimization_suggestions', [])
                if suggestions:
                    report_lines.extend([
                        "### Optimization Suggestions",
                        "",
                    ])
                    for i, suggestion in enumerate(suggestions, 1):
                        report_lines.append(f"{i}. {suggestion}")
                    report_lines.append("")
            
            latency_timeline = result.get('latency_timeline', [])
            if latency_timeline:
                report_lines.extend([
                    "## Latency Timeline",
                    "",
                    "| Iteration | Latency (ns) |",
                    "|-----------|--------------|",
                ])
                for i, latency in enumerate(latency_timeline[:20], 1):
                    report_lines.append(f"| {i} | {latency:.2f} |")
                
                if len(latency_timeline) > 20:
                    report_lines.append(f"| ... | ... |")
                    report_lines.append(f"| {len(latency_timeline)} | {latency_timeline[-1]:.2f} |")
                
                report_lines.append("")
            
            thread_conflicts = result.get('thread_conflicts', [])
            if thread_conflicts and any(c > 0 for c in thread_conflicts):
                report_lines.extend([
                    "## Thread Conflicts",
                    "",
                    "| Thread | Conflicts |",
                    "|--------|-----------|",
                ])
                for i, conflicts in enumerate(thread_conflicts):
                    report_lines.append(f"| {i} | {conflicts:,} |")
                
                report_lines.append("")
                
                total_conflicts = sum(thread_conflicts)
                if total_conflicts > 0:
                    report_lines.extend([
                        f"**Total Conflicts**: {total_conflicts:,}",
                        "",
                        "This indicates potential false sharing or cache line contention between threads.",
                        "",
                    ])
        
        report_lines.extend([
            "## Raw Data",
            "",
            "```json",
            json.dumps(result or experiment.config, indent=2),
            "```",
            "",
        ])
        
        return "\n".join(report_lines)
    
    def generate_comparison_markdown(self, comp_id: str) -> str:
        comparison = self.dm.get_comparison(comp_id)
        if comparison is None:
            return "# Error: Comparison not found"
        
        analysis = self.dm.run_comparison_analysis(comp_id)
        if "error" in analysis:
            return f"# Error: {analysis['error']}"
        
        report_lines = [
            f"# Cache Performance Comparison: {comparison.name}",
            "",
            f"> Generated at: {datetime.now().isoformat()}",
            f"> Comparison ID: {comparison.id}",
            "",
        ]
        
        if comparison.notes:
            report_lines.extend([
                "## Notes",
                "",
                comparison.notes,
                "",
            ])
        
        experiments = analysis.get("experiments", [])
        
        report_lines.extend([
            "## Experiments Compared",
            "",
            "| Index | ID | Name | Test |",
            "|-------|----|------|------|",
        ])
        
        for i, exp in enumerate(experiments):
            test_name = (exp.get("config", {}) or {}).get("test_name", "unknown")
            report_lines.append(f"| {i} | {exp['id']} | {exp['name']} | {test_name} |")
        
        report_lines.append("")
        
        comparisons = analysis.get("comparisons", [])
        if comparisons:
            report_lines.extend([
                "## Metric Comparison",
                "",
            ])
            
            for metric_comp in comparisons:
                metric = metric_comp["metric"]
                baseline = metric_comp["baseline_value"]
                
                report_lines.extend([
                    f"### {metric.replace('_', ' ').title()}",
                    "",
                    "| Experiment | Value | Change vs Baseline |",
                    "|------------|-------|--------------------|",
                ])
                
                for v in metric_comp["values"]:
                    change = v["relative_change_pct"]
                    change_str = f"{change:+.2f}%"
                    if change > 0:
                        change_str = f"🔺 {change_str} (worse)"
                    elif change < 0:
                        change_str = f"🔻 {change_str} (better)"
                    else:
                        change_str = f"±0% (same)"
                    
                    report_lines.append(f"| {v['experiment_name']} | {v['value']:.4f} | {change_str} |")
                
                report_lines.append("")
        
        report_lines.extend([
            "## Key Insights",
            "",
        ])
        
        for metric_comp in comparisons:
            metric = metric_comp["metric"]
            values = metric_comp["values"]
            
            if len(values) > 1:
                sorted_values = sorted(values, key=lambda x: x["value"])
                
                if metric in ["total_time_ms", "avg_latency_ns", "cache_misses"]:
                    best = sorted_values[0]
                    worst = sorted_values[-1]
                    report_lines.append(f"- **{metric.replace('_', ' ').title()}**: Best is `{best['experiment_name']}` ({best['value']:.2f}), Worst is `{worst['experiment_name']}` ({worst['value']:.2f})")
                
                elif metric in ["throughput_mbs", "cache_hits"]:
                    best = sorted_values[-1]
                    worst = sorted_values[0]
                    report_lines.append(f"- **{metric.replace('_', ' ').title()}**: Best is `{best['experiment_name']}` ({best['value']:.2f}), Worst is `{worst['experiment_name']}` ({worst['value']:.2f})")
        
        report_lines.append("")
        
        return "\n".join(report_lines)
    
    def save_report(self, content: str, filename: str) -> str:
        file_path = os.path.join(self.dm.exports_dir, filename)
        with open(file_path, 'w') as f:
            f.write(content)
        return file_path
