#!/usr/bin/env python3
import typer
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from typing import Optional

from semantic_dedup.core import (
    load_candidates_from_csv,
    load_params_from_yaml,
    run_threshold_trial,
    apply_manual_correction,
    rerun_with_new_params,
    generate_playback_report,
    save_trial_run,
    load_trial_run,
    list_trial_runs,
)
from semantic_dedup.report import (
    print_playback_report,
    print_audit_logs,
    export_report_to_markdown,
)
from semantic_dedup.models import SampleStatus, NextAction, TrialRun

app = typer.Typer(
    help="语义去重阈值试算系统 - 帮助评测运营小孟解释阈值试算结果",
    add_completion=False,
)
console = Console()


@app.command("run")
def run_trial(
    candidates_csv: str = typer.Argument(..., help="召回候选表CSV文件路径"),
    params_yaml: str = typer.Argument(..., help="阈值参数YAML文件路径"),
    operator: str = typer.Option("评测运营小孟", "--operator", "-o", help="操作人"),
    reason: str = typer.Option("初始阈值试算", "--reason", "-r", help="操作原因"),
    workspace: str = typer.Option(".trial_runs", "--workspace", "-w", help="持久化目录"),
):
    """第一步：导入召回候选表，运行阈值试算，结果自动持久化"""
    console.print("[bold cyan]🎯 开始语义去重阈值试算[/bold cyan]")

    if not Path(candidates_csv).exists():
        console.print(f"[bold red]错误:[/bold red] 召回候选表文件不存在: {candidates_csv}")
        raise typer.Exit(1)

    if not Path(params_yaml).exists():
        console.print(f"[bold red]错误:[/bold red] 参数YAML文件不存在: {params_yaml}")
        raise typer.Exit(1)

    candidates = load_candidates_from_csv(candidates_csv)
    params = load_params_from_yaml(params_yaml)

    console.print(f"已加载 {len(candidates)} 条召回候选")
    console.print(f"参数配置: 去重阈值={params.dedup_threshold}, 少数类加权={params.minority_weight}")

    trial_run = run_threshold_trial(candidates, params, operator=operator, reason=reason)
    saved_path = save_trial_run(trial_run, workspace=Path(workspace))

    report = generate_playback_report(trial_run)
    print_playback_report(report, console)

    minority_masked = [item for item in report.items if item.status == SampleStatus.MINORITY_MASKED]
    if minority_masked:
        console.print()
        console.print("[bold yellow]⚠️  发现少数类样本被总指标盖住，已标记为待算法工程师复核，暂不归为正常[/bold yellow]")
        console.print(f"[bold yellow]   可用 'python cli.py correct {trial_run.run_id} <样本ID>' 进行人工修正[/bold yellow]")

    console.print()
    console.print(f"[green]✅ 试算运行已保存: {saved_path}[/green]")
    console.print(f"[bold]运行ID: {trial_run.run_id}[/bold]")


@app.command("correct")
def correct_sample(
    run_id: str = typer.Argument(..., help="试算运行ID（来自 run 命令输出）"),
    sample_id: str = typer.Argument(..., help="要修正的样本ID"),
    operator: str = typer.Option("评测运营小孟", "--operator", "-o", help="操作人"),
    reason: str = typer.Option(..., "--reason", "-r", help="修正原因"),
    status: Optional[SampleStatus] = typer.Option(None, "--status", "-s", help="新状态"),
    next_action: Optional[NextAction] = typer.Option(None, "--next", "-n", help="下一步处理人"),
    explanation: Optional[str] = typer.Option(None, "--explanation", "-e", help="自定义说明"),
    workspace: str = typer.Option(".trial_runs", "--workspace", "-w", help="持久化目录"),
):
    """第二步：基于已持久化的试算运行，对单条样本执行人工修正"""
    console.print("[bold magenta]✏️  执行人工修正[/bold magenta]")

    try:
        trial_run = load_trial_run(run_id, workspace=Path(workspace))
    except FileNotFoundError as e:
        console.print(f"[bold red]错误:[/bold red] {e}")
        raise typer.Exit(1)

    sample_exists = any(r.sample_id == sample_id for r in trial_run.results)
    if not sample_exists:
        console.print(f"[bold red]错误:[/bold red] 样本ID {sample_id} 不存在于运行 {run_id} 中")
        console.print("[dim]可用样本ID:[/dim]", ", ".join(r.sample_id for r in trial_run.results))
        raise typer.Exit(1)

    old_result = next(r for r in trial_run.results if r.sample_id == sample_id)
    console.print(f"样本ID: {sample_id}")
    console.print(f"修正前状态: {old_result.status}")
    console.print(f"修正前说明: {old_result.why_kept}")
    console.print(f"修正前下一步: {old_result.next_action}")
    console.print()

    if not status and not next_action and not explanation:
        console.print("[bold red]错误:[/bold red] 至少指定一个修改项: --status, --next, --explanation")
        raise typer.Exit(1)

    corrected_run = apply_manual_correction(
        trial_run=trial_run,
        sample_id=sample_id,
        operator=operator,
        reason=reason,
        new_status=status,
        new_next_action=next_action,
        custom_why_kept=explanation,
    )

    saved_path = save_trial_run(corrected_run, workspace=Path(workspace))

    new_result = next(r for r in corrected_run.results if r.sample_id == sample_id)
    console.print("[bold green]修正完成[/bold green]")
    console.print(f"修正后状态: {new_result.status}")
    console.print(f"修正后说明: {new_result.why_kept}")
    console.print(f"修正后下一步: {new_result.next_action}")
    console.print()

    report = generate_playback_report(corrected_run)
    print_playback_report(report, console)
    print_audit_logs(corrected_run.audit_logs, console)

    console.print(f"[green]✅ 修正结果已保存: {saved_path}[/green]")
    console.print(f"[bold]新运行ID: {corrected_run.run_id}[/bold]")


