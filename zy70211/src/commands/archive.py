import csv
import json
from datetime import datetime, date
from typing import Dict, List
import click
from tabulate import tabulate
from ..data_store import DataStore
from ..models import GrainBarn, BarnStatus, ProcessResult


@click.group()
def archive():
    """粮仓档案管理"""
    pass


def validate_barn_row(row: Dict, row_num: int) -> List[str]:
    errors = []
    required_fields = ["barn_id", "barn_name", "location", "capacity", "current_grain_type", "current_grain_quantity", "status"]
    for field in required_fields:
        if field not in row or not str(row[field]).strip():
            errors.append(f"缺少必填字段: {field}")
    if "capacity" in row and row["capacity"]:
        try:
            float(row["capacity"])
        except ValueError:
            errors.append(f"capacity 不是有效数字: {row['capacity']}")
    if "current_grain_quantity" in row and row["current_grain_quantity"]:
        try:
            float(row["current_grain_quantity"])
        except ValueError:
            errors.append(f"current_grain_quantity 不是有效数字: {row['current_grain_quantity']}")
    if "status" in row and row["status"]:
        valid_statuses = [s.value for s in BarnStatus]
        if row["status"] not in valid_statuses:
            errors.append(f"status 无效: {row['status']}，有效值: {valid_statuses}")
    return errors


@archive.command("import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--data-dir", default="data", help="数据目录")
@click.option("--force/--no-force", default=False, help="强制覆盖重复记录")
def import_barns(file_path, data_dir, force):
    """从CSV/JSON导入粮仓档案"""
    store = DataStore(data_dir)
    result = ProcessResult(
        total_rows=0,
        processed_rows=0,
        skipped_rows=[],
        success_rows=[],
        need_confirm_rows=[],
        failed_rows=[],
        warnings=[],
        errors=[]
    )

    if file_path.endswith(".json"):
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            rows = data if isinstance(data, list) else [data]
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

    result.total_rows = len(rows)

    for idx, row in enumerate(rows, start=1):
        errors = validate_barn_row(row, idx)
        if errors:
            result.skipped_rows.append({"row": idx, "data": dict(row), "errors": errors})
            result.errors.extend([f"第{idx}行: {e}" for e in errors])
            continue

        barn_id = str(row["barn_id"]).strip()

        existing = store.get_barn(barn_id)
        if existing and not force:
            result.skipped_rows.append({"row": idx, "data": dict(row), "errors": [f"重复的仓房ID: {barn_id}，使用 --force 覆盖"]})
            result.warnings.append(f"第{idx}行: 重复记录跳过 (仓房ID: {barn_id})")
            continue

        try:
            barn = GrainBarn(
                barn_id=barn_id,
                barn_name=str(row["barn_name"]).strip(),
                location=str(row["location"]).strip(),
                capacity=float(row["capacity"]),
                current_grain_type=str(row["current_grain_type"]).strip(),
                current_grain_quantity=float(row["current_grain_quantity"]),
                last_fumigation_date=_parse_date(row.get("last_fumigation_date", "")),
                status=BarnStatus(row["status"]),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )

            if existing and force:
                barn.created_at = existing.created_at
                store.update_barn(barn)
                result.warnings.append(f"第{idx}行: 已覆盖仓房 {barn_id}")
            else:
                store.add_barn(barn)

            result.success_rows.append({"row": idx, "barn_id": barn_id, "barn_name": barn.barn_name})
            result.processed_rows += 1
        except Exception as e:
            result.failed_rows.append({"row": idx, "data": dict(row), "error": str(e)})
            result.errors.append(f"第{idx}行处理失败: {e}")

    _print_result(result, "粮仓档案")


@archive.command("list")
@click.option("--data-dir", default="data", help="数据目录")
@click.option("--status", type=click.Choice([s.value for s in BarnStatus]), help="按状态筛选")
@click.option("--output", type=click.Choice(["table", "json", "csv"]), default="table", help="输出格式")
def list_barns(data_dir, status, output):
    """列出所有粮仓档案"""
    store = DataStore(data_dir)
    barns = list(store.barns.values())

    if status:
        barns = [b for b in barns if b.status.value == status]

    barns.sort(key=lambda b: b.barn_id)

    if output == "json":
        click.echo(json.dumps([b.to_dict() for b in barns], ensure_ascii=False, indent=2))
    elif output == "csv":
        if not barns:
            click.echo("无数据")
            return
        fieldnames = list(barns[0].to_dict().keys())
        writer = csv.DictWriter(click.get_text_stream("stdout"), fieldnames=fieldnames)
        writer.writeheader()
        for b in barns:
            writer.writerow(b.to_dict())
    else:
        if not barns:
            click.echo("暂无粮仓档案")
            return
        headers = ["仓房ID", "仓房名称", "位置", "容量(吨)", "粮食品种", "数量(吨)", "状态"]
        table_data = [[
            b.barn_id,
            b.barn_name,
            b.location,
            b.capacity,
            b.current_grain_type,
            b.current_grain_quantity,
            b.status.value
        ] for b in barns]
        click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))


def _parse_date(value: str) -> date or None:
    if not value or not str(value).strip():
        return None
    value = str(value).strip()
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        try:
            return datetime.fromisoformat(value).date()
        except ValueError:
            return None


def _print_result(result: ProcessResult, entity_name: str):
    click.echo("=" * 60)
    click.echo(f"导入结果统计 - {entity_name}")
    click.echo("=" * 60)
    click.echo(f"总计行数: {result.total_rows}")
    click.echo(f"成功处理: {result.processed_rows}")
    click.echo(f"成功记录: {len(result.success_rows)}")
    click.echo(f"跳过行数: {len(result.skipped_rows)}")
    click.echo(f"失败行数: {len(result.failed_rows)}")

    if result.success_rows:
        click.echo("")
        click.echo("成功记录:")
        for item in result.success_rows[:10]:
            click.echo(f"  第{item['row']}行: {item.get('barn_id') or item.get('plan_id')}")
        if len(result.success_rows) > 10:
            click.echo(f"  ... 还有 {len(result.success_rows) - 10} 条")

    if result.skipped_rows:
        click.echo("")
        click.echo("跳过记录 (需人工确认):")
        for item in result.skipped_rows:
            errors = ", ".join(item["errors"])
            row_data = item["data"]
            ident = row_data.get("barn_id") or row_data.get("plan_id") or f"第{item['row']}行"
            click.echo(f"  {ident}: {errors}")

    if result.warnings:
        click.echo("")
        click.echo("警告:")
        for w in result.warnings:
            click.echo(f"  ! {w}")

    if result.errors:
        click.echo("")
        click.echo("错误:")
        for e in result.errors:
            click.echo(f"  x {e}")
