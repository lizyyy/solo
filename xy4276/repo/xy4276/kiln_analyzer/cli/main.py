from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from kiln_analyzer import __version__
from kiln_analyzer.models import (
    AnalysisResult,
    DefectRecord,
    KilnLoad,
    TargetCurve,
    ThermocoupleData,
)
from kiln_analyzer.parsers import (
    DefectJSONParser,
    KilnLoadJSONParser,
    TargetCurveYAMLParser,
    ThermocoupleCSVParser,
)
from kiln_analyzer.thermal import HeatIntegralCalculator, PhaseDeviationCalculator
from kiln_analyzer.rules import RiskAssessmentEngine
from kiln_analyzer.storage import ReviewSessionStore
from kiln_analyzer.report import (
    CSVResultExporter,
    JSONResultExporter,
    MarkdownExporter,
)

console = Console()


@click.group()
@click.version_option(version=__version__)
def main():
    """窑炉烧成曲线复盘器 - 用于陶艺工作室的烧成曲线分析和复盘工具"""
    pass


@main.command()
@click.option(
    "--tc-data",
    "-t",
    type=click.Path(exists=True, dir_okay=False),
    required=True,
    help="热电偶温度数据 CSV 文件路径",
)
@click.option(
    "--curve",
    "-c",
    type=click.Path(exists=True, dir_okay=False),
    required=True,
    help="目标烧成曲线 YAML 文件路径",
)
@click.option(
    "--load",
    "-l",
    type=click.Path(exists=True, dir_okay=False),
    help="窑车装载 JSON 文件路径",
)
@click.option(
    "--defects",
    "-d",
    type=click.Path(exists=True, dir_okay=False),
    help="成品瑕疵记录 JSON 文件路径",
)
@click.option(
    "--batch-id",
    "-b",
    type=str,
    help="批次ID (自动推断或指定)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(),
    help="输出目录路径",
)
@click.option(
    "--markdown",
    "-m",
    is_flag=True,
    help="同时导出 Markdown 报告",
)
@click.option(
    "--json",
    "-j",
    is_flag=True,
    help="同时导出 JSON 结果包",
)
@click.option(
    "--csv",
    "-C",
    is_flag=True,
    help="同时导出 CSV 结果包",
)
def analyze(
    tc_data: str,
    curve: str,
    load: Optional[str],
    defects: Optional[str],
    batch_id: Optional[str],
    output: Optional[str],
    markdown: bool,
    json: bool,
    csv: bool,
):
    """分析烧成曲线数据，计算偏差、热量积分和风险评估"""

    console.print(Panel("[bold blue]窑炉烧成曲线复盘器 - 分析工具[/bold blue]"))

    tc_path = Path(tc_data)
    curve_path = Path(curve)
    load_path = Path(load) if load else None
    defects_path = Path(defects) if defects else None

    console.print("\n[cyan]📂 正在加载数据文件...[/cyan]")

    try:
        tc_parser = ThermocoupleCSVParser.from_template()
        tc_data_list: List[ThermocoupleData] = tc_parser.parse(tc_path)
        console.print(f"  ✓ 热电偶数据: {len(tc_data_list)} 条记录")

        curve_parser = TargetCurveYAMLParser()
        target_curve: TargetCurve = curve_parser.parse(curve_path)
        console.print(f"  ✓ 目标曲线: {target_curve.name}, {len(target_curve.phases)} 个阶段")

        kiln_load: Optional[KilnLoad] = None
        if load_path:
            load_parser = KilnLoadJSONParser()
            kiln_load = load_parser.parse(load_path)
            console.print(f"  ✓ 窑车装载: {kiln_load.total_pieces} 件作品")

        defect_records: List[DefectRecord] = []
        if defects_path:
            defect_parser = DefectJSONParser()
            defect_records = defect_parser.parse(defects_path)
            console.print(f"  ✓ 瑕疵记录: {len(defect_records)} 条")

        if not batch_id:
            if kiln_load:
                batch_id = kiln_load.batch_id
            else:
                batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        console.print(f"\n[cyan]📊 开始分析批次 {batch_id}...[/cyan]")

        deviation_calc = PhaseDeviationCalculator()
        deviations = deviation_calc.calculate_all_phases(target_curve, tc_data_list)
        console.print(f"  ✓ 阶段偏差分析完成: {len(deviations)} 个阶段")

        heat_calc = HeatIntegralCalculator()
        integrals = heat_calc.calculate_all_phases(target_curve, tc_data_list)
        console.print(f"  ✓ 热量积分计算完成")

        risk_engine = RiskAssessmentEngine()
        risk_assessment = risk_engine.assess_batch(
            deviations, integrals, kiln_load, defect_records
        )
        console.print(f"  ✓ 风险评估完成")

        analysis_result = AnalysisResult(
            batch_id=batch_id,
            analysis_time=datetime.now(),
            curve_name=target_curve.name,
            phase_deviations=deviations,
            heat_integrals=integrals,
            risk_assessment=risk_assessment,
        )

        _display_summary(analysis_result, target_curve, kiln_load)

        if output:
            output_path = Path(output)
            output_path.mkdir(parents=True, exist_ok=True)

            if markdown or not (json or csv):
                md_exporter = MarkdownExporter()
                md_content = md_exporter.generate_report(
                    analysis_result, target_curve, kiln_load
                )
                md_file = output_path / f"{batch_id}_report.md"
                md_exporter.save_report(md_content, md_file)
                console.print(f"\n[green]✓ Markdown 报告已保存: {md_file}[/green]")

            if json:
                json_exporter = JSONResultExporter()
                json_file = output_path / f"{batch_id}_result.json"
                json_exporter.export(analysis_result, json_file)
                console.print(f"[green]✓ JSON 结果已保存: {json_file}[/green]")

            if csv:
                csv_exporter = CSVResultExporter()
                csv_dir = output_path / f"{batch_id}_csv"
                written_files = csv_exporter.export(analysis_result, csv_dir)
                console.print(f"[green]✓ CSV 结果已保存到: {csv_dir} ({len(written_files)} 个文件)[/green]")

    except Exception as e:
        console.print(f"\n[red]✗ 分析过程中发生错误: {e}[/red]")
        raise click.Abort()


