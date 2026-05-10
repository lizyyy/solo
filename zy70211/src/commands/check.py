import csv
import json
import uuid
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
import click
from tabulate import tabulate
from ..data_store import DataStore
from ..models import (
    FumigationCheck, CheckItem, CheckStatus,
    FumigationPlan, FumigationStatus, ProcessResult,
    ChemicalRecord, EvacuationRecord
)


@click.group()
def check():
    """熏蒸安全核对"""
    pass


SAFE_TEMP_RANGE = (10.0, 35.0)
SAFE_HUMIDITY_RANGE = (30.0, 70.0)
MIN_SEAL_QUALITY_SCORE = 80.0
RECOMMENDED_CHEMICALS = ["磷化铝", "磷化镁", "敌敌畏", "虫螨腈", "甲基嘧啶磷"]


def validate_check_row(row: Dict, row_num: int, store: DataStore) -> List[str]:
    errors = []
    required_fields = ["plan_id", "temperature", "humidity", "seal_start_time", "seal_quality_score"]
    for field in required_fields:
        if field not in row or not str(row[field]).strip():
            errors.append(f"缺少必填字段: {field}")

    if "plan_id" in row and str(row["plan_id"]).strip():
        plan = store.get_plan(str(row["plan_id"]).strip())
        if not plan:
            errors.append(f"来源熏蒸计划不存在: plan_id={row['plan_id']}")
        elif plan.status not in [FumigationStatus.SUBMITTED, FumigationStatus.APPROVED]:
            errors.append(f"计划状态不允许核对: 当前状态={plan.status.value}，需为'已提交'或'已批准'")

    for num_field in ["temperature", "humidity", "seal_quality_score"]:
        if num_field in row and row[num_field]:
            try:
                float(row[num_field])
            except ValueError:
                errors.append(f"{num_field} 不是有效数字: {row[num_field]}")

    return errors


def check_chemicals(plan: FumigationPlan, idx: int) -> List[CheckItem]:
    items = []
    check_id_base = f"{plan.plan_id}_chem"

    if not plan.chemicals:
        items.append(CheckItem(
            check_id=f"{check_id_base}_{idx:03d}",
            plan_id=plan.plan_id,
            check_type="chemical",
            check_description="药剂清单检查",
            check_value="无药剂记录",
            expected_value="至少1种熏蒸药剂",
            status=CheckStatus.FAILED,
            message="熏蒸计划缺少药剂记录，无法进行安全核对",
            checked_at=datetime.now(),
            checked_by="system"
        ))
        return items

    for c_idx, chem in enumerate(plan.chemicals):
        base_idx = idx + c_idx * 3

        items.append(CheckItem(
            check_id=f"{check_id_base}_{base_idx:03d}",
            plan_id=plan.plan_id,
            check_type="chemical_name",
            check_description=f"药剂名称有效性检查: {chem.chemical_name}",
            check_value=chem.chemical_name,
            expected_value=", ".join(RECOMMENDED_CHEMICALS),
            status=CheckStatus.PASSED if chem.chemical_name in RECOMMENDED_CHEMICALS else CheckStatus.NEED_CONFIRM,
            message="药剂名称不在推荐列表中" if chem.chemical_name not in RECOMMENDED_CHEMICALS else "药剂名称有效",
            checked_at=datetime.now(),
            checked_by="system"
        ))

        items.append(CheckItem(
            check_id=f"{check_id_base}_{base_idx + 1:03d}",
            plan_id=plan.plan_id,
            check_type="chemical_dosage",
            check_description=f"药剂剂量检查: {chem.chemical_name}",
            check_value=f"{chem.dosage} {chem.unit}",
            expected_value="剂量需根据粮食品种和仓容计算",
            status=CheckStatus.NEED_CONFIRM,
            message="药剂剂量需要人工复核（根据粮食品种、仓容、害虫密度计算）",
            checked_at=datetime.now(),
            checked_by="system"
        ))

        if chem.expiration_date:
            expired = chem.expiration_date < date.today()
            items.append(CheckItem(
                check_id=f"{check_id_base}_{base_idx + 2:03d}",
                plan_id=plan.plan_id,
                check_type="chemical_expiration",
                check_description=f"药剂有效期检查: {chem.chemical_name}",
                check_value=chem.expiration_date.isoformat(),
                expected_value=f">= {date.today().isoformat()}",
                status=CheckStatus.FAILED if expired else CheckStatus.PASSED,
                message="药剂已过期" if expired else "药剂在有效期内",
                checked_at=datetime.now(),
                checked_by="system"
            ))

    return items


