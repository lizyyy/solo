import click
import sys
import os
from datetime import date
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pharmacy_expiry_tracker.db.database import SessionLocal, Base, engine
from pharmacy_expiry_tracker.models.enums import (
    ImportSourceType,
    UserRole,
    ExitCode,
    LiabilityResult
)
from pharmacy_expiry_tracker.schemas.record import ExpiryRecordCreate, ExpiryRecordUpdate
from pharmacy_expiry_tracker.schemas.export import ExportRequest
from pharmacy_expiry_tracker.services.record_service import RecordService
from pharmacy_expiry_tracker.services.import_service import ImportService
from pharmacy_expiry_tracker.services.workflow_service import WorkflowService
from pharmacy_expiry_tracker.services.export_service import ExportService
from pharmacy_expiry_tracker.utils.exceptions import AppException
from rich.console import Console
from rich.table import Table

Base.metadata.create_all(bind=engine)

console = Console()


def handle_exception(e: AppException):
    console.print(f"[red]错误: {e.message}[/red]")
    if e.details:
        console.print(f"详情: {e.details}")
    sys.exit(e.exit_code.value)


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """乡镇药房近效期权限追责台账系统"""
    pass


@cli.group()
def record():
    """记录管理"""
    pass


@record.command("create")
@click.option("--pharmacy-code", required=True, help="药房编码")
@click.option("--pharmacy-name", required=True, help="药房名称")
@click.option("--drug-code", required=True, help="药品编码")
@click.option("--drug-name", required=True, help="药品名称")
@click.option("--batch-no", required=True, help="批号")
@click.option("--expiry-date", required=True, help="有效期 (YYYY-MM-DD)")
@click.option("--quantity", type=int, required=True, help="数量")
@click.option("--region", help="区域")
@click.option("--town", help="乡镇")
@click.option("--drug-spec", help="药品规格")
@click.option("--unit", help="单位")
@click.option("--created-by", required=True, help="创建人")
@click.option("--user-role", required=True, type=click.Choice([r.value for r in UserRole]), help="用户角色")
def record_create(pharmacy_code, pharmacy_name, drug_code, drug_name, batch_no, expiry_date, quantity,
                  region, town, drug_spec, unit, created_by, user_role):
    """创建新记录"""
    try:
        db = SessionLocal()
        service = RecordService(db)

        data = ExpiryRecordCreate(
            pharmacy_code=pharmacy_code,
            pharmacy_name=pharmacy_name,
            drug_code=drug_code,
            drug_name=drug_name,
            batch_no=batch_no,
            expiry_date=date.fromisoformat(expiry_date),
            quantity=quantity,
            region=region,
            town=town,
            drug_spec=drug_spec,
            unit=unit,
            created_by=created_by
        )

        record = service.create_record(data, user_role)
        console.print(f"[green]记录创建成功! 记录编号: {record.record_no}[/green]")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@record.command("list")
@click.option("--page", type=int, default=1, help="页码")
@click.option("--page-size", type=int, default=20, help="每页数量")
@click.option("--pharmacy-code", help="药房编码筛选")
@click.option("--region", help="区域筛选")
@click.option("--status", help="状态筛选")
def record_list(page, page_size, pharmacy_code, region, status):
    """列出记录"""
    try:
        db = SessionLocal()
        service = RecordService(db)

        records, total = service.list_records(
            skip=(page - 1) * page_size,
            limit=page_size,
            pharmacy_code=pharmacy_code,
            region=region,
            status=status
        )

        table = Table(title=f"近效期台账记录 (共 {total} 条)")
        table.add_column("ID")
        table.add_column("记录编号")
        table.add_column("药房")
        table.add_column("药品名称")
        table.add_column("批号")
        table.add_column("数量")
        table.add_column("状态")
        table.add_column("创建人")

        for r in records:
            table.add_row(
                str(r.id),
                r.record_no,
                r.pharmacy_name,
                r.drug_name,
                r.batch_no,
                str(r.quantity),
                r.status,
                r.created_by
            )

        console.print(table)
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@record.command("show")
@click.argument("record_id", type=int)
def record_show(record_id):
    """查看记录详情"""
    try:
        db = SessionLocal()
        service = RecordService(db)

        record = service.get_record(record_id)
        if not record:
            console.print(f"[red]记录 {record_id} 不存在[/red]")
            sys.exit(ExitCode.NOT_FOUND.value)

        table = Table(title=f"记录详情 - {record.record_no}")
        table.add_column("字段")
        table.add_column("值")

        fields = [
            ("记录编号", record.record_no),
            ("药房编码", record.pharmacy_code),
            ("药房名称", record.pharmacy_name),
            ("区域", record.region),
            ("乡镇", record.town),
            ("药品编码", record.drug_code),
            ("药品名称", record.drug_name),
            ("药品规格", record.drug_spec),
            ("批号", record.batch_no),
            ("有效期", str(record.expiry_date) if record.expiry_date else ""),
            ("数量", str(record.quantity)),
            ("单位", record.unit),
            ("近效期天数", str(record.days_near_expiry)),
            ("近效期分类", record.expiry_category),
            ("追责结果", record.liability_result),
            ("追责金额", str(record.liability_amount)),
            ("状态", record.status),
            ("是否冻结", "是" if record.is_frozen else "否"),
            ("创建人", record.created_by),
            ("创建时间", str(record.created_at)),
            ("版本", str(record.current_version)),
            ("备注", record.remarks)
        ]

        for field, value in fields:
            table.add_row(field, value or "-")

        console.print(table)
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@cli.group()
def workflow():
    """工作流操作"""
    pass


