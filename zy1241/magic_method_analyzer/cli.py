"""命令行接口"""

import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from .analyzer import MagicMethodAnalyzer
from .exporter import ComparisonExporter, JSONExporter, MarkdownExporter
from .models import AnalysisSession
from .parsers import JSONLParser, SnippetParser, YAMLParser
from .storage import SQLiteStorage

console = Console()


def get_db_path() -> Path:
    """获取数据库路径"""
    default_path = Path.cwd() / "magic_analysis.db"
    env_path = os.environ.get("MMA_DB_PATH")
    if env_path:
        return Path(env_path)
    return default_path


def generate_session_id() -> str:
    """生成会话 ID"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    short_uuid = uuid.uuid4().hex[:8]
    return f"session_{timestamp}_{short_uuid}"


@click.group()
@click.version_option(version="0.1.0", prog_name="mmanalyzer")
def main() -> None:
    """Python 魔术方法调用顺序分析工具"""
    pass


@main.command()
@click.option("--yaml", "-y", type=click.Path(exists=True), help="magic-cases.yaml 文件路径")
@click.option("--jsonl", "-j", type=click.Path(exists=True), help="events.jsonl 文件路径")
@click.option("--snippets", "-s", type=click.Path(exists=True), help="snippets 目录路径")
@click.option("--session-id", "-i", help="自定义会话 ID")
@click.option("--no-save", is_flag=True, help="不保存到数据库")
@click.option("--output", "-o", type=click.Path(), help="导出报告路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "json", "both"]), default="markdown", help="报告格式")
def analyze(
    yaml: Optional[str],
    jsonl: Optional[str],
    snippets: Optional[str],
    session_id: Optional[str],
    no_save: bool,
    output: Optional[str],
    format: str,
) -> None:
    """分析魔术方法调用顺序"""
    console.print("[bold blue]开始分析魔术方法调用...[/bold blue]")
    console.print()
    
    # 创建会话
    if not session_id:
        session_id = generate_session_id()
    
    session = AnalysisSession(
        session_id=session_id,
        start_time=datetime.now(),
        source_files=[],
    )
    
    analyzer = MagicMethodAnalyzer()
    
    # 解析 YAML 用例
    if yaml:
        try:
            console.print(f"[cyan]解析 YAML 用例文件: {yaml}[/cyan]")
            cases = YAMLParser.parse_file(yaml)
            session.source_files.append(yaml)
            console.print(f"  [green]✓ 加载了 {len(cases)} 个测试用例[/green]")
        except Exception as e:
            console.print(f"  [red]✗ 解析失败: {e}[/red]")
            sys.exit(1)
    
    # 解析 JSONL 事件
    if jsonl:
        try:
            console.print(f"[cyan]解析 JSONL 事件文件: {jsonl}[/cyan]")
            calls = JSONLParser.parse_file(jsonl)
            session.source_files.append(jsonl)
            
            for call in calls:
                analyzer.add_method_call(call)
                session.method_calls.append(call)
            
            console.print(f"  [green]✓ 加载了 {len(calls)} 个方法调用记录[/green]")
        except Exception as e:
            console.print(f"  [red]✗ 解析失败: {e}[/red]")
            sys.exit(1)
    
    # 解析 snippets
    if snippets:
        try:
            console.print(f"[cyan]解析代码片段目录: {snippets}[/cyan]")
            snippet_files = SnippetParser.parse_directory(snippets)
            session.source_files.append(snippets)
            console.print(f"  [green]✓ 加载了 {len(snippet_files)} 个代码片段[/green]")
            
            # 提取魔术方法定义
            for filename, content in snippet_files.items():
                try:
                    methods = SnippetParser.extract_magic_methods(content)
                    if methods:
                        console.print(f"    [dim]在 {filename} 中发现魔术方法:[/dim]")
                        for class_name, method_list in methods.items():
                            method_names = ", ".join(m["name"] for m in method_list)
                            console.print(f"      [dim]- {class_name}: {method_names}[/dim]")
                except Exception:
                    pass
        except Exception as e:
            console.print(f"  [red]✗ 解析失败: {e}[/red]")
            sys.exit(1)
    
    # 执行分析
    console.print()
    console.print("[cyan]执行分析...[/cyan]")
    issues = analyzer.analyze()
    session.issues = issues
    session.end_time = datetime.now()
    
    # 显示分析结果
    console.print()
    console.print("[bold green]分析完成![/bold green]")
    console.print()
    
    # 显示统计
    stats = analyzer.get_method_statistics()
    if stats:
        table = Table(title="方法调用统计")
        table.add_column("方法", style="cyan")
        table.add_column("调用次数", style="green", justify="right")
        
        for method, count in sorted(stats.items(), key=lambda x: -x[1]):
            table.add_row(method, str(count))
        
        console.print(table)
        console.print()
    
    # 显示问题
    if issues:
        console.print(f"[bold red]发现 {len(issues)} 个问题:[/bold red]")
        console.print()
        
        # 按严重程度分组
        from collections import defaultdict
        by_severity = defaultdict(list)
        for issue in issues:
            by_severity[issue.severity.value].append(issue)
        
        # 显示严重问题
        if "严重" in by_severity:
            console.print("[bold red]严重问题:[/bold red]")
            for issue in by_severity["严重"]:
                console.print(f"  [red]✗ {issue.title}[/red]")
                console.print(f"    [dim]位置: {issue.location}[/dim]")
            console.print()
        
        # 显示警告
        if "警告" in by_severity:
            console.print("[bold yellow]警告:[/bold yellow]")
            for issue in by_severity["警告"]:
                console.print(f"  [yellow]⚠ {issue.title}[/yellow]")
            console.print()
        
        # 显示提示
        if "提示" in by_severity:
            console.print("[bold blue]提示:[/bold blue]")
            for issue in by_severity["提示"]:
                console.print(f"  [blue]ℹ {issue.title}[/blue]")
            console.print()
    else:
        console.print("[green]未发现问题。[/green]")
        console.print()
    
    # 保存到数据库
    if not no_save:
        try:
            db_path = get_db_path()
            console.print(f"[cyan]保存到数据库: {db_path}[/cyan]")
            storage = SQLiteStorage(db_path)
            storage.save_session(session)
            console.print(f"  [green]✓ 会话已保存: {session_id}[/green]")
            console.print()
        except Exception as e:
            console.print(f"  [red]✗ 保存失败: {e}[/red]")
    
    # 导出报告
    if output:
        try:
            output_path = Path(output)
            
            if format in ["markdown", "both"]:
                md_path = output_path.with_suffix(".md") if output_path.suffix != ".md" else output_path
                console.print(f"[cyan]导出 Markdown 报告: {md_path}[/cyan]")
                MarkdownExporter.export(session, md_path)
                console.print(f"  [green]✓ 报告已生成[/green]")
            
            if format in ["json", "both"]:
                json_path = output_path.with_suffix(".json") if output_path.suffix != ".json" else output_path
                console.print(f"[cyan]导出 JSON 报告: {json_path}[/cyan]")
                JSONExporter.export(session, json_path)
                console.print(f"  [green]✓ 报告已生成[/green]")
            
            console.print()
        except Exception as e:
            console.print(f"  [red]✗ 导出失败: {e}[/red]")
    
    console.print(f"[bold blue]会话 ID: {session_id}[/bold blue]")


@main.command()
@click.argument("session_id_1")
@click.argument("session_id_2")
@click.option("--output", "-o", type=click.Path(), help="导出比较报告路径")
def compare(session_id_1: str, session_id_2: str, output: Optional[str]) -> None:
    """比较两个分析会话"""
    console.print("[bold blue]比较分析会话...[/bold blue]")
    console.print()
    
    db_path = get_db_path()
    storage = SQLiteStorage(db_path)
    
    # 加载两个会话
    session1 = storage.get_session(session_id_1)
    session2 = storage.get_session(session_id_2)
    
    if not session1:
        console.print(f"[red]会话不存在: {session_id_1}[/red]")
        sys.exit(1)
    if not session2:
        console.print(f"[red]会话不存在: {session_id_2}[/red]")
        sys.exit(1)
    
    # 显示比较摘要
    table = Table(title="会话比较摘要")
    table.add_column("属性", style="cyan")
    table.add_column(f"会话 1\n({session_id_1[:16]}...)", style="blue")
    table.add_column(f"会话 2\n({session_id_2[:16]}...)", style="green")
    
    table.add_row(
        "开始时间",
        session1.start_time.strftime("%Y-%m-%d %H:%M"),
        session2.start_time.strftime("%Y-%m-%d %H:%M"),
    )
    table.add_row(
        "方法调用数",
        str(len(session1.method_calls)),
        str(len(session2.method_calls)),
    )
    table.add_row(
        "问题数",
        str(len(session1.issues)),
        str(len(session2.issues)),
    )
    
    console.print(table)
    console.print()
    
    # 导出报告
    if output:
        try:
            output_path = Path(output)
            console.print(f"[cyan]导出比较报告: {output_path}[/cyan]")
            ComparisonExporter.compare(session1, session2, output_path)
            console.print(f"  [green]✓ 报告已生成[/green]")
        except Exception as e:
            console.print(f"  [red]✗ 导出失败: {e}[/red]")


@main.command()
@click.argument("session_id", required=False)
@click.option("--output", "-o", type=click.Path(), help="导出路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "json", "both"]), default="markdown", help="报告格式")
@click.option("--list", "-l", "list_sessions", is_flag=True, help="列出所有会话")
@click.option("--stats", "-s", is_flag=True, help="显示数据库统计")
def export(
    session_id: Optional[str],
    output: Optional[str],
    format: str,
    list_sessions: bool,
    stats: bool,
) -> None:
    """导出分析报告"""
    db_path = get_db_path()
    storage = SQLiteStorage(db_path)
    
    # 显示统计
    if stats:
        console.print("[bold blue]数据库统计[/bold blue]")
        console.print()
        
        stat_data = storage.get_statistics()
        
        table = Table()
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="green", justify="right")
        
        table.add_row("会话总数", str(stat_data["sessions_count"]))
        table.add_row("方法调用记录", str(stat_data["method_calls_count"]))
        table.add_row("问题总数", str(stat_data["issues_count"]))
        
        console.print(table)
        console.print()
        
        if stat_data["issues_by_severity"]:
            severity_table = Table(title="问题按严重程度分布")
            severity_table.add_column("严重程度", style="cyan")
            severity_table.add_column("数量", style="green", justify="right")
            
            for severity, count in stat_data["issues_by_severity"].items():
                severity_table.add_row(severity, str(count))
            
            console.print(severity_table)
            console.print()
        
        return
    
    # 列出会话
    if list_sessions:
        console.print("[bold blue]会话列表[/bold blue]")
        console.print()
        
        sessions = storage.get_all_sessions()
        
        if not sessions:
            console.print("[yellow]暂无会话记录[/yellow]")
            return
        
        table = Table()
        table.add_column("会话 ID", style="cyan", no_wrap=True)
        table.add_column("开始时间", style="green")
        table.add_column("调用数", style="blue", justify="right")
        table.add_column("问题数", style="red", justify="right")
        
        for session in sessions:
            table.add_row(
                session.session_id,
                session.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                str(session.metadata.get("method_calls_count", len(session.method_calls))),
                str(session.metadata.get("issues_count", len(session.issues))),
            )
        
        console.print(table)
        return
    
    # 导出单个会话
    if not session_id:
        console.print("[red]请指定会话 ID 或使用 --list 查看所有会话[/red]")
        sys.exit(1)
    
    session = storage.get_session(session_id)
    if not session:
        console.print(f"[red]会话不存在: {session_id}[/red]")
        sys.exit(1)
    
    console.print(f"[bold blue]导出会话: {session_id}[/bold blue]")
    console.print()
    
    if not output:
        output = f"report_{session_id}"
    
    output_path = Path(output)
    
    if format in ["markdown", "both"]:
        md_path = output_path.with_suffix(".md") if output_path.suffix != ".md" else output_path
        console.print(f"[cyan]导出 Markdown: {md_path}[/cyan]")
        MarkdownExporter.export(session, md_path)
        console.print(f"  [green]✓ 完成[/green]")
    
    if format in ["json", "both"]:
        json_path = output_path.with_suffix(".json") if output_path.suffix != ".json" else output_path
        console.print(f"[cyan]导出 JSON: {json_path}[/cyan]")
        JSONExporter.export(session, json_path)
        console.print(f"  [green]✓ 完成[/green]")


@main.command()
@click.option("--yaml", "-y", type=click.Path(), help="验证 YAML 文件格式")
@click.option("--jsonl", "-j", type=click.Path(), help="验证 JSONL 文件格式")
@click.option("--snippet", "-s", type=click.Path(), help="验证 Python 代码语法")
def validate(yaml: Optional[str], jsonl: Optional[str], snippet: Optional[str]) -> None:
    """验证输入文件格式"""
    has_validation = False
    
    # 验证 YAML
    if yaml:
        has_validation = True
        console.print(f"[bold blue]验证 YAML 文件: {yaml}[/bold blue]")
        console.print()
        
        try:
            valid, errors, warnings = YAMLParser.validate_format(yaml)
            
            if errors:
                console.print("[red]错误:[/red]")
                for err in errors:
                    console.print(f"  [red]✗ {err}[/red]")
                console.print()
            
            if warnings:
                console.print("[yellow]警告:[/yellow]")
                for warn in warnings:
                    console.print(f"  [yellow]⚠ {warn}[/yellow]")
                console.print()
            
            if valid:
                console.print("[green]✓ 文件格式有效[/green]")
            else:
                console.print("[red]✗ 文件格式无效[/red]")
        except Exception as e:
            console.print(f"[red]验证失败: {e}[/red]")
        
        console.print()
    
    # 验证 JSONL
    if jsonl:
        has_validation = True
        console.print(f"[bold blue]验证 JSONL 文件: {jsonl}[/bold blue]")
        console.print()
        
        try:
            valid, errors, warnings = JSONLParser.validate_format(jsonl)
            
            if errors:
                console.print("[red]错误:[/red]")
                for err in errors:
                    console.print(f"  [red]✗ {err}[/red]")
                console.print()
            
            if warnings:
                console.print("[yellow]警告:[/yellow]")
                for warn in warnings:
                    console.print(f"  [yellow]⚠ {warn}[/yellow]")
                console.print()
            
            if valid:
                console.print("[green]✓ 文件格式有效[/green]")
            else:
                console.print("[red]✗ 文件格式无效[/red]")
        except Exception as e:
            console.print(f"[red]验证失败: {e}[/red]")
        
        console.print()
    
    # 验证代码片段
    if snippet:
        has_validation = True
        console.print(f"[bold blue]验证 Python 代码: {snippet}[/bold blue]")
        console.print()
        
        try:
            valid, errors, warnings = SnippetParser.validate_syntax(snippet)
            
            if errors:
                console.print("[red]语法错误:[/red]")
                for err in errors:
                    console.print(f"  [red]✗ {err}[/red]")
                console.print()
            
            if valid:
                console.print("[green]✓ 语法正确[/green]")
            else:
                console.print("[red]✗ 语法错误[/red]")
        except Exception as e:
            console.print(f"[red]验证失败: {e}[/red]")
        
        console.print()
    
    if not has_validation:
        console.print("[yellow]请指定要验证的文件类型（--yaml、--jsonl 或 --snippet）[/yellow]")


if __name__ == "__main__":
    main()
