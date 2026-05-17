import click
from pathlib import Path
from datetime import datetime
from typing import Optional

from loan_extension_cli.parsers import (
    LoanParser,
    RepaymentPlanParser,
    ExtensionApplicationParser,
    ApprovalParser,
    DeductionParser,
    RepaymentReportParser,
)
from loan_extension_cli.rules import RuleEngine
from loan_extension_cli.tracking import SourceTracker
from loan_extension_cli.reports import ReportGenerator


@click.group()
@click.version_option(version="1.0.0", prog_name="loan-extension-cli")
def cli():
    """借款展期还款计划扣款流水排查工具"""
    pass


@cli.command()
@click.option("--loan-file", type=click.Path(exists=True), help="借款单文件路径")
@click.option("--plan-file", type=click.Path(exists=True), help="还款计划文件路径")
@click.option("--extension-file", type=click.Path(exists=True), help="展期申请文件路径")
@click.option("--approval-file", type=click.Path(exists=True), help="审批意见文件路径")
@click.option("--deduction-file", type=click.Path(exists=True), help="扣款流水文件路径")
@click.option("--report-file", type=click.Path(exists=True), help="还款报告文件路径")
@click.option("--output-dir", type=click.Path(), default="./output", help="报告输出目录")
@click.option("--check-date", type=str, help="检查基准日期 (YYYY-MM-DD)，默认为今天")
def check(
    loan_file: Optional[str],
    plan_file: Optional[str],
    extension_file: Optional[str],
    approval_file: Optional[str],
    deduction_file: Optional[str],
    report_file: Optional[str],
    output_dir: str,
    check_date: Optional[str],
):
    """执行借款展期还款计划排查"""

    click.echo("=" * 60)
    click.echo("借款展期还款计划扣款流水排查工具")
    click.echo("=" * 60)

    tracker = SourceTracker()

    loans = []
    plans = []
    extensions = []
    approvals = []
    deductions = []
    reports = []

    if loan_file:
        click.echo(f"\n解析借款单文件: {loan_file}")
        parser = LoanParser()
        records, errors = parser.parse_file(loan_file)
        tracker.add_input_file(loan_file)
        for record in records:
            tracker.track_record(record, "借款单")
        for error in errors:
            tracker.add_parse_error(error)
        loans.extend(records)
        click.echo(f"  解析完成: {len(records)} 条记录, {len(errors)} 个错误")

    if plan_file:
        click.echo(f"\n解析还款计划文件: {plan_file}")
        parser = RepaymentPlanParser()
        records, errors = parser.parse_file(plan_file)
        tracker.add_input_file(plan_file)
        for record in records:
            tracker.track_record(record, "还款计划")
        for error in errors:
            tracker.add_parse_error(error)
        plans.extend(records)
        click.echo(f"  解析完成: {len(records)} 条记录, {len(errors)} 个错误")

    if extension_file:
        click.echo(f"\n解析展期申请文件: {extension_file}")
        parser = ExtensionApplicationParser()
        records, errors = parser.parse_file(extension_file)
        tracker.add_input_file(extension_file)
        for record in records:
            tracker.track_record(record, "展期申请")
        for error in errors:
            tracker.add_parse_error(error)
        extensions.extend(records)
        click.echo(f"  解析完成: {len(records)} 条记录, {len(errors)} 个错误")

    if approval_file:
        click.echo(f"\n解析审批意见文件: {approval_file}")
        parser = ApprovalParser()
        records, errors = parser.parse_file(approval_file)
        tracker.add_input_file(approval_file)
        for record in records:
            tracker.track_record(record, "审批意见")
        for error in errors:
            tracker.add_parse_error(error)
        approvals.extend(records)
        click.echo(f"  解析完成: {len(records)} 条记录, {len(errors)} 个错误")

    if deduction_file:
        click.echo(f"\n解析扣款流水文件: {deduction_file}")
        parser = DeductionParser()
        records, errors = parser.parse_file(deduction_file)
        tracker.add_input_file(deduction_file)
        for record in records:
            tracker.track_record(record, "扣款流水")
        for error in errors:
            tracker.add_parse_error(error)
        deductions.extend(records)
        click.echo(f"  解析完成: {len(records)} 条记录, {len(errors)} 个错误")

    if report_file:
        click.echo(f"\n解析还款报告文件: {report_file}")
        parser = RepaymentReportParser()
        records, errors = parser.parse_file(report_file)
        tracker.add_input_file(report_file)
        for record in records:
            tracker.track_record(record, "还款报告")
        for error in errors:
            tracker.add_parse_error(error)
        reports.extend(records)
        click.echo(f"  解析完成: {len(records)} 条记录, {len(errors)} 个错误")

    click.echo("\n" + "=" * 60)
    click.echo("执行规则检查...")
    click.echo("=" * 60)

    rule_engine = RuleEngine()

    check_date_obj = datetime.strptime(check_date, "%Y-%m-%d").date() if check_date else None

    rule_results = rule_engine.execute_all(
        loans=loans,
        plans=plans,
        extensions=extensions,
        approvals=approvals,
        deductions=deductions,
        reports=reports,
        check_date=check_date_obj,
    )

    total_errors = 0
    total_warnings = 0
    for result in rule_results:
        errors = sum(1 for v in result.violations if v.severity == "error")
        warnings = sum(1 for v in result.violations if v.severity == "warning")
        total_errors += errors
        total_warnings += warnings
        status = "✅" if result.is_passed else "❌"
        click.echo(f"  {status} {result.rule_name}: {errors} 错误, {warnings} 警告")

    click.echo("\n" + "=" * 60)
    click.echo(f"检查完成: 共发现 {total_errors} 个错误, {total_warnings} 个警告")
    click.echo("=" * 60)

    click.echo("\n生成报告...")
    tracking_result = tracker.get_tracking_result()
    report_generator = ReportGenerator(rule_results, tracking_result, output_dir)
    report_files = report_generator.generate_all_reports()

    click.echo("\n报告文件:")
    for report_name, file_path in report_files.items():
        click.echo(f"  - {report_name}: {file_path}")

    click.echo(f"\n稳定标识: {tracking_result.generate_stable_id()}")

    if total_errors > 0:
        click.echo("\n⚠️  发现严重错误，请查看详细报告")
        raise click.ClickException(f"检查发现 {total_errors} 个严重错误")
    else:
        click.echo("\n✅ 所有检查通过!")


