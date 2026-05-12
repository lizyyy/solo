"""药品效期调拨 CLI"""
import click
import os
import json
import csv
from datetime import date, timedelta
from tabulate import tabulate
from colorama import init, Fore, Style

from .database import Database
from .models import (
    Store, Medicine, Batch, Inventory, Allocation,
    generate_allocation_code,
)
from .rules import AllocationRulesEngine, AllocationSuggestion
from .config import (
    DB_FILENAME,
    NEAR_EXPIRY_DAYS,
    CRITICAL_EXPIRY_DAYS,
    STORAGE_TYPE_NORMAL,
    STORAGE_TYPE_COLD,
    STORAGE_TYPE_FROZEN,
    STATUS_PENDING,
    STATUS_APPROVED,
    STATUS_COMPLETED,
    STATUS_REJECTED,
    STATUS_CANCELLED,
    STATUS_FAILED,
)

init(autoreset=True)


def get_db():
    return Database()


def print_success(message: str):
    click.echo(Fore.GREEN + f"✓ {message}" + Style.RESET_ALL)


def print_error(message: str):
    click.echo(Fore.RED + f"✗ {message}" + Style.RESET_ALL)


def print_warning(message: str):
    click.echo(Fore.YELLOW + f"⚠ {message}" + Style.RESET_ALL)


def print_info(message: str):
    click.echo(Fore.CYAN + f"ℹ {message}" + Style.RESET_ALL)


@click.group()
@click.version_option(version="1.0.0", prog_name="expiry-allocation")
def cli():
    """药品效期调拨 CLI 工具 - 解决连锁药房近效期药品跨店调拨问题"""
    pass


@cli.command()
def init():
    """初始化项目和数据库"""
    db = get_db()
    
    if db.is_initialized():
        print_warning("数据库已存在，将重新初始化")
    
    db.initialize()
    print_success(f"数据库初始化成功: {db.db_path}")
    
    from .sample_data import SampleDataGenerator
    generator = SampleDataGenerator(db)
    generator.generate_all()
    print_success("示例数据已加载")
    
    click.echo()
    print_info("可用命令:")
    click.echo("  expiry-allocation import --help")
    click.echo("  expiry-allocation check --help")
    click.echo("  expiry-allocation detail --help")
    click.echo("  expiry-allocation report --help")


@cli.command()
@click.option('--type', '-t', 
              type=click.Choice(['stores', 'medicines', 'batches', 'inventory', 'all']),
              default='all',
              help='导入类型')
@click.option('--file', '-f', 
              type=click.Path(exists=True),
              help='CSV/JSON 文件路径')
@click.option('--operator', '-o',
              default='system',
              help='操作者名称')
def import_data(type, file, operator):
    """导入门店、药品、批次或库存数据"""
    db = get_db()
    
    if not db.is_initialized():
        print_error("数据库未初始化，请先运行 'expiry-allocation init'")
        return
    
    if file:
        import_from_file(db, file, type, operator)
    else:
        from .sample_data import SampleDataGenerator
        generator = SampleDataGenerator(db)
        
        if type == 'stores' or type == 'all':
            generator.generate_stores()
            print_success("门店数据已导入")
        
        if type == 'medicines' or type == 'all':
            generator.generate_medicines()
            print_success("药品数据已导入")
        
        if type == 'batches' or type == 'all':
            generator.generate_batches()
            print_success("批次数据已导入")
        
        if type == 'inventory' or type == 'all':
            generator.generate_inventory()
            print_success("库存数据已导入")


