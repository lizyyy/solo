import os
import sys
from typing import Optional, List, Dict
from pathlib import Path

import click

from bend_checker import __version__
from bend_checker.storage.config import ConfigManager
from bend_checker.storage.csv_import import CSVImporter
from bend_checker.storage.json_import import JSONImporter
from bend_checker.geometry.unfold import UnfoldCalculator
from bend_checker.geometry.sequence import BendSequencePlanner
from bend_checker.rules.interference import InterferenceChecker
from bend_checker.rules.tonnage import TonnageCalculator
from bend_checker.rules.hole_distance import HoleDistanceChecker
from bend_checker.rules.duplicate import DuplicateChecker
from bend_checker.report.markdown import MarkdownReporter
from bend_checker.report.csv_export import CSVExporter
from bend_checker.report.json_export import JSONExporter


class BendCheckerContext:
    def __init__(self):
        self.config_manager: Optional[ConfigManager] = None
        self.parts: List = []
        self.unfold_results: Dict = {}
        self.sequence_results: Dict = {}
        self.interference_results: Dict = {}
        self.tonnage_results: Dict = {}
        self.hole_results: Dict = {}
        self.duplicate_result = None
        self.verbose = False


pass_context = click.make_pass_decorator(BendCheckerContext, ensure=True)


@click.group()
@click.version_option(version=__version__, prog_name='bend-checker')
@click.option('-v', '--verbose', is_flag=True, help='显示详细输出')
@click.option('-d', '--config-dir', type=click.Path(), help='配置目录路径')
@pass_context
def cli(ctx: BendCheckerContext, verbose: bool, config_dir: Optional[str]):
    """折弯展开复核器 - 钣金工艺展开计算与核查工具"""
    ctx.verbose = verbose
    if config_dir:
        ctx.config_manager = ConfigManager(config_dir)
    else:
        ctx.config_manager = ConfigManager(os.getcwd())


@cli.command()
@click.option('-n', '--name', default='默认车间', help='车间名称')
@click.option('-f', '--force', is_flag=True, help='强制覆盖现有配置')
@pass_context
def init(ctx: BendCheckerContext, name: str, force: bool):
    """初始化车间配置
    
    创建默认的材料库、设备库和模具配置文件。
    """
    if ctx.config_manager.is_initialized() and not force:
        click.echo("错误: 配置已存在。使用 --force 强制覆盖。")
        sys.exit(1)
    
    config = ctx.config_manager.init_workshop(name)
    
    click.echo(f"✅ 车间配置初始化完成: {config.workshop_name}")
    click.echo(f"   配置目录: {ctx.config_manager.config_dir}")
    
    info = ctx.config_manager.get_workshop_info()
    click.echo(f"   - 材料种类: {info['num_materials']}")
    click.echo(f"   - 设备数量: {info['num_machines']}")
    click.echo(f"   - 模具数量: {info['num_dies']}")


