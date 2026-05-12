import json
import click
from colorama import init, Fore, Style
from tabulate import tabulate

from src.services.fulfillment_engine import engine
from src.utils.sample_data import (
    create_sample_activity, create_sample_inventory,
    create_scenario_orders, create_low_stock_inventory
)

init()


def print_success(msg: str):
    click.echo(f"{Fore.GREEN}✓ {msg}{Style.RESET_ALL}")


def print_error(msg: str):
    click.echo(f"{Fore.RED}✗ {msg}{Style.RESET_ALL}")


def print_warning(msg: str):
    click.echo(f"{Fore.YELLOW}⚠ {msg}{Style.RESET_ALL}")


def print_info(msg: str):
    click.echo(f"{Fore.CYAN}ℹ {msg}{Style.RESET_ALL}")


def print_header(title: str):
    click.echo(f"\n{Fore.BLUE}{'='*60}{Style.RESET_ALL}")
    click.echo(f"{Fore.BLUE}  {title}{Style.RESET_ALL}")
    click.echo(f"{Fore.BLUE}{'='*60}{Style.RESET_ALL}")


def print_json(data: dict, indent: int = 2):
    click.echo(json.dumps(data, ensure_ascii=False, indent=indent))


def print_table(headers: list, rows: list):
    click.echo(tabulate(rows, headers=headers, tablefmt="grid"))


def _load_samples_internal(check_init: bool = True):
    if check_init:
        check = engine.check_init_required()
        if check:
            print_error(check['error'])
            print_warning(check['suggestion'])
            return False
    
    activity = create_sample_activity()
    inventory_list = create_sample_inventory()
    orders = create_scenario_orders()
    
    result1 = engine.import_data("activity", activity)
    if result1['success']:
        print_success(f"导入活动规则: {activity['activity_id']}")
    else:
        print_warning(f"活动规则: {result1.get('error', '导入失败')}")
    
    for inv in inventory_list:
        result2 = engine.import_data("inventory", inv)
        if result2['success']:
            print_success(f"导入库存: {inv['sku']} ({inv['available_qty']}件)")
        else:
            print_warning(f"库存: {result2.get('error', '导入失败')}")
    
    for order in orders:
        result3 = engine.import_data("order", order)
        if result3['success']:
            print_success(f"导入订单: {order['order_id']}")
        else:
            print_warning(f"订单 {order['order_id']}: {result3.get('error', '导入失败')}")
    
    print_info(f"\n共导入: 1个活动, {len(inventory_list)}个库存SKU, {len(orders)}个订单")
    return True


@click.group()
@click.version_option("1.0.0")
def cli():
    """电商赠品履约CLI工具 - 管理满赠活动赠品的完整生命周期"""
    pass


@cli.command()
@click.option('--operator', default="system", help='操作者标识')
@click.option('--with-samples', is_flag=True, help='同时加载内置样例数据')
def init(operator, with_samples):
    """初始化系统"""
    print_header("系统初始化")
    
    result = engine.init_system(operator=operator)
    
    if result['success']:
        print_success(f"系统初始化成功！版本: {result['state']['version']}")
        print_info(f"数据目录: {result['state']['data_dir']}")
        
        if with_samples:
            print_info("\n正在加载内置样例数据...")
            _load_samples_internal(check_init=False)
    else:
        print_error(result.get('error', '初始化失败'))


@cli.command("load-samples")
def load_samples_cmds():
    """加载内置样例数据（活动、库存、订单）"""
    print_header("加载样例数据")
    _load_samples_internal(check_init=True)


@cli.command("load-low-stock")
def load_low_stock():
    """加载低库存样例（用于演示库存不足场景）"""
    print_header("加载低库存样例")
    check = engine.check_init_required()
    if check:
        print_error(check['error'])
        return
    
    inv_list = create_low_stock_inventory()
    for inv in inv_list:
        result = engine.import_data("inventory", inv)
        if result['success']:
            print_success(f"导入库存: {inv['sku']} ({inv['available_qty']}件)")
        else:
            print_warning(f"库存: {result.get('error', '导入失败')}")