def check_evacuations(plan: FumigationPlan, idx: int) -> List[CheckItem]:
    items = []
    check_id_base = f"{plan.plan_id}_evac"

    if not plan.evacuations:
        items.append(CheckItem(
            check_id=f"{check_id_base}_{idx:03d}",
            plan_id=plan.plan_id,
            check_type="evacuation_list",
            check_description="人员撤离检查",
            check_value="无撤离记录",
            expected_value="所有参与人员撤离记录完整",
            status=CheckStatus.FAILED,
            message="熏蒸计划缺少人员撤离记录，存在严重安全隐患",
            checked_at=datetime.now(),
            checked_by="system"
        ))
        return items

    person_ids = set()
    duplicates = []

    for e_idx, evac in enumerate(plan.evacuations):
        base_idx = idx + e_idx * 2

        if evac.personnel_id in person_ids:
            duplicates.append(evac.personnel_id)
        person_ids.add(evac.personnel_id)

        items.append(CheckItem(
            check_id=f"{check_id_base}_{base_idx:03d}",
            plan_id=plan.plan_id,
            check_type="evacuation_record",
            check_description=f"撤离记录完整性: {evac.personnel_name}",
            check_value=f"撤离时间: {evac.evacuation_time}, 核对人: {evac.check_person}",
            expected_value="撤离时间、核对人均有记录",
            status=CheckStatus.PASSED,
            message="撤离记录完整",
            checked_at=datetime.now(),
            checked_by="system"
        ))

        if evac.evacuation_time and evac.check_time:
            check_after_evac = evac.check_time >= evac.evacuation_time
            items.append(CheckItem(
                check_id=f"{check_id_base}_{base_idx + 1:03d}",
                plan_id=plan.plan_id,
                check_type="evacuation_timing",
                check_description=f"撤离核对时序: {evac.personnel_name}",
                check_value=f"撤离: {evac.evacuation_time}, 核对: {evac.check_time}",
                expected_value="核对时间 >= 撤离时间",
                status=CheckStatus.PASSED if check_after_evac else CheckStatus.FAILED,
                message="核对时序正常" if check_after_evac else "核对时间早于撤离时间，时序异常",
                checked_at=datetime.now(),
                checked_by="system"
            ))

    if duplicates:
        items.append(CheckItem(
            check_id=f"{check_id_base}_{idx + len(plan.evacuations) * 2:03d}",
            plan_id=plan.plan_id,
            check_type="evacuation_duplicate",
            check_description="撤离记录去重检查",
            check_value=f"重复人员ID: {', '.join(duplicates)}",
            expected_value="无重复撤离记录",
            status=CheckStatus.NEED_CONFIRM,
            message=f"发现 {len(duplicates)} 条重复撤离记录，需人工确认是否为误录",
            checked_at=datetime.now(),
            checked_by="system"
        ))

    items.append(CheckItem(
        check_id=f"{check_id_base}_{idx + len(plan.evacuations) * 2 + 1:03d}",
        plan_id=plan.plan_id,
        check_type="evacuation_count",
        check_description="撤离人数统计",
        check_value=f"{len(person_ids)} 人",
        expected_value="所有作业区域人员已撤离",
        status=CheckStatus.NEED_CONFIRM,
        message="撤离人数需要与仓房作业区域人员清单核对确认",
        checked_at=datetime.now(),
        checked_by="system"
    ))

    return items


