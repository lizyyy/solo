#!/usr/bin/env python3
import os
import sys
import json
import click
import pandas as pd
from datetime import datetime
from pathlib import Path
from tabulate import tabulate

DATA_DIR = '.refund_data'
FILES = {
    'config': 'config.json',
    'orders': 'orders.csv',
    'products': 'products.csv',
    'stockout': 'stockout.csv',
    'refunds': 'refunds.csv',
    'replacements': 'replacements.csv',
    'commissions': 'commissions.csv',
    'import_log': 'import_log.json',
    'history': 'history.json'
}


def ensure_data_dir():
    Path(DATA_DIR).mkdir(exist_ok=True)


def get_file_path(name):
    return os.path.join(DATA_DIR, FILES[name])


def read_json_file(name):
    path = get_file_path(name)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def write_json_file(name, data):
    path = get_file_path(name)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_csv_file(name):
    path = get_file_path(name)
    if os.path.exists(path):
        if os.path.getsize(path) == 0:
            return pd.DataFrame()
        try:
            return pd.read_csv(path, dtype=str)
        except pd.errors.EmptyDataError:
            return pd.DataFrame()
    return pd.DataFrame()


def write_csv_file(name, df):
    path = get_file_path(name)
    df.to_csv(path, index=False, encoding='utf-8')


def init_config():
    config = {
        'commission_rate': 0.1,
        'commission_refunded': True,
        'batch_date': datetime.now().strftime('%Y%m%d')
    }
    write_json_file('config', config)
    return config


def log_import(data_type, source_file, record_count, batch_id):
    log = read_json_file('import_log')
    key = f"{data_type}_{batch_id}"
    log[key] = {
        'data_type': data_type,
        'source_file': source_file,
        'record_count': record_count,
        'batch_id': batch_id,
        'imported_at': datetime.now().isoformat()
    }
    write_json_file('import_log', log)


def check_already_imported(data_type, batch_id):
    log = read_json_file('import_log')
    key = f"{data_type}_{batch_id}"
    return key in log


def record_to_history(action, details):
    history = read_json_file('history')
    if 'events' not in history:
        history['events'] = []
    history['events'].append({
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'details': details
    })
    write_json_file('history', history)


@click.group()
def cli():
    pass


@cli.command()
@click.option('--commission-rate', type=float, default=0.1, help='团长佣金比例，默认0.1')
@click.option('--commission-refunded/--no-commission-refunded', default=True, help='退款商品是否仍计佣金')
@click.option('--batch-date', help='批次日期，格式YYYYMMDD')
def init(commission_rate, commission_refunded, batch_date):
    """初始化数据目录和配置"""
    ensure_data_dir()
    
    config = {
        'commission_rate': commission_rate,
        'commission_refunded': commission_refunded,
        'batch_date': batch_date or datetime.now().strftime('%Y%m%d')
    }
    write_json_file('config', config)
    
    for name in ['orders', 'products', 'stockout', 'refunds', 'replacements', 'commissions']:
        if not os.path.exists(get_file_path(name)):
            pd.DataFrame().to_csv(get_file_path(name), index=False, encoding='utf-8')
    
    write_json_file('import_log', {})
    write_json_file('history', {'events': []})
    
    click.echo(f"✓ 初始化完成")
    click.echo(f"  佣金比例: {commission_rate*100}%")
    click.echo(f"  退款仍计佣金: {'是' if commission_refunded else '否'}")
    click.echo(f"  批次日期: {config['batch_date']}")
    click.echo(f"  数据目录: {os.path.abspath(DATA_DIR)}")