@app.command("rerun")
def rerun_trial(
    run_id: str = typer.Argument(..., help="试算运行ID（来自 run 或 correct 命令输出）"),
    params_yaml: str = typer.Argument(..., help="新的参数YAML文件路径"),
    operator: str = typer.Option("评测运营小孟", "--operator", "-o", help="操作人"),
    reason: str = typer.Option("参数调整后重跑", "--reason", "-r", help="重跑原因"),
    workspace: str = typer.Option(".trial_runs", "--workspace", "-w", help="持久化目录"),
):
    """第三步：基于已持久化的试算运行，调整参数YAML后重跑"""
    console.print("[bold blue]🔄 重新运行阈值试算（参数已调整）[/bold blue]")

    try:
        trial_run = load_trial_run(run_id, workspace=Path(workspace))
    except FileNotFoundError as e:
        console.print(f"[bold red]错误:[/bold red] {e}")
        raise typer.Exit(1)

    if not Path(params_yaml).exists():
        console.print(f"[bold red]错误:[/bold red] 参数YAML文件不存在: {params_yaml}")
        raise typer.Exit(1)

    new_params = load_params_from_yaml(params_yaml)

    console.print(f"旧参数: 去重阈值={trial_run.params.dedup_threshold}, 少数类加权={trial_run.params.minority_weight}")
    console.print(f"新参数: 去重阈值={new_params.dedup_threshold}, 少数类加权={new_params.minority_weight}")

    new_run = rerun_with_new_params(trial_run, new_params, operator=operator, reason=reason)
    saved_path = save_trial_run(new_run, workspace=Path(workspace))

    report = generate_playback_report(new_run)
    print_playback_report(report, console)
    print_audit_logs(new_run.audit_logs, console)

    console.print(f"[green]✅ 重跑结果已保存: {saved_path}[/green]")
    console.print(f"[bold]新运行ID: {new_run.run_id}[/bold]")


@app.command("show")
def show_run(
    run_id: str = typer.Argument(..., help="试算运行ID"),
    sample_id: Optional[str] = typer.Option(None, "--sample", "-s", help="只看某条样本的状态变化"),
    only_masked: bool = typer.Option(False, "--masked", help="只看少数类被总指标盖住的记录"),
    workspace: str = typer.Option(".trial_runs", "--workspace", "-w", help="持久化目录"),
):
    """查看试算运行详情，停在少数类被盖住处查看状态变化和历史留痕"""
    try:
        trial_run = load_trial_run(run_id, workspace=Path(workspace))
    except FileNotFoundError as e:
        console.print(f"[bold red]错误:[/bold red] {e}")
        raise typer.Exit(1)

    report = generate_playback_report(trial_run)

    if sample_id:
        _show_single_sample(trial_run, report, sample_id, console)
        return

    if only_masked:
        _show_masked_samples(trial_run, report, console)
        return

    print_playback_report(report, console)
    print_audit_logs(trial_run.audit_logs, console)