@workflow.command("submit")
@click.argument("record_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--role", required=True, type=click.Choice([r.value for r in UserRole]), help="操作人角色")
@click.option("--reason", help="提交原因")
def workflow_submit(record_id, operator, role, reason):
    """提交记录"""
    try:
        db = SessionLocal()
        service = WorkflowService(db)

        record = service.submit_record(record_id, operator, role, reason)
        console.print(f"[green]记录已提交! 当前状态: {record.status}[/green]")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@workflow.command("reject")
@click.argument("record_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--role", required=True, type=click.Choice([r.value for r in UserRole]), help="操作人角色")
@click.option("--reason", required=True, help="驳回原因")
def workflow_reject(record_id, operator, role, reason):
    """驳回记录"""
    try:
        db = SessionLocal()
        service = WorkflowService(db)

        record = service.reject_record(record_id, operator, role, reason)
        console.print(f"[yellow]记录已驳回! 当前状态: {record.status}[/yellow]")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@workflow.command("confirm")
@click.argument("record_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--role", required=True, type=click.Choice([r.value for r in UserRole]), help="操作人角色")
@click.option("--reason", help="确认原因")
@click.option("--second-confirm", is_flag=True, help="二次确认")
def workflow_confirm(record_id, operator, role, reason, second_confirm):
    """确认记录"""
    try:
        db = SessionLocal()
        service = WorkflowService(db)

        record = service.confirm_record(record_id, operator, role, reason, is_second_confirmation=second_confirm)
        console.print(f"[green]记录已确认! 当前状态: {record.status}[/green]")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@workflow.command("withdraw")
@click.argument("record_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--role", required=True, type=click.Choice([r.value for r in UserRole]), help="操作人角色")
@click.option("--reason", required=True, help="撤回原因")
def workflow_withdraw(record_id, operator, role, reason):
    """撤回记录"""
    try:
        db = SessionLocal()
        service = WorkflowService(db)

        record = service.withdraw_record(record_id, operator, role, reason)
        console.print(f"[yellow]记录已撤回! 当前状态: {record.status}[/yellow]")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@workflow.command("freeze")
@click.argument("record_id", type=int)
@click.option("--operator", required=True, help="操作人")
@click.option("--role", required=True, type=click.Choice([r.value for r in UserRole]), help="操作人角色")
@click.option("--reason", required=True, help="冻结原因")
def workflow_freeze(record_id, operator, role, reason):
    """冻结记录"""
    try:
        db = SessionLocal()
        service = WorkflowService(db)

        record = service.freeze_record(record_id, operator, role, reason)
        console.print(f"[blue]记录已冻结! 当前状态: {record.status}[/blue]")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@workflow.command("changelog")
@click.argument("record_id", type=int)
def workflow_changelog(record_id):
    """查看变更日志"""
    try:
        db = SessionLocal()
        service = WorkflowService(db)

        logs = service.get_change_logs(record_id)

        table = Table(title=f"记录 {record_id} 变更日志")
        table.add_column("时间")
        table.add_column("操作类型")
        table.add_column("旧状态")
        table.add_column("新状态")
        table.add_column("操作人")
        table.add_column("原因")

        for log in logs:
            table.add_row(
                str(log.changed_at),
                log.change_type,
                log.old_status or "-",
                log.new_status or "-",
                log.changed_by,
                log.change_reason or "-"
            )

        console.print(table)
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@cli.group()
def imprt():
    """数据导入"""
    pass


@imprt.command("file")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--source-type", required=True,
              type=click.Choice([t.value for t in ImportSourceType]),
              help="导入源类型")