@cli.command()
@click.argument('data_type', type=click.Choice(['orders', 'products', 'stockout']))
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--batch-id', help='批次ID，用于幂等检查')
def import_data(data_type, file_path, batch_id):
    """导入数据：orders(订单) / products(商品) / stockout(缺货)"""
    ensure_data_dir()
    config = read_json_file('config')
    
    if not batch_id:
        batch_id = f"{config['batch_date']}_{data_type}"
    
    if check_already_imported(data_type, batch_id):
        click.echo(f"⚠ 批次 {batch_id} 已导入过，跳过")
        return
    
    df = pd.read_csv(file_path, dtype=str)
    
    if data_type == 'orders':
        required = ['order_id', 'building', 'room', 'product_id', 'product_name', 'quantity', 'unit_price', 'total_amount', 'paid_amount']
        for col in required:
            if col not in df.columns:
                click.echo(f"✗ 订单文件缺少必要列: {col}")
                sys.exit(1)
        existing = read_csv_file('orders')
        if 'order_item_id' not in df.columns:
            df['order_item_id'] = df['order_id'] + '_' + df['product_id']
        combined = pd.concat([existing, df]).drop_duplicates(subset='order_item_id', keep='last')
        write_csv_file('orders', combined)
        
    elif data_type == 'products':
        required = ['product_id', 'product_name', 'supplier', 'cost_price']
        for col in required:
            if col not in df.columns:
                click.echo(f"✗ 商品文件缺少必要列: {col}")
                sys.exit(1)
        existing = read_csv_file('products')
        combined = pd.concat([existing, df]).drop_duplicates(subset='product_id', keep='last')
        write_csv_file('products', combined)
        
    elif data_type == 'stockout':
        required = ['product_id', 'stockout_qty', 'batch_id']
        for col in required:
            if col not in df.columns:
                click.echo(f"✗ 缺货文件缺少必要列: {col}")
                sys.exit(1)
        if 'replacement_product_id' not in df.columns:
            df['replacement_product_id'] = ''
            df['replacement_name'] = ''
        if 'replacement_approved' not in df.columns:
            df['replacement_approved'] = 'false'
        existing = read_csv_file('stockout')
        combined = pd.concat([existing, df]).drop_duplicates(subset=['product_id', 'batch_id'], keep='last')
        write_csv_file('stockout', combined)
    
    log_import(data_type, file_path, len(df), batch_id)
    record_to_history('import', {
        'data_type': data_type,
        'file': file_path,
        'records': len(df),
        'batch_id': batch_id
    })
    
    click.echo(f"✓ 已导入 {len(df)} 条 {data_type} 记录 (批次: {batch_id})")


@cli.command()
def validate():
    """校验数据一致性"""
    ensure_data_dir()
    
    orders = read_csv_file('orders')
    products = read_csv_file('products')
    stockout = read_csv_file('stockout')
    config = read_json_file('config')
    
    issues = []
    warnings = []
    
    if orders.empty:
        issues.append('没有订单数据')
    if products.empty:
        issues.append('没有商品数据')
    
    if not orders.empty and not products.empty:
        order_products = set(orders['product_id'].unique())
        product_ids = set(products['product_id'].unique())
        missing = order_products - product_ids
        if missing:
            warnings.append(f"订单中 {len(missing)} 个商品在商品表中缺失: {', '.join(list(missing)[:5])}")
    
    if not orders.empty:
        orders['quantity'] = pd.to_numeric(orders['quantity'], errors='coerce')
        orders['paid_amount'] = pd.to_numeric(orders['paid_amount'], errors='coerce')
        orders['total_amount'] = pd.to_numeric(orders['total_amount'], errors='coerce')
        
        if (orders['quantity'] <= 0).any():
            issues.append('存在数量<=0的订单明细')
        if (orders['paid_amount'] < 0).any():
            issues.append('存在实付金额<0的订单明细')
    
    if not stockout.empty:
        stockout['stockout_qty'] = pd.to_numeric(stockout['stockout_qty'], errors='coerce')
        if (stockout['stockout_qty'] <= 0).any():
            warnings.append('存在缺货数量<=0的记录')
        
        stockout_products = set(stockout['product_id'].unique())
        order_products = set(orders['product_id'].unique()) if not orders.empty else set()
        extra = stockout_products - order_products
        if extra:
            warnings.append(f"缺货表中 {len(extra)} 个商品没有对应订单: {', '.join(list(extra)[:3])}")
    
    click.echo(f"=== 数据校验报告 ({datetime.now().strftime('%Y-%m-%d %H:%M')}) ===")
    click.echo(f"订单: {len(orders)} 条")
    click.echo(f"商品: {len(products)} 条")
    click.echo(f"缺货: {len(stockout)} 条")
    click.echo(f"佣金配置: 比例 {config.get('commission_rate', 0)*100}%, 退款{'仍计' if config.get('commission_refunded', True) else '不计'}佣金")
    click.echo()
    
    if issues:
        click.echo(f"✗ 错误 ({len(issues)}):")
        for issue in issues:
            click.echo(f"  - {issue}")
    else:
        click.echo("✓ 无致命错误")
    
    if warnings:
        click.echo(f"\n⚠ 警告 ({len(warnings)}):")
        for warning in warnings:
            click.echo(f"  - {warning}")
    else:
        click.echo("✓ 无警告")
    
    return len(issues) == 0