def import_from_file(db: Database, file_path: str, import_type: str, operator: str):
    """从文件导入数据"""
    if file_path.endswith('.json'):
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    elif file_path.endswith('.csv'):
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data = list(reader)
    else:
        print_error("不支持的文件格式，仅支持 JSON 或 CSV")
        return
    
    if import_type == 'stores':
        for item in data:
            store = Store.create(
                db=db,
                store_code=item.get('store_code', item.get('code', '')),
                store_name=item.get('store_name', item.get('name', '')),
                region=item.get('region', 'default'),
                address=item.get('address'),
                phone=item.get('phone'),
            )
        print_success(f"已导入 {len(data)} 家门店")
    
    elif import_type == 'medicines':
        for item in data:
            medicine = Medicine.create(
                db=db,
                medicine_code=item.get('medicine_code', item.get('code', '')),
                medicine_name=item.get('medicine_name', item.get('name', '')),
                storage_type=item.get('storage_type', STORAGE_TYPE_NORMAL),
                unit=item.get('unit', 'box'),
                price=float(item.get('price', 0)),
            )
        print_success(f"已导入 {len(data)} 种药品")
    
    elif import_type == 'batches':
        for item in data:
            medicine = Medicine.get_by_code(db, item.get('medicine_code', ''))
            if not medicine:
                print_warning(f"跳过批次 {item.get('batch_no')}: 药品 {item.get('medicine_code')} 不存在")
                continue
            Batch.create(
                db=db,
                medicine_id=medicine.id,
                batch_no=item.get('batch_no', ''),
                expiry_date=item.get('expiry_date', ''),
                supplier=item.get('supplier'),
            )
        print_success(f"已导入 {len(data)} 个批次")
    
    elif import_type == 'inventory':
        for item in data:
            store = Store.get_by_code(db, item.get('store_code', ''))
            medicine = Medicine.get_by_code(db, item.get('medicine_code', ''))
            
            if not store or not medicine:
                print_warning(f"跳过库存记录: 门店或药品不存在")
                continue
            
            batch = Batch.get_by_medicine_and_batch(db, medicine.id, item.get('batch_no', ''))
            if not batch:
                print_warning(f"跳过库存记录: 批次 {item.get('batch_no')} 不存在")
                continue
            
            Inventory.update_upsert(
                db=db,
                store_id=store.id,
                batch_id=batch.id,
                quantity=int(item.get('quantity', 0)),
                daily_sales_rate=float(item.get('daily_sales_rate', 0)),
            )
        print_success(f"已导入 {len(data)} 条库存记录")


@cli.command()
@click.option('--store', '-s',
              help='指定门店代码')
@click.option('--medicine', '-m',
              help='指定药品代码')
@click.option('--create', '-c',
              is_flag=True,
              help='自动创建调拨订单')
@click.option('--operator', '-o',
              default='system',
              help='操作者名称')
def check(store, medicine, create, operator):
    """检查调拨可行性并生成建议"""
    db = get_db()
    
    if not db.is_initialized():
        print_error("数据库未初始化，请先运行 'expiry-allocation init'")
        return
    
    engine = AllocationRulesEngine(db)
    suggestions = engine.generate_suggestions()
    
    if store:
        suggestions = [s for s in suggestions 
                      if s.source_store.store_code == store or s.target_store.store_code == store]
    
    if medicine:
        suggestions = [s for s in suggestions 
                      if s.medicine.medicine_code == medicine]
    
    if not suggestions:
        print_info("未找到高风险库存或调拨建议")
        return
    
    click.echo()
    click.echo(Fore.CYAN + "=" * 80)
    click.echo(Fore.CYAN + f"调拨建议汇总 - 共 {len(suggestions)} 条")
    click.echo(Fore.CYAN + "=" * 80 + Style.RESET_ALL)
    click.echo()
    
    valid_suggestions = []
    invalid_suggestions = []
    
    for i, sugg in enumerate(suggestions, 1):
        if sugg.errors:
            invalid_suggestions.append(sugg)
        else:
            valid_suggestions.append(sugg)
    
    if valid_suggestions:
        click.echo(Fore.GREEN + "可执行调拨建议:" + Style.RESET_ALL)
        print_suggestions_table(valid_suggestions, show_passed=True)
    
    if invalid_suggestions:
        click.echo()
        click.echo(Fore.RED + "不可执行调拨建议（存在限制）:" + Style.RESET_ALL)
        print_suggestions_table(invalid_suggestions, show_errors=True)
    
    click.echo()
    print_info(f"总计: {len(suggestions)} 条建议, "
               f"可执行 {len(valid_suggestions)} 条, "
               f"受限制 {len(invalid_suggestions)} 条")
    
    if create and valid_suggestions:
        click.echo()
        created_count = 0
        for sugg in valid_suggestions:
            allocation_code = generate_allocation_code(
                sugg.source_store.store_code,
                sugg.target_store.store_code,
                sugg.batch.batch_no,
                sugg.quantity,
            )
            
            existing = Allocation.get_pending_duplicate(
                db, sugg.source_store.id, sugg.target_store.id, sugg.batch.id
            )
            
            if existing:
                print_warning(f"跳过重复调拨: {existing.allocation_code}")
                continue
            
            allocation = Allocation.create(
                db=db,
                allocation_code=allocation_code,
                source_store_id=sugg.source_store.id,
                target_store_id=sugg.target_store.id,
                batch_id=sugg.batch.id,
                quantity=sugg.quantity,
                risk_reduction=sugg.risk_reduction,
            )
            
            allocation.add_history(
                db=db,
                action="创建调拨",
                operator=operator,
                remarks=f"自动创建: {', '.join(sugg.reasons)}",
                before_quantity=0,
                after_quantity=sugg.quantity,
            )
            
            print_success(f"已创建调拨: {allocation_code}")
            created_count += 1
        
        click.echo()
        print_success(f"共创建 {created_count} 条调拨订单")


