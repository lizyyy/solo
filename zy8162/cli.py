#!/usr/bin/env python3
"""
执法记录仪取证包工具
用于给施工现场执法记录仪生成事故片段取证包
"""

import click
import json
import sys
from pathlib import Path
from typing import Optional

from evidence_tool.processor import EvidenceProcessor, __version__


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.option('--config', '-c', type=click.Path(exists=True), help='配置文件路径')
@click.pass_context
def cli(ctx, config):
    """
    执法记录仪取证包工具 - 用于生成和验证事故片段取证包
    
    示例:
      # 导入数据
      evidence ingest ./source_data
    
      # 验证取证包
      evidence verify ./evidence_package
    
      # 导出取证包
      evidence export -o ./evidence_package
    """
    ctx.ensure_object(dict)
    ctx.obj['config'] = config


@cli.command()
@click.argument('source_dir', type=click.Path(exists=True, file_okay=False))
@click.option('--manifest', '-m', type=click.Path(exists=True), help='视频清单CSV文件路径')
@click.option('--nmea', '-n', type=click.Path(exists=True), help='GPS/NMEA日志文件路径')
@click.option('--calibration', '-c', type=click.Path(exists=True), help='时钟校准JSON文件路径')
@click.option('--no-hash', is_flag=True, help='跳过哈希计算')
@click.option('--strict', is_flag=True, help='严格模式，遇到缺失文件时报错')
@click.option('--gap-threshold', type=float, default=60.0, help='缺段检测阈值（秒），默认60秒')
@click.option('--drift-threshold', type=float, default=5.0, help='时钟漂移阈值（秒），默认5秒')
@click.option('--jump-threshold', type=float, default=100.0, help='GPS跳点阈值（米），默认100米')
@click.option('--output', '-o', type=click.Path(), help='导出取证包到指定目录')
@click.option('--json', 'output_json', is_flag=True, help='以JSON格式输出结果')
@click.pass_context
def ingest(
    ctx,
    source_dir,
    manifest,
    nmea,
    calibration,
    no_hash,
    strict,
    gap_threshold,
    drift_threshold,
    jump_threshold,
    output,
    output_json
):
    """
    导入并处理数据源
    
    从指定目录读取 video_manifest.csv、GPS/NMEA日志和时钟校准JSON，
    进行时间线归并、哈希计算和异常检测。
    """
    click.echo(f"正在导入数据源: {source_dir}")
    
    processor = EvidenceProcessor(
        gap_threshold_seconds=gap_threshold,
        clock_drift_threshold_seconds=drift_threshold,
        gps_jump_threshold_meters=jump_threshold
    )
    
    try:
        package = processor.ingest(
            source_dir=source_dir,
            manifest_path=manifest,
            nmea_path=nmea,
            calibration_path=calibration,
            calculate_hashes=not no_hash,
            skip_missing_files=not strict
        )
        
        summary = processor.get_summary(package)
        
        if output_json:
            click.echo(json.dumps(summary, ensure_ascii=False, indent=2))
        else:
            _print_summary(summary)
        
        if output:
            exported = processor.export(output, package)
            click.echo(f"\n取证包已导出到: {output}")
            for file_type, file_path in exported.items():
                click.echo(f"  - {file_type}: {file_path}")
        
        ctx.obj['last_package'] = package
        return package
        
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('package_dir', type=click.Path(exists=True, file_okay=False))
@click.option('--expected-hashes', '-e', type=click.Path(exists=True), help='预期哈希值JSON文件')
@click.option('--json', 'output_json', is_flag=True, help='以JSON格式输出结果')
@click.pass_context
def verify(ctx, package_dir, expected_hashes, output_json):
    """
    验证取证包的完整性
    
    检查视频文件的哈希值是否与 manifest.json 中记录的一致。
    """
    click.echo(f"正在验证取证包: {package_dir}")
    
    processor = EvidenceProcessor()
    
    expected_hashes_dict = None
    if expected_hashes:
        with open(expected_hashes, 'r', encoding='utf-8') as f:
            expected_hashes_dict = json.load(f)
    
    try:
        result = processor.verify(package_dir, expected_hashes_dict)
        
        if output_json:
            click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            _print_verification_result(result)
        
        return result
        
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--output', '-o', type=click.Path(), required=True, help='输出目录路径')
@click.option('--source', '-s', type=click.Path(exists=True), help='源数据目录（用于重新导入）')
@click.option('--package-id', '-p', help='指定包ID（可选）')
@click.pass_context
def export(ctx, output, source, package_id):
    """
    导出取证包
    
    将处理后的数据导出为 evidence_package 格式，包含：
    - manifest.json: 取证包元数据和哈希清单
    - timeline.md: 时间线报告
    - anomalies.csv: 异常列表
    """
    if source:
        click.echo(f"正在从源数据重新导入: {source}")
        processor = EvidenceProcessor()
        processor.ingest(source_dir=source)
    elif 'last_package' in ctx.obj:
        processor = EvidenceProcessor()
        processor.last_package = ctx.obj['last_package']
    else:
        click.echo("错误: 请先使用 ingest 命令导入数据，或使用 --source 指定源数据目录", err=True)
        sys.exit(1)
    
    try:
        exported = processor.export(output)
        
        click.echo(f"取证包已成功导出到: {output}")
        click.echo("")
        click.echo("导出的文件:")
        for file_type, file_path in exported.items():
            click.echo(f"  - {file_type}: {file_path}")
        
        return exported
        
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.command('list-anomalies')
@click.option('--source', '-s', type=click.Path(exists=True), help='源数据目录')
@click.option('--package', '-p', type=click.Path(exists=True, file_okay=False), help='取证包目录')
@click.option('--type', '-t', 'anomaly_type', help='按类型筛选异常')
@click.option('--severity', '-l', help='按严重程度筛选')
@click.option('--json', 'output_json', is_flag=True, help='以JSON格式输出')
@click.pass_context
def list_anomalies(ctx, source, package, anomaly_type, severity, output_json):
    """
    列出检测到的异常
    
    可以按类型或严重程度筛选异常。
    """
    processor = EvidenceProcessor()
    
    if source:
        package = processor.ingest(source_dir=source, calculate_hashes=False)
    elif package:
        manifest_path = Path(package) / 'manifest.json'
        if manifest_path.exists():
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
            click.echo(f"从取证包读取异常: {package}")
            anomalies = manifest_data.get('anomalies_summary', {})
            if output_json:
                click.echo(json.dumps(anomalies, ensure_ascii=False, indent=2))
            else:
                click.echo(f"总异常数: {anomalies.get('total_count', 0)}")
                click.echo(f"\n按类型统计:")
                for typ, count in anomalies.get('by_type', {}).items():
                    click.echo(f"  - {typ}: {count}")
                click.echo(f"\n按严重程度统计:")
                for sev, count in anomalies.get('by_severity', {}).items():
                    click.echo(f"  - {sev}: {count}")
            return
    elif 'last_package' in ctx.obj:
        package = ctx.obj['last_package']
    else:
        click.echo("错误: 请使用 --source 或 --package 指定数据源", err=True)
        sys.exit(1)
    
    if hasattr(package, 'anomalies'):
        anomalies = package.anomalies
        
        if anomaly_type:
            anomalies = [a for a in anomalies if a.anomaly_type.value == anomaly_type]
        
        if severity:
            anomalies = [a for a in anomalies if a.severity.value == severity]
        
        if output_json:
            result = []
            for a in anomalies:
                result.append({
                    'type': a.anomaly_type.value,
                    'severity': a.severity.value,
                    'timestamp': a.timestamp.isoformat() if a.timestamp else None,
                    'description': a.description,
                    'affected_files': a.affected_files
                })
            click.echo(json.dumps(result, ensure_ascii=False, indent=2))
        else:
            click.echo(f"找到 {len(anomalies)} 个异常:")
            for i, a in enumerate(anomalies, 1):
                click.echo(f"\n{i}. [{a.severity.value.upper()}] {a.anomaly_type.value}")
                click.echo(f"   描述: {a.description}")
                if a.timestamp:
                    click.echo(f"   时间: {a.timestamp}")


