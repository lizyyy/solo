import json
import os
import sys
from datetime import datetime
from typing import Optional

import click
import pandas as pd
from rich.console import Console

from .database import (
    AsyncTask,
    AuditHistory,
    DataRecord,
    DataSourceType,
    ImportBatch,
    ImportMode,
    TaskStatus,
    ValidationError,
    ValidationLevel,
    get_session,
    init_db,
)
from .utils import (
    calculate_diff,
    display_table,
    find_existing_record,
    generate_batch_no,
    generate_task_id,
    get_source_key,
    record_audit,
)
from .validator import DataValidator

console = Console()


@click.group()
def cli():
    """充电桩巡检多源导入巡检 CLI"""
    pass


@cli.command()
@click.option("--force", is_flag=True, help="强制重新初始化（会清空现有数据）")
def init(force: bool):
    """初始化数据库和配置"""
    db_path = os.path.expanduser("~/.cpi/cpi.db")

    if force and os.path.exists(db_path):
        click.confirm("确定要删除现有数据库吗？此操作不可恢复！", abort=True)
        os.remove(db_path)
        console.print("[yellow]已删除现有数据库[/yellow]")

    init_db()
    console.print("[green]数据库初始化完成[/green]")
    console.print(f"数据库位置: {db_path}")

    os.makedirs(os.path.expanduser("~/.cpi/samples"), exist_ok=True)
    os.makedirs(os.path.expanduser("~/.cpi/exports"), exist_ok=True)
    console.print("[green]目录结构创建完成[/green]")


@cli.command()
@click.argument("source_type", type=click.Choice([t.value for t in DataSourceType]))
@click.argument("file_path", type=click.Path(exists=True))
@click.option(
    "--mode",
    type=click.Choice([m.value for m in ImportMode]),
    default="append",
    help="导入模式: ignore(忽略重复), overwrite(覆盖), append(追加)",
)
@click.option("--operator", default="system", help="操作人")
@click.option("--sheet-name", default=0, help="Excel工作表名称或索引")
def import_data(source_type: str, file_path: str, mode: str, operator: str, sheet_name):
    """导入数据文件"""
    source_type_enum = DataSourceType(source_type)
    import_mode_enum = ImportMode(mode)
    session = get_session()

    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name) if file_path.endswith(
            (".xlsx", ".xls")
        ) else pd.read_csv(file_path)
    except Exception as e:
        console.print(f"[red]读取文件失败: {e}[/red]")
        sys.exit(1)

    batch_no = generate_batch_no(source_type_enum)
    batch = ImportBatch(
        batch_no=batch_no,
        source_type=source_type_enum,
        file_name=os.path.basename(file_path),
        import_mode=import_mode_enum,
        imported_by=operator,
        total_rows=len(df),
        status=TaskStatus.RUNNING,
    )
    session.add(batch)
    session.flush()

    validator = DataValidator(source_type_enum)
    success_count = 0
    fail_count = 0
    ignored_count = 0

    record_audit(
        session,
        None,
        batch.id,
        "BATCH_START",
        None,
        f"导入开始，共{len(df)}行",
        operator,
    )

    for idx, row in df.iterrows():
        row_no = idx + 2
        data = row.where(pd.notnull(row), None).to_dict()

        errors = validator.validate(data, row_no)
        source_key = get_source_key(source_type_enum, data)

        has_error = any(e[0] == ValidationLevel.ERROR for e in errors)

        existing = find_existing_record(session, source_type_enum, source_key)

        if existing and import_mode_enum == ImportMode.IGNORE:
            ignored_count += 1
            record_audit(
                session,
                existing.id,
                batch.id,
                "RECORD_IGNORED",
                None,
                "重复记录已忽略",
                operator,
                row_no,
            )
            continue

        if existing and import_mode_enum == ImportMode.OVERWRITE:
            old_data = existing.data.copy()
            existing.data = data
            existing.source_row_no = row_no
            existing.is_valid = not has_error
            diff = calculate_diff(old_data, data)
            record_audit(
                session,
                existing.id,
                batch.id,
                "RECORD_UPDATED",
                json.dumps(old_data, ensure_ascii=False),
                json.dumps(data, ensure_ascii=False),
                operator,
                row_no,
                diff_data=diff,
            )
            if not has_error:
                success_count += 1
            else:
                fail_count += 1
        else:
            record = DataRecord(
                batch_id=batch.id,
                source_type=source_type_enum,
                source_row_no=row_no,
                source_key=source_key,
                is_valid=not has_error,
                data=data,
            )
            session.add(record)
            session.flush()

            record_audit(
                session,
                record.id,
                batch.id,
                "RECORD_CREATED",
                None,
                json.dumps(data, ensure_ascii=False),
                operator,
                row_no,
            )

            if not has_error:
                success_count += 1
            else:
                fail_count += 1

        for level, field, code, message, err_row in errors:
            if err_row == row_no:
                session.add(
                    ValidationError(
                        batch_id=batch.id,
                        record_id=existing.id if existing and import_mode_enum == ImportMode.OVERWRITE else record.id,
                        source_row_no=row_no,
                        level=level,
                        field_name=field,
                        error_code=code,
                        error_message=message,
                    )
                )

    batch.success_rows = success_count
    batch.failed_rows = fail_count
    batch.status = TaskStatus.COMPLETED
    session.commit()

    record_audit(
        session,
        None,
        batch.id,
        "BATCH_COMPLETE",
        None,
        f"成功{success_count}行，失败{fail_count}行，忽略{ignored_count}行",
        operator,
    )

    console.print(f"[green]导入完成[/green]")
    display_table(
        "导入结果",
        ["批次号", "数据源", "文件", "模式", "总数", "成功", "失败", "忽略"],
        [[
            batch_no,
            source_type,
            os.path.basename(file_path),
            mode,
            str(len(df)),
            str(success_count),
            str(fail_count),
            str(ignored_count),
        ]],
    )
    console.print(f"\n查看详情: cpi check {batch_no}")


