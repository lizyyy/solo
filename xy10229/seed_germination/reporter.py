import os
from datetime import datetime
from typing import Dict, List, Optional
from .models import (
    AnalysisResult, AuditFinding, AuditReport,
    RecordStatus, RecordType
)


class ConsoleReporter:
    def __init__(self, result: AnalysisResult):
        self.result = result

    def print_summary(self):
        from rich.console import Console
        from rich.table import Table
        from rich.panel import Panel
        from rich.text import Text

        console = Console()
        
        console.print(Panel.fit(
            Text("种子发芽率实验分析报告", style="bold blue"),
            subtitle=f"生成时间: {self.result.generation_time.strftime('%Y-%m-%d %H:%M:%S')}"
        ))

        self._print_overview_table(console)
        self._print_statistics_table(console)
        self._print_audit_summary(console)
        self._print_exit_status(console)

    def _print_overview_table(self, console):
        from rich.table import Table

        table = Table(title="数据概览", show_header=True, header_style="bold magenta")
        table.add_column("指标", style="cyan")
        table.add_column("数值", justify="right")
        table.add_column("说明", style="dim")

        audit = self.result.audit_report
        
        table.add_row(
            "实验组数量",
            str(len(self.result.groups)),
            "配置的实验组总数"
        )
        table.add_row(
            "总记录数",
            str(audit.total_records),
            "所有读取的数据行"
        )
        table.add_row(
            "有效记录",
            str(audit.valid_records),
            "可用于计算的记录"
        )
        table.add_row(
            "无效记录",
            str(audit.invalid_records),
            "格式错误的数据"
        )
        table.add_row(
            "缺失天数",
            str(audit.missing_records),
            "无记录的实验日"
        )
        table.add_row(
            "补记记录",
            str(audit.backfilled_records),
            "标记为backfill的记录"
        )

        console.print(table)

    def _print_statistics_table(self, console):
        from rich.table import Table

        if not self.result.statistics:
            console.print("[yellow]无可用统计数据[/yellow]")
            return

        table = Table(title="发芽率统计", show_header=True, header_style="bold green")
        table.add_column("实验组", style="cyan")
        table.add_column("总种子数", justify="right")
        table.add_column("已发芽", justify="right")
        table.add_column("发芽率", justify="right")
        table.add_column("平均发芽天数", justify="right")
        table.add_column("GSI", justify="right")
        table.add_column("状态", justify="center")

        for group_id, stats in self.result.statistics.items():
            group = self.result.groups.get(group_id)
            name = group.group_name if group else group_id
            
            status = self._get_group_status(group_id)
            status_style = self._get_status_style(status)
            
            table.add_row(
                name,
                str(stats.total_seeds),
                str(stats.total_germinated),
                f"{stats.germination_rate:.2f}%",
                f"{stats.mean_germination_days:.2f}",
                f"{stats.germination_speed_index:.2f}",
                f"[{status_style}]{status}[/{status_style}]"
            )

        console.print(table)

    def _print_audit_summary(self, console):
        from rich.table import Table
        from rich.text import Text

        findings = self.result.audit_report.findings
        if not findings:
            console.print("[green]✓ 无审计问题[/green]")
            return

        error_count = sum(1 for f in findings if f.severity == 'error')
        warning_count = sum(1 for f in findings if f.severity == 'warning')
        info_count = sum(1 for f in findings if f.severity == 'info')

        console.print()
        console.print(Text("审计发现", style="bold"))
        
        if error_count > 0:
            console.print(f"[red]错误: {error_count} 项[/red]")
        if warning_count > 0:
            console.print(f"[yellow]警告: {warning_count} 项[/yellow]")
        if info_count > 0:
            console.print(f"[blue]信息: {info_count} 项[/blue]")
        
        console.print()

        table = Table(title="详细审计发现", show_header=True, header_style="bold red")
        table.add_column("严重度", style="dim", width=10)
        table.add_column("类型", width=20)
        table.add_column("实验组", style="cyan")
        table.add_column("日期", style="dim")
        table.add_column("描述", overflow="fold")

        for finding in sorted(findings, key=lambda f: (
            0 if f.severity == 'error' else 1 if f.severity == 'warning' else 2,
            f.group_id,
            f.experiment_date or datetime.min.date()
        )):
            severity_style = {
                'error': 'red',
                'warning': 'yellow',
                'info': 'blue'
            }.get(finding.severity, 'white')
            
            table.add_row(
                f"[{severity_style}]{finding.severity.upper()}[/{severity_style}]",
                finding.finding_type,
                finding.group_id,
                str(finding.experiment_date) if finding.experiment_date else "-",
                finding.message
            )

        console.print(table)

    def _print_exit_status(self, console):
        from rich.panel import Panel
        from rich.text import Text

        summary = self.result.audit_report.summary
        has_errors = summary.get('has_errors', False)
        has_warnings = summary.get('has_warnings', False)

        if has_errors:
            status = "失败"
            color = "red"
            description = "存在错误，需要修正数据后重新运行"
        elif has_warnings:
            status = "需关注"
            color = "yellow"
            description = "存在警告，建议人工检查后决定是否重跑"
        else:
            status = "通过"
            color = "green"
            description = "所有检查通过，可用于正式分析"

        console.print(Panel.fit(
            Text(f"状态: {status}", style=f"bold {color}"),
            subtitle=description
        ))

    def _get_group_status(self, group_id: str) -> str:
        findings = [
            f for f in self.result.audit_report.findings
            if f.group_id == group_id
        ]
        if any(f.severity == 'error' for f in findings):
            return "错误"
        if any(f.severity == 'warning' for f in findings):
            return "警告"
        return "正常"

    def _get_status_style(self, status: str) -> str:
        return {
            "错误": "red",
            "警告": "yellow",
            "正常": "green"
        }.get(status, "white")

    def get_exit_code(self) -> int:
        summary = self.result.audit_report.summary
        has_errors = summary.get('has_errors', False)
        if has_errors:
            return 2
        has_warnings = summary.get('has_warnings', False)
        if has_warnings:
            return 1
        return 0