def _print_summary(summary):
    """打印处理摘要"""
    click.echo("\n" + "=" * 60)
    click.echo("处理摘要")
    click.echo("=" * 60)
    
    click.echo(f"\n包ID: {summary['package_id']}")
    click.echo(f"生成时间: {summary['generated_at']}")
    click.echo(f"工具版本: {summary['tool_version']}")
    click.echo(f"源目录: {summary['source_directory']}")
    
    click.echo("\n时间线信息:")
    timeline = summary['timeline']
    click.echo(f"  开始时间: {timeline['start_time']}")
    click.echo(f"  结束时间: {timeline['end_time']}")
    click.echo(f"  视频片段数: {timeline['video_segments_count']}")
    click.echo(f"  GPS轨迹点数: {timeline['gps_points_count']}")
    click.echo(f"  时钟校准数: {timeline['clock_calibrations_count']}")
    if 'coverage_percent' in timeline:
        click.echo(f"  时间线覆盖率: {timeline['coverage_percent']}%")
    
    click.echo(f"\n哈希清单数: {summary['hash_manifest_count']}")
    
    anomalies = summary['anomalies']
    click.echo(f"\n异常检测结果:")
    click.echo(f"  总异常数: {anomalies['total_count']}")
    
    if anomalies['by_type']:
        click.echo(f"\n  按类型统计:")
        for typ, count in anomalies['by_type'].items():
            click.echo(f"    - {typ}: {count}")
    
    if anomalies['by_severity']:
        click.echo(f"\n  按严重程度统计:")
        for sev, count in anomalies['by_severity'].items():
            click.echo(f"    - {sev}: {count}")
    
    click.echo("\n" + "=" * 60)


def _print_verification_result(result):
    """打印验证结果"""
    click.echo("\n" + "=" * 60)
    click.echo("验证结果")
    click.echo("=" * 60)
    
    status = "通过" if result['valid'] else "失败"
    click.echo(f"\n整体状态: {status}")
    click.echo(f"总文件数: {result['total_files']}")
    click.echo(f"有效文件: {result['valid_files']}")
    click.echo(f"无效文件: {result['invalid_files']}")
    
    if not result['valid']:
        click.echo("\n无效文件详情:")
        for r in result['results']:
            if not r['is_valid']:
                click.echo(f"\n  文件: {r['filename']}")
                click.echo(f"  预期哈希: {r['expected_hash']}")
                click.echo(f"  实际哈希: {r['actual_hash']}")
    
    click.echo("\n" + "=" * 60)


if __name__ == '__main__':
    cli()
