"""scenario 命令"""

import click
from datetime import datetime
from pathlib import Path
from typing import Optional

from rov_tension_checker.config.manager import ConfigManager
from rov_tension_checker.scenario.simulator import ScenarioSimulator
from rov_tension_checker.storage.repository import AnalysisRepository
from rov_tension_checker.storage.models import ScenarioRecord


MODIFICATION_TYPES = [
    "current_speed", "current_direction",
    "cable_length", "cable_len",
    "depth", "rov_depth",
    "thrust_forward", "thrust_h",
    "thrust_vertical", "thrust_v"
]


@click.command()
@click.option('--analysis-id', '-a', help='分析ID（默认为最新分析）')
@click.option('--modify', '-m', 'modifications', multiple=True,
              help='参数修改，格式: type:value 或 type:+delta 或 type:-delta')
@click.option('--name', '-n', default=None, help='场景名称')
@click.option('--working-dir', '-w', default=None, help='工作目录')
@click.option('--save/--no-save', default=True, help='是否保存场景结果')
def scenario(
    analysis_id: Optional[str],
    modifications: tuple,
    name: Optional[str],
    working_dir: Optional[str],
    save: bool
):
    """执行场景推演
    
    修改海流或放缆长度进行假设推演，不会覆盖原始记录。
    
    参数修改格式:
    - current_speed:1.5    设置海流速度为 1.5 m/s
    - current_speed:+0.5   海流速度增加 0.5 m/s
    - cable_length:-10     放缆长度减少 10 m
    - depth:150            设置深度为 150 m
    
    支持的修改类型:
    - current_speed: 海流速度 (m/s)
    - current_direction: 海流方向 (度)
    - cable_length: 放缆长度 (m)
    - depth: ROV 深度 (m)
    - thrust_forward: 水平推力 (N)
    - thrust_vertical: 垂直推力 (N)
    """
    config_manager = ConfigManager(working_dir)
    
    if not config_manager.config_exists():
        click.echo(click.style("❌ 项目未初始化", fg='red'))
        return
    
    config = config_manager.load_config()
    base_path = Path(working_dir or '.') / config.output_directory
    repo = AnalysisRepository(str(base_path))
    
    if analysis_id:
        analysis = repo.load_analysis(analysis_id)
    else:
        analysis = repo.get_latest_analysis()
    
    if not analysis:
        if analysis_id:
            click.echo(click.style(f"❌ 未找到分析: {analysis_id}", fg='red'))
        else:
            click.echo(click.style("❌ 没有找到分析记录", fg='red'))
            click.echo("请先运行 'rov-tension analyze' 执行分析")
        return
    
    click.echo(f"使用分析: {analysis.analysis_id}")
    click.echo(f"项目: {analysis.project_name}")
    click.echo(f"管线: {analysis.pipeline_id}")
    click.echo("")
    
    if not modifications:
        click.echo(click.style("❌ 请指定至少一个修改参数", fg='red'))
        click.echo("")
        click.echo("示例:")
        click.echo("  rov-tension scenario -m current_speed:1.5")
        click.echo("  rov-tension scenario -m cable_length:-10 -m current_speed:+0.3")
        return
    
    parsed_mods = []
    simulator = ScenarioSimulator(
        cable_spec=config.cable_spec,
        rov_spec=config.rov_spec,
        thresholds=config.risk_thresholds
    )
    
    click.echo("场景修改:")
    for mod_str in modifications:
        try:
            if ':' in mod_str:
                mod_type, value_str = mod_str.split(':', 1)
                is_absolute = True
                
                if value_str.startswith('+') or value_str.startswith('-'):
                    is_absolute = False
                    value = float(value_str)
                else:
                    value = float(value_str)
                
                mod = simulator.create_modification(
                    mod_type=mod_type,
                    value=value,
                    is_absolute=is_absolute
                )
                parsed_mods.append(mod)
                
                op = "=" if is_absolute else ""
                click.echo(f"  - {mod_type}: {op}{value}")
            else:
                click.echo(click.style(f"⚠️  无效的修改格式: {mod_str}", fg='yellow'))
        except ValueError as e:
            click.echo(click.style(f"⚠️  解析失败: {mod_str} - {e}", fg='yellow'))
    
    if not parsed_mods:
        click.echo(click.style("❌ 没有有效的修改参数", fg='red'))
        return
    
    click.echo("")
    click.echo("正在执行场景推演...")
    
    original_tensions = []
    original_bendings = []
    original_offsets = []
    
    for sample in analysis.samples:
        from rov_tension_checker.analysis.tension import TensionCalculationResult
        from rov_tension_checker.analysis.bending import BendingCalculationResult
        
        t = None
        if sample.top_tension is not None:
            t = TensionCalculationResult(
                top_tension=sample.top_tension or 0,
                bottom_tension=sample.bottom_tension or 0,
                horizontal_force=0,
                vertical_force_rov=0,
                effective_weight_rov=0,
                current_drag_force=0,
                thrust_contribution=0,
                safety_margin=sample.safety_margin or 0,
                tension_ratio=sample.tension_ratio or 0
            )
        original_tensions.append(t)
        
        b = None
        if sample.minimum_bending_radius is not None:
            b = BendingCalculationResult(
                minimum_radius=sample.minimum_bending_radius or 0,
                minimum_radius_location=sample.bending_radius_location or "",
                radius_at_top=0,
                radius_at_bottom=0,
                radius_safety_margin=0
            )
        original_bendings.append(b)
        
        original_offsets.append(sample.horizontal_offset)
    
    from rov_tension_checker.analysis.alignment import AlignedSample
    aligned_samples = []
    for sample in analysis.samples:
        aligned = AlignedSample(
            timestamp=sample.timestamp,
            reference_latitude=None,
            reference_longitude=None
        )
        aligned.rov_depth = sample.rov_depth
        aligned.rov_cable_length = sample.rov_cable_length
        aligned.rov_thrust_forward = sample.rov_thrust_forward
        aligned.rov_thrust_vertical = sample.rov_thrust_vertical
        aligned.current_speed = sample.current_speed
        aligned.current_direction = sample.current_direction
        aligned_samples.append(aligned)
    
    scenario_name = name or f"场景_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    result = simulator.compare_scenarios(
        original_samples=aligned_samples,
        original_tensions=original_tensions,
        original_bendings=original_bendings,
        original_offsets=original_offsets,
        modifications=parsed_mods,
        scenario_name=scenario_name,
        time_step=config.sampling_time_step
    )
    
    click.echo("")
    click.echo("场景推演结果:")
    click.echo("-" * 50)
    click.echo(f"场景名称: {scenario_name}")
    click.echo("")
    
    if result.original_top_tension is not None and result.scenario_top_tension is not None:
        click.echo("张力变化:")
        click.echo(f"  原始平均张力: {result.original_top_tension:.1f} N")
        click.echo(f"  场景平均张力: {result.scenario_top_tension:.1f} N")
        
        change_pct = result.tension_change_percent
        if change_pct > 0:
            click.echo(click.style(f"  变化: +{change_pct:.1f}%", fg='red' if change_pct > 20 else 'yellow'))
        elif change_pct < 0:
            click.echo(click.style(f"  变化: {change_pct:.1f}%", fg='green'))
        else:
            click.echo(f"  变化: 0%")
    
    click.echo("")
    click.echo("风险变化:")
    click.echo(f"  原始关键风险: {result.original_critical_count}")
    click.echo(f"  场景关键风险: {result.scenario_critical_count}")
    click.echo(f"  原始预警风险: {result.original_warning_count}")
    click.echo(f"  场景预警风险: {result.scenario_warning_count}")
    
    critical_change = result.scenario_critical_count - result.original_critical_count
    if critical_change > 0:
        click.echo(click.style(f"  关键风险增加: +{critical_change}", fg='red'))
    elif critical_change < 0:
        click.echo(click.style(f"  关键风险减少: {critical_change}", fg='green'))
    
    if save:
        scenario_record = ScenarioRecord(
            scenario_id="",
            analysis_id=analysis.analysis_id,
            scenario_name=scenario_name,
            created_at=datetime.now(),
            modifications=[m.to_dict() if hasattr(m, 'to_dict') else str(m) for m in parsed_mods],
            original_top_tension=result.original_top_tension,
            scenario_top_tension=result.scenario_top_tension,
            original_bending_radius=result.original_min_bending_radius,
            scenario_bending_radius=result.scenario_min_bending_radius,
            original_critical_count=result.original_critical_count,
            scenario_critical_count=result.scenario_critical_count,
            original_warning_count=result.original_warning_count,
            scenario_warning_count=result.scenario_warning_count,
            details=result.details
        )
        
        scenario_id = repo.save_scenario(scenario_record)
        click.echo("")
        click.echo(click.style(f"✓ 场景结果已保存，ID: {scenario_id}", fg='green'))
    
    return result
