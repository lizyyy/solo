"""
CLI 入口模块 - 96孔板稀释排版管家命令行界面
"""

import csv
import sys
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any

import click

from . import __version__
from .config import (
    ProjectConfig, DEFAULT_CONFIG, load_config, save_config,
    is_initialized, get_config_path, get_ledger_path, get_samples_path, get_plans_path
)
from .models import Sample, SampleStatus, PlatePlan
from .dilution import DilutionCalculator, DilutionError
from .plate_layout import PlateLayout, LayoutError
from .storage import StorageManager
from .exporter import PlateExporter


@click.group()
@click.version_option(version=__version__, prog_name="plate-planner")
@click.pass_context
def main(ctx: click.Context):
    """
    96孔板稀释排版管家 - 生物实验室样品稀释和孔板排布工具

    用于 qPCR、酶标实验前的样品稀释计算和96孔板排布。
    """
    ctx.ensure_object(dict)
    ctx.obj["work_dir"] = Path.cwd()


@main.command()
@click.pass_context
def init(ctx: click.Context):
    """
    初始化项目配置

    创建 .plate_planner 目录并初始化默认配置。
    """
    work_dir = ctx.obj["work_dir"]

    if is_initialized(work_dir):
        click.echo("项目已初始化，配置位置:")
        click.echo(f"  配置文件: {get_config_path(work_dir)}")
        click.echo(f"  样品数据: {get_samples_path(work_dir)}")
        click.echo(f"  账本记录: {get_ledger_path(work_dir)}")
        click.echo(f"  方案历史: {get_plans_path(work_dir)}")
        return

    config = DEFAULT_CONFIG
    save_config(config, work_dir)

    storage = StorageManager(work_dir)
    storage._save_samples()
    storage._save_ledger()
    storage._save_plan_history()

    click.echo("项目初始化完成!")
    click.echo("")
    click.echo("默认配置:")
    click.echo(f"  最小移液体积: {config.pipette.min_volume_ul} ul")
    click.echo(f"  最大移液体积: {config.pipette.max_volume_ul} ul")
    click.echo(f"  死体积: {config.pipette.dead_volume_ul} ul")
    click.echo(f"  默认浓度单位: {config.default_concentration_unit}")
    click.echo("")
    click.echo("默认保留孔位:")
    for rw in config.reserved_wells:
        click.echo(f"  {rw.well}: {rw.purpose}")


@main.command("import-samples")
@click.argument("csv_path", type=click.Path(exists=True, dir_okay=False))
@click.option("--skip-duplicates/--no-skip-duplicates", default=True,
              help="跳过重复的样品编号 (默认: 跳过)")
