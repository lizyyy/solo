"""init 命令"""

import click

from rov_tension_checker.config.manager import ConfigManager


@click.command()
@click.option('--name', '-n', required=True, help='项目名称')
@click.option('--pipeline', '-p', required=True, help='管线编号')
@click.option('--working-dir', '-w', default=None, help='工作目录（默认为当前目录）')
def init(name: str, pipeline: str, working_dir: str = None):
    """初始化项目配置
    
    创建项目配置文件，包括缆线规格、允许张力、最小弯曲半径、
    ROV 重量/浮力、海流层、采样时间步长和输出目录。
    """
    config_manager = ConfigManager(working_dir)
    
    if config_manager.config_exists():
        click.echo(click.style(f"⚠️  配置文件已存在: {config_manager.config_path}", fg='yellow'))
        if not click.confirm("是否覆盖现有配置？"):
            click.echo("操作已取消")
            return
    
    config = config_manager.init_config(name, pipeline)
    
    click.echo(click.style("✓ 项目配置已初始化", fg='green'))
    click.echo("")
    click.echo(f"项目名称: {config.project_name}")
    click.echo(f"管线编号: {config.pipeline_id}")
    click.echo(f"配置文件: {config_manager.config_path}")
    click.echo("")
    click.echo("默认配置:")
    click.echo(f"  缆线规格: {config.cable_spec.name}")
    click.echo(f"  ROV 型号: {config.rov_spec.name}")
    click.echo(f"  采样步长: {config.sampling_time_step} 秒")
    click.echo(f"  输出目录: {config.output_directory}")
    click.echo("")
    click.echo(click.style("提示: 可编辑配置文件调整参数，或使用 'rov-tension import' 导入数据", fg='cyan'))
