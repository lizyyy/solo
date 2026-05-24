import os
import json
from datetime import datetime
from typing import Optional
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .types import ClusterReport, FailureCluster


class ReportGenerator:
    def __init__(self, output_dir: str, overwrite: bool = False):
        self.output_dir = Path(output_dir)
        self.overwrite = overwrite
        self.console = Console()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all(self, report: ClusterReport) -> dict:
        terminal_summary = self._print_terminal_summary(report)
        json_path = self._write_json_report(report)
        md_path = self._write_markdown_report(report)

        return {
            "terminal": terminal_summary,
            "json_file": str(json_path),
            "markdown_file": str(md_path),
        }

    def _print_terminal_summary(self, report: ClusterReport) -> dict:
        self.console.print(
            Panel.fit(
                Text("CI 失败聚类分析报告", style="bold blue"),
                border_style="blue",
            )
        )

        stats_table = Table(title="概览统计", show_header=True)
        stats_table.add_column("指标", style="cyan")
        stats_table.add_column("数值", justify="right", style="green")
        stats_table.add_row("总失败次数", str(report.total_failures))
        stats_table.add_row("聚类数量", str(report.total_clusters))
        stats_table.add_row("未聚类失败", str(len(report.unclustered)))
        stats_table.add_row("分析时间", report.generated_at.strftime("%Y-%m-%d %H:%M:%S"))
        self.console.print(stats_table)

        if report.clusters:
            cluster_table = Table(title=f"Top {min(10, len(report.clusters))} 失败聚类", show_header=True)
            cluster_table.add_column("聚类 ID", style="cyan")
            cluster_table.add_column("大小", justify="right")
            cluster_table.add_column("错误类型", style="yellow")
            cluster_table.add_column("抖动评分", justify="right")
            cluster_table.add_column("重跑成功率", justify="right")
            cluster_table.add_column("涉及提交", justify="right")

            for cluster in report.clusters[:10]:
                rerun_rate = f"{cluster.rerun_success_rate * 100:.1f}%"
                jitter_color = "red" if cluster.jitter_score > 0.7 else "yellow" if cluster.jitter_score > 0.3 else "green"

                cluster_table.add_row(
                    cluster.cluster_id,
                    str(cluster.size),
                    cluster.signature.error_type or "unknown",
                    Text(f"{cluster.jitter_score:.3f}", style=jitter_color),
                    rerun_rate,
                    str(cluster.unique_commits),
                )
            self.console.print(cluster_table)

            self.console.print("\n[bold]聚类详情:[/bold]")
            for i, cluster in enumerate(report.clusters[:5], 1):
                self.console.print(f"\n  [cyan]{i}. 聚类 {cluster.cluster_id}[/cyan] ({cluster.size} 个失败)")
                self.console.print(f"     错误类型: [yellow]{cluster.signature.error_type or 'unknown'}[/yellow]")
                self.console.print(f"     归一化签名: [dim]{cluster.signature.normalized_error[:100]}...[/dim]")
                if cluster.matrix_coverage:
                    dims = ", ".join(cluster.matrix_coverage.keys())
                    self.console.print(f"     矩阵维度: [green]{dims}[/green]")

        return {
            "total_failures": report.total_failures,
            "total_clusters": report.total_clusters,
            "unclustered": len(report.unclustered),
        }

    def _write_json_report(self, report: ClusterReport) -> Path:
        filename = f"failure_clusters_{report.generated_at.strftime('%Y%m%d_%H%M%S')}.json"
        filepath = self.output_dir / filename

        if filepath.exists() and not self.overwrite:
            filepath = self._get_unique_filename(filepath)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)

        self.console.print(f"\n[green]✓[/green] JSON 报告已保存: [link=file://{filepath}]{filepath}[/link]")
        return filepath

    def _write_markdown_report(self, report: ClusterReport) -> Path:
        filename = f"failure_clusters_{report.generated_at.strftime('%Y%m%d_%H%M%S')}.md"
        filepath = self.output_dir / filename

        if filepath.exists() and not self.overwrite:
            filepath = self._get_unique_filename(filepath)

        content = self._generate_markdown_content(report)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        self.console.print(f"[green]✓[/green] Markdown 报告已保存: [link=file://{filepath}]{filepath}[/link]")
        return filepath

    def _generate_markdown_content(self, report: ClusterReport) -> str:
        lines = []

        lines.append("# CI 失败聚类分析报告")
        lines.append("")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总失败次数 | {report.total_failures} |")
        lines.append(f"| 聚类数量 | {report.total_clusters} |")
        lines.append(f"| 未聚类失败 | {len(report.unclustered)} |")
        lines.append("")

        lines.append("## 聚类算法说明")
        lines.append("")
        lines.append("### 日志切片 (Log Slicing)")
        lines.append("- 自动识别错误起始位置（Error/Traceback/Exception 等）")
        lines.append("- 提取完整错误栈，截断无意义的输出")
        lines.append("- 支持多段错误识别")
        lines.append("")
        lines.append("### 签名归一化 (Signature Normalization)")
        lines.append("- **路径归一化**: 替换文件系统路径为 `<PATH>`")
        lines.append("- **UUID/HEX 归一化**: 替换唯一标识为 `<UUID>`/`<HEX>`")
        lines.append("- **行号归一化**: 替换行号为 `<N>`")
        lines.append("- **时间戳归一化**: 替换时间戳为 `<TS>`")
        lines.append("- **过滤无关栈帧**: 过滤第三方库栈帧")
        lines.append("")
        lines.append("### 矩阵聚合 (Matrix Aggregation)")
        lines.append("- 分析每个聚类在各个矩阵维度（OS/版本/架构）上的分布")
        lines.append("- 识别是否在特定配置下集中出现")
        lines.append("")
        lines.append("### 抖动评分 (Jitter Score)")
        lines.append("- 衡量失败的随机性：`0 = 完全确定`，`1 = 完全随机`")
        lines.append("- 基于涉及的提交数量和任务名称多样性计算")
        lines.append("- **低抖动（<0.3）**: 确定性失败，特定条件必现")
        lines.append("- **中抖动（0.3-0.7）**: 半随机，可能和时序/环境相关")
        lines.append("- **高抖动（>0.7）**: 高度随机，需要关注稳定性问题")
        lines.append("")

        lines.append("## 聚类详情")
        lines.append("")

        for i, cluster in enumerate(report.clusters, 1):
            lines.append(f"### 聚类 {i}: `{cluster.cluster_id}`")
            lines.append("")

            lines.append("| 属性 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 失败次数 | {cluster.size} |")
            lines.append(f"| 错误类型 | {cluster.signature.error_type or 'unknown'} |")
            lines.append(f"| 错误分类 | {cluster.signature.error_category or 'N/A'} |")
            lines.append(f"| 涉及提交数 | {cluster.unique_commits} |")
            lines.append(f"| 抖动评分 | {cluster.jitter_score:.3f} |")
            lines.append(f"| 重跑成功率 | {cluster.rerun_success_rate * 100:.1f}% |")
            lines.append("")

            lines.append("#### 归一化错误信息")
            lines.append("")
            lines.append("```")
            lines.append(cluster.signature.normalized_error[:500])
            lines.append("```")
            lines.append("")

            if cluster.signature.tokens:
                lines.append("#### 关键词")
                lines.append("")
                lines.append(", ".join(f"`{t}`" for t in cluster.signature.tokens[:20]))
                lines.append("")

            if cluster.matrix_coverage:
                lines.append("#### 矩阵覆盖")
                lines.append("")
                for dim, data in cluster.matrix_coverage.items():
                    lines.append(f"- **{dim}**:")
                    for value, count in sorted(data["values"].items(), key=lambda x: -x[1]):
                        pct = count / cluster.size * 100
                        bar = "█" * int(pct / 10) + "░" * (10 - int(pct / 10))
                        lines.append(f"  - `{value}`: {bar} {count} ({pct:.1f}%)")
                lines.append("")

            lines.append("#### 涉及的失败记录")
            lines.append("")
            lines.append("| 提交 | 任务 | 矩阵 | 重跑次数 | 重跑成功 |")
            lines.append("|------|------|------|----------|----------|")
            for member in cluster.members[:20]:
                matrix_str = ",".join(f"{k}={v}" for k, v in member.matrix_params.to_dict().items())
                lines.append(
                    f"| `{member.commit_sha[:8]}` | {member.job_name[:20]} | "
                    f"{matrix_str[:30]} | {member.rerun_count} | "
                    f"{'✓' if member.rerun_success else '✗'} |"
                )
            if len(cluster.members) > 20:
                lines.append(f"| ... 还有 {len(cluster.members) - 20} 条记录 ... | | | | |")
            lines.append("")

        if report.unclustered:
            lines.append("## 未聚类的失败")
            lines.append("")
            lines.append(f"共 {len(report.unclustered)} 条未聚类的失败记录（出现次数 < {report.analysis_params.get('min_cluster_size', 2)}）:")
            lines.append("")
            for record in report.unclustered[:20]:
                lines.append(f"- `{record.commit_sha[:8]}` - {record.job_name}: {record.error_message[:80]}...")
            if len(report.unclustered) > 20:
                lines.append(f"- ... 还有 {len(report.unclustered) - 20} 条 ...")
            lines.append("")

        lines.append("## 分析参数")
        lines.append("")
        lines.append("```json")
        lines.append(json.dumps(report.analysis_params, ensure_ascii=False, indent=2))
        lines.append("```")
        lines.append("")

        return "\n".join(lines)

    def _get_unique_filename(self, filepath: Path) -> Path:
        stem = filepath.stem
        suffix = filepath.suffix
        counter = 1
        while True:
            new_path = filepath.with_name(f"{stem}_{counter}{suffix}")
            if not new_path.exists():
                return new_path
            counter += 1
