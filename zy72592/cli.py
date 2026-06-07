#!/usr/bin/env python3
import typer
from pathlib import Path
from rich.console import Console
from typing import Optional

from semantic_dedup.core import (
    load_candidates_from_csv,
    load_params_from_yaml,
    save_params_to_yaml,
    run_threshold_trial,
    apply_manual_correction,
    rerun_with_new_params,
    generate_playback_report,
)
from semantic_dedup.report import (
    print_playback_report,
    print_audit_logs,
    export_report_to_json,
    export_report_to_markdown,
)
from semantic_dedup.models import SampleStatus, NextAction, ThresholdParams

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
    output_json: Optional[str] = typer.Option(None, "--json", help="导出JSON报告路径"),
    output_md: Optional[str] = typer.Option(None, "--md", help="导出Markdown报告路径"),
    show_audit: bool = typer.Option(False, "--audit", help="显示审计日志"),
):
    """第一步：导入召回候选表，运行阈值试算"""
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
    report = generate_playback_report(trial_run)
    
    print_playback_report(report, console)
    
    minority_masked = [item for item in report.items if item.status == SampleStatus.MINORITY_MASKED]
    if minority_masked:
        console.print()
        console.print("[bold yellow]⚠️  发现少数类样本被总指标盖住，已标记为待算法工程师复核，暂不归为正常[/bold yellow]")
    
    if output_json:
        export_report_to_json(report, output_json)
        console.print(f"[green]✅ JSON报告已导出至: {output_json}[/green]")
    
    if output_md:
        export_report_to_markdown(report, output_md)
        console.print(f"[green]✅ Markdown报告已导出至: {output_md}[/green]")
    
    if show_audit:
        print_audit_logs(trial_run.audit_logs, console)
    
    console.print()
    console.print(f"[dim]运行ID: {trial_run.run_id}[/dim]")
    return trial_run


@app.command("correct")
def correct_sample(
    run_id: str = typer.Argument(..., help="试算运行ID（暂未实现持久化，使用demo查看效果）"),
    sample_id: str = typer.Argument(..., help="要修正的样本ID"),
    operator: str = typer.Option("评测运营小孟", "--operator", "-o", help="操作人"),
    reason: str = typer.Option(..., "--reason", "-r", help="修正原因"),
    status: Optional[SampleStatus] = typer.Option(None, "--status", "-s", help="新状态"),
    next_action: Optional[NextAction] = typer.Option(None, "--next", "-n", help="下一步处理人"),
    why_kept: Optional[str] = typer.Option(None, "--explanation", "-e", help="自定义说明"),
):
    """人工修正单条样本的状态"""
    console.print("[bold magenta]✏️  执行人工修正[/bold magenta]")
    console.print(f"样本ID: {sample_id}")
    console.print(f"操作人: {operator}")
    console.print(f"原因: {reason}")
    
    if status:
        console.print(f"新状态: {status}")
    if next_action:
        console.print(f"下一步: {next_action}")
    
    console.print()
    console.print("[yellow]💡 提示: 完整的人工修正功能需要结合数据持久化使用，建议先运行 demo 查看流程演示[/yellow]")


@app.command("rerun")
def rerun_trial(
    candidates_csv: str = typer.Argument(..., help="召回候选表CSV文件路径"),
    old_params_yaml: str = typer.Argument(..., help="旧参数YAML文件路径"),
    new_params_yaml: str = typer.Argument(..., help="新参数YAML文件路径"),
    operator: str = typer.Option("评测运营小孟", "--operator", "-o", help="操作人"),
    reason: str = typer.Option("参数调整后重跑", "--reason", "-r", help="重跑原因"),
):
    """第三步：补录/修改参数YAML后，重新运行阈值试算"""
    console.print("[bold blue]🔄 重新运行阈值试算（参数已调整）[/bold blue]")
    
    candidates = load_candidates_from_csv(candidates_csv)
    old_params = load_params_from_yaml(old_params_yaml)
    new_params = load_params_from_yaml(new_params_yaml)
    
    old_run = run_threshold_trial(candidates, old_params, operator=operator, reason="旧参数基准运行")
    new_run = rerun_with_new_params(old_run, new_params, operator=operator, reason=reason)
    
    report = generate_playback_report(new_run)
    print_playback_report(report, console)
    print_audit_logs(new_run.audit_logs, console)


@app.command("demo")
def run_demo(
    output_dir: str = typer.Option("./demo_output", "--output", "-o", help="演示输出目录"),
):
    """运行完整演示：导入→人工修正→重跑 三步流程"""
    console.print("[bold green]🌟 运行语义去重阈值试算完整演示[/bold green]")
    console.print()
    
    from demo_data import generate_demo_data
    
    Path(output_dir).mkdir(exist_ok=True)
    
    demo = generate_demo_data(output_dir)
    
    console.print("[bold cyan]===== 第一步：导入召回候选表，首次阈值试算 =====[/bold cyan]")
    console.print()
    
    step1_report = generate_playback_report(demo["step1_run"])
    print_playback_report(step1_report, console)
    
    console.print()
    console.print("[yellow]📢 评测运营小孟发现 S003 是稀有类别，虽然系统标了被总指标盖住，但根据业务经验这个样本很重要，需要人工修正[/yellow]")
    console.print()
    
    console.print("[bold magenta]===== 第二步：人工修正样本状态 =====[/bold magenta]")
    console.print()
    
    step2_report = generate_playback_report(demo["step2_run"])
    print_playback_report(step2_report, console)
    print_audit_logs(demo["step2_run"].audit_logs, console)
    
    console.print()
    console.print("[yellow]📢 算法工程师反馈，建议将去重阈值从 0.85 调整为 0.82，同时提升少数类加权系数到 1.3[/yellow]")
    console.print()
    
    console.print("[bold blue]===== 第三步：调整参数后重跑 =====[/bold blue]")
    console.print()
    
    step3_report = generate_playback_report(demo["step3_run"])
    print_playback_report(step3_report, console)
    print_audit_logs(demo["step3_run"].audit_logs, console)
    
    console.print()
    console.print("[bold green]✅ 演示完成！[/bold green]")
    console.print(f"📁 演示数据和报告已保存至: {output_dir}")
    console.print()
    console.print("[dim]三步流程总结:[/dim]")
    console.print("  1. 导入召回候选表 → 系统自动检测少数类样本被总指标盖住")
    console.print("  2. 评测运营小孟人工修正 → 记录谁改了什么、为什么改")
    console.print("  3. 调整参数YAML后重跑 → 阈值回放自动更新，保留完整审计轨迹")


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
