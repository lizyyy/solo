from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .workflow import WorkflowSession
from .models import (
    BoundaryValueNote,
    EvidenceSource,
    QuestionnaireRawRow,
    ReviewStatus,
)
from .demo_data import create_demo_session

app = typer.Typer(
    name="bayesian-sensitivity",
    help="贝叶斯先验敏感性试算：合并问卷原始行与边界值说明，生成可读误差说明，支持复核审计",
)
console = Console()


@app.command()
def demo(
    save_path: Optional[str] = typer.Option(None, "--save", help="保存会话到文件"),
):
    """运行演示数据，展示完整三步流程+人工修正+重跑"""
    console.print(Panel("贝叶斯先验敏感性试算 · 演示", style="bold blue"))

    session = create_demo_session()

    console.print("\n[bold]步骤1：导入问卷原始行[/bold]")
    results = session.state.results
    _print_results_table(results)

    console.print("\n[bold]步骤2：教研负责人吴老师补看边界值说明[/bold]")
    _print_results_table(session.state.results)

    console.print("\n[bold]步骤3：误差说明更新[/bold]")
    _print_explanations(session.state.explanations)

    console.print("\n[bold]人工修正 + 重跑[/bold]")
    _print_results_table(session.state.results)

    console.print("\n[bold]审计记录[/bold]")
    console.print(session.get_audit_text())

    console.print("\n[bold]完整摘要[/bold]")
    console.print(session.summary())

    if save_path:
        session.save(save_path)
        console.print(f"\n会话已保存到 {save_path}")


@app.command()
def import_rows(
    file: str = typer.Argument(..., help="问卷原始行JSON文件路径"),
    session_file: Optional[str] = typer.Option(None, "--session", help="已有会话文件路径"),
):
    """步骤1：导入问卷原始行"""
    rows_data = _load_json(file)
    rows = [QuestionnaireRawRow(**r) for r in rows_data]

    session = _load_or_create_session(session_file)
    try:
        results = session.step1_import_questionnaire(rows)
        console.print(f"[green]导入成功，生成{len(results)}条试算结果[/green]")
        _print_results_table(results)

        dups = session.get_duplicate_summary()
        if dups:
            console.print(f"\n[yellow]⚠ 检测到{len(dups)}组两版答案：[/yellow]")
            for d in dups:
                console.print(f"  {d['summary']}")

        _maybe_save(session, session_file)
    except ValueError as e:
        console.print(f"[red]错误：{e}[/red]")


@app.command()
def boundary(
    file: str = typer.Argument(..., help="边界值说明JSON文件路径"),
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
    operator: str = typer.Option("教研负责人吴老师", "--operator", help="操作人"),
):
    """步骤2：补看边界值说明"""
    notes_data = _load_json(file)
    notes = [BoundaryValueNote(**n) for n in notes_data]

    session = WorkflowSession.load(session_file)
    try:
        results = session.step2_review_boundary(notes, operator)
        console.print(f"[green]补看完成，更新{len(results)}条试算结果[/green]")
        _print_results_table(results)
        _print_explanations(session.state.explanations)
        session.save(session_file)
    except ValueError as e:
        console.print(f"[red]错误：{e}[/red]")


@app.command()
def update_explanations(
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
):
    """步骤3：更新误差说明"""
    session = WorkflowSession.load(session_file)
    try:
        explanations = session.step3_update_error_explanations()
        console.print(f"[green]更新{len(explanations)}条误差说明[/green]")
        _print_explanations(explanations)
        session.save(session_file)
    except ValueError as e:
        console.print(f"[red]错误：{e}[/red]")


@app.command()
def correct(
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
    result_id: str = typer.Option(..., "--result-id", help="要修正的结果ID"),
    field: str = typer.Option(..., "--field", help="要修改的字段"),
    new_value: str = typer.Option(..., "--new-value", help="新值"),
    reason: str = typer.Option(..., "--reason", help="修正原因"),
    operator: str = typer.Option("教研负责人吴老师", "--operator", help="操作人"),
):
    """人工修正某条结果"""
    session = WorkflowSession.load(session_file)
    try:
        updated = session.manual_correct(result_id, field, new_value, reason, operator)
        console.print(f"[green]修正完成：{result_id}.{field}[/green]")
        console.print(f"  修正后：{updated}")
        session.save(session_file)
    except ValueError as e:
        console.print(f"[red]错误：{e}[/red]")


@app.command()
def rerun(
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
    reason: str = typer.Option("人工修正后重跑", "--reason", help="重跑原因"),
    operator: str = typer.Option("教研负责人吴老师", "--operator", help="操作人"),
):
    """重跑试算"""
    session = WorkflowSession.load(session_file)
    results = session.rerun(reason, operator)
    console.print(f"[green]重跑完成，{len(results)}条结果[/green]")
    _print_results_table(results)
    _print_explanations(session.state.explanations)
    session.save(session_file)


@app.command()
def summary(
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
):
    """查看会话摘要"""
    session = WorkflowSession.load(session_file)
    console.print(session.summary())


@app.command()
def audit(
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
):
    """查看审计记录"""
    session = WorkflowSession.load(session_file)
    console.print(session.get_audit_text())


def _load_json(path: str) -> list:
    p = Path(path)
    if not p.exists():
        console.print(f"[red]文件不存在：{path}[/red]")
        raise typer.Exit(1)
    return json.loads(p.read_text(encoding="utf-8"))


def _load_or_create_session(session_file: str | None) -> WorkflowSession:
    if session_file and Path(session_file).exists():
        return WorkflowSession.load(session_file)
    return WorkflowSession()


def _maybe_save(session: WorkflowSession, session_file: str | None):
    if session_file:
        session.save(session_file)
        console.print(f"会话已保存到 {session_file}")
    else:
        default_path = f"session_{session.state.session_id}.json"
        session.save(default_path)
        console.print(f"会话已保存到 {default_path}")


def _print_results_table(results):
    table = Table(title="试算结果")
    table.add_column("结果ID", style="cyan")
    table.add_column("学生", style="green")
    table.add_column("题目")
    table.add_column("后验均值")
    table.add_column("敏感性")
    table.add_column("状态")
    table.add_column("两版", style="yellow")

    for r in results:
        dup = "⚠" if r.is_duplicate else ""
        table.add_row(
            r.result_id,
            r.student_id,
            r.question_id,
            f"{r.posterior_mean:.2f}",
            f"{r.sensitivity_range:.2f}",
            r.status.value,
            dup,
        )
    console.print(table)


def _print_explanations(explanations):
    for e in explanations:
        console.print(Panel(
            f"[bold]为什么留下：[/bold]{e.why_kept}\n"
            + (f"[bold]还缺材料：[/bold]{'；'.join(e.missing_materials)}\n" if e.missing_materials else "")
            + f"[bold]下一步：[/bold]{e.next_action.value} — {e.next_action_detail}",
            title=f"误差说明 [{e.explanation_id}] 学生{e.student_id}",
        ))


if __name__ == "__main__":
    app()