@cli.command()
@click.option('--parts', '-p', type=click.Path(exists=True), help='零件CSV文件路径')
@click.option('--dies', '-d', type=click.Path(exists=True), help='模具JSON文件路径')
@click.option('--machines', '-m', type=click.Path(exists=True), help='设备JSON文件路径')
@click.option('--materials', '-t', type=click.Path(exists=True), help='材料JSON文件路径')
@click.option('--template', is_flag=True, help='生成导入模板文件')
@pass_context
def import_cmd(ctx: BendCheckerContext, 
                parts: Optional[str], 
                dies: Optional[str], 
                machines: Optional[str],
                materials: Optional[str],
                template: bool):
    """导入零件数据、模具、设备或材料
    
    支持 CSV (零件) 和 JSON (模具/设备/材料) 格式。
    """
    if template:
        _generate_templates()
        return
    
    if not ctx.config_manager.is_initialized():
        click.echo("错误: 请先运行 'bend-checker init' 初始化车间配置。")
        sys.exit(1)
    
    if parts:
        click.echo(f"正在导入零件: {parts}")
        result = CSVImporter.import_parts(parts)
        
        if result.success:
            ctx.parts = result.parts
            click.echo(f"✅ 成功导入 {result.valid_parts} 个零件")
            for part in result.parts:
                click.echo(f"   - {part.part_number}: {part.part_name}, {part.material_grade} {part.material_thickness}mm")
        else:
            click.echo("❌ 导入失败:")
            for error in result.errors:
                click.echo(f"   - {error}")
            sys.exit(1)
        
        if result.warnings and ctx.verbose:
            click.echo("⚠️  警告:")
            for warning in result.warnings:
                click.echo(f"   - {warning}")
    
    if dies:
        click.echo(f"正在导入模具: {dies}")
        result = JSONImporter.import_dies(dies)
        
        if result.success:
            die_set = ctx.config_manager.load_die_set()
            with open(dies, 'r', encoding='utf-8') as f:
                import json
                data = json.load(f)
                if 'dies' in data:
                    for die_data in data['dies']:
                        from bend_checker.models.die import Die
                        die = Die(
                            id=die_data.get('id', ''),
                            die_type=die_data.get('die_type', 'v_die'),
                            v_width=die_data.get('v_width', 0.0),
                            v_angle=die_data.get('v_angle', 90.0),
                            punch_radius=die_data.get('punch_radius'),
                            die_radius=die_data.get('die_radius'),
                            min_thickness=die_data.get('min_thickness'),
                            max_thickness=die_data.get('max_thickness'),
                            min_bend_radius=die_data.get('min_bend_radius'),
                            max_bend_radius=die_data.get('max_bend_radius'),
                            min_bend_length=die_data.get('min_bend_length'),
                            description=die_data.get('description')
                        )
                        die_set.add_die(die)
            ctx.config_manager.save_die_set(die_set)
            click.echo(f"✅ 成功导入 {result.count} 个模具")
        else:
            click.echo("❌ 模具导入失败:")
            for error in result.errors:
                click.echo(f"   - {error}")
    
    if machines:
        click.echo(f"正在导入设备: {machines}")
        result = JSONImporter.import_machines(machines)
        
        if result.success:
            machine_lib = ctx.config_manager.load_machine_library()
            with open(machines, 'r', encoding='utf-8') as f:
                import json
                data = json.load(f)
                if 'machines' in data:
                    for machine_data in data['machines']:
                        from bend_checker.models.machine import Machine
                        machine = Machine(
                            id=machine_data.get('id', ''),
                            name=machine_data.get('name', ''),
                            machine_type=machine_data.get('machine_type', 'hydraulic'),
                            max_tonnage=machine_data.get('max_tonnage', 0.0),
                            bed_length=machine_data.get('bed_length', 0.0),
                            stroke=machine_data.get('stroke', 0.0),
                            daylight=machine_data.get('daylight', 0.0),
                            min_thickness=machine_data.get('min_thickness'),
                            max_thickness=machine_data.get('max_thickness'),
                            compatible_dies=machine_data.get('compatible_dies', []),
                            description=machine_data.get('description')
                        )
                        machine_lib.add_machine(machine)
            ctx.config_manager.save_machine_library(machine_lib)
            click.echo(f"✅ 成功导入 {result.count} 台设备")
        else:
            click.echo("❌ 设备导入失败:")
            for error in result.errors:
                click.echo(f"   - {error}")
    
    if materials:
        click.echo(f"正在导入材料: {materials}")
        result = JSONImporter.import_materials(materials)
        
        if result.success:
            material_lib = ctx.config_manager.load_material_library()
            with open(materials, 'r', encoding='utf-8') as f:
                import json
                data = json.load(f)
                if 'materials' in data:
                    for mat_data in data['materials']:
                        from bend_checker.models.material import Material
                        material = Material(
                            name=mat_data.get('name', ''),
                            grade=mat_data.get('grade', ''),
                            thickness=mat_data.get('thickness', 0.0),
                            tensile_strength=mat_data.get('tensile_strength', 400.0),
                            k_factor=mat_data.get('k_factor', 0.33),
                            min_bend_radius=mat_data.get('min_bend_radius', 0.0),
                            description=mat_data.get('description')
                        )
                        material_lib.add_material(material)
            ctx.config_manager.save_material_library(material_lib)
            click.echo(f"✅ 成功导入 {result.count} 种材料")
        else:
            click.echo("❌ 材料导入失败:")
            for error in result.errors:
                click.echo(f"   - {error}")


