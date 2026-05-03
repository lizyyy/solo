#!/usr/bin/env python3
"""
野外踏勘风险计算员 - Field Risk Calculator
用于地质野外队出发前路线复核的命令行工具
"""

import click
import os
import sys
from pathlib import Path
from datetime import datetime

from .parsers.gpx_parser import GPXParser
from .parsers.dem_parser import DEMParser
from .parsers.weight_parser import WeightParser
from .parsers.weather_parser import WeatherParser
from .terrain.calculator import TerrainCalculator
from .risk.rules import RiskEngine, RiskConfig
from .exporters.markdown_exporter import MarkdownExporter
from .exporters.csv_exporter import CSVExporter
from .exporters.json_exporter import JSONExporter
from .risk.models import RiskLevel


@click.group()
@click.version_option(version='1.0.0', prog_name='field-risk-calc')
def cli():
    """野外踏勘风险计算员 - 地质野外路线风险评估工具"""
    pass


@cli.command()
@click.option('--gpx', '-g', required=True, type=click.Path(exists=True), help='路线 GPX 文件路径')
@click.option('--dem', '-d', required=True, type=click.Path(exists=True), help='DEM 高程 CSV 文件路径')
@click.option('--weight', '-w', required=True, type=click.Path(exists=True), help='队员负重表 CSV 文件路径')
@click.option('--weather', '-t', required=True, type=click.Path(exists=True), help='天气预报 JSON 文件路径')
@click.option('--output', '-o', type=click.Path(), help='输出文件前缀 (默认: 基于当前时间)')
@click.option('--output-dir', type=click.Path(), default='.', help='输出目录 (默认: 当前目录)')
@click.option('--max-slope', type=float, default=20.0, help='最大安全坡度百分比 (默认: 20.0)')
@click.option('--critical-slope', type=float, default=30.0, help='危险坡度百分比 (默认: 30.0)')
@click.option('--max-weight-ratio', type=float, default=30.0, help='最大负重比例百分比 (默认: 30.0)')
@click.option('--supply-interval', type=float, default=5.0, help='建议补给间隔公里数 (默认: 5.0)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
@click.option('--dry-run', is_flag=True, help='仅验证输入，不生成输出文件')
def assess(gpx, dem, weight, weather, output, output_dir, max_slope, critical_slope, max_weight_ratio, supply_interval, verbose, dry_run):
    """
    执行完整的风险评估流程
    
    导入 GPX 路线、DEM 高程、队员负重表和天气预报，
    计算分段坡度、累计爬升、预计耗水、风险等级和撤返点，
    导出 Markdown 行程建议、CSV 风险点和 JSON 审计包。
    """
    click.echo("=" * 60)
    click.echo("野外踏勘风险计算员 v1.0.0")
    click.echo("=" * 60)
    click.echo(f"评估时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("")

    output_prefix = output or f"risk_assessment_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    output_path = Path(output_dir) / output_prefix

    click.echo("【步骤 1/5】解析输入文件...")
    
    all_errors = []
    
    try:
        gpx_parser = GPXParser()
        gpx_parser.parse(gpx)
        gpx_errors = gpx_parser.validate()
        if gpx_errors:
            all_errors.extend([f"[GPX] {e}" for e in gpx_errors])
        if verbose:
            click.echo(f"  ✓ GPX 路线: {len(gpx_parser.get_all_route_points())} 个点")
    except Exception as e:
        all_errors.append(f"[GPX] 解析失败: {str(e)}")

    try:
        dem_parser = DEMParser()
        dem_parser.parse(dem)
        dem_errors = dem_parser.validate()
        if dem_errors:
            all_errors.extend([f"[DEM] {e}" for e in dem_errors])
        if verbose:
            click.echo(f"  ✓ DEM 高程: {len(dem_parser.points)} 个点")
    except Exception as e:
        all_errors.append(f"[DEM] 解析失败: {str(e)}")

    try:
        weight_parser = WeightParser()
        weight_parser.parse(weight)
        weight_errors = weight_parser.validate()
        if weight_errors:
            all_errors.extend([f"[负重表] {e}" for e in weight_errors])
        if verbose:
            click.echo(f"  ✓ 队员负重: {len(weight_parser.team_members)} 名队员")
    except Exception as e:
        all_errors.append(f"[负重表] 解析失败: {str(e)}")

    try:
        weather_parser = WeatherParser()
        weather_parser.parse(weather)
        weather_errors = weather_parser.validate()
        if weather_errors:
            all_errors.extend([f"[天气预报] {e}" for e in weather_errors])
        if verbose:
            click.echo(f"  ✓ 天气预报: {len(weather_parser.forecasts)} 天预报, {len(weather_parser.water_crossings)} 个涉水点")
    except Exception as e:
        all_errors.append(f"[天气预报] 解析失败: {str(e)}")

    if all_errors:
        click.echo("")
        click.echo("【验证错误】")
        for error in all_errors:
            click.echo(f"  ✗ {error}")
        click.echo("")
        click.echo("请修正上述错误后重试。")
        sys.exit(1)

    click.echo("  ✓ 所有文件解析成功")
    click.echo("")

    click.echo("【步骤 2/5】地形计算...")
    
    try:
        waypoints = gpx_parser.get_all_route_points()
        
        calculator = TerrainCalculator()
        segments = calculator.calculate_segments(waypoints)
        stats = calculator.calculate_statistics(segments)
        
        if verbose:
            click.echo(f"  路线总长: {stats.total_distance_2d/1000:.2f} km")
            click.echo(f"  累计爬升: {stats.total_elevation_gain:.0f} m")
            click.echo(f"  累计下降: {stats.total_elevation_loss:.0f} m")
            click.echo(f"  最大坡度: {stats.max_slope_percent:.1f}%")
            click.echo(f"  预计耗时: {stats.estimated_total_time:.1f} 小时")
            click.echo(f"  预计耗水: {stats.estimated_total_water:.1f} 升/人")
        
        click.echo("  ✓ 地形计算完成")
    except Exception as e:
        click.echo(f"  ✗ 地形计算失败: {str(e)}")
        sys.exit(1)
    
    click.echo("")

    click.echo("【步骤 3/5】风险评估...")
    
    try:
        risk_config = RiskConfig(
            max_safe_slope_percent=max_slope,
            critical_slope_percent=critical_slope,
            max_weight_ratio=max_weight_ratio,
            max_supply_interval_km=supply_interval
        )
        
        risk_engine = RiskEngine(config=risk_config)
        
        assessment = risk_engine.assess_all_risks(
            route_segments=segments,
            route_stats=stats,
            team_members=weight_parser.team_members,
            water_crossings=weather_parser.water_crossings,
            weather_forecasts=weather_parser.forecasts,
            waypoints=waypoints
        )
        
        click.echo(f"  总体风险等级: {_get_risk_icon(assessment.overall_risk_level)} {assessment.overall_risk_level.value}")
        
        risk_counts = assessment.risk_count_by_level
        click.echo(f"  风险点统计:")
        for level, count in risk_counts.items():
            if count > 0:
                click.echo(f"    {_get_risk_icon(level)} {level.value}: {count} 个")
        
        if verbose:
            click.echo(f"  撤返点: {len(assessment.retreat_points)} 个")
            click.echo(f"  补给点: {len(assessment.supply_points)} 个")
        
        click.echo("  ✓ 风险评估完成")
    except Exception as e:
        click.echo(f"  ✗ 风险评估失败: {str(e)}")
        sys.exit(1)
    
    click.echo("")

    if dry_run:
        click.echo("【演练模式】不生成输出文件")
        click.echo("")
        _show_summary(assessment, stats, weight_parser.team_members)
        click.echo("=" * 60)
        return

    click.echo("【步骤 4/5】生成输出文件...")
    
    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)
    
    try:
        md_exporter = MarkdownExporter()
        md_file = f"{output_path}_report.md"
        md_exporter.write(md_file, assessment, segments, stats, weight_parser.team_members)
        click.echo(f"  ✓ Markdown 报告: {md_file}")
    except Exception as e:
        click.echo(f"  ✗ Markdown 导出失败: {str(e)}")

    try:
        csv_exporter = CSVExporter()
        csv_files = csv_exporter.write_all(str(output_path), assessment)
        for name, file_path in csv_files.items():
            click.echo(f"  ✓ CSV {name}: {file_path}")
    except Exception as e:
        click.echo(f"  ✗ CSV 导出失败: {str(e)}")

    try:
        json_exporter = JSONExporter()
        json_file = f"{output_path}_audit.json"
        
        input_files = {
            'gpx': gpx,
            'dem': dem,
            'weight': weight,
            'weather': weather
        }
        
        json_exporter.write_audit_package(
            file_path=json_file,
            assessment=assessment,
            segments=segments,
            stats=stats,
            waypoints=waypoints,
            team_members=weight_parser.team_members,
            weather_forecasts=weather_parser.forecasts,
            water_crossings=weather_parser.water_crossings,
            input_files=input_files
        )
        click.echo(f"  ✓ JSON 审计包: {json_file}")
    except Exception as e:
        click.echo(f"  ✗ JSON 导出失败: {str(e)}")
    
    click.echo("")

    click.echo("【步骤 5/5】生成评估摘要...")
    _show_summary(assessment, stats, weight_parser.team_members)
    
    click.echo("")
    click.echo("=" * 60)
    if assessment.overall_risk_level == RiskLevel.CRITICAL:
        click.echo("【重要警告】存在极高风险点，强烈建议重新评估行程！")
    elif assessment.overall_risk_level == RiskLevel.HIGH:
        click.echo("【警告】存在高风险点，请谨慎对待！")
    elif assessment.overall_risk_level == RiskLevel.MEDIUM:
        click.echo("【注意】存在中风险点，请注意安全。")
    else:
        click.echo("【安全】整体风险较低，可以出发。")
    click.echo("=" * 60)


def _get_risk_icon(level: RiskLevel) -> str:
    icons = {
        RiskLevel.LOW: "🟢",
        RiskLevel.MEDIUM: "🟡",
        RiskLevel.HIGH: "🟠",
        RiskLevel.CRITICAL: "🔴"
    }
    return icons.get(level, "⚪")


def _show_summary(assessment, stats, team_members):
    click.echo("")
    click.echo("--- 评估摘要 ---")
    click.echo("")
    click.echo("【路线统计】")
    click.echo(f"  总长: {stats.total_distance_2d/1000:.2f} km")
    click.echo(f"  累计爬升: {stats.total_elevation_gain:.0f} m")
    click.echo(f"  预计耗时: {stats.estimated_total_time:.1f} 小时")
    click.echo(f"  预计耗水: {stats.estimated_total_water:.1f} 升/人")
    
    click.echo("")
    click.echo("【队员情况】")
    for member in team_members:
        status = "⚠️ 超限" if member.pack_weight > member.max_recommended_weight else "✓ 正常"
        click.echo(f"  {member.name} ({member.role}): {member.pack_weight}kg / {member.weight_ratio:.1f}% [{status}]")
    
    click.echo("")
    click.echo("【关键建议】")
    for rec in assessment.recommendations[:5]:
        click.echo(f"  • {rec}")


@cli.command()
@click.option('--gpx', '-g', type=click.Path(exists=True), help='GPX 文件路径')
@click.option('--dem', '-d', type=click.Path(exists=True), help='DEM CSV 文件路径')
@click.option('--weight', '-w', type=click.Path(exists=True), help='负重表 CSV 文件路径')
@click.option('--weather', '-t', type=click.Path(exists=True), help='天气预报 JSON 文件路径')
@click.option('--all', '-a', is_flag=True, help='验证所有类型的文件格式')
def validate(gpx, dem, weight, weather, all):
    """验证输入文件格式是否正确"""
    click.echo("验证输入文件格式...")
    click.echo("")
    
    errors = []
    
    if gpx or all:
        if not gpx:
            click.echo("请提供 --gpx 参数")
            sys.exit(1)
        click.echo(f"验证 GPX 文件: {gpx}")
        try:
            parser = GPXParser()
            parser.parse(gpx)
            errs = parser.validate()
            if errs:
                errors.extend([f"[GPX] {e}" for e in errs])
                for e in errs:
                    click.echo(f"  ✗ {e}")
            else:
                click.echo(f"  ✓ 有效，共 {len(parser.get_all_route_points())} 个路线点")
        except Exception as e:
            errors.append(f"[GPX] 解析失败: {str(e)}")
            click.echo(f"  ✗ 解析失败: {str(e)}")
        click.echo("")
    
    if dem or all:
        if not dem:
            click.echo("请提供 --dem 参数")
            sys.exit(1)
        click.echo(f"验证 DEM 文件: {dem}")
        try:
            parser = DEMParser()
            parser.parse(dem)
            errs = parser.validate()
            if errs:
                errors.extend([f"[DEM] {e}" for e in errs])
                for e in errs:
                    click.echo(f"  ✗ {e}")
            else:
                click.echo(f"  ✓ 有效，共 {len(parser.points)} 个高程点")
        except Exception as e:
            errors.append(f"[DEM] 解析失败: {str(e)}")
            click.echo(f"  ✗ 解析失败: {str(e)}")
        click.echo("")
    
    if weight or all:
        if not weight:
            click.echo("请提供 --weight 参数")
            sys.exit(1)
        click.echo(f"验证负重表: {weight}")
        try:
            parser = WeightParser()
            parser.parse(weight)
            errs = parser.validate()
            if errs:
                errors.extend([f"[负重表] {e}" for e in errs])
                for e in errs:
                    click.echo(f"  ✗ {e}")
            else:
                click.echo(f"  ✓ 有效，共 {len(parser.team_members)} 名队员")
        except Exception as e:
            errors.append(f"[负重表] 解析失败: {str(e)}")
            click.echo(f"  ✗ 解析失败: {str(e)}")
        click.echo("")
    
    if weather or all:
        if not weather:
            click.echo("请提供 --weather 参数")
            sys.exit(1)
        click.echo(f"验证天气预报: {weather}")
        try:
            parser = WeatherParser()
            parser.parse(weather)
            errs = parser.validate()
            if errs:
                errors.extend([f"[天气预报] {e}" for e in errs])
                for e in errs:
                    click.echo(f"  ✗ {e}")
            else:
                click.echo(f"  ✓ 有效，共 {len(parser.forecasts)} 天预报, {len(parser.water_crossings)} 个涉水点")
        except Exception as e:
            errors.append(f"[天气预报] 解析失败: {str(e)}")
            click.echo(f"  ✗ 解析失败: {str(e)}")
        click.echo("")
    
    if errors:
        click.echo(f"发现 {len(errors)} 个错误，请修正后重试。")
        sys.exit(1)
    else:
        click.echo("所有验证通过！")


@cli.command()
def examples():
    """显示示例数据文件格式说明"""
    click.echo("=" * 60)
    click.echo("野外踏勘风险计算员 - 数据格式说明")
    click.echo("=" * 60)
    click.echo("")
    
    click.echo("【1. GPX 路线文件】")
    click.echo("  标准 GPX 格式，包含路线点 (rtept) 或轨迹 (trkseg/trkpt)")
    click.echo("  必须包含经纬度，建议包含高程信息")
    click.echo("")
    
    click.echo("【2. DEM 高程 CSV 文件】")
    click.echo("  列: lat, lon, elevation [, slope, aspect]")
    click.echo("  示例:")
    click.echo("    lat,lon,elevation")
    click.echo("    34.12345,108.67890,1200")
    click.echo("    34.12350,108.67895,1250")
    click.echo("")
    
    click.echo("【3. 队员负重表 CSV 文件】")
    click.echo("  列: name, role, body_weight, pack_weight, max_recommended_weight [, gear_list]")
    click.echo("  示例:")
    click.echo("    name,role,body_weight,pack_weight,max_recommended_weight,gear_list")
    click.echo("    张三,队长,70,22,25,GPS;地图;指南针;急救包")
    click.echo("    李四,队员,65,20,22,相机;样本袋;锤子")
    click.echo("")
    
    click.echo("【4. 天气预报 JSON 文件】")
    click.echo("  包含 forecasts (预报数组) 和 water_crossings (涉水点数组)")
    click.echo("  示例:")
    click.echo("    {")
    click.echo("      \"forecasts\": [")
    click.echo("        {")
    click.echo("          \"date\": \"2026-05-03\",")
    click.echo("          \"temperature\": 25,")
    click.echo("          \"humidity\": 60,")
    click.echo("          \"wind_speed\": 5,")
    click.echo("          \"precipitation_probability\": 10,")
    click.echo("          \"condition\": \"晴朗\"")
    click.echo("        }")
    click.echo("      ],")
    click.echo("      \"water_crossings\": [")
    click.echo("        {")
    click.echo("          \"name\": \"东河涉水点\",")
    click.echo("          \"lat\": 34.12345,")
    click.echo("          \"lon\": 108.67890,")
    click.echo("          \"current_depth\": 0.4,")
    click.echo("          \"warning_depth\": 0.5,")
    click.echo("          \"danger_depth\": 0.8")
    click.echo("        }")
    click.echo("      ]")
    click.echo("    }")
    click.echo("")
    
    click.echo("使用 'field-risk-calc assess --help' 查看完整命令说明")


if __name__ == '__main__':
    cli()
