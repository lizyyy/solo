import click
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from contract_review.core import ReviewStore, VersionComparator, SampleImporter
from contract_review.models import DesensitizationRule, FeedbackTicket


@click.group()
@click.option("--data-dir", default="data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj["store"] = ReviewStore(data_dir)
    ctx.obj["comparator"] = VersionComparator(ctx.obj["store"])
    ctx.obj["importer"] = SampleImporter(ctx.obj["store"])


@cli.command()
@click.option("--model-version", required=True, help="模型版本")
@click.option("--count", default=5, help="生成样例数量")
@click.pass_context
def demo(ctx, model_version, count):
    """生成演示样例数据"""
    ids = ctx.obj["importer"].generate_demo_samples(model_version, count)
    click.echo(f"✅ 已生成 {len(ids)} 个样例，版本: {model_version}")
    for sid in ids:
        sample = ctx.obj["store"].get_sample(sid)
        masked = " ⚠️被平均掩盖" if sample.is_masked_by_avg else ""
        low = sample.low_confidence_clauses
        click.echo(f"  {sid} - {sample.contract_name} 置信度:{sample.overall_confidence:.2f} 低置信:{len(low)}个{masked}")


@cli.command()
@click.option("--file", "file_path", required=True, help="JSON/CSV文件路径")
@click.option("--model-version", required=True, help="模型版本")
@click.option("--format", "fmt", default="json", type=click.Choice(["json", "csv"]), help="文件格式")
@click.pass_context
def import_samples(ctx, file_path, model_version, fmt):
    """导入样本数据"""
    if not os.path.exists(file_path):
        click.echo(f"❌ 文件不存在: {file_path}")
        return

    if fmt == "json":
        ids = ctx.obj["importer"].import_from_json(file_path, model_version)
    else:
        ids = ctx.obj["importer"].import_from_csv(file_path, model_version)

    click.echo(f"✅ 已导入 {len(ids)} 个样本")


@cli.command()
@click.option("--file", "file_path", required=True, help="JSON文件路径")
@click.pass_context
def import_tickets(ctx, file_path):
    """导入线上反馈工单"""
    if not os.path.exists(file_path):
        click.echo(f"❌ 文件不存在: {file_path}")
        return

    ids = ctx.obj["importer"].import_tickets_from_json(file_path)
    click.echo(f"✅ 已导入 {len(ids)} 个工单")


@cli.command()
@click.argument("sample_id")
@click.option("--note", required=True, help="脱敏规则备注")
@click.option("--rule-type", default="desensitization", help="规则类型")
@click.option("--added-by", default="小孟", help="添加人")
@click.option("--reason", default="", help="修改原因")
@click.pass_context
def add_note(ctx, sample_id, note, rule_type, added_by, reason):
    """补录脱敏规则备注（模型评测小孟用）"""
    sample = ctx.obj["store"].get_sample(sample_id)
    if not sample:
        click.echo(f"❌ 样本不存在: {sample_id}")
        return

    old_note = sample.desensitization_note or "(空)"
    rule = DesensitizationRule(
        sample_id=sample_id,
        rule_type=rule_type,
        pattern="",
        replacement="",
        note=note,
        added_by=added_by
    )
    ctx.obj["store"].add_rule(rule, change_reason=reason)

    click.echo(f"✅ 已为样本 {sample_id} 添加脱敏备注")
    click.echo(f"   修改人: {added_by}")
    if reason:
        click.echo(f"   修改原因: {reason}")
    click.echo(f"   改前: {old_note[:50]}{'...' if len(old_note) > 50 else ''}")
    click.echo(f"   改后: {sample.desensitization_note[:50]}{'...' if len(sample.desensitization_note) > 50 else ''}")
    click.echo(f"   注意: 已自动联动更新所有相关版本对比报告")


@cli.command()
@click.argument("sample_id")
@click.option("--title", required=True, help="工单标题")
@click.option("--description", help="工单描述")
@click.option("--reporter", default="知识库编辑", help="报告人")
@click.pass_context
def add_ticket(ctx, sample_id, title, description, reporter):
    """关联线上反馈工单"""
    sample = ctx.obj["store"].get_sample(sample_id)
    if not sample:
        click.echo(f"❌ 样本不存在: {sample_id}")
        return

    ticket = FeedbackTicket(
        sample_id=sample_id,
        title=title,
        description=description or "",
        reporter=reporter,
        status="open"
    )
    ctx.obj["store"].add_ticket(ticket)
    click.echo(f"✅ 已为样本 {sample_id} 创建工单 {ticket.ticket_id}")


@cli.command()
@click.option("--v1", required=True, help="旧版本号")
@click.option("--v2", required=True, help="新版本号")
@click.option("--output", help="输出文件路径")
@click.option("--by", "generated_by", default="system", help="生成人")
@click.pass_context
def compare(ctx, v1, v2, output, generated_by):
    """生成模型版本对比报告"""
    report = ctx.obj["comparator"].compare(v1, v2, generated_by)
    text = ctx.obj["comparator"].generate_human_readable_report(report)

    click.echo(text)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(text)
        click.echo(f"\n✅ 报告已保存到: {output}")

    click.echo(f"\n📋 报告编号: {report.report_id}")


@cli.command()
@click.option("--version", help="按版本筛选")
@click.option("--masked-only", is_flag=True, help="只显示被平均值掩盖的样本")
@click.pass_context
def list_samples(ctx, version, masked_only):
    """列出所有样本"""
    store = ctx.obj["store"]
    samples = store.samples.values()

    if version:
        samples = [s for s in samples if s.model_version == version]
    if masked_only:
        samples = [s for s in samples if s.is_masked_by_avg]

    samples = sorted(samples, key=lambda s: (0 if s.is_masked_by_avg else 1, -s.overall_confidence))

    click.echo(f"共 {len(samples)} 个样本:\n")
    for s in samples:
        masked = " ⚠️被平均掩盖" if s.is_masked_by_avg else ""
        low = len(s.low_confidence_clauses)
        status_color = {"pending": "yellow", "approved": "green", "rejected": "red"}.get(s.review_status, "white")
        click.echo(
            f"{s.sample_id} [{s.model_version}] {s.contract_name} | "
            f"置信度:{s.overall_confidence:.2f} | 低置信:{low} | "
            f"状态:{s.review_status}{masked}"
        )


@cli.command()
@click.argument("sample_id")
@click.pass_context
def show(ctx, sample_id):
    """查看样本详情"""
    store = ctx.obj["store"]
    sample = store.get_sample(sample_id)
    if not sample:
        click.echo(f"❌ 样本不存在: {sample_id}")
        return

    click.echo(f"=== 样本 {sample_id} ===")
    click.echo(f"合同名称: {sample.contract_name}")
    click.echo(f"模型版本: {sample.model_version}")
    click.echo(f"整体置信度: {sample.overall_confidence:.4f}")
    click.echo(f"是否被平均掩盖: {'是 ⚠️' if sample.is_masked_by_avg else '否'}")
    click.echo(f"复核状态: {sample.review_status}")
    click.echo(f"关联工单: {sample.ticket_id or '无'}")
    click.echo(f"脱敏备注: {sample.desensitization_note or '无'}")
    click.echo("")

    click.echo("抽取条款明细:")
    for c in sample.extracted_clauses:
        flag = " ⚠️低置信" if c.confidence < 0.7 else ""
        click.echo(f"  [{c.clause_id}] {c.clause_type} 置信度:{c.confidence:.4f}{flag}")
        click.echo(f"      内容: {c.content}")

    tickets = store.get_tickets_by_sample(sample_id)
    if tickets:
        click.echo(f"\n关联工单 ({len(tickets)}):")
        for t in tickets:
            click.echo(f"  {t.ticket_id} - {t.title} [{t.status}]")

    rules = store.get_rules_by_sample(sample_id)
    if rules:
        click.echo(f"\n脱敏规则 ({len(rules)}):")
        for r in rules:
            click.echo(f"  {r.rule_id} - {r.rule_type}: {r.note} (by {r.added_by})")
            if r.previous_note:
                click.echo(f"      改前: {r.previous_note[:60]}{'...' if len(r.previous_note) > 60 else ''}")
            if r.change_reason:
                click.echo(f"      原因: {r.change_reason}")

    logs = store.get_audit_logs_by_sample(sample_id)
    if logs:
        click.echo(f"\n修改历史 ({len(logs)}):")
        for l in logs:
            click.echo(f"  {l.created_at} - {l.changed_by} 修改 {l.field_name}")
            if l.change_reason:
                click.echo(f"      原因: {l.change_reason}")
            old_short = l.old_value[:40] + ("..." if len(l.old_value) > 40 else "")
            new_short = l.new_value[:40] + ("..." if len(l.new_value) > 40 else "")
            click.echo(f"      {old_short} → {new_short}")


@cli.command()
@click.argument("sample_id")
@click.pass_context
def history(ctx, sample_id):
    """查看样本的修改历史"""
    store = ctx.obj["store"]
    sample = store.get_sample(sample_id)
    if not sample:
        click.echo(f"❌ 样本不存在: {sample_id}")
        return

    logs = store.get_audit_logs_by_sample(sample_id)
    if not logs:
        click.echo(f"样本 {sample_id} 暂无修改历史")
        return

    click.echo(f"=== 样本 {sample_id} 修改历史 ({len(logs)} 条) ===")
    for idx, l in enumerate(logs, 1):
        click.echo(f"\n{idx}. {l.created_at}")
        click.echo(f"   修改人: {l.changed_by}")
        click.echo(f"   字段: {l.field_name}")
        if l.change_reason:
            click.echo(f"   原因: {l.change_reason}")
        click.echo(f"   改前: {l.old_value}")
        click.echo(f"   改后: {l.new_value}")


if __name__ == "__main__":
    cli()