@cli.command()
@click.option('--bend-length', '-l', type=float, default=100.0, help='折弯长度(mm)')
@pass_context
def plan(ctx: BendCheckerContext, bend_length: float):
    """计算展开尺寸、折弯顺序和设备匹配
    
    对已导入的零件进行工艺计算。
    """
    if not ctx.config_manager.is_initialized():
        click.echo("错误: 请先运行 'bend-checker init' 初始化车间配置。")
        sys.exit(1)
    
    if not ctx.parts:
        click.echo("错误: 没有导入零件。请先运行 'bend-checker import --parts <文件>'。")
        sys.exit(1)
    
    material_lib = ctx.config_manager.load_material_library()
    machine_lib = ctx.config_manager.load_machine_library()
    die_set = ctx.config_manager.load_die_set()
    
    click.echo("📐 正在计算展开尺寸...")
    for part in ctx.parts:
        result = UnfoldCalculator.calculate_part_unfold(part, material_lib, bend_length)
        ctx.unfold_results[part.part_number] = result
        
        part.unfolded_length = result.unfolded_length
        part.unfolded_width = result.unfolded_width
        
        click.echo(f"   {part.part_number}: 展开尺寸 {result.unfolded_length} x {result.unfolded_width} mm")
        
        if result.warnings:
            for warning in result.warnings:
                click.echo(f"      ⚠️  {warning}")
    
    click.echo("🔄 正在规划折弯顺序...")
    for part in ctx.parts:
        result = BendSequencePlanner.plan_sequence(part, die_set, machine_lib)
        ctx.sequence_results[part.part_number] = result
        
        part.bend_sequence = result.recommended_sequence
        
        if result.total_steps > 0:
            click.echo(f"   {part.part_number}: 推荐顺序 {' → '.join(result.recommended_sequence)}")
            
            if result.risks:
                for risk in result.risks:
                    click.echo(f"      ⚠️  步骤 {risk['step']}: {risk['risk_level'].upper()}")
    
    click.echo("⚖️  正在计算吨位和设备匹配...")
    for part in ctx.parts:
        result = TonnageCalculator.calculate(part, material_lib, machine_lib, die_set, bend_length)
        ctx.tonnage_results[part.part_number] = result
        
        part.calculated_tonnage = result.total_tonnage
        if result.suitable_machines:
            part.recommended_machine = result.suitable_machines[0]
        
        click.echo(f"   {part.part_number}: 总吨位 {result.total_tonnage} 吨")
        if result.suitable_machines:
            click.echo(f"      推荐设备: {', '.join(result.suitable_machines)}")
        
        if result.warnings:
            for warning in result.warnings:
                click.echo(f"      ⚠️  {warning}")
    
    click.echo("✅ 工艺规划完成")