def check_environment(temperature: float, humidity: float, plan: FumigationPlan, idx: int) -> List[CheckItem]:
    items = []
    check_id_base = f"{plan.plan_id}_env"

    temp_ok = SAFE_TEMP_RANGE[0] <= temperature <= SAFE_TEMP_RANGE[1]
    items.append(CheckItem(
        check_id=f"{check_id_base}_{idx:03d}",
        plan_id=plan.plan_id,
        check_type="temperature",
        check_description="仓内温度检查",
        check_value=f"{temperature} °C",
        expected_value=f"{SAFE_TEMP_RANGE[0]}-{SAFE_TEMP_RANGE[1]} °C",
        status=CheckStatus.PASSED if temp_ok else CheckStatus.NEED_CONFIRM,
        message="温度在安全范围内" if temp_ok else f"温度超出推荐范围({SAFE_TEMP_RANGE[0]}-{SAFE_TEMP_RANGE[1]}°C)，需确认是否影响熏蒸效果",
        checked_at=datetime.now(),
        checked_by="system"
    ))

    humidity_ok = SAFE_HUMIDITY_RANGE[0] <= humidity <= SAFE_HUMIDITY_RANGE[1]
    items.append(CheckItem(
        check_id=f"{check_id_base}_{idx + 1:03d}",
        plan_id=plan.plan_id,
        check_type="humidity",
        check_description="仓内湿度检查",
        check_value=f"{humidity} %",
        expected_value=f"{SAFE_HUMIDITY_RANGE[0]}-{SAFE_HUMIDITY_RANGE[1]} %",
        status=CheckStatus.PASSED if humidity_ok else CheckStatus.NEED_CONFIRM,
        message="湿度在安全范围内" if humidity_ok else f"湿度超出推荐范围({SAFE_HUMIDITY_RANGE[0]}-{SAFE_HUMIDITY_RANGE[1]}%)，需确认药剂分解速度",
        checked_at=datetime.now(),
        checked_by="system"
    ))

    return items


def check_seal(seal_start_time: datetime, seal_quality_score: float, plan: FumigationPlan, idx: int) -> List[CheckItem]:
    items = []
    check_id_base = f"{plan.plan_id}_seal"

    items.append(CheckItem(
        check_id=f"{check_id_base}_{idx:03d}",
        plan_id=plan.plan_id,
        check_type="seal_quality",
        check_description="仓房密封质量评分",
        check_value=f"{seal_quality_score} 分",
        expected_value=f">= {MIN_SEAL_QUALITY_SCORE} 分",
        status=CheckStatus.PASSED if seal_quality_score >= MIN_SEAL_QUALITY_SCORE else CheckStatus.FAILED,
        message="密封质量良好" if seal_quality_score >= MIN_SEAL_QUALITY_SCORE else f"密封质量不足(需>= {MIN_SEAL_QUALITY_SCORE}分)，熏蒸气体易泄漏",
        checked_at=datetime.now(),
        checked_by="system"
    ))

    if plan.plan_date and seal_start_time:
        plan_date = datetime.combine(plan.plan_date, datetime.min.time())
        seal_before_plan = seal_start_time <= plan_date
        items.append(CheckItem(
            check_id=f"{check_id_base}_{idx + 1:03d}",
            plan_id=plan.plan_id,
            check_type="seal_timing",
            check_description="封仓时间与熏蒸计划时序",
            check_value=f"封仓开始: {seal_start_time}, 计划日期: {plan.plan_date}",
            expected_value="封仓开始时间 <= 熏蒸计划日期",
            status=CheckStatus.PASSED if seal_before_plan else CheckStatus.NEED_CONFIRM,
            message="封仓时序正常" if seal_before_plan else "封仓时间晚于熏蒸计划日期，需确认是否为计划调整",
            checked_at=datetime.now(),
            checked_by="system"
        ))

    return items