@cli.command()
@click.argument("batch_no", required=False)
@click.option("--source-type", help="按数据源类型筛选")
@click.option("--show-errors", is_flag=True, help="显示详细错误")
@click.option("--level", type=click.Choice(["all", "error", "warning"]), default="all")
def check(batch_no: Optional[str], source_type: Optional[str], show_errors: bool, level: str):
    """检查数据质量和失败清单"""
    session = get_session()

    if batch_no:
        batch = session.query(ImportBatch).filter_by(batch_no=batch_no).first()
        if not batch:
            console.print(f"[red]批次不存在: {batch_no}[/red]")
            sys.exit(1)

        display_table(
            "批次信息",
            ["批次号", "数据源", "导入模式", "操作人", "时间", "总数", "成功", "失败"],
            [[
                batch.batch_no,
                batch.source_type.value,
                batch.import_mode.value,
                batch.imported_by,
                batch.imported_at.strftime("%Y-%m-%d %H:%M"),
                str(batch.total_rows),
                str(batch.success_rows),
                str(batch.failed_rows),
            ]],
        )

        query = session.query(ValidationError).filter_by(batch_id=batch.id)
        if level == "error":
            query = query.filter_by(level=ValidationLevel.ERROR)
        elif level == "warning":
            query = query.filter_by(level=ValidationLevel.WARNING)

        errors = query.all()

        if errors:
            console.print(f"\n[yellow]共发现 {len(errors)} 个问题[/yellow]")
            if show_errors:
                display_table(
                    "错误清单",
                    ["行号", "级别", "字段", "错误代码", "错误信息", "已修复"],
                    [[
                        str(e.source_row_no),
                        e.level.value,
                        e.field_name or "-",
                        e.error_code or "-",
                        e.error_message,
                        "是" if e.fixed else "否",
                    ] for e in errors],
                )
        else:
            console.print("\n[green]数据校验全部通过[/green]")

    else:
        query = session.query(ImportBatch)
        if source_type:
            query = query.filter_by(source_type=DataSourceType(source_type))
        batches = query.order_by(ImportBatch.imported_at.desc()).limit(20).all()

        display_table(
            "最近批次列表",
            ["批次号", "数据源", "文件", "模式", "操作人", "时间", "总数", "成功", "失败", "状态"],
            [[
                b.batch_no,
                b.source_type.value,
                b.file_name or "-",
                b.import_mode.value,
                b.imported_by,
                b.imported_at.strftime("%m-%d %H:%M"),
                str(b.total_rows),
                str(b.success_rows),
                str(b.failed_rows),
                b.status.value,
            ] for b in batches],
        )


