from __future__ import annotations
import json
import sys
from pathlib import Path
from datetime import datetime
import click
from .storage import Storage
from .processor import RecordProcessor
from .validator import Validator
from .workflow import WorkflowManager
from .models import RecordStatus


def _get_instances(data_dir: str = "./data"):
    storage = Storage(data_dir)
    processor = RecordProcessor(storage)
    validator = Validator(storage)
    workflow = WorkflowManager(storage)
    return storage, processor, validator, workflow


def _print_evidence(record_id: str, workflow: WorkflowManager):
    try:
        ev = workflow.get_evidence_summary(record_id)
        click.echo("")
        click.secho("=== 证据摘要 ===", fg="cyan", bold=True)
        click.echo(f"  记录ID:    {ev.record_id}")
        click.echo(f"  样本编号:  {ev.sample_no}")
        click.echo(f"  模型版本:  {ev.model_version}")
        click.echo(f"  状态:      {ev.status.value}")
        click.echo(f"  当前步骤:  {ev.current_step.value}")
        click.echo(f"  原始行号:  {ev.original_line_no}")
        click.echo(f"  工单ID:    {ev.ticket_id}")
        click.echo(f"  重算次数:  {ev.recheck_count}")
        if ev.abnormal_types:
            types_str = ", ".join(t.value for t in ev.abnormal_types)
            click.secho(f"  异常类型:  {types_str}", fg="yellow")
        click.echo(f"  人工改动:  {'有' if ev.has_manual_changes else '无'} ({ev.manual_change_count} 次)")
        click.echo(f"  脱敏备注:  {'有' if ev.has_desensitization_note else '无'}")
        if ev.desensitization_reviewer:
            click.echo(f"  脱敏复核人: {ev.desensitization_reviewer}")
        click.echo("")
        click.secho("  反馈摘要:", fg="blue")
        click.echo(f"    {ev.feedback_summary}")
        if ev.desensitization_summary:
            click.secho("  脱敏摘要:", fg="blue")
            click.echo(f"    {ev.desensitization_summary}")
    except Exception as e:
        click.secho(f"  获取证据摘要失败: {e}", fg="red")


@click.group()
@click.option("--data-dir", default="./data", help="数据目录")
@click.pass_context
def main(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir


@main.command()
@click.argument("json_file", type=click.Path(exists=True))
@click.option("--batch-no", default="", help="导入批次号")
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def import_file(ctx, json_file, batch_no, operator):
    """从JSON文件导入反馈工单"""
    _, processor, _, workflow = _get_instances(ctx.obj["data_dir"])

    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        records = processor.batch_import(data, batch_no, operator)
        click.secho(f"成功批量导入 {len(records)} 条记录", fg="green")
        click.echo(f"批次号: {records[0].import_batch_no if records else 'N/A'}")
        for r in records:
            click.echo(f"  - {r.record_id} (样本 {r.sample_no}, 工单 {r.feedback_ticket.ticket_id})")
            if r.abnormal_types:
                types_str = ", ".join(t.value for t in r.abnormal_types)
                click.secho(f"    ⚠️  异常: {types_str}", fg="yellow")
    else:
        record = processor.import_ticket(
            ticket_data=data["ticket"],
            sample_no=data["sample_no"],
            model_version=data["model_version"],
            model_translation=data["model_translation"],
            import_batch_no=batch_no,
            operator=operator,
        )
        click.secho(f"成功导入记录 {record.record_id}", fg="green")
        _print_evidence(record.record_id, workflow)


@main.command(name="list")
@click.option("--status", type=click.Choice([s.value for s in RecordStatus]), help="按状态过滤")
@click.option("--sample-no", help="按样本编号过滤")
@click.option("--show-evidence", is_flag=True, help="显示证据摘要")
@click.pass_context
def list_records(ctx, status, sample_no, show_evidence):
    """列出所有记录"""
    storage, _, _, workflow = _get_instances(ctx.obj["data_dir"])
    records = storage.list_records()

    if status:
        records = [r for r in records if r.status.value == status]
    if sample_no:
        records = [r for r in records if r.sample_no == sample_no]

    click.echo(f"共找到 {len(records)} 条记录:")
    for r in records:
        status_color = "green" if r.status == RecordStatus.NORMAL else "yellow"
        click.echo("")
        click.secho(f"  {r.record_id}", fg=status_color, bold=True)
        click.echo(f"    样本: {r.sample_no} | 模型: {r.model_version} | 状态: {r.status.value}")
        click.echo(f"    工单: {r.feedback_ticket.ticket_id} (行号 {r.feedback_ticket.original_line_no})")
        if r.abnormal_types:
            types_str = ", ".join(t.value for t in r.abnormal_types)
            click.secho(f"    异常: {types_str}", fg="yellow")
        if show_evidence:
            _print_evidence(r.record_id, workflow)


@main.command()
@click.argument("record_id")
@click.pass_context
def show(ctx, record_id):
    """查看单条记录详情和证据摘要"""
    storage, _, _, workflow = _get_instances(ctx.obj["data_dir"])
    record = storage.get_record(record_id)
    if not record:
        click.secho(f"记录 {record_id} 不存在", fg="red")
        sys.exit(1)

    click.secho("=== 记录详情 ===", fg="cyan", bold=True)
    click.echo(json.dumps(record.model_dump(), indent=2, ensure_ascii=False, default=str))

    _print_evidence(record_id, workflow)

    progress = workflow.get_workflow_progress(record_id)
    click.echo("")
    click.secho("=== 工作流进度 ===", fg="cyan", bold=True)
    for step in progress["steps"]:
        mark = "✓" if step["completed"] else "○"
        color = "green" if step["completed"] else "white"
        click.secho(f"  {mark} {step['name']}", fg=color)

    if progress["needs_operation_review"]:
        click.secho("  ⚠️  需要运营复核", fg="yellow", bold=True)

    if progress["logs"]:
        click.echo("")
        click.secho("=== 操作日志 ===", fg="cyan", bold=True)
        for log in progress["logs"]:
            click.echo(f"  [{log['time']}] {log['operator']}: {log['action']}")
            if log["remark"]:
                click.echo(f"    备注: {log['remark']}")


@main.command()
@click.argument("record_id")
@click.option("--rule-name", required=True, help="规则名称")
@click.option("--rule-desc", required=True, help="规则描述")
@click.option("--reviewer", required=True, help="复核人")
@click.option("--is-desensitized/--no-desensitized", default=True, help="是否已脱敏")
@click.option("--remark", default="", help="备注")
@click.pass_context
def desensitize(ctx, record_id, rule_name, rule_desc, reviewer, is_desensitized, remark):
    """添加脱敏规则备注"""
    _, processor, _, workflow = _get_instances(ctx.obj["data_dir"])
    try:
        record = processor.add_desensitization_note(
            record_id, rule_name, rule_desc, reviewer, is_desensitized, remark
        )
        click.secho(f"成功添加脱敏备注", fg="green")
        _print_evidence(record_id, workflow)
    except ValueError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)