@main.command("list-sessions")
@click.option(
    "--storage-dir",
    "-s",
    type=click.Path(file_okay=False),
    default="./kiln_reviews",
    help="复盘存储目录",
)
def list_sessions(storage_dir: str):
    """列出所有复盘会话"""

    store_path = Path(storage_dir)
    store = ReviewSessionStore(store_path)

    sessions = store.list_all_sessions()

    if not sessions:
        console.print("[yellow]暂无复盘会话记录[/yellow]")
        return

    table = Table(title="复盘会话列表")
    table.add_column("会话ID", style="cyan")
    table.add_column("批次ID", style="magenta")
    table.add_column("创建时间", style="green")
    table.add_column("更新时间", style="blue")
    table.add_column("笔记数", style="yellow")

    for session in sessions:
        table.add_row(
            session["session_id"],
            session["batch_id"],
            session["created_at"][:19] if session["created_at"] else "",
            session["updated_at"][:19] if session["updated_at"] else "",
            session["note_count"],
        )

    console.print(table)


@main.command("new-session")
@click.option(
    "--batch-id",
    "-b",
    type=str,
    required=True,
    help="批次ID",
)
@click.option(
    "--author",
    "-a",
    type=str,
    help="复盘人",
)
@click.option(
    "--storage-dir",
    "-s",
    type=click.Path(file_okay=False),
    default="./kiln_reviews",
    help="复盘存储目录",
)
def new_session(batch_id: str, author: Optional[str], storage_dir: str):
    """创建新的复盘会话"""

    store_path = Path(storage_dir)
    store = ReviewSessionStore(store_path)

    session = store.create_session(batch_id, author)

    console.print(f"\n[green]✓ 复盘会话已创建[/green]")
    console.print(f"  会话ID: {session.session_id}")
    console.print(f"  批次ID: {session.batch_id}")
    console.print(f"\n  使用以下命令添加笔记:")
    console.print(f"  kiln-analyzer add-note -s {session.session_id} -c \"笔记内容\"")