@cli.group()
def import_data():
    """导入数据命令组"""
    pass


@import_data.command("activity")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default="system", help='操作者标识')
def import_activity(file_path, operator):
    """从JSON文件导入活动规则"""
    print_header(f"导入活动规则")
    check = engine.check_init_required()
    if check:
        print_error(check['error'])
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    result = engine.import_data("activity", data, operator=operator)
    if result['success']:
        print_success(result['message'])
        print_info(f"活动ID: {result['id']}")
    else:
        print_error(result.get('error', '导入失败'))
        print_json(result)


@import_data.command("order")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default="system", help='操作者标识')
def import_order(file_path, operator):
    """从JSON文件导入订单"""
    print_header(f"导入订单")
    check = engine.check_init_required()
    if check:
        print_error(check['error'])
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    result = engine.import_data("order", data, operator=operator)
    if result['success']:
        print_success(result['message'])
        print_info(f"订单ID: {result['id']}")
    else:
        print_error(result.get('error', '导入失败'))
        print_json(result)


@import_data.command("inventory")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default="system", help='操作者标识')
def import_inventory(file_path, operator):
    """从JSON文件导入库存"""
    print_header(f"导入库存")
    check = engine.check_init_required()
    if check:
        print_error(check['error'])
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    result = engine.import_data("inventory", data, operator=operator)
    if result['success']:
        print_success(result['message'])
        print_info(f"SKU: {result['id']}")
    else:
        print_error(result.get('error', '导入失败'))
        print_json(result)


@import_data.command("shipment")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default="system", help='操作者标识')
def import_shipment(file_path, operator):
    """从JSON文件导入发货记录（处理发货回调）"""
    print_header(f"处理发货回调")
    check = engine.check_init_required()
    if check:
        print_error(check['error'])
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    result = engine.import_data("shipment", data, operator=operator)
    if result['success']:
        print_success(result['message'])
        print_info(f"发货ID: {result.get('shipment_id', 'N/A')}")
    elif result.get('idempotent'):
        print_warning(result.get('error', '重复回调'))
        print_info(f"幂等保护已生效，跳过重复处理")
    else:
        print_error(result.get('error', '处理失败'))
        print_json(result)


@import_data.command("return")
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default="system", help='操作者标识')
def import_return(file_path, operator):
    """从JSON文件导入退货记录（处理退货回调）"""
    print_header(f"处理退货回调")
    check = engine.check_init_required()
    if check:
        print_error(check['error'])
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    result = engine.import_data("return", data, operator=operator)
    if result['success']:
        print_success(result['message'])
        print_info(f"退货ID: {result.get('return_id', 'N/A')}")
        if result.get('gift_status_change'):
            change = result['gift_status_change']
            if change.get('changed'):
                print_warning(f"赠品状态变更: {change.get('status')}")
                print_info(f"原因: {change.get('reason')}")
    elif result.get('idempotent'):
        print_warning(result.get('error', '重复回调'))
    else:
        print_error(result.get('error', '处理失败'))
        print_json(result)


@cli.command()
@click.option('--order-id', help='指定订单ID（不指定则检查所有订单）')
@click.option('--operator', default="system", help='操作者标识')
def check(order_id, operator):
    """执行规则校验"""
    print_header("规则校验")
    check_req = engine.check_init_required()
    if check_req:
        print_error(check_req['error'])
        return
    
    result = engine.check_rules(order_id=order_id, operator=operator)
    
    if result['success']:
        print_success(result['message'])
        
        summary = result['summary']
        print_info(f"\n状态分布:")
        for status, count in summary.get('status_distribution', {}).items():
            print_info(f"  {status}: {count}个")
        
        if result['results']:
            print_info(f"\n详细结果:")
            for r in result['results']:
                marker = "✓" if r.get('changed') else " "
                status_color = Fore.GREEN if "符合" in r.get('status', '') else (
                    Fore.YELLOW if "已扣费" in r.get('status', '') else Fore.RED
                )
                click.echo(f"  {marker} {r['order_id']}: {status_color}{r['status']}{Style.RESET_ALL} - {r['reason']}")
    else:
        print_error(result.get('error', '校验失败'))


