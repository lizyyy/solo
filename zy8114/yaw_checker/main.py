import click
from pathlib import Path
from typing import Dict, Any, List
import pandas as pd

from .parsers import load_all_data
from .calculator import rebuild_timeline_for_turbine, calculate_turbine_statistics
from .rules import run_all_checks, DetectedIssue
from .reports import generate_all_reports


@click.command()
@click.option("--turbine", "-t", required=True, type=click.Path(exists=True, path_type=Path),
              help="turbine.csv 文件路径")
@click.option("--scada", "-s", required=True, type=click.Path(exists=True, path_type=Path),
              help="scada_10min.csv 文件路径")
@click.option("--rules", "-r", required=True, type=click.Path(exists=True, path_type=Path),
              help="wind_rules.yaml 文件路径")
@click.option("--output", "-o", default="./output", type=click.Path(path_type=Path),
              help="输出目录路径 (默认: ./output)")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def main(turbine: Path, scada: Path, rules: Path, output: Path, verbose: bool):
    """风电机组偏航效率复核器
    
    分析风电机组的 SCADA 数据，计算偏航误差、估算功率损失，
    检测风向仪漂移和长期对风偏差问题。
    
    输入文件:
    - turbine.csv: 机组信息
    - scada_10min.csv: 10分钟间隔的 SCADA 数据
    - wind_rules.yaml: 分析规则配置
    
    输出文件:
    - report.md: 分析报告
    - issues.csv: 检测到的问题列表
    - turbine_timeline.html: 交互式时间线可视化
    """
    
    click.echo("=" * 60)
    click.echo("风电机组偏航效率复核器")
    click.echo("=" * 60)
    click.echo("")
    
    click.echo("步骤 1/5: 加载输入数据...")
    try:
        turbine_df, scada_df, rules_dict = load_all_data(turbine, scada, rules)
        click.echo(f"  ✓ 成功加载 {len(turbine_df)} 台机组信息")
        click.echo(f"  ✓ 成功加载 {len(scada_df)} 条 SCADA 记录")
        
        if verbose:
            click.echo(f"  - 机组列表: {list(turbine_df['turbine_id'])}")
            click.echo(f"  - 规则配置: {rules_dict}")
    except Exception as e:
        click.echo(f"  ✗ 数据加载失败: {e}", err=True)
        raise click.Abort()
    
    click.echo("")
    click.echo("步骤 2/5: 重建时间线并计算偏航误差...")
    
    all_timelines: Dict[str, pd.DataFrame] = {}
    all_statistics: Dict[str, Dict[str, Any]] = {}
    
    for turbine_id in turbine_df["turbine_id"]:
        turbine_info = turbine_df[turbine_df["turbine_id"] == turbine_id].iloc[0]
        nacelle_offset = turbine_info.get("nacelle_direction_offset", 0.0)
        
        if verbose:
            click.echo(f"  处理机组 {turbine_id}...")
        
        timeline = rebuild_timeline_for_turbine(
            scada_df=scada_df,
            turbine_id=turbine_id,
            nacelle_offset=nacelle_offset,
            rules=rules_dict
        )
        
        all_timelines[turbine_id] = timeline
        
        stats = calculate_turbine_statistics(timeline)
        all_statistics[turbine_id] = stats
        
        if verbose:
            if stats.get("has_data", False):
                click.echo(f"    ✓ 有效采样: {stats['valid_samples']}, "
                          f"平均误差: {stats['mean_absolute_yaw_error_deg']:.2f}°, "
                          f"损失: {stats['total_power_loss_kwh']:.2f} kWh")
            else:
                click.echo(f"    ⚠ 无有效数据")
    
    click.echo(f"  ✓ 完成 {len(all_timelines)} 台机组的时间线重建")
    
    click.echo("")
    click.echo("步骤 3/5: 检测问题...")
    
    all_issues: List[DetectedIssue] = []
    
    for turbine_id, timeline in all_timelines.items():
        if verbose:
            click.echo(f"  检查机组 {turbine_id}...")
        
        issues = run_all_checks(timeline, rules_dict, turbine_id)
        all_issues.extend(issues)
        
        if verbose and issues:
            for issue in issues:
                click.echo(f"    ⚠ {issue.severity.value.upper()}: {issue.issue_type.value} - {issue.description}")
    
    click.echo(f"  ✓ 检测到 {len(all_issues)} 个问题")
    
    click.echo("")
    click.echo("步骤 4/5: 生成报告...")
    
    try:
        output_files = generate_all_reports(
            turbine_df=turbine_df,
            all_timelines=all_timelines,
            all_statistics=all_statistics,
            all_issues=all_issues,
            rules=rules_dict,
            output_dir=output
        )
        
        click.echo(f"  ✓ 报告已生成到: {output}")
        for name, path in output_files.items():
            click.echo(f"    - {path.name}")
    except Exception as e:
        click.echo(f"  ✗ 报告生成失败: {e}", err=True)
        raise click.Abort()
    
    click.echo("")
    click.echo("步骤 5/5: 汇总结果...")
    click.echo("")
    
    total_power_loss = sum(
        s.get("total_power_loss_kwh", 0) 
        for s in all_statistics.values() 
        if s.get("has_data", False)
    )
    
    critical_count = sum(1 for i in all_issues if i.severity.value == "critical")
    high_count = sum(1 for i in all_issues if i.severity.value == "high")
    medium_count = sum(1 for i in all_issues if i.severity.value == "medium")
    
    click.echo("=" * 60)
    click.echo("分析结果摘要")
    click.echo("=" * 60)
    click.echo(f"分析机组数: {len(turbine_df)} 台")
    click.echo(f"估算总功率损失: {total_power_loss:.2f} kWh")
    click.echo("")
    click.echo("问题统计:")
    if critical_count > 0:
        click.echo(f"  🔴 严重 (Critical): {critical_count} 个")
    if high_count > 0:
        click.echo(f"  🟠 高 (High): {high_count} 个")
    if medium_count > 0:
        click.echo(f"  🟡 中 (Medium): {medium_count} 个")
    if len(all_issues) == 0:
        click.echo("  ✅ 未检测到问题")
    click.echo("")
    click.echo("输出文件:")
    for name, path in output_files.items():
        click.echo(f"  📄 {path}")
    click.echo("")
    click.echo("=" * 60)
    click.echo("分析完成!")
    click.echo("=" * 60)


if __name__ == "__main__":
    main()