def print_suggestions_table(suggestions: list, show_passed: bool = False, show_errors: bool = False):
    """打印调拨建议表格"""
    if not suggestions:
        return
    
    rows = []
    for i, sugg in enumerate(suggestions, 1):
        risk_color = {
            "critical": Fore.RED,
            "near": Fore.YELLOW,
            "normal": Fore.GREEN,
            "expired": Fore.MAGENTA,
        }.get(sugg.risk_level, Fore.WHITE)
        
        rows.append([
            i,
            sugg.medicine.medicine_name,
            sugg.batch.batch_no,
            risk_color + sugg.risk_level.upper() + Style.RESET_ALL,
            sugg.days_until_expiry,
            sugg.source_store.store_code,
            sugg.target_store.store_code,
            sugg.quantity,
            f"{sugg.risk_reduction:.1f}%",
            "\n".join(sugg.reasons[:2]) if sugg.reasons else "-",
        ])
    
    headers = [
        "#", "药品", "批次", "风险等级", "效期天数",
        "源门店", "目标门店", "调拨量", "风险降低", "原因"
    ]
    
    click.echo(tabulate(rows, headers=headers, tablefmt="grid"))
    
    if show_passed and len(suggestions) <= 5:
        for sugg in suggestions:
            click.echo()
            click.echo(f"  {Fore.CYAN}{sugg.medicine.medicine_name} ({sugg.batch.batch_no}){Style.RESET_ALL}")
            for reason in sugg.reasons:
                click.echo(f"    {Fore.GREEN}✓{Style.RESET_ALL} {reason}")
            for passed in sugg.passed:
                click.echo(f"    {Fore.GREEN}✓{Style.RESET_ALL} {passed}")
    
    if show_errors:
        for sugg in suggestions:
            if sugg.errors:
                click.echo()
                click.echo(f"  {Fore.MAGENTA}{sugg.medicine.medicine_name} ({sugg.batch.batch_no}){Style.RESET_ALL}")
                for error in sugg.errors:
                    click.echo(f"    {Fore.RED}✗{Style.RESET_ALL} {error}")


@cli.command()
@click.argument('allocation_code', required=False)
@click.option('--status',
              type=click.Choice([STATUS_PENDING, STATUS_APPROVED, STATUS_COMPLETED, 
                               STATUS_REJECTED, STATUS_CANCELLED, STATUS_FAILED, 'all']),
              default='all',
              help='按状态筛选')
@click.option('--action', '-a',
              type=click.Choice(['approve', 'reject', 'cancel', 'complete', 'modify']),
              help='对指定调拨执行操作')
@click.option('--new-quantity', '-q',
              type=int,
              help='修改后的数量（用于 modify 操作）')