def process_refunds_and_replacements():
    orders = read_csv_file('orders')
    products = read_csv_file('products')
    stockout = read_csv_file('stockout')
    config = read_json_file('config')
    
    if orders.empty or stockout.empty:
        return None, None, None
    
    orders = orders.copy()
    for col in ['quantity', 'paid_amount', 'unit_price', 'total_amount']:
        if col in orders.columns:
            orders[col] = pd.to_numeric(orders[col], errors='coerce')
    
    stockout = stockout.copy()
    stockout['stockout_qty'] = pd.to_numeric(stockout['stockout_qty'], errors='coerce')
    
    refunds = []
    replacements = []
    commissions = []
    
    commission_rate = float(config.get('commission_rate', 0.1))
    commission_refunded = config.get('commission_refunded', True)
    
    stockout_by_product = {}
    for _, stock_row in stockout.iterrows():
        product_id = str(stock_row['product_id'])
        stockout_qty = stock_row['stockout_qty']
        if pd.isna(stockout_qty) or stockout_qty <= 0:
            continue
        stockout_by_product[product_id] = {
            'remaining': stockout_qty,
            'row': stock_row
        }
    
    for _, item in orders.iterrows():
        item_qty = item['quantity']
        if pd.isna(item_qty) or item_qty <= 0:
            continue
        
        unit_price = item.get('unit_price', 0)
        if pd.isna(unit_price) or unit_price <= 0:
            unit_price = item['total_amount'] / item['quantity'] if item['quantity'] > 0 else 0
        
        product_id = str(item['product_id'])
        
        normal_qty = item_qty
        affected_qty = 0
        
        if product_id in stockout_by_product:
            stock_info = stockout_by_product[product_id]
            remaining_stockout = stock_info['remaining']
            
            if remaining_stockout > 0:
                affected_qty = min(remaining_stockout, item_qty)
                normal_qty = item_qty - affected_qty
                stock_info['remaining'] = remaining_stockout - affected_qty
                
                stock_row = stock_info['row']
                refund_amount = round(affected_qty * unit_price, 2)
                
                has_replacement = (
                    'replacement_product_id' in stock_row and 
                    pd.notna(stock_row['replacement_product_id']) and 
                    str(stock_row['replacement_product_id']).strip()
                )
                replacement_approved = str(stock_row.get('replacement_approved', 'false')).lower() == 'true'
                
                reason = f"商品 {product_id} 缺货 {affected_qty} 件"
                
                if has_replacement and replacement_approved:
                    replacement_id = str(stock_row['replacement_product_id'])
                    replacement_name = str(stock_row.get('replacement_name', replacement_id))
                    
                    replacements.append({
                        'order_id': item['order_id'],
                        'order_item_id': item['order_item_id'],
                        'building': item['building'],
                        'room': item['room'],
                        'original_product_id': product_id,
                        'original_name': item['product_name'],
                        'replacement_product_id': replacement_id,
                        'replacement_name': replacement_name,
                        'quantity': affected_qty,
                        'reason': reason,
                        'processed_at': datetime.now().isoformat()
                    })
                    
                    reason += f" → 替换为 {replacement_name}"
                    
                    if commission_refunded:
                        commission = round(refund_amount * commission_rate, 2)
                        commissions.append({
                            'order_id': item['order_id'],
                            'order_item_id': item['order_item_id'],
                            'product_id': product_id,
                            'product_name': item['product_name'],
                            'quantity': affected_qty,
                            'amount': refund_amount,
                            'commission_rate': commission_rate,
                            'commission': commission,
                            'source': 'replacement',
                            'reason': f"替换商品佣金（{reason}）",
                            'calculated_at': datetime.now().isoformat()
                        })
                
                elif has_replacement and not replacement_approved:
                    reason += "，客户拒绝替换，已退款"
                    refunds.append({
                        'order_id': item['order_id'],
                        'order_item_id': item['order_item_id'],
                        'building': item['building'],
                        'room': item['room'],
                        'product_id': product_id,
                        'product_name': item['product_name'],
                        'quantity': affected_qty,
                        'unit_price': unit_price,
                        'refund_amount': refund_amount,
                        'reason': reason,
                        'processed_at': datetime.now().isoformat()
                    })
                    
                    if commission_refunded:
                        commission = round(refund_amount * commission_rate, 2)
                        commissions.append({
                            'order_id': item['order_id'],
                            'order_item_id': item['order_item_id'],
                            'product_id': product_id,
                            'product_name': item['product_name'],
                            'quantity': affected_qty,
                            'amount': refund_amount,
                            'commission_rate': commission_rate,
                            'commission': commission,
                            'source': 'refund',
                            'reason': f"退款仍计佣金（{reason}）",
                            'calculated_at': datetime.now().isoformat()
                        })
                
                else:
                    reason += "，无替换商品，已退款"
                    refunds.append({
                        'order_id': item['order_id'],
                        'order_item_id': item['order_item_id'],
                        'building': item['building'],
                        'room': item['room'],
                        'product_id': product_id,
                        'product_name': item['product_name'],
                        'quantity': affected_qty,
                        'unit_price': unit_price,
                        'refund_amount': refund_amount,
                        'reason': reason,
                        'processed_at': datetime.now().isoformat()
                    })
                    
                    if commission_refunded:
                        commission = round(refund_amount * commission_rate, 2)
                        commissions.append({
                            'order_id': item['order_id'],
                            'order_item_id': item['order_item_id'],
                            'product_id': product_id,
                            'product_name': item['product_name'],
                            'quantity': affected_qty,
                            'amount': refund_amount,
                            'commission_rate': commission_rate,
                            'commission': commission,
                            'source': 'refund',
                            'reason': f"退款仍计佣金（{reason}）",
                            'calculated_at': datetime.now().isoformat()
                        })
        
        if normal_qty > 0:
            normal_amount = round(normal_qty * unit_price, 2)
            commission = round(normal_amount * commission_rate, 2)
            reason = '正常销售佣金'
            if affected_qty > 0:
                reason = f"正常销售佣金（总订{item_qty}件，缺货{affected_qty}件，正常发货{normal_qty}件）"
            commissions.append({
                'order_id': item['order_id'],
                'order_item_id': item['order_item_id'],
                'product_id': product_id,
                'product_name': item['product_name'],
                'quantity': normal_qty,
                'amount': normal_amount,
                'commission_rate': commission_rate,
                'commission': commission,
                'source': 'normal',
                'reason': reason,
                'calculated_at': datetime.now().isoformat()
            })
    
    return pd.DataFrame(refunds), pd.DataFrame(replacements), pd.DataFrame(commissions)