def _show_single_sample(trial_run: TrialRun, report, sample_id: str, console: Console):
    from semantic_dedup.report import STATUS_LABELS, STATUS_STYLES, NEXT_ACTION_ICONS

    item = next((i for i in report.items if i.sample_id == sample_id), None)
    if not item:
        console.print(f"[bold red]错误:[/bold red] 样本ID {sample_id} 不存在")
        console.print("[dim]可用样本ID:[/dim]", ", ".join(i.sample_id for i in report.items))
        return

    result = next(r for r in trial_run.results if r.sample_id == sample_id)
    status_label = STATUS_LABELS.get(item.status, item.status)
    next_action_label = NEXT_ACTION_ICONS.get(item.next_action, item.next_action)

    console.print()
    console.print(Panel.fit(
        f"[bold]样本 {sample_id} 状态详情[/bold]\n"
        f"[dim]运行ID: {trial_run.run_id}[/dim]",
        border_style="cyan",
    ))
    console.print()

    detail_table = Table(box=None, show_header=False)
    detail_table.add_column("属性", style="cyan bold", width=16)
    detail_table.add_column("值")
    detail_table.add_row("类别", item.category)
    detail_table.add_row("内容", item.content)
    detail_table.add_row("是否少数类", "是" if item.is_minority else "否")
    detail_table.add_row("当前状态", status_label)
    detail_table.add_row("原始得分", f"{item.original_score:.3f}")
    detail_table.add_row("调整后得分", f"{item.adjusted_score:.3f}")
    detail_table.add_row("阈值", f"{item.threshold:.3f}")
    detail_table.add_row("是否通过", "✅ 通过" if item.passed else "❌ 被过滤")
    detail_table.add_row("结果说明", item.explanation)
    detail_table.add_row("下一步找谁", next_action_label)
    console.print(detail_table)

    if item.minority_note:
        console.print()
        console.print(f"[bold orange3]{item.minority_note}[/bold orange3]")

    if item.missing_materials:
        console.print()
        console.print("[bold]📋 还缺什么材料:[/bold]")
        for mat in item.missing_materials:
            console.print(f"  • {mat}")

    sample_audits = [
        log for log in trial_run.audit_logs
        if sample_id in log.affected_samples
    ]
    if sample_audits:
        console.print()
        console.print("[bold magenta]📜 该样本的历史留痕[/bold magenta]")
        console.print()
        for i, log in enumerate(sample_audits, 1):
            console.print(f"  [dim]{log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}[/dim] "
                          f"[{log.operator}] {log.action}")
            if log.field_changed:
                console.print(f"    {log.field_changed}: {log.old_value} → {log.new_value}")
            console.print(f"    原因: {log.reason}")


def _show_masked_samples(trial_run: TrialRun, report, console: Console):
    from semantic_dedup.report import STATUS_LABELS, NEXT_ACTION_ICONS

    masked = [item for item in report.items if item.status == SampleStatus.MINORITY_MASKED]
    if not masked:
        console.print("[green]✅ 当前运行中没有少数类被总指标盖住的记录[/green]")
        return

    console.print()
    console.print(Panel.fit(
        f"[bold red]⚠️ 少数类样本被总指标盖住 — 需算法工程师复核[/bold red]\n"
        f"[dim]运行ID: {trial_run.run_id} | 共 {len(masked)} 条[/dim]",
        border_style="red",
    ))
    console.print()

    for item in masked:
        next_action_label = NEXT_ACTION_ICONS.get(item.next_action, item.next_action)
        console.print(f"[bold]── 样本 {item.sample_id} ──[/bold]")
        console.print(f"  类别: {item.category}")
        console.print(f"  内容: {item.content[:60]}{'...' if len(item.content) > 60 else ''}")
        console.print(f"  得分: 原始 {item.original_score:.3f} → 调整后 {item.adjusted_score:.3f} (阈值 {item.threshold:.3f})")
        console.print(f"  结果: {'✅ 通过' if item.passed else '❌ 被过滤'}")
        console.print(f"  结果说明: {item.explanation}")
        if item.missing_materials:
            console.print(f"  还缺材料: {', '.join(item.missing_materials)}")
        console.print(f"  下一步找谁: {next_action_label}")

        sample_audits = [
            log for log in trial_run.audit_logs
            if item.sample_id in log.affected_samples
        ]
        if sample_audits:
            console.print(f"  [dim]历史留痕 ({len(sample_audits)} 条):[/dim]")
            for log in sample_audits:
                line = f"    [{log.timestamp.strftime('%H:%M:%S')}] {log.operator} → {log.action}"
                if log.field_changed:
                    line += f" | {log.field_changed}: {log.old_value} → {log.new_value}"
                console.print(line)
        console.print()

    console.print("[bold]📌 建议操作:[/bold]")
    for item in masked:
        console.print(f"  python cli.py correct {trial_run.run_id} {item.sample_id} "
                      f"--status need_algo_review --next 算法工程师 "
                      f"--explanation '待算法工程师复核' --reason '<填写原因>'")