@click.option('--operator', '-o',
              default='system',
              help='操作者名称')
@click.option('--remarks', '-r',
              help='备注信息')
def detail(allocation_code, status, action, new_quantity, operator, remarks):
    """查看调拨详情或执行调拨操作"""
    db = get_db()
    
    if not db.is_initialized():
        print_error("数据库未初始化，请先运行 'expiry-allocation init'")
        return
    
    if allocation_code:
        allocation = Allocation.get_by_code(db, allocation_code)
        if not allocation:
            print_error(f"未找到调拨: {allocation_code}")
            return
        
        if action:
            perform_action(db, allocation, action, new_quantity, operator, remarks)
            allocation = Allocation.get_by_code(db, allocation_code)
        
        print_allocation_detail(db, allocation)
    else:
        if status == 'all':
            allocations = Allocation.get_all(db)
        else:
            allocations = Allocation.get_all(db, status)
        
        if not allocations:
            print_info("暂无调拨记录")
            return
        
        print_allocations_list(allocations)
        click.echo()
        print_info(f"使用 'expiry-allocation detail <调拨编号>' 查看详情")


def perform_action(db: Database, allocation: Allocation, action: str, 
                   new_quantity: int, operator: str, remarks: str):
    """执行调拨操作"""
    if action == 'approve':
        success, msg = allocation.transition_status(db, STATUS_APPROVED, operator, remarks)
        if success:
            print_success(msg)
        else:
            print_error(msg)
    
    elif action == 'reject':
        success, msg = allocation.transition_status(db, STATUS_REJECTED, operator, remarks)
        if success:
            print_success(msg)
        else:
            print_error(msg)
    
    elif action == 'cancel':
        success, msg = allocation.transition_status(db, STATUS_CANCELLED, operator, remarks)
        if success:
            print_success(msg)
        else:
            print_error(msg)
    
    elif action == 'complete':
        if allocation.status != STATUS_APPROVED:
            print_error("只有已审批的调拨才能执行完成")
            return
        
        success, msg = allocation.execute_allocation(db, operator)
        if success:
            print_success(msg)
        else:
            print_error(msg)
    
    elif action == 'modify':
        if allocation.status not in [STATUS_PENDING, STATUS_APPROVED]:
            print_error("只有待处理或已审批的调拨才能修改")
            return
        
        if new_quantity is None:
            print_error("请使用 --new-quantity 指定新数量")
            return
        
        success, msg = allocation.update_quantity(db, new_quantity, operator, remarks)
        if success:
            print_success(msg)
        else:
            print_error(msg)


def print_allocations_list(allocations: list):
    """打印调拨列表"""
    status_colors = {
        STATUS_PENDING: Fore.YELLOW,
        STATUS_APPROVED: Fore.CYAN,
        STATUS_COMPLETED: Fore.GREEN,
        STATUS_REJECTED: Fore.RED,
        STATUS_CANCELLED: Fore.MAGENTA,
        STATUS_FAILED: Fore.RED,
    }
    
    rows = []
    for alloc in allocations:
        color = status_colors.get(alloc.status, Fore.WHITE)
        rows.append([
            alloc.allocation_code,
            color + alloc.status.upper() + Style.RESET_ALL,
            f"{alloc.risk_reduction:.1f}%",
            alloc.created_at[:19] if alloc.created_at else "-",
        ])
    
    headers = ["调拨编号", "状态", "风险降低", "创建时间"]
    click.echo(tabulate(rows, headers=headers, tablefmt="grid"))


