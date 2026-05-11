import click
from datetime import datetime, date, timedelta
from tabulate import tabulate
import sys

from .database import Database
from .models import Elder, MealPlan, OrderStatus, SubsidyType, CancellationReason
from .services import ElderMealService


def get_db():
    return Database()


def get_service():
    return ElderMealService(get_db())


@click.group()
def cli():
    """老年餐配送退餐管理 CLI 工具"""
    pass


@cli.group()
def config():
    """系统配置管理"""
    pass


@config.command('list')
def config_list():
    """查看所有配置项"""
    db = get_db()
    configs = db.get_all_config()
    
    config_desc = {
        'cancellation_deadline_time': '退餐截止时间（HH:MM格式）',
        'cancellation_deadline_days_before': '提前几天截止退餐',
        'deduction_after_deadline_rate': '超时退餐扣款比例',
        'deduction_after_delivered_rate': '配送后退餐扣款比例'
    }
    
    table = []
    for key, value in configs.items():
        desc = config_desc.get(key, key)
        table.append([key, value, desc])
    
    click.echo("\n=== 系统配置 ===")
    click.echo(tabulate(table, headers=['配置项', '值', '说明'], tablefmt='simple'))
    click.echo()


@config.command('set')
@click.argument('key')
@click.argument('value')
def config_set(key, value):
    """设置配置项"""
    db = get_db()
    db.set_config(key, value)
    click.echo(f"已设置: {key} = {value}")


@cli.group()
def elder():
    """老人信息管理"""
    pass


@elder.command('add')
@click.option('--name', required=True, help='老人姓名')
@click.option('--phone', default='', help='联系电话')
@click.option('--id-card', default='', help='身份证号')
@click.option('--subsidy', default='普通补贴', 
              type=click.Choice([t.value for t in SubsidyType]),
              help='补贴类型')
@click.option('--address', default='', help='配送地址')
@click.option('--district', default='', help='所属片区')
@click.option('--route', default='', help='配送路线')
@click.option('--notes', default='', help='备注')
def elder_add(name, phone, id_card, subsidy, address, district, route, notes):
    """添加老人信息"""
    service = get_service()
    elder = Elder(
        name=name, phone=phone, id_card=id_card, subsidy_type=subsidy,
        address=address, district=district, route=route, notes=notes
    )
    result = service.add_elder(elder)
    
    if result.success:
        click.echo(click.style(f"✓ {result.message}", fg='green'))
    else:
        click.echo(click.style(f"✗ {result.message}", fg='red'))
        for w in result.warnings:
            click.echo(click.style(f"  {w}", fg='yellow'))


@elder.command('list')
@click.option('--search', default='', help='按姓名/电话搜索')
def elder_list(search):
    """查看老人列表"""
    db = get_db()
    elders = db.list_elders(search if search else None)
    
    if not elders:
        click.echo("暂无老人数据")
        return
    
    table = []
    for e in elders:
        table.append([
            e.id, e.name, e.phone, e.id_card[-4:] if e.id_card else '',
            e.subsidy_type, e.district, e.route
        ])
    
    click.echo("\n=== 老人列表 ===")
    click.echo(tabulate(table, 
                        headers=['ID', '姓名', '电话', '身份证后4位', '补贴类型', '片区', '路线'],
                        tablefmt='simple'))
    click.echo(f"\n共 {len(elders)} 位老人")


@elder.command('update-subsidy')
@click.argument('elder_id', type=int)
@click.argument('new_subsidy', type=click.Choice([t.value for t in SubsidyType]))
@click.option('--effective-date', default=None, help='生效日期（YYYY-MM-DD），默认为今天')
@click.option('--notes', default='', help='变更说明')
def elder_update_subsidy(elder_id, new_subsidy, effective_date, notes):
    """更新老人补贴类型（记录变更历史）"""
    service = get_service()
    result = service.update_subsidy_type(elder_id, new_subsidy, effective_date, notes)
    
    if result.success:
        click.echo(click.style(f"✓ {result.message}", fg='green'))
    else:
        click.echo(click.style(f"✗ {result.message}", fg='red'))


@cli.group()
def meal():
    """餐标管理"""
    pass