@main.command("add-note")
@click.option(
    "--session-id",
    "-s",
    type=str,
    required=True,
    help="会话ID",
)
@click.option(
    "--content",
    "-c",
    type=str,
    required=True,
    help="笔记内容",
)
@click.option(
    "--category",
    "-t",
    type=click.Choice(["观察", "建议", "问题", "教训"]),
    default="观察",
    help="笔记分类",
)
@click.option(
    "--author",
    "-a",
    type=str,
    help="作者",
)
@click.option(
    "--layer",
    "-l",
    type=str,
    help="关联层位",
)
@click.option(
    "--phase",
    "-p",
    type=click.Choice(["heating", "holding", "cooling"]),
    help="关联阶段",
)
@click.option(
    "--storage-dir",
    "-s",
    "storage_dir",
    type=click.Path(file_okay=False),
    default="./kiln_reviews",
    help="复盘存储目录",
)
def add_note(
    session_id: str,
    content: str,
    category: str,
    author: Optional[str],
    layer: Optional[str],
    phase: Optional[str],
    storage_dir: str,
):
    """向复盘会话添加笔记"""

    store_path = Path(storage_dir)
    store = ReviewSessionStore(store_path)

    note = store.add_note(
        session_id=session_id,
        content=content,
        category=category,
        author=author,
        related_layer=layer,
        related_phase=phase,
    )

    if note:
        console.print(f"\n[green]✓ 笔记已添加[/green]")
        console.print(f"  笔记ID: {note.note_id}")
        console.print(f"  分类: {category}")
    else:
        console.print(f"\n[red]✗ 会话 {session_id} 不存在[/red]")


@main.command("add-conclusion")
@click.option(
    "--session-id",
    "-s",
    type=str,
    required=True,
    help="会话ID",
)
@click.option(
    "--conclusion",
    "-c",
    type=str,
    required=True,
    help="复盘结论",
)
@click.option(
    "--recommendation",
    "-r",
    multiple=True,
    help="改进建议 (可多次使用)",
)
@click.option(
    "--storage-dir",
    "-s",
    "storage_dir",
    type=click.Path(file_okay=False),
    default="./kiln_reviews",
    help="复盘存储目录",
)
def add_conclusion(
    session_id: str,
    conclusion: str,
    recommendation: tuple,
    storage_dir: str,
):
    """添加复盘结论和改进建议"""

    store_path = Path(storage_dir)
    store = ReviewSessionStore(store_path)

    recommendations = list(recommendation) if recommendation else None

    success = store.update_conclusion(session_id, conclusion, recommendations)

    if success:
        console.print(f"\n[green]✓ 复盘结论已更新[/green]")
    else:
        console.print(f"\n[red]✗ 会话 {session_id} 不存在[/red]")


@main.command("export-report")
@click.option(
    "--session-id",
    "-s",
    type=str,
    required=True,
    help="会话ID",
)
@click.option(
    "--tc-data",
    "-t",
    type=click.Path(exists=True, dir_okay=False),
    help="热电偶温度数据 (可选，用于完整报告)",
)
@click.option(
    "--curve",
    "-c",
    type=click.Path(exists=True, dir_okay=False),
    help="目标烧成曲线 (可选，用于完整报告)",
)
@click.option(
    "--load",
    "-l",
    type=click.Path(exists=True, dir_okay=False),
    help="窑车装载 (可选)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(),
    required=True,
    help="输出文件路径",
)
@click.option(
    "--storage-dir",
    "-s",
    "storage_dir",
    type=click.Path(file_okay=False),
    default="./kiln_reviews",
    help="复盘存储目录",
)
def export_report(
    session_id: str,
    tc_data: Optional[str],
    curve: Optional[str],
    load: Optional[str],
    output: str,
    storage_dir: str,
):
    """导出包含复盘记录的完整报告"""

    store_path = Path(storage_dir)
    store = ReviewSessionStore(store_path)

    session = store.get_session(session_id)
    if not session:
        console.print(f"\n[red]✗ 会话 {session_id} 不存在[/red]")
        return

    analysis_result: Optional[AnalysisResult] = None
    target_curve: Optional[TargetCurve] = None
    kiln_load: Optional[KilnLoad] = None

    if tc_data and curve:
        console.print("[cyan]正在加载分析数据...[/cyan]")
        tc_parser = ThermocoupleCSVParser.from_template()
        tc_data_list = tc_parser.parse(Path(tc_data))

        curve_parser = TargetCurveYAMLParser()
        target_curve = curve_parser.parse(Path(curve))

        deviation_calc = PhaseDeviationCalculator()
        deviations = deviation_calc.calculate_all_phases(target_curve, tc_data_list)

        heat_calc = HeatIntegralCalculator()
        integrals = heat_calc.calculate_all_phases(target_curve, tc_data_list)

        risk_engine = RiskAssessmentEngine()
        risk_assessment = risk_engine.assess_batch(deviations, integrals)

        analysis_result = AnalysisResult(
            batch_id=session.batch_id,
            analysis_time=datetime.now(),
            curve_name=target_curve.name,
            phase_deviations=deviations,
            heat_integrals=integrals,
            risk_assessment=risk_assessment,
        )

    if load:
        load_parser = KilnLoadJSONParser()
        kiln_load = load_parser.parse(Path(load))

    if analysis_result and target_curve:
        md_exporter = MarkdownExporter()
        md_content = md_exporter.generate_report(
            analysis_result, target_curve, kiln_load, session
        )
        output_path = Path(output)
        md_exporter.save_report(md_content, output_path)
        console.print(f"\n[green]✓ 完整报告已导出: {output_path}[/green]")
    else:
        md_content = _generate_simple_report(session, kiln_load)
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        console.print(f"\n[green]✓ 复盘报告已导出: {output_path}[/green]")


