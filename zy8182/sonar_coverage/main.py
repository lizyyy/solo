import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import click

from . import __version__
from .coverage import CoverageCalculator
from .loaders import (
    load_survey_lines_csv,
    load_track_jsonl,
    load_sonar_params_yaml,
    load_exclusion_zones_yaml,
    load_config_yaml
)
from .reports import ReportGenerator
from .risk_detection import RiskDetector


@click.group()
@click.version_option(version=__version__)
def main():
    pass


@main.command()
@click.option('--survey-lines', '-s', type=click.Path(exists=True), required=True,
              help='测线计划 CSV 文件')
@click.option('--track', '-t', type=click.Path(exists=True), required=True,
              help='导航轨迹 JSONL 文件')
@click.option('--sonar-params', '-p', type=click.Path(exists=True), required=True,
              help='声呐参数 YAML 文件')
@click.option('--exclusion-zones', '-z', type=click.Path(exists=True), default=None,
              help='禁采区规则 YAML 文件 (可选)')
@click.option('--config', '-c', type=click.Path(exists=True), default=None,
              help='配置文件 YAML (可选)')
@click.option('--date', '-d', type=str, default=None,
              help='基准日期 (用于处理跨午夜轨迹, 格式: YYYY-MM-DD)')
@click.option('--output-dir', '-o', type=click.Path(), default='.',
              help='输出目录 (默认: 当前目录)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
def check(
    survey_lines: str,
    track: str,
    sonar_params: str,
    exclusion_zones: Optional[str],
    config: Optional[str],
    date: Optional[str],
    output_dir: str,
    verbose: bool
):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    config_data = {}
    if config:
        config_data = load_config_yaml(config)
    
    base_date = None
    if date:
        try:
            base_date = datetime.strptime(date, '%Y-%m-%d').date()
        except ValueError:
            click.echo(f"错误: 无效的日期格式 '{date}', 请使用 YYYY-MM-DD", err=True)
            sys.exit(1)
    
    if verbose:
        click.echo("加载数据...")
    
    lines = load_survey_lines_csv(survey_lines)
    if verbose:
        click.echo(f"  加载了 {len(lines)} 条测线")
    
    track_points = load_track_jsonl(track, base_date=base_date)
    if verbose:
        click.echo(f"  加载了 {len(track_points)} 个轨迹点")
    
    sonar = load_sonar_params_yaml(sonar_params)
    if verbose:
        click.echo(f"  声呐扫幅: 左 {sonar.swath_width_left}m / 右 {sonar.swath_width_right}m")
    
    zones = []
    if exclusion_zones:
        zones = load_exclusion_zones_yaml(exclusion_zones)
        if verbose:
            click.echo(f"  加载了 {len(zones)} 个禁采区")
    
    if not track_points:
        click.echo("错误: 没有有效轨迹点", err=True)
        sys.exit(1)
    
    if not lines:
        click.echo("错误: 没有有效测线", err=True)
        sys.exit(1)
    
    if verbose:
        click.echo("\n计算覆盖...")
    
    calc_config = config_data.get('coverage', {})
    calculator = CoverageCalculator(
        survey_lines=lines,
        track_points=track_points,
        sonar_params=sonar,
        exclusion_zones=zones,
        config=calc_config
    )
    coverage_result = calculator.calculate()
    
    if verbose:
        click.echo(f"  覆盖率: {coverage_result.coverage_percentage:.1f}%")
        click.echo(f"  漏扫长度: {coverage_result.total_gap_length_m:.1f}m")
        click.echo(f"  重叠长度: {coverage_result.total_overlap_m:.1f}m")
    
    if verbose:
        click.echo("\n检测风险...")
    
    risk_config = config_data.get('risk', {})
    risk_detector = RiskDetector(track_points=track_points, config=risk_config)
    risk_result = risk_detector.detect()
    
    if verbose:
        click.echo(f"  时间乱序: {risk_result.out_of_order_count} 处")
        click.echo(f"  速度突变: {risk_result.speed_spike_count} 处")
    
    if verbose:
        click.echo("\n生成报告...")
    
    report_gen = ReportGenerator(
        coverage_result=coverage_result,
        risk_result=risk_result,
        survey_lines=lines,
        track_points=track_points,
        sonar_params=sonar
    )
    
    issues_csv = output_path / "issues.csv"
    report_gen.generate_issues_csv(str(issues_csv))
    if verbose:
        click.echo(f"  已生成: {issues_csv}")
    
    report_md = output_path / "coverage_report.md"
    report_gen.generate_markdown_report(str(report_md))
    if verbose:
        click.echo(f"  已生成: {report_md}")
    
    preview_html = output_path / "coverage_preview.html"
    report_gen.generate_html_preview(str(preview_html))
    if verbose:
        click.echo(f"  已生成: {preview_html}")
    
    total_issues = len(report_gen.issues)
    critical_count = sum(1 for i in report_gen.issues if i.severity.value == 'critical')
    high_count = sum(1 for i in report_gen.issues if i.severity.value == 'high')
    
    click.echo("\n" + "=" * 50)
    click.echo("测线覆盖复核完成")
    click.echo("=" * 50)
    click.echo(f"覆盖率: {coverage_result.coverage_percentage:.1f}%")
    click.echo(f"漏扫长度: {coverage_result.total_gap_length_m:.1f} 米")
    click.echo(f"重叠浪费: {coverage_result.total_overlap_m:.1f} 米")
    click.echo(f"问题总数: {total_issues} (CRITICAL: {critical_count}, HIGH: {high_count})")
    click.echo("\n输出文件:")
    click.echo(f"  - issues.csv")
    click.echo(f"  - coverage_report.md")
    click.echo(f"  - coverage_preview.html (可用浏览器打开)")
    
    if critical_count > 0 or coverage_result.coverage_percentage < 80:
        sys.exit(2)
    elif high_count > 0 or coverage_result.coverage_percentage < 90:
        sys.exit(1)


@main.command()
@click.option('--output-dir', '-o', type=click.Path(), default='sample_data',
              help='示例数据输出目录 (默认: sample_data)')
def generate_sample(output_dir: str):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    survey_lines_csv = output_path / "survey_lines.csv"
    survey_lines_csv.write_text("""line_id,start_lat,start_lon,end_lat,end_lon,swath_left,swath_right,swath_unit,planned_speed,speed_unit,notes
L001,30.5000,121.0000,30.5000,121.0050,100,100,meters,4,knots,主测线1
L002,30.5020,121.0000,30.5020,121.0050,100,100,meters,4,knots,主测线2
L003,30.5040,121.0000,30.5040,121.0050,100,100,meters,4,knots,主测线3
L004,30.5060,121.0000,30.5060,121.0050,100,100,meters,4,knots,主测线4
""")
    
    track_jsonl = output_path / "track.jsonl"
    track_jsonl.write_text("""{"timestamp": "10:00:00", "latitude": 30.5000, "longitude": 121.0000, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:01:00", "latitude": 30.5000, "longitude": 121.0008, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:02:00", "latitude": 30.5000, "longitude": 121.0016, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:03:00", "latitude": 30.5000, "longitude": 121.0024, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:04:00", "latitude": 30.5000, "longitude": 121.0032, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:05:00", "latitude": 30.5000, "longitude": 121.0040, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:06:00", "latitude": 30.5000, "longitude": 121.0048, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:07:00", "latitude": 30.5000, "longitude": 121.0050, "speed": 4.0, "heading": 90.0, "depth": 20.0}
{"timestamp": "10:10:00", "latitude": 30.5020, "longitude": 121.0000, "speed": 4.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:11:00", "latitude": 30.5020, "longitude": 121.0008, "speed": 4.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:12:00", "latitude": 30.5020, "longitude": 121.0016, "speed": 7.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:13:00", "latitude": 30.5020, "longitude": 121.0024, "speed": 4.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:14:00", "latitude": 30.5020, "longitude": 121.0032, "speed": 4.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:15:00", "latitude": 30.5020, "longitude": 121.0040, "speed": 4.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:16:00", "latitude": 30.5020, "longitude": 121.0050, "speed": 4.0, "heading": 90.0, "depth": 22.0}
{"timestamp": "10:20:00", "latitude": 30.5060, "longitude": 121.0000, "speed": 4.0, "heading": 90.0, "depth": 18.0}
{"timestamp": "10:21:00", "latitude": 30.5060, "longitude": 121.0008, "speed": 4.0, "heading": 90.0, "depth": 18.0}
{"timestamp": "10:22:00", "latitude": 30.5060, "longitude": 121.0016, "speed": 4.0, "heading": 90.0, "depth": 18.0}
{"timestamp": "10:23:00", "latitude": 30.5060, "longitude": 121.0024, "speed": 4.0, "heading": 90.0, "depth": 18.0}
{"timestamp": "10:24:00", "latitude": 30.5060, "longitude": 121.0032, "speed": 4.0, "heading": 90.0, "depth": 18.0}
{"timestamp": "10:25:00", "latitude": 30.5060, "longitude": 121.0040, "speed": 4.0, "heading": 90.0, "depth": 18.0}
{"timestamp": "10:26:00", "latitude": 30.5060, "longitude": 121.0050, "speed": 4.0, "heading": 90.0, "depth": 18.0}
""")
    
    sonar_yaml = output_path / "sonar_params.yaml"
    sonar_yaml.write_text("""sonar:
  frequency: 100.0
  swath_left: 100
  swath_right: 100
  range_scale: 100
  tvg: 20
  gain: 0
  unit: meters
  along_track_resolution: 0.5
  across_track_resolution: 0.1
""")
    
    exclusion_yaml = output_path / "exclusion_zones.yaml"
    exclusion_yaml.write_text("""exclusion_zones:
  - zone_id: Z001
    name: 养殖区A
    reason: 渔业养殖区，禁止进入
    priority: 1
    polygon:
      - lat: 30.5030
        lon: 121.0020
      - lat: 30.5030
        lon: 121.0035
      - lat: 30.5050
        lon: 121.0035
      - lat: 30.5050
        lon: 121.0020
""")
    
    click.echo(f"示例数据已生成到: {output_path.absolute()}")
    click.echo("")
    click.echo("文件列表:")
    click.echo(f"  - survey_lines.csv   (测线计划)")
    click.echo(f"  - track.jsonl        (导航轨迹)")
    click.echo(f"  - sonar_params.yaml  (声呐参数)")
    click.echo(f"  - exclusion_zones.yaml (禁采区规则)")
    click.echo("")
    click.echo("运行示例:")
    click.echo(f"  sonar-check check -s {output_path}/survey_lines.csv \\")
    click.echo(f"              -t {output_path}/track.jsonl \\")
    click.echo(f"              -p {output_path}/sonar_params.yaml \\")
    click.echo(f"              -z {output_path}/exclusion_zones.yaml \\")
    click.echo(f"              -o output_dir -v")


if __name__ == "__main__":
    main()