def run_check(plan_id: str, temperature: float, humidity: float,
              seal_start_time: datetime, seal_quality_score: float,
              store: DataStore, operator: str = "system") -> FumigationCheck:

    plan = store.get_plan(plan_id)
    if not plan:
        raise ValueError(f"计划不存在: {plan_id}")

    barn = store.get_barn(plan.barn_id)
    barn_name = barn.barn_name if barn else "未知"

    check_id = str(uuid.uuid4())[:8]
    check_items = []
    item_idx = 0

    check_items.extend(check_chemicals(plan, item_idx))
    item_idx = len(check_items)

    check_items.extend(check_evacuations(plan, item_idx))
    item_idx = len(check_items)

    check_items.extend(check_environment(temperature, humidity, plan, item_idx))
    item_idx = len(check_items)

    check_items.extend(check_seal(seal_start_time, seal_quality_score, plan, item_idx))

    has_failed = any(item.status == CheckStatus.FAILED for item in check_items)
    has_need_confirm = any(item.status == CheckStatus.NEED_CONFIRM for item in check_items)

    if has_failed:
        overall_status = CheckStatus.FAILED
    elif has_need_confirm:
        overall_status = CheckStatus.NEED_CONFIRM
    else:
        overall_status = CheckStatus.PASSED

    check = FumigationCheck(
        check_id=check_id,
        plan_id=plan_id,
        barn_id=plan.barn_id,
        barn_name=barn_name,
        temperature=temperature,
        humidity=humidity,
        seal_start_time=seal_start_time,
        seal_quality_score=seal_quality_score,
        overall_status=overall_status,
        items=check_items,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    store.add_check(check)
    return check


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
            try:
                return datetime.strptime(value, "%Y-%m-%d %H:%M")
            except ValueError:
                return None


@check.command("run")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--data-dir", default="data", help="数据目录")
def run_checks(file_path, data_dir):
    """批量执行安全核对"""
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
        errors = validate_check_row(row, idx, store)
        if errors:
            result.skipped_rows.append({"row": idx, "data": dict(row), "errors": errors})
            result.errors.extend([f"第{idx}行: {e}" for e in errors])
            continue

        plan_id = str(row["plan_id"]).strip()
        existing_checks = store.get_checks_by_plan(plan_id)

        if existing_checks:
            latest = max(existing_checks, key=lambda c: c.created_at)
            result.warnings.append(f"第{idx}行: 计划 {plan_id} 已有核对记录 (ID: {latest.check_id}, 状态: {latest.overall_status.value})")
            result.skipped_rows.append({
                "row": idx,
                "data": dict(row),
                "errors": [f"计划 {plan_id} 已有核对记录，如需重新核对请先移除旧记录"]
            })
            continue

        try:
            seal_time = _parse_datetime(row["seal_start_time"])
            if not seal_time:
                raise ValueError(f"无效的封仓时间格式: {row['seal_start_time']}")

            check = run_check(
                plan_id=plan_id,
                temperature=float(row["temperature"]),
                humidity=float(row["humidity"]),
                seal_start_time=seal_time,
                seal_quality_score=float(row["seal_quality_score"]),
                store=store
            )

            row_result = {
                "row": idx,
                "plan_id": plan_id,
                "check_id": check.check_id,
                "barn_name": check.barn_name,
                "overall_status": check.overall_status.value
            }

            result.success_rows.append(row_result)
            result.processed_rows += 1

            if check.overall_status == CheckStatus.NEED_CONFIRM:
                need_items = [item for item in check.items if item.status == CheckStatus.NEED_CONFIRM]
                result.need_confirm_rows.append({
                    **row_result,
                    "need_confirm_items": [f"{i.check_description}: {i.message}" for i in need_items]
                })
            elif check.overall_status == CheckStatus.FAILED:
                fail_items = [item for item in check.items if item.status == CheckStatus.FAILED]
                result.failed_rows.append({
                    **row_result,
                    "failed_items": [f"{i.check_description}: {i.message}" for i in fail_items]
                })

        except Exception as e:
            result.failed_rows.append({"row": idx, "data": dict(row), "error": str(e)})
            result.errors.append(f"第{idx}行核对失败: {e}")

    _print_check_result(result)


@check.command("list")
@click.option("--data-dir", default="data", help="数据目录")
@click.option("--plan-id", help="按计划ID筛选")
@click.option("--status", type=click.Choice([s.value for s in CheckStatus]), help="按状态筛选")
@click.option("--output", type=click.Choice(["table", "json"]), default="table", help="输出格式")
def list_checks(data_dir, plan_id, status, output):
    """列出核对记录"""
    store = DataStore(data_dir)
    checks = store.get_all_checks()

    if plan_id:
        checks = [c for c in checks if c.plan_id == plan_id]
    if status:
        checks = [c for c in checks if c.overall_status.value == status]

    checks.sort(key=lambda c: c.created_at, reverse=True)

    if output == "json":
        output_data = []
        for c in checks:
            d = c.to_dict()
            d["items"] = [item.to_dict() for item in c.items]
            output_data.append(d)
        click.echo(json.dumps(output_data, ensure_ascii=False, indent=2))
    else:
        if not checks:
            click.echo("暂无核对记录")
            return
        headers = ["核对ID", "计划ID", "仓房", "温度", "湿度", "密封评分", "核对时间", "整体状态"]
        table_data = [[
            c.check_id,
            c.plan_id,
            c.barn_name,
            f"{c.temperature}°C",
            f"{c.humidity}%",
            c.seal_quality_score,
            c.created_at.strftime("%Y-%m-%d %H:%M"),
            c.overall_status.value
        ] for c in checks]
        click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))


