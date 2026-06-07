"""命令行入口"""
import os
import json
import click
from datetime import datetime

from .storage import JsonStorage
from .engine import CitationReviewEngine
from .importer import TicketImporter
from .models import ReviewStatus


def get_engine(data_dir: str = "./data"):
    storage = JsonStorage(data_dir)
    engine = CitationReviewEngine(storage)
    return engine, storage


@click.group()
@click.option("--data-dir", default="./data", help="数据存储目录")
@click.pass_context
def cli(ctx, data_dir):
    """学术摘要引用复核系统 - 命令行入口"""
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir


@cli.command()
@click.argument("file_path")
@click.option("--format", "fmt", default="json", type=click.Choice(["json", "csv"]))
@click.pass_context
def import_tickets(ctx, file_path, fmt):
    """第一步：导入线上反馈工单

    FILE_PATH: 工单数据文件路径
    """
    _, storage = get_engine(ctx.obj["data_dir"])
    importer = TicketImporter(storage)

    if fmt == "json":
        tickets = importer.from_json(file_path)
    else:
        tickets = importer.from_csv(file_path)

    click.echo(f"✅ 成功导入 {len(tickets)} 条工单")
    for t in tickets:
        click.echo(f"  - {t.ticket_id} | 用户 {t.user_id} | {t.user_feedback[:30]}...")


@cli.command()
@click.pass_context
def run_review(ctx):
    """执行复核：检测重复并生成证据回放"""
    engine, _ = get_engine(ctx.obj["data_dir"])
    records = engine.run_review()

    click.echo(f"\n📋 复核完成，共处理 {len(records)} 条记录")

    dup_count = sum(1 for r in records if r.status == ReviewStatus.DUPLICATE_DETECTED)
    click.echo(f"  🔍 疑似重复: {dup_count} 条")
    click.echo(f"  ✅ 待确认正常: {len(records) - dup_count} 条")

    click.echo("\n📌 疑似重复工单详情：")
    for r in records:
        if r.status == ReviewStatus.DUPLICATE_DETECTED:
            click.echo(f"\n  工单 {r.ticket_id}")
            click.echo(f"    状态: {r.status.value}")
            click.echo(f"    为什么留下: {r.evidence.why_kept}")
            click.echo(f"    缺什么材料: {', '.join(r.evidence.missing_materials)}")
            click.echo(f"    下一步找谁: {r.evidence.next_owner.value}")
            click.echo(f"    下一步动作: {r.evidence.next_action}")


@cli.command()
@click.argument("ticket_id")
@click.argument("rule")
@click.option("--context", "ctx_text", default=None, help="补充上下文")
@click.pass_context
def add_note(ctx, ticket_id, rule, ctx_text):
    """第二步：AI 产品经理阿宁补录脱敏规则备注"""
    _, storage = get_engine(ctx.obj["data_dir"])
    importer = TicketImporter(storage)

    note = importer.add_desensitization_note(ticket_id, rule, ctx_text)
    click.echo(f"✅ 已为工单 {ticket_id} 补录脱敏规则备注")
    click.echo(f"   规则: {rule}")
    if ctx_text:
        click.echo(f"   上下文: {ctx_text}")

    engine, _ = get_engine(ctx.obj["data_dir"])
    updated = engine.update_evidence_with_note(ticket_id)
    if updated:
        click.echo("\n🔄 证据回放已更新：")
        click.echo(f"   状态: {updated.status.value}")
        click.echo(f"   为什么留下: {updated.evidence.why_kept}")
        click.echo(f"   缺什么材料: {', '.join(updated.evidence.missing_materials)}")
        click.echo(f"   下一步找谁: {updated.evidence.next_owner.value}")
        click.echo(f"   下一步动作: {updated.evidence.next_action}")


