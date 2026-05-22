import sys
import json
import click
from datetime import datetime
from sqlalchemy.orm import Session
from .database import get_db_session, init_db
from .models import (
    Batch, Receipt, ReceiptStatus, DuplicateAction, AttachmentType
)
from .state_machine import ReceiptStateMachine, handle_duplicate_receipt, batch_state_summary, InvalidTransitionError
from .exporter import ReceiptExporter


EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_NOT_FOUND = 2
EXIT_INVALID_STATE = 3


@click.group()
def main():
    """乡镇药房近效期异常回执状态机 CLI"""
    init_db()


@main.group()
def batch():
    """批次管理命令"""
    pass


@batch.command("create")
@click.option("--batch-id", help="批次ID (可选，自动生成)")
@click.option("--pharmacy-id", required=True, help="药房ID")
@click.option("--pharmacy-name", required=True, help="药房名称")
@click.option("--region", required=True, help="区域")
@click.option("--created-by", required=True, help="创建人")
@click.option("--description", help="描述")
def batch_create(batch_id, pharmacy_id, pharmacy_name, region, created_by, description):
    """创建新批次"""
    import uuid
    with get_db_session() as db:
        batch_id = batch_id or str(uuid.uuid4())
        existing = db.query(Batch).filter(Batch.id == batch_id).first()
        if existing:
            click.echo(f"错误: 批次已存在: {batch_id}", err=True)
            sys.exit(EXIT_ERROR)

        batch = Batch(
            id=batch_id,
            pharmacy_id=pharmacy_id,
            pharmacy_name=pharmacy_name,
            region=region,
            created_by=created_by,
            description=description
        )
        db.add(batch)
        click.echo(json.dumps({
            "batch_id": batch.id,
            "pharmacy_name": batch.pharmacy_name,
            "region": batch.region,
            "created_at": batch.created_at.isoformat()
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@batch.command("list")
@click.option("--region", help="按区域过滤")
@click.option("--status", type=click.Choice([s.value for s in ReceiptStatus]), help="按状态过滤")
def batch_list(region, status):
    """列出所有批次"""
    with get_db_session() as db:
        query = db.query(Batch)
        if region:
            query = query.filter(Batch.region == region)
        if status:
            query = query.filter(Batch.status == status)

        batches = query.all()
        result = []
        for b in batches:
            result.append({
                "batch_id": b.id,
                "pharmacy_name": b.pharmacy_name,
                "region": b.region,
                "status": b.status.value,
                "total_receipts": b.total_receipts,
                "created_at": b.created_at.isoformat()
            })
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@batch.command("show")
@click.argument("batch_id")
def batch_show(batch_id):
    """显示批次详情"""
    with get_db_session() as db:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            click.echo(f"错误: 批次不存在: {batch_id}", err=True)
            sys.exit(EXIT_NOT_FOUND)

        summary = batch_state_summary(batch)
        click.echo(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
        sys.exit(EXIT_SUCCESS)


@batch.command("import")
@click.argument("batch_id")
@click.argument("json_file", type=click.File('r'))
@click.option("--duplicate-action", type=click.Choice([a.value for a in DuplicateAction]),
              default="ignore", help="重复数据处理方式")
def batch_import(batch_id, json_file, duplicate_action):
    """从JSON文件导入回执数据"""
    with get_db_session() as db:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            click.echo(f"错误: 批次不存在: {batch_id}", err=True)
            sys.exit(EXIT_NOT_FOUND)

        try:
            data = json.load(json_file)
        except json.JSONDecodeError as e:
            click.echo(f"错误: JSON文件解析失败: {e}", err=True)
            sys.exit(EXIT_ERROR)

        created_count = 0
        updated_count = 0
        ignored_count = 0

        for item in data:
            idempotency_key = item.get("idempotency_key") or f"{batch_id}:{item['medicine_code']}:{item['batch_number']}"
            existing = db.query(Receipt).filter(Receipt.idempotency_key == idempotency_key).first()

            if existing:
                receipt, action = handle_duplicate_receipt(
                    db, existing, item, DuplicateAction(duplicate_action), batch.created_by
                )
                if action == "ignored":
                    ignored_count += 1
                else:
                    updated_count += 1
            else:
                import uuid
                receipt = Receipt(
                    id=str(uuid.uuid4()),
                    batch_id=batch_id,
                    idempotency_key=idempotency_key,
                    medicine_code=item["medicine_code"],
                    medicine_name=item["medicine_name"],
                    specification=item.get("specification"),
                    batch_number=item["batch_number"],
                    expiry_date=datetime.fromisoformat(item["expiry_date"]) if isinstance(item["expiry_date"], str) else item["expiry_date"],
                    quantity=item["quantity"],
                    unit=item["unit"],
                    original_price=item["original_price"],
                    adjusted_price=item.get("adjusted_price"),
                    source_type=item["source_type"]
                )
                db.add(receipt)
                created_count += 1

        batch.total_receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).count()
        click.echo(json.dumps({
            "batch_id": batch_id,
            "total_processed": len(data),
            "created": created_count,
            "updated": updated_count,
            "ignored": ignored_count
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@batch.command("review")
@click.argument("batch_id")
@click.option("--approved/--rejected", required=True, help="通过或驳回")
@click.option("--reviewed-by", required=True, help="复核人")
@click.option("--reason", help="复核意见")
@click.option("--receipt-ids", help="指定回执ID列表，逗号分隔")
def batch_review(batch_id, approved, reviewed_by, reason, receipt_ids):
    """复核批次回执"""
    with get_db_session() as db:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            click.echo(f"错误: 批次不存在: {batch_id}", err=True)
            sys.exit(EXIT_NOT_FOUND)

        if receipt_ids:
            rids = [r.strip() for r in receipt_ids.split(",")]
            receipts = db.query(Receipt).filter(Receipt.id.in_(rids)).all()
        else:
            receipts = db.query(Receipt).filter(
                Receipt.batch_id == batch_id,
                Receipt.status == ReceiptStatus.PENDING_REVIEW
            ).all()

        success_count = 0
        failed_count = 0

        for receipt in receipts:
            try:
                sm = ReceiptStateMachine(receipt)
                if approved:
                    sm.approve(db, reviewed_by, reason)
                else:
                    sm.reject(db, reviewed_by, reason or "复核不通过")
                success_count += 1
            except InvalidTransitionError:
                failed_count += 1

        click.echo(json.dumps({
            "batch_id": batch_id,
            "approved": approved,
            "success_count": success_count,
            "failed_count": failed_count
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS if failed_count == 0 else EXIT_INVALID_STATE)


@batch.command("freeze")
@click.argument("batch_id")
@click.option("--frozen-by", required=True, help="冻结操作人")
@click.option("--reason", required=True, help="冻结原因")
@click.option("--receipt-ids", help="指定回执ID列表，逗号分隔")
def batch_freeze(batch_id, frozen_by, reason, receipt_ids):
    """冻结批次"""
    with get_db_session() as db:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            click.echo(f"错误: 批次不存在: {batch_id}", err=True)
            sys.exit(EXIT_NOT_FOUND)

        if receipt_ids:
            rids = [r.strip() for r in receipt_ids.split(",")]
            receipts = db.query(Receipt).filter(Receipt.id.in_(rids)).all()
        else:
            receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).all()

        success_count = 0
        failed_count = 0

        for receipt in receipts:
            try:
                sm = ReceiptStateMachine(receipt)
                sm.freeze(db, frozen_by, reason)
                success_count += 1
            except InvalidTransitionError:
                failed_count += 1

        batch.status = ReceiptStatus.FROZEN
        batch.frozen_at = datetime.now()
        batch.frozen_by = frozen_by

        click.echo(json.dumps({
            "batch_id": batch_id,
            "success_count": success_count,
            "failed_count": failed_count
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS if failed_count == 0 else EXIT_INVALID_STATE)


@batch.command("unfreeze")
@click.argument("batch_id")
@click.option("--unfrozen-by", required=True, help="解冻操作人")
@click.option("--reason", help="解冻原因")
@click.option("--target-status", type=click.Choice([s.value for s in ReceiptStatus]),
              default="approved", help="解冻后目标状态")
def batch_unfreeze(batch_id, unfrozen_by, reason, target_status):
    """解冻批次"""
    with get_db_session() as db:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            click.echo(f"错误: 批次不存在: {batch_id}", err=True)
            sys.exit(EXIT_NOT_FOUND)

        receipts = db.query(Receipt).filter(
            Receipt.batch_id == batch_id,
            Receipt.status == ReceiptStatus.FROZEN
        ).all()

        success_count = 0
        failed_count = 0

        for receipt in receipts:
            try:
                sm = ReceiptStateMachine(receipt)
                sm.unfreeze(db, unfrozen_by, reason, ReceiptStatus(target_status))
                success_count += 1
            except InvalidTransitionError:
                failed_count += 1

        remaining = db.query(Receipt).filter(
            Receipt.batch_id == batch_id,
            Receipt.status == ReceiptStatus.FROZEN
        ).count()
        if remaining == 0:
            batch.status = ReceiptStatus(target_status)
            batch.frozen_at = None
            batch.frozen_by = None

        click.echo(json.dumps({
            "batch_id": batch_id,
            "success_count": success_count,
            "failed_count": failed_count,
            "remaining_frozen": remaining
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS if failed_count == 0 else EXIT_INVALID_STATE)


@batch.command("archive")
@click.argument("batch_id")
@click.option("--archived-by", required=True, help="归档操作人")
@click.option("--reason", help="归档原因")
def batch_archive(batch_id, archived_by, reason):
    """撤回归档批次"""
    with get_db_session() as db:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            click.echo(f"错误: 批次不存在: {batch_id}", err=True)
            sys.exit(EXIT_NOT_FOUND)

        receipts = db.query(Receipt).filter(Receipt.batch_id == batch_id).all()
        success_count = 0
        failed_count = 0

        for receipt in receipts:
            try:
                sm = ReceiptStateMachine(receipt)
                sm.archive(db, archived_by, reason)
                success_count += 1
            except InvalidTransitionError:
                failed_count += 1

        batch.status = ReceiptStatus.ARCHIVED

        click.echo(json.dumps({
            "batch_id": batch_id,
            "success_count": success_count,
            "failed_count": failed_count
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS if failed_count == 0 else EXIT_INVALID_STATE)


@main.command()
@click.option("--batch-ids", help="批次ID列表，逗号分隔")
@click.option("--region", help="按区域导出")
@click.option("--output", "-o", required=True, type=click.Path(), help="输出文件路径")
@click.option("--include-audit-log", is_flag=True, help="包含审计日志")
def export(batch_ids, region, output, include_audit_log):
    """导出数据到Excel"""
    with get_db_session() as db:
        batch_id_list = [b.strip() for b in batch_ids.split(",")] if batch_ids else None
        excel_data = ReceiptExporter.export_to_excel(
            db,
            batch_ids=batch_id_list,
            region=region,
            include_audit_log=include_audit_log
        )

        with open(output, "wb") as f:
            f.write(excel_data.getvalue())

        summary = ReceiptExporter.get_export_summary(db, batch_ids=batch_id_list, region=region)
        click.echo(json.dumps({
            "output_file": output,
            **summary
        }, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@main.command("export-summary")
@click.option("--batch-ids", help="批次ID列表，逗号分隔")
@click.option("--region", help="按区域")
def export_summary(batch_ids, region):
    """显示导出汇总信息"""
    with get_db_session() as db:
        batch_id_list = [b.strip() for b in batch_ids.split(",")] if batch_ids else None
        summary = ReceiptExporter.get_export_summary(db, batch_ids=batch_id_list, region=region)
        click.echo(json.dumps(summary, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@main.group()
def audit():
    """审计日志命令"""
    pass


@audit.command("list")
@click.option("--batch-id", help="按批次过滤")
@click.option("--receipt-id", help="按回执过滤")
@click.option("--limit", default=50, help="显示条数")
def audit_list(batch_id, receipt_id, limit):
    """列出审计日志"""
    with get_db_session() as db:
        from .models import AuditLog
        query = db.query(AuditLog)
        if batch_id:
            query = query.filter(AuditLog.batch_id == batch_id)
        if receipt_id:
            query = query.filter(AuditLog.receipt_id == receipt_id)

        logs = query.order_by(AuditLog.action_at.desc()).limit(limit).all()
        result = []
        for log in logs:
            result.append({
                "id": log.id,
                "action": log.action,
                "actor": log.actor,
                "action_at": log.action_at.isoformat(),
                "reason": log.reason
            })
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@main.group()
def task():
    """异步任务管理命令"""
    pass


@task.command("list")
@click.option("--batch-id", help="按批次过滤")
@click.option("--status", help="按状态过滤")
def task_list(batch_id, status):
    """列出异步任务"""
    with get_db_session() as db:
        from .models import AsyncTask
        query = db.query(AsyncTask)
        if batch_id:
            query = query.filter(AsyncTask.batch_id == batch_id)
        if status:
            query = query.filter(AsyncTask.status == status)

        tasks = query.all()
        result = []
        for t in tasks:
            result.append({
                "task_id": t.id,
                "task_type": t.task_type,
                "status": t.status.value,
                "retry_count": t.retry_count,
                "error_message": t.error_message,
                "created_at": t.created_at.isoformat()
            })
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(EXIT_SUCCESS)


@task.command("retry")
@click.argument("task_id")
@click.option("--actor", required=True, help="操作人")
def task_retry(task_id, actor):
    """重试人工待处理任务"""
    with get_db_session() as db:
        from .task_processor import task_processor
        try:
            task = task_processor.retry_manual_task(db, task_id, actor)
            click.echo(json.dumps({
                "task_id": task.id,
                "status": task.status.value,
                "message": "已重置为待处理状态"
            }, ensure_ascii=False, indent=2))
            sys.exit(EXIT_SUCCESS)
        except ValueError as e:
            click.echo(f"错误: {e}", err=True)
            sys.exit(EXIT_NOT_FOUND)


@task.command("worker")
def task_worker():
    """启动任务处理工作进程"""
    from .task_processor import task_processor
    click.echo("启动任务处理工作进程...")
    task_processor.run_forever()


if __name__ == "__main__":
    main()
