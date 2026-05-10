import csv
from datetime import datetime
from typing import Dict, List, Any, Optional
from .database import get_connection
from .settlement import get_batch_detail, _round_currency


def export_owner_statement(batch_no: str, owner_code: str, output_path: str) -> Dict[str, Any]:
    detail = get_batch_detail(batch_no)
    
    if not detail:
        return {'success': False, 'message': f'找不到批次 {batch_no}'}
    
    owner_totals = [ot for ot in detail['owner_totals'] if ot['owner_code'] == owner_code]
    if not owner_totals:
        return {'success': False, 'message': f'批次中没有书主 {owner_code} 的记录'}
    
    owner_total = owner_totals[0]
    
    owner_sales = [s for s in detail['sales'] if s['owner_code'] == owner_code]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM owners WHERE code = ?
        ''', (owner_code,))
        owner = cursor.fetchone()
        
        cursor.execute('''
            SELECT * FROM payments WHERE owner_id = ?
        ''', (owner['id'],))
        payments = [dict(row) for row in cursor.fetchall()]
    
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        writer.writerow(['二手书寄售结算单'])
        writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow(['结算批次', batch_no])
        writer.writerow(['结算周期', f"{detail['batch']['start_date']} 至 {detail['batch']['end_date']}"])
        writer.writerow([])
        
        writer.writerow(['书主信息'])
        writer.writerow(['书主编号', owner['code']])
        writer.writerow(['姓名', owner['name']])
        writer.writerow(['电话', owner['phone'] or ''])
        writer.writerow(['分成比例', f"{owner['split_rate'] * 100}%"])
        writer.writerow([])
        
        writer.writerow(['销售明细'])
        writer.writerow(['序号', '书名', 'ISBN', '售出日期', '定价', '折扣', '实售价格', '书主分成'])
        
        for idx, sale in enumerate(owner_sales, 1):
            owner_share = _round_currency(sale['final_sale_price'] * sale['split_rate'])
            writer.writerow([
                idx,
                sale['title'],
                sale['isbn'] or '',
                sale['sale_date'],
                sale['original_sale_price'],
                f"{sale['discount'] * 100}%",
                sale['final_sale_price'],
                owner_share
            ])
        writer.writerow([])
        
        writer.writerow(['本期汇总'])
        writer.writerow(['销售册数', owner_total['sale_count']])
        writer.writerow(['销售总额', owner_total['total_amount']])
        writer.writerow(['书主分成总额', owner_total['owner_share']])
        writer.writerow([])
        
        writer.writerow(['历史付款记录'])
        writer.writerow(['付款日期', '金额', '方式', '备注'])
        total_paid = 0.0
        for p in payments:
            writer.writerow([
                p['payment_date'],
                p['amount'],
                p['method'] or '',
                p['remark'] or ''
            ])
            total_paid += p['amount']
        writer.writerow([])
        
        writer.writerow(['结算余额'])
        writer.writerow(['本期应结', owner_total['owner_share']])
        writer.writerow(['已付款', _round_currency(total_paid)])
        writer.writerow(['本次应付', _round_currency(owner_total['owner_share'] - total_paid)])
    
    return {
        'success': True,
        'output_path': output_path,
        'sale_count': owner_total['sale_count'],
        'owner_share': owner_total['owner_share']
    }


def export_batch_summary(batch_no: str, output_path: str) -> Dict[str, Any]:
    detail = get_batch_detail(batch_no)
    
    if not detail:
        return {'success': False, 'message': f'找不到批次 {batch_no}'}
    
    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        
        writer.writerow(['结算批次汇总表'])
        writer.writerow(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow(['批次号', batch_no])
        writer.writerow(['结算周期', f"{detail['batch']['start_date']} 至 {detail['batch']['end_date']}"])
        writer.writerow(['状态', detail['batch']['status']])
        writer.writerow([])
        
        writer.writerow(['书主汇总'])
        writer.writerow(['书主编号', '姓名', '销售册数', '销售总额', '书主分成'])
        
        total_sales = 0
        total_amount = 0.0
        total_owner_share = 0.0
        
        for ot in detail['owner_totals']:
            writer.writerow([
                ot['owner_code'],
                ot['owner_name'],
                ot['sale_count'],
                ot['total_amount'],
                ot['owner_share']
            ])
            total_sales += ot['sale_count']
            total_amount += ot['total_amount']
            total_owner_share += ot['owner_share']
        
        writer.writerow([])
        writer.writerow(['总计', '', total_sales, _round_currency(total_amount), _round_currency(total_owner_share)])
    
    return {
        'success': True,
        'output_path': output_path,
        'total_sales': total_sales,
        'total_amount': _round_currency(total_amount),
        'total_owner_share': _round_currency(total_owner_share)
    }


def export_all_owners_for_batch(batch_no: str, output_dir: str) -> Dict[str, Any]:
    import os
    
    detail = get_batch_detail(batch_no)
    
    if not detail:
        return {'success': False, 'message': f'找不到批次 {batch_no}'}
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    exported = []
    for ot in detail['owner_totals']:
        safe_name = ot['owner_name'].replace('/', '_').replace('\\', '_')
        output_path = os.path.join(output_dir, f"{ot['owner_code']}_{safe_name}_{batch_no}.csv")
        
        result = export_owner_statement(batch_no, ot['owner_code'], output_path)
        if result['success']:
            exported.append({
                'owner_code': ot['owner_code'],
                'owner_name': ot['owner_name'],
                'file_path': output_path
            })
    
    return {
        'success': True,
        'export_count': len(exported),
        'files': exported
    }