@cli.command()
@click.argument("output_dir", type=click.Path())
def generate_sample(output_dir: str):
    """生成示例数据文件"""
    import csv

    path = Path(output_dir)
    path.mkdir(parents=True, exist_ok=True)

    click.echo("生成示例数据文件...")

    with open(path / "loan_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["loan_no", "employee_id", "employee_name", "loan_amount", "loan_date", "loan_term_months", "status"])
        writer.writerow(["LOAN001", "E001", "张三", 50000, "2024-01-15", 12, "active"])
        writer.writerow(["LOAN002", "E002", "李四", 30000, "2024-02-20", 6, "active"])

    with open(path / "plan_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["plan_id", "loan_no", "period_no", "due_date", "principal_amount", "interest_amount", "total_amount", "status", "is_extended"])
        for i in range(1, 13):
            month = str(1 + i).zfill(2)
            principal = 4166.67 if i < 12 else 4166.63
            total = principal + 250
            writer.writerow([f"PLAN001_{str(i).zfill(2)}", "LOAN001", i, f"2024-{month}-15", principal, 250, total, "paid" if i <= 2 else "pending", "false"])
        for i in range(1, 7):
            month = str(2 + i).zfill(2)
            writer.writerow([f"PLAN002_{str(i).zfill(2)}", "LOAN002", i, f"2024-{month}-20", 5000.00, 150, 5150.00, "paid" if i <= 1 else "pending", "false"])

    with open(path / "extension_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["application_id", "loan_no", "application_date", "extension_months", "new_due_date", "reason", "applicant"])
        writer.writerow(["EXT001", "LOAN001", "2024-03-10", 3, "2024-07-15", "资金周转困难", "张三"])

    with open(path / "approval_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["approval_id", "application_id", "loan_no", "approver", "approval_date", "approval_result", "approval_comment", "approval_level"])
        writer.writerow(["APPR001", "EXT001", "LOAN001", "王经理", "2024-03-12", "通过", "情况属实，同意展期", 1])
        writer.writerow(["APPR002", "EXT001", "LOAN001", "刘总监", "2024-03-13", "通过", "同意", 2])

    with open(path / "deduction_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["deduction_id", "loan_no", "deduction_date", "deduction_amount", "deduction_type", "related_plan_id", "transaction_no"])
        writer.writerow(["DED001", "LOAN001", "2024-02-15", 4416.67, "正常扣款", "PLAN001_01", "TXN20240215001"])

    with open(path / "report_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["report_id", "loan_no", "report_date", "total_principal_due", "total_interest_due", "total_paid", "remaining_principal", "remaining_interest", "is_overdue"])
        writer.writerow(["REP001", "LOAN001", "2024-03-01", 50000, 3000, 4416.67, 45833.33, 2750, "false"])

    click.echo(f"\n示例文件已生成到: {path.absolute()}")
    click.echo("\n文件列表:")
    click.echo("  - loan_sample.csv       借款单示例")
    click.echo("  - plan_sample.csv       还款计划示例")
    click.echo("  - extension_sample.csv  展期申请示例")
    click.echo("  - approval_sample.csv   审批意见示例")
    click.echo("  - deduction_sample.csv  扣款流水示例")
    click.echo("  - report_sample.csv     还款报告示例")


if __name__ == "__main__":
    cli()
