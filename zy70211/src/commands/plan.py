import csv
import json
from datetime import datetime, date
from typing import Dict, List
import click
from tabulate import tabulate
from ..data_store import DataStore
from ..models import (
    FumigationPlan, FumigationStatus, ChemicalRecord,
    EvacuationRecord, ProcessResult, BarnStatus
)


@click.group()
def plan():
    """熏蒸计划管理"""
    pass


def validate_plan_row(row: Dict, row_num: int, store: DataStore) -> List[str]:
    errors = []
    required_fields = ["plan_id", "barn_id", "plan_date", "estimated_duration_hours", "target_pests", "operator", "status"]
    for field in required_fields:
        if field not in row or not str(row[field]).strip():
            errors.append(f"缺少必填字段: {field}")

    if "barn_id" in row and str(row["barn_id"]).strip():
        barn = store.get_barn(str(row["barn_id"]).strip())
        if not barn:
            errors.append(f"来源仓房记录不存在: barn_id={row['barn_id']}")

    if "estimated_duration_hours" in row and row["estimated_duration_hours"]:
        try:
            val = float(row["estimated_duration_hours"])
            if val <= 0:
                errors.append("estimated_duration_hours 必须大于0")
        except ValueError:
            errors.append(f"estimated_duration_hours 不是有效数字: {row['estimated_duration_hours']}")

    if "status" in row and row["status"]:
        valid_statuses = [s.value for s in FumigationStatus]
        if row["status"] not in valid_statuses:
            errors.append(f"status 无效: {row['status']}，有效值: {valid_statuses}")

    return errors


def _parse_plan_row(row: Dict, store: DataStore) -> FumigationPlan:
    chemicals = _parse_chemicals(row.get("chemicals_json", "[]"))
    evacuations = _parse_evacuations(row.get("evacuations_json", "[]"))

    return FumigationPlan(
        plan_id=str(row["plan_id"]).strip(),
        barn_id=str(row["barn_id"]).strip(),
        plan_date=_parse_date(row.get("plan_date", "")) or date.today(),
        estimated_duration_hours=float(row["estimated_duration_hours"]),
        target_pests=str(row["target_pests"]).strip(),
        operator=str(row["operator"]).strip(),
        chemicals=chemicals,
        evacuations=evacuations,
        status=FumigationStatus(row["status"]),
        created_at=datetime.now(),
        updated_at=datetime.now(),
        remarks=str(row.get("remarks", "")).strip()
    )


def _parse_chemicals(json_str: str) -> List[ChemicalRecord]:
    try:
        data = json.loads(json_str) if json_str and str(json_str).strip() else []
    except json.JSONDecodeError:
        data = []

    if not isinstance(data, list):
        return []

    records = []
    for item in data:
        if not item:
            continue
        try:
            records.append(ChemicalRecord(
                chemical_name=str(item.get("chemical_name", "")),
                chemical_type=str(item.get("chemical_type", "")),
                dosage=float(item.get("dosage", 0)),
                unit=str(item.get("unit", "g")),
                batch_number=str(item.get("batch_number", "")),
                expiration_date=_parse_date(item.get("expiration_date", "")) or date.today(),
                supplier=str(item.get("supplier", ""))
            ))
        except Exception:
            pass
    return records


def _parse_evacuations(json_str: str) -> List[EvacuationRecord]:
    try:
        data = json.loads(json_str) if json_str and str(json_str).strip() else []
    except json.JSONDecodeError:
        data = []

    if not isinstance(data, list):
        return []

    records = []
    for item in data:
        if not item:
            continue
        try:
            records.append(EvacuationRecord(
                personnel_name=str(item.get("personnel_name", "")),
                personnel_id=str(item.get("personnel_id", "")),
                department=str(item.get("department", "")),
                evacuation_time=_parse_datetime(item.get("evacuation_time", "")) or datetime.now(),
                check_time=_parse_datetime(item.get("check_time", "")) or datetime.now(),
                check_person=str(item.get("check_person", ""))
            ))
        except Exception:
            pass
    return records


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


def _parse_datetime(value: str) -> datetime or None:
    if not value or not str(value).strip():
        return None
    value = str(value).strip()
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None


