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
from .demo_data import (
    _make_boundary_notes,
    _make_questionnaire_rows,
    create_demo_session,
)

app = typer.Typer(
    name="bayesian-sensitivity",
    help="贝叶斯先验敏感性试算：合并问卷原始行与边界值说明，生成可读误差说明，支持复核审计",
)
console = Console()


@app.command()
def demo(
    save_path: Optional[str] = typer.Option(None, "--save", help="保存会话到文件"),
):
    """分步演示：导入→补看边界值→误差更新→人工修正→保存加载→重跑"""
    console.print(Panel(
        "贝叶斯先验敏感性试算 · 分步演示\n"
        "（同一学生交了两版答案时，不急着归正常，留给业务运营复核）",
        style="bold blue",
    ))

    session = WorkflowSession(session_id="demo001")
    rows = _make_questionnaire_rows()
    notes = _make_boundary_notes()

    console.print("\n[bold][步骤1/3] 导入问卷原始行（7条，其中李四 Q02 提交了第1版和第2版）[/bold]")
    _print_rows_table(rows)
    results = session.step1_import_questionnaire(rows, operator="系统自动导入")
    _print_results_table(results)
    _note_duplicates(session)

    console.print("\n[bold][步骤2/3] 教研负责人吴老师补看边界值说明（3条，含现场说法与先验约束）[/bold]")
    _print_notes_table(notes)
    results = session.step2_review_boundary(notes, operator="教研负责人吴老师")
    _print_results_table(results)
    _note_duplicates(session)

    console.print("\n[bold][步骤3/3] 误差说明更新（补看边界值后，误差说明同步变化）[/bold]")
    explanations = session.step3_update_error_explanations(operator="系统")
    _print_explanations(explanations)

    console.print("\n[bold][人工修正] 针对 S001 Q01：吴老师现场确认阳光影响可控，状态改为「已确认」[/bold]")
    s001_q01 = _find_result(session, "S001", "Q01")
    before_status = s001_q01.status.value
    after = session.manual_correct(
        result_id=s001_q01.result_id,
        field="status",
        new_value_str="已确认",
        reason="教研负责人吴老师现场确认阳光影响可控，该结果可采信",
        operator="教研负责人吴老师",
    )
    console.print(
        f"  [green]✔[/green] 结果 {s001_q01.result_id} 学生S001 题目Q01 状态："
        f"「{before_status}」→「{after.status.value}」"
    )
    _print_results_table(session.state.results)

    console.print(
        "\n[bold][保存后重跑] 把会话保存、再从文件里加载出来，验证修正状态和两版标记都保留"
    )
    tmp_path = save_path or f"session_{session.state.session_id}.json"
    session.save(tmp_path)
    console.print(f"  [green]✔[/green] 已保存到 {tmp_path}")

    reloaded = WorkflowSession.load(tmp_path)
    console.print(f"  [green]✔[/green] 已从文件重新加载（session_id={reloaded.state.session_id}）")
    results_rerun = reloaded.rerun(
        reason="人工修正后重跑，验证结果一致性",
        operator="教研负责人吴老师",
    )
    reloaded.save(tmp_path)
    console.print(f"  [green]✔[/green] 重跑完成后已再次保存到 {tmp_path}")
    s001_q01_after = _find_result(reloaded, "S001", "Q01")
    s002_q02_after = _find_result(reloaded, "S002", "Q02")
    console.print(
        f"  [green]✔[/green] 重跑后 S001 Q01 状态仍为「{s001_q01_after.status.value}」"
        f"（修正未被覆盖，result_id={s001_q01_after.result_id}）"
    )
    console.print(
        f"  [green]✔[/green] 重跑后 S002 Q02 仍是「{s002_q02_after.status.value}」"
        f"（两版答案未提前归正常，交给业务运营复核，result_id={s002_q02_after.result_id}）"
    )
    _print_results_table(results_rerun)

    console.print("\n[bold]误差说明（基于重跑后的最新结果，但保留人工修正痕迹）[/bold]")
    _print_explanations(reloaded.state.explanations)

    console.print("\n[bold]审计记录（谁改了什么、为什么改、改完影响哪些结果）[/bold]")
    console.print(reloaded.get_audit_text())

    console.print("\n[bold]完整摘要（同一条记录串联：列表、修正历史、误差说明、审计）[/bold]")
    console.print(reloaded.summary())

    if not save_path:
        console.print(
            f"\n[dim]会话已保存到 {tmp_path}，可在后续命令中用 --session {tmp_path} 继续操作[/dim]"
        )


def _find_result(session: WorkflowSession, student_id: str, question_id: str):
    for r in session.state.results:
        if r.student_id == student_id and r.question_id == question_id:
            return r
    raise ValueError(f"找不到 学生{student_id} 题目{question_id}")


def _note_duplicates(session: WorkflowSession):
    dups = session.get_duplicate_summary()
    if dups:
        for d in dups:
            console.print(
                f"  [yellow]⚠[/yellow] {d['summary']} — 留给业务运营复核，不急着归正常"
            )
    else:
        console.print("  未检测到两版答案")


def _print_rows_table(rows):
    table = Table(title="问卷原始行")
    table.add_column("row_id", style="cyan")
    table.add_column("学生", style="green")
    table.add_column("题目")
    table.add_column("作答")
    table.add_column("得分")
    table.add_column("版本", style="yellow")
    for r in rows:
        table.add_row(
            r.row_id, r.student_id, r.question_id,
            r.answer, f"{r.score:.1f}" if r.score is not None else "-",
            str(r.version),
        )
    console.print(table)


def _print_notes_table(notes):
    table = Table(title="边界值说明")
    table.add_column("note_id", style="cyan")
    table.add_column("学生", style="green")
    table.add_column("题目")
    table.add_column("现场说法")
    table.add_column("先验α")
    table.add_column("先验β")
    for n in notes:
        a = (
            f"[{n.prior_alpha_low}, {n.prior_alpha_high}]"
            if n.prior_alpha_low is not None or n.prior_alpha_high is not None
            else "-"
        )
        b = (
            f"[{n.prior_beta_low}, {n.prior_beta_high}]"
            if n.prior_beta_low is not None or n.prior_beta_high is not None
            else "-"
        )
        table.add_row(
            n.note_id, n.student_id, n.question_id or "(全局)",
            n.field_observation, a, b,
        )
    console.print(table)


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
        _note_duplicates(session)
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
        console.print(f"  修正后状态={updated.status.value}")
        session.save(session_file)
    except ValueError as e:
        console.print(f"[red]错误：{e}[/red]")


@app.command()
def rerun(
    session_file: str = typer.Option(..., "--session", help="会话文件路径"),
    reason: str = typer.Option("人工修正后重跑", "--reason", help="重跑原因"),
    operator: str = typer.Option("教研负责人吴老师", "--operator", help="操作人"),
):
    """重跑试算（保留人工修正字段）"""
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
    table.add_column("标签", style="yellow")

    for r in results:
        tags = []
        if r.is_duplicate:
            tags.append("⚠两版待复核")
        if r.corrections_history:
            tags.append("✔人工复核")
        table.add_row(
            r.result_id,
            r.student_id,
            r.question_id,
            f"{r.posterior_mean:.2f}",
            f"{r.sensitivity_range:.2f}",
            r.status.value,
            " ".join(tags),
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