@cli.command()
@click.option('--order-id', help='指定订单ID（不指定则分配所有符合条件的订单）')
@click.option('--operator', default="system", help='操作者标识')
def allocate(order_id, operator):
    """分配赠品库存"""
    print_header("赠品分配")
    check_req = engine.check_init_required()
    if check_req:
        print_error(check_req['error'])
        return
    
    result = engine.allocate_gifts(order_id=order_id, operator=operator)
    
    if result['success']:
        print_success(result['message'])
        
        for r in result['results']:
            if r.get('changed'):
                print_success(f"  {r['order_id']}: 分配 {r.get('allocated', 0)} 件，剩余可用 {r.get('remaining_available', 0)}")
            elif r.get('success'):
                print_info(f"  {r['order_id']}: {r.get('reason', '无需处理')}")
            else:
                print_error(f"  {r['order_id']}: {r.get('error', '分配失败')}")
                if 'available' in r:
                    print_warning(f"    可用: {r['available']}, 需要: {r['needed']}")
    else:
        print_error(result.get('error', '分配失败'))


@cli.command()
@click.argument('order_id')
def detail(order_id):
    """查看订单详细信息"""
    print_header(f"订单详情 - {order_id}")
    check_req = engine.check_init_required()
    if check_req:
        print_error(check_req['error'])
        return
    
    result = engine.get_order_detail(order_id)
    
    if not result['success']:
        print_error(result['error'])
        return
    
    order = result['order']
    calc = result['calculation']
    
    print_info("\n【基本信息】")
    print_table(
        ['字段', '值'],
        [
            ['订单ID', order['order_id']],
            ['用户', order['user_id']],
            ['订单状态', order['status']],
            ['实付金额', f"¥{order['paid_amount']}"],
            ['已退金额', f"¥{order['returned_amount']}"],
            ['实际金额', f"¥{calc['actual_amount']}"],
            ['活动门槛', f"¥{calc['threshold']}"],
            ['是否达标', '是' if calc['eligible'] else '否'],
        ]
    )
    
    print_info("\n【赠品状态】")
    status_color = Fore.GREEN if order.get('gift_status') in ['符合条件', '已分配', '已发货', '已补发'] else (
        Fore.YELLOW if order.get('gift_status') in ['待补发', '部分退回'] else Fore.RED
    )
    print_table(
        ['字段', '值'],
        [
            ['赠品SKU', order.get('gift_sku', 'N/A')],
            ['赠品状态', f"{status_color}{order.get('gift_status', 'N/A')}{Style.RESET_ALL}"],
            ['应发数量', order.get('gift_qty', 0)],
            ['已分配', order.get('gift_allocated_qty', 0)],
            ['已发货', order.get('gift_shipped_qty', 0)],
            ['已退回', order.get('gift_returned_qty', 0)],
            ['是否扣费', '是' if order.get('gift_deducted') else '否'],
            ['扣费金额', f"¥{order.get('gift_deduct_amount', 0)}"],
            ['补发次数', order.get('reissue_count', 0)],
            ['备注', order.get('remarks', '')],
        ]
    )
    
    if result.get('shipments'):
        print_info("\n【发货记录】")
        headers = ['发货ID', 'SKU', '数量', '发货时间', '操作人']
        rows = [[s['shipment_id'], s['gift_sku'], s['gift_qty'], s['shipped_at'], s['operator']] for s in result['shipments']]
        print_table(headers, rows)
    
    if result.get('returns'):
        print_info("\n【退货记录】")
        headers = ['退货ID', '退货金额', '退货时间', '原因', '操作人']
        rows = [[r['return_id'], f"¥{r['returned_amount']}", r['returned_at'], r.get('reason', ''), r['operator']] for r in result['returns']]
        print_table(headers, rows)
    
    if result.get('reissues'):
        print_info("\n【补发任务】")
        headers = ['任务ID', 'SKU', '数量', '原因', '状态', '操作人']
        rows = [[t['task_id'], t['gift_sku'], t['qty'], t['reason'], t['status'], t.get('operator', '')] for t in result['reissues']]
        print_table(headers, rows)
    
    if result.get('inventory_operations'):
        print_info("\n【库存操作】")
        headers = ['操作ID', '类型', '数量变化', '变更前', '变更后', '操作人', '原因']
        rows = [[op['operation_id'], op['operation_type'], op['qty_change'], op['before_qty'], op['after_qty'], op['operator'], op.get('reason', '')] for op in result['inventory_operations']]
        print_table(headers, rows)
    
    if result.get('audit_logs'):
        print_info("\n【审计日志】")
        headers = ['日志ID', '动作', '操作人', '原因', '时间']
        rows = [[a['log_id'], a['action'], a['operator'], a.get('reason', ''), a['created_at']] for a in result['audit_logs']]
        print_table(headers, rows)