def print_allocation_detail(db: Database, allocation: Allocation):
    """打印调拨详情"""
    source_store = allocation.get_source_store(db)
    target_store = allocation.get_target_store(db)
    batch = allocation.get_batch(db)
    medicine = batch.get_medicine(db) if batch else None
    history = allocation.get_history(db)
    
    status_colors = {
        STATUS_PENDING: Fore.YELLOW,
        STATUS_APPROVED: Fore.CYAN,
        STATUS_COMPLETED: Fore.GREEN,
        STATUS_REJECTED: Fore.RED,
        STATUS_CANCELLED: Fore.MAGENTA,
        STATUS_FAILED: Fore.RED,
    }
    status_color = status_colors.get(allocation.status, Fore.WHITE)
    
    click.echo()
    click.echo(Fore.CYAN + "=" * 80)
    click.echo(Fore.CYAN + "调拨详情" + Style.RESET_ALL)
    click.echo(Fore.CYAN + "=" * 80 + Style.RESET_ALL)
    click.echo()
    
    basic_info = [
        ["调拨编号", allocation.allocation_code],
        ["状态", status_color + allocation.status.upper() + Style.RESET_ALL],
        ["风险降低", f"{allocation.risk_reduction:.1f}%"],
        ["创建时间", allocation.created_at[:19] if allocation.created_at else "-"],
        ["更新时间", allocation.updated_at[:19] if allocation.updated_at else "-"],
    ]
    click.echo(tabulate(basic_info, tablefmt="plain"))
    
    click.echo()
    click.echo(Fore.YELLOW + "药品信息:" + Style.RESET_ALL)
    med_info = []
    if medicine:
        storage_display = {
            STORAGE_TYPE_NORMAL: "常温",
            STORAGE_TYPE_COLD: "冷链",
            STORAGE_TYPE_FROZEN: "冷冻",
        }.get(medicine.storage_type, medicine.storage_type)
        
        med_info = [
            ["药品代码", medicine.medicine_code],
            ["药品名称", medicine.medicine_name],
            ["批次号", batch.batch_no if batch else "-"],
            ["效期", batch.expiry_date if batch else "-"],
            ["储存条件", storage_display],
            ["单价", f"¥{medicine.price:.2f}" if medicine.price else "-"],
        ]
    click.echo(tabulate(med_info, tablefmt="plain"))
    
    click.echo()
    click.echo(Fore.YELLOW + "调拨信息:" + Style.RESET_ALL)
    alloc_info = [
        ["源门店", f"{source_store.store_code} - {source_store.store_name}" if source_store else "-"],
        ["目标门店", f"{target_store.store_code} - {target_store.store_name}" if target_store else "-"],
        ["调拨数量", allocation.quantity],
        ["源门店调拨前", allocation.source_before_qty if allocation.source_before_qty else "-"],
        ["源门店调拨后", allocation.source_after_qty if allocation.source_after_qty else "-"],
        ["目标门店调拨前", allocation.target_before_qty if allocation.target_before_qty else "-"],
        ["目标门店调拨后", allocation.target_after_qty if allocation.target_after_qty else "-"],
    ]
    click.echo(tabulate(alloc_info, tablefmt="plain"))
    
    if history:
        click.echo()
        click.echo(Fore.YELLOW + "操作历史:" + Style.RESET_ALL)
        history_rows = []
        for i, h in enumerate(history, 1):
            changes = []
            if h.get('before_status') and h.get('after_status'):
                changes.append(f"状态: {h['before_status']} → {h['after_status']}")
            if h.get('before_quantity') is not None and h.get('after_quantity') is not None:
                changes.append(f"数量: {h['before_quantity']} → {h['after_quantity']}")
            
            history_rows.append([
                i,
                h['action'],
                h['operator'],
                "\n".join(changes) if changes else "-",
                h.get('remarks') or "-",
                h['created_at'][:19] if h.get('created_at') else "-",
            ])
        
        history_headers = ["#", "操作", "操作者", "变更内容", "备注", "时间"]
        click.echo(tabulate(history_rows, headers=history_headers, tablefmt="grid"))


@cli.command()
@click.option('--format', '-f',
              type=click.Choice(['table', 'json', 'csv']),
              default='table',
              help='报告格式')
@click.option('--output', '-o',
              type=click.Path(),
              help='输出文件路径')