@check.command("show")
@click.argument("check_id")
@click.option("--data-dir", default="data", help="数据目录")
def show_check(check_id, data_dir):
    """查看核对详情"""
    store = DataStore(data_dir)
    check = store.get_check(check_id)

    if not check:
        click.echo(f"核对记录 {check_id} 不存在")
        return

    plan = store.get_plan(check.plan_id)
    barn = store.get_barn(check.barn_id)

    click.echo("=" * 80)
    click.echo(f"熏蒸安全核对报告 - {check.check_id}")
    click.echo("=" * 80)
    click.echo("")
    click.echo("【基本信息】")
    click.echo(f"  计划ID: {check.plan_id}")
    click.echo(f"  仓房: {check.barn_id} - {check.barn_name}")
    click.echo(f"  核对时间: {check.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo(f"  整体结论: {check.overall_status.value}")
    click.echo("")
    click.echo("【环境参数】")
    click.echo(f"  仓内温度: {check.temperature} °C (推荐: {SAFE_TEMP_RANGE[0]}-{SAFE_TEMP_RANGE[1]} °C)")
    click.echo(f"  仓内湿度: {check.humidity} % (推荐: {SAFE_HUMIDITY_RANGE[0]}-{SAFE_HUMIDITY_RANGE[1]} %)")
    click.echo(f"  封仓开始时间: {check.seal_start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo(f"  密封质量评分: {check.seal_quality_score} 分 (推荐 >= {MIN_SEAL_QUALITY_SCORE} 分)")

    if plan:
        click.echo("")
        click.echo("【关联熏蒸计划】")
        click.echo(f"  计划日期: {plan.plan_date}")
        click.echo(f"  预计熏蒸时长: {plan.estimated_duration_hours} 小时")
        click.echo(f"  目标害虫: {plan.target_pests}")
        click.echo(f"  操作人员: {plan.operator}")

    click.echo("")
    click.echo("【核对项明细】")
    click.echo("-" * 80)

    items_by_type = {}
    for item in check.items:
        if item.check_type not in items_by_type:
            items_by_type[item.check_type] = []
        items_by_type[item.check_type].append(item)

    type_names = {
        "chemical": "药剂核对",
        "chemical_name": "药剂名称",
        "chemical_dosage": "药剂剂量",
        "chemical_expiration": "药剂有效期",
        "evacuation_list": "撤离清单",
        "evacuation_record": "撤离记录",
        "evacuation_timing": "撤离时序",
        "evacuation_duplicate": "撤离去重",
        "evacuation_count": "撤离统计",
        "temperature": "温度检查",
        "humidity": "湿度检查",
        "seal_quality": "密封质量",
        "seal_timing": "密封时序"
    }

    for item_type, items in items_by_type.items():
        click.echo(f"")
        click.echo(f"## {type_names.get(item_type, item_type)}")
        for item in items:
            status_mark = {
                CheckStatus.PASSED: "✓",
                CheckStatus.FAILED: "✗",
                CheckStatus.NEED_CONFIRM: "?",
                CheckStatus.SKIPPED: "-",
                CheckStatus.PENDING: " "
            }.get(item.status, " ")
            status_color = {
                CheckStatus.PASSED: "",
                CheckStatus.FAILED: "",
                CheckStatus.NEED_CONFIRM: "",
            }.get(item.status, "")
            click.echo(f"  {status_mark} [{item.status.value:8s}] {item.check_description}")
            if item.check_value:
                click.echo(f"      实际值: {item.check_value}")
            if item.expected_value and item.status != CheckStatus.PASSED:
                click.echo(f"      期望值: {item.expected_value}")
            click.echo(f"      说明: {item.message}")

    click.echo("")
    click.echo("=" * 80)


@check.command("dashboard")
@click.option("--data-dir", default="data", help="数据目录")
@click.option("--output", type=click.Choice(["console", "json"]), default="console", help="输出格式")
def dashboard(data_dir, output):
    """生成核对汇总看板"""
    store = DataStore(data_dir)
    barns = list(store.barns.values())
    plans = list(store.plans.values())
    checks = store.get_all_checks()

    status_counts = {s.value: 0 for s in CheckStatus}
    for c in checks:
        status_counts[c.overall_status.value] += 1

    plans_pending_check = [p for p in plans if p.status in [FumigationStatus.SUBMITTED, FumigationStatus.APPROVED]
                           and not store.get_checks_by_plan(p.plan_id)]

    dashboard_data = {
        "summary": {
            "total_barns": len(barns),
            "total_plans": len(plans),
            "total_checks": len(checks),
            "pending_checks": len(plans_pending_check)
        },
        "check_status": status_counts,
        "plans_pending": [{
            "plan_id": p.plan_id,
            "barn_id": p.barn_id,
            "plan_date": p.plan_date.isoformat(),
            "status": p.status.value
        } for p in plans_pending_check],
        "recent_checks": [{
            "check_id": c.check_id,
            "plan_id": c.plan_id,
            "barn_name": c.barn_name,
            "status": c.overall_status.value,
            "checked_at": c.created_at.isoformat()
        } for c in sorted(checks, key=lambda x: x.created_at, reverse=True)[:10]]
    }

    if output == "json":
        click.echo(json.dumps(dashboard_data, ensure_ascii=False, indent=2))
    else:
        click.echo("=" * 80)
        click.echo("                    粮仓熏蒸安全核对看板")
        click.echo("=" * 80)
        click.echo("")
        click.echo("【数据概览】")
        s = dashboard_data["summary"]
        click.echo(f"  仓房总数: {s['total_barns']}")
        click.echo(f"  熏蒸计划总数: {s['total_plans']}")
        click.echo(f"  已执行核对: {s['total_checks']}")
        click.echo(f"  待核对计划: {s['pending_checks']}")
        click.echo("")

        click.echo("【核对结果统计】")
        for status, count in dashboard_data["check_status"].items():
            if count > 0:
                click.echo(f"  {status}: {count} 条")
        click.echo("")

        if dashboard_data["plans_pending"]:
            click.echo("【待核对计划列表】")
            headers = ["计划ID", "仓房ID", "计划日期", "当前状态"]
            table_data = [[
                p["plan_id"],
                p["barn_id"],
                p["plan_date"],
                p["status"]
            ] for p in dashboard_data["plans_pending"]]
            click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))
            click.echo("")

        if dashboard_data["recent_checks"]:
            click.echo("【最近10条核对记录】")
            headers = ["核对ID", "计划ID", "仓房", "状态", "核对时间"]
            table_data = [[
                c["check_id"],
                c["plan_id"],
                c["barn_name"],
                c["status"],
                c["checked_at"][:16].replace("T", " ")
            ] for c in dashboard_data["recent_checks"]]
            click.echo(tabulate(table_data, headers=headers, tablefmt="simple"))

        click.echo("")
        click.echo("=" * 80)