@cli.command()
@click.option('--dry-run', is_flag=True, help='预览结果，不保存')
def confirm(dry_run):
    """确认退款、替换和佣金计算"""
    ensure_data_dir()
    
    history = read_json_file('history')
    if 'last_confirmed' in history:
        click.echo(f"⚠ 已在 {history['last_confirmed']} 执行过确认")
        if not click.confirm('确定要再次执行？可能产生重复记录'):
            return
    
    refunds_df, replacements_df, commissions_df = process_refunds_and_replacements()
    
    if refunds_df is None:
        click.echo("✗ 数据不足，无法处理")
        return
    
    click.echo("=== 处理结果预览 ===")
    click.echo(f"退款记录: {len(refunds_df)} 条")
    if len(refunds_df) > 0:
        total_refund = refunds_df['refund_amount'].sum()
        click.echo(f"退款金额: ¥{total_refund:.2f}")
    
    click.echo(f"替换记录: {len(replacements_df)} 条")
    click.echo(f"佣金记录: {len(commissions_df)} 条")
    if len(commissions_df) > 0:
        total_commission = commissions_df['commission'].sum()
        click.echo(f"佣金总额: ¥{total_commission:.2f}")
    
    if len(refunds_df) > 0:
        click.echo("\n退款明细（前10条）:")
        display_cols = ['order_id', 'building', 'room', 'product_name', 'quantity', 'refund_amount', 'reason']
        click.echo(tabulate(refunds_df[display_cols].head(10), headers='keys', tablefmt='simple', showindex=False))
    
    if len(replacements_df) > 0:
        click.echo("\n替换明细（前10条）:")
        display_cols = ['order_id', 'building', 'room', 'original_name', 'replacement_name', 'quantity']
        click.echo(tabulate(replacements_df[display_cols].head(10), headers='keys', tablefmt='simple', showindex=False))
    
    if dry_run:
        click.echo("\n(预览模式，未保存)")
        return
    
    existing_refunds = read_csv_file('refunds')
    if not existing_refunds.empty:
        combined_refunds = pd.concat([existing_refunds, refunds_df]).drop_duplicates(
            subset=['order_item_id', 'product_id'], keep='first'
        )
    else:
        combined_refunds = refunds_df
    write_csv_file('refunds', combined_refunds)
    
    existing_replacements = read_csv_file('replacements')
    if not existing_replacements.empty:
        combined_replacements = pd.concat([existing_replacements, replacements_df]).drop_duplicates(
            subset=['order_item_id', 'original_product_id'], keep='first'
        )
    else:
        combined_replacements = replacements_df
    write_csv_file('replacements', combined_replacements)
    
    existing_commissions = read_csv_file('commissions')
    if not existing_commissions.empty:
        combined_commissions = pd.concat([existing_commissions, commissions_df]).drop_duplicates(
            subset=['order_item_id', 'product_id', 'source'], keep='first'
        )
    else:
        combined_commissions = commissions_df
    write_csv_file('commissions', combined_commissions)
    
    history['last_confirmed'] = datetime.now().isoformat()
    write_json_file('history', history)
    
    record_to_history('confirm', {
        'refunds': len(refunds_df),
        'replacements': len(replacements_df),
        'commissions': len(commissions_df)
    })
    
    click.echo("\n✓ 已保存处理结果")


