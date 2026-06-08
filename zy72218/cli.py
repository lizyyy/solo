import os
import sys
import json
import click

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import date
from models import (
    FundMatchRecord,
    Invoice,
    HolidayExtension,
    TailAdjustment,
    MatchStatus,
    RecordType,
    entity_to_dict,
)
from repository import MatchRepository
from services import (
    MatchingEngine,
    ConflictDetector,
    SelfChecker,
    AuditService,
    WorkflowEngine,
    ExportService,
)


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    MatchRepository.reset_instances()
    repo = MatchRepository(data_dir=data_dir)
    ctx.obj["repo"] = repo
    ctx.obj["matching_engine"] = MatchingEngine(repo)
    ctx.obj["conflict_detector"] = ConflictDetector(repo)
    ctx.obj["self_checker"] = SelfChecker(repo)
    ctx.obj["audit_service"] = AuditService(repo)
    ctx.obj["workflow_engine"] = WorkflowEngine(
        repo,
        ctx.obj["matching_engine"],
        ctx.obj["conflict_detector"],
        ctx.obj["self_checker"],
        ctx.obj["audit_service"],
    )
    ctx.obj["export_service"] = ExportService(output_dir=os.path.join(data_dir, "exports"))


@cli.command("init")
@click.pass_context
def init_data(ctx):
    repo = ctx.obj["repo"]
    repo.clear_all()
    click.echo("✓ 数据已清空并初始化")


@cli.command("import-invoice")
@click.option("--business-no", required=True, help="业务号")
@click.option("--invoice-no", required=True, help="发票号")
@click.option("--amount", required=True, type=float, help="金额")
@click.option("--tax", default=0, type=float, help="税额")
@click.option("--seller", default="", help="卖方")
@click.option("--buyer", default="", help="买方")
@click.option("--operator", default="CLI用户", help="操作人")
@click.pass_context
def import_invoice(ctx, business_no, invoice_no, amount, tax, seller, buyer, operator):
    repo = ctx.obj["repo"]
    total = amount + tax
    invoice = Invoice(
        invoice_id=f"INV_{invoice_no}",
        invoice_no=invoice_no,
        invoice_date=date.today(),
        amount=amount,
        tax_amount=tax,
        total_amount=total,
        seller=seller,
        buyer=buyer,
        business_no=business_no,
        imported_by=operator,
    )
    repo.add_invoice(invoice)
    record = FundMatchRecord(
        business_no=business_no,
        record_type=RecordType.COMBINED,
        expected_amount=total,
        matched_amount=total,
        match_date=date.today(),
        status=MatchStatus.PENDING,
        invoice_ids=[invoice.invoice_id],
        updated_by=operator,
    )
    repo.add_match_record(record)
    click.echo(f"✓ 发票导入成功：业务号 {business_no}，金额 {total:.2f}，匹配记录ID {record.record_id[:8]}...")


@cli.command("step1-holiday")
@click.option("--business-no", required=True, help="业务号")
@click.option("--days", required=True, type=int, help="顺延天数")
@click.option("--reason", default="", help="顺延原因")
@click.option("--conclusion", default="", help="结论")
@click.option("--operator", default="投研助理小周", help="操作人")
@click.pass_context
def step1_holiday(ctx, business_no, days, reason, conclusion, operator):
    workflow = ctx.obj["workflow_engine"]
    self_checker = ctx.obj["self_checker"]
    extension = HolidayExtension(
        business_no=business_no,
        extension_days=days,
        reason=reason,
        conclusion=conclusion or f"顺延{days}天，按日利率0.1%计息",
        imported_by=operator,
    )
    result = workflow.step_1_import_holiday_extension(business_no, extension, operator)
    click.echo(f"\n{'='*60}")
    click.echo(f"第一步：导入节假日顺延说明")
    click.echo(f"{'='*60}")
    click.echo(f"业务号：{result['business_no']}")
    click.echo(f"消息：{result['message']}")
    click.echo(f"受影响记录：{result['affected_records_count']} 条")
    click.echo(f"数据一致性验证：{'通过 ✓' if result.get('data_consistency_verified') else '未通过 ✗'}")
    if result.get("self_check_summary"):
        summary = result["self_check_summary"]
        click.echo(f"\n自检结果：{summary['passed']}/{summary['total_checks']} 通过")
        if summary["failed_checks"]:
            for fc in summary["failed_checks"]:
                click.echo(f"  ✗ {fc['type']}: {fc['message']}")
    if result.get("warning"):
        for w in result["warning"]:
            click.echo(f"⚠️  {w}")


