import click
import os
from ..database import init_db, DB_PATH

@click.command()
@click.option('--force', is_flag=True, help='强制重新初始化（会清除现有数据）')
def init(force):
    """初始化数据库"""
    if force and os.path.exists(DB_PATH):
        click.confirm('确定要清除所有数据并重新初始化吗？', abort=True)
        os.remove(DB_PATH)
        click.echo('已清除现有数据库')
    
    init_db()
    click.echo(f'数据库初始化完成！路径: {DB_PATH}')
    click.echo('可以使用以下命令开始：')
    click.echo('  pharmacy-inspect import --help  - 导入数据')
    click.echo('  pharmacy-inspect check --help   - 校验数据')