class FileReporter:
    def __init__(self, result: AnalysisResult, output_dir: str):
        self.result = result
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_all(self, generate_charts: bool = True) -> Dict[str, str]:
        generated_files = {}
        
        generated_files['summary'] = self._generate_summary_report()
        generated_files['audit'] = self._generate_audit_report()
        generated_files['timeline'] = self._generate_timeline_report()
        
        if generate_charts:
            try:
                chart_files = self._generate_charts()
                generated_files.update(chart_files)
            except Exception as e:
                print(f"图表生成失败: {e}")
        
        return generated_files

    def _generate_summary_report(self) -> str:
        filename = os.path.join(self.output_dir, "summary_report.txt")
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("种子发芽率实验分析报告 - 概要\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"生成时间: {self.result.generation_time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("【计算口径说明】\n")
            f.write("-" * 40 + "\n")
            f.write("1. 发芽率 = 最终累计发芽数 / 总种子数 × 100%\n")
            f.write("2. 平均发芽天数 = Σ(第n天发芽数 × n) / 总发芽数\n")
            f.write("3. 发芽速度指数(GSI) = Σ(第n天发芽率 / n)\n")
            f.write("4. 有效记录: 排除格式错误(INVALID)和重复记录(DUPLICATE)\n")
            f.write("5. 补记记录: 标记为BACKFILL的记录，用于覆盖同日数据\n\n")
            
            f.write("【数据概览】\n")
            f.write("-" * 40 + "\n")
            audit = self.result.audit_report
            f.write(f"实验组数量: {len(self.result.groups)}\n")
            f.write(f"总记录数: {audit.total_records}\n")
            f.write(f"有效记录: {audit.valid_records}\n")
            f.write(f"无效记录: {audit.invalid_records}\n")
            f.write(f"缺失天数: {audit.missing_records}\n")
            f.write(f"补记记录: {audit.backfilled_records}\n\n")
            
            f.write("【发芽率统计】\n")
            f.write("-" * 40 + "\n")
            f.write(f"{'实验组':<15} {'总种子':<10} {'发芽数':<10} {'发芽率':<12} {'平均天数':<12} {'GSI':<10}\n")
            f.write("-" * 70 + "\n")
            
            for group_id, stats in self.result.statistics.items():
                group = self.result.groups.get(group_id)
                name = group.group_name if group else group_id
                f.write(f"{name:<15} {stats.total_seeds:<10} {stats.total_germinated:<10} ")
                f.write(f"{stats.germination_rate:.2f}%{'':<6} ")
                f.write(f"{stats.mean_germination_days:.2f}{'':<8} ")
                f.write(f"{stats.germination_speed_index:.4f}\n")
            
            f.write("\n【状态汇总】\n")
            f.write("-" * 40 + "\n")
            summary = self.result.audit_report.summary
            has_errors = summary.get('has_errors', False)
            has_warnings = summary.get('has_warnings', False)
            
            if has_errors:
                f.write("状态: 失败\n")
                f.write("说明: 存在错误，必须修正数据后重新运行\n")
            elif has_warnings:
                f.write("状态: 需关注\n")
                f.write("说明: 存在警告，建议人工检查后决定\n")
            else:
                f.write("状态: 通过\n")
                f.write("说明: 所有检查通过\n")
            
            f.write(f"\n退出码: {self._get_exit_code()}\n")
        
        return filename

    def _generate_audit_report(self) -> str:
        filename = os.path.join(self.output_dir, "audit_report.txt")
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("审计详细报告\n")
            f.write("=" * 60 + "\n\n")
            
            findings = self.result.audit_report.findings
            
            if not findings:
                f.write("无审计问题\n")
                return filename
            
            error_findings = [f for f in findings if f.severity == 'error']
            warning_findings = [f for f in findings if f.severity == 'warning']
            info_findings = [f for f in findings if f.severity == 'info']
            
            if error_findings:
                f.write("【错误 - 必须修正】\n")
                f.write("-" * 40 + "\n")
                for finding in error_findings:
                    f.write(f"\n类型: {finding.finding_type}\n")
                    f.write(f"实验组: {finding.group_id}\n")
                    f.write(f"日期: {finding.experiment_date if finding.experiment_date else 'N/A'}\n")
                    f.write(f"问题: {finding.message}\n")
                    if finding.details:
                        f.write(f"详情: {finding.details}\n")
            
            if warning_findings:
                f.write("\n【警告 - 建议检查】\n")
                f.write("-" * 40 + "\n")
                for finding in warning_findings:
                    f.write(f"\n类型: {finding.finding_type}\n")
                    f.write(f"实验组: {finding.group_id}\n")
                    f.write(f"日期: {finding.experiment_date if finding.experiment_date else 'N/A'}\n")
                    f.write(f"问题: {finding.message}\n")
            
            if info_findings:
                f.write("\n【信息 - 仅作提示】\n")
                f.write("-" * 40 + "\n")
                for finding in info_findings:
                    f.write(f"\n类型: {finding.finding_type}\n")
                    f.write(f"实验组: {finding.group_id}\n")
                    f.write(f"日期: {finding.experiment_date if finding.experiment_date else 'N/A'}\n")
                    f.write(f"提示: {finding.message}\n")
        
        return filename

    def _generate_timeline_report(self) -> str:
        filename = os.path.join(self.output_dir, "timeline_report.txt")
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("时序数据报告\n")
            f.write("=" * 80 + "\n\n")
            
            for group_id, stats in self.result.statistics.items():
                group = self.result.groups.get(group_id)
                name = group.group_name if group else group_id
                
                f.write(f"【{name} ({group_id})】\n")
                f.write("-" * 80 + "\n")
                f.write(f"{'日期':<15} {'当日新增':<12} {'累计发芽':<12} {'当日发芽率':<15} {'累计发芽率':<15} {'记录类型':<10}\n")
                f.write("-" * 80 + "\n")
                
                sorted_dates = sorted(stats.daily_rates.keys())
                group_records = [
                    r for r in self.result.groups[group_id].records
                    if r.group_id == group_id
                    and r.status != RecordStatus.INVALID
                    and r.status != RecordStatus.DUPLICATE
                ]
                
                prev_count = 0
                for exp_date in sorted_dates:
                    daily_records = [
                        r for r in group_records 
                        if r.experiment_date == exp_date
                    ]
                    
                    record_type = "补记" if any(
                        r.record_type == RecordType.BACKFILL for r in daily_records
                    ) else "日常"
                    
                    daily_total = max(
                        (r.germinated_count for r in daily_records), default=0
                    )
                    daily_new = max(0, daily_total - prev_count)
                    
                    f.write(f"{str(exp_date):<15} {daily_new:<12} {daily_total:<12} ")
                    f.write(f"{stats.daily_rates[exp_date]:.2f}%{'':<7} ")
                    f.write(f"{stats.cumulative_rates[exp_date]:.2f}%{'':<7} ")
                    f.write(f"{record_type:<10}\n")
                    
                    prev_count = daily_total
                
                f.write("\n")
        
        return filename

    def _generate_charts(self) -> Dict[str, str]:
        try:
            import matplotlib.pyplot as plt
            import matplotlib
            matplotlib.use('Agg')
            import pandas as pd
        except ImportError:
            return {}

        chart_files = {}

        chart_files['cumulative'] = self._generate_cumulative_chart(plt, pd)
        chart_files['daily'] = self._generate_daily_chart(plt, pd)
        chart_files['comparison'] = self._generate_comparison_chart(plt, pd)

        return chart_files

    def _generate_cumulative_chart(self, plt, pd) -> str:
        filename = os.path.join(self.output_dir, "cumulative_germination.png")
        
        plt.figure(figsize=(12, 6))
        
        colors = plt.cm.Set3.colors
        color_idx = 0
        
        for group_id, stats in self.result.statistics.items():
            group = self.result.groups.get(group_id)
            name = group.group_name if group else group_id
            
            dates = sorted(stats.cumulative_rates.keys())
            values = [stats.cumulative_rates[d] for d in dates]
            
            plt.plot(dates, values, 'o-', label=name, color=colors[color_idx % len(colors)], linewidth=2)
            color_idx += 1
        
        plt.title('累计发芽率时序图', fontsize=14, fontweight='bold')
        plt.xlabel('日期', fontsize=12)
        plt.ylabel('累计发芽率 (%)', fontsize=12)
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filename

    def _generate_daily_chart(self, plt, pd) -> str:
        filename = os.path.join(self.output_dir, "daily_germination.png")
        
        fig, axes = plt.subplots(
            len(self.result.statistics), 1, 
            figsize=(12, 4 * max(1, len(self.result.statistics))),
            sharex=True
        )
        
        if len(self.result.statistics) == 1:
            axes = [axes]
        
        colors = plt.cm.Set3.colors
        color_idx = 0
        
        for ax, (group_id, stats) in zip(axes, self.result.statistics.items()):
            group = self.result.groups.get(group_id)
            name = group.group_name if group else group_id
            
            dates = sorted(stats.daily_rates.keys())
            values = [stats.daily_rates[d] for d in dates]
            
            bars = ax.bar(dates, values, color=colors[color_idx % len(colors)], alpha=0.7)
            ax.set_title(f'{name} - 当日新增发芽率', fontsize=11)
            ax.set_ylabel('当日发芽率 (%)')
            ax.grid(True, alpha=0.3, axis='y')
            
            for bar, val in zip(bars, values):
                if val > 0:
                    ax.text(
                        bar.get_x() + bar.get_width()/2, bar.get_height(),
                        f'{val:.1f}%', ha='center', va='bottom', fontsize=8
                    )
            
            color_idx += 1
        
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filename

    def _generate_comparison_chart(self, plt, pd) -> str:
        filename = os.path.join(self.output_dir, "group_comparison.png")
        
        fig, axes = plt.subplots(1, 3, figsize=(15, 5))
        
        groups = list(self.result.statistics.keys())
        group_names = [
            self.result.groups[gid].group_name 
            if self.result.groups.get(gid) else gid
            for gid in groups
        ]
        
        colors = plt.cm.Set3.colors[:len(groups)]
        
        rates = [self.result.statistics[g].germination_rate for g in groups]
        axes[0].bar(group_names, rates, color=colors, alpha=0.7)
        axes[0].set_title('最终发芽率对比', fontsize=11)
        axes[0].set_ylabel('发芽率 (%)')
        axes[0].tick_params(axis='x', rotation=45)
        for i, v in enumerate(rates):
            axes[0].text(i, v, f'{v:.1f}%', ha='center', va='bottom', fontsize=9)
        
        mean_days = [self.result.statistics[g].mean_germination_days for g in groups]
        axes[1].bar(group_names, mean_days, color=colors, alpha=0.7)
        axes[1].set_title('平均发芽天数对比', fontsize=11)
        axes[1].set_ylabel('天数')
        axes[1].tick_params(axis='x', rotation=45)
        for i, v in enumerate(mean_days):
            axes[1].text(i, v, f'{v:.2f}', ha='center', va='bottom', fontsize=9)
        
        gsi = [self.result.statistics[g].germination_speed_index for g in groups]
        axes[2].bar(group_names, gsi, color=colors, alpha=0.7)
        axes[2].set_title('发芽速度指数(GSI)对比', fontsize=11)
        axes[2].set_ylabel('GSI')
        axes[2].tick_params(axis='x', rotation=45)
        for i, v in enumerate(gsi):
            axes[2].text(i, v, f'{v:.3f}', ha='center', va='bottom', fontsize=9)
        
        plt.tight_layout()
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        plt.close()
        
        return filename

    def _get_exit_code(self) -> int:
        summary = self.result.audit_report.summary
        has_errors = summary.get('has_errors', False)
        if has_errors:
            return 2
        has_warnings = summary.get('has_warnings', False)
        if has_warnings:
            return 1
        return 0
