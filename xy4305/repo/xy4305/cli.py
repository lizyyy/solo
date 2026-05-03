"""离心机转子配平助手 - 命令行入口"""

import click
import sys
import os
from typing import Optional, List
from datetime import datetime

from centrifuge_balance.models import Rotor, TubeType, BalanceConfig
from centrifuge_balance.calculator import BalanceCalculator
from centrifuge_balance.csv_handler import CSVHandler
from centrifuge_balance.storage import StorageManager
from centrifuge_balance.report_exporter import MarkdownExporter


@click.group()
@click.version_option(version="1.0.0", prog_name="centrifuge-balance")
@click.pass_context
def cli(ctx):
    """离心机转子配平助手 - 帮助实验室学生正确配平离心机转子"""
    ctx.ensure_object(dict)
    ctx.obj['storage'] = StorageManager()
    ctx.obj['storage'].initialize_default_data()


@cli.command()
@click.pass_context
def init(ctx):
    """初始化默认数据（转子和管型）"""
    storage = ctx.obj['storage']
    storage.initialize_default_data()
    click.echo("✅ 已初始化默认数据")
    click.echo("")
    
    rotors = storage.list_rotors()
    click.echo(f"已加载 {len(rotors)} 个转子:")
    for rotor in rotors:
        click.echo(f"  - {rotor.name} ({rotor.hole_count}孔, 半径{rotor.radius_cm}cm)")
    
    click.echo("")
    tubes = storage.list_tube_types()
    click.echo(f"已加载 {len(tubes)} 种管型:")
    for tube in tubes:
        click.echo(f"  - {tube.name} (自重{tube.empty_weight_g}g, 最大{tube.max_volume_ml}ml)")


@cli.group()
def rotor():
    """转子管理"""
    pass


@rotor.command(name="list")
@click.pass_context
def list_rotors(ctx):
    """列出所有转子"""
    storage = ctx.obj['storage']
    rotors = storage.list_rotors()
    
    if not rotors:
        click.echo("❌ 没有找到转子，请先运行 'centrifuge-balance init' 初始化")
        return
    
    click.echo(f"共 {len(rotors)} 个转子:")
    click.echo("")
    
    for rotor in rotors:
        click.echo(f"{'='*50}")
        click.echo(f"ID: {rotor.id}")
        click.echo(f"名称: {rotor.name}")
        click.echo(f"孔位数: {rotor.hole_count}")
        click.echo(f"半径: {rotor.radius_cm} cm")
        click.echo(f"最大转速: {rotor.max_rpm} RPM")
        click.echo(f"累计使用次数: {rotor.usage_count}")
        if rotor.last_used:
            click.echo(f"上次使用: {rotor.last_used.strftime('%Y-%m-%d %H:%M')}")
        if rotor.description:
            click.echo(f"描述: {rotor.description}")
        click.echo("")


@rotor.command(name="add")
@click.option("--id", "rotor_id", required=True, help="转子唯一ID")
@click.option("--name", required=True, help="转子名称")
@click.option("--holes", type=int, required=True, help="孔位数")
@click.option("--radius", type=float, required=True, help="半径(cm)")
@click.option("--max-rpm", type=int, required=True, help="最大转速(RPM)")
@click.option("--description", default="", help="描述")
@click.pass_context
def add_rotor(ctx, rotor_id, name, holes, radius, max_rpm, description):
    """添加新转子"""
    storage = ctx.obj['storage']
    
    existing = storage.load_rotor(rotor_id)
    if existing:
        click.echo(f"❌ 转子ID '{rotor_id}' 已存在")
        return
    
    rotor = Rotor(
        id=rotor_id,
        name=name,
        hole_count=holes,
        radius_cm=radius,
        max_rpm=max_rpm,
        description=description
    )
    
    storage.save_rotor(rotor)
    click.echo(f"✅ 已添加转子: {name}")


@rotor.command(name="delete")
@click.argument("rotor_id")
@click.confirmation_option(prompt="确定要删除这个转子吗?")
@click.pass_context
def delete_rotor(ctx, rotor_id):
    """删除转子"""
    storage = ctx.obj['storage']
    
    existing = storage.load_rotor(rotor_id)
    if not existing:
        click.echo(f"❌ 转子ID '{rotor_id}' 不存在")
        return
    
    if storage.delete_rotor(rotor_id):
        click.echo(f"✅ 已删除转子: {existing.name}")
    else:
        click.echo(f"❌ 删除失败")


