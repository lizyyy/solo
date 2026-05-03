import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from . import __version__
from .models import (
    EvidenceCatalog,
    CheckSession,
    CheckResult,
    RuleType,
    Severity,
    Reference,
    Objection,
)
from .parsers import (
    EvidenceCSVParser,
    MarkdownTranscriptParser,
    CrossExaminationJSONParser,
    JudgmentDraftParser,
)
from .rules import (
    RuleEngine,
    RuleContext,
    MissingReferenceRule,
    DuplicateReferenceRule,
    ConflictingReferenceRule,
    DateConflictRule,
    UnhandledObjectionRule,
)
from .storage import SessionManager
from .exporters import (
    MarkdownExporter,
    CSVExporter,
    JSONExporter,
    export_markdown_report,
    export_csv_issues,
    export_json_audit,
)
from .sample_data import generate_sample_files


console = Console()


def print_header():
    console.print(
        Panel.fit(
            f"[bold green]庭审笔录证据编号校验员[/bold green]\n"
            f"[dim]版本: {__version__}[/dim]",
            title="⚖️  Court Evidence Checker",
            border_style="blue",
        )
    )
    console.print()


@click.group()
@click.version_option(__version__)
def cli():
    """
    庭审笔录证据编号校验员 - 用于校验庭审笔录中的证据引用问题

    功能包括：
    - init: 生成样例数据文件
    - import: 导入和解析四类文件
    - check: 执行证据引用校验
    - report: 导出校验报告

    使用示例：
        evidence-checker init ./case-data
        evidence-checker import --transcript 庭审笔录.md --evidence 证据目录.csv --cross-exam 举证质证记录.json --judgment 裁判要点草稿.md
        evidence-checker check
        evidence-checker report --markdown --csv --json
    """
    pass


@cli.command()
@click.argument("output_dir", type=click.Path(path_type=Path))
@click.option("--prefix", "-p", default="", help="文件名前缀")
@click.option("--force", "-f", is_flag=True, help="强制覆盖已存在的文件")
def init(output_dir: Path, prefix: str, force: bool):
    """
    生成样例数据文件到指定目录

    生成四类样例文件：
    - 庭审笔录.md: 庭审转写 Markdown 文件
    - 证据目录.csv: 证据目录 CSV 文件
    - 举证质证记录.json: 举证质证记录 JSON 文件
    - 裁判要点草稿.md: 裁判要点草稿 Markdown 文件

    使用示例：
        evidence-checker init ./case-data
        evidence-checker init ./case-data --prefix "张三诉李四-"
    """
    print_header()

    if output_dir.exists() and not force:
        if any(output_dir.iterdir()):
            console.print(
                f"[bold red]错误:[/bold red] 目录 [blue]{output_dir}[/blue] 已存在且非空"
            )
            console.print("使用 --force 选项强制覆盖")
            sys.exit(1)

    console.print(f"[green]正在生成样例数据到:[/green] {output_dir}")
    console.print()

    try:
        files = generate_sample_files(output_dir, prefix)

        table = Table(title="生成的文件", show_lines=True)
        table.add_column("类型", style="cyan")
        table.add_column("文件名", style="magenta")
        table.add_column("状态", style="green")

        type_names = {
            "transcript": "庭审笔录",
            "evidence_list": "证据目录",
            "cross_examination": "举证质证记录",
            "judgment_draft": "裁判要点草稿",
        }

        for file_type, path in files.items():
            table.add_row(
                type_names.get(file_type, file_type),
                path.name,
                "[green]✓ 已生成[/green]",
            )

        console.print(table)
        console.print()
        console.print("[bold green]✓ 样例数据生成完成！[/bold green]")
        console.print()
        console.print("[dim]下一步操作:[/dim]")
        console.print(f"  1. 查看生成的文件: [cyan]ls {output_dir}[/cyan]")
        console.print(f"  2. 导入文件进行校验: [cyan]evidence-checker import --transcript {files['transcript']} --evidence {files['evidence_list']} --cross-exam {files['cross_examination']} --judgment {files['judgment_draft']}[/cyan]")

    except Exception as e:
        console.print(f"[bold red]生成失败:[/bold red] {e}")
        sys.exit(1)


