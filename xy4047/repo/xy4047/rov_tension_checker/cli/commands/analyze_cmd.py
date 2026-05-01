"""analyze 命令"""

import click
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from rov_tension_checker.analysis.alignment import AlignedSample, TimelineAligner
from rov_tension_checker.analysis.bending import BendingRadiusCalculator
from rov_tension_checker.analysis.risk_engine import RiskEngine, RiskSeverity
from rov_tension_checker.analysis.tension import TensionCalculator
from rov_tension_checker.config.manager import ConfigManager
from rov_tension_checker.storage.models import AnalysisRecord, AnalysisSampleRecord
from rov_tension_checker.storage.repository import AnalysisRepository


def load_latest_data(data_dir: Path, pattern: str) -> Optional[List[dict]]:
    files = sorted(data_dir.glob(pattern), reverse=True)
    if not files:
        return None
    
    with open(files[0], 'r', encoding='utf-8') as f:
        return json.load(f)


def _parse_timestamp(row: dict) -> Optional[datetime]:
    from rov_tension_checker.data_import.validators import DataValidator
    return DataValidator.parse_timestamp(row.get('_parsed_timestamp') or row.get('timestamp'))


@click.command()
@click.option('--working-dir', '-w', default=None, help='工作目录')
@click.option('--save/--no-save', default=True, help='是否保存分析结果')
def analyze(working_dir: Optional[str], save: bool):
    """执行张力校核分析
    
    按时间线对齐多源数据，估算每个采样点的：
    - 水平偏移
    - 缆线悬链近似形态
    - 顶端张力、ROV端张力
    - 最小弯曲半径
    - 安全裕度
    
    识别以下风险：
    - 张力超限
    - 放缆不足
    - 缆线角度突变
    - 海流突变导致的风险
    - ROV 靠近管线保护架的擦碰风险
    """
    config_manager = ConfigManager(working_dir)
    
    if not config_manager.config_exists():
        click.echo(click.style("❌ 项目未初始化", fg='red'))
        click.echo(f"请先运行: rov-tension init")
        return
    
    config = config_manager.load_config()
    data_dir = Path(working_dir or '.') / config.data_directory
    
    click.echo("正在加载数据...")
    
    track_data = load_latest_data(data_dir, "track_*.json")
    rov_data = load_latest_data(data_dir, "rov_telemetry_*.json")
    current_profile = load_latest_data(data_dir, "current_profile_*.json") or []
    
    if not track_data and not rov_data:
        click.echo(click.style("❌ 没有找到可分析的数据", fg='red'))
        click.echo("请先使用 'rov-tension import' 导入航迹或ROV遥测数据")
        return
    
    click.echo(f"  航迹数据: {len(track_data) if track_data else 0} 条")
    click.echo(f"  ROV遥测: {len(rov_data) if rov_data else 0} 条")
    click.echo(f"  海流剖面: {len(current_profile)} 层")
    
    click.echo("")
    click.echo("正在对齐时间线...")
    
    aligner = TimelineAligner(time_step=config.sampling_time_step)
    aligned_samples = aligner.align(
        track_data=track_data or [],
        rov_data=rov_data or [],
        current_profile=current_profile
    )
    
    if not aligned_samples:
        click.echo(click.style("❌ 时间线对齐失败，没有有效数据点", fg='red'))
        return
    
    click.echo(f"  对齐后采样点: {len(aligned_samples)} 个")
    
    click.echo("")
    click.echo("正在计算张力和弯曲半径...")
    
    tension_calc = TensionCalculator(
        cable_spec=config.cable_spec,
        rov_spec=config.rov_spec,
        thresholds=config.risk_thresholds
    )
    
    bending_calc = BendingRadiusCalculator(config.cable_spec)
    
    risk_engine = RiskEngine(
        thresholds=config.risk_thresholds,
        protection_frames=config.protection_frames
    )
    
    tension_results = []
    bending_results = []
    horizontal_offsets = []
    sample_records: List[AnalysisSampleRecord] = []
    
    critical_count = 0
    warning_count = 0
    
    with click.progressbar(aligned_samples, label='计算进度') as samples:
        for i, sample in enumerate(samples):
            prev_sample = aligned_samples[i - 1] if i > 0 else None
            
            horizontal_offset = None
            if sample.rov_cable_length and sample.rov_depth:
                horizontal_offset = tension_calc.estimate_horizontal_offset(
                    sample.rov_cable_length,
                    sample.rov_depth
                )
            
            horizontal_offsets.append(horizontal_offset)
            
            if sample.rov_cable_length and sample.rov_depth and horizontal_offset is not None:
                tension_result = tension_calc.calculate(
                    cable_length=sample.rov_cable_length,
                    rov_depth=sample.rov_depth,
                    horizontal_offset=horizontal_offset,
                    rov_thrust_forward=sample.rov_thrust_forward,
                    rov_thrust_vertical=sample.rov_thrust_vertical,
                    current_speed=sample.current_speed
                )
                tension_results.append(tension_result)
                
                bending_result = None
                if tension_result.catenary_result:
                    bending_result = bending_calc.calculate_from_catenary(
                        tension_result.catenary_result
                    )
                    bending_result = bending_calc.check_criticality(
                        bending_result,
                        warning_ratio=config.risk_thresholds.bending_radius_warning_ratio,
                        critical_ratio=config.risk_thresholds.bending_radius_critical_ratio
                    )
                bending_results.append(bending_result)
                
                sample_record = AnalysisSampleRecord(
                    sample_index=i,
                    timestamp=sample.timestamp,
                    vessel_latitude=sample.vessel_latitude,
                    vessel_longitude=sample.vessel_longitude,
                    vessel_x=sample.vessel_x,
                    vessel_y=sample.vessel_y,
                    vessel_heading=sample.vessel_heading,
                    rov_depth=sample.rov_depth,
                    rov_cable_length=sample.rov_cable_length,
                    rov_thrust_forward=sample.rov_thrust_forward,
                    rov_thrust_vertical=sample.rov_thrust_vertical,
                    current_speed=sample.current_speed,
                    current_direction=sample.current_direction,
                    horizontal_offset=horizontal_offset,
                    top_tension=tension_result.top_tension,
                    bottom_tension=tension_result.bottom_tension,
                    tension_ratio=tension_result.tension_ratio,
                    safety_margin=tension_result.safety_margin
                )
                
                if bending_result:
                    sample_record.minimum_bending_radius = bending_result.minimum_radius
                    sample_record.bending_radius_location = bending_result.minimum_radius_location
                    if tension_result.catenary_result:
                        sample_record.top_angle = tension_result.catenary_result.top_angle
                        sample_record.bottom_angle = tension_result.catenary_result.bottom_angle
                
                risks = risk_engine.analyze_sample(
                    sample=sample,
                    sample_index=i,
                    tension_result=tension_result,
                    bending_result=bending_result,
                    previous_sample=prev_sample,
                    time_step=config.sampling_time_step,
                    min_bending_radius_spec=config.cable_spec.min_bending_radius,
                    horizontal_offset=horizontal_offset
                )
                
                sample_record.risks = risks
                
                for risk in risks:
                    if risk.severity == RiskSeverity.CRITICAL:
                        critical_count += 1
                    elif risk.severity == RiskSeverity.WARNING:
                        warning_count += 1
                
                sample_records.append(sample_record)
            else:
                tension_results.append(None)
                bending_results.append(None)
                sample_records.append(AnalysisSampleRecord(
                    sample_index=i,
                    timestamp=sample.timestamp
                ))
    
    click.echo("")
    click.echo("分析完成！")
    click.echo("-" * 50)
    
    valid_samples = [s for s in sample_records if s.top_tension is not None]
    
    if valid_samples:
        max_tension = max(s.top_tension for s in valid_samples)
        min_tension = min(s.top_tension for s in valid_samples)
        avg_tension = sum(s.top_tension for s in valid_samples) / len(valid_samples)
        
        click.echo(f"顶端张力:")
        click.echo(f"  最大: {max_tension:.1f} N")
        click.echo(f"  最小: {min_tension:.1f} N")
        click.echo(f"  平均: {avg_tension:.1f} N")
        
        bending_radii = [s.minimum_bending_radius for s in valid_samples if s.minimum_bending_radius is not None]
        if bending_radii:
            min_radius = min(bending_radii)
            click.echo(f"")
            click.echo(f"弯曲半径:")
            click.echo(f"  最小: {min_radius:.4f} m")
            click.echo(f"  规范要求: >= {config.cable_spec.min_bending_radius} m")
    
    click.echo("")
    click.echo(f"风险统计:")
    if critical_count > 0:
        click.echo(click.style(f"  🔴 关键风险: {critical_count} 处", fg='red'))
    if warning_count > 0:
        click.echo(click.style(f"  🟡 预警风险: {warning_count} 处", fg='yellow'))
    if critical_count == 0 and warning_count == 0:
        click.echo(click.style(f"  ✅ 未检测到风险", fg='green'))
    
    if save:
        click.echo("")
        click.echo("正在保存分析结果...")
        
        risk_summary: dict = {}
        for sample in sample_records:
            for risk in sample.risks:
                key = risk.risk_type.value
                risk_summary[key] = risk_summary.get(key, 0) + 1
        
        analysis_record = AnalysisRecord(
            analysis_id="",
            project_name=config.project_name,
            pipeline_id=config.pipeline_id,
            survey_date=config.survey_date,
            created_at=datetime.now(),
            sample_count=len(sample_records),
            critical_risk_count=critical_count,
            warning_risk_count=warning_count,
            risk_summary=risk_summary,
            samples=sample_records,
            config_snapshot={
                "cable_spec": config.cable_spec.model_dump(),
                "rov_spec": config.rov_spec.model_dump(),
                "risk_thresholds": config.risk_thresholds.model_dump()
            }
        )
        
        if valid_samples:
            analysis_record.max_top_tension = max(s.top_tension for s in valid_samples)
            analysis_record.min_top_tension = min(s.top_tension for s in valid_samples)
            analysis_record.avg_top_tension = sum(s.top_tension for s in valid_samples) / len(valid_samples)
            
            depths = [s.rov_depth for s in sample_records if s.rov_depth is not None]
            if depths:
                analysis_record.max_depth = max(depths)
                analysis_record.min_depth = min(depths)
                analysis_record.avg_depth = sum(depths) / len(depths)
            
            cable_lengths = [s.rov_cable_length for s in sample_records if s.rov_cable_length is not None]
            if cable_lengths:
                analysis_record.max_cable_length = max(cable_lengths)
                analysis_record.min_cable_length = min(cable_lengths)
                analysis_record.avg_cable_length = sum(cable_lengths) / len(cable_lengths)
            
            current_speeds = [s.current_speed for s in sample_records if s.current_speed is not None]
            if current_speeds:
                analysis_record.max_current_speed = max(current_speeds)
                analysis_record.avg_current_speed = sum(current_speeds) / len(current_speeds)
            
            offsets = [s.horizontal_offset for s in sample_records if s.horizontal_offset is not None]
            if offsets:
                analysis_record.max_horizontal_offset = max(offsets)
                analysis_record.avg_horizontal_offset = sum(offsets) / len(offsets)
            
            bending_samples = [s for s in valid_samples if s.minimum_bending_radius is not None]
            if bending_samples:
                min_bending = min(bending_samples, key=lambda s: s.minimum_bending_radius)
                analysis_record.min_bending_radius = min_bending.minimum_bending_radius
                analysis_record.min_bending_radius_location = min_bending.bending_radius_location
        
        base_path = Path(working_dir or '.') / config.output_directory
        repo = AnalysisRepository(str(base_path))
        
        analysis_id = repo.save_analysis(analysis_record)
        
        click.echo(click.style(f"✓ 分析结果已保存，ID: {analysis_id}", fg='green'))
        click.echo("")
        click.echo(click.style("提示: 使用 'rov-tension report' 导出报告，或 'rov-tension history' 查看历史", fg='cyan'))
    
    return sample_records