@cli.group()
def tube():
    """管型管理"""
    pass


@tube.command(name="list")
@click.pass_context
def list_tubes(ctx):
    """列出所有管型"""
    storage = ctx.obj['storage']
    tubes = storage.list_tube_types()
    
    if not tubes:
        click.echo("❌ 没有找到管型，请先运行 'centrifuge-balance init' 初始化")
        return
    
    click.echo(f"共 {len(tubes)} 种管型:")
    click.echo("")
    
    for tube in tubes:
        click.echo(f"{'='*50}")
        click.echo(f"ID: {tube.id}")
        click.echo(f"名称: {tube.name}")
        click.echo(f"空管自重: {tube.empty_weight_g} g")
        click.echo(f"最大容量: {tube.max_volume_ml} ml")
        click.echo(f"材质: {tube.material.value}")
        if tube.description:
            click.echo(f"描述: {tube.description}")
        click.echo("")


@tube.command(name="add")
@click.option("--id", "tube_id", required=True, help="管型唯一ID")
@click.option("--name", required=True, help="管型名称")
@click.option("--weight", type=float, required=True, help="空管自重(g)")
@click.option("--max-volume", type=float, required=True, help="最大容量(ml)")
@click.option("--description", default="", help="描述")
@click.pass_context
def add_tube(ctx, tube_id, name, weight, max_volume, description):
    """添加新管型"""
    storage = ctx.obj['storage']
    
    existing = storage.load_tube_type(tube_id)
    if existing:
        click.echo(f"❌ 管型ID '{tube_id}' 已存在")
        return
    
    tube = TubeType(
        id=tube_id,
        name=name,
        empty_weight_g=weight,
        max_volume_ml=max_volume,
        description=description
    )
    
    storage.save_tube_type(tube)
    click.echo(f"✅ 已添加管型: {name}")


@tube.command(name="delete")
@click.argument("tube_id")
@click.confirmation_option(prompt="确定要删除这个管型吗?")
@click.pass_context
def delete_tube(ctx, tube_id):
    """删除管型"""
    storage = ctx.obj['storage']
    
    existing = storage.load_tube_type(tube_id)
    if not existing:
        click.echo(f"❌ 管型ID '{tube_id}' 不存在")
        return
    
    if storage.delete_tube_type(tube_id):
        click.echo(f"✅ 已删除管型: {existing.name}")
    else:
        click.echo(f"❌ 删除失败")