@cli.command()
@click.option("--transcript", "-t", type=click.Path(exists=True, path_type=Path), help="庭审笔录 Markdown 文件路径")
@click.option("--evidence", "-e", type=click.Path(exists=True, path_type=Path), help="证据目录 CSV 文件路径")
@click.option("--cross-exam", "-x", type=click.Path(exists=True, path_type=Path), help="举证质证记录 JSON 文件路径")
@click.option("--judgment", "-j", type=click.Path(exists=True, path_type=Path), help="裁判要点草稿 Markdown 文件路径")
@click.option("--session-dir", "-s", type=click.Path(path_type=Path), default=Path("./.evidence-checker"), help="会话存储目录")
@click.option("--session-name", "-n", default=None, help="会话名称")
def import_files(
    transcript: Optional[Path],
    evidence: Optional[Path],
    cross_exam: Optional[Path],
    judgment: Optional[Path],
    session_dir: Path,
    session_name: Optional[str],
):
    """
    导入和解析四类文件

    至少需要提供一个文件路径。支持的文件类型：
    - 庭审笔录: Markdown 格式，包含证据引用
    - 证据目录: CSV 格式，包含所有证据的详细信息
    - 举证质证记录: JSON 格式，包含举证质证过程和异议
    - 裁判要点草稿: Markdown 格式，包含裁判要点中的证据引用

    使用示例：
        evidence-checker import --evidence 证据目录.csv
        evidence-checker import --transcript 庭审笔录.md --evidence 证据目录.csv
        evidence-checker import -t 笔录.md -e 证据.csv -x 质证.json -j 裁判.md
    """
    print_header()

    if not any([transcript, evidence, cross_exam, judgment]):
        console.print("[bold red]错误:[/bold red] 至少需要提供一个文件路径")
        console.print("使用 --help 查看帮助信息")
        sys.exit(1)

    console.print("[green]正在解析文件...[/green]")
    console.print()

    session_manager = SessionManager(session_dir)

    if session_name:
        session = session_manager.get_or_create(session_name)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session = session_manager.get_or_create(f"session_{timestamp}")

    parse_results = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        if transcript:
            task = progress.add_task(f"解析庭审笔录: {transcript.name}", total=None)
            parser = MarkdownTranscriptParser()
            result = parser.parse(transcript)
            parse_results["transcript"] = result
            session.transcript_content = result.raw_content
            progress.update(task, completed=True)

            if result.references:
                session.references.extend(result.references)

        if evidence:
            task = progress.add_task(f"解析证据目录: {evidence.name}", total=None)
            parser = EvidenceCSVParser()
            result = parser.parse(evidence)
            parse_results["evidence_list"] = result
            progress.update(task, completed=True)

            if result.evidence_catalog:
                session.evidence_catalog = result.evidence_catalog
                session.references.extend(result.references)

        if cross_exam:
            task = progress.add_task(f"解析举证质证记录: {cross_exam.name}", total=None)
            parser = CrossExaminationJSONParser()
            result = parser.parse(cross_exam)
            parse_results["cross_examination"] = result
            progress.update(task, completed=True)

            session.references.extend(result.references)
            session.objections.extend(result.objections)

        if judgment:
            task = progress.add_task(f"解析裁判要点草稿: {judgment.name}", total=None)
            parser = JudgmentDraftParser()
            result = parser.parse(judgment)
            parse_results["judgment_draft"] = result
            session.judgment_draft_content = result.raw_content
            progress.update(task, completed=True)

            session.references.extend(result.references)

    console.print()
    console.print("[bold green]✓ 解析完成！[/bold green]")
    console.print()

    stats_table = Table(title="解析统计", show_lines=True)
    stats_table.add_column("项目", style="cyan")
    stats_table.add_column("数量", style="magenta", justify="right")

    ref_count = len(session.references)
    evidence_count = len(session.evidence_catalog.evidences) if session.evidence_catalog else 0
    objection_count = len(session.objections)

    stats_table.add_row("证据引用", str(ref_count))
    stats_table.add_row("证据条目", str(evidence_count))
    stats_table.add_row("异议记录", str(objection_count))

    console.print(stats_table)
    console.print()

    if session.references:
        ref_table = Table(title="证据引用分布", show_lines=True)
        ref_table.add_column("证据编号", style="cyan")
        ref_table.add_column("引用次数", style="magenta", justify="right")
        ref_table.add_column("来源类型", style="green")

        ref_counts = {}
        ref_sources = {}
        for ref in session.references:
            ref_counts[ref.evidence_number] = ref_counts.get(ref.evidence_number, 0) + 1
            if ref.evidence_number not in ref_sources:
                ref_sources[ref.evidence_number] = set()
            ref_sources[ref.evidence_number].add(ref.reference_type.value)

        for ev_num, count in sorted(ref_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            ref_table.add_row(
                ev_num,
                str(count),
                ", ".join(sorted(ref_sources[ev_num])),
            )

        console.print(ref_table)
        console.print()

    session_manager.save(session)

    console.print(f"[dim]会话已保存到: {session_dir / session.session_id}[/dim]")
    console.print()
    console.print("[dim]下一步操作:[/dim]")
    console.print(f"  执行校验: [cyan]evidence-checker check --session-dir {session_dir}[/cyan]")


@cli.command()
@click.option("--session-dir", "-s", type=click.Path(path_type=Path), default=Path("./.evidence-checker"), help="会话存储目录")
@click.option("--session-id", "-i", default=None, help="会话 ID（不指定则使用最新会话）")
@click.option("--rules", "-r", multiple=True, help="指定要执行的规则（可多次指定）")
@click.option("--all", "-a", is_flag=True, help="执行所有规则（默认）")
def check(session_dir: Path, session_id: Optional[str], rules: tuple, all: bool):
    """
    执行证据引用校验

    校验规则：
    - missing_reference: 证据编号漏引（证据目录中存在但未被引用）
    - duplicate_reference: 重复引用（同一证据被多次引用但表述不一致）
    - conflicting_reference: 冲突引用（同一证据的描述存在矛盾）
    - date_conflict: 日期矛盾（同一事件的日期描述不一致）
    - unhandled_objection: 未处理异议（异议未被裁判要点处理）

    使用示例：
        evidence-checker check
        evidence-checker check --rules missing_reference --rules date_conflict
        evidence-checker check -i session_20260415_143000
    """
    print_header()

    session_manager = SessionManager(session_dir)

    if session_id:
        session = session_manager.load(session_id)
        if not session:
            console.print(f"[bold red]错误:[/bold red] 会话 [blue]{session_id}[/blue] 不存在")
            sys.exit(1)
    else:
        sessions = session_manager.list_sessions()
        if not sessions:
            console.print("[bold red]错误:[/bold red] 没有找到会话")
            console.print("请先执行 import 命令导入文件")
            sys.exit(1)
        session = sessions[0]

    console.print(f"[green]使用会话:[/green] {session.session_id}")
    console.print()

    if not session.evidence_catalog or not session.evidence_catalog.evidences:
        console.print("[bold yellow]警告:[/bold yellow] 没有导入证据目录，部分规则无法执行")
        console.print()

    if not session.references:
        console.print("[bold yellow]警告:[/bold yellow] 没有找到证据引用，部分规则无法执行")
        console.print()

    all_rules = [
        MissingReferenceRule(),
        DuplicateReferenceRule(),
        ConflictingReferenceRule(),
        DateConflictRule(),
        UnhandledObjectionRule(),
    ]

    if rules:
        selected_rules = []
        rule_map = {rule.rule_type.value: rule for rule in all_rules}
        for rule_name in rules:
            if rule_name in rule_map:
                selected_rules.append(rule_map[rule_name])
            else:
                console.print(f"[bold yellow]警告:[/bold yellow] 未知规则 [blue]{rule_name}[/blue]")
        rules_to_run = selected_rules
    else:
        rules_to_run = all_rules

    if not rules_to_run:
        console.print("[bold red]错误:[/bold red] 没有有效的规则可执行")
        sys.exit(1)

    engine = RuleEngine(rules_to_run)

    console.print("[green]正在执行校验规则...[/green]")
    console.print()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        for rule in rules_to_run:
            task = progress.add_task(f"执行规则: {rule.name}", total=None)
            progress.update(task, completed=True)

    references: List[Reference] = []
    for ref in session.references:
        if isinstance(ref, dict):
            references.append(Reference.from_dict(ref))
        else:
            references.append(ref)

    objections: List[Objection] = []
    for obj in session.objections:
        if isinstance(obj, dict):
            objections.append(Objection.from_dict(obj))
        else:
            objections.append(obj)

    evidence_catalog = session.evidence_catalog
    if isinstance(evidence_catalog, dict):
        from .models import EvidenceCatalog
        evidence_catalog = EvidenceCatalog.from_dict(evidence_catalog)

    rule_context = RuleContext(
        evidence_catalog=evidence_catalog,
        references=references,
        objections=objections,
        timeline_data=session.timeline,
        metadata={"session_id": session.session_id},
    )

    check_result = engine.run_all(
        context=rule_context,
        case_number=session.session_id,
        files_processed=[],
    )

    console.print()
    console.print("[bold green]✓ 校验完成！[/bold green]")
    console.print()

    rule_summary = Table(title="规则执行结果", show_lines=True)
    rule_summary.add_column("规则", style="cyan")
    rule_summary.add_column("状态", style="green")
    rule_summary.add_column("发现问题", style="magenta", justify="right")
    rule_summary.add_column("高危", style="red", justify="right")

    for rule in rules_to_run:
        rule_results = [r for r in check_result.results if r.rule_type == rule.rule_type]
        high_severity = [r for r in rule_results if r.severity == Severity.HIGH]
        rule_summary.add_row(
            rule.name,
            "[green]✓[/green]",
            str(len(rule_results)),
            str(len(high_severity)),
        )

    console.print(rule_summary)
    console.print()

    if check_result.results:
        issues_table = Table(title="发现的问题", show_lines=True)
        issues_table.add_column("严重程度", style="cyan")
        issues_table.add_column("规则类型", style="magenta")
        issues_table.add_column("问题描述", style="green", width=60)
        issues_table.add_column("涉及证据", style="yellow")

        severity_colors = {
            Severity.HIGH: "[red]高危[/red]",
            Severity.MEDIUM: "[yellow]中危[/yellow]",
            Severity.LOW: "[green]低危[/green]",
        }

        for result in check_result.results:
            issues_table.add_row(
                severity_colors.get(result.severity, result.severity.value),
                result.rule_type.value,
                result.message,
                ", ".join(result.evidence_numbers) if result.evidence_numbers else "-",
            )

        console.print(issues_table)
        console.print()

    session.check_result = check_result
    session_manager.save(session)

    console.print(f"[dim]校验结果已保存到会话: {session.session_id}[/dim]")
    console.print()
    console.print("[dim]下一步操作:[/dim]")
    console.print(f"  导出报告: [cyan]evidence-checker report --markdown --csv --json[/cyan]")


@cli.command()
@click.option("--output-dir", "-o", type=click.Path(path_type=Path), default=Path("./reports"), help="报告输出目录")
@click.option("--session-dir", "-s", type=click.Path(path_type=Path), default=Path("./.evidence-checker"), help="会话存储目录")
@click.option("--session-id", "-i", default=None, help="会话 ID（不指定则使用最新会话）")
@click.option("--markdown", "-m", is_flag=True, help="导出 Markdown 复核单")
@click.option("--csv", "-c", is_flag=True, help="导出 CSV 问题表")
@click.option("--json", "-j", is_flag=True, help="导出 JSON 审计包")
@click.option("--all", "-a", is_flag=True, help="导出所有格式（默认）")
@click.option("--prefix", "-p", default="", help="输出文件名前缀")
def report(
    output_dir: Path,
    session_dir: Path,
    session_id: Optional[str],
    markdown: bool,
    csv: bool,
    json: bool,
    all: bool,
    prefix: str,
):
    """
    导出校验报告

    支持导出三种格式的报告：
    - Markdown 复核单: 适合人工阅读和复核
    - CSV 问题表: 适合导入 Excel 进行数据分析
    - JSON 审计包: 包含完整校验信息，适合程序处理

    使用示例：
        evidence-checker report --markdown --csv --json
        evidence-checker report -o ./my-reports -m -c -j
        evidence-checker report --prefix "张三诉李四-"
    """
    print_header()

    session_manager = SessionManager(session_dir)

    if session_id:
        session = session_manager.load(session_id)
        if not session:
            console.print(f"[bold red]错误:[/bold red] 会话 [blue]{session_id}[/blue] 不存在")
            sys.exit(1)
    else:
        sessions = session_manager.list_sessions()
        if not sessions:
            console.print("[bold red]错误:[/bold red] 没有找到会话")
            console.print("请先执行 import 和 check 命令")
            sys.exit(1)
        session = sessions[0]

    if not session.check_result:
        console.print("[bold yellow]警告:[/bold yellow] 会话没有校验结果")
        console.print("请先执行 check 命令")
        sys.exit(1)

    console.print(f"[green]使用会话:[/green] {session.session_id}")
    console.print()

    if not any([markdown, csv, json]) or all:
        markdown = csv = json = True

    output_dir.mkdir(parents=True, exist_ok=True)

    console.print("[green]正在导出报告...[/green]")
    console.print()

    exported_files = []

    check_result = session.check_result

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        if markdown:
            task = progress.add_task("导出 Markdown 复核单", total=None)
            md_path = output_dir / f"{prefix}证据校验复核单.md"
            export_markdown_report(check_result, md_path)
            exported_files.append(("Markdown 复核单", md_path))
            progress.update(task, completed=True)

        if csv:
            task = progress.add_task("导出 CSV 问题表", total=None)
            csv_path = output_dir / f"{prefix}证据校验问题表.csv"
            export_csv_issues(check_result, csv_path)
            exported_files.append(("CSV 问题表", csv_path))
            progress.update(task, completed=True)

        if json:
            task = progress.add_task("导出 JSON 审计包", total=None)
            json_path = output_dir / f"{prefix}证据校验审计包.json"
            export_json_audit(
                output_path=json_path,
                check_result=check_result,
                check_session=session,
            )
            exported_files.append(("JSON 审计包", json_path))
            progress.update(task, completed=True)

    console.print()
    console.print("[bold green]✓ 报告导出完成！[/bold green]")
    console.print()

    files_table = Table(title="导出的文件", show_lines=True)
    files_table.add_column("类型", style="cyan")
    files_table.add_column("文件名", style="magenta")
    files_table.add_column("路径", style="green")

    for file_type, path in exported_files:
        files_table.add_row(
            file_type,
            path.name,
            str(path.resolve()),
        )

    console.print(files_table)
    console.print()

    stats_table = Table(title="报告摘要", show_lines=True)
    stats_table.add_column("项目", style="cyan")
    stats_table.add_column("数值", style="magenta", justify="right")

    if session.check_result:
        stats_table.add_row("总问题数", str(len(session.check_result.results)))
        high = len([r for r in session.check_result.results if r.severity == Severity.HIGH])
        medium = len([r for r in session.check_result.results if r.severity == Severity.MEDIUM])
        low = len([r for r in session.check_result.results if r.severity == Severity.LOW])
        stats_table.add_row("  高危", str(high))
        stats_table.add_row("  中危", str(medium))
        stats_table.add_row("  低危", str(low))

    if session.evidence_catalog:
        stats_table.add_row("证据总数", str(len(session.evidence_catalog.evidences)))
    stats_table.add_row("引用次数", str(len(session.references)))
    stats_table.add_row("异议记录", str(len(session.objections)))

    console.print(stats_table)
    console.print()

    console.print("[dim]报告已导出到目录:[/dim]")
    console.print(f"  [cyan]{output_dir.resolve()}[/cyan]")


def main():
    cli()


if __name__ == "__main__":
    main()