@plan.command("import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--data-dir", default="data", help="数据目录")
@click.option("--force/--no-force", default=False, help="强制覆盖重复记录")
@click.option("--allow-status-conflict/--no-allow-status-conflict", default=False, help="允许仓房状态冲突")
def import_plans(file_path, data_dir, force, allow_status_conflict):
    """从CSV/JSON导入熏蒸计划"""
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
        errors = validate_plan_row(row, idx, store)
        if errors:
            result.skipped_rows.append({"row": idx, "data": dict(row), "errors": errors})
            result.errors.extend([f"第{idx}行: {e}" for e in errors])
            continue

        plan_id = str(row["plan_id"]).strip()
        barn_id = str(row["barn_id"]).strip()

        existing_plan = store.get_plan(plan_id)
        if existing_plan and not force:
            result.skipped_rows.append({"row": idx, "data": dict(row), "errors": [f"重复的计划ID: {plan_id}，使用 --force 覆盖"]})
            result.warnings.append(f"第{idx}行: 重复记录跳过 (计划ID: {plan_id})")
            continue

        barn = store.get_barn(barn_id)
        if barn:
            barn_plans = store.get_plans_by_barn(barn_id)
            active_plans = [p for p in barn_plans if p.status in [
                FumigationStatus.SUBMITTED,
                FumigationStatus.APPROVED,
                FumigationStatus.IN_PROGRESS
            ]]
            new_status = FumigationStatus(row["status"])
            if active_plans and new_status in [FumigationStatus.SUBMITTED, FumigationStatus.APPROVED]:
                if not allow_status_conflict:
                    result.skipped_rows.append({
                        "row": idx,
                        "data": dict(row),
                        "errors": [f"仓房 {barn_id} 已有进行中的熏蒸计划，使用 --allow-status-conflict 忽略此检查"]
                    })
                    result.warnings.append(f"第{idx}行: 状态冲突跳过 (仓房: {barn_id})")
                    continue
                else:
                    result.warnings.append(f"第{idx}行: 仓房 {barn_id} 存在进行中的计划，已忽略状态冲突")

        try:
            new_plan = _parse_plan_row(row, store)

            if existing_plan and force:
                new_plan.created_at = existing_plan.created_at
                store.update_plan(new_plan)
                result.warnings.append(f"第{idx}行: 已覆盖计划 {plan_id}")
            else:
                store.add_plan(new_plan)

            result.success_rows.append({"row": idx, "plan_id": plan_id, "barn_id": barn_id})
            result.processed_rows += 1
        except Exception as e:
            result.failed_rows.append({"row": idx, "data": dict(row), "error": str(e)})
            result.errors.append(f"第{idx}行处理失败: {e}")

    _print_result(result, "熏蒸计划")


@plan.command("list")
@click.option("--data-dir", default="data", help="数据目录")
@click.option("--barn-id", help="按仓房ID筛选")
@click.option("--status", type=click.Choice([s.value for s in FumigationStatus]), help="按状态筛选")
@click.option("--output", type=click.Choice(["table", "json"]), default="table", help="输出格式")
def list_plans(data_dir, barn_id, status, output):
    """列出所有熏蒸计划"""
    store = DataStore(data_dir)
    plans = list(store.plans.values())

    if barn_id:
        plans = [p for p in plans if p.barn_id == barn_id]
    if status:
        plans = [p for p in plans if p.status.value == status]

    plans.sort(key=lambda p: p.plan_date, reverse=True)

    if output == "json":
        output_data = []
        for p in plans:
            d = p.to_dict()
            d["chemicals"] = [
                {
                    "chemical_name": c.chemical_name,
                    "chemical_type": c.chemical_type,
                    "dosage": c.dosage,
                    "unit": c.unit,
                    "batch_number": c.batch_number
                }
                for c in p.chemicals
            ]
            d["evacuations_count"] = len(p.evacuations)
            output_data.append(d)
        click.echo(json.dumps(output_data, ensure_ascii=False, indent=2))
    else:
        if not plans:
            click.echo("暂无熏蒸计划")
            return
        headers = ["计划ID", "仓房ID", "计划日期", "时长(小时)", "目标害虫", "操作人员", "药剂数", "撤离人数", "状态"]
        table_data = [[
            p.plan_id,
            p.barn_id,
            p.plan_date.isoformat(),
            p.estimated_duration_hours,
            p.target_pests,
            p.operator,
            len(p.chemicals),
            len(p.evacuations),
            p.status.value
        ] for p in plans]
        click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))


@plan.command("show")
@click.argument("plan_id")
@click.option("--data-dir", default="data", help="数据目录")
def show_plan(plan_id, data_dir):
    """查看熏蒸计划详情"""
    store = DataStore(data_dir)
    plan = store.get_plan(plan_id)

    if not plan:
        click.echo(f"计划 {plan_id} 不存在")
        return

    barn = store.get_barn(plan.barn_id)

    click.echo("=" * 60)
    click.echo(f"熏蒸计划详情: {plan.plan_id}")
    click.echo("=" * 60)
    click.echo(f"仓房: {plan.barn_id} ({barn.barn_name if barn else '未知'})")
    click.echo(f"计划日期: {plan.plan_date}")
    click.echo(f"预计时长: {plan.estimated_duration_hours} 小时")
    click.echo(f"目标害虫: {plan.target_pests}")
    click.echo(f"操作人员: {plan.operator}")
    click.echo(f"状态: {plan.status.value}")
    if plan.remarks:
        click.echo(f"备注: {plan.remarks}")

    if plan.chemicals:
        click.echo("")
        click.echo("药剂清单:")
        for c in plan.chemicals:
            click.echo(f"  - {c.chemical_name} ({c.chemical_type}): {c.dosage}{c.unit}, 批号:{c.batch_number}")

    if plan.evacuations:
        click.echo("")
        click.echo("人员撤离记录:")
        for e in plan.evacuations:
            click.echo(f"  - {e.personnel_name} ({e.personnel_id}, {e.department}): 撤离于 {e.evacuation_time}, 核对: {e.check_person}")


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
            click.echo(f"  第{item['row']}行: {item.get('plan_id') or item.get('barn_id')}")
        if len(result.success_rows) > 10:
            click.echo(f"  ... 还有 {len(result.success_rows) - 10} 条")

    if result.skipped_rows:
        click.echo("")
        click.echo("跳过记录 (需人工确认):")
        for item in result.skipped_rows:
            errors = ", ".join(item["errors"])
            row_data = item["data"]
            ident = row_data.get("plan_id") or row_data.get("barn_id") or f"第{item['row']}行"
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