@cli.command()
@click.option('--limit', type=int, default=20, help='显示最近N条记录')
def history(limit):
    """查看操作历史"""
    ensure_data_dir()
    
    hist = read_json_file('history')
    events = hist.get('events', [])
    
    if not events:
        click.echo("暂无历史记录")
        return
    
    click.echo(f"=== 最近 {min(limit, len(events))} 条操作历史 ===")
    for event in reversed(events[-limit:]):
        ts = event['timestamp'][:19].replace('T', ' ')
        click.echo(f"[{ts}] {event['action']}: {json.dumps(event['details'], ensure_ascii=False)}")


@cli.command('list')
@click.argument('data_type', type=click.Choice(['refunds', 'replacements', 'commissions', 'orders', 'stockout']))
@click.option('--limit', type=int, default=50, help='显示记录数')
def list_data(data_type, limit):
    """查看处理结果：refunds / replacements / commissions / orders / stockout"""
    ensure_data_dir()
    
    df = read_csv_file(data_type)
    if df.empty:
        click.echo(f"暂无 {data_type} 数据")
        return
    
    click.echo(f"=== {data_type} ({len(df)} 条，显示前{limit}条) ===")
    display_df = df.head(limit)
    
    if data_type == 'commissions' and 'commission' in df.columns:
        total = pd.to_numeric(df['commission'], errors='coerce').sum()
        click.echo(f"总佣金: ¥{total:.2f}")
    elif data_type == 'refunds' and 'refund_amount' in df.columns:
        total = pd.to_numeric(df['refund_amount'], errors='coerce').sum()
        click.echo(f"总退款: ¥{total:.2f}")
    
    click.echo(tabulate(display_df, headers='keys', tablefmt='simple', showindex=False))