@cli.command()
def report():
    """生成整体报告"""
    print_header("赠品履约整体报告")
    check_req = engine.check_init_required()
    if check_req:
        print_error(check_req['error'])
        return
    
    result = engine.generate_report()
    
    if not result['success']:
        print_error(result.get('error', '生成报告失败'))
        return
    
    print_info("\n【系统状态】")
    state = result['system_state']
    print_table(
        ['字段', '值'],
        [
            ['已初始化', '是' if state.get('initialized') else '否'],
            ['数据版本', state.get('version', 0)],
            ['最后动作', state.get('last_action', 'N/A')],
            ['最后时间', state.get('last_action_time', 'N/A')],
        ]
    )
    
    print_info("\n【数据概览】")
    summary = result['summary']
    print_table(
        ['指标', '数量'],
        [
            ['总订单数', summary['total_orders']],
            ['活动规则数', summary['total_activities']],
            ['发货记录数', summary['total_shipments']],
            ['退货记录数', summary['total_returns']],
            ['补发任务数', summary['total_reissues']],
            ['库存操作数', summary['total_inventory_ops']],
        ]
    )
    
    print_info("\n【赠品状态分布】")
    dist = result['gift_status_distribution']
    rows = [[status, count] for status, count in dist.items()]
    print_table(['状态', '订单数'], rows)
    
    print_info("\n【库存情况】")
    inv_rows = []
    for inv in result['inventory']:
        inv_rows.append([
            inv['sku'], inv['name'], inv['total'], inv['available'],
            inv['allocated'], inv['shipped'], inv['reissued']
        ])
    print_table(
        ['SKU', '名称', '总库存', '可用', '已占用', '已发货', '已补发'],
        inv_rows
    )
    
    abnormal = result['abnormal_orders']
    if abnormal:
        print_warning(f"\n【异常订单 ({len(abnormal)} 个)】")
        rows = []
        for o in abnormal:
            status_color = "⚠ 扣费" if o.get('gift_status') == '已扣费' else (
                "⌛ 待补发" if o.get('gift_status') == '待补发' else "❌ 分配失败"
            )
            rows.append([
                o['order_id'], status_color, o.get('gift_status', ''),
                f"¥{o.get('paid_amount', 0)}", f"¥{o.get('returned_amount', 0)}",
                o.get('remarks', '')
            ])
        print_table(['订单ID', '异常类型', '赠品状态', '实付', '已退', '备注'], rows)
    
    pending = result['pending_reissues']
    if pending:
        print_warning(f"\n【待处理补发任务 ({len(pending)} 个)】")
        rows = [[t['task_id'], t['order_id'], t['gift_sku'], t['qty'], t['reason']] for t in pending]
        print_table(['任务ID', '订单ID', 'SKU', '数量', '原因'], rows)
    
    financial = result['financial']
    if financial.get('total_deducted_amount', 0) > 0:
        print_info("\n【财务摘要】")
        print_warning(f"赠品扣费总金额: ¥{financial['total_deducted_amount']}")


@cli.group()
def reissue():
    """补发任务命令组"""
    pass


