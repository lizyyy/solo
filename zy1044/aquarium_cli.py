#!/usr/bin/env python3
"""
鱼缸水质模拟和换水风险预演工具 - CLI 入口
"""
import os
import sys
from typing import Optional, Tuple

import click

from aquarium_sim.models import SimulationResult, RiskLevel
from aquarium_sim.parser import DataParser, ParseError
from aquarium_sim.validator import DataValidator
from aquarium_sim.simulator import run_simulation
from aquarium_sim.risk_assessor import RiskAssessor
from aquarium_sim.reporter import ReportGenerator


def load_and_simulate(file_path: str) -> Tuple[bool, Optional[SimulationResult], list, list]:
    """加载场景文件并执行模拟"""
    try:
        scenario = DataParser.parse_file(file_path)
    except ParseError as e:
        click.echo(f"❌ 数据解析错误: {e}", err=True)
        return False, None, [], [str(e)]

    is_valid, errors, warnings = DataValidator.validate(scenario)

    if warnings:
        for w in warnings:
            click.echo(f"⚠️  警告: {w}")

    if not is_valid:
        for e in errors:
            click.echo(f"❌ 错误: {e}", err=True)
        return False, None, errors, warnings

    daily_quality, simulation_summary = run_simulation(scenario)
    daily_risks, overall_summary = RiskAssessor.assess_all(
        daily_quality, scenario, simulation_summary
    )

    result = SimulationResult(
        scenario=scenario,
        daily_quality=daily_quality,
        daily_risks=daily_risks,
        summary=overall_summary
    )

    return True, result, [], warnings


