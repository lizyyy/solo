"""蜂箱巡检批次追溯员 CLI 主程序"""

import sys
from pathlib import Path
from typing import Optional

import click

from .__init__ import __version__
from .config import ConfigManager
from .store import DataStore, QuarantineRecord
from .csv_parser import (
    InspectionCSVParser, TreatmentCSVParser, HarvestCSVParser,
    ParseResult
)
from .validator import (
    BatchValidator, ValidationError, create_quarantine_record
)
from .planner import PlanGenerator, format_plan_for_display
from .reporter import Reporter


DATA_DIR_NAME = ".beekeeper_data"


def get_config_manager() -> ConfigManager:
    """获取配置管理器"""
    return ConfigManager()


def get_data_store() -> DataStore:
    """获取数据存储"""
    store_dir = Path.cwd() / DATA_DIR_NAME
    return DataStore(store_dir)


def ensure_initialized() -> tuple:
    """确保已初始化，返回 (config, data_store)"""
    cm = get_config_manager()
    if not cm.config_exists():
        click.echo("错误: 配置文件不存在，请先运行 'beekeeper init' 初始化", err=True)
        sys.exit(1)
    
    config = cm.load_config()
    data_store = get_data_store()
    data_store.initialize()
    
    return config, data_store


@click.group()
@click.version_option(__version__, '-v', '--version')
def cli():
    """蜂箱巡检批次追溯员 - 给流动蜂场养蜂人用的本地命令行工具
    
    用于管理蜂箱巡检、用药、摇蜜记录，支持规则校验和计划生成。
    """
    pass


@cli.command()
@click.option('--force', '-f', is_flag=True, help='强制重新初始化')
def init(force: bool):
    """初始化配置文件和数据目录
    
    创建 beekeeper.json 配置文件和 .beekeeper_data 数据目录。
    """
    cm = get_config_manager()
    
    if cm.config_exists() and not force:
        click.echo("配置已存在，使用 --force 强制重新初始化")
        sys.exit(0)
    
    config = cm.init_config()
    
    data_store = get_data_store()
    data_store.initialize()
    
    click.echo("✅ 初始化成功")
    click.echo(f"   配置文件: {cm.config_path}")
    click.echo(f"   数据目录: {data_store.store_dir}")


@cli.group()
def config():
    """配置管理命令"""
    pass


@config.command('list')
def config_list():
    """显示当前配置"""
    config, _ = ensure_initialized()
    
    click.echo("=" * 60)
    click.echo("蜂场配置")
    click.echo("=" * 60)
    
    if config.apiaries:
        for apiary in config.apiaries:
            click.echo(f"\n🐝 蜂场: {apiary.name}")
            if apiary.location:
                click.echo(f"   位置: {apiary.location}")
            if apiary.notes:
                click.echo(f"   备注: {apiary.notes}")
    else:
        click.echo("\n   暂无蜂场配置")
    
    click.echo("\n" + "=" * 60)
    click.echo("蜂箱配置")
    click.echo("=" * 60)
    
    if config.hives:
        for hive in config.hives:
            click.echo(f"\n📦 箱号: {hive.hive_number}")
            click.echo(f"   蜂场: {hive.apiary}")
            click.echo(f"   蜂王年份: {hive.queen_year}")
            if hive.notes:
                click.echo(f"   备注: {hive.notes}")
    else:
        click.echo("\n   暂无蜂箱配置")
    
    click.echo("\n" + "=" * 60)
    click.echo("药物配置")
    click.echo("=" * 60)
    
    if config.drugs:
        for drug in config.drugs:
            click.echo(f"\n💊 药物: {drug.name}")
            click.echo(f"   安全间隔: {drug.safety_interval_days} 天")
            if drug.description:
                click.echo(f"   描述: {drug.description}")
    else:
        click.echo("\n   暂无药物配置")
    
    click.echo("\n" + "=" * 60)
    click.echo(f"输出目录: {config.output_dir}")
    click.echo(f"含水率阈值: {config.moisture_threshold}%")
    click.echo(f"默认巡检间隔: {config.default_inspection_interval_days} 天")
    click.echo("=" * 60)


