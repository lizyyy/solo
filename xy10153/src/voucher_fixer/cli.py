from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .analyzer import DuplicateDetector, GapDetector, ReverseMatcher
from .fixer import AuditLog, RepairPlanner
from .parser import ParseError, VoucherCSVParser
from .reporter import HTMLReporter

app = typer.Typer(
    name="voucher-fixer",
    help="账套凭证断号修复 CLI",
    add_completion=False,
)
console = Console()


@app.command("analyze")
def analyze(
    files: List[str] = typer.Argument(..., help="要分析的 CSV 文件路径（支持多个）"),
    allow_reimport: bool = typer.Option(
        False,
        "--allow-reimport",
        "-r",
        help="允许重复导入同一文件",
    ),
    report_html: Optional[str] = typer.Option(
        None,
        "--html",
        help="生成 HTML 报告的输出路径",
    ),
    report_json: Optional[str] = typer.Option(
        None,
        "--json",
        help="生成 JSON 报告的输出路径",
    ),
    dry_run: bool = typer.Option(
        True,
        "--dry-run/--apply",
        help="运行模式：dry-run（默认）只分析不修改，--apply 会应用修复",
    ),
    verbose: bool = typer.Option(
        False,
        "--verbose",
        "-v",
        help="显示详细输出",
    ),
):
    """
    分析凭证文件，检测断号、重复和冲销配对问题。

    示例:
      voucher-fixer analyze ./vouchers.csv
      voucher-fixer analyze ./jan.csv ./feb.csv --html report.html --json report.json
    """
    audit = AuditLog()
    audit.info("start_analysis", "开始分析凭证文件")

    parser = VoucherCSVParser()
    for f in files:
        audit.info("parse_file", f"解析文件: {f}", file_path=f, source_ref=f)

    result = parser.parse_files(files, allow_reimport=allow_reimport)

    if result.has_errors():
        console.print(Panel.fit(
            f"[bold red]解析错误 ({len(result.errors)} 处)[/bold red]\n"
            + "\n".join(f"  • [{e.field}] {e.message}" for e in result.errors[:5]),
            title="解析失败",
            border_style="red",
        ))
        for e in result.errors:
            audit.error(
                "parse_error",
                e.message,
                source_ref=f"{e.source_file}:{e.line_number}",
                details={"field": e.field, "value": e.value},
            )
        raise typer.Exit(code=1)

    for w in result.warnings:
        audit.warning(
            "parse_warning",
            w.message,
            source_ref=f"{w.source_file}:{w.line_number}",
        )

    batch = result.batch
    audit.info(
        "parse_complete",
        f"共解析 {len(batch.vouchers)} 个凭证",
        details={"file_count": len(batch.source_files)},
    )

    _print_summary(batch, verbose)

    gap_detector = GapDetector()
    gap_analysis = gap_detector.analyze(batch)
    audit.info(
        "gap_detect",
        f"检测到 {len(gap_analysis.issues)} 个断号",
        details={"issues": len(gap_analysis.issues)},
    )

    dup_detector = DuplicateDetector()
    dup_analysis = dup_detector.analyze(batch)
    audit.info(
        "dup_detect",
        f"检测到 {len(dup_analysis.issues)} 组重复 (共 {dup_analysis.total_duplicates} 个)",
        details={"groups": len(dup_analysis.issues), "total": dup_analysis.total_duplicates},
    )

    reverse_matcher = ReverseMatcher()
    reverse_analysis = reverse_matcher.analyze(batch)
    audit.info(
        "reverse_match",
        f"配对 {len(reverse_analysis.pairs)} 组，未配对 {len(reverse_analysis.unmatched_reversals)} 个",
        details={
            "pairs": len(reverse_analysis.pairs),
            "unmatched": len(reverse_analysis.unmatched_reversals),
        },
    )

    _print_analysis_results(gap_analysis, dup_analysis, reverse_analysis, verbose)

    planner = RepairPlanner()
    repair_plan = planner.generate_plan(
        batch, gap_analysis, dup_analysis, reverse_analysis
    )
    audit.info(
        "repair_plan",
        f"生成 {len(repair_plan.actions)} 个修复建议",
        details={
            "actions": len(repair_plan.actions),
            "can_auto_apply": repair_plan.can_auto_apply,
        },
    )

    _print_repair_plan(repair_plan, dry_run)

    if not dry_run:
        console.print(Panel.fit(
            "[bold yellow]⚠️ 实际修复模式[/bold yellow]\n"
            "当前版本暂不支持自动修改原始文件。\n"
            "请根据生成的报告和修复建议手动修正。",
            title="修复模式",
            border_style="yellow",
        ))

    if report_html:
        reporter = HTMLReporter()
        path = reporter.generate(
            batch, gap_analysis, dup_analysis, reverse_analysis,
            repair_plan, audit, report_html,
        )
        audit.info("export_html", f"HTML 报告已生成: {path}", source_ref=path)
        console.print(f"\n[green]✅ HTML 报告:[/green] {path}")

    if report_json:
        export_json(batch, gap_analysis, dup_analysis, reverse_analysis, repair_plan, audit, report_json)
        console.print(f"[green]✅ JSON 报告:[/green] {report_json}")

    audit_csv = "audit.csv"
    audit.export_csv(audit_csv)
    console.print(f"[green]✅ 审计日志:[/green] {audit_csv}")

    summary = audit.get_summary()
    console.print(
        f"\n[bold]分析完成[/bold] — 成功 {summary['success']}, "
        f"错误 {summary['error']}"
    )


