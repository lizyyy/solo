import os
import click
import sqlite3

from freight_audit.context import pass_ctx
from freight_audit.database import init_db, get_db_path
from freight_audit.config import save_default_config, load_config


@click.command()
@click.option('--force', '-f', is_flag=True, help='强制重新初始化，覆盖现有配置')
@pass_ctx
def init(ctx, force):
    """初始化项目目录，创建配置文件和数据库"""
    project_dir = ctx.project_dir
    config_path = os.path.join(project_dir, 'config.yaml')
    db_path = get_db_path(project_dir)
    
    click.echo(f'项目目录: {project_dir}')
    click.echo('=' * 50)
    
    if os.path.exists(config_path) and not force:
        click.echo(f'[跳过] 配置文件已存在: {config_path}')
        click.echo(f'       使用 --force 强制覆盖')
    else:
        config_path = save_default_config(project_dir)
        action = '覆盖' if force and os.path.exists(config_path) else '创建'
        click.echo(f'[成功] {action}配置文件: {config_path}')
    
    data_dir = os.path.join(project_dir, 'data')
    if os.path.exists(db_path) and not force:
        click.echo(f'[跳过] 数据库已存在: {db_path}')
        click.echo(f'       使用 --force 强制覆盖')
    else:
        if os.path.exists(db_path) and force:
            os.remove(db_path)
            click.echo(f'[信息] 删除旧数据库')
        
        init_db(project_dir)
        click.echo(f'[成功] 初始化数据库: {db_path}')
    
    config, _ = load_config(project_dir)
    reports_dir = os.path.join(project_dir, config.get('report', {}).get('output_dir', 'reports'))
    os.makedirs(reports_dir, exist_ok=True)
    click.echo(f'[成功] 创建报告目录: {reports_dir}')
    
    click.echo('=' * 50)
    click.echo('初始化完成！')
    click.echo('')
    click.echo('下一步:')
    click.echo('  1. 编辑 config.yaml 配置参数')
    click.echo('  2. 准备物流单 CSV 数据文件')
    click.echo('  3. 运行: freight-audit import-shipments <file.csv>')
