"""CLI 入口 - 访谈脱敏打包员命令行工具"""

import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from . import __version__
from .parser import ProjectScanner
from .storage import StateManager, IssueStatus
from .exporter import Exporter


console = Console()


def get_project_dir(ctx: click.Context) -> Path:
    """从上下文获取项目目录"""
    if ctx.obj and 'project_dir' in ctx.obj:
        return Path(ctx.obj['project_dir'])
    return Path.cwd()


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.option('-d', '--directory', 'project_dir', 
              type=click.Path(exists=False, file_okay=False, dir_okay=True),
              help='指定项目目录（默认为当前目录）')
@click.pass_context
def cli(ctx, project_dir: Optional[str]):
    """访谈脱敏打包员 - 处理口述史访谈的本地 CLI 工具
    
    用于管理口述史访谈资料的脱敏流程，包括：
    - init: 初始化项目并生成示例文件
    - scan: 扫描并解析多源文件，检测各类问题
    - review: 保存人工处理意见
    - export: 导出脱敏后的文件和审计包
    """
    ctx.ensure_object(dict)
    if project_dir:
        ctx.obj['project_dir'] = Path(project_dir)
    else:
        ctx.obj['project_dir'] = Path.cwd()


@cli.command()
@click.pass_context
def init(ctx):
    """初始化项目并生成示例文件
    
    在当前目录或指定目录下创建示例文件，包括：
    - 示例 SRT 字幕文件
    - 示例授权表 CSV
    - 示例敏感词词典 CSV
    - 示例音频清单 CSV
    """
    project_dir = get_project_dir(ctx)
    state_manager = StateManager(project_dir)
    
    if state_manager.is_initialized():
        console.print(Panel.fit(
            "[yellow]项目已初始化[/yellow]\n"
            f"目录: {project_dir}\n"
            "如需重新初始化，请先删除 .sanitizer 目录",
            title="提示",
            border_style="yellow"
        ))
        return
    
    project_dir.mkdir(parents=True, exist_ok=True)
    
    _generate_example_files(project_dir)
    
    state_manager.init_project()
    
    console.print(Panel.fit(
        "[green]项目初始化成功！[/green]\n\n"
        f"项目目录: {project_dir}\n\n"
        "已生成示例文件:\n"
        "  • 访谈实录.srt - 示例字幕文件\n"
        "  • 受访者授权表.csv - 授权信息表\n"
        "  • 敏感姓名词典.csv - 敏感词列表\n"
        "  • 音频切片清单.csv - 音频文件清单\n\n"
        "下一步操作:\n"
        "  1. 替换示例文件为真实数据\n"
        "  2. 运行 [cyan]sanitizer scan[/cyan] 进行扫描",
        title="初始化完成",
        border_style="green"
    ))


def _generate_example_files(project_dir: Path):
    """生成示例文件"""
    
    srt_content = """1
00:00:01,000 --> 00:00:04,500
大家好，我是张三，今天很高兴能在这里接受访谈。

2
00:00:05,000 --> 00:00:09,000
我和李四是在 1980 年一起参加工作的，当时我们都在纺织厂。

3
00:00:09,500 --> 00:00:14,000
后来厂子里来了一位新厂长王五，他改变了很多事情。

4
00:00:14,500 --> 00:00:18,000
我的联系方式是 13912345678，身份证号是 110101196001011234。

5
00:00:18,500 --> 00:00:22,000
希望这些回忆能对你们的研究有所帮助。
"""
    (project_dir / "访谈实录.srt").write_text(srt_content, encoding='utf-8')
    
    auth_content = """姓名,化名,授权状态,授权片段,备注
张三,张大爷,已授权,,主要受访者
李四,李师傅,已授权,,同事
王五,王厂长,未授权,,涉及敏感内容
"""
    (project_dir / "受访者授权表.csv").write_text(auth_content, encoding='utf-8-sig')
    
    sensitive_content = """姓名,分类,建议化名,备注
张三,受访者,张大爷,
李四,同事,李师傅,
王五,领导,王厂长,
赵六,家属,赵阿姨,
"""
    (project_dir / "敏感姓名词典.csv").write_text(sensitive_content, encoding='utf-8-sig')
    
    audio_content = """片段索引,文件路径,开始时间,结束时间,备注
1,./audio/segment_001.wav,00:00:00,00:00:05,开场白
2,./audio/segment_002.wav,00:00:05,00:00:10,工作经历
3,./audio/segment_003.wav,00:00:10,00:00:15,厂长往事
4,./audio/segment_004.wav,00:00:15,00:00:20,联系方式
5,./audio/segment_005.wav,00:00:20,00:00:25,结束语
"""
    (project_dir / "音频切片清单.csv").write_text(audio_content, encoding='utf-8-sig')