@click.pass_context
def import_samples(ctx: click.Context, csv_path: str, skip_duplicates: bool):
    """
    导入样品CSV文件

    CSV字段:
    - sample_id: 样品编号 (必填)
    - batch: 批次 (必填)
    - initial_concentration: 初始浓度 (必填, 数值)
    - concentration_unit: 浓度单位 (必填, 如: ng/ul, pg/ul, uM, nM)
    - available_volume: 可用体积 (必填, 数值, ul)
    - target_concentration: 目标浓度 (必填, 数值)
    - target_concentration_unit: 目标浓度单位 (可选, 默认与initial相同)
    - replicate_count: 重复孔数 (可选, 默认: 1)
    - remark: 备注 (可选)
    - molecular_weight: 分子量 (可选, g/mol, 用于摩尔浓度转换)
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    samples: List[Sample] = []
    line_num = 0

    try:
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                line_num += 1
                try:
                    sample = _parse_sample_row(row, line_num)
                    samples.append(sample)
                except ValueError as e:
                    click.echo(f"警告: 第 {line_num} 行解析失败: {e}")
                    continue
    except Exception as e:
        click.echo(f"错误: 读取CSV文件失败: {e}", err=True)
        sys.exit(1)

    if not samples:
        click.echo("错误: 没有成功解析任何样品", err=True)
        sys.exit(1)

    storage = StorageManager(work_dir)
    added, skipped = storage.add_samples(samples, check_duplicates=skip_duplicates)

    click.echo(f"导入完成:")
    click.echo(f"  成功添加: {len(added)} 个样品")
    if skipped:
        click.echo(f"  跳过重复: {len(skipped)} 个样品")


def _parse_sample_row(row: Dict[str, str], line_num: int) -> Sample:
    required_fields = [
        "sample_id", "batch", "initial_concentration",
        "concentration_unit", "available_volume", "target_concentration"
    ]

    for field in required_fields:
        if field not in row or not row[field].strip():
            raise ValueError(f"缺少必填字段: {field}")

    try:
        initial_conc = float(row["initial_concentration"].strip())
        available_vol = float(row["available_volume"].strip())
        target_conc = float(row["target_concentration"].strip())
    except ValueError as e:
        raise ValueError(f"数值解析失败: {e}")

    replicate_count = 1
    if "replicate_count" in row and row["replicate_count"].strip():
        try:
            replicate_count = int(row["replicate_count"].strip())
        except ValueError:
            pass

    molecular_weight = None
    if "molecular_weight" in row and row["molecular_weight"].strip():
        try:
            molecular_weight = float(row["molecular_weight"].strip())
        except ValueError:
            pass

    return Sample(
        sample_id=row["sample_id"].strip(),
        batch=row["batch"].strip(),
        initial_concentration=initial_conc,
        concentration_unit=row["concentration_unit"].strip(),
        available_volume=available_vol,
        target_concentration=target_conc,
        target_concentration_unit=row.get("target_concentration_unit", "").strip() or None,
        replicate_count=replicate_count,
        remark=row.get("remark", "").strip() or None,
        molecular_weight=molecular_weight,
    )


@main.command()
@click.option("--volume-per-well", "-v", type=float, default=20.0,
              help="每孔体积 (ul, 默认: 20.0)")
@click.option("--batch", "-b", type=str, default=None,
              help="指定批次 (默认: 所有可用样品)")
@click.pass_context
def plan(ctx: click.Context, volume_per_well: float, batch: Optional[str]):
    """
    计算稀释步骤和孔位排布

    自动处理单位换算，验证移液体积范围，检查孔位是否足够。
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    config = load_config(work_dir)
    storage = StorageManager(work_dir)

    all_samples = storage.get_samples()

    if batch:
        samples = [s for s in all_samples if s.batch == batch]
        if not samples:
            click.echo(f"错误: 没有找到批次为 '{batch}' 的样品", err=True)
            sys.exit(1)
    else:
        samples = [s for s in all_samples if s.status == SampleStatus.AVAILABLE]
        if not samples:
            click.echo("错误: 没有可用的样品 (状态为 available)", err=True)
            sys.exit(1)

    click.echo(f"处理 {len(samples)} 个样品...")
    click.echo("")

    dil_calc = DilutionCalculator(config.pipette)
    plate_layout = PlateLayout(config.plate, config.reserved_wells)

    all_errors: List[str] = []
    dilution_steps_map: Dict[str, Any] = {}
    valid_samples: List[Sample] = []

    for sample in samples:
        steps, errors = dil_calc.calculate_dilution_steps(
            sample, final_volume_per_well_ul=volume_per_well
        )
        if errors:
            for err in errors:
                all_errors.append(f"[{sample.sample_id}] {err.message}")
            continue

        if steps:
            dilution_steps_map[sample.sample_id] = steps
        valid_samples.append(sample)

    if all_errors:
        click.echo("错误: 发现以下问题:")
        for err in all_errors:
            click.echo(f"  - {err}")
        sys.exit(1)

    total_wells_needed = sum(s.replicate_count for s in valid_samples)
    available_wells = plate_layout.get_total_available_wells()

    if total_wells_needed > available_wells:
        click.echo(
            f"错误: 孔位不足。需要 {total_wells_needed} 个孔，"
            f"但只有 {available_wells} 个可用孔",
            err=True
        )
        sys.exit(1)

    all_assignments = []
    for sample in valid_samples:
        target_unit = sample.target_concentration_unit or sample.concentration_unit
        assignments, errors = plate_layout.assign_sample_replicates(
            sample,
            target_concentration=sample.target_concentration,
            target_unit=target_unit,
            volume_ul=volume_per_well,
        )
        if errors:
            for err in errors:
                all_errors.append(f"[{sample.sample_id}] {err.message}")
            continue
        all_assignments.extend(assignments)

    if all_errors:
        click.echo("错误: 孔位分配失败:")
        for err in all_errors:
            click.echo(f"  - {err}")
        sys.exit(1)

    plate_number = storage.get_next_plate_number()
    plan_id = str(uuid.uuid4())[:8]

    dilution_steps_serialized = {
        sample_id: [s.model_dump() for s in steps]
        for sample_id, steps in dilution_steps_map.items()
    }

    plate_plan = PlatePlan(
        plan_id=plan_id,
        plate_number=plate_number,
        samples=[s.sample_id for s in valid_samples],
        dilution_steps=dilution_steps_serialized,
        well_assignments=all_assignments,
        reserved_wells=plate_layout.get_reserved_wells_info(),
        total_wells_used=len(all_assignments),
        total_wells_available=available_wells,
    )

    storage.save_plan(plate_plan)

    _display_plan_summary(plate_plan, dilution_steps_map, valid_samples, config)

    click.echo("")
    click.echo(f"方案已保存，方案ID: {plan_id}")
    click.echo("")
    click.echo("使用 'plate-planner apply' 确认方案并扣减样品体积")
    click.echo("使用 'plate-planner export-plate' 导出板图和操作单")


