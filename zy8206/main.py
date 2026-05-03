import click
import os
from pathlib import Path

from protection_coord.parser import InputParser
from protection_coord.topology import TopologyBuilder
from protection_coord.calculator import CoordinationCalculator
from protection_coord.rules import RuleEngine
from protection_coord.reporter import Reporter


@click.group()
def cli():
    """配网馈线保护配合复核工具"""
    pass


@cli.command()
@click.option("--feeder", required=True, type=click.Path(exists=True), help="馈线拓扑文件 (feeder.json)")
@click.option("--settings", required=True, type=click.Path(exists=True), help="保护定值文件 (settings.csv)")
@click.option("--fault-cases", required=True, type=click.Path(exists=True), help="故障案例文件 (fault_cases.yaml)")
@click.option("--devices", required=True, type=click.Path(exists=True), help="设备信息文件 (devices.csv)")
@click.option("--output-dir", default="./output", help="输出目录 (默认: ./output)")
@click.option("--verbose", is_flag=True, help="显示详细信息")
def check(feeder, settings, fault_cases, devices, output_dir, verbose):
    """复核保护配合，生成分析报告"""
    
    click.echo("=" * 60)
    click.echo("配网馈线保护配合复核工具")
    click.echo("=" * 60)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    if verbose:
        click.echo(f"\n[INFO] 输入文件:")
        click.echo(f"  - 馈线拓扑: {feeder}")
        click.echo(f"  - 保护定值: {settings}")
        click.echo(f"  - 故障案例: {fault_cases}")
        click.echo(f"  - 设备信息: {devices}")
        click.echo(f"  - 输出目录: {output_path}")
    
    click.echo("\n[步骤 1/5] 解析输入文件...")
    parser = InputParser()
    input_data = parser.parse_all(feeder, settings, fault_cases, devices)
    
    if verbose:
        click.echo(f"  解析完成:")
        click.echo(f"    - 馈线节点数: {len(input_data['feeder'].get('nodes', []))}")
        click.echo(f"    - 保护装置数: {len(input_data['settings'])}")
        click.echo(f"    - 故障案例数: {len(input_data['fault_cases'])}")
        click.echo(f"    - 设备数: {len(input_data['devices'])}")
    
    click.echo("\n[步骤 2/5] 建立馈线拓扑...")
    topology_builder = TopologyBuilder(input_data['feeder'])
    topology = topology_builder.build()
    
    if verbose:
        click.echo(f"  拓扑结构:")
        click.echo(f"    - 根节点: {topology.root_node}")
        click.echo(f"    - 保护装置位置: {list(topology.protection_devices.keys())}")
    
    click.echo("\n[步骤 3/5] 计算保护配合参数...")
    calculator = CoordinationCalculator(topology, input_data)
    coordination_results = calculator.calculate_all()
    
    if verbose:
        click.echo(f"  计算完成:")
        click.echo(f"    - 分析故障点: {len(coordination_results)}")
    
    click.echo("\n[步骤 4/5] 应用配合规则检测风险...")
    rule_engine = RuleEngine()
    issues = rule_engine.evaluate_all(coordination_results, input_data)
    
    click.echo(f"  检测到 {len(issues)} 个问题:")
    severity_counts = {'high': 0, 'medium': 0, 'low': 0}
    for issue in issues:
        severity_counts[issue.get('severity', 'low')] += 1
    
    click.echo(f"    - 严重: {severity_counts['high']}")
    click.echo(f"    - 中等: {severity_counts['medium']}")
    click.echo(f"    - 轻微: {severity_counts['low']}")
    
    click.echo("\n[步骤 5/5] 生成报告...")
    reporter = Reporter(output_path)
    
    issues_file = reporter.export_issues(issues)
    click.echo(f"  - 问题清单: {issues_file}")
    
    report_file = reporter.generate_markdown_report(coordination_results, issues, input_data)
    click.echo(f"  - 配合报告: {report_file}")
    
    html_file = reporter.generate_html_curve_preview(coordination_results, input_data)
    click.echo(f"  - 曲线预览: {html_file}")
    
    click.echo("\n" + "=" * 60)
    click.echo("分析完成!")
    click.echo(f"输出文件位于: {output_path.absolute()}")
    click.echo("=" * 60)


@cli.command()
@click.option("--output-dir", default="./samples", help="示例数据输出目录 (默认: ./samples)")
def generate_samples(output_dir):
    """生成示例输入数据文件"""
    from protection_coord.sample_data import SampleDataGenerator
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    click.echo("生成示例数据文件...")
    
    generator = SampleDataGenerator()
    files = generator.generate_all(output_path)
    
    click.echo("\n生成的文件:")
    for name, path in files.items():
        click.echo(f"  - {name}: {path}")
    
    click.echo(f"\n使用示例:")
    click.echo(f"  feeder-coord check \\\n    --feeder {files['feeder']} \\\n    --settings {files['settings']} \\\n    --fault-cases {files['fault_cases']} \\\n    --devices {files['devices']} \\\n    --output-dir ./output")


def main():
    cli()


if __name__ == "__main__":
    main()