@cli.command()
@click.argument("csv_file")
@click.option("--rotor", "rotor_id", required=True, help="转子ID")
@click.option("--rpm", type=int, required=True, help="运行转速(RPM)")
@click.option("--notes", default="", help="备注")
@click.option("--save-history/--no-save-history", default=True, help="保存到历史记录")
@click.option("--export-md", type=click.Path(), help="导出Markdown报告路径")
@click.option("--export-csv", type=click.Path(), help="导出CSV配平方案路径")
@click.pass_context
def calculate(ctx, csv_file, rotor_id, rpm, notes, save_history, export_md, export_csv):
    """执行配平计算
    
    CSV_FILE: 配样CSV文件路径
    """
    storage = ctx.obj['storage']
    config = storage.load_config()
    
    rotor = storage.load_rotor(rotor_id)
    if not rotor:
        click.echo(f"❌ 转子ID '{rotor_id}' 不存在")
        sys.exit(1)
    
    tube_types = storage.get_tube_types_dict()
    if not tube_types:
        click.echo("❌ 没有定义管型，请先运行 'centrifuge-balance init' 初始化")
        sys.exit(1)
    
    csv_handler = CSVHandler()
    samples, import_errors = csv_handler.import_samples(csv_file)
    
    if import_errors:
        click.echo("❌ CSV导入错误:")
        for error in import_errors:
            click.echo(f"  - {error}")
        sys.exit(1)
    
    if not samples:
        click.echo("❌ 没有有效的样品数据")
        sys.exit(1)
    
    click.echo(f"📋 成功导入 {len(samples)} 个样品")
    click.echo("")
    
    calculator = BalanceCalculator(config=config)
    
    click.echo(f"⚙️  正在计算配平...")
    click.echo("")
    
    result = calculator.calculate(
        rotor=rotor,
        samples=samples,
        tube_types=tube_types,
        run_rpm=rpm,
        notes=notes
    )
    
    click.echo("=" * 60)
    click.echo("配平计算结果")
    click.echo("=" * 60)
    click.echo("")
    
    click.echo(f"转子: {rotor.name}")
    click.echo(f"运行转速: {rpm} RPM (最大: {rotor.max_rpm} RPM)")
    click.echo("")
    
    if result.is_balanced:
        click.echo("✅ 配平状态: 已配平")
    else:
        click.echo("❌ 配平状态: 未配平")
    
    click.echo(f"最大质量不平衡: {result.max_mass_imbalance_g:.4f} g (阈值: {config.mass_imbalance_threshold_g} g)")
    click.echo(f"最大力矩不平衡: {result.max_moment_imbalance_gcm:.4f} g·cm (阈值: {config.moment_imbalance_threshold_gcm} g·cm)")
    click.echo("")
    
    if result.hole_results:
        click.echo("-" * 60)
        click.echo("孔位详细信息")
        click.echo("-" * 60)
        click.echo(f"{'孔位':<6}{'管型':<15}{'体积(ml)':<10}{'密度(g/ml)':<12}{'总质量(g)':<12}{'质量矩(g·cm)':<15}")
        for hr in sorted(result.hole_results, key=lambda x: x.hole_position):
            tube = tube_types.get(hr.tube_type_id)
            tube_name = tube.name if tube else hr.tube_type_id
            click.echo(f"{hr.hole_position:<6}{tube_name[:14]:<15}{hr.sample_volume_ml:<10.2f}{hr.sample_density_gml:<12.3f}{hr.total_mass_g:<12.4f}{hr.mass_moment_gcm:<15.4f}")
        click.echo("")
    
    if result.imbalance_infos:
        click.echo("-" * 60)
        click.echo("对称孔位不平衡分析")
        click.echo("-" * 60)
        for ii in result.imbalance_infos:
            exceeds = ii.mass_difference_g > config.mass_imbalance_threshold_g
            indicator = "⚠️ " if exceeds else "   "
            click.echo(f"{indicator}孔位对 ({ii.hole1_position}, {ii.hole2_position}):")
            click.echo(f"   质量差: {ii.mass_difference_g:.4f} g - {ii.mass_direction}")
            click.echo(f"   力矩差: {ii.moment_difference_gcm:.4f} g·cm")
        click.echo("")
    
    if result.adjustment_suggestions:
        click.echo("-" * 60)
        click.echo("调整建议")
        click.echo("-" * 60)
        for i, suggestion in enumerate(result.adjustment_suggestions, 1):
            priority_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(suggestion.priority, "")
            click.echo(f"{priority_icon} {i}. [{suggestion.suggestion_type}] {suggestion.description}")
        click.echo("")
    
    if result.validation_errors:
        click.echo("-" * 60)
        click.echo("⚠️  校验错误")
        click.echo("-" * 60)
        for error in result.validation_errors:
            click.echo(f"❌ [{error.error_type}] {error.message}")
        click.echo("")
    
    if save_history and not result.validation_errors:
        samples_dict = [s.to_dict() for s in samples]
        history_id = storage.save_history(result, samples_dict)
        storage.increment_rotor_usage(rotor_id)
        click.echo(f"💾 已保存到历史记录 (ID: {history_id})")
    
    if export_md:
        exporter = MarkdownExporter(config=config)
        errors = exporter.export_report(result, rotor, tube_types, export_md)
        if errors:
            click.echo(f"❌ 导出Markdown失败: {errors[0]}")
        else:
            click.echo(f"📄 已导出Markdown报告: {export_md}")
    
    if export_csv:
        errors = csv_handler.export_balance_solution(result, rotor, tube_types, export_csv)
        if errors:
            click.echo(f"❌ 导出CSV失败: {errors[0]}")
        else:
            click.echo(f"📊 已导出CSV配平方案: {export_csv}")
    
    click.echo("")


@cli.group()
def history():
    """历史记录管理"""
    pass