@cli.command()
@click.argument("ticket_id")
@click.pass_context
def show_evidence(ctx, ticket_id):
    """查看单条工单的证据回放"""
    _, storage = get_engine(ctx.obj["data_dir"])
    review = storage.get_review_for_ticket(ticket_id)
    ticket = storage.get_ticket(ticket_id)
    note = storage.get_note_for_ticket(ticket_id)

    if not review:
        click.echo(f"❌ 未找到工单 {ticket_id} 的复核记录")
        return

    click.echo(f"\n{'='*60}")
    click.echo(f"📝 工单详情 | {ticket_id}")
    click.echo(f"{'='*60}")
    if ticket:
        click.echo(f"用户: {ticket.user_id}")
        click.echo(f"反馈: {ticket.user_feedback}")
        click.echo(f"提交时间: {ticket.submit_time}")

    click.echo(f"\n{'='*60}")
    click.echo(f"🔍 证据回放")
    click.echo(f"{'='*60}")
    click.echo(f"状态: {review.status.value}")
    click.echo(f"为什么留下: {review.evidence.why_kept}")
    click.echo(f"\n缺什么材料:")
    for m in review.evidence.missing_materials:
        click.echo(f"  - {m}")
    click.echo(f"\n下一步找谁: {review.evidence.next_owner.value}")
    click.echo(f"下一步动作: {review.evidence.next_action}")
    click.echo(f"置信度: {review.evidence.confidence_score:.2%}")
    if review.evidence.duplicate_ticket_ids:
        click.echo(f"关联重复工单: {', '.join(review.evidence.duplicate_ticket_ids)}")
    click.echo(f"\n判定细节: {review.evidence.reasoning_detail}")

    if note:
        click.echo(f"\n{'='*60}")
        click.echo(f"📌 脱敏规则备注（阿宁补录）")
        click.echo(f"{'='*60}")
        click.echo(f"规则: {note.desensitization_rule}")
        if note.additional_context:
            click.echo(f"上下文: {note.additional_context}")
        click.echo(f"更新时间: {note.updated_at}")


@cli.command()
@click.option("--output", "-o", default=None, help="报告输出路径")
@click.pass_context
def report(ctx, output):
    """生成学术摘要风格的复核报告"""
    engine, _ = get_engine(ctx.obj["data_dir"])
    review_report = engine.generate_report()

    report_text = []
    report_text.append("=" * 70)
    report_text.append("学术摘要引用复核报告")
    report_text.append("=" * 70)
    report_text.append(f"报告编号: {review_report.report_id}")
    report_text.append(f"生成时间: {review_report.generated_at}")
    report_text.append("")
    report_text.append("【摘要】")
    report_text.append(review_report.summary)
    report_text.append("")
    report_text.append("【核心发现】")
    for i, finding in enumerate(review_report.key_findings, 1):
        report_text.append(f"  {i}. {finding}")
    report_text.append("")
    report_text.append(f"总工单数: {review_report.total_tickets}")
    report_text.append(f"重复组数: {review_report.duplicate_groups_count}")
    report_text.append(f"重复工单数: {review_report.duplicate_tickets_count}")
    report_text.append(f"正常工单数: {review_report.normal_tickets_count}")
    report_text.append(f"需补充信息: {review_report.need_more_info_count}")
    report_text.append("")

    if review_report.duplicate_groups:
        report_text.append("【重复工单分组详情】")
        for g in review_report.duplicate_groups:
            report_text.append(f"\n  分组 {g.group_id}:")
            report_text.append(f"    用户: {g.user_id}")
            report_text.append(f"    工单: {', '.join(g.ticket_ids)}")
            report_text.append(f"    相似度: {g.similarity_score:.2%}")
            report_text.append(f"    摘要: {g.merged_summary}")
        report_text.append("")

    report_text.append("【证据回放索引】")
    report_text.append("  点击工单 ID 可查看完整证据链：")
    for r in review_report.review_records:
        status_icon = "🔴" if r.status == ReviewStatus.DUPLICATE_DETECTED else "🟡" if r.status == ReviewStatus.NEED_MORE_INFO else "🟢"
        report_text.append(f"    {status_icon} {r.ticket_id} [{r.status.value}] -> 下一步: {r.evidence.next_owner.value}")

    full_text = "\n".join(report_text)
    click.echo(full_text)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(full_text)
            f.write("\n\n--- JSON 原始数据 ---\n")
            f.write(json.dumps(review_report.model_dump(), ensure_ascii=False, indent=2, default=str))
        click.echo(f"\n✅ 报告已保存到 {output}")


@cli.command()
@click.pass_context
def list_tickets(ctx):
    """列出所有工单"""
    _, storage = get_engine(ctx.obj["data_dir"])
    tickets = storage.list_tickets()
    click.echo(f"共 {len(tickets)} 条工单:")
    for t in tickets:
        click.echo(f"  {t.ticket_id} | 用户 {t.user_id} | {t.user_feedback[:40]}...")


@cli.command()
@click.option("--yes", is_flag=True, help="确认清除")
@click.pass_context
def reset(ctx, yes):
    """清除所有数据"""
    if not yes:
        click.confirm("确定要清除所有数据吗？", abort=True)
    import shutil
    data_dir = ctx.obj["data_dir"]
    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    click.echo("✅ 数据已清除")


if __name__ == "__main__":
    cli()