@app.command("list")
def list_runs(
    workspace: str = typer.Option(".trial_runs", "--workspace", "-w", help="持久化目录"),
):
    """列出所有已持久化的试算运行"""
    runs = list_trial_runs(workspace=Path(workspace))
    if not runs:
        console.print("[dim]暂无试算运行记录[/dim]")
        return

    console.print("[bold]📋 已保存的试算运行[/bold]")
    console.print()
    table = Table(box=None, show_header=True)
    table.add_column("运行ID", style="cyan bold")
    table.add_column("时间")
    table.add_column("人工修正", justify="center")
    table.add_column("结果")
    table.add_column("少数类被盖住", justify="center")

    for run in runs:
        corr = "✏️" if run["is_manual_correction"] else ""
        masked_str = f"[bold red]{run['minority_masked']}[/bold red]" if run["minority_masked"] > 0 else "0"
        ts = run["timestamp"][:19] if run["timestamp"] else "-"
        table.add_row(run["run_id"], ts, corr, run["result_summary"], masked_str)

    console.print(table)


@app.command("demo")
def run_demo(
    output_dir: str = typer.Option("./demo_output", "--output", "-o", help="演示输出目录"),
    workspace: str = typer.Option(".trial_runs", "--workspace", "-w", help="持久化目录"),
):
    """运行完整演示：导入→人工修正→重跑 三步流程（每步都持久化）"""
    console.print("[bold green]🌟 运行语义去重阈值试算完整演示[/bold green]")
    console.print()

    from demo_data import generate_demo_data

    Path(output_dir).mkdir(exist_ok=True)
    ws = Path(workspace)

    demo = generate_demo_data(output_dir)

    console.print("[bold cyan]===== 第一步：导入召回候选表，首次阈值试算 =====[/bold cyan]")
    console.print()

    step1_path = save_trial_run(demo["step1_run"], workspace=ws)
    step1_report = generate_playback_report(demo["step1_run"])
    print_playback_report(step1_report, console)

    minority_masked = [item for item in step1_report.items if item.status == SampleStatus.MINORITY_MASKED]
    if minority_masked:
        console.print()
        console.print("[bold yellow]⚠️  发现少数类样本被总指标盖住，已标记为待算法工程师复核，暂不归为正常[/bold yellow]")
        console.print(f"[bold yellow]   运行ID: {demo['step1_run'].run_id}[/bold yellow]")
        for item in minority_masked:
            console.print(f"   • 样本 {item.sample_id} ({item.category})")

    console.print()
    console.print(f"[green]✅ 第一步已保存: {step1_path}[/green]")
    console.print()
    console.print("[yellow]📢 评测运营小孟发现 S003 是稀有类别，需要人工修正[/yellow]")
    console.print()

    console.print("[bold magenta]===== 第二步：人工修正样本状态 =====[/bold magenta]")
    console.print()

    step2_path = save_trial_run(demo["step2_run"], workspace=ws)
    step2_report = generate_playback_report(demo["step2_run"])
    print_playback_report(step2_report, console)
    print_audit_logs(demo["step2_run"].audit_logs, console)

    console.print(f"[green]✅ 第二步已保存: {step2_path}[/green]")
    console.print()
    console.print("[yellow]📢 算法工程师反馈，建议调整参数后重跑[/yellow]")
    console.print()

    console.print("[bold blue]===== 第三步：调整参数后重跑 =====[/bold blue]")
    console.print()

    step3_path = save_trial_run(demo["step3_run"], workspace=ws)
    step3_report = generate_playback_report(demo["step3_run"])
    print_playback_report(step3_report, console)
    print_audit_logs(demo["step3_run"].audit_logs, console)

    console.print(f"[green]✅ 第三步已保存: {step3_path}[/green]")
    console.print()
    console.print("[bold green]✅ 演示完成！所有步骤已持久化，可随时查看[/bold green]")
    console.print()
    console.print("[dim]接下来可以:[/dim]")
    console.print(f"  python cli.py list                          # 查看所有运行")
    console.print(f"  python cli.py show {demo['step1_run'].run_id} --masked     # 只看少数类被盖住的记录")
    console.print(f"  python cli.py show {demo['step2_run'].run_id} --sample S003  # 查看S003的状态变化和历史留痕")
    console.print(f"  python cli.py correct {demo['step1_run'].run_id} S003 --status need_algo_review --reason '测试修正'")


@app.command("init-demo")
def init_demo(
    output_dir: str = typer.Option("./demo_data", "--output", "-o", help="演示数据输出目录"),
):
    """生成演示数据文件（召回候选表、参数YAML）"""
    from demo_data import generate_demo_data_files

    Path(output_dir).mkdir(exist_ok=True)
    generate_demo_data_files(output_dir)

    console.print(f"[bold green]✅ 演示数据已生成至: {output_dir}[/bold green]")
    console.print()
    console.print("包含文件:")
    console.print("  • recall_candidates.csv - 召回候选表")
    console.print("  • params_initial.yaml - 初始参数配置")
    console.print("  • params_updated.yaml - 调整后的参数配置")
    console.print()
    console.print("接下来可以运行:")
    console.print(f"  python cli.py run {output_dir}/recall_candidates.csv {output_dir}/params_initial.yaml")


if __name__ == "__main__":
    app()
