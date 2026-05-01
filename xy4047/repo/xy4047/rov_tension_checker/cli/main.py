"""ROV 放缆张力校核器 - 主 CLI 入口"""

import click

from rov_tension_checker.cli.commands.init_cmd import init
from rov_tension_checker.cli.commands.import_cmd import import_cmd
from rov_tension_checker.cli.commands.analyze_cmd import analyze
from rov_tension_checker.cli.commands.scenario_cmd import scenario
from rov_tension_checker.cli.commands.report_cmd import report
from rov_tension_checker.cli.commands.history_cmd import history
from rov_tension_checker import __version__


CONTEXT_SETTINGS = dict(
    help_option_names=['-h', '--help'],
    terminal_width=120
)


@click.group(context_settings=CONTEXT_SETTINGS)
@click.version_option(__version__, '-v', '--version', message='%(version)s')
@click.pass_context
def cli(ctx: click.Context):
    """
    ROV 放缆张力校核器 - 海工检测队专用科学计算工具
    
    用于分析 ROV 水下作业时脐带缆的张力、弯曲半径和潜在风险。
    
    主要功能:
      init     - 初始化项目配置
      import   - 导入航迹、ROV遥测、海流剖面数据
      analyze  - 执行张力校核分析
      scenario - 场景推演（假设分析）
      report   - 导出分析报告
      history  - 查询历史分析记录
    
    示例流程:
      $ rov-tension init --name "东海管线检查" --pipeline "PL-2024-001"
      $ rov-tension import --type track track_data.csv
      $ rov-tension import --type rov_telemetry rov_data.csv
      $ rov-tension analyze
      $ rov-tension report
    """
    ctx.ensure_object(dict)


cli.add_command(init, name='init')
cli.add_command(import_cmd, name='import')
cli.add_command(analyze, name='analyze')
cli.add_command(scenario, name='scenario')
cli.add_command(report, name='report')
cli.add_command(history, name='history')


if __name__ == '__main__':
    cli()