def print_summary(result: SimulationResult):
    """打印简要摘要"""
    overall = result.summary
    sim_summary = overall.get('simulation_summary', {})

    click.echo("\n" + "=" * 50)
    click.echo(f"📊 模拟结果摘要 - {result.scenario.name}")
    click.echo("=" * 50)

    max_risk = overall['max_risk_text']
    risk_color = {
        '安全': 'green',
        '偏高': 'yellow',
        '危险': 'red',
        '极危险': 'red'
    }.get(max_risk, 'white')

    click.echo(f"\n最高风险等级: {click.style(max_risk, fg=risk_color, bold=True)}")
    click.echo(f"安全天数: {overall['safe_days']} 天")
    click.echo(f"偏高天数: {overall['warning_days']} 天")
    click.echo(f"危险天数: {overall['danger_days']} 天")

    if overall['first_danger_day'] is not None:
        click.echo(f"⚠️  首次危险出现在第 {overall['first_danger_day']} 天")

    click.echo(f"\n📈 水质趋势:")
    click.echo(f"  氨氮: {sim_summary.get('ammonia_trend', '-')} (最高: {sim_summary.get('max_ammonia', 0):.4f} mg/L)")
    click.echo(f"  亚硝酸盐: {sim_summary.get('nitrite_trend', '-')} (最高: {sim_summary.get('max_nitrite', 0):.4f} mg/L)")
    click.echo(f"  硝酸盐: {sim_summary.get('nitrate_trend', '-')} (最高: {sim_summary.get('max_nitrate', 0):.2f} mg/L)")

    if overall['high_risk_factors']:
        click.echo(f"\n⚠️  高风险因素:")
        for factor in overall['high_risk_factors']:
            click.echo(f"  - {factor}")

    click.echo(f"\n💡 总体建议:")
    for suggestion in overall['overall_suggestions'][:3]:
        click.echo(f"  - {suggestion}")


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """
    🐠 鱼缸水质模拟和换水风险预演工具

    用于模拟鱼缸水质变化，预测换水、喂食、加鱼等操作对水质的影响。
    """
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output-md', '-m', type=click.Path(), help='输出 Markdown 报告路径')
@click.option('--output-html', '-h', type=click.Path(), help='输出 HTML 报告路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
def run(input_file, output_md, output_html, verbose):
    """
    运行单个场景的水质模拟

    INPUT_FILE: 场景数据文件路径（支持 .json 和 .csv）
    """
    click.echo(f"🔄 加载场景: {input_file}")

    success, result, errors, warnings = load_and_simulate(input_file)

    if not success:
        sys.exit(1)

    print_summary(result)

    if output_md:
        ReportGenerator.generate_markdown(result, output_md)
        click.echo(f"\n✅ Markdown 报告已生成: {output_md}")

    if output_html:
        ReportGenerator.generate_html(result, output_html)
        click.echo(f"✅ HTML 报告已生成: {output_html}")

    if verbose:
        overall = result.summary
        if len(overall['overall_suggestions']) > 3:
            click.echo(f"\n📋 完整建议列表:")
            for suggestion in overall['overall_suggestions'][3:]:
                click.echo(f"  - {suggestion}")


@cli.command()
@click.argument('input_file1', type=click.Path(exists=True))
@click.argument('input_file2', type=click.Path(exists=True))
@click.option('--output-md', '-m', type=click.Path(), help='输出 Markdown 报告路径')
@click.option('--output-html', '-h', type=click.Path(), help='输出 HTML 报告路径')
def compare(input_file1, input_file2, output_md, output_html):
    """
    对比两个换水方案

    INPUT_FILE1: 第一个场景文件（方案 A）
    INPUT_FILE2: 第二个场景文件（方案 B）
    """
    click.echo(f"🔄 加载方案 A: {input_file1}")
    success1, result1, errors1, warnings1 = load_and_simulate(input_file1)

    click.echo(f"🔄 加载方案 B: {input_file2}")
    success2, result2, errors2, warnings2 = load_and_simulate(input_file2)

    if not success1 or not success2:
        if not success1:
            click.echo("❌ 方案 A 加载失败", err=True)
        if not success2:
            click.echo("❌ 方案 B 加载失败", err=True)
        sys.exit(1)

    click.echo("\n" + "=" * 60)
    click.echo("📊 方案对比结果")
    click.echo("=" * 60)

    overall1 = result1.summary
    overall2 = result2.summary
    sim1 = overall1.get('simulation_summary', {})
    sim2 = overall2.get('simulation_summary', {})

    click.echo(f"\n{'指标':<15} {'方案 A':<25} {'方案 B':<25}")
    click.echo("-" * 60)
    click.echo(f"{'场景名称':<15} {result1.scenario.name:<25} {result2.scenario.name:<25}")
    click.echo(f"{'最高风险':<15} {overall1['max_risk_text']:<25} {overall2['max_risk_text']:<25}")
    click.echo(f"{'安全天数':<15} {overall1['safe_days']} 天{'':<22} {overall2['safe_days']} 天{'':<22}")
    click.echo(f"{'危险天数':<15} {overall1['danger_days']} 天{'':<22} {overall2['danger_days']} 天{'':<22}")
    click.echo(f"{'最大氨氮':<15} {sim1.get('max_ammonia', 0):.4f} mg/L{'':<20} {sim2.get('max_ammonia', 0):.4f} mg/L{'':<20}")
    click.echo(f"{'最大亚硝酸盐':<15} {sim1.get('max_nitrite', 0):.4f} mg/L{'':<20} {sim2.get('max_nitrite', 0):.4f} mg/L{'':<20}")
    click.echo(f"{'最大硝酸盐':<15} {sim1.get('max_nitrate', 0):.2f} mg/L{'':<20} {sim2.get('max_nitrate', 0):.2f} mg/L{'':<20}")

    score1 = overall1['safe_days'] - overall1['danger_days'] * 10
    score2 = overall2['safe_days'] - overall2['danger_days'] * 10

    click.echo("\n" + "-" * 60)
    if score1 > score2:
        click.echo(click.style(f"🏆 推荐方案 A ({result1.scenario.name})，整体风险更低。", fg='green', bold=True))
    elif score2 > score1:
        click.echo(click.style(f"🏆 推荐方案 B ({result2.scenario.name})，整体风险更低。", fg='green', bold=True))
    else:
        click.echo("⚖️  两个方案风险相当，可根据实际情况选择。")

    if output_md:
        ReportGenerator.generate_markdown(result1, output_md, result2)
        click.echo(f"\n✅ Markdown 报告已生成: {output_md}")

    if output_html:
        ReportGenerator.generate_html(result1, output_html, result2)
        click.echo(f"✅ HTML 报告已生成: {output_html}")


@cli.command()
@click.option('--output-dir', '-o', type=click.Path(), default='examples', help='示例文件输出目录')
def examples(output_dir):
    """
    生成示例数据文件

    在指定目录创建示例 JSON 和 CSV 文件，包括正常样例和异常样例。
    """
    os.makedirs(output_dir, exist_ok=True)

    normal_json = '''{
  "name": "正常维护场景",
  "tank_volume": 50,
  "fish": [
    {"size": "small", "quantity": 6},
    {"size": "medium", "quantity": 2}
  ],
  "filtration_level": "medium",
  "daily_feeding_amount": 2.5,
  "initial_ammonia": 0.02,
  "initial_nitrite": 0.01,
  "initial_nitrate": 25.0,
  "initial_ph": 7.2,
  "water_changes": [
    {"day": 7, "percentage": 25},
    {"day": 14, "percentage": 25}
  ],
  "add_fish": [],
  "simulation_days": 14
}'''

    high_risk_json = '''{
  "name": "高风险场景 - 喂食过量",
  "tank_volume": 30,
  "fish": [
    {"size": "medium", "quantity": 8}
  ],
  "filtration_level": "low",
  "daily_feeding_amount": 8.0,
  "initial_ammonia": 0.1,
  "initial_nitrite": 0.05,
  "initial_nitrate": 40.0,
  "initial_ph": 7.0,
  "water_changes": [
    {"day": 14, "percentage": 20}
  ],
  "add_fish": [
    {"day": 3, "quantity": 4, "size": "medium"}
  ],
  "simulation_days": 14
}'''

    water_change_compare_json = '''{
  "name": "方案 A - 每周换水 25%",
  "tank_volume": 50,
  "fish": [
    {"size": "small", "quantity": 10}
  ],
  "filtration_level": "medium",
  "daily_feeding_amount": 3.0,
  "initial_ammonia": 0.02,
  "initial_nitrite": 0.01,
  "initial_nitrate": 30.0,
  "initial_ph": 7.2,
  "water_changes": [
    {"day": 7, "percentage": 25}
  ],
  "add_fish": [],
  "simulation_days": 14
}'''

    water_change_compare2_json = '''{
  "name": "方案 B - 每3天换水 10%",
  "tank_volume": 50,
  "fish": [
    {"size": "small", "quantity": 10}
  ],
  "filtration_level": "medium",
  "daily_feeding_amount": 3.0,
  "initial_ammonia": 0.02,
  "initial_nitrite": 0.01,
  "initial_nitrate": 30.0,
  "initial_ph": 7.2,
  "water_changes": [
    {"day": 3, "percentage": 10},
    {"day": 6, "percentage": 10},
    {"day": 9, "percentage": 10},
    {"day": 12, "percentage": 10}
  ],
  "add_fish": [],
  "simulation_days": 14
}'''

    invalid_ph_json = '''{
  "name": "无效 pH 测试",
  "tank_volume": 50,
  "fish": [{"size": "small", "quantity": 5}],
  "filtration_level": "medium",
  "daily_feeding_amount": 2.0,
  "initial_ammonia": 0.02,
  "initial_nitrite": 0.01,
  "initial_nitrate": 20.0,
  "initial_ph": 15.0,
  "water_changes": [],
  "add_fish": [],
  "simulation_days": 7
}'''

    invalid_water_change_json = '''{
  "name": "无效换水测试",
  "tank_volume": 50,
  "fish": [{"size": "small", "quantity": 5}],
  "filtration_level": "medium",
  "daily_feeding_amount": 2.0,
  "initial_ammonia": 0.02,
  "initial_nitrite": 0.01,
  "initial_nitrate": 20.0,
  "initial_ph": 7.0,
  "water_changes": [
    {"day": 5, "percentage": 80}
  ],
  "add_fish": [],
  "simulation_days": 7
}'''

    normal_csv = '''场景名称,鱼缸体积,鱼尺寸,鱼数量,过滤等级,每日喂食量,初始氨氮,初始亚硝酸盐,初始硝酸盐,初始ph,换水天数,换水比例,加鱼天数,加鱼数量,加鱼尺寸,模拟天数
正常维护场景,50,small,6,medium,2.5,0.02,0.01,25.0,7.2,7,25,,,14
,,,,,,,,,,14,25,,,
'''

    files = [
        ('normal_scenario.json', normal_json, '正常维护场景'),
        ('high_risk_scenario.json', high_risk_json, '高风险场景'),
        ('compare_plan_a.json', water_change_compare_json, '对比方案 A'),
        ('compare_plan_b.json', water_change_compare2_json, '对比方案 B'),
        ('invalid_ph.json', invalid_ph_json, '无效 pH 测试（会报错）'),
        ('invalid_water_change.json', invalid_water_change_json, '大比例换水测试（会警告）'),
        ('normal_scenario.csv', normal_csv, 'CSV 格式正常场景'),
    ]

    for filename, content, desc in files:
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        click.echo(f"✅ 已创建: {filepath} ({desc})")

    click.echo(f"\n📁 示例文件已生成到: {output_dir}/")
    click.echo("\n💡 使用示例:")
    click.echo(f"  1. 运行正常场景: aquarium run {output_dir}/normal_scenario.json -v")
    click.echo(f"  2. 对比两个方案: aquarium compare {output_dir}/compare_plan_a.json {output_dir}/compare_plan_b.json")
    click.echo(f"  3. 生成报告: aquarium run {output_dir}/normal_scenario.json -h report.html -m report.md")
    click.echo(f"  4. 测试错误输入: aquarium run {output_dir}/invalid_ph.json")


if __name__ == '__main__':
    cli()
