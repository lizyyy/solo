import click
import json
from pathlib import Path
from typing import Optional
from .models import CertificationRules
from .data_manager import DataManager
from .certification_engine import CertificationEngine
from .reporter import Reporter


class CLIContext:
    def __init__(self):
        self.data_dir: Path = Path("data")
        self.dm: Optional[DataManager] = None
        self.rules: Optional[CertificationRules] = None
        self.engine: Optional[CertificationEngine] = None
        self.reporter: Optional[Reporter] = None


@click.group()
@click.option(
    "--data-dir",
    "-d",
    default="data",
    help="数据目录路径 (默认: data)",
    type=click.Path(file_okay=False, path_type=Path),
)
@click.option(
    "--rules-file",
    "-r",
    default=None,
    help="证书规则配置文件 (JSON)",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.pass_context
def cli(ctx, data_dir, rules_file):
    """
    训练营作业催交通知 CLI

    该工具用于管理训练营学员、作业轮次、提交记录，
    并生成催交名单、证书风险名单和作业历史报告。
    """
    ctx.obj = CLIContext()
    ctx.obj.data_dir = data_dir
    ctx.obj.dm = DataManager(data_dir)
    
    if rules_file and rules_file.exists():
        rules_data = json.loads(rules_file.read_text(encoding="utf-8"))
        ctx.obj.rules = CertificationRules(**rules_data)
    else:
        ctx.obj.rules = CertificationRules.default()
    
    ctx.obj.engine = CertificationEngine(ctx.obj.dm, ctx.obj.rules)
    ctx.obj.reporter = Reporter(ctx.obj.dm, ctx.obj.engine)


@cli.group(name="import")
@click.pass_context
def import_data(ctx):
    """导入数据 (学员、作业、提交记录)"""
    pass


@import_data.command("students")
@click.argument("json_file", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.pass_context
def import_students(ctx, json_file):
    """
    从 JSON 文件导入学员名单

    JSON_FILE: 学员数据文件路径
    """
    data = json.loads(json_file.read_text(encoding="utf-8"))
    added, skipped = ctx.obj.dm.import_students(data)
    click.echo(f"学员导入完成: 新增 {added} 人, 跳过 {skipped} 人")
    
    anomalies = ctx.obj.dm.get_anomalies()
    if anomalies:
        click.echo(ctx.obj.reporter.format_anomalies(anomalies))


@import_data.command("assignments")
@click.argument("json_file", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.pass_context
def import_assignments(ctx, json_file):
    """
    从 JSON 文件导入作业轮次

    JSON_FILE: 作业数据文件路径
    """
    data = json.loads(json_file.read_text(encoding="utf-8"))
    added, skipped = ctx.obj.dm.import_assignments(data)
    click.echo(f"作业导入完成: 新增 {added} 个, 跳过 {skipped} 个")
    
    anomalies = ctx.obj.dm.get_anomalies()
    if anomalies:
        click.echo(ctx.obj.reporter.format_anomalies(anomalies))


@import_data.command("submissions")
@click.argument("json_file", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option(
    "--clear-anomalies/--keep-anomalies",
    default=False,
    help="导入前是否清空异常记录",
)
@click.pass_context
def import_submissions(ctx, json_file, clear_anomalies):
    """
    从 JSON 文件导入提交记录

    JSON_FILE: 提交记录文件路径
    """
    if clear_anomalies:
        ctx.obj.dm.clear_anomalies()
    
    data = json.loads(json_file.read_text(encoding="utf-8"))
    added, skipped = ctx.obj.dm.import_submissions(data)
    click.echo(f"提交记录导入完成: 新增 {added} 条, 跳过 {skipped} 条")
    
    anomalies = ctx.obj.dm.get_anomalies()
    if anomalies:
        click.echo(ctx.obj.reporter.format_anomalies(anomalies))


@cli.group()
@click.pass_context
def report(ctx):
    """生成各类报告"""
    pass


@report.command("reminder")
@click.option(
    "--assignment",
    "-a",
    default=None,
    help="指定作业 ID (默认: 所有作业)",
)
@click.option(
    "--output",
    "-o",
    default=None,
    help="输出到文件 (默认: 标准输出)",
    type=click.Path(dir_okay=False, path_type=Path),
)
@click.pass_context
def reminder_report(ctx, assignment, output):
    """生成分组催交名单"""
    reminders = ctx.obj.engine.get_reminder_list(assignment)
    content = ctx.obj.reporter.format_reminder_list(reminders)
    
    if output:
        output.write_text(content, encoding="utf-8")
        click.echo(f"催交名单已保存到: {output}")
    else:
        click.echo(content)


@report.command("risk")
@click.option(
    "--output",
    "-o",
    default=None,
    help="输出到文件 (默认: 标准输出)",
    type=click.Path(dir_okay=False, path_type=Path),
)
@click.pass_context
def risk_report(ctx, output):
    """生成证书风险名单"""
    results = ctx.obj.engine.evaluate_all()
    content = ctx.obj.reporter.format_certification_risk(results)
    
    if output:
        output.write_text(content, encoding="utf-8")
        click.echo(f"风险名单已保存到: {output}")
    else:
        click.echo(content)


@report.command("history")
@click.option(
    "--student",
    "-s",
    default=None,
    help="指定学员 ID/邮箱/姓名 (默认: 所有学员)",
)
@click.option(
    "--output",
    "-o",
    default=None,
    help="输出到文件 (默认: 标准输出)",
    type=click.Path(dir_okay=False, path_type=Path),
)
@click.pass_context
def history_report(ctx, student, output):
    """生成学员作业历史"""
    if student:
        matched = ctx.obj.dm.find_student(student)
        if not matched:
            click.echo(f"未找到学员: {student}")
            ctx.exit(1)
        
        submissions = ctx.obj.dm.get_student_submissions(matched.id)
        all_results = ctx.obj.engine.evaluate_all()
        cert_result = next(
            (r for r in all_results if r.student.id == matched.id),
            None
        )
        content = ctx.obj.reporter.format_student_history(matched, submissions, cert_result)
    else:
        content = ctx.obj.reporter.format_all_students_history()
    
    if output:
        output.write_text(content, encoding="utf-8")
        click.echo(f"作业历史已保存到: {output}")
    else:
        click.echo(content)


@report.command("full")
@click.option(
    "--assignment",
    "-a",
    default=None,
    help="指定作业 ID",
)
@click.option(
    "--output",
    "-o",
    default=None,
    help="输出到文件 (默认: 标准输出)",
    type=click.Path(dir_okay=False, path_type=Path),
)
@click.pass_context
def full_report(ctx, assignment, output):
    """生成完整报告 (催交+异常+风险)"""
    content = ctx.obj.reporter.format_full_report(assignment)
    
    if output:
        output.write_text(content, encoding="utf-8")
        click.echo(f"完整报告已保存到: {output}")
    else:
        click.echo(content)


@cli.command("anomalies")
@click.option(
    "--severity",
    "-s",
    type=click.Choice(["error", "warning", "info"]),
    default=None,
    help="按严重程度筛选",
)
@click.pass_context
def show_anomalies(ctx, severity):
    """查看异常记录"""
    anomalies = ctx.obj.dm.get_anomalies(severity)
    if not anomalies:
        click.echo("无异常记录")
        return
    
    click.echo(ctx.obj.reporter.format_anomalies(anomalies))


@cli.command("run")
@click.option(
    "--import-submissions",
    "-i",
    default=None,
    help="运行前先导入提交记录",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--output",
    "-o",
    default="reports/latest_report.txt",
    help="报告输出路径",
    type=click.Path(dir_okay=False, path_type=Path),
)
@click.option(
    "--assignment",
    "-a",
    default=None,
    help="指定作业 ID",
)
@click.option(
    "--clear-anomalies/--keep-anomalies",
    default=False,
    help="导入前是否清空历史异常记录（默认保留）",
)
@click.pass_context
def run_full_flow(ctx, import_submissions, output, assignment, clear_anomalies):
    """
    一键运行完整流程 (导入+生成报告)

    这是最常用的命令，适合日常催交使用。
    """
    click.echo("=" * 60)
    click.echo("训练营作业催交通知 - 完整流程")
    click.echo("=" * 60)
    
    if import_submissions:
        click.echo(f"\n[1/4] 导入提交记录: {import_submissions}")
        if clear_anomalies:
            ctx.obj.dm.clear_anomalies()
        data = json.loads(import_submissions.read_text(encoding="utf-8"))
        added, skipped = ctx.obj.dm.import_submissions(data)
        click.echo(f"  新增 {added} 条, 跳过 {skipped} 条")
    
    click.echo("\n[2/4] 检查批改缺失")
    missing = ctx.obj.dm.check_missing_grades()
    if missing:
        click.echo(f"  发现 {len(missing)} 个未批改作业")
    else:
        click.echo("  所有已提交作业均已批改")
    
    click.echo("\n[3/4] 分析证书资格")
    results = ctx.obj.engine.evaluate_all()
    qualified = sum(1 for r in results if r.status.value == "qualified")
    at_risk = sum(1 for r in results if r.status.value == "at_risk")
    disqualified = sum(1 for r in results if r.status.value == "disqualified")
    click.echo(f"  已达标: {qualified} 人")
    click.echo(f"  有风险: {at_risk} 人")
    click.echo(f"  未达标: {disqualified} 人")
    
    click.echo(f"\n[4/4] 生成报告: {output}")
    content = ctx.obj.reporter.format_full_report(assignment)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    
    click.echo("\n" + "=" * 60)
    click.echo("完成! 请查看报告文件")
    click.echo("=" * 60)


def main():
    cli(obj=CLIContext())


if __name__ == "__main__":
    main()