@config.command('add-apiary')
@click.argument('name')
@click.option('--location', '-l', help='蜂场位置')
@click.option('--notes', '-n', help='备注')
def config_add_apiary(name: str, location: Optional[str], notes: Optional[str]):
    """添加蜂场
    
    NAME: 蜂场名称
    """
    cm = get_config_manager()
    config = cm.load_config()
    
    try:
        config.add_apiary(name, location, notes)
        cm.save_config()
        click.echo(f"✅ 已添加蜂场: {name}")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(1)


@config.command('add-hive')
@click.argument('hive_number')
@click.option('--apiary', '-a', required=True, help='所属蜂场')
@click.option('--queen-year', '-q', type=int, required=True, help='蜂王年份')
@click.option('--notes', '-n', help='备注')
def config_add_hive(hive_number: str, apiary: str, queen_year: int, notes: Optional[str]):
    """添加蜂箱
    
    HIVE_NUMBER: 蜂箱编号
    """
    cm = get_config_manager()
    config = cm.load_config()
    
    try:
        config.add_hive(hive_number, apiary, queen_year, notes)
        cm.save_config()
        click.echo(f"✅ 已添加蜂箱: {hive_number} (蜂场: {apiary})")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(1)


@config.command('add-drug')
@click.argument('name')
@click.option('--interval', '-i', type=int, required=True, help='安全间隔天数')
@click.option('--description', '-d', help='药物描述')
def config_add_drug(name: str, interval: int, description: Optional[str]):
    """添加药物配置
    
    NAME: 药物名称
    """
    cm = get_config_manager()
    config = cm.load_config()
    
    try:
        config.add_drug(name, interval, description)
        cm.save_config()
        click.echo(f"✅ 已添加药物: {name} (安全间隔: {interval} 天)")
    except ValueError as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(1)


@cli.command('import-inspection')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--skip-date-check', is_flag=True, help='跳过日期顺序检查')
def import_inspection(csv_file: str, skip_date_check: bool):
    """导入巡检记录 CSV
    
    CSV_FILE: 巡检记录 CSV 文件路径
    
    CSV 必需字段: date, hive_number
    可选字段: colony_strength, queen_status, pests_diseases, feeding, notes
    """
    config, data_store = ensure_initialized()
    
    click.echo(f"📂 解析巡检记录: {csv_file}")
    
    parser = InspectionCSVParser()
    try:
        result: ParseResult = parser.parse(Path(csv_file))
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        sys.exit(1)
    
    click.echo(f"   解析: {result.total_rows} 行, 有效 {len(result.valid_records)} 条")
    
    if result.invalid_rows:
        click.echo(f"   ⚠️  解析失败 {len(result.invalid_rows)} 行, 将移入隔离区")
        for bad_row in result.invalid_rows:
            q_record = create_quarantine_record(
                original_data=bad_row["row_data"],
                error_message=f"解析错误: {bad_row['error']}",
                record_type="inspection",
                import_source=csv_file
            )
            data_store.add_quarantine(q_record)
    
    if not result.valid_records:
        click.echo("❌ 没有有效记录可导入")
        sys.exit(0)
    
    validator = BatchValidator(config, data_store)
    valid_records, errors = validator.validate_inspections(
        result.valid_records,
        check_date_order=not skip_date_check
    )
    
    if errors:
        click.echo(f"   ⚠️  校验发现 {len(errors)} 个问题")
        for err in errors:
            if err.severity == "error":
                click.echo(f"      ❌ {err.error_code}: {err.error_message}")
                q_record = create_quarantine_record(
                    original_data=err.record_data,
                    error_message=f"{err.error_code}: {err.error_message}",
                    record_type="inspection",
                    import_source=csv_file
                )
                data_store.add_quarantine(q_record)
            else:
                click.echo(f"      ⚠️  {err.error_code}: {err.error_message}")
    
    imported_count = 0
    for record in valid_records:
        try:
            record.import_source = csv_file
            data_store.add_inspection(record)
            imported_count += 1
        except ValueError as e:
            q_record = create_quarantine_record(
                original_data=record.to_dict(),
                error_message=str(e),
                record_type="inspection",
                import_source=csv_file
            )
            data_store.add_quarantine(q_record)
    
    click.echo(f"\n✅ 导入完成: 成功 {imported_count} 条")
    quarantine_count = data_store.count_quarantine()
    if quarantine_count > 0:
        click.echo(f"   ⚠️  隔离区: {quarantine_count} 条记录 (查看 quarantine.json)")


