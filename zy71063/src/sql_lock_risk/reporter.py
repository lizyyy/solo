import json
import os
from datetime import datetime
from typing import Optional
from dataclasses import asdict

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich.text import Text

from .models import AnalysisResult, RiskLevel, LockLevel


class Reporter:
    def __init__(self, output_dir: str = ".", verbose: bool = False):
        self.output_dir = output_dir
        self.verbose = verbose
        self.console = Console()

    def generate_all(self, result: AnalysisResult, base_name: str = "lock_risk_report"):
        os.makedirs(self.output_dir, exist_ok=True)
        
        self.print_terminal_summary(result)
        
        json_path = os.path.join(self.output_dir, f"{base_name}.json")
        self.generate_json(result, json_path)
        
        md_path = os.path.join(self.output_dir, f"{base_name}.md")
        self.generate_markdown(result, md_path)
        
        return {
            "terminal": True,
            "json": json_path,
            "markdown": md_path
        }

    def print_terminal_summary(self, result: AnalysisResult):
        console = self.console
        
        console.print("\n")
        console.print(Panel.fit(
            "[bold blue]SQL 迁移锁风险分析报告[/bold blue]",
            subtitle=f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ))
        
        self._print_summary_table(result)
        
        if result.findings:
            self._print_findings_table(result)
        
        if result.order_issues:
            self._print_order_issues(result)
        
        self._print_exit_code_info(result)
        
        console.print("\n")

    def _print_summary_table(self, result: AnalysisResult):
        summary = result.summary
        
        table = Table(title="分析概览", show_header=True, header_style="bold magenta")
        table.add_column("指标", style="cyan")
        table.add_column("数值", justify="right", style="green")
        
        table.add_row("迁移文件总数", str(summary.get("total_migrations", 0)))
        table.add_row("ALTER 语句总数", str(summary.get("total_statements", 0)))
        table.add_row("事务包裹", str(summary.get("transaction_wrapped", 0)))
        table.add_row("有回滚脚本", str(summary.get("with_rollback_script", 0)))
        table.add_row("顺序问题", str(summary.get("order_issues", 0)))
        
        self.console.print(table)
        
        risk_table = Table(title="风险等级分布", show_header=True, header_style="bold magenta")
        risk_table.add_column("风险等级", style="cyan")
        risk_table.add_column("数量", justify="right", style="green")
        
        risk_colors = {
            "critical": "[red]",
            "high": "[orange3]",
            "medium": "[yellow]",
            "low": "[blue]",
            "safe": "[green]"
        }
        
        risk_labels = {
            "critical": "严重 (CRITICAL)",
            "high": "高 (HIGH)",
            "medium": "中 (MEDIUM)",
            "low": "低 (LOW)",
            "safe": "安全 (SAFE)"
        }
        
        for level, count in summary.get("risk_levels", {}).items():
            color = risk_colors.get(level, "")
            label = risk_labels.get(level, level.upper())
            risk_table.add_row(f"{color}{label}[/]", f"{color}{count}[/]")
        
        self.console.print(risk_table)

    def _print_findings_table(self, result: AnalysisResult):
        findings_by_risk = {}
        for finding in result.findings:
            risk = finding.risk_level.value
            if risk not in findings_by_risk:
                findings_by_risk[risk] = []
            findings_by_risk[risk].append(finding)
        
        risk_order = ["critical", "high", "medium", "low", "safe"]
        
        for risk in risk_order:
            if risk not in findings_by_risk:
                continue
            
            findings = findings_by_risk[risk]
            
            risk_style_map = {
                "critical": "bold red",
                "high": "bold orange3",
                "medium": "bold yellow",
                "low": "bold blue",
                "safe": "bold green"
            }
            
            title = f"{risk.upper()} 风险发现 ({len(findings)} 项)"
            
            for idx, finding in enumerate(findings, 1):
                stmt = finding.statement
                panel_content = Text()
                
                panel_content.append(f"表名: {stmt.table_name}\n", style="cyan")
                panel_content.append(f"操作: {stmt.alter_type.value}\n", style="green")
                panel_content.append(f"锁级别: {finding.lock_level.value}\n", style="yellow")
                
                if finding.estimated_duration_seconds:
                    panel_content.append(f"预估耗时: {finding.estimated_duration_seconds}s\n", style="magenta")
                
                panel_content.append(f"\n原因: {finding.reason}\n", style="white")
                panel_content.append(f"\n建议: {finding.mitigation}\n", style="italic white")
                
                if self.verbose:
                    panel_content.append(f"\nSQL: {stmt.raw_sql[:200]}...\n", style="dim")
                
                self.console.print(Panel(
                    panel_content,
                    title=f"[{risk_style_map[risk]}]{title} - #{idx}[/]",
                    border_style=risk_style_map[risk],
                    expand=False
                ))

    def _print_order_issues(self, result: AnalysisResult):
        table = Table(title="迁移顺序/完整性问题", show_header=True, header_style="bold red")
        table.add_column("#", style="cyan", width=3)
        table.add_column("类型", style="magenta")
        table.add_column("文件", style="green")
        table.add_column("描述", style="white")
        
        for idx, issue in enumerate(result.order_issues, 1):
            table.add_row(
                str(idx),
                issue.type,
                os.path.basename(issue.migration_file) if issue.migration_file else "-",
                issue.description
            )
        
        self.console.print(table)

    def _print_exit_code_info(self, result: AnalysisResult):
        exit_code = result.exit_code
        
        code_info = {
            0: ("[green]0[/] - 无风险或低风险,可正常执行", "green"),
            1: ("[yellow]1[/] - 中风险或缺少回滚脚本,建议检查", "yellow"),
            2: ("[orange3]2[/] - 高风险,建议谨慎执行", "orange3"),
            3: ("[red]3[/] - 严重风险,建议重新评估迁移方案", "red")
        }
        
        message, color = code_info.get(exit_code, (f"[white]{exit_code}[/] - 未知", "white"))
        
        self.console.print("\n")
        self.console.print(Panel(
            Text.from_markup(f"退出码: {message}"),
            title="[bold]执行结果[/]",
            border_style=color
        ))

    def generate_json(self, result: AnalysisResult, output_path: str):
        def serialize(obj):
            if hasattr(obj, 'value'):
                return obj.value
            if hasattr(obj, '__dict__'):
                return obj.__dict__
            if hasattr(obj, 'as_dict'):
                return obj.as_dict()
            return str(obj)
        
        data = {
            "generated_at": datetime.now().isoformat(),
            "summary": result.summary,
            "exit_code": result.exit_code,
            "findings": [
                {
                    "risk_level": f.risk_level.value,
                    "lock_level": f.lock_level.value,
                    "reason": f.reason,
                    "mitigation": f.mitigation,
                    "estimated_duration_seconds": f.estimated_duration_seconds,
                    "statement": {
                        "table_name": f.statement.table_name,
                        "alter_type": f.statement.alter_type.value,
                        "is_concurrent": f.statement.is_concurrent,
                        "is_online": f.statement.is_online,
                        "uses_algorithm_inplace": f.statement.uses_algorithm_inplace,
                        "uses_lock_none": f.statement.uses_lock_none,
                        "column_name": f.statement.column_name,
                        "index_name": f.statement.index_name,
                        "raw_sql": f.statement.raw_sql
                    }
                }
                for f in result.findings
            ],
            "order_issues": [
                {
                    "type": o.type,
                    "description": o.description,
                    "migration_file": o.migration_file,
                    "statement_index": o.statement_index
                }
                for o in result.order_issues
            ],
            "migration_files": [
                {
                    "file_path": m.file_path,
                    "is_wrapped_in_transaction": m.is_wrapped_in_transaction,
                    "has_rollback_script": m.has_rollback_script,
                    "rollback_path": m.rollback_path,
                    "statement_count": len(m.statements)
                }
                for m in result.migration_files
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def generate_markdown(self, result: AnalysisResult, output_path: str):
        lines = []
        
        lines.append("# SQL 迁移锁风险分析报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 执行结果")
        lines.append("")
        lines.append(f"**退出码**: {result.exit_code}")
        lines.append("")
        
        code_desc = {
            0: "无风险或低风险，可正常执行",
            1: "中风险或缺少回滚脚本，建议检查",
            2: "高风险，建议谨慎执行",
            3: "严重风险，建议重新评估迁移方案"
        }
        lines.append(f"**说明**: {code_desc.get(result.exit_code, '未知')}")
        lines.append("")
        
        lines.append("## 分析概览")
        lines.append("")
        
        summary = result.summary
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 迁移文件总数 | {summary.get('total_migrations', 0)} |")
        lines.append(f"| ALTER 语句总数 | {summary.get('total_statements', 0)} |")
        lines.append(f"| 事务包裹 | {summary.get('transaction_wrapped', 0)} |")
        lines.append(f"| 有回滚脚本 | {summary.get('with_rollback_script', 0)} |")
        lines.append(f"| 顺序问题 | {summary.get('order_issues', 0)} |")
        lines.append("")
        
        lines.append("### 风险等级分布")
        lines.append("")
        lines.append("| 风险等级 | 数量 |")
        lines.append("|----------|------|")
        
        risk_labels = {
            "critical": "严重 (CRITICAL)",
            "high": "高 (HIGH)",
            "medium": "中 (MEDIUM)",
            "low": "低 (LOW)",
            "safe": "安全 (SAFE)"
        }
        
        for level, count in summary.get("risk_levels", {}).items():
            lines.append(f"| {risk_labels.get(level, level.upper())} | {count} |")
        lines.append("")
        
        if result.findings:
            lines.append("## 风险发现详情")
            lines.append("")
            
            findings_by_risk = {}
            for finding in result.findings:
                risk = finding.risk_level.value
                if risk not in findings_by_risk:
                    findings_by_risk[risk] = []
                findings_by_risk[risk].append(finding)
            
            risk_order = ["critical", "high", "medium", "low", "safe"]
            
            for risk in risk_order:
                if risk not in findings_by_risk:
                    continue
                
                findings = findings_by_risk[risk]
                lines.append(f"### {risk_labels.get(risk, risk.upper())} ({len(findings)} 项)")
                lines.append("")
                
                for idx, finding in enumerate(findings, 1):
                    stmt = finding.statement
                    
                    lines.append(f"#### 发现 #{idx}")
                    lines.append("")
                    lines.append(f"- **表名**: `{stmt.table_name}`")
                    lines.append(f"- **操作类型**: `{stmt.alter_type.value}`")
                    lines.append(f"- **锁级别**: `{finding.lock_level.value}`")
                    
                    if finding.estimated_duration_seconds:
                        lines.append(f"- **预估耗时**: {finding.estimated_duration_seconds} 秒")
                    
                    lines.append(f"- **原因**: {finding.reason}")
                    lines.append(f"- **缓解建议**: {finding.mitigation}")
                    
                    if self.verbose:
                        lines.append("")
                        lines.append("**SQL**:")
                        lines.append("```sql")
                        lines.append(stmt.raw_sql)
                        lines.append("```")
                    
                    lines.append("")
        
        if result.order_issues:
            lines.append("## 迁移顺序/完整性问题")
            lines.append("")
            lines.append("| # | 类型 | 文件 | 描述 |")
            lines.append("|---|------|------|------|")
            
            for idx, issue in enumerate(result.order_issues, 1):
                file_name = os.path.basename(issue.migration_file) if issue.migration_file else "-"
                lines.append(f"| {idx} | {issue.type} | {file_name} | {issue.description} |")
            lines.append("")
        
        lines.append("## 迁移文件清单")
        lines.append("")
        lines.append("| 文件 | 语句数 | 事务包裹 | 有回滚 |")
        lines.append("|------|--------|----------|--------|")
        
        for m in result.migration_files:
            file_name = os.path.basename(m.file_path) if m.file_path else "-"
            lines.append(
                f"| {file_name} | {len(m.statements)} | "
                f"{'是' if m.is_wrapped_in_transaction else '否'} | "
                f"{'是' if m.has_rollback_script else '否'} |"
            )
        lines.append("")
        
        lines.append("---")
        lines.append("*本报告由 sql-lock-risk 工具自动生成*")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