@cli.command()
@click.argument("batch_no")
@click.option("--row-no", type=int, help="指定行号修正")
@click.option("--field", help="指定字段名")
@click.option("--value", help="新值")
@click.option("--operator", default="manual", help="操作人")
@click.option("--reimport", is_flag=True, help="修正后重新校验")
def fix(batch_no: str, row_no: Optional[int], field: Optional[str], value: Optional[str], operator: str, reimport: bool):
    """人工修正错误数据"""
    session = get_session()
    batch = session.query(ImportBatch).filter_by(batch_no=batch_no).first()

    if not batch:
        console.print(f"[red]批次不存在: {batch_no}[/red]")
        sys.exit(1)

    errors = (
        session.query(ValidationError)
        .filter_by(batch_id=batch.id, fixed=False)
        .order_by(ValidationError.source_row_no)
        .all()
    )

    if not errors:
        console.print("[green]该批次没有待修复的错误[/green]")
        return

    if row_no and field and value is not None:
        error = next((e for e in errors if e.source_row_no == row_no and e.field_name == field), None)
        if not error:
            console.print(f"[red]未找到行{row_no}字段{field}的错误[/red]")
            sys.exit(1)

        record = error.record
        old_data = record.data.copy()
        record.data[field] = value

        new_errors = DataValidator(record.source_type).validate(record.data, row_no)
        has_error = any(e[0] == ValidationLevel.ERROR for e in new_errors)

        if not has_error:
            error.fixed = True
            error.fixed_by = operator
            error.fixed_at = datetime.now()
            record.is_valid = True

            diff = calculate_diff(old_data, record.data)
            record_audit(
                session,
                record.id,
                batch.id,
                "MANUAL_FIX",
                str(old_data.get(field)),
                str(value),
                operator,
                row_no,
                field_name=field,
                diff_data=diff,
            )

            batch.success_rows += 1
            batch.failed_rows -= 1
            session.commit()
            console.print(f"[green]行{row_no}字段{field}已修复[/green]")
        else:
            console.print(f"[yellow]修正后仍有错误，请检查[/yellow]")

    else:
        display_table(
            f"待修复错误清单 - 批次 {batch_no}",
            ["行号", "级别", "字段", "错误代码", "错误信息"],
            [[
                str(e.source_row_no),
                e.level.value,
                e.field_name or "-",
                e.error_code or "-",
                e.error_message,
            ] for e in errors],
        )
        console.print(f"\n修复命令示例:")
        console.print(f"  cpi fix {batch_no} --row-no {errors[0].source_row_no} --field {errors[0].field_name} --value \"新值\"")


