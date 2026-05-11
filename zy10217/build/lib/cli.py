import click
from src.commands.import_cmd import import_cmd
from src.commands.check_cmd import check_cmd
from src.commands.correct_cmd import correct_cmd
from src.commands.calculate_cmd import calculate_cmd
from src.commands.confirm_cmd import confirm_cmd
from src.commands.export_cmd import export_cmd
from src.database import init_db, get_db_path


@click.group()
@click.version_option('1.0.0')
def main():
    """农机合作社作业计费 CLI 系统
    
    用于管理农机合作社的作业计费流程，包括：
    - 导入基础数据（农户、地块、作业类型、作业记录、油补规则、历史欠款）
    - 异常检查（重复上报、单位混乱、未确认结算、油补超支）
    - 人工修正和删除
    - 费用试算
    - 机手确认和最终结算
    - 报表导出（村级汇总、农户账单、审计日志）
    """
    init_db()


main.add_command(import_cmd, name='import')
main.add_command(check_cmd, name='check')
main.add_command(correct_cmd, name='correct')
main.add_command(calculate_cmd, name='calculate')
main.add_command(confirm_cmd, name='confirm')
main.add_command(export_cmd, name='export')


@main.command('init')
def init_command():
    """初始化数据库"""
    init_db()
    click.echo(f'✅ 数据库已初始化')
    click.echo(f'   数据库路径: {get_db_path()}')


@main.command('db-path')
def show_db_path():
    """显示数据库路径"""
    click.echo(f'数据库路径: {get_db_path()}')


if __name__ == '__main__':
    main()