@click.option("--uploaded-by", required=True, help="上传人")
@click.option("--skip-duplicates", is_flag=True, default=True, help="跳过重复记录")
@click.option("--allow-partial", is_flag=True, default=True, help="允许部分导入")
@click.option("--notes", help="备注")
def import_file(file_path, source_type, uploaded_by, skip_duplicates, allow_partial, notes):
    """导入文件"""
    try:
        db = SessionLocal()
        service = ImportService(db)

        with open(file_path, 'rb') as f:
            file_content = f.read()

        file_name = os.path.basename(file_path)
        import_source, results = service.import_file(
            source_type=ImportSourceType(source_type),
            file_name=file_name,
            file_content=file_content,
            uploaded_by=uploaded_by,
            notes=notes,
            skip_duplicates=skip_duplicates,
            allow_partial=allow_partial
        )

        console.print(f"[green]导入完成! 导入源ID: {import_source.id}[/green]")
        console.print(f"总记录数: {import_source.total_rows}")
        console.print(f"成功: [green]{import_source.success_rows}[/green]")
        console.print(f"失败: [red]{import_source.failed_rows}[/red]")

        if import_source.failed_rows > 0:
            console.print("\n[yellow]失败记录详情:[/yellow]")
            for r in results:
                if not r.success:
                    console.print(f"  行 {r.row_number}: {r.error_message}")

        if import_source.failed_rows > 0 and import_source.success_rows > 0:
            sys.exit(ExitCode.PARTIAL_FAILURE.value)
        elif import_source.failed_rows > 0:
            sys.exit(ExitCode.ERROR.value)
        else:
            sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@cli.group()
def export():
    """数据导出"""
    pass


@export.command("excel")
@click.option("--output", "-o", required=True, help="输出文件路径")
@click.option("--exported-by", required=True, help="导出人")
@click.option("--role", required=True, type=click.Choice([r.value for r in UserRole]), help="导出人角色")
@click.option("--region", help="区域筛选")
@click.option("--town", help="乡镇筛选")
@click.option("--pharmacy-code", help="药房编码筛选")
@click.option("--status", help="状态筛选")
@click.option("--masked/--no-masked", default=True, help="是否脱敏导出")
def export_excel(output, exported_by, role, region, town, pharmacy_code, status, masked):
    """导出Excel"""
    try:
        db = SessionLocal()
        service = ExportService(db)

        request = ExportRequest(
            region=region,
            town=town,
            pharmacy_code=pharmacy_code,
            status=status,
            export_format="excel",
            is_masked=masked,
            exported_by=exported_by,
            user_role=role
        )

        file_content, file_name, record_count = service.export_to_excel(request)

        with open(output, 'wb') as f:
            f.write(file_content)

        console.print(f"[green]导出成功! 文件: {output}[/green]")
        console.print(f"记录数: {record_count}")
        console.print(f"脱敏: {'是' if masked else '否'}")
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@export.command("audit-logs")
@click.option("--page", type=int, default=1, help="页码")
@click.option("--page-size", type=int, default=20, help="每页数量")
def export_audit_logs(page, page_size):
    """查看导出审计日志"""
    try:
        db = SessionLocal()
        service = ExportService(db)

        logs, total = service.get_export_audit_logs(
            skip=(page - 1) * page_size,
            limit=page_size
        )

        table = Table(title=f"导出审计日志 (共 {total} 条)")
        table.add_column("导出ID")
        table.add_column("导出人")
        table.add_column("角色")
        table.add_column("导出时间")
        table.add_column("记录数")
        table.add_column("脱敏")
        table.add_column("文件名")

        for log in logs:
            table.add_row(
                log.export_id,
                log.exported_by,
                log.user_role or "-",
                str(log.exported_at),
                str(log.record_count),
                "是" if log.is_masked else "否",
                log.file_name
            )

        console.print(table)
        sys.exit(ExitCode.SUCCESS.value)
    except AppException as e:
        handle_exception(e)


@cli.command("init-db")
def init_db():
    """初始化数据库"""
    Base.metadata.create_all(bind=engine)
    console.print("[green]数据库初始化完成[/green]")
    sys.exit(ExitCode.SUCCESS.value)


@cli.command("run-server")
@click.option("--host", default="0.0.0.0", help="监听地址")
@click.option("--port", type=int, default=8000, help="监听端口")
def run_server(host, port):
    """启动API服务器"""
    import uvicorn
    from pharmacy_expiry_tracker.api.main import app

    console.print(f"[green]启动API服务器: {host}:{port}[/green]")
    console.print(f"API文档: http://{host}:{port}/docs")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    cli()
