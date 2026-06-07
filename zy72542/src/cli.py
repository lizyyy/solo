import asyncio
import json
import click
from sqlmodel import Session, select
from .database import create_db_and_tables, engine
from .models import QARecord, OperationLog
from .checker import import_qa_records, run_single_check, run_batch_check, update_gray_batch, manual_fix


def print_record_table(records):
    click.echo("\n" + "=" * 120)
    header = f"{'ID':<4} {'状态':<8} {'灰度批次':<10} {'免责声明':<6} {'链接状态':<10} {'下一步':<12} {'冲突原因'}"
    click.echo(header)
    click.echo("-" * 120)
    for r in records:
        status_map = {
            "pending": "待检查",
            "passed": "通过",
            "failed": "未通过",
            "conflict": "冲突",
            "manual_fixed": "人工修正",
        }
        url_status_map = {
            "valid": "正常",
            "invalid": "异常",
            "unknown": "未检查",
            None: "无链接",
        }
        next_map = {
            "pm_review": "产品经理复核",
            "editor_review": "知识库编辑",
            "complete": "已完成",
            None: "-",
        }
        click.echo(
            f"{r.id:<4} {status_map.get(r.status, r.status):<8} "
            f"{(r.gray_batch or '-'):<10} {'是' if r.has_disclaimer else '否':<6} "
            f"{url_status_map.get(r.url_status, '-'):<10} "
            f"{next_map.get(r.next_action, '-'):<12} "
            f"{(r.conflict_reason or '')[:50]}"
        )
    click.echo("=" * 120 + "\n")


def print_operation_logs(logs):
    click.echo("\n" + "=" * 100)
    header = f"{'时间':<20} {'操作人':<10} {'操作类型':<12} {'字段':<12} {'变更'}"
    click.echo(header)
    click.echo("-" * 100)
    for log in logs:
        change = ""
        if log.old_value or log.new_value:
            change = f"{log.old_value or '-'} → {log.new_value or '-'}"
        click.echo(
            f"{log.created_at.strftime('%Y-%m-%d %H:%M:%S'):<20} "
            f"{log.operator:<10} {log.operation_type:<12} "
            f"{(log.field_name or '-'):<12} {change}"
        )
        if log.reason:
            click.echo(f"{'':<20} 原因: {log.reason}")
    click.echo("=" * 100 + "\n")


@click.group()
def cli():
    """法律问答免责声明检查工具"""
    create_db_and_tables()


@cli.command()
@click.option("--file", "-f", type=click.Path(exists=True), required=True, help="JSON数据文件路径")
@click.option("--batch", "-b", required=True, help="来源批次名称")
@click.option("--operator", "-o", default="system", help="操作人")
def import_data(file, batch, operator):
    """导入问答数据"""
    with open(file, "r", encoding="utf-8") as f:
        data = json.load(f)

    with Session(engine) as session:
        records = import_qa_records(session, data, batch, operator)

    click.echo(f"成功导入 {len(records)} 条记录，批次: {batch}")
    print_record_table(records)


@cli.command()
@click.option("--id", "-i", "record_id", type=int, help="检查指定ID的记录")
@click.option("--all", "check_all", is_flag=True, help="检查所有记录")
@click.option("--operator", "-o", default="system", help="操作人")
def check(record_id, check_all, operator):
    """执行免责声明检查"""
    async def _check():
        with Session(engine) as session:
            if record_id:
                record = session.get(QARecord, record_id)
                if not record:
                    click.echo(f"记录 {record_id} 不存在")
                    return
                await run_single_check(session, record, operator=operator)
                records = [record]
            elif check_all:
                run_id = await run_batch_check(session, operator=operator)
                click.echo(f"批量检查完成，run_id: {run_id}")
                records = session.exec(select(QARecord)).all()
            else:
                click.echo("请指定 --id 或 --all")
                return
        print_record_table(records)

    asyncio.run(_check())