@cli.command()
@click.option('--json', 'output_json', is_flag=True, help='输出 JSON 格式结果')
@click.pass_context
def scan(ctx, output_json: bool):
    """扫描并解析多源文件，检测各类问题
    
    扫描当前项目目录中的所有相关文件，包括：
    - SRT 字幕文件
    - 受访者授权表 CSV
    - 敏感姓名词典 CSV
    - 音频切片清单 CSV
    
    检测以下问题：
    - 授权缺口：未授权的片段或人员
    - 姓名泄露：字幕中出现的敏感姓名
    - 时间轴重叠：字幕时间轴问题
    - 缺音频：清单中不存在的音频文件
    """
    project_dir = get_project_dir(ctx)
    state_manager = StateManager(project_dir)
    
    if not state_manager.is_initialized():
        console.print(Panel.fit(
            "[red]项目未初始化[/red]\n"
            "请先运行 [cyan]sanitizer init[/cyan] 命令",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)
    
    scanner = ProjectScanner(project_dir)
    
    with console.status("[bold green]正在扫描项目...[/bold green]"):
        results = scanner.scan()
    
    state_manager.save_scan_results(results)
    
    if output_json:
        import json
        console.print(json.dumps(results, ensure_ascii=False, indent=2))
        return
    
    _display_scan_results(results)


def _display_scan_results(results: dict):
    """显示扫描结果"""
    files_found = results.get('files_found', {})
    issues_summary = results.get('issues_summary', {})
    issues = results.get('issues', [])
    
    console.print("\n[bold blue]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold blue]")
    console.print("[bold blue]          扫描结果摘要[/bold blue]")
    console.print("[bold blue]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold blue]\n")
    
    table = Table(title="文件检测情况")
    table.add_column("文件类型", style="cyan")
    table.add_column("状态", style="green")
    
    file_types = [
        ("SRT 字幕", "srt"),
        ("授权表", "authorization"),
        ("敏感词词典", "sensitive_names"),
        ("音频清单", "audio_manifest"),
    ]
    
    for name, key in file_types:
        if files_found.get(key):
            table.add_row(name, "[green]✅ 已检测到[/green]")
        else:
            table.add_row(name, "[yellow]⚠️  未检测到[/yellow]")
    
    console.print(table)
    
    total_issues = sum(issues_summary.values())
    
    if total_issues > 0:
        console.print("\n[bold red]⚠️  检测到问题[/bold red]\n")
        
        table = Table(title="问题汇总")
        table.add_column("问题类型", style="cyan")
        table.add_column("数量", style="magenta", justify="right")
        
        for issue_type, count in issues_summary.items():
            if count > 0:
                if "授权" in issue_type or "泄露" in issue_type:
                    table.add_row(f"[red]{issue_type}[/red]", f"[red]{count}[/red]")
                else:
                    table.add_row(issue_type, str(count))
        
        console.print(table)
        
        console.print("\n[bold]详细问题列表:[/bold]")
        console.print("-" * 60)
        
        for idx, issue in enumerate(issues, 1):
            issue_type = issue.get('type', '未知')
            severity = issue.get('severity', 'unknown')
            description = issue.get('description', '')
            
            severity_style = "red" if severity == "high" else "yellow" if severity == "medium" else "cyan"
            severity_text = {"high": "高", "medium": "中", "low": "低"}.get(severity, severity)
            
            console.print(f"\n[bold]问题 {idx}:[/bold] [cyan]{issue_type}[/cyan] ([{severity_style}]{severity_text}[/])")
            console.print(f"  描述: {description}")
            
            location = issue.get('location')
            if location:
                console.print(f"  位置: {location}")
            
            context = issue.get('context')
            if context:
                console.print(f"  上下文: \"{context}\"")
    
    else:
        console.print("\n[bold green]✓ 未检测到任何问题！[/bold green]\n")
    
    console.print("\n[bold blue]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold blue]")
    console.print("扫描结果已保存。下一步操作:")
    console.print("  • 运行 [cyan]sanitizer review[/cyan] 处理问题")
    console.print("  • 或直接运行 [cyan]sanitizer export[/cyan] 导出")


@cli.command()
@click.argument('issue_index', type=int, required=False)
@click.option('--status', '-s', type=click.Choice(['open', 'in_progress', 'resolved', 'wont_fix', 'needs_review']),
              help='设置问题状态')
@click.option('--comment', '-c', help='添加备注')
@click.option('--name', '-n', help='指定姓名（用于添加化名覆盖规则）')
@click.option('--pseudonym', '-p', help='指定化名（配合 --name 使用）')
@click.pass_context
def review(ctx, issue_index: Optional[int], status: Optional[str], comment: Optional[str],
           name: Optional[str], pseudonym: Optional[str]):
    """保存人工处理意见
    
    支持两种操作模式：
    1. 问题状态管理：修改问题的处理状态和备注
    2. 姓名覆盖规则：添加或修改姓名到化名的映射
    
    示例：
      sanitizer review 1 --status resolved --comment "已替换化名"
      sanitizer review --name "张三" --pseudonym "张大爷"
    """
    project_dir = get_project_dir(ctx)
    state_manager = StateManager(project_dir)
    
    if not state_manager.is_initialized():
        console.print(Panel.fit(
            "[red]项目未初始化[/red]\n"
            "请先运行 [cyan]sanitizer init[/cyan] 命令",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)
    
    if name and pseudonym:
        state_manager.add_name_override(name, pseudonym, comment)
        console.print(Panel.fit(
            f"[green]已添加姓名覆盖规则[/green]\n"
            f"  原始姓名: {name}\n"
            f"  化名: {pseudonym}\n"
            + (f"  备注: {comment}" if comment else ""),
            title="操作成功",
            border_style="green"
        ))
        return
    
    scan_results = state_manager.get_scan_results()
    if not scan_results:
        console.print(Panel.fit(
            "[yellow]未找到扫描结果[/yellow]\n"
            "请先运行 [cyan]sanitizer scan[/cyan] 命令",
            title="提示",
            border_style="yellow"
        ))
        sys.exit(1)
    
    issues = scan_results.get('issues', [])
    
    if issue_index is None:
        _display_review_overview(state_manager, issues)
        return
    
    if issue_index < 1 or issue_index > len(issues):
        console.print(Panel.fit(
            f"[red]问题序号无效[/red]\n"
            f"有效范围: 1 - {len(issues)}",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)
    
    idx = issue_index - 1
    
    if status:
        status_map = {
            'open': IssueStatus.OPEN,
            'in_progress': IssueStatus.IN_PROGRESS,
            'resolved': IssueStatus.RESOLVED,
            'wont_fix': IssueStatus.WONT_FIX,
            'needs_review': IssueStatus.NEEDS_REVIEW,
        }
        issue_status = status_map[status]
        state_manager.update_issue_status(idx, issue_status, comment or "")
        
        console.print(Panel.fit(
            f"[green]已更新问题状态[/green]\n"
            f"  问题 #{issue_index}\n"
            f"  状态: {issue_status.value}\n"
            + (f"  备注: {comment}" if comment else ""),
            title="操作成功",
            border_style="green"
        ))
    else:
        _display_issue_detail(state_manager, issues, idx)


def _display_review_overview(state_manager: StateManager, issues: list):
    """显示复核概览"""
    console.print("\n[bold blue]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold blue]")
    console.print("[bold blue]          复核概览[/bold blue]")
    console.print("[bold blue]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold blue]\n")
    
    issue_notes = state_manager.load_state().issue_notes
    name_overrides = state_manager.get_name_overrides()
    
    if issues:
        table = Table(title="问题列表")
        table.add_column("#", style="cyan", justify="right")
        table.add_column("类型", style="magenta")
        table.add_column("状态", style="green")
        table.add_column("描述", style="white", no_wrap=True)
        
        for idx, issue in enumerate(issues, 1):
            issue_id = str(idx - 1)
            note = issue_notes.get(issue_id)
            
            status = note.status.value if note else "待处理"
            status_style = "green" if "已解决" in status or "不处理" in status else "yellow" if "处理中" in status else "white"
            
            desc = issue.get('description', '')
            if len(desc) > 40:
                desc = desc[:37] + "..."
            
            table.add_row(
                str(idx),
                issue.get('type', '未知'),
                f"[{status_style}]{status}[/]",
                desc
            )
        
        console.print(table)
    
    if name_overrides:
        console.print("\n[bold]姓名覆盖规则:[/bold]")
        table = Table()
        table.add_column("原始姓名", style="cyan")
        table.add_column("化名", style="green")
        table.add_column("备注", style="white")
        
        for name, override in name_overrides.items():
            table.add_row(
                name,
                override.override_pseudonym,
                override.comment or ""
            )
        
        console.print(table)
    
    console.print("\n操作提示:")
    console.print(f"  查看问题详情: [cyan]sanitizer review <问题序号>[/cyan]")
    console.print(f"  更新问题状态: [cyan]sanitizer review <序号> --status resolved --comment \"备注\"[/cyan]")
    console.print(f"  添加化名规则: [cyan]sanitizer review --name \"姓名\" --pseudonym \"化名\"[/cyan]")


def _display_issue_detail(state_manager: StateManager, issues: list, idx: int):
    """显示问题详情"""
    issue = issues[idx]
    issue_id = str(idx)
    note = state_manager.get_issue_status(idx)
    
    console.print("\n[bold]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold]")
    console.print(f"[bold]问题 {idx + 1} 详情[/bold]")
    console.print("[bold]━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━[/bold]\n")
    
    console.print(f"类型: [cyan]{issue.get('type', '未知')}[/cyan]")
    console.print(f"严重程度: [red]{issue.get('severity', 'unknown')}[/red]")
    console.print(f"描述: {issue.get('description', '')}")
    
    if note:
        console.print(f"\n当前状态: [green]{note.status.value}[/green]")
        if note.comment:
            console.print(f"备注: {note.comment}")
    
    location = issue.get('location')
    if location:
        console.print(f"\n位置: {location}")
    
    context = issue.get('context')
    if context:
        console.print(f"\n上下文: \"{context}\"")
    
    console.print("\n可用状态:")
    console.print("  open        - 待处理")
    console.print("  in_progress - 处理中")
    console.print("  resolved    - 已解决")
    console.print("  wont_fix    - 不处理")
    console.print("  needs_review- 需复核")


@cli.command()
@click.option('--output', '-o', 'output_dir', 
              type=click.Path(exists=False, file_okay=False, dir_okay=True),
              help='指定输出目录（默认为项目目录下的 output 文件夹）')
@click.option('--force', '-f', is_flag=True, help='强制导出（忽略未解决的问题）')
@click.pass_context
def export(ctx, output_dir: Optional[str], force: bool):
    """导出脱敏后的文件和审计包
    
    导出以下文件：
    1. sanitized.srt - 脱敏后的字幕文件
    2. review_report.md - Markdown 复核单
    3. audit_package.json - JSON 审计包（包含完整处理记录）
    """
    project_dir = get_project_dir(ctx)
    state_manager = StateManager(project_dir)
    
    if not state_manager.is_initialized():
        console.print(Panel.fit(
            "[red]项目未初始化[/red]\n"
            "请先运行 [cyan]sanitizer init[/cyan] 命令",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)
    
    scan_results = state_manager.get_scan_results()
    if not scan_results:
        console.print(Panel.fit(
            "[yellow]未找到扫描结果[/yellow]\n"
            "请先运行 [cyan]sanitizer scan[/cyan] 命令",
            title="提示",
            border_style="yellow"
        ))
        sys.exit(1)
    
    issues = scan_results.get('issues', [])
    high_severity_issues = [i for i in issues if i.get('severity') == 'high']
    
    if high_severity_issues and not force:
        issue_notes = state_manager.load_state().issue_notes
        unresolved = []
        
        for idx, issue in enumerate(high_severity_issues):
            original_idx = issues.index(issue)
            note = issue_notes.get(str(original_idx))
            if not note or note.status not in [IssueStatus.RESOLVED, IssueStatus.WONT_FIX]:
                unresolved.append(issue)
        
        if unresolved:
            console.print(Panel.fit(
                f"[red]存在 {len(unresolved)} 个未解决的高优先级问题[/red]\n\n"
                "建议先使用 [cyan]sanitizer review[/cyan] 处理这些问题。\n"
                "如需强制导出，请使用 [cyan]--force[/cyan] 选项。",
                title="警告",
                border_style="yellow"
            ))
            sys.exit(1)
    
    exporter = Exporter(project_dir)
    
    with console.status("[bold green]正在导出...[/bold green]"):
        try:
            output_paths = exporter.export_all()
        except Exception as e:
            console.print(Panel.fit(
                f"[red]导出失败: {e}[/red]",
                title="错误",
                border_style="red"
            ))
            sys.exit(1)
    
    console.print(Panel.fit(
        "[green]导出成功！[/green]\n\n"
        "已生成以下文件:\n"
        + "\n".join([f"  • {k}: {v}" for k, v in output_paths.items()]) + "\n\n"
        "文件说明:\n"
        "  • [cyan]sanitized.srt[/cyan] - 脱敏后的字幕文件\n"
        "  • [cyan]review_report.md[/cyan] - 复核单（用于人工审核）\n"
        "  • [cyan]audit_package.json[/cyan] - 审计包（包含完整处理记录）",
        title="导出完成",
        border_style="green"
    ))


if __name__ == '__main__':
    cli()