def _display_plan_summary(
    plan: PlatePlan,
    dilution_steps: Dict,
    samples: List[Sample],
    config: ProjectConfig,
):
    sample_map = {s.sample_id: s for s in samples}

    click.echo(f"===== 方案摘要 =====")
    click.echo(f"板号: #{plan.plate_number}")
    click.echo(f"样品数: {len(plan.samples)}")
    click.echo(f"使用孔位: {plan.total_wells_used} / {plan.total_wells_available}")
    click.echo("")

    click.echo("--- 板布局 ---")
    click.echo("")
    well_matrix = _build_well_matrix(plan, config)

    header = "   " + " ".join(f"{c:6}" for c in range(1, 13))
    click.echo(header)
    click.echo("   " + "-" * 71)

    row_labels = config.plate.row_labels
    for r_idx, row_label in enumerate(row_labels):
        row_str = f"{row_label}: "
        for c_idx in range(12):
            cell = well_matrix.get((r_idx, c_idx), "")
            if len(cell) > 5:
                cell = cell[:5]
            row_str += f"{cell:6}"
        click.echo(row_str)

    click.echo("")
    click.echo("--- 样品稀释步骤 ---")
    click.echo("")

    for sample_id in plan.samples:
        sample = sample_map.get(sample_id)
        steps = dilution_steps.get(sample_id, [])

        click.echo(f"样品 {sample_id}:")
        if sample:
            click.echo(
                f"  初始: {sample.initial_concentration} {sample.concentration_unit} "
                f"-> 目标: {sample.target_concentration} {sample.target_concentration_unit or sample.concentration_unit}"
            )
            click.echo(f"  重复孔数: {sample.replicate_count}")

        if steps:
            for step in steps:
                click.echo(
                    f"    步骤 {step.step_number}: "
                    f"{step.source_concentration:.2f} -> {step.target_concentration:.2f} {step.unit} "
                    f"(稀释 {step.dilution_factor:.0f}x)"
                )
                click.echo(
                    f"      取 {step.sample_volume_ul:.2f} ul 样品 + "
                    f"{step.diluent_volume_ul:.2f} ul 稀释液 = "
                    f"{step.total_volume_ul:.2f} ul"
                )
        else:
            click.echo("    无需稀释")
        click.echo("")


def _build_well_matrix(plan: PlatePlan, config: ProjectConfig) -> Dict:
    matrix: Dict = {}

    for rw in plan.reserved_wells:
        row_char = rw["well"][0]
        col = int(rw["well"][1:]) - 1
        row = config.plate.row_labels.index(row_char)
        matrix[(row, col)] = f"[{rw['purpose'][:4]}]"

    for wa in plan.well_assignments:
        matrix[(wa.row, wa.col)] = wa.sample_id

    return matrix


@main.command()
@click.argument("plan_id", type=str)
@click.option("--remarks", "-r", type=str, default=None,
              help="备注信息")