@cli.command()
@click.argument("record_id", type=int)
@click.argument("gray_batch")
@click.option("--operator", "-o", default="小乔", help="操作人")
@click.option("--reason", "-r", help="变更原因")
def set_gray(record_id, gray_batch, operator, reason):
    """补录灰度批次"""
    with Session(engine) as session:
        record = update_gray_batch(session, record_id, gray_batch, operator, reason)
    click.echo(f"记录 {record_id} 灰度批次已更新为: {gray_batch}")
    print_record_table([record])


@cli.command()
@click.argument("record_id", type=int)
@click.option("--status", "-s", type=click.Choice(["passed", "failed", "conflict", "manual_fixed"]), help="设置状态")
@click.option("--comment", "-c", help="复核意见")
@click.option("--next", "-n", "next_action", type=click.Choice(["pm_review", "editor_review", "complete"]), help="下一步")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--reason", "-r", help="变更原因")
def fix(record_id, status, comment, next_action, operator, reason):
    """人工修正记录"""
    with Session(engine) as session:
        record = manual_fix(
            session,
            record_id,
            operator,
            new_status=status,
            review_comment=comment,
            next_action=next_action,
            reason=reason,
        )
    click.echo(f"记录 {record_id} 已人工修正")
    print_record_table([record])


@cli.command()
@click.option("--status", "-s", help="按状态筛选")
def list(status):
    """列出冲突样本表"""
    with Session(engine) as session:
        stmt = select(QARecord)
        if status:
            stmt = stmt.where(QARecord.status == status)
        records = session.exec(stmt.order_by(QARecord.id)).all()
    print_record_table(records)


@cli.command()
@click.argument("record_id", type=int)
def detail(record_id):
    """查看记录详情"""
    with Session(engine) as session:
        record = session.get(QARecord, record_id)
        if not record:
            click.echo(f"记录 {record_id} 不存在")
            return

        click.echo("\n" + "=" * 80)
        click.echo(f"记录 ID: {record.id}")
        click.echo(f"状态: {record.status}")
        click.echo(f"来源批次: {record.source_batch or '-'}")
        click.echo(f"灰度批次: {record.gray_batch or '-'}")
        click.echo(f"脱敏规则备注: {record.desensitization_notes or '-'}")
        click.echo("-" * 80)
        click.echo(f"问题: {record.question}")
        click.echo(f"回答: {record.answer[:200]}..." if len(record.answer) > 200 else f"回答: {record.answer}")
        click.echo("-" * 80)
        click.echo(f"是否有免责声明: {'是' if record.has_disclaimer else '否'}")
        click.echo(f"免责声明关键词: {record.disclaimer_text or '-'}")
        click.echo(f"引用链接: {record.reference_url or '-'}")
        click.echo(f"链接状态: {record.url_status or '-'} ({record.url_error or '-'})")
        click.echo("-" * 80)
        click.echo(f"冲突原因: {record.conflict_reason or '-'}")
        click.echo(f"缺少材料: {record.missing_materials or '-'}")
        click.echo(f"下一步: {record.next_action or '-'}")
        click.echo(f"复核人: {record.reviewer or '-'}")
        click.echo(f"复核意见: {record.review_comment or '-'}")
        click.echo("=" * 80)

        logs = session.exec(
            select(OperationLog).where(OperationLog.qa_record_id == record_id).order_by(OperationLog.created_at)
        ).all()
        if logs:
            click.echo("\n操作历史:")
            print_operation_logs(logs)


@cli.command()
@click.argument("record_id", type=int)
def logs(record_id):
    """查看记录操作日志"""
    with Session(engine) as session:
        record = session.get(QARecord, record_id)
        if not record:
            click.echo(f"记录 {record_id} 不存在")
            return
        logs = session.exec(
            select(OperationLog).where(OperationLog.qa_record_id == record_id).order_by(OperationLog.created_at)
        ).all()
    print_operation_logs(logs)


if __name__ == "__main__":
    cli()