@cli.command()
@click.option("--batch-no", help="指定批次")
@click.option("--source-type", help="按数据源类型筛选")
@click.option("--format", "fmt", type=click.Choice(["table", "json", "excel"]), default="table")
@click.option("--output", help="输出文件路径")
def report(batch_no: Optional[str], source_type: Optional[str], fmt: str, output: Optional[str]):
    """生成片区经理报告（含原始行号、失败清单）"""
    session = get_session()

    query = session.query(ValidationError).filter_by(fixed=False)
    if batch_no:
        batch = session.query(ImportBatch).filter_by(batch_no=batch_no).first()
        if batch:
            query = query.filter_by(batch_id=batch.id)
    if source_type:
        st = DataSourceType(source_type)
        batch_ids = [b.id for b in session.query(ImportBatch).filter_by(source_type=st).all()]
        query = query.filter(ValidationError.batch_id.in_(batch_ids))

    errors = query.order_by(ValidationError.source_row_no).all()

    if not errors:
        console.print("[green]暂无待处理的错误[/green]")
        return

    report_data = []
    for e in errors:
        batch = e.batch
        record = e.record
        report_data.append({
            "批次号": batch.batch_no,
            "数据源": batch.source_type.value,
            "原始行号": e.source_row_no,
            "错误级别": e.level.value,
            "字段名": e.field_name or "-",
            "错误代码": e.error_code or "-",
            "错误信息": e.error_message,
            "原始数据": json.dumps(record.data, ensure_ascii=False) if record else "-",
            "导入时间": batch.imported_at.strftime("%Y-%m-%d %H:%M"),
            "操作人": batch.imported_by,
        })

    if fmt == "table":
        display_table(
            "片区经理报告 - 失败清单",
            ["批次号", "数据源", "原始行号", "错误级别", "字段", "错误信息"],
            [[
                r["批次号"],
                r["数据源"],
                str(r["原始行号"]),
                r["错误级别"],
                r["字段名"],
                r["错误信息"],
            ] for r in report_data],
        )
        console.print(f"\n总计: {len(report_data)} 条待处理")
    elif fmt == "json":
        result = json.dumps(report_data, ensure_ascii=False, indent=2)
        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(result)
            console.print(f"[green]已导出到 {output}[/green]")
        else:
            console.print(result)
    elif fmt == "excel":
        df = pd.DataFrame(report_data)
        output_path = output or os.path.expanduser(f"~/.cpi/exports/report_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")
        df.to_excel(output_path, index=False)
        console.print(f"[green]已导出到 {output_path}[/green]")


@cli.command()
@click.argument("batch_no", required=False)
@click.option("--record-id", type=int, help="查看指定记录的历史")
@click.option("--limit", type=int, default=50, help="显示条数")
@click.option("--show-diff", is_flag=True, help="显示详细差异")
def history(batch_no: Optional[str], record_id: Optional[int], limit: int, show_diff: bool):
    """查看审计历史和差异对比"""
    session = get_session()

    query = session.query(AuditHistory)

    if record_id:
        query = query.filter_by(record_id=record_id)
    elif batch_no:
        batch = session.query(ImportBatch).filter_by(batch_no=batch_no).first()
        if batch:
            query = query.filter_by(batch_id=batch.id)

    history_entries = query.order_by(AuditHistory.changed_at.desc()).limit(limit).all()

    rows = []
    for h in history_entries:
        rows.append([
            h.changed_at.strftime("%m-%d %H:%M"),
            h.action,
            h.changed_by,
            str(h.source_row_no or "-"),
            h.field_name or "-",
            h.old_value[:30] + "..." if h.old_value and len(h.old_value) > 30 else (h.old_value or "-"),
            h.new_value[:30] + "..." if h.new_value and len(h.new_value) > 30 else (h.new_value or "-"),
        ])

    display_table(
        "审计历史",
        ["时间", "动作", "操作人", "行号", "字段", "原值", "新值"],
        rows,
    )

    if show_diff and history_entries:
        for h in history_entries[:3]:
            if h.diff_data:
                console.print(f"\n[cyan]详细差异 - {h.changed_at} {h.action}[/cyan]")
                console.print(json.dumps(h.diff_data, ensure_ascii=False, indent=2))