@cli.command('import-treatment')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--skip-date-check', is_flag=True, help='跳过日期顺序检查')
def import_treatment(csv_file: str, skip_date_check: bool):
    """导入用药/饲喂记录 CSV
    
    CSV_FILE: 用药记录 CSV 文件路径
    
    CSV 必需字段: date, hive_number, treatment_type, product_name
    可选字段: dosage, notes
    
    treatment_type: 用药 或 饲喂
    """
    config, data_store = ensure_initialized()
    
    click.echo(f"📂 解析用药记录: {csv_file}")
    
    parser = TreatmentCSVParser()
    try:
        result: ParseResult = parser.parse(Path(csv_file))
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        sys.exit(1)
    
    click.echo(f"   解析: {result.total_rows} 行, 有效 {len(result.valid_records)} 条")
    
    if result.invalid_rows:
        click.echo(f"   ⚠️  解析失败 {len(result.invalid_rows)} 行, 将移入隔离区")
        for bad_row in result.invalid_rows:
            q_record = create_quarantine_record(
                original_data=bad_row["row_data"],
                error_message=f"解析错误: {bad_row['error']}",
                record_type="treatment",
                import_source=csv_file
            )
            data_store.add_quarantine(q_record)
    
    if not result.valid_records:
        click.echo("❌ 没有有效记录可导入")
        sys.exit(0)
    
    validator = BatchValidator(config, data_store)
    valid_records, errors = validator.validate_treatments(
        result.valid_records,
        check_date_order=not skip_date_check
    )
    
    if errors:
        click.echo(f"   ⚠️  校验发现 {len(errors)} 个问题")
        for err in errors:
            if err.severity == "error":
                click.echo(f"      ❌ {err.error_code}: {err.error_message}")
                q_record = create_quarantine_record(
                    original_data=err.record_data,
                    error_message=f"{err.error_code}: {err.error_message}",
                    record_type="treatment",
                    import_source=csv_file
                )
                data_store.add_quarantine(q_record)
            else:
                click.echo(f"      ⚠️  {err.error_code}: {err.error_message}")
    
    imported_count = 0
    for record in valid_records:
        try:
            record.import_source = csv_file
            data_store.add_treatment(record)
            imported_count += 1
        except ValueError as e:
            q_record = create_quarantine_record(
                original_data=record.to_dict(),
                error_message=str(e),
                record_type="treatment",
                import_source=csv_file
            )
            data_store.add_quarantine(q_record)
    
    click.echo(f"\n✅ 导入完成: 成功 {imported_count} 条")
    quarantine_count = data_store.count_quarantine()
    if quarantine_count > 0:
        click.echo(f"   ⚠️  隔离区: {quarantine_count} 条记录 (查看 quarantine.json)")