@meal.command('add')
@click.option('--name', required=True, help='餐标名称，如：普通餐、软食餐、糖尿病餐')
@click.option('--price', required=True, type=float, help='餐费原价')
@click.option('--subsidy', required=True, type=float, help='政府补贴金额')
@click.option('--desc', default='', help='餐标描述')
def meal_add(name, price, subsidy, desc):
    """添加餐标"""
    db = get_db()
    plan = MealPlan(name=name, price=price, subsidy_amount=subsidy, description=desc)
    plan_id = db.add_meal_plan(plan)
    click.echo(click.style(f"✓ 成功添加餐标: {name} (ID: {plan_id})", fg='green'))
    click.echo(f"  原价: {price}元, 补贴: {subsidy}元, 自付: {price - subsidy}元")


@meal.command('list')
def meal_list():
    """查看餐标列表"""
    db = get_db()
    plans = db.list_meal_plans()
    
    if not plans:
        click.echo("暂无餐标数据")
        return
    
    table = []
    for p in plans:
        actual = max(0, p.price - p.subsidy_amount)
        status = "启用" if p.is_active else "停用"
        table.append([p.id, p.name, p.price, p.subsidy_amount, actual, status])
    
    click.echo("\n=== 餐标列表 ===")
    click.echo(tabulate(table, 
                        headers=['ID', '名称', '原价', '补贴', '自付', '状态'],
                        tablefmt='simple'))


@cli.group()
def order():
    """订单管理"""
    pass


@order.command('create')
@click.option('--elder-id', required=True, type=int, help='老人ID')
@click.option('--meal-date', required=True, help='用餐日期（YYYY-MM-DD）')
@click.option('--meal-plan-id', required=True, type=int, help='餐标ID')
def order_create(elder_id, meal_date, meal_plan_id):
    """创建单条订单"""
    service = get_service()
    result = service.create_order(elder_id, meal_date, meal_plan_id)
    
    if result.success:
        click.echo(click.style(f"✓ {result.message}", fg='green'))
    else:
        click.echo(click.style(f"✗ {result.message}", fg='red'))
    for w in result.warnings:
        click.echo(click.style(f"  ⚠ {w}", fg='yellow'))