def report(format, output):
    """生成风险降低报告和库存变化统计"""
    db = get_db()
    
    if not db.is_initialized():
        print_error("数据库未初始化，请先运行 'expiry-allocation init'")
        return
    
    report_data = generate_report(db)
    
    if format == 'json':
        content = json.dumps(report_data, ensure_ascii=False, indent=2)
    elif format == 'csv':
        content = report_to_csv(report_data)
    else:
        content = None
        print_report_table(report_data)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            if content:
                f.write(content)
            else:
                f.write(json.dumps(report_data, ensure_ascii=False, indent=2))
        print_success(f"报告已保存到: {output}")
    elif format != 'table':
        click.echo(content)


def generate_report(db: Database) -> dict:
    """生成报告数据"""
    today = date.today()
    
    all_allocations = Allocation.get_all(db)
    completed = [a for a in all_allocations if a.status == STATUS_COMPLETED]
    pending = [a for a in all_allocations if a.status == STATUS_PENDING]
    approved = [a for a in all_allocations if a.status == STATUS_APPROVED]
    rejected = [a for a in all_allocations if a.status == STATUS_REJECTED]
    cancelled = [a for a in all_allocations if a.status == STATUS_CANCELLED]
    
    engine = AllocationRulesEngine(db)
    high_risk_invs = engine.find_high_risk_inventory()
    
    total_quantity = sum(a.quantity for a in completed)
    total_risk_reduction = sum(a.risk_reduction for a in completed)
    avg_risk_reduction = total_risk_reduction / len(completed) if completed else 0
    
    stores = Store.get_all(db)
    medicines = Medicine.get_all(db)
    
    inventory_stats = calculate_inventory_stats(db)
    
    return {
        "report_date": today.isoformat(),
        "summary": {
            "total_allocations": len(all_allocations),
            "completed": len(completed),
            "pending": len(pending),
            "approved": len(approved),
            "rejected": len(rejected),
            "cancelled": len(cancelled),
            "total_quantity": total_quantity,
            "total_risk_reduction_percent": round(total_risk_reduction, 2),
            "avg_risk_reduction_percent": round(avg_risk_reduction, 2),
        },
        "high_risk_inventory": {
            "count": len(high_risk_invs),
            "details": [
                {
                    "store_code": inv.get_store(db).store_code if inv.get_store(db) else "-",
                    "medicine": inv.get_batch(db).get_medicine(db).medicine_name if inv.get_batch(db) and inv.get_batch(db).get_medicine(db) else "-",
                    "batch_no": inv.get_batch(db).batch_no if inv.get_batch(db) else "-",
                    "quantity": inv.quantity,
                    "days_until_expiry": inv.get_batch(db).get_days_until_expiry() if inv.get_batch(db) else 0,
                    "daily_sales_rate": inv.daily_sales_rate,
                }
                for inv in high_risk_invs
            ]
        },
        "stores": {
            "count": len(stores),
        },
        "medicines": {
            "count": len(medicines),
        },
        "inventory_stats": inventory_stats,
    }


