"""import 命令"""

import click
from pathlib import Path
from typing import Optional

from rov_tension_checker.config.manager import ConfigManager
from rov_tension_checker.data_import.parsers import CSVParser, save_quarantine


DATA_TYPES = ['track', 'rov_telemetry', 'current_profile']


@click.command()
@click.option('--type', '-t', 'data_type', required=True,
              type=click.Choice(DATA_TYPES, case_sensitive=False),
              help=f'数据类型: {", ".join(DATA_TYPES)}')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--working-dir', '-w', default=None, help='工作目录')
@click.option('--encoding', '-e', default='utf-8', help='文件编码 (默认 utf-8)')
def import_cmd(data_type: str, file_path: str, working_dir: Optional[str], encoding: str):
    """导入数据文件
    
    支持导入三类数据：
    - track: 母船航迹 CSV（时间戳、经纬度/局部坐标、艏向、速度）
    - rov_telemetry: ROV 遥测 CSV（时间戳、深度、放缆长度、推进器负载）
    - current_profile: 海流剖面 CSV（深度层、海流速度、方向）
    
    导入时自动校验：
    - 单位和时间格式
    - 时间倒序和重复时间戳
    - 坐标缺失
    - 深度正负号混乱
    
    坏行将被隔离到 quarantine 目录。
    """
    config_manager = ConfigManager(working_dir)
    
    if not config_manager.config_exists():
        click.echo(click.style("❌ 项目未初始化", fg='red'))
        click.echo(f"请先运行: rov-tension init --name <项目名> --pipeline <管线编号>")
        return
    
    config = config_manager.load_config()
    
    parser = CSVParser()
    
    click.echo(f"正在导入 {data_type} 数据: {file_path}")
    click.echo("-" * 50)
    
    try:
        if data_type.lower() == 'track':
            parsed = parser.parse_track(file_path)
        elif data_type.lower() == 'rov_telemetry':
            parsed = parser.parse_rov_telemetry(file_path)
        else:
            parsed = parser.parse_current_profile(file_path)
    except Exception as e:
        click.echo(click.style(f"❌ 解析失败: {e}", fg='red'))
        return
    
    click.echo(f"总行数: {parsed.total_rows}")
    click.echo(f"有效行数: {click.style(str(parsed.valid_count), fg='green')}")
    click.echo(f"无效行数: {click.style(str(parsed.invalid_count), fg='yellow' if parsed.invalid_count > 0 else 'green')}")
    
    if parsed.errors:
        click.echo("")
        click.echo(click.style("发现的错误:", fg='yellow'))
        for err in parsed.errors[:10]:
            click.echo(f"  行 {err.row_index + 1}: [{err.error_type.value}] {err.message}")
        
        if len(parsed.errors) > 10:
            click.echo(f"  ... 还有 {len(parsed.errors) - 10} 个错误")
    
    if parsed.valid_rows:
        import json
        
        output_path = config_manager.get_data_path(
            config,
            f"{data_type}_{parsed.parse_time.strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                [row for row in parsed.valid_rows],
                f,
                ensure_ascii=False,
                indent=2,
                default=str
            )
        
        click.echo("")
        click.echo(click.style(f"✓ 有效数据已保存: {output_path}", fg='green'))
    
    if parsed.invalid_rows:
        quarantine_dir = config_manager.get_quarantine_path(config, "")
        quarantine_path = save_quarantine(parsed, quarantine_dir)
        click.echo(click.style(f"⚠️  隔离文件已保存: {quarantine_path}", fg='yellow'))
    
    click.echo("")
    if parsed.valid_rows:
        click.echo(click.style(f"导入完成！有效数据 {parsed.valid_count} 行", fg='green'))
    else:
        click.echo(click.style("导入完成，但没有有效数据", fg='yellow'))