@cli.command()
@pass_context
def check(ctx: BendCheckerContext):
    """检查干涉、吨位超限、孔边距风险和重复零件
    
    执行完整的工艺风险检查。
    """
    if not ctx.config_manager.is_initialized():
        click.echo("错误: 请先运行 'bend-checker init' 初始化车间配置。")
        sys.exit(1)
    
    if not ctx.parts:
        click.echo("错误: 没有导入零件。请先运行 'bend-checker import --parts <文件>'。")
        sys.exit(1)
    
    die_set = ctx.config_manager.load_die_set()
    
    total_issues = 0
    
    click.echo("🔍 正在检查折弯干涉...")
    for part in ctx.parts:
        result = InterferenceChecker.check_all(
            part, 
            ctx.sequence_results.get(part.part_number, {}).recommended_sequence if ctx.sequence_results.get(part.part_number) else None,
            die_set
        )
        ctx.interference_results[part.part_number] = result
        
        if result.has_issues:
            click.echo(f"   ❌ {part.part_number}: 发现 {len(result.issues)} 个干涉问题")
            total_issues += len(result.issues)
            for issue in result.issues:
                click.echo(f"      [{issue.severity.upper()}] {issue.description}")
                click.echo(f"         建议: {issue.suggested_fix}")
        else:
            click.echo(f"   ✅ {part.part_number}: 无干涉问题")
        
        if result.warnings:
            for warning in result.warnings:
                click.echo(f"      ⚠️  {warning}")
    
    click.echo("🔍 正在检查孔边距...")
    for part in ctx.parts:
        if part.holes:
            result = HoleDistanceChecker.check_all(part)
            ctx.hole_results[part.part_number] = result
            
            if result.has_risks:
                click.echo(f"   ⚠️  {part.part_number}: 发现 {result.at_risk_holes} 个孔边距风险")
                total_issues += len(result.issues)
                for issue in result.issues:
                    click.echo(f"      [{issue.risk_level.value.upper()}] {issue.description}")
                    click.echo(f"         建议: {issue.suggestion}")
            else:
                click.echo(f"   ✅ {part.part_number}: 所有孔边距符合要求")
        else:
            click.echo(f"   ℹ️  {part.part_number}: 无孔需要检查")
    
    click.echo("🔍 正在检查重复零件...")
    if len(ctx.parts) > 1:
        result = DuplicateChecker.check_all(ctx.parts)
        ctx.duplicate_result = result
        
        if result.duplicates_found > 0:
            click.echo(f"   ⚠️  发现 {result.duplicates_found} 个重复零件")
            total_issues += result.duplicates_found
            for group in result.duplicate_groups:
                click.echo(f"      代表零件: {group.representative_part}")
                click.echo(f"      重复零件: {', '.join(group.duplicate_parts)}")
                click.echo(f"      总数量: {group.total_quantity}")
        else:
            click.echo("   ✅ 未发现重复零件")
    else:
        click.echo("   ℹ️  零件数量少于2，跳过重复检查")
    
    click.echo("")
    click.echo("=" * 50)
    if total_issues > 0:
        click.echo(f"⚠️  共发现 {total_issues} 个需要注意的问题")
    else:
        click.echo("✅ 所有检查通过，未发现问题")
    click.echo("=" * 50)


@cli.command()
@click.option('--format', '-f', type=click.Choice(['markdown', 'csv', 'json', 'all']), 
              default='markdown', help='输出格式')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@pass_context
def report(ctx: BendCheckerContext, format: str, output: Optional[str]):
    """导出复核报告
    
    支持 Markdown、CSV 和 JSON 格式。
    """
    if not ctx.parts:
        click.echo("错误: 没有数据可导出。请先运行 'import' 和 'plan'/'check' 命令。")
        sys.exit(1)
    
    workshop_info = None
    if ctx.config_manager.is_initialized():
        workshop_info = ctx.config_manager.get_workshop_info()
    
    base_path = output or os.getcwd()
    base_path = Path(base_path)
    
    if base_path.is_dir():
        output_dir = base_path
        base_name = "bend_check_report"
    else:
        output_dir = base_path.parent
        base_name = base_path.stem
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if format in ['markdown', 'all']:
        md_path = output_dir / f"{base_name}.md"
        click.echo(f"正在生成 Markdown 报告: {md_path}")
        
        success = MarkdownReporter.write_report(
            output_path=str(md_path),
            parts=ctx.parts,
            unfold_results=ctx.unfold_results,
            sequence_results=ctx.sequence_results,
            interference_results=ctx.interference_results,
            tonnage_results=ctx.tonnage_results,
            hole_results=ctx.hole_results,
            duplicate_result=ctx.duplicate_result,
            workshop_info=workshop_info
        )
        
        if success:
            click.echo(f"✅ Markdown 报告已生成: {md_path}")
        else:
            click.echo("❌ Markdown 报告生成失败")
    
    if format in ['csv', 'all']:
        click.echo("正在生成 CSV 报告...")
        
        summary_path = output_dir / f"{base_name}_summary.csv"
        CSVExporter.export_parts_summary(
            str(summary_path), ctx.parts, ctx.unfold_results, ctx.tonnage_results
        )
        click.echo(f"✅ 零件摘要: {summary_path}")
        
        bend_path = output_dir / f"{base_name}_bends.csv"
        CSVExporter.export_bend_details(
            str(bend_path), ctx.parts, ctx.unfold_results, ctx.tonnage_results
        )
        click.echo(f"✅ 折弯详情: {bend_path}")
        
        issues_path = output_dir / f"{base_name}_issues.csv"
        CSVExporter.export_issues(
            str(issues_path), ctx.parts, ctx.interference_results, ctx.hole_results, ctx.tonnage_results
        )
        click.echo(f"✅ 问题清单: {issues_path}")
        
        if ctx.duplicate_result:
            dup_path = output_dir / f"{base_name}_duplicates.csv"
            CSVExporter.export_duplicates(str(dup_path), ctx.duplicate_result)
            click.echo(f"✅ 重复零件: {dup_path}")
    
    if format in ['json', 'all']:
        json_path = output_dir / f"{base_name}.json"
        click.echo(f"正在生成 JSON 报告: {json_path}")
        
        success = JSONExporter.export_full_report(
            output_path=str(json_path),
            parts=ctx.parts,
            unfold_results=ctx.unfold_results,
            sequence_results=ctx.sequence_results,
            interference_results=ctx.interference_results,
            tonnage_results=ctx.tonnage_results,
            hole_results=ctx.hole_results,
            duplicate_result=ctx.duplicate_result,
            workshop_info=workshop_info
        )
        
        if success:
            click.echo(f"✅ JSON 报告已生成: {json_path}")
        else:
            click.echo("❌ JSON 报告生成失败")
    
    click.echo("")
    click.echo("✅ 报告导出完成")