@cli.command()
@click.argument('target', type=click.Choice(['leader', 'supplier', 'finance']))
@click.option('--output', '-o', help='输出文件路径')
def export(target, output):
    """导出对账表：leader(团长) / supplier(供应商) / finance(财务)"""
    ensure_data_dir()
    
    orders = read_csv_file('orders')
    refunds = read_csv_file('refunds')
    replacements = read_csv_file('replacements')
    commissions = read_csv_file('commissions')
    products = read_csv_file('products')
    
    if orders.empty:
        click.echo("✗ 没有订单数据")
        return
    
    for col in ['quantity', 'paid_amount', 'total_amount', 'unit_price']:
        if col in orders.columns:
            orders[col] = pd.to_numeric(orders[col], errors='coerce')
    
    if target == 'leader':
        result = commissions
        if not result.empty:
            for col in ['commission', 'amount']:
                if col in result.columns:
                    result[col] = pd.to_numeric(result[col], errors='coerce')
        
        summary = []
        if not commissions.empty:
            by_source = commissions.groupby('source').agg({
                'commission': 'sum',
                'quantity': lambda x: pd.to_numeric(x, errors='coerce').sum()
            }).reset_index()
            for _, row in by_source.iterrows():
                summary.append({
                    '类型': '正常销售' if row['source'] == 'normal' else 
                           '退款仍计' if row['source'] == 'refund' else '替换佣金',
                    '件数': int(row['quantity']),
                    '佣金': round(row['commission'], 2)
                })
            total = commissions['commission'].sum() if 'commission' in commissions.columns else 0
            summary.append({'类型': '合计', '件数': int(pd.to_numeric(commissions['quantity'], errors='coerce').sum()), '佣金': round(total, 2)})
        
        summary_df = pd.DataFrame(summary)
        
        if not output:
            output = f"团长佣金表_{datetime.now().strftime('%Y%m%d')}.csv"
        with open(output, 'w', encoding='utf-8-sig') as f:
            f.write("=== 团长佣金汇总 ===\n")
        summary_df.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        with open(output, 'a', encoding='utf-8-sig') as f:
            f.write("\n=== 佣金明细 ===\n")
        if not result.empty:
            result.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        
        click.echo(f"✓ 团长佣金表已导出: {output}")
        click.echo(tabulate(summary_df, headers='keys', tablefmt='simple', showindex=False))
    
    elif target == 'supplier':
        supplier_map = {}
        product_price_map = {}
        if not products.empty:
            for _, p in products.iterrows():
                pid = str(p['product_id'])
                if 'supplier' in products.columns:
                    supplier_map[pid] = p.get('supplier', '未知供应商')
                cost_price = pd.to_numeric(p.get('cost_price', 0), errors='coerce')
                if not pd.isna(cost_price):
                    product_price_map[pid] = cost_price
        
        def get_supplier(pid):
            return supplier_map.get(str(pid), '未知供应商')
        
        order_by_product = {}
        for _, item in orders.iterrows():
            pid = str(item['product_id'])
            qty = pd.to_numeric(item.get('quantity', 0), errors='coerce')
            unit_price = pd.to_numeric(item.get('unit_price', 0), errors='coerce')
            if pd.isna(qty) or qty <= 0:
                continue
            if pd.isna(unit_price) or unit_price <= 0:
                total = pd.to_numeric(item.get('total_amount', 0), errors='coerce')
                unit_price = total / qty if not pd.isna(total) and qty > 0 else 0
            if pid not in order_by_product:
                order_by_product[pid] = {'qty': 0, 'amount': 0, 'unit_price': unit_price}
            order_by_product[pid]['qty'] += qty
            order_by_product[pid]['amount'] += round(qty * unit_price, 2)
        
        def get_unit_price(pid):
            if pid in order_by_product:
                return order_by_product[pid]['unit_price']
            if pid in product_price_map:
                return product_price_map[pid]
            return 0
        
        refund_by_product = {}
        refunds_with_supplier = []
        if not refunds.empty:
            refunds = refunds.copy()
            refunds['refund_amount'] = pd.to_numeric(refunds['refund_amount'], errors='coerce')
            refunds['quantity'] = pd.to_numeric(refunds['quantity'], errors='coerce')
            
            for _, r in refunds.iterrows():
                pid = str(r['product_id'])
                qty = r.get('quantity', 0)
                amt = r.get('refund_amount', 0)
                if pd.isna(qty):
                    qty = 0
                if pd.isna(amt):
                    amt = 0
                if pid not in refund_by_product:
                    refund_by_product[pid] = {'qty': 0, 'amount': 0}
                refund_by_product[pid]['qty'] += qty
                refund_by_product[pid]['amount'] += round(float(amt), 2)
                
                refund_row = dict(r)
                refund_row['供应商'] = get_supplier(pid)
                refunds_with_supplier.append(refund_row)
        
        replace_original_by_product = {}
        replace_new_by_product = {}
        replacements_with_supplier = []
        if not replacements.empty:
            for _, r in replacements.iterrows():
                original_pid = str(r['original_product_id'])
                new_pid = str(r['replacement_product_id'])
                qty = pd.to_numeric(r.get('quantity', 0), errors='coerce')
                if pd.isna(qty) or qty <= 0:
                    continue
                
                unit_price = get_unit_price(original_pid)
                amount = round(qty * unit_price, 2)
                
                if original_pid not in replace_original_by_product:
                    replace_original_by_product[original_pid] = {'qty': 0, 'amount': 0}
                replace_original_by_product[original_pid]['qty'] += qty
                replace_original_by_product[original_pid]['amount'] += amount
                
                if new_pid not in replace_new_by_product:
                    replace_new_by_product[new_pid] = {'qty': 0, 'amount': 0}
                replace_new_by_product[new_pid]['qty'] += qty
                replace_new_by_product[new_pid]['amount'] += amount
                
                replace_row = dict(r)
                replace_row['原商品供应商'] = get_supplier(original_pid)
                replace_row['替换商品供应商'] = get_supplier(new_pid)
                replace_row['结算单价'] = unit_price
                replace_row['结算金额'] = amount
                replacements_with_supplier.append(replace_row)
        
        supplier_summary = {}
        all_product_ids = set(list(order_by_product.keys()) + 
                              list(refund_by_product.keys()) + 
                              list(replace_original_by_product.keys()) + 
                              list(replace_new_by_product.keys()))
        
        for pid in all_product_ids:
            supplier = get_supplier(pid)
            if supplier not in supplier_summary:
                supplier_summary[supplier] = {
                    '供应商': supplier,
                    '订单件数': 0,
                    '订单金额': 0,
                    '缺货退款件数': 0,
                    '缺货退款金额': 0,
                    '替换出库件数': 0,
                    '替换出库金额': 0,
                    '替换入库件数': 0,
                    '替换入库金额': 0,
                    '实际发货件数': 0,
                    '实际发货金额': 0,
                    '净结算金额': 0
                }
            
            order = order_by_product.get(pid, {'qty': 0, 'amount': 0})
            refund = refund_by_product.get(pid, {'qty': 0, 'amount': 0})
            replace_out = replace_original_by_product.get(pid, {'qty': 0, 'amount': 0})
            replace_in = replace_new_by_product.get(pid, {'qty': 0, 'amount': 0})
            
            supplier_summary[supplier]['订单件数'] += order['qty']
            supplier_summary[supplier]['订单金额'] += order['amount']
            supplier_summary[supplier]['缺货退款件数'] += refund['qty']
            supplier_summary[supplier]['缺货退款金额'] += refund['amount']
            supplier_summary[supplier]['替换出库件数'] += replace_out['qty']
            supplier_summary[supplier]['替换出库金额'] += replace_out['amount']
            supplier_summary[supplier]['替换入库件数'] += replace_in['qty']
            supplier_summary[supplier]['替换入库金额'] += replace_in['amount']
        
        for s in supplier_summary.values():
            s['实际发货件数'] = s['订单件数'] - s['缺货退款件数'] - s['替换出库件数'] + s['替换入库件数']
            s['实际发货金额'] = round(
                s['订单金额'] - s['缺货退款金额'] - s['替换出库金额'] + s['替换入库金额'], 2
            )
            s['净结算金额'] = s['实际发货金额']
        
        summary_list = list(supplier_summary.values())
        summary_list.sort(key=lambda x: x['供应商'])
        
        total_row = {
            '供应商': '合计',
            '订单件数': sum(s['订单件数'] for s in summary_list),
            '订单金额': round(sum(s['订单金额'] for s in summary_list), 2),
            '缺货退款件数': sum(s['缺货退款件数'] for s in summary_list),
            '缺货退款金额': round(sum(s['缺货退款金额'] for s in summary_list), 2),
            '替换出库件数': sum(s['替换出库件数'] for s in summary_list),
            '替换出库金额': round(sum(s['替换出库金额'] for s in summary_list), 2),
            '替换入库件数': sum(s['替换入库件数'] for s in summary_list),
            '替换入库金额': round(sum(s['替换入库金额'] for s in summary_list), 2),
            '实际发货件数': sum(s['实际发货件数'] for s in summary_list),
            '实际发货金额': round(sum(s['实际发货金额'] for s in summary_list), 2),
            '净结算金额': round(sum(s['净结算金额'] for s in summary_list), 2)
        }
        summary_list.append(total_row)
        
        summary_df = pd.DataFrame(summary_list)
        
        refund_detail_df = pd.DataFrame(refunds_with_supplier)
        if not refund_detail_df.empty:
            cols = ['order_id', 'building', 'room', 'product_id', 'product_name', 
                    '供应商', 'quantity', 'refund_amount', 'reason', 'processed_at']
            existing_cols = [c for c in cols if c in refund_detail_df.columns]
            refund_detail_df = refund_detail_df[existing_cols]
        
        replace_detail_df = pd.DataFrame(replacements_with_supplier)
        if not replace_detail_df.empty:
            cols = ['order_id', 'building', 'room', 'original_product_id', 'original_name',
                    '原商品供应商', 'replacement_product_id', 'replacement_name',
                    '替换商品供应商', 'quantity', '结算单价', '结算金额', 'reason', 'processed_at']
            existing_cols = [c for c in cols if c in replace_detail_df.columns]
            replace_detail_df = replace_detail_df[existing_cols]
        
        if not output:
            output = f"供应商对账表_{datetime.now().strftime('%Y%m%d')}.csv"
        
        with open(output, 'w', encoding='utf-8-sig') as f:
            f.write("=== 供应商对账汇总（按供应商分组）===\n")
        summary_df.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        
        if not refund_detail_df.empty:
            with open(output, 'a', encoding='utf-8-sig') as f:
                f.write("\n=== 退款明细（含供应商）===\n")
            refund_detail_df.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        
        if not replace_detail_df.empty:
            with open(output, 'a', encoding='utf-8-sig') as f:
                f.write("\n=== 替换明细（含供应商）===\n")
            replace_detail_df.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        
        click.echo(f"✓ 供应商对账表已导出: {output}")
        display_cols = ['供应商', '订单件数', '订单金额', '缺货退款件数', '缺货退款金额',
                        '替换出库件数', '替换出库金额', '替换入库件数', '替换入库金额',
                        '实际发货件数', '实际发货金额', '净结算金额']
        click.echo(tabulate(summary_df[display_cols], headers='keys', tablefmt='simple', showindex=False))
    
    elif target == 'finance':
        paid_total = orders['paid_amount'].sum() if 'paid_amount' in orders.columns else 0
        refund_total = pd.to_numeric(refunds['refund_amount'], errors='coerce').sum() if not refunds.empty else 0
        commission_total = pd.to_numeric(commissions['commission'], errors='coerce').sum() if not commissions.empty else 0
        actual_income = paid_total - refund_total - commission_total
        
        finance_summary = pd.DataFrame([
            {'项目': '订单实付总额', '金额': round(paid_total, 2), '说明': '所有订单用户支付金额'},
            {'项目': '退款总额', '金额': round(refund_total, 2), '说明': '缺货/替换拒绝产生的退款'},
            {'项目': '团长佣金总额', '金额': round(commission_total, 2), '说明': '含退款部分仍计佣金'},
            {'项目': '实际到账收入', '金额': round(actual_income, 2), '说明': '实付-退款-佣金'}
        ])
        
        adjust_detail = []
        if not refunds.empty:
            for _, r in refunds.iterrows():
                adjust_detail.append({
                    '类型': '退款',
                    '楼栋': r.get('building', ''),
                    '房间': r.get('room', ''),
                    '商品': r.get('product_name', ''),
                    '数量': r.get('quantity', 0),
                    '金额': r.get('refund_amount', 0),
                    '调整原因': r.get('reason', '')
                })
        if not replacements.empty:
            for _, r in replacements.iterrows():
                adjust_detail.append({
                    '类型': '替换',
                    '楼栋': r.get('building', ''),
                    '房间': r.get('room', ''),
                    '商品': f"{r.get('original_name', '')}→{r.get('replacement_name', '')}",
                    '数量': r.get('quantity', 0),
                    '金额': 0,
                    '调整原因': r.get('reason', '')
                })
        
        adjust_df = pd.DataFrame(adjust_detail)
        
        if not output:
            output = f"财务对账表_{datetime.now().strftime('%Y%m%d')}.csv"
        with open(output, 'w', encoding='utf-8-sig') as f:
            f.write("=== 财务汇总 ===\n")
        finance_summary.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        with open(output, 'a', encoding='utf-8-sig') as f:
            f.write("\n=== 每笔调整明细 ===\n")
        if not adjust_df.empty:
            adjust_df.to_csv(output, mode='a', index=False, encoding='utf-8-sig')
        
        click.echo(f"✓ 财务对账表已导出: {output}")
        click.echo(tabulate(finance_summary, headers='keys', tablefmt='simple', showindex=False))


if __name__ == '__main__':
    cli()