@order.command('import')
@click.argument('csv_file', type=click.Path(exists=True))
@click.option('--source', default='csv', help='导入源标识，用于去重')
def order_import(csv_file, source):
    """从CSV批量导入订单
    
    CSV格式（第一行为表头）：
    老人姓名,身份证号,用餐日期,餐标
    
    示例：
    张三,110101195001011234,2026-05-12,普通餐
    李四,,2026-05-12,软食餐
    """
    with open(csv_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    service = get_service()
    result = service.import_orders_from_csv(content, import_source=source)
    
    click.echo("\n" + "=" * 50)
    click.echo("=== 批量导入结果 ===")
    click.echo(f"总计处理: {result.total} 条")
    click.echo(click.style(f"成功导入: {result.inserted} 条", fg='green'))
    click.echo(click.style(f"跳过重复: {result.skipped} 条", fg='yellow'))
    click.echo(click.style(f"处理失败: {len(result.errors)} 条", fg='red'))
    
    if result.warnings:
        click.echo("\n" + "-" * 50)
        click.echo("【跳过的重复记录】:")
        for w in result.warnings:
            click.echo(click.style(f"  第{w['row']}行: {w['warning']} - {w['detail']}", fg='yellow'))
    
    if result.errors:
        click.echo("\n" + "-" * 50)
        click.echo("【处理失败记录】:")
        for e in result.errors:
            click.echo(click.style(f"  第{e['row']}行: {e['error']}", fg='red'))
            if e.get('detail'):
                click.echo(f"    {e['detail']}")
    
    click.echo("=" * 50 + "\n")


@order.command('list')
@click.option('--date', default=None, help='按日期筛选（YYYY-MM-DD）')
@click.option('--status', default=None, 
              type=click.Choice([s.value for s in OrderStatus]),
              help='按状态筛选')
@click.option('--district', default=None, help='按片区筛选')
@click.option('--route', default=None, help='按路线筛选')
def order_list(date, status, district, route):
    """查看订单列表"""
    db = get_db()
    orders = db.list_orders(
        meal_date=date, status=status, district=district, route=route
    )
    
    if not orders:
        click.echo("暂无订单数据")
        return
    
    table = []
    for o in orders:
        table.append([
            o.id, o.elder_name, o.meal_date, o.meal_plan_name,
            f"{o.price}/{o.subsidy_amount}/{o.actual_payment}",
            o.status
        ])
    
    click.echo("\n=== 订单列表 ===")
    click.echo(tabulate(table, 
                        headers=['订单ID', '老人', '用餐日期', '餐标', '价格/补贴/自付', '状态'],
                        tablefmt='simple'))
    click.echo(f"\n共 {len(orders)} 条订单")


@cli.group()
def cancel():
    """退餐管理"""
    pass


@cancel.command('record')
@click.argument('order_id', type=int)
@click.argument('reason', 
                type=click.Choice([r.value for r in CancellationReason]))
@click.option('--detail', default='', help='退餐原因详情')
@click.option('--time', default=None, help='退餐时间（YYYY-MM-DD HH:MM），默认现在')
def cancel_record(order_id, reason, detail, time):
    """登记退餐（自动检查截止时间和配送状态）
    
    退餐原因可选：身体不适、外出、家人来访、不需要、其他
    
    【重要】系统会自动检查：
    1. 是否晚于退餐截止时间（默认用餐前一天20:00）
    2. 是否已配送
    3. 是否已退餐（防止重复退餐）
    
    异常情况会在输出中明确说明。
    """
    service = get_service()
    
    cancel_time = None
    if time:
        try:
            cancel_time = datetime.strptime(time, '%Y-%m-%d %H:%M')
        except ValueError:
            click.echo(click.style(f"✗ 时间格式错误，请使用：YYYY-MM-DD HH:MM", fg='red'))
            return
    
    result = service.cancel_order(order_id, reason, detail, cancel_time)
    
    if result.success:
        click.echo(click.style(f"✓ {result.message}", fg='green'))
    else:
        click.echo(click.style(f"✗ {result.message}", fg='red'))
    
    if result.warnings:
        click.echo("\n" + click.style("【异常拦截说明】", fg='yellow', bold=True))
        for w in result.warnings:
            click.echo(click.style(f"  ⚠ {w}", fg='yellow'))


@cancel.command('list')
@click.option('--start', default=None, help='开始日期（YYYY-MM-DD）')
@click.option('--end', default=None, help='结束日期（YYYY-MM-DD）')
def cancel_list(start, end):
    """查看退餐记录"""
    service = get_service()
    
    if not start:
        start = (date.today() - timedelta(days=30)).isoformat()
    if not end:
        end = date.today().isoformat()
    
    summary = service.get_cancellation_summary(start, end)
    
    if not summary['details']:
        click.echo("暂无退餐记录")
        return
    
    click.echo("\n" + "=" * 60)
    click.echo("=== 退餐汇总 ===")
    click.echo(f"统计周期: {start} 至 {end}")
    click.echo(f"退餐总数: {summary['total_count']} 条")
    click.echo(click.style(f"  超时退餐（晚于截止）: {summary['after_deadline_count']} 条", fg='yellow'))
    click.echo(click.style(f"  配送后退餐: {summary['after_delivered_count']} 条", fg='red'))
    click.echo(f"退款总额: {summary['total_refund']} 元")
    click.echo(f"扣款总额: {summary['total_deduction']} 元")
    
    if summary['by_reason']:
        click.echo("\n按退餐原因统计:")
        for reason, data in summary['by_reason'].items():
            click.echo(f"  {reason}: {data['count']}条, 扣款 {data['deduction']}元")
    
    table = []
    for d in summary['details']:
        flags = []
        if d['is_after_deadline']:
            flags.append(click.style('超时', fg='yellow'))
        if d['is_delivered']:
            flags.append(click.style('已配送', fg='red'))
        flag_str = ",".join(flags) if flags else ""
        
        table.append([
            d['order_id'], d['elder_name'], d['meal_date'], d['meal_plan'],
            d['reason'], flag_str, d['refund'], d['deduction']
        ])
    
    click.echo("\n--- 退餐明细 ---")
    click.echo(tabulate(table, 
                        headers=['订单ID', '老人', '用餐日期', '餐标', '退餐原因', 
                                 '异常标记', '退款', '扣款'],
                        tablefmt='simple'))
    
    for d in summary['details']:
        if d['block_reason']:
            click.echo(click.style(f"\n订单 {d['order_id']} 拦截说明: {d['block_reason']}", fg='yellow'))


@cli.group()
def delivery():
    """配送管理"""
    pass


@delivery.command('record')
@click.argument('order_id', type=int)
@click.argument('deliverer')
@click.option('--receiver', default='', help='签收人')
@click.option('--time', default=None, help='送达时间（YYYY-MM-DD HH:MM）')
@click.option('--notes', default='', help='备注')
def delivery_record(order_id, deliverer, receiver, time, notes):
    """登记送达"""
    service = get_service()
    
    delivery_time = None
    if time:
        try:
            delivery_time = datetime.strptime(time, '%Y-%m-%d %H:%M')
        except ValueError:
            click.echo(click.style(f"✗ 时间格式错误", fg='red'))
            return
    
    result = service.record_delivery(order_id, deliverer, receiver, delivery_time, notes)
    
    if result.success:
        click.echo(click.style(f"✓ {result.message}", fg='green'))
    else:
        click.echo(click.style(f"✗ {result.message}", fg='red'))
    for w in result.warnings:
        click.echo(click.style(f"  ⚠ {w}", fg='yellow'))


@cli.group()
def report():
    """汇总报表"""
    pass


@report.command('kitchen')
@click.option('--date', default=None, help='用餐日期（YYYY-MM-DD），默认明天')
def report_kitchen(date):
    """厨房备餐数汇总
    
    显示指定日期的备餐数量，按餐标分类统计。
    已退餐的订单不计入备餐数。
    """
    service = get_service()
    
    if not date:
        date = (date.today() + timedelta(days=1)).isoformat()
    
    summary = service.get_kitchen_prep_summary(date)
    
    click.echo("\n" + "=" * 60)
    click.echo(f"=== 厨房备餐汇总 - {date} ===")
    click.echo(click.style(f"总备餐数: {summary['total_count']} 份", fg='green', bold=True))
    click.echo(f"总餐费: {summary['total_price']} 元")
    click.echo(f"总补贴: {summary['total_subsidy']} 元")
    click.echo(f"总自付: {summary['total_price'] - summary['total_subsidy']} 元")
    
    if summary['by_meal_plan']:
        click.echo("\n--- 按餐标分类 ---")
        table = []
        for name, data in summary['by_meal_plan'].items():
            table.append([
                name, data['count'], data['total_price'], 
                data['total_subsidy'], data['total_price'] - data['total_subsidy']
            ])
        click.echo(tabulate(table, 
                            headers=['餐标', '份数', '总价', '补贴', '自付'],
                            tablefmt='simple'))
        
        click.echo("\n--- 备餐明细 ---")
        detail_table = []
        for o in summary['all_orders']:
            detail_table.append([
                o.id, o.elder_name, o.meal_plan_name, o.delivery_address, o.route
            ])
        click.echo(tabulate(detail_table, 
                            headers=['订单ID', '老人', '餐标', '配送地址', '路线'],
                            tablefmt='simple'))
    
    click.echo("=" * 60 + "\n")


@report.command('routes')
@click.option('--date', default=None, help='用餐日期（YYYY-MM-DD），默认今天')
def report_routes(date):
    """配送员路线汇总
    
    按配送路线分组显示订单，方便配送员按顺序送餐。
    """
    service = get_service()
    
    if not date:
        date = date.today().isoformat()
    
    routes = service.get_delivery_routes(date)
    
    click.echo("\n" + "=" * 60)
    click.echo(f"=== 配送路线汇总 - {date} ===")
    click.echo(f"路线数: {routes['total_routes']} 条")
    click.echo(f"总配送量: {routes['total_deliveries']} 份")
    
    for route_name, route_data in routes['routes'].items():
        click.echo(f"\n--- 路线: {click.style(route_name, fg='cyan', bold=True)} ---")
        click.echo(f"片区: {route_data['district'] or '-'}, 配送量: {route_data['count']} 份")
        
        table = []
        for idx, o in enumerate(route_data['orders'], 1):
            table.append([
                idx, o.elder_name, o.delivery_address, 
                o.meal_plan_name, o.actual_payment
            ])
        click.echo(tabulate(table, 
                            headers=['序号', '老人', '配送地址', '餐标', '应收款'],
                            tablefmt='simple'))
    
    click.echo("=" * 60 + "\n")


@report.command('cancellations')
@click.option('--start', default=None, help='开始日期（YYYY-MM-DD），默认30天前')
@click.option('--end', default=None, help='结束日期（YYYY-MM-DD），默认今天')
def report_cancellations(start, end):
    """退餐扣减汇总
    
    统计指定时间段内的退餐情况，包括：
    - 退餐总数
    - 超时退餐（晚于截止时间）数量
    - 配送后退餐数量
    - 退款和扣款金额
    - 按退餐原因统计
    """
    service = get_service()
    
    if not start:
        start = (date.today() - timedelta(days=30)).isoformat()
    if not end:
        end = date.today().isoformat()
    
    summary = service.get_cancellation_summary(start, end)
    
    click.echo("\n" + "=" * 70)
    click.echo("=== 退餐扣减汇总 ===")
    click.echo(f"统计周期: {start} 至 {end}")
    click.echo("-" * 70)
    
    click.echo(f"退餐总数: {summary['total_count']} 条")
    click.echo(click.style(f"  超时退餐（晚于截止）: {summary['after_deadline_count']} 条", fg='yellow'))
    click.echo(click.style(f"  配送后退餐: {summary['after_delivered_count']} 条", fg='red'))
    click.echo(f"退款总额: {click.style(str(summary['total_refund']) + ' 元', fg='green')}")
    click.echo(f"扣款总额: {click.style(str(summary['total_deduction']) + ' 元', fg='red')}")
    
    if summary['by_reason']:
        click.echo("\n--- 按退餐原因统计 ---")
        table = []
        for reason, data in summary['by_reason'].items():
            table.append([reason, data['count'], data['deduction']])
        click.echo(tabulate(table, headers=['退餐原因', '数量', '扣款金额'], tablefmt='simple'))
    
    if summary['details']:
        click.echo("\n--- 异常退餐明细 ---")
        abnormal = [d for d in summary['details'] if d['is_after_deadline'] or d['is_delivered']]
        if abnormal:
            table = []
            for d in abnormal:
                flags = []
                if d['is_after_deadline']:
                    flags.append('超时')
                if d['is_delivered']:
                    flags.append('已配送')
                table.append([
                    d['order_id'], d['elder_name'], d['meal_date'],
                    ",".join(flags), d['reason'], d['refund'], d['deduction']
                ])
            click.echo(tabulate(table, 
                                headers=['订单ID', '老人', '用餐日期', '异常类型', 
                                         '退餐原因', '退款', '扣款'],
                                tablefmt='simple'))
    
    click.echo("=" * 70 + "\n")


@report.command('subsidy')
@click.option('--start', default=None, help='开始日期（YYYY-MM-DD），默认本月1号')
@click.option('--end', default=None, help='结束日期（YYYY-MM-DD），默认今天')
def report_subsidy(start, end):
    """政府补贴汇总
    
    统计指定时间段内的补贴发放情况，按补贴类型分类。
    这是向政府申请补贴的重要依据。
    """
    service = get_service()
    
    if not start:
        today = date.today()
        start = date(today.year, today.month, 1).isoformat()
    if not end:
        end = date.today().isoformat()
    
    summary = service.get_subsidy_summary(start, end)
    
    click.echo("\n" + "=" * 70)
    click.echo("=== 政府补贴汇总 ===")
    click.echo(f"统计周期: {start} 至 {end}")
    click.echo("-" * 70)
    
    click.echo(f"有效订单数: {summary['total_orders']} 份")
    click.echo(f"餐费总额: {summary['total_price']} 元")
    click.echo(click.style(f"补贴总额: {summary['total_subsidy']} 元", fg='green', bold=True))
    click.echo(f"老人自付: {summary['total_payment']} 元")
    
    if summary['by_subsidy_type']:
        click.echo("\n--- 按补贴类型统计 ---")
        table = []
        for stype, data in summary['by_subsidy_type'].items():
            table.append([
                stype, data['count'], data['total_price'], 
                data['total_subsidy'], data['total_payment']
            ])
        click.echo(tabulate(table, 
                            headers=['补贴类型', '订单数', '餐费', '补贴', '自付'],
                            tablefmt='simple'))
    
    click.echo("=" * 70 + "\n")


if __name__ == '__main__':
    cli()