def _print_check_result(result: ProcessResult):
    click.echo("=" * 80)
    click.echo("                    安全核对执行结果")
    click.echo("=" * 80)
    click.echo("")
    click.echo("【执行统计】")
    click.echo(f"  输入记录数: {result.total_rows}")
    click.echo(f"  成功处理: {result.processed_rows}")
    click.echo(f"  跳过记录: {len(result.skipped_rows)}")
    click.echo(f"  处理失败: {len(result.failed_rows)}")

    passed = len([r for r in result.success_rows if r.get("overall_status") == "通过"])
    need_confirm = len([r for r in result.success_rows if r.get("overall_status") == "需人工确认"])
    failed = len([r for r in result.success_rows if r.get("overall_status") == "不通过"])

    click.echo("")
    click.echo("【核对结论分布】")
    click.echo(f"  ✓ 通过: {passed} 条")
    click.echo(f"  ? 需人工确认: {need_confirm} 条")
    click.echo(f"  ✗ 不通过: {failed} 条")

    if result.success_rows:
        click.echo("")
        click.echo("【已生成核对记录】")
        for item in result.success_rows:
            status_emoji = {
                "通过": "✓",
                "需人工确认": "?",
                "不通过": "✗"
            }.get(item.get("overall_status", ""), " ")
            click.echo(f"  {status_emoji} [{item['check_id']}] 计划:{item['plan_id']} 仓房:{item['barn_name']} → {item['overall_status']}")

    if result.need_confirm_rows:
        click.echo("")
        click.echo("【需人工确认的记录】")
        click.echo("-" * 80)
        for item in result.need_confirm_rows:
            click.echo(f"\n  核对ID: {item['check_id']} | 计划: {item['plan_id']} | 仓房: {item['barn_name']}")
            click.echo(f"  需确认项:")
            for msg in item.get("need_confirm_items", [])[:5]:
                click.echo(f"    - {msg}")
            if len(item.get("need_confirm_items", [])) > 5:
                click.echo(f"    ... 还有 {len(item['need_confirm_items']) - 5} 项")

    if result.skipped_rows:
        click.echo("")
        click.echo("【跳过的记录】")
        click.echo("-" * 80)
        for item in result.skipped_rows:
            errors = ", ".join(item["errors"])
            row_data = item["data"]
            ident = row_data.get("plan_id") or f"第{item['row']}行"
            click.echo(f"  {ident}: {errors}")

    if result.warnings:
        click.echo("")
        click.echo("【警告】")
        for w in result.warnings:
            click.echo(f"  ! {w}")

    if result.errors:
        click.echo("")
        click.echo("【错误】")
        for e in result.errors:
            click.echo(f"  x {e}")

    click.echo("")
    click.echo("=" * 80)