@cli.command("step2-tail")
@click.option("--business-no", required=True, help="业务号")
@click.option("--amount", required=True, type=float, help="调整金额")
@click.option("--reason", default="", help="调整原因")
@click.option("--rule", default="", help="计算规则")
@click.option("--operator", default="投研助理小周", help="操作人")
@click.pass_context
def step2_tail(ctx, business_no, amount, reason, rule, operator):
    workflow = ctx.obj["workflow_engine"]
    adjustment = TailAdjustment(
        business_no=business_no,
        adjustment_amount=amount,
        reason=reason,
        calculation_rule=rule,
        imported_by=operator,
    )
    result = workflow.step_2_review_tail_adjustment(business_no, adjustment, operator)
    click.echo(f"\n{'='*60}")
    click.echo(f"第二步：投研助理补看尾差调整条")
    click.echo(f"{'='*60}")
    click.echo(f"业务号：{result['business_no']}")
    click.echo(f"消息：{result['message']}")
    if result.get("has_conflict"):
        click.echo(f"\n⚠️  检测到规则冲突！")
        click.echo(f"警告：{result['warning']}")
        click.echo(f"\n请使用 resolve-conflict 命令处理冲突：")
        click.echo(f"  python app.py resolve-conflict --business-no {business_no} --action confirm_tail --reason '原因'")
    else:
        click.echo(f"数据一致性验证：{'通过 ✓' if result.get('data_consistency_verified') else '未通过 ✗'}")


@cli.command("resolve-conflict")
@click.option("--business-no", required=True, help="业务号")
@click.option("--action", required=True, type=click.Choice(["confirm_holiday", "confirm_tail", "reject_both"]), help="决策")
@click.option("--reason", default="", help="决策原因")
@click.option("--operator", default="投研助理小周", help="操作人")
@click.pass_context
def resolve_conflict(ctx, business_no, action, reason, operator):
    workflow = ctx.obj["workflow_engine"]
    result = workflow.resolve_conflict(business_no, action, operator, reason)
    click.echo(f"\n冲突解决结果：")
    click.echo(f"  选择规则：{result.get('resolution', {}).get('chosen_rule', '无')}")
    click.echo(f"  最终金额：{result.get('resolution', {}).get('final_amount', '无')}")
    click.echo(f"  状态：{result.get('resolution', {}).get('status', '无')}")


@cli.command("step3-discrepancy")
@click.option("--business-no", required=True, help="业务号")
@click.option("--operator", default="投研助理小周", help="操作人")
@click.pass_context
def step3_discrepancy(ctx, business_no, operator):
    workflow = ctx.obj["workflow_engine"]
    result = workflow.step_3_update_discrepancy_list(business_no, operator)
    click.echo(f"\n{'='*60}")
    click.echo(f"第三步：更新差异清单")
    click.echo(f"{'='*60}")
    click.echo(f"消息：{result['message']}")
    if result.get("requires_supervisor_review"):
        click.echo(f"\n⚠️  需要结算主管复核！")
        click.echo(f"警告：{result.get('warning', '')}")
        click.echo(f"\n请使用 supervisor-review 命令复核：")
        click.echo(f"  python app.py supervisor-review --business-no {business_no} --confirm --notes '备注'")


@cli.command("supervisor-review")
@click.option("--business-no", required=True, help="业务号")
@click.option("--confirm/--reject", default=True, help="确认或驳回")
@click.option("--notes", default="", help="复核备注")
@click.option("--operator", default="结算主管", help="操作人")
@click.pass_context
def supervisor_review(ctx, business_no, confirm, notes, operator):
    workflow = ctx.obj["workflow_engine"]
    result = workflow.supervisor_review_split_records(business_no, operator, confirm, notes)
    click.echo(f"\n主管复核结果：")
    click.echo(f"  决策：{'确认' if confirm else '驳回'}")
    click.echo(f"  消息：{result.get('message', '')}")


@cli.command("self-check")
@click.pass_context
def run_self_check(ctx):
    self_checker = ctx.obj["self_checker"]
    results = self_checker.run_all_checks()
    click.echo(f"\n{'='*60}")
    click.echo(f"自检结果")
    click.echo(f"{'='*60}")
    for r in results:
        status = "✓ 通过" if r.passed else "✗ 未通过"
        click.echo(f"  {status} | {r.check_type.value} | {r.message}")
        if not r.passed and r.business_no:
            click.echo(f"       业务号：{r.business_no}")


@cli.command("export")
@click.option("--format", "fmt", type=click.Choice(["excel", "csv"]), default="excel", help="导出格式")
@click.pass_context
def export_data(ctx, fmt):
    repo = ctx.obj["repo"]
    export_service = ctx.obj["export_service"]
    records = repo.get_match_records_for_export()
    formatted = export_service.format_records_for_export(records)
    if fmt == "excel":
        filepath = export_service.export_excel(formatted, "发票池融资匹配.xlsx")
    else:
        filepath = export_service.export_csv(formatted, "发票池融资匹配.csv")
    click.echo(f"✓ 导出完成：{filepath}")