@app.command("validate")
def validate(
    files: List[str] = typer.Argument(..., help="要验证的 CSV 文件路径"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="显示详细信息"),
):
    """
    只验证文件格式，不进行深度分析。

    示例:
      voucher-fixer validate ./vouchers.csv
    """
    audit = AuditLog()
    parser = VoucherCSVParser()

    console.print(f"[bold]验证文件:[/bold] {', '.join(files)}")

    for f in files:
        result = parser.parse_file(f, allow_reimport=True)
        audit.info("validate", f"验证文件: {f}", file_path=f, source_ref=f)

        if result.has_errors():
            console.print(Panel.fit(
                "\n".join(f"  [{e.field}] {e.message}" for e in result.errors),
                title=f"❌ {f} 有错误",
                border_style="red",
            ))
            continue

        balanced = sum(1 for v in result.batch.vouchers if v.is_balanced())
        total = len(result.batch.vouchers)
        console.print(Panel.fit(
            f"凭证数: {total}\n"
            f"借贷平衡: {balanced}/{total}\n"
            f"解析警告: {len(result.warnings)}",
            title=f"✅ {f}",
            border_style="green",
        ))

    raise typer.Exit(code=0 if len(parser.imported_hashes) > 0 else 1)


def _print_summary(batch, verbose: bool):
    table = Table(title="凭证概览")
    table.add_column("凭证字", style="cyan")
    table.add_column("数量", justify="right")
    table.add_column("最小号", justify="right")
    table.add_column("最大号", justify="right")

    groups = batch.group_by_type()
    for vtype, vouchers in groups.items():
        sequences = [v.number_sequence for v in vouchers]
        table.add_row(
            vtype.value,
            str(len(vouchers)),
            str(min(sequences)),
            str(max(sequences)),
        )
    console.print(table)