@cli.command('import-harvest')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--skip-date-check', is_flag=True, help='跳过日期顺序检查')
@click.option('--skip-batch-check', is_flag=True, help='跳过敏批次含水率检查')
def import_harvest(csv_file: str, skip_date_check: bool, skip_batch_check: bool):
    """导入摇蜜记录 CSV
    
    CSV_FILE: 摇蜜记录 CSV 文件路径
    
    CSV 必需字段: date, hive_number, batch_number
    可选字段: quantity_kg, moisture_content, notes
    """
    config, data_store = ensure_initialized()
    
    click.echo(f"📂 解析摇蜜记录: {csv_file}")
    
    parser = HarvestCSVParser()
    try:
        result: ParseResult = parser.parse(Path(csv_file))
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        sys.exit(1)
    
    click.echo(f"   解析: {result.total_rows} 行, 有效 {len(result.valid_records)} 条")
    
    if result.invalid_rows:
        click.echo(f"   ⚠️  解析失败 {len(result.invalid_rows)} 行, 将移入隔离区")
        for bad_row in result.invalid_rows:
            q_record = create_quarantine_record(
                original_data=bad_row["row_data"],
                error_message=f"解析错误: {bad_row['error']}",
                record_type="harvest",
                import_source=csv_file
            )
            data_store.add_quarantine(q_record)
    
    if not result.valid_records:
        click.echo("❌ 没有有效记录可导入")
        sys.exit(0)
    
    validator = BatchValidator(config, data_store)
    valid_records, errors = validator.validate_harvests(
        result.valid_records,
        check_date_order=not skip_date_check,
        check_batch_moisture=not skip_batch_check
    )
    
    if errors:
        click.echo(f"   ⚠️  校验发现 {len(errors)} 个问题")
        for err in errors:
            if err.severity == "error":
                click.echo(f"      ❌ {err.error_code}: {err.error_message}")
                q_record = create_quarantine_record(
                    original_data=err.record_data,
                    error_message=f"{err.error_code}: {err.error_message}",
                    record_type="harvest",
                    import_source=csv_file
                )
                data_store.add_quarantine(q_record)
            else:
                click.echo(f"      ⚠️  {err.error_code}: {err.error_message}")
    
    imported_count = 0
    for record in valid_records:
        try:
            record.import_source = csv_file
            data_store.add_harvest(record)
            imported_count += 1
        except ValueError as e:
            q_record = create_quarantine_record(
                original_data=record.to_dict(),
                error_message=str(e),
                record_type="harvest",
                import_source=csv_file
            )
            data_store.add_quarantine(q_record)
    
    click.echo(f"\n✅ 导入完成: 成功 {imported_count} 条")
    quarantine_count = data_store.count_quarantine()
    if quarantine_count > 0:
        click.echo(f"   ⚠️  隔离区: {quarantine_count} 条记录 (查看 quarantine.json)")


@cli.command('plan')
def plan():
    """生成下一轮巡检和禁采蜜提醒
    
    分析所有蜂箱状态，生成：
    - 巡检提醒列表（按优先级排序）
    - 禁采蜜提醒（药物安全间隔）
    - 风险蜂箱清单
    """
    config, data_store = ensure_initialized()
    
    generator = PlanGenerator(config, data_store)
    plan_result = generator.generate_plan()
    
    click.echo(format_plan_for_display(plan_result))


@cli.command('report')
@click.option('--output-dir', '-o', type=click.Path(file_okay=False), help='输出目录')
def report(output_dir: Optional[str]):
    """导出复盘报告
    
    生成三种报告：
    - Markdown 复盘报告（含统计、计划、近期记录）
    - CSV 风险箱清单
    - JSON 审计包（完整数据导出）
    """
    config, data_store = ensure_initialized()
    
    out_dir = Path(output_dir) if output_dir else Path(config.output_dir)
    reporter = Reporter(config, data_store, out_dir)
    
    click.echo("📊 生成报告中...")
    
    result = reporter.generate_all_reports()
    
    click.echo("\n✅ 报告生成完成:")
    if result.markdown_path:
        click.echo(f"   📝 Markdown 报告: {result.markdown_path}")
    if result.csv_risk_path:
        click.echo(f"   📋 风险箱 CSV: {result.csv_risk_path}")
    if result.json_audit_path:
        click.echo(f"   📦 JSON 审计包: {result.json_audit_path}")