@cli.command("run-demo")
@click.pass_context
def run_demo(ctx):
    click.echo(f"\n{'#'*60}")
    click.echo(f"# 发票池融资匹配 - 完整演示")
    click.echo(f"{'#'*60}\n")
    repo = ctx.obj["repo"]
    workflow = ctx.obj["workflow_engine"]
    export_service = ctx.obj["export_service"]

    repo.clear_all()
    biz = "BIZ_DEMO_001"

    click.echo(">>> 创建匹配记录（含拆分行）...")
    from services.matching_engine import MatchingEngine
    me = ctx.obj["matching_engine"]
    principal, fee = me.create_split_records(biz, 95000.0, 5000.0, "业务同事")
    click.echo(f"  本金记录：预期 {principal.expected_amount:.2f}，状态 {principal.status.value}")
    click.echo(f"  手续费记录：预期 {fee.expected_amount:.2f}，状态 {fee.status.value}")

    click.echo(f"\n{'='*60}")
    click.echo(">>> 第一步：导入节假日顺延说明")
    click.echo(f"{'='*60}")
    ext = HolidayExtension(
        business_no=biz, extension_days=5,
        reason="春节假期顺延", conclusion="顺延5天，按日利率0.1%计息",
        imported_by="业务同事"
    )
    r1 = workflow.step_1_import_holiday_extension(biz, ext, "投研助理小周")
    click.echo(f"  消息：{r1['message']}")
    click.echo(f"  一致性验证：{'通过' if r1.get('data_consistency_verified') else '未通过'}")

    click.echo(f"\n{'='*60}")
    click.echo(">>> 第二步：投研助理补看尾差调整条")
    click.echo(f"{'='*60}")
    adj = TailAdjustment(
        business_no=biz, adjustment_amount=300.0,
        reason="尾差调整", calculation_rule="尾差调整300元",
        imported_by="业务同事"
    )
    r2 = workflow.step_2_review_tail_adjustment(biz, adj, "投研助理小周")
    click.echo(f"  消息：{r2['message']}")
    if r2.get("has_conflict"):
        click.echo(f"  ⚠️  冲突！{r2['warning']}")
        click.echo("\n>>> 解决冲突：采用尾差调整条结论")
        r2r = workflow.resolve_conflict(biz, "confirm_tail", "投研助理小周", "尾差调整条有业务确认邮件")
        click.echo(f"  选择规则：{r2r['resolution']['chosen_rule']}")
        click.echo(f"  最终金额：{r2r['resolution']['final_amount']:.2f}")

    click.echo(f"\n{'='*60}")
    click.echo(">>> 第三步：更新差异清单")
    click.echo(f"{'='*60}")
    r3 = workflow.step_3_update_discrepancy_list(biz, "投研助理小周")
    click.echo(f"  消息：{r3['message']}")
    if r3.get("requires_supervisor_review"):
        click.echo(f"  ⚠️  需主管复核！{r3['warning']}")
        click.echo("\n>>> 结算主管复核拆分行")
        r3r = workflow.supervisor_review_split_records(biz, "结算主管老王", True, "本金95000+手续费5000，拆分正确")
        click.echo(f"  消息：{r3r['message']}")
        click.echo(f"  决策：{r3r['supervisor_decision']}")

    click.echo(f"\n{'='*60}")
    click.echo(">>> 验证三端数据一致性")
    click.echo(f"{'='*60}")
    export_data = repo.get_match_records_for_export()
    display_data = repo.get_match_records_for_display()
    api_data = repo.get_match_records_for_api()
    consistent = len(export_data) == len(display_data) == len(api_data)
    if consistent:
        for i in range(len(export_data)):
            for key in ["business_no", "record_type", "expected_amount", "matched_amount", "status", "is_split_record"]:
                if export_data[i][key] != display_data[i][key] or display_data[i][key] != api_data[i][key]:
                    consistent = False
                    break
    click.echo(f"  导出/页面/接口三端一致：{'✓ 通过' if consistent else '✗ 不一致'}")

    click.echo(f"\n{'='*60}")
    click.echo(">>> 导出Excel文件")
    click.echo(f"{'='*60}")
    formatted = export_service.format_records_for_export(export_data)
    filepath = export_service.export_excel(formatted, "发票池融资匹配_demo.xlsx")
    click.echo(f"  ✓ 导出完成：{filepath}")

    click.echo(f"\n{'='*60}")
    click.echo(">>> 查看最终记录")
    click.echo(f"{'='*60}")
    records = repo.get_records_by_business_no(biz)
    for r in records:
        split_info = f"（关联：{r.related_record_id[:8]}...）" if r.is_split_record() else ""
        click.echo(f"  {r.record_type.value} | 预期 {r.expected_amount:.2f} | 匹配 {r.matched_amount:.2f} | {r.status.value} {split_info}")

    click.echo(f"\n{'#'*60}")
    click.echo(f"# 演示完成")
    click.echo(f"{'#'*60}")


@cli.command("serve")
@click.option("--host", default="0.0.0.0", help="监听地址")
@click.option("--port", default=5000, type=int, help="监听端口")
@click.pass_context
def serve(ctx, host, port):
    from web_app import create_app
    app = create_app(data_dir=ctx.obj["data_dir"])
    click.echo(f"启动 Web 服务：http://{host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    cli()