@reissue.command("create")
@click.argument('order_id')
@click.option('--reason', required=True, help='补发原因')
@click.option('--operator', default="system", help='操作者标识')
def create_reissue(order_id, reason, operator):
    """创建补发任务"""
    print_header(f"创建补发任务 - {order_id}")
    result = engine.create_reissue(order_id, reason, operator=operator)
    
    if result['success']:
        print_success(result['message'])
        print_info(f"任务ID: {result['task_id']}")
    else:
        print_error(result.get('error', '创建失败'))


@reissue.command("process")
@click.argument('task_id')
@click.option('--operator', default="system", help='操作者标识')
def process_reissue(task_id, operator):
    """处理补发任务"""
    print_header(f"处理补发任务 - {task_id}")
    result = engine.process_reissue(task_id, operator=operator)
    
    if result['success']:
        print_success(result['message'])
    elif result.get('idempotent'):
        print_warning(result.get('error', '重复处理'))
        print_info("幂等保护已生效")
    else:
        print_error(result.get('error', '处理失败'))


@cli.command("manual-fix")
@click.argument('entity_type', type=click.Choice(['order', 'inventory', 'activity']))
@click.argument('entity_id')
@click.option('--updates', required=True, help='JSON格式的更新内容')
@click.option('--reason', required=True, help='修正原因')
@click.option('--operator', required=True, help='操作者标识')
def manual_fix(entity_type, entity_id, updates, reason, operator):
    """人工修正数据（记录差异和操作者）"""
    print_header(f"人工修正 - {entity_type}/{entity_id}")
    
    try:
        updates_dict = json.loads(updates)
    except json.JSONDecodeError:
        print_error("updates 参数必须是有效的JSON格式")
        return
    
    result = engine.manual_fix(entity_type, entity_id, updates_dict, reason, operator)
    
    if result['success']:
        print_success(result['message'])
        print_info(f"操作者: {result['operator']}")
        print_info(f"原因: {result['reason']}")
        
        if result.get('diff'):
            print_warning("\n【变更差异】")
            for field, change in result['diff'].items():
                print_info(f"  {field}: {change['before']} → {change['after']}")
    else:
        print_error(result.get('error', '修正失败'))


@cli.command("list-audits")
@click.option('--entity-type', help='按实体类型过滤')
@click.option('--entity-id', help='按实体ID过滤')
def list_audits(entity_type, entity_id):
    """查看审计日志"""
    print_header("审计日志")
    check_req = engine.check_init_required()
    if check_req:
        print_error(check_req['error'])
        return
    
    from src.utils.storage import storage
    audits = storage.load_audits()
    
    if entity_type:
        audits = [a for a in audits if a['entity_type'] == entity_type]
    if entity_id:
        audits = [a for a in audits if a['entity_id'] == entity_id]
    
    if not audits:
        print_info("暂无审计日志")
        return
    
    rows = []
    for a in audits:
        diff_count = len(a.get('before', {}))
        rows.append([
            a['log_id'], a['entity_type'], a['entity_id'],
            a['action'], a['operator'], a.get('reason', ''),
            a['created_at']
        ])
    
    print_table(
        ['日志ID', '实体类型', '实体ID', '动作', '操作人', '原因', '时间'],
        rows
    )


@cli.command("list-inv-ops")
@click.option('--sku', help='按SKU过滤')
def list_inv_ops(sku):
    """查看库存操作日志"""
    print_header("库存操作日志")
    check_req = engine.check_init_required()
    if check_req:
        print_error(check_req['error'])
        return
    
    from src.utils.storage import storage
    ops = storage.load_inventory_ops()
    
    if sku:
        ops = [o for o in ops if o['sku'] == sku]
    
    if not ops:
        print_info("暂无库存操作记录")
        return
    
    rows = []
    for op in ops:
        change = f"+{op['qty_change']}" if op['qty_change'] > 0 else f"{op['qty_change']}"
        rows.append([
            op['operation_id'], op['sku'], op['operation_type'],
            change, op['before_qty'], op['after_qty'],
            op.get('order_id', ''), op['operator'],
            op.get('reason', ''), op['created_at']
        ])
    
    print_table(
        ['操作ID', 'SKU', '类型', '变化', '变更前', '变更后', '关联订单', '操作人', '原因', '时间'],
        rows
    )


if __name__ == "__main__":
    cli()