@cli.command('history')
@click.option('--apiary', '-a', help='按蜂场筛选')
@click.option('--hive', '-h', 'hive_number', help='按箱号筛选')
@click.option('--batch', '-b', 'batch_number', help='按批次号筛选（摇蜜记录）')
@click.option('--json', '-j', 'output_json', is_flag=True, help='输出 JSON 格式')
def history(apiary: Optional[str], hive_number: Optional[str], 
            batch_number: Optional[str], output_json: bool):
    """查询历史记录
    
    可按蜂场、箱号、批次号筛选查询。
    """
    config, data_store = ensure_initialized()
    
    reporter = Reporter(config, data_store)
    result = reporter.generate_history_report(
        apiary=apiary,
        hive_number=hive_number,
        batch_number=batch_number
    )
    
    if output_json:
        import json
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        click.echo("=" * 60)
        click.echo("历史记录查询结果")
        click.echo("=" * 60)
        
        query = result["query"]
        filters = []
        if query["apiary"]:
            filters.append(f"蜂场={query['apiary']}")
        if query["hive_number"]:
            filters.append(f"箱号={query['hive_number']}")
        if query["batch_number"]:
            filters.append(f"批次={query['batch_number']}")
        
        if filters:
            click.echo(f"筛选条件: {', '.join(filters)}")
        click.echo(f"查询时间: {result['timestamp']}")
        click.echo(f"巡检: {result['summary']['inspection_count']} 条")
        click.echo(f"用药: {result['summary']['treatment_count']} 条")
        click.echo(f"摇蜜: {result['summary']['harvest_count']} 条")
        click.echo("-" * 60)
        
        if result["inspections"]:
            click.echo("\n📋 巡检记录:")
            for r in result["inspections"]:
                cs = r.get('colony_strength') or '-'
                qs = r.get('queen_status') or '-'
                pd = r.get('pests_diseases') or '-'
                click.echo(f"   {r['date']} | 箱{r['hive_number']} | 群势:{cs} | 蜂王:{qs} | 病虫害:{pd}")
        
        if result["treatments"]:
            click.echo("\n💊 用药/饲喂记录:")
            for r in result["treatments"]:
                dosage = r.get('dosage') or '-'
                click.echo(f"   {r['date']} | 箱{r['hive_number']} | {r['treatment_type']}:{r['product_name']} | 剂量:{dosage}")
        
        if result["harvests"]:
            click.echo("\n🍯 摇蜜记录:")
            for r in result["harvests"]:
                qty = r.get('quantity_kg') or '-'
                moist = r.get('moisture_content') or '-'
                click.echo(f"   {r['date']} | 箱{r['hive_number']} | 批次:{r['batch_number']} | 产量:{qty}kg | 含水率:{moist}%")


@cli.command('quarantine')
@click.option('--clear', '-c', is_flag=True, help='清空隔离区')
def quarantine(clear: bool):
    """查看或清空隔离区记录
    
    隔离区存储校验失败的记录，包含错误原因。
    """
    _, data_store = ensure_initialized()
    
    if clear:
        count = data_store.clear_quarantine()
        click.echo(f"✅ 已清空隔离区: {count} 条记录")
        return
    
    records = data_store.get_all_quarantine()
    
    if not records:
        click.echo("✅ 隔离区为空")
        return
    
    click.echo("=" * 60)
    click.echo(f"隔离区记录 ({len(records)} 条)")
    click.echo("=" * 60)
    
    for i, r in enumerate(records, 1):
        click.echo(f"\n{i}. [{r.record_type}] {r.quarantine_id}")
        click.echo(f"   隔离时间: {r.quarantined_at}")
        click.echo(f"   来源: {r.import_source or '未知'}")
        click.echo(f"   错误原因: {r.error_reason}")
        click.echo(f"   原始数据: {r.original_data}")


@cli.command('stats')
def stats():
    """显示数据统计"""
    config, data_store = ensure_initialized()
    
    click.echo("=" * 60)
    click.echo("数据统计")
    click.echo("=" * 60)
    click.echo(f"\n📝 配置:")
    click.echo(f"   蜂场数量: {len(config.apiaries)}")
    click.echo(f"   蜂箱数量: {len(config.hives)}")
    click.echo(f"   药物数量: {len(config.drugs)}")
    
    click.echo(f"\n📊 记录:")
    click.echo(f"   巡检记录: {data_store.count_inspections()} 条")
    click.echo(f"   用药记录: {data_store.count_treatments()} 条")
    click.echo(f"   摇蜜记录: {data_store.count_harvests()} 条")
    
    quarantine_count = data_store.count_quarantine()
    if quarantine_count > 0:
        click.echo(f"\n⚠️  隔离区: {quarantine_count} 条")
    else:
        click.echo(f"\n✅ 隔离区: 0 条")
    
    click.echo("\n" + "=" * 60)


if __name__ == '__main__':
    cli()