@click.pass_context
def apply(ctx: click.Context, plan_id: str, remarks: Optional[str]):
    """
    确认方案并扣减样品体积

    写入 ledger.json，记录板号、孔位、稀释倍数和操作时间。
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    storage = StorageManager(work_dir)
    plan = storage.get_plan(plan_id)

    if not plan:
        click.echo(f"错误: 未找到方案 ID: {plan_id}", err=True)
        sys.exit(1)

    config = load_config(work_dir)
    dil_calc = DilutionCalculator(config.pipette)

    volume_used: Dict[str, float] = {}
    for sample_id in plan.samples:
        sample = storage.get_sample(sample_id)
        if not sample:
            click.echo(f"错误: 样品 {sample_id} 不存在", err=True)
            sys.exit(1)

        steps = plan.dilution_steps.get(sample_id, [])
        if steps:
            first_step = steps[0] if isinstance(steps[0], dict) else steps[0].model_dump()
            sample_vol = first_step.get("sample_volume_ul", 0)
            volume_used[sample_id] = sample_vol + config.pipette.dead_volume_ul
        else:
            volume_used[sample_id] = config.pipette.dead_volume_ul

    click.echo(f"确认应用方案 #{plan.plate_number} (ID: {plan_id})")
    click.echo("")
    click.echo("样品体积扣减:")
    for sample_id, vol in volume_used.items():
        sample = storage.get_sample(sample_id)
        if sample:
            new_vol = sample.available_volume - vol
            click.echo(
                f"  {sample_id}: {sample.available_volume:.2f} ul -> {new_vol:.2f} ul "
                f"(扣减 {vol:.2f} ul, 含死体积)"
            )
    click.echo("")

    confirm = click.confirm("确认继续?")
    if not confirm:
        click.echo("已取消")
        return

    entry = storage.apply_plan(plan, volume_used, remarks)

    click.echo("")
    click.echo("方案已应用!")
    click.echo(f"  记录ID: {entry.entry_id}")
    click.echo(f"  时间: {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")


@main.command()
@click.pass_context
def undo(ctx: click.Context):
    """
    撤销最近一次 apply 操作

    恢复被扣减的样品体积。
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    storage = StorageManager(work_dir)

    success, last_entry = storage.undo_last_apply()

    if not success:
        click.echo("没有可撤销的 apply 操作")
        return

    click.echo("已撤销最近的 apply 操作:")
    click.echo(f"  板号: #{last_entry.plate_number}")
    click.echo(f"  方案ID: {last_entry.plan_id}")
    click.echo(f"  原操作时间: {last_entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("")
    click.echo("样品体积已恢复:")
    for change in last_entry.sample_changes:
        click.echo(
            f"  {change['sample_id']}: {change['new_volume_ul']:.2f} ul "
            f"-> {change['old_volume_ul']:.2f} ul"
        )


@main.command("export-plate")
@click.argument("plan_id", type=str)
@click.option("--output-dir", "-o", type=click.Path(file_okay=False), default=".",
              help="输出目录 (默认: 当前目录)")
@click.option("--prefix", "-p", type=str, default=None,
              help="文件名前缀 (默认: plate_板号)")
@click.pass_context
def export_plate(ctx: click.Context, plan_id: str, output_dir: str, prefix: Optional[str]):
    """
    导出96孔板CSV和Markdown操作单

    生成两个文件:
    - *.csv: 96孔板布局矩阵
    - *.md: 完整操作单，包含稀释步骤和孔位详情
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    storage = StorageManager(work_dir)
    plan = storage.get_plan(plan_id)

    if not plan:
        click.echo(f"错误: 未找到方案 ID: {plan_id}", err=True)
        sys.exit(1)

    config = load_config(work_dir)
    exporter = PlateExporter(config.plate)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    file_prefix = prefix or f"plate_{plan.plate_number:03d}"

    csv_path = output_path / f"{file_prefix}.csv"
    exporter.export_csv(plan, csv_path)

    samples_info = {}
    for sample_id in plan.samples:
        sample = storage.get_sample(sample_id)
        if sample:
            samples_info[sample_id] = sample.model_dump()

    md_path = output_path / f"{file_prefix}.md"
    exporter.export_markdown(plan, samples_info, md_path)

    click.echo("导出完成:")
    click.echo(f"  CSV: {csv_path}")
    click.echo(f"  Markdown: {md_path}")


@main.command()
@click.option("--batch", "-b", type=str, default=None,
              help="按批次筛选")
@click.option("--start-date", "-s", type=str, default=None,
              help="开始日期 (格式: YYYY-MM-DD)")
@click.option("--end-date", "-e", type=str, default=None,
              help="结束日期 (格式: YYYY-MM-DD)")
@click.option("--verbose", "-v", is_flag=True, default=False,
              help="显示详细信息")
@click.pass_context
def history(ctx: click.Context, batch: Optional[str], start_date: Optional[str],
            end_date: Optional[str], verbose: bool):
    """
    查询历史方案记录

    可按批次或日期范围筛选。
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    storage = StorageManager(work_dir)

    start_dt: Optional[date] = None
    end_dt: Optional[date] = None

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            click.echo(f"错误: 无效的开始日期格式: {start_date}，应为 YYYY-MM-DD", err=True)
            sys.exit(1)

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            click.echo(f"错误: 无效的结束日期格式: {end_date}，应为 YYYY-MM-DD", err=True)
            sys.exit(1)

    entries = storage.get_history(batch=batch, start_date=start_dt, end_date=end_dt)

    if not entries:
        click.echo("没有找到历史记录")
        return

    click.echo(f"找到 {len(entries)} 条记录:")
    click.echo("")

    for entry in entries:
        if entry.plate_number:
            click.echo(f"板号 #{entry.plate_number}:")
        else:
            click.echo(f"记录 {entry.entry_id[:8]}:")

        click.echo(f"  操作: {entry.action}")
        if entry.timestamp:
            click.echo(f"  时间: {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        if entry.plan_id:
            click.echo(f"  方案ID: {entry.plan_id}")

        if verbose and entry.sample_changes:
            click.echo("  样品变更:")
            for change in entry.sample_changes:
                click.echo(
                    f"    {change['sample_id']}: "
                    f"{change['old_volume_ul']:.2f} ul -> {change['new_volume_ul']:.2f} ul"
                )

        if entry.remarks:
            click.echo(f"  备注: {entry.remarks}")
        click.echo("")


@main.command("list-samples")
@click.option("--batch", "-b", type=str, default=None,
              help="按批次筛选")
@click.option("--status", "-s", type=click.Choice(["all", "available", "used", "depleted"]),
              default="all", help="按状态筛选 (默认: all)")
@click.pass_context
def list_samples(ctx: click.Context, batch: Optional[str], status: str):
    """
    列出已导入的样品
    """
    work_dir = ctx.obj["work_dir"]

    if not is_initialized(work_dir):
        click.echo("错误: 项目未初始化，请先运行 'plate-planner init'", err=True)
        sys.exit(1)

    storage = StorageManager(work_dir)
    samples = storage.get_samples()

    if batch:
        samples = [s for s in samples if s.batch == batch]

    if status != "all":
        status_map = {
            "available": SampleStatus.AVAILABLE,
            "used": SampleStatus.USED,
            "depleted": SampleStatus.DEPLETED,
        }
        target_status = status_map[status]
        samples = [s for s in samples if s.status == target_status]

    if not samples:
        click.echo("没有找到样品")
        return

    click.echo(f"共 {len(samples)} 个样品:")
    click.echo("")

    for sample in samples:
        click.echo(f"{sample.sample_id}:")
        click.echo(f"  批次: {sample.batch}")
        click.echo(f"  状态: {sample.status.value}")
        click.echo(
            f"  浓度: {sample.initial_concentration} {sample.concentration_unit} "
            f"-> {sample.target_concentration} {sample.target_concentration_unit or sample.concentration_unit}"
        )
        click.echo(f"  可用体积: {sample.available_volume} ul")
        click.echo(f"  重复孔数: {sample.replicate_count}")
        if sample.remark:
            click.echo(f"  备注: {sample.remark}")
        click.echo("")


if __name__ == "__main__":
    main()