@history.command(name="list")
@click.option("--limit", type=int, default=20, help="显示数量限制")
@click.pass_context
def list_history(ctx, limit):
    """列出历史记录"""
    storage = ctx.obj['storage']
    records = storage.list_history(limit=limit)
    
    if not records:
        click.echo("📭 暂无历史记录")
        return
    
    click.echo(f"共找到 {len(records)} 条历史记录 (最近{limit}条):")
    click.echo("")
    click.echo(f"{'记录ID':<20}{'时间':<18}{'转子ID':<20}{'状态':<10}{'质量差(g)':<12}")
    click.echo("-" * 80)
    
    for record in records:
        status = "✅ 已配平" if record.get("is_balanced") else "❌ 未配平"
        timestamp = record.get("timestamp", "")
        try:
            dt = datetime.fromisoformat(timestamp)
            timestamp_str = dt.strftime("%m-%d %H:%M:%S")
        except (ValueError, TypeError):
            timestamp_str = timestamp[:16]
        
        mass_diff = record.get("max_mass_imbalance_g", 0)
        click.echo(f"{record.get('id', '-'):<20}{timestamp_str:<18}{record.get('rotor_id', '-'):<20}{status:<10}{mass_diff:<12.4f}")


@history.command(name="view")
@click.argument("history_id")
@click.pass_context
def view_history(ctx, history_id):
    """查看历史记录详情"""
    storage = ctx.obj['storage']
    record = storage.load_history(history_id)
    
    if not record:
        click.echo(f"❌ 历史记录 '{history_id}' 不存在")
        return
    
    result_data = record.get("result", {})
    samples = record.get("samples", [])
    
    click.echo("=" * 60)
    click.echo(f"历史记录: {history_id}")
    click.echo("=" * 60)
    click.echo("")
    
    timestamp = record.get("timestamp", "")
    try:
        dt = datetime.fromisoformat(timestamp)
        timestamp_str = dt.strftime("%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        timestamp_str = timestamp
    
    click.echo(f"时间: {timestamp_str}")
    click.echo(f"转子ID: {result_data.get('rotor_id', '-')}")
    click.echo(f"运行转速: {result_data.get('run_rpm', '-')} RPM")
    
    is_balanced = result_data.get('is_balanced', False)
    click.echo(f"配平状态: {'✅ 已配平' if is_balanced else '❌ 未配平'}")
    click.echo(f"最大质量不平衡: {result_data.get('max_mass_imbalance_g', 0):.4f} g")
    click.echo(f"最大力矩不平衡: {result_data.get('max_moment_imbalance_gcm', 0):.4f} g·cm")
    click.echo("")
    
    if samples:
        click.echo("样品数据:")
        for s in samples:
            click.echo(f"  孔位{s.get('hole_position')}: 管型={s.get('tube_type_id')}, 体积={s.get('sample_volume_ml')}ml")
    
    notes = record.get("notes", "")
    if notes:
        click.echo(f"\n备注: {notes}")


@history.command(name="delete")
@click.argument("history_id")
@click.confirmation_option(prompt="确定要删除这条历史记录吗?")
@click.pass_context
def delete_history(ctx, history_id):
    """删除历史记录"""
    storage = ctx.obj['storage']
    
    if storage.delete_history(history_id):
        click.echo(f"✅ 已删除历史记录: {history_id}")
    else:
        click.echo(f"❌ 历史记录 '{history_id}' 不存在")


@cli.command()
@click.pass_context
def info(ctx):
    """显示工具信息"""
    storage = ctx.obj['storage']
    
    click.echo("=" * 60)
    click.echo("离心机转子配平助手 v1.0.0")
    click.echo("=" * 60)
    click.echo("")
    click.echo(f"数据目录: {storage.get_data_dir()}")
    click.echo("")
    
    rotors = storage.list_rotors()
    tubes = storage.list_tube_types()
    history = storage.list_history(limit=1)
    
    click.echo(f"转子数量: {len(rotors)}")
    click.echo(f"管型数量: {len(tubes)}")
    click.echo(f"历史记录: {len(history)} 条")
    click.echo("")
    click.echo("使用 'centrifuge-balance --help' 查看帮助")


if __name__ == "__main__":
    cli()