def _display_summary(
    result: AnalysisResult,
    curve: TargetCurve,
    load: Optional[KilnLoad],
):
    """显示分析摘要"""

    console.print()
    console.print(Panel("[bold green]✅ 分析完成 - 结果摘要[/bold green]"))

    risk_display = RiskAssessmentEngine.format_risk_level(result.risk_assessment.overall_risk)
    console.print(f"\n📊 [bold]整体风险等级[/bold]: {risk_display}")
    console.print(f"📈 [bold]风险评分[/bold]: {result.risk_assessment.overall_score:.2f}")

    if result.risk_assessment.critical_factors:
        console.print("\n⚠️ [bold yellow]关键风险因素[/bold yellow]:")
        for factor in result.risk_assessment.critical_factors[:5]:
            console.print(f"   • {factor}")

    console.print("\n🧱 [bold]各层风险[/bold]:")
    layer_table = Table(show_header=True)
    layer_table.add_column("层位", style="cyan")
    layer_table.add_column("风险等级", style="magenta")
    layer_table.add_column("风险评分", style="green")
    layer_table.add_column("风险因素数", style="yellow")

    for layer_name, risk in result.risk_assessment.layer_risks.items():
        risk_emoji = RiskAssessmentEngine.format_risk_level(risk.risk_level)
        layer_table.add_row(
            layer_name,
            risk_emoji,
            f"{risk.risk_score:.2f}",
            str(len(risk.risk_factors)),
        )

    console.print(layer_table)

    console.print("\n📈 [bold]各阶段温度偏差摘要[/bold]:")
    dev_table = Table(show_header=True)
    dev_table.add_column("阶段", style="cyan")
    dev_table.add_column("类型", style="magenta")

    first_dev = result.phase_deviations[0] if result.phase_deviations else None
    if first_dev:
        for layer_name in first_dev.avg_temp_deviation.keys():
            dev_table.add_column(f"{layer_name} 偏差", style="green")

    for dev in result.phase_deviations:
        type_name = {
            "heating": "升温",
            "holding": "保温",
            "cooling": "冷却",
        }.get(dev.phase_type.value, dev.phase_type.value)

        row = [dev.phase_name, type_name]
        for layer_name in first_dev.avg_temp_deviation.keys() if first_dev else []:
            avg_dev = dev.avg_temp_deviation.get(layer_name, 0.0)
            sign = "+" if avg_dev > 0 else ""
            row.append(f"{sign}{avg_dev:.1f}°C")

        dev_table.add_row(*row)

    console.print(dev_table)

    if result.risk_assessment.suggestions:
        console.print("\n💡 [bold]改进建议[/bold]:")
        for suggestion in result.risk_assessment.suggestions[:3]:
            console.print(f"   • {suggestion}")


def _generate_simple_report(session, load: Optional[KilnLoad]) -> str:
    """生成简单的复盘报告"""
    lines = []

    lines.append(f"# 窑炉烧成复盘报告")
    lines.append("")
    lines.append(f"> 批次ID: {session.batch_id}")
    lines.append(f"> 会话ID: {session.session_id}")
    lines.append(f"> 创建时间: {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("---")
    lines.append("")

    if session.notes:
        lines.append("## 📝 复盘笔记")
        lines.append("")

        for note in session.notes:
            author = note.author or "匿名"
            time_str = note.created_at.strftime("%Y-%m-%d %H:%M")
            lines.append(f"### [{note.category}] {author} ({time_str})")
            lines.append("")
            lines.append(note.content)
            lines.append("")

    if session.conclusion:
        lines.append("## 📋 复盘结论")
        lines.append("")
        lines.append(session.conclusion)
        lines.append("")

    if session.recommendations:
        lines.append("## 💡 改进建议")
        lines.append("")
        for rec in session.recommendations:
            lines.append(f"- {rec}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(f"*本报告由窑炉烧成曲线复盘器生成*")

    return "\n".join(lines)


if __name__ == "__main__":
    main()