@cli.command()
@click.argument("source_type", type=click.Choice([t.value for t in DataSourceType]))
@click.option("--batch-no", help="指定批次")
@click.option("--format", "fmt", type=click.Choice(["excel", "csv", "json"]), default="excel")
@click.option("--output", help="输出文件路径")
def export(source_type: str, batch_no: Optional[str], fmt: str, output: Optional[str]):
    """导出数据"""
    session = get_session()
    st = DataSourceType(source_type)

    query = session.query(DataRecord).filter_by(source_type=st)
    if batch_no:
        batch = session.query(ImportBatch).filter_by(batch_no=batch_no).first()
        if batch:
            query = query.filter_by(batch_id=batch.id)

    records = query.all()

    if not records:
        console.print("[yellow]没有可导出的数据[/yellow]")
        return

    data_list = []
    for r in records:
        item = r.data.copy()
        item["_batch_no"] = r.batch.batch_no if r.batch else "-"
        item["_source_row_no"] = r.source_row_no
        item["_is_valid"] = r.is_valid
        item["_created_at"] = r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        data_list.append(item)

    df = pd.DataFrame(data_list)

    if not output:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        ext = "xlsx" if fmt == "excel" else fmt
        output = os.path.expanduser(f"~/.cpi/exports/{source_type}_{ts}.{ext}")

    if fmt == "excel":
        df.to_excel(output, index=False)
    elif fmt == "csv":
        df.to_csv(output, index=False, encoding="utf-8-sig")
    else:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(data_list, f, ensure_ascii=False, indent=2)

    console.print(f"[green]已导出 {len(records)} 条记录到 {output}[/green]")


@cli.group()
def task():
    """异步任务管理"""
    pass


@task.command("list")
@click.option("--status", help="按状态筛选")
def task_list(status: Optional[str]):
    """列出异步任务"""
    session = get_session()
    query = session.query(AsyncTask)
    if status:
        query = query.filter_by(status=TaskStatus(status))
    tasks = query.order_by(AsyncTask.created_at.desc()).limit(20).all()

    display_table(
        "异步任务列表",
        ["任务ID", "类型", "批次", "状态", "重试", "错误", "创建时间"],
        [[
            t.task_id,
            t.task_type,
            str(t.batch_id or "-"),
            t.status.value,
            f"{t.retry_count}/{t.max_retries}",
            t.error_message[:30] if t.error_message else "-",
            t.created_at.strftime("%m-%d %H:%M"),
        ] for t in tasks],
    )


@task.command("retry")
@click.argument("task_id")
def task_retry(task_id: str):
    """重试失败任务"""
    session = get_session()
    task = session.query(AsyncTask).filter_by(task_id=task_id).first()
    if not task:
        console.print(f"[red]任务不存在: {task_id}[/red]")
        sys.exit(1)

    if task.status in [TaskStatus.WAIT_RETRY, TaskStatus.WAIT_MANUAL]:
        task.status = TaskStatus.PENDING
        task.retry_count += 1
        task.updated_at = datetime.now()
        session.commit()
        console.print(f"[green]任务 {task_id} 已标记为重试[/green]")
    else:
        console.print(f"[yellow]当前状态不支持重试: {task.status.value}[/yellow]")


@task.command("fail")
@click.argument("task_id")
@click.option("--reason", help="失败原因")
def task_fail(task_id: str, reason: Optional[str]):
    """标记为永久失败"""
    session = get_session()
    task = session.query(AsyncTask).filter_by(task_id=task_id).first()
    if not task:
        console.print(f"[red]任务不存在: {task_id}[/red]")
        sys.exit(1)

    task.status = TaskStatus.PERMANENT_FAIL
    task.error_message = reason or task.error_message
    task.updated_at = datetime.now()
    session.commit()
    console.print(f"[green]任务 {task_id} 已标记为永久失败[/green]")


if __name__ == "__main__":
    cli()