@cli.command()
@pass_context
def status(ctx: BendCheckerContext):
    """显示当前状态和配置信息"""
    click.echo("=" * 50)
    click.echo("折弯展开复核器 - 状态信息")
    click.echo("=" * 50)
    
    if ctx.config_manager.is_initialized():
        info = ctx.config_manager.get_workshop_info()
        click.echo(f"车间名称: {info['workshop_name']}")
        click.echo(f"配置目录: {info['config_file']}")
        click.echo("")
        click.echo("车间资源:")
        click.echo(f"  - 材料种类: {info['num_materials']}")
        click.echo(f"  - 设备数量: {info['num_machines']}")
        click.echo(f"  - 模具数量: {info['num_dies']}")
    else:
        click.echo("⚠️  车间未初始化。请运行 'bend-checker init'。")
    
    click.echo("")
    click.echo("当前会话数据:")
    click.echo(f"  - 已导入零件: {len(ctx.parts)}")
    click.echo(f"  - 展开计算: {'已完成' if ctx.unfold_results else '未执行'}")
    click.echo(f"  - 顺序规划: {'已完成' if ctx.sequence_results else '未执行'}")
    click.echo(f"  - 吨位计算: {'已完成' if ctx.tonnage_results else '未执行'}")
    click.echo(f"  - 干涉检查: {'已完成' if ctx.interference_results else '未执行'}")
    click.echo(f"  - 孔边距检查: {'已完成' if ctx.hole_results else '未执行'}")
    click.echo(f"  - 重复检查: {'已完成' if ctx.duplicate_result else '未执行'}")
    
    if ctx.parts:
        click.echo("")
        click.echo("已导入零件:")
        for part in ctx.parts:
            click.echo(f"  - {part.part_number}: {part.part_name} ({part.material_grade} {part.material_thickness}mm)")


def _generate_templates():
    """生成导入模板文件"""
    templates_dir = Path("import_templates")
    templates_dir.mkdir(exist_ok=True)
    
    click.echo(f"正在生成导入模板到: {templates_dir.absolute()}")
    
    parts_template = templates_dir / "parts_template.csv"
    CSVImporter.generate_template(str(parts_template))
    click.echo(f"✅ 零件CSV模板: {parts_template}")
    
    die_template = templates_dir / "dies_template.json"
    JSONImporter.generate_die_template(str(die_template))
    click.echo(f"✅ 模具JSON模板: {die_template}")
    
    machine_template = templates_dir / "machines_template.json"
    JSONImporter.generate_machine_template(str(machine_template))
    click.echo(f"✅ 设备JSON模板: {machine_template}")
    
    material_template = templates_dir / "materials_template.json"
    JSONImporter.generate_material_template(str(material_template))
    click.echo(f"✅ 材料JSON模板: {material_template}")
    
    click.echo("")
    click.echo("模板说明:")
    click.echo("  - parts_template.csv: 用于导入零件尺寸、折弯和孔信息")
    click.echo("  - dies_template.json: 用于导入车间模具配置")
    click.echo("  - machines_template.json: 用于导入折弯机设备信息")
    click.echo("  - materials_template.json: 用于导入材料牌号和K因子配置")


if __name__ == '__main__':
    cli()