def calculate_inventory_stats(db: Database) -> dict:
    """计算库存统计"""
    today = date.today()
    critical_cutoff = today + timedelta(days=CRITICAL_EXPIRY_DAYS)
    near_cutoff = today + timedelta(days=NEAR_EXPIRY_DAYS)
    
    inv_rows = db.query("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN b.expiry_date < ? THEN i.quantity ELSE 0 END) as expired_qty,
            SUM(CASE WHEN b.expiry_date >= ? AND b.expiry_date < ? THEN i.quantity ELSE 0 END) as critical_qty,
            SUM(CASE WHEN b.expiry_date >= ? AND b.expiry_date < ? THEN i.quantity ELSE 0 END) as near_qty
        FROM inventory i
        JOIN batches b ON i.batch_id = b.id
        WHERE i.quantity > 0
    """, (
        today.isoformat(),
        today.isoformat(), critical_cutoff.isoformat(),
        critical_cutoff.isoformat(), near_cutoff.isoformat(),
    ))
    
    if inv_rows:
        row = inv_rows[0]
        return {
            "total_items": row['total'] or 0,
            "expired_quantity": row['expired_qty'] or 0,
            "critical_quantity": row['critical_qty'] or 0,
            "near_expiry_quantity": row['near_qty'] or 0,
        }
    
    return {"total_items": 0, "expired_quantity": 0, "critical_quantity": 0, "near_expiry_quantity": 0}


def report_to_csv(data: dict) -> str:
    """转换报告为 CSV 格式"""
    lines = []
    
    lines.append("【汇总统计】")
    lines.append("指标,数值")
    summary = data["summary"]
    for key, value in summary.items():
        lines.append(f"{key},{value}")
    
    lines.append("")
    lines.append("【高风险库存】")
    if data["high_risk_inventory"]["details"]:
        lines.append("门店,药品,批次,数量,效期天数,日销量")
        for item in data["high_risk_inventory"]["details"]:
            lines.append(f"{item['store_code']},{item['medicine']},{item['batch_no']},"
                        f"{item['quantity']},{item['days_until_expiry']},{item['daily_sales_rate']}")
    
    return "\n".join(lines)


def print_report_table(data: dict):
    """打印表格报告"""
    click.echo()
    click.echo(Fore.CYAN + "=" * 80)
    click.echo(Fore.CYAN + f"药品效期调拨报告 - {data['report_date']}")
    click.echo(Fore.CYAN + "=" * 80 + Style.RESET_ALL)
    click.echo()
    
    click.echo(Fore.YELLOW + "一、汇总统计" + Style.RESET_ALL)
    summary = data["summary"]
    summary_rows = [
        ["总调拨数", summary["total_allocations"]],
        ["已完成", Fore.GREEN + str(summary["completed"]) + Style.RESET_ALL],
        ["待处理", Fore.YELLOW + str(summary["pending"]) + Style.RESET_ALL],
        ["已审批", Fore.CYAN + str(summary["approved"]) + Style.RESET_ALL],
        ["已拒绝", Fore.RED + str(summary["rejected"]) + Style.RESET_ALL],
        ["已取消", Fore.MAGENTA + str(summary["cancelled"]) + Style.RESET_ALL],
        ["调拨总量", summary["total_quantity"]],
        ["总风险降低", Fore.GREEN + f"{summary['total_risk_reduction_percent']}%" + Style.RESET_ALL],
        ["平均风险降低", f"{summary['avg_risk_reduction_percent']}%"],
    ]
    click.echo(tabulate(summary_rows, tablefmt="plain"))
    
    click.echo()
    click.echo(Fore.YELLOW + "二、库存统计" + Style.RESET_ALL)
    stats = data["inventory_stats"]
    stats_rows = [
        ["库存条目数", stats["total_items"]],
        ["过期库存", Fore.RED + str(stats["expired_quantity"]) + Style.RESET_ALL],
        ["临期库存(30天内)", Fore.YELLOW + str(stats["critical_quantity"]) + Style.RESET_ALL],
        ["近效期库存(90天内)", str(stats["near_expiry_quantity"])],
    ]
    click.echo(tabulate(stats_rows, tablefmt="plain"))
    
    if data["high_risk_inventory"]["details"]:
        click.echo()
        click.echo(Fore.YELLOW + "三、高风险库存明细" + Style.RESET_ALL)
        risk_rows = []
        for item in data["high_risk_inventory"]["details"]:
            days = item["days_until_expiry"]
            color = Fore.RED if days <= CRITICAL_EXPIRY_DAYS else Fore.YELLOW
            risk_rows.append([
                item["store_code"],
                item["medicine"],
                item["batch_no"],
                item["quantity"],
                color + str(days) + Style.RESET_ALL,
                item["daily_sales_rate"],
            ])
        
        risk_headers = ["门店", "药品", "批次", "数量", "效期天数", "日销量"]
        click.echo(tabulate(risk_rows, headers=risk_headers, tablefmt="grid"))
    
    click.echo()
    click.echo(Fore.CYAN + "=" * 80 + Style.RESET_ALL)
    click.echo()
    print_info("使用 --format json/csv 获取结构化报告")
    print_info("使用 --output <文件路径> 保存报告")


if __name__ == "__main__":
    cli()