@main.command()
@click.argument("record_id")
@click.option("--translation", required=True, help="新的翻译结果")
@click.option("--operator", required=True, help="操作人")
@click.option("--reason", required=True, help="修改原因")
@click.pass_context
def update(ctx, record_id, translation, operator, reason):
    """更新翻译结果"""
    _, processor, _, workflow = _get_instances(ctx.obj["data_dir"])
    try:
        record = processor.update_translation(record_id, translation, operator, reason)
        click.secho(f"成功更新翻译", fg="green")
        _print_evidence(record_id, workflow)
    except ValueError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)


@main.command()
@click.argument("record_id")
@click.option("--new-translation", help="新的模型翻译（可选）")
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def recalculate(ctx, record_id, new_translation, operator):
    """重算记录"""
    _, processor, _, workflow = _get_instances(ctx.obj["data_dir"])
    try:
        record = processor.recalculate(record_id, new_translation, operator)
        click.secho(f"成功重算，当前重算次数: {record.recheck_count}", fg="green")
        _print_evidence(record_id, workflow)
    except ValueError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)


@main.group()
def workflow():
    """工作流管理"""
    pass


@workflow.command("advance")
@click.argument("record_id")
@click.option(
    "--to",
    type=click.Choice(["desensitization", "product"]),
    required=True,
    help="推进到哪个步骤",
)
@click.option("--operator", default="cli", help="操作人")
@click.option("--remark", default="", help="备注")
@click.pass_context
def workflow_advance(ctx, record_id, to, operator, remark):
    """推进工作流"""
    _, _, _, wf = _get_instances(ctx.obj["data_dir"])
    try:
        if to == "desensitization":
            record = wf.advance_to_desensitization(record_id, operator, remark)
        else:
            record = wf.advance_to_product_review(record_id, operator, remark)
        click.secho(f"成功推进到: {record.current_step.value}", fg="green")
        _print_evidence(record_id, wf)
    except ValueError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)


@workflow.command("review")
@click.argument("record_id")
@click.option("--approve/--reject", required=True, help="通过或驳回")
@click.option("--operator", required=True, help="运营复核人")
@click.option("--remark", default="", help="备注")
@click.pass_context
def workflow_review(ctx, record_id, approve, operator, remark):
    """运营复核"""
    _, _, _, wf = _get_instances(ctx.obj["data_dir"])
    try:
        record = wf.operator_review(record_id, operator, approve, remark)
        result = "通过" if approve else "驳回"
        click.secho(f"运营复核{result}", fg="green" if approve else "red")
        _print_evidence(record_id, wf)
    except ValueError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)