def _print_analysis_results(gap, dup, rev, verbose: bool):
    if gap.has_issues():
        table = Table(title=f"🔍 断号 ({len(gap.issues)} 处)", show_lines=True)
        table.add_column("凭证字", style="cyan")
        table.add_column("缺失编号")
        table.add_column("来源上下文", style="dim")
        for issue in gap.issues:
            table.add_row(
                issue.voucher_type.value,
                str(issue.missing_number),
                issue.detail or "-",
            )
        console.print(table)

    if dup.has_issues():
        table = Table(title=f"🔄 重复凭证 ({dup.total_duplicates} 个)", show_lines=True)
        table.add_column("凭证", style="cyan")
        table.add_column("次数", justify="right")
        table.add_column("来源行", style="dim")
        for issue in dup.issues:
            table.add_row(
                f"{issue.voucher_type.value}{issue.voucher_number}",
                str(issue.count),
                " | ".join(issue.get_sources()),
            )
        console.print(table)

    if rev.pairs:
        table = Table(title=f"📋 冲销配对 ({len(rev.pairs)} 组)", show_lines=True)
        table.add_column("原凭证", style="cyan")
        table.add_column("冲销凭证", style="magenta")
        table.add_column("置信度", justify="right")
        table.add_column("匹配方式")
        for p in rev.pairs:
            table.add_row(
                f"{p.original.voucher_type.value}{p.original.voucher_number}",
                f"{p.reversal.voucher_type.value}{p.reversal.voucher_number}",
                f"{p.confidence:.0%}",
                p.matched_by,
            )
        console.print(table)

    if rev.unmatched_reversals:
        table = Table(title=f"⚠️ 未配对冲销 ({len(rev.unmatched_reversals)} 个)", show_lines=True)
        table.add_column("冲销凭证", style="red")
        table.add_column("原因", style="dim")
        table.add_column("可能匹配", style="yellow")
        for um in rev.unmatched_reversals:
            possible = (
                ", ".join(f"{p.voucher_type.value}{p.voucher_number}" for p in um.possible_matches[:3])
                if um.possible_matches else "-"
            )
            table.add_row(
                f"{um.voucher.voucher_type.value}{um.voucher.voucher_number}",
                um.reason,
                possible,
            )
        console.print(table)


def _print_repair_plan(plan, dry_run: bool):
    if not plan.has_actions():
        console.print(Panel.fit(
            "[bold green]✅ 未发现需要修复的问题[/bold green]",
            title="修复评估",
            border_style="green",
        ))
        return

    mode_label = "[bold yellow]DRY-RUN (预览)[/bold yellow]" if dry_run else "[bold red]APPLY (应用)[/bold red]"
    table = Table(title=f"🛠️ 修复建议 — {mode_label}", show_lines=True)
    table.add_column("ID", style="cyan")
    table.add_column("动作")
    table.add_column("风险")
    table.add_column("自动")

    for action in plan.actions:
        risk_style = {
            "high": "bold red",
            "medium": "yellow",
            "low": "green",
        }.get(action.risk_level, "white")
        auto = "✅" if action.can_auto_apply else "❌"
        table.add_row(
            action.id,
            action.title,
            f"[{risk_style}]{action.risk_level}[/{risk_style}]",
            auto,
        )
    console.print(table)

    s = plan.summary
    console.print(
        f"\n[bold]修复汇总[/bold]: {s['total_issues']} 项, "
        f"{s['auto_applicable']} 可自动, {s['high_risk']} 高风险"
    )


def export_json(batch, gap, dup, rev, plan, audit, path: str):
    data = {
        "batch": {
            "total_vouchers": len(batch.vouchers),
            "source_files": batch.source_files,
        },
        "gap": {
            "issue_count": len(gap.issues),
            "issues": [
                {
                    "voucher_type": i.voucher_type.value,
                    "missing_number": i.missing_number,
                    "detail": i.detail,
                }
                for i in gap.issues
            ],
        },
        "duplicate": {
            "issue_count": len(dup.issues),
            "total_duplicates": dup.total_duplicates,
            "issues": [
                {
                    "voucher_type": i.voucher_type.value,
                    "voucher_number": i.voucher_number,
                    "count": i.count,
                    "sources": i.get_sources(),
                }
                for i in dup.issues
            ],
        },
        "reverse": {
            "pair_count": len(rev.pairs),
            "unmatched_count": len(rev.unmatched_reversals),
        },
        "repair_plan": {
            "can_auto_apply": plan.can_auto_apply,
            "summary": plan.summary,
            "actions": [
                {
                    "id": a.id,
                    "type": a.action_type.value,
                    "title": a.title,
                    "description": a.description,
                    "impact": a.impact,
                    "source": a.source_reference,
                    "risk_level": a.risk_level,
                    "can_auto_apply": a.can_auto_apply,
                }
                for a in plan.actions
            ],
        },
        "audit_summary": audit.get_summary(),
    }
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    app()
