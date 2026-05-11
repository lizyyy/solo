import click
import json
from datetime import datetime, timedelta
from .storage import Storage
from .reporter import Reporter


def get_today_date() -> str:
    return datetime.now().strftime("%Y-%m-%d")


@click.group()
def cli():
    """食堂菜品留样管理系统 CLI"""
    pass


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.argument('menu_file', type=click.Path(exists=True))
def import_menu(date, menu_file):
    """导入当天菜单"""
    if not date:
        date = get_today_date()

    storage = Storage()

    try:
        with open(menu_file, 'r', encoding='utf-8') as f:
            menu_items = json.load(f)

        daily_data = storage.import_menu(date, menu_items)

        click.echo(f"✅ 成功导入 {len(menu_items)} 道菜到 {date}")
        click.echo(f"\n菜单列表:")
        for i, item in enumerate(daily_data.menu_items, 1):
            click.echo(f"  {i}. {item.name} (ID: {item.id}, 窗口: {item.window})")

    except Exception as e:
        click.echo(f"❌ 导入失败: {e}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--menu-item-id', required=True, help='菜品ID')
@click.option('--weight', required=True, type=float, help='留样重量 (克)')
@click.option('--container-id', required=True, help='容器编号')
@click.option('--fridge-location', required=True, help='冰箱位置')
@click.option('--operator', required=True, help='操作人')
@click.option('--destruction-hours', default=48, help='预计保留时间 (小时, 默认48)')
def register(date, menu_item_id, weight, container_id, fridge_location, operator, destruction_hours):
    """登记留样信息"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    menu_item = None
    for item in daily_data.menu_items:
        if item.id == menu_item_id:
            menu_item = item
            break

    if not menu_item:
        click.echo(f"❌ 找不到菜品ID: {menu_item_id}")
        return

    existing_reservations = [
        res for res in daily_data.reservations
        if res.menu_item_id == menu_item_id and res.status in ["registered", "destroyed"]
    ]
    if existing_reservations:
        click.echo(f"⚠️ 警告: 该菜品已登记留样，继续登记将创建重复记录")
        if not click.confirm("是否继续?"):
            return

    expected_destruction_time = datetime.now() + timedelta(hours=destruction_hours)

    reservation_data = {
        "menu_item_id": menu_item.id,
        "menu_item_name": menu_item.name,
        "window": menu_item.window,
        "weight": weight,
        "container_id": container_id,
        "fridge_location": fridge_location,
        "operator": operator,
        "expected_destruction_time": expected_destruction_time
    }

    reservation = storage.add_reservation(date, reservation_data)

    click.echo(f"✅ 留样登记成功!")
    click.echo(f"\n留样信息:")
    click.echo(f"  ID: {reservation.id}")
    click.echo(f"  菜品: {reservation.menu_item_name}")
    click.echo(f"  窗口: {reservation.window}")
    click.echo(f"  重量: {reservation.weight}g")
    click.echo(f"  容器编号: {reservation.container_id}")
    click.echo(f"  冰箱位置: {reservation.fridge_location}")
    click.echo(f"  操作人: {reservation.operator}")
    click.echo(f"  预计销毁时间: {reservation.expected_destruction_time.strftime('%Y-%m-%d %H:%M:%S')}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--reservation-id', required=True, help='留样ID')
@click.option('--operator', required=True, help='操作人')
@click.option('--notes', default='', help='备注')
def destroy(date, reservation_id, operator, notes):
    """确认销毁留样"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reservation = storage.confirm_destruction(date, reservation_id, operator, notes)

    if reservation:
        click.echo(f"✅ 销毁确认成功!")
        click.echo(f"\n销毁信息:")
        click.echo(f"  留样ID: {reservation.id}")
        click.echo(f"  菜品: {reservation.menu_item_name}")
        click.echo(f"  实际销毁时间: {reservation.actual_destruction_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"  操作人: {reservation.destruction_operator}")
        if notes:
            click.echo(f"  备注: {reservation.notes}")
    else:
        click.echo(f"❌ 找不到留样ID: {reservation_id}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--menu-item-id', required=True, help='菜品ID')
@click.option('--reason', required=True, help='漏留原因')
@click.option('--operator', required=True, help='标记人')
def mark_missed(date, menu_item_id, reason, operator):
    """标记漏留菜品"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    menu_item = None
    for item in daily_data.menu_items:
        if item.id == menu_item_id:
            menu_item = item
            break

    if not menu_item:
        click.echo(f"❌ 找不到菜品ID: {menu_item_id}")
        return

    storage.mark_missed(date, menu_item_id, reason, operator)

    click.echo(f"✅ 漏留标记成功!")
    click.echo(f"\n漏留信息:")
    click.echo(f"  菜品: {menu_item.name}")
    click.echo(f"  窗口: {menu_item.window}")
    click.echo(f"  原因: {reason}")
    click.echo(f"  标记人: {operator}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
def list_menu(date):
    """列出当天菜单"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    if not daily_data.menu_items:
        click.echo(f"⚠️ {date} 没有菜单")
        return

    click.echo(f"\n{date} 菜单列表:")
    click.echo("-" * 60)

    for i, item in enumerate(daily_data.menu_items, 1):
        click.echo(f"  {i}. ID: {item.id}")
        click.echo(f"     名称: {item.name}")
        click.echo(f"     窗口: {item.window}")
        click.echo(f"     分类: {item.category}")
        click.echo(f"     价格: ¥{item.price}")
        if item.is_special:
            click.echo(f"     ⭐ 特色菜")
        click.echo("")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--status', default='all', type=click.Choice(['all', 'registered', 'destroyed', 'missed']))
def list_reservations(date, status):
    """列出留样记录"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    if status == 'all':
        reservations = daily_data.reservations
    else:
        reservations = [res for res in daily_data.reservations if res.status == status]

    if not reservations:
        click.echo(f"⚠️ {date} 没有{status}状态的留样记录")
        return

    click.echo(f"\n{date} 留样记录 ({status}):")
    click.echo("-" * 60)

    for i, res in enumerate(reservations, 1):
        status_marker = {
            'registered': '🟢',
            'destroyed': '✅',
            'missed': '❌'
        }.get(res.status, '⚪')

        click.echo(f"  {i}. {status_marker} ID: {res.id}")
        click.echo(f"     菜品: {res.menu_item_name}")
        click.echo(f"     窗口: {res.window}")
        click.echo(f"     状态: {res.status}")
        click.echo(f"     重量: {res.weight}g")
        click.echo(f"     容器: {res.container_id}")
        click.echo(f"     冰箱: {res.fridge_location}")
        click.echo(f"     操作人: {res.operator}")
        click.echo(f"     预计销毁: {res.expected_destruction_time.strftime('%Y-%m-%d %H:%M')}")
        if res.actual_destruction_time:
            click.echo(f"     实际销毁: {res.actual_destruction_time.strftime('%Y-%m-%d %H:%M')}")
        click.echo("")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
def status(date):
    """查看今日合规情况"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    reporter.print_compliance_summary(daily_data)


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--hours', default=2, help='检查未来多少小时内的销毁提醒 (默认2)')
def reminders(date, hours):
    """查看待销毁提醒"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    reporter.print_destruction_reminders(daily_data, hours)


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
def statistics(date):
    """查看责任人统计"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    reporter.print_responsible_statistics(daily_data)


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--output', default=None, help='输出文件路径 (默认: reports/{date}_report.csv)')
def export_report(date, output):
    """导出检查报告"""
    if not date:
        date = get_today_date()

    if not output:
        import os
        if not os.path.exists('reports'):
            os.makedirs('reports')
        output = f"reports/{date}_report.csv"

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    success = reporter.export_csv_report(daily_data, output)

    if success:
        click.echo(f"✅ 报告已导出到: {output}")
    else:
        click.echo(f"❌ 报告导出失败")


if __name__ == '__main__':
    cli()
