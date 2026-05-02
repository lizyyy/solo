import os
import sys
from datetime import datetime
from typing import Optional, List
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .parser import SRTParser, CSVParser, ChapterParser, ParseError
from .validator import Validator, ValidatorConfig, ValidationResult, ValidationIssue
from .fixer import Fixer, FixStrategy, FixResult
from .review import ReviewStore, ReviewSession, ReviewDecision
from .exporter import Exporter
from .models import IssueSeverity, IssueType, SubtitleItem, Speaker, Chapter


console = Console()


class Context:
    def __init__(self):
        self.subtitles: List[SubtitleItem] = []
        self.speakers: List[Speaker] = []
        self.chapters: List[Chapter] = []
        self.validation_result: Optional[ValidationResult] = None
        self.fix_result: Optional[FixResult] = None
        self.review_session: Optional[ReviewSession] = None
        self.original_files: dict = {}
        
        self.srt_path: Optional[str] = None
        self.csv_path: Optional[str] = None
        self.chapter_path: Optional[str] = None
        
        self.output_dir: str = "./output"
        self.project_name: str = "untitled"


pass_context = click.make_pass_decorator(Context, ensure=True)


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║              字幕时间轴修补器 v1.0.0                          ║
║         Subtitle Timeline Fixer for Podcast Editors           ║
╚══════════════════════════════════════════════════════════════╝
"""
    console.print(Text(banner, style="bold blue"))


def print_summary(ctx: Context):
    table = Table(title="当前项目状态")
    
    table.add_column("项目", style="cyan")
    table.add_column("数量", style="green")
    table.add_column("状态", style="yellow")
    
    srt_status = "✓ 已加载" if ctx.subtitles else "✗ 未加载"
    csv_status = "✓ 已加载" if ctx.speakers else "✗ 未加载"
    chapter_status = "✓ 已加载" if ctx.chapters else "✗ 未加载"
    valid_status = "✓ 已检查" if ctx.validation_result else "✗ 未检查"
    fix_status = "✓ 已修复" if ctx.fix_result else "✗ 未修复"
    
    table.add_row("字幕 (SRT)", str(len(ctx.subtitles)), srt_status)
    table.add_row("嘉宾名单 (CSV)", str(len(ctx.speakers)), csv_status)
    table.add_row("章节草稿", str(len(ctx.chapters)), chapter_status)
    table.add_row("规则检查", "-", valid_status)
    table.add_row("自动修复", "-", fix_status)
    
    console.print(table)


@click.group()
@click.option("--output-dir", "-o", default="./output", help="输出目录")
@click.option("--project", "-p", default="untitled", help="项目名称")
@pass_context
def cli(ctx: Context, output_dir: str, project: str):
    """字幕时间轴修补器 - 播客剪辑师专用的本地自动化工具"""
    ctx.output_dir = output_dir
    ctx.project_name = project
    os.makedirs(output_dir, exist_ok=True)


@cli.command()
@click.argument("srt_file", type=click.Path(exists=True))
@click.option("--csv", "-c", type=click.Path(exists=True), help="嘉宾名单CSV文件")
@click.option("--chapters", "-ch", type=click.Path(exists=True), help="章节草稿文件")
@pass_context
def import_cmd(ctx: Context, srt_file: str, csv: Optional[str], chapters: Optional[str]):
    """导入 SRT/CSV 文件"""
    print_banner()
    console.print(Panel.fit("📥 导入文件", style="bold green"))
    
    try:
        srt_parser = SRTParser()
        ctx.subtitles = srt_parser.parse_file(srt_file)
        ctx.srt_path = srt_file
        console.print(f"  ✓ 成功导入 SRT: {len(ctx.subtitles)} 条字幕", style="green")
    except ParseError as e:
        console.print(f"  ✗ 解析 SRT 失败: {e}", style="bold red")
        sys.exit(1)
    
    if csv:
        try:
            csv_parser = CSVParser()
            ctx.speakers = csv_parser.parse_file(csv)
            ctx.csv_path = csv
            console.print(f"  ✓ 成功导入 CSV: {len(ctx.speakers)} 位嘉宾", style="green")
            
            srt_parser.set_speaker_list(ctx.speakers)
            ctx.subtitles = srt_parser.parse_file(srt_file)
        except ParseError as e:
            console.print(f"  ✗ 解析 CSV 失败: {e}", style="bold red")
            sys.exit(1)
    
    if chapters:
        try:
            chapter_parser = ChapterParser()
            ctx.chapters = chapter_parser.parse_file(chapters)
            ctx.chapter_path = chapters
            console.print(f"  ✓ 成功导入章节: {len(ctx.chapters)} 个章节", style="green")
        except Exception as e:
            console.print(f"  ✗ 解析章节失败: {e}", style="bold red")
            sys.exit(1)
    
    console.print()
    print_summary(ctx)


@cli.command()
@click.option("--srt", "-s", type=click.Path(exists=True), help="SRT文件路径")
@click.option("--csv", "-c", type=click.Path(exists=True), help="嘉宾名单CSV文件")
@click.option("--chapters", "-ch", type=click.Path(exists=True), help="章节草稿文件")
@click.option("--max-duration", type=float, default=8.0, help="最大字幕时长(秒)")
@click.option("--require-speaker", is_flag=True, default=True, help="要求说话人标签")
@pass_context
def check(ctx: Context, srt: Optional[str], csv: Optional[str], 
          chapters: Optional[str], max_duration: float, require_speaker: bool):
    """检查时间轴问题"""
    print_banner()
    console.print(Panel.fit("🔍 规则检查", style="bold yellow"))
    
    if srt:
        try:
            srt_parser = SRTParser()
            ctx.subtitles = srt_parser.parse_file(srt)
            ctx.srt_path = srt
        except ParseError as e:
            console.print(f"  ✗ 解析 SRT 失败: {e}", style="bold red")
            sys.exit(1)
    
    if csv:
        try:
            csv_parser = CSVParser()
            ctx.speakers = csv_parser.parse_file(csv)
            ctx.csv_path = csv
        except ParseError as e:
            console.print(f"  ✗ 解析 CSV 失败: {e}", style="bold red")
            sys.exit(1)
    
    if chapters:
        try:
            chapter_parser = ChapterParser()
            ctx.chapters = chapter_parser.parse_file(chapters)
            ctx.chapter_path = chapters
        except Exception as e:
            console.print(f"  ✗ 解析章节失败: {e}", style="bold red")
            sys.exit(1)
    
    if not ctx.subtitles:
        console.print("  ✗ 请先导入 SRT 文件或使用 --srt 参数", style="bold red")
        sys.exit(1)
    
    config = ValidatorConfig(
        max_subtitle_duration=max_duration,
        require_speaker_label=require_speaker
    )
    
    validator = Validator(config)
    if ctx.speakers:
        validator.set_speakers(ctx.speakers)
    
    ctx.validation_result = validator.validate_all(ctx.subtitles, ctx.chapters)
    
    result = ctx.validation_result
    
    console.print()
    console.print(f"[bold]检查结果汇总:[/bold]")
    console.print(f"  总计问题: {result.total_count}")
    console.print(f"  严重 (CRITICAL): {result.critical_count}", style="bold red")
    console.print(f"  高危 (HIGH): {result.high_count}", style="bold red")
    console.print(f"  中等 (MEDIUM): {result.medium_count}", style="bold yellow")
    console.print(f"  低危 (LOW): {result.low_count}", style="dim")
    
    if result.issues:
        console.print()
        console.print(Panel.fit("📋 问题详情", style="bold red"))
        
        issues_by_severity = {}
        for issue in result.issues:
            sev = issue.severity.value
            if sev not in issues_by_severity:
                issues_by_severity[sev] = []
            issues_by_severity[sev].append(issue)
        
        for sev in ["critical", "high", "medium", "low"]:
            if sev in issues_by_severity:
                sev_issues = issues_by_severity[sev]
                style_map = {
                    "critical": "bold red",
                    "high": "red",
                    "medium": "yellow",
                    "low": "dim"
                }
                style = style_map.get(sev, "white")
                
                console.print(f"\n[{style}]■ {sev.upper()} ({len(sev_issues)}个问题)[/{style}]")
                
                for issue in sev_issues[:10]:
                    pos = f"字幕#{issue.subtitle_index}" if issue.subtitle_index else \
                          f"章节#{issue.chapter_index}" if issue.chapter_index else "未知位置"
                    console.print(f"  • [{style}]{pos}[/{style}]: {issue.message}")
                    if issue.suggested_fix:
                        console.print(f"    💡 建议: {issue.suggested_fix}", style="dim")
                
                if len(sev_issues) > 10:
                    console.print(f"    ... 还有 {len(sev_issues) - 10} 个问题", style="dim")
    
    if result.is_valid:
        console.print()
        console.print(Panel.fit("✅ 所有检查通过！", style="bold green"))
    else:
        console.print()
        console.print(Panel.fit("⚠️ 存在需要处理的问题", style="bold yellow"))
    
    console.print()
    print_summary(ctx)


@cli.command()
@click.option("--strategy", "-s", type=click.Choice(["conservative", "moderate", "aggressive"]),
              default="moderate", help="修复策略")
@click.option("--output", "-o", help="输出文件路径(不覆盖原文件)")
@pass_context
def fix(ctx: Context, strategy: str, output: Optional[str]):
    """生成不覆盖原文件的修补稿"""
    print_banner()
    console.print(Panel.fit("🔧 自动修复", style="bold magenta"))
    
    if not ctx.subtitles:
        console.print("  ✗ 请先运行 import 或 check 命令导入 SRT", style="bold red")
        sys.exit(1)
    
    strategy_map = {
        "conservative": FixStrategy.CONSERVATIVE,
        "moderate": FixStrategy.MODERATE,
        "aggressive": FixStrategy.AGGRESSIVE
    }
    fix_strategy = strategy_map[strategy]
    
    console.print(f"  使用修复策略: {strategy}")
    console.print(f"  保守模式: 仅修复明确的时间码错误")
    console.print(f"  中等模式: 修复重叠和时间码(默认)")
    console.print(f"  激进模式: 修复所有可自动修复的问题")
    console.print()
    
    fixer = Fixer(strategy=fix_strategy)
    if ctx.speakers:
        fixer.set_speakers(ctx.speakers)
    if ctx.chapters:
        fixer.set_chapters(ctx.chapters)
    
    ctx.fix_result = fixer.fix(ctx.subtitles, ctx.validation_result)
    
    result = ctx.fix_result
    
    console.print(f"[bold]修复结果汇总:[/bold]")
    console.print(f"  执行操作数: {result.action_count}")
    console.print(f"  自动应用数: {result.auto_fixed_count}")
    
    if result.actions:
        console.print()
        console.print(Panel.fit("📋 修复操作详情", style="bold magenta"))
        
        action_counts = {}
        for action in result.actions:
            atype = action.action_type
            action_counts[atype] = action_counts.get(atype, 0) + 1
        
        for action_type, count in action_counts.items():
            console.print(f"  • {action_type}: {count} 次")
        
        console.print()
        for action in result.actions[:15]:
            applied = "✓" if action.auto_applied else "○"
            console.print(f"  [{applied}] 字幕#{action.subtitle_index}: {action.reason}")
        
        if len(result.actions) > 15:
            console.print(f"  ... 还有 {len(result.actions) - 15} 个操作", style="dim")
    
    if result.remaining_issues:
        console.print()
        console.print(Panel.fit("⚠️ 需要手动处理的问题", style="bold yellow"))
        console.print(f"  剩余问题数: {len(result.remaining_issues)}")
        
        suggestions = fixer.get_manual_fix_suggestions(
            result.fixed_subtitles,
            ValidationResult(issues=result.remaining_issues)
        )
        
        for sug in suggestions[:5]:
            console.print(f"  • 问题: {sug['issue']['message']}")
            console.print(f"    建议操作: {', '.join(sug['suggested_actions'])}", style="dim")
    
    if output is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = Path(ctx.srt_path).stem if ctx.srt_path else ctx.project_name
        output = os.path.join(ctx.output_dir, f"{base_name}_fixed_{timestamp}.srt")
    
    exporter = Exporter()
    exporter.export_srt(result.fixed_subtitles, output)
    
    console.print()
    console.print(Panel.fit(f"✅ 修补稿已生成: {output}", style="bold green"))
    
    console.print()
    print_summary(ctx)


@cli.command()
@click.option("--session", "-s", help="指定会话ID(可选)")
@click.option("--approve", "-a", multiple=True, type=int, help="批准指定字幕索引")
@click.option("--reject", "-r", multiple=True, type=int, help="拒绝指定字幕索引")
@click.option("--comment", "-c", help="添加备注")
@click.option("--list", "-l", is_flag=True, help="列出所有会话")
@pass_context
def review(ctx: Context, session: Optional[str], approve: tuple, reject: tuple,
           comment: Optional[str], list: bool):
    """保存人工确认状态"""
    print_banner()
    console.print(Panel.fit("📝 人工复核", style="bold cyan"))
    
    review_store = ReviewStore()
    
    if list:
        sessions = review_store.list_sessions()
        if not sessions:
            console.print("  暂无复核会话", style="dim")
            return
        
        table = Table(title="复核会话列表")
        table.add_column("会话ID", style="cyan")
        table.add_column("项目", style="green")
        table.add_column("决策数", style="yellow")
        table.add_column("创建时间", style="dim")
        
        for s in sessions[:10]:
            table.add_row(
                s["session_id"][:12] + "...",
                s["project_name"] or "未命名",
                str(s["decision_count"]),
                s["created_at"][:19] if s["created_at"] else ""
            )
        
        console.print(table)
        return
    
    if session:
        ctx.review_session = review_store.load_session(session)
        if not ctx.review_session:
            console.print(f"  ✗ 找不到会话: {session}", style="bold red")
            sys.exit(1)
        console.print(f"  加载会话: {session}", style="green")
    elif not ctx.review_session:
        ctx.review_session = review_store.create_session(
            project_name=ctx.project_name,
            metadata={
                "srt_file": ctx.srt_path,
                "csv_file": ctx.csv_path,
                "chapter_file": ctx.chapter_path
            }
        )
        console.print(f"  创建新会话: {ctx.review_session.session_id}", style="green")
    
    sess = ctx.review_session
    
    for idx in approve:
        decision = ReviewDecision(
            subtitle_index=idx,
            approved=True,
            comment=comment,
            reviewed_at=datetime.now().isoformat()
        )
        review_store.add_decision(sess, decision)
        console.print(f"  ✓ 批准字幕 #{idx}", style="green")
    
    for idx in reject:
        decision = ReviewDecision(
            subtitle_index=idx,
            approved=False,
            comment=comment,
            reviewed_at=datetime.now().isoformat()
        )
        review_store.add_decision(sess, decision)
        console.print(f"  ✗ 拒绝字幕 #{idx}", style="red")
    
    saved_path = review_store.save_session(sess)
    
    summary = review_store.export_session_summary(sess)
    
    console.print()
    console.print(f"[bold]复核状态:[/bold]")
    console.print(f"  会话ID: {sess.session_id}")
    console.print(f"  总决策数: {summary['summary']['total_decisions']}")
    console.print(f"  已批准: {summary['summary']['approved_count']}", style="green")
    console.print(f"  已拒绝: {summary['summary']['rejected_count']}", style="red")
    
    if ctx.subtitles:
        pending = review_store.get_pending_subtitles(sess, len(ctx.subtitles))
        console.print(f"  待处理: {len(pending)}", style="yellow")
    
    console.print()
    console.print(Panel.fit(f"💾 复核状态已保存: {saved_path}", style="bold green"))


@cli.command()
@click.option("--srt", "-s", help="输出SRT路径")
@click.option("--markdown", "-m", help="输出Markdown章节稿路径")
@click.option("--audit", "-a", help="输出JSON审计包路径")
@click.option("--all", "-A", "export_all", is_flag=True, help="导出所有格式")
@click.option("--include-speaker/--no-speaker", default=True, help="在SRT中包含说话人标签")
@pass_context
def export(ctx: Context, srt: Optional[str], markdown: Optional[str], 
           audit: Optional[str], export_all: bool, include_speaker: bool):
    """导出修正 SRT、Markdown 章节稿和 JSON 审计包"""
    print_banner()
    console.print(Panel.fit("📤 导出文件", style="bold blue"))
    
    exporter = Exporter()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = ctx.project_name
    
    subtitles_to_export = ctx.subtitles
    if ctx.fix_result and ctx.fix_result.fixed_subtitles:
        subtitles_to_export = ctx.fix_result.fixed_subtitles
    
    outputs = {}
    
    if export_all or srt:
        if subtitles_to_export:
            if srt is None:
                srt = os.path.join(ctx.output_dir, f"{base_name}_{timestamp}.srt")
            outputs["srt"] = exporter.export_srt(
                subtitles_to_export, srt, include_speaker=include_speaker
            )
            console.print(f"  ✓ SRT 已导出: {outputs['srt']}", style="green")
        else:
            console.print("  ✗ 没有字幕可导出", style="bold red")
    
    if export_all or markdown:
        if ctx.chapters:
            if markdown is None:
                markdown = os.path.join(ctx.output_dir, f"{base_name}_chapters_{timestamp}.md")
            outputs["markdown"] = exporter.export_markdown_chapters(
                ctx.chapters, markdown
            )
            console.print(f"  ✓ Markdown章节稿 已导出: {outputs['markdown']}", style="green")
        else:
            console.print("  ⚠ 没有章节数据，跳过Markdown导出", style="dim")
    
    if export_all or audit:
        if audit is None:
            audit = os.path.join(ctx.output_dir, f"{base_name}_audit_{timestamp}.json")
        
        validation_dict = None
        if ctx.validation_result:
            validation_dict = ctx.validation_result.to_dict()
        
        fix_actions = None
        if ctx.fix_result:
            fix_actions = [asdict(a) for a in ctx.fix_result.actions]
        
        review_summary = None
        if ctx.review_session:
            review_store = ReviewStore()
            review_summary = review_store.export_session_summary(ctx.review_session)
        
        outputs["audit"] = exporter.export_audit_json(
            audit,
            subtitles=subtitles_to_export,
            speakers=ctx.speakers,
            chapters=ctx.chapters,
            validation_result=validation_dict,
            fix_actions=fix_actions,
            review_summary=review_summary,
            metadata={
                "project_name": ctx.project_name,
                "exported_at": datetime.now().isoformat(),
                "original_srt": ctx.srt_path,
                "original_csv": ctx.csv_path,
                "original_chapters": ctx.chapter_path
            }
        )
        console.print(f"  ✓ JSON审计包 已导出: {outputs['audit']}", style="green")
    
    console.print()
    console.print(Panel.fit("✅ 导出完成！", style="bold green"))
    
    if outputs:
        console.print("\n[bold]导出文件清单:[/bold]")
        for fmt, path in outputs.items():
            console.print(f"  • {fmt.upper()}: {path}")


@cli.command()
@pass_context
def status(ctx: Context):
    """显示当前项目状态"""
    print_banner()
    print_summary(ctx)
    
    if ctx.validation_result:
        console.print()
        console.print(f"[bold]上次检查结果:[/bold]")
        r = ctx.validation_result
        console.print(f"  有效: {'✓' if r.is_valid else '✗'}")
        console.print(f"  问题数: {r.total_count}")
        if r.critical_count:
            console.print(f"  严重: {r.critical_count}", style="bold red")
    
    if ctx.fix_result:
        console.print()
        console.print(f"[bold]上次修复结果:[/bold]")
        f = ctx.fix_result
        console.print(f"  操作数: {f.action_count}")
        console.print(f"  自动应用: {f.auto_fixed_count}")
    
    if ctx.review_session:
        console.print()
        console.print(f"[bold]复核会话:[/bold]")
        console.print(f"  会话ID: {ctx.review_session.session_id}")
        console.print(f"  决策数: {len(ctx.review_session.decisions)}")


if __name__ == "__main__":
    cli()