@workflow.command("complete")
@click.argument("record_id")
@click.option("--operator", default="cli", help="操作人")
@click.option("--remark", default="", help="备注")
@click.pass_context
def workflow_complete(ctx, record_id, operator, remark):
    """完成全流程"""
    _, _, _, wf = _get_instances(ctx.obj["data_dir"])
    try:
        record = wf.complete_workflow(record_id, operator, remark)
        click.secho("工作流已完成", fg="green")
        _print_evidence(record_id, wf)
    except ValueError as e:
        click.secho(str(e), fg="red")
        sys.exit(1)


@workflow.command("needs-review")
@click.pass_context
def needs_review(ctx):
    """列出需要运营复核的记录"""
    _, _, _, wf = _get_instances(ctx.obj["data_dir"])
    records = wf.list_records_needing_review()
    click.echo(f"共 {len(records)} 条记录需要运营复核:")
    for r in records:
        click.echo(f"  - {r.record_id} (样本 {r.sample_no})")
        _print_evidence(r.record_id, wf)


@main.group()
def validate():
    """自检和校验"""
    pass


@validate.command("all")
@click.pass_context
def validate_all(ctx):
    """运行所有自检"""
    _, _, validator, _ = _get_instances(ctx.obj["data_dir"])
    results = validator.run_all_checks()
    summary = validator.get_check_summary()

    click.secho("=== 自检结果 ===", fg="cyan", bold=True)
    click.echo(f"总记录数: {summary['total_records']}")
    click.echo(f"未解决问题: {summary['unresolved_issues']}")
    click.echo("")

    for check_name, issues in results.items():
        color = "green" if len(issues) == 0 else "yellow"
        click.secho(f"{check_name}: {len(issues)} 个问题", fg=color, bold=True)
        for issue in issues:
            click.echo(f"  [{issue.severity}] 记录 {issue.record_id}: {issue.message}")
            if issue.details:
                for k, v in issue.details.items():
                    click.echo(f"    {k}: {v}")


@validate.command("summary")
@click.pass_context
def validate_summary(ctx):
    """查看自检摘要"""
    _, _, validator, _ = _get_instances(ctx.obj["data_dir"])
    summary = validator.get_check_summary()
    click.echo(json.dumps(summary, indent=2, ensure_ascii=False))


@validate.command("duplicates")
@click.pass_context
def check_duplicates(ctx):
    """检查重复导入"""
    _, _, validator, _ = _get_instances(ctx.obj["data_dir"])
    issues = validator.check_duplicate_imports()
    click.echo(f"发现 {len(issues)} 个重复导入问题")
    for issue in issues:
        click.echo(f"  {issue.message}")


@validate.command("model-versions")
@click.pass_context
def check_model_versions(ctx):
    """检查模型版本变更"""
    _, _, validator, _ = _get_instances(ctx.obj["data_dir"])
    issues = validator.check_model_version_changes()
    click.echo(f"发现 {len(issues)} 个模型版本变更问题")
    for issue in issues:
        click.echo(f"  {issue.message}")


@validate.command("export-consistency")
@click.pass_context
def check_export_consistency(ctx):
    """检查导出一致性"""
    _, _, validator, _ = _get_instances(ctx.obj["data_dir"])
    ok, issues = validator.check_export_consistency()
    if ok:
        click.secho("导出数据一致 ✓", fg="green")
    else:
        click.secho(f"发现 {len(issues)} 个一致性问题", fg="red")
        for issue in issues:
            click.echo(f"  {issue.message}")


@main.command()
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.option("--batch-no", help="按批次过滤")
@click.pass_context
def export(ctx, output, batch_no):
    """导出数据"""
    storage, _, _, workflow = _get_instances(ctx.obj["data_dir"])

    if batch_no:
        records = storage.find_by_batch_no(batch_no)
    else:
        records = storage.list_records()

    export_data = []
    for r in records:
        ev = workflow.get_evidence_summary(r.record_id)
        export_data.append({
            "record": r.model_dump(),
            "evidence_summary": ev.model_dump(),
        })

    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)
        click.secho(f"已导出 {len(records)} 条记录到 {output}", fg="green")
    else:
        click.echo(json.dumps(export_data, ensure_ascii=False, indent=2, default=str))


@main.command()
@click.option("--host", default="0.0.0.0", help="监听地址")
@click.option("--port", default=8000, type=int, help="监听端口")
def serve(host, port):
    """启动API服务"""
    import uvicorn
    click.secho(f"启动 API 服务: http://{host}:{port}", fg="green")
    click.secho(f"文档地址: http://{host}:{port}/docs", fg="cyan")
    uvicorn.run("translation_review.api:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
