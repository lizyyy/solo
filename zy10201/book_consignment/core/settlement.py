import math
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from .database import get_connection


def _round_currency(value: float) -> float:
    return round(value, 2)


def _check_duplicate_sales(book_id: int, sale_date: str, final_price: float, exclude_id: Optional[int] = None) -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        query = '''
            SELECT s.*, b.title, b.isbn
            FROM sales s
            JOIN books b ON s.book_id = b.id
            WHERE s.book_id = ? AND s.sale_date = ? AND ABS(s.final_sale_price - ?) < 0.01
        '''
        params = [book_id, sale_date, final_price]
        
        if exclude_id:
            query += ' AND s.id != ?'
            params.append(exclude_id)
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def _check_discount_below_min(book_id: int, final_price: float) -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT min_price, original_price, title, isbn FROM books WHERE id = ?
        ''', (book_id,))
        book = cursor.fetchone()
        
        if not book:
            return {'violation': False}
        
        min_price = book['min_price'] or 0
        original_price = book['original_price'] or 0
        
        actual_discount = final_price / original_price if original_price > 0 else 1.0
        
        if min_price > 0 and final_price < min_price:
            return {
                'violation': True,
                'book_title': book['title'],
                'book_isbn': book['isbn'],
                'min_price': min_price,
                'final_price': final_price,
                'diff': _round_currency(min_price - final_price),
                'actual_discount': _round_currency(actual_discount)
            }
        
        return {'violation': False}


def _check_returned_book_sold(book_id: int, sale_date: str) -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.return_date, r.reason, b.title, b.isbn
            FROM returns r
            JOIN books b ON r.book_id = b.id
            WHERE r.book_id = ? AND r.return_date <= ?
            ORDER BY r.return_date DESC
        ''', (book_id, sale_date))
        returns = cursor.fetchall()
        
        if returns:
            return {
                'violation': True,
                'book_title': returns[0]['title'],
                'book_isbn': returns[0]['isbn'],
                'return_date': returns[0]['return_date'],
                'sale_date': sale_date,
                'reason': returns[0]['reason']
            }
        
        return {'violation': False}


def validate_sales(start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        query = '''
            SELECT s.*, b.title, b.isbn, b.min_price, b.original_price, 
                   o.code as owner_code, o.name as owner_name, o.split_rate
            FROM sales s
            JOIN books b ON s.book_id = b.id
            JOIN owners o ON b.owner_id = o.id
            WHERE s.is_trial = 1
        '''
        params = []
        
        if start_date:
            query += ' AND s.sale_date >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND s.sale_date <= ?'
            params.append(end_date)
        
        cursor.execute(query, params)
        sales = [dict(row) for row in cursor.fetchall()]
    
    issues = []
    sale_count = 0
    total_amount = 0.0
    total_owner_share = 0.0
    total_store_share = 0.0
    rounding_diffs = 0.0
    
    owner_breakdown = {}
    
    for sale in sales:
        sale_count += 1
        final_price = sale['final_sale_price']
        total_amount += final_price
        
        dup_check = _check_duplicate_sales(
            sale['book_id'], sale['sale_date'], final_price, sale['id']
        )
        if dup_check:
            issues.append({
                'type': 'duplicate_sale',
                'severity': 'warning',
                'sale_id': sale['id'],
                'book_title': sale['title'],
                'book_isbn': sale['isbn'],
                'sale_date': sale['sale_date'],
                'price': final_price,
                'message': f'同一本书({sale["title"]})在同一天({sale["sale_date"]})以相同价格({final_price})售出，疑似重复'
            })
        
        disc_check = _check_discount_below_min(sale['book_id'], final_price)
        if disc_check['violation']:
            issues.append({
                'type': 'below_min_price',
                'severity': 'error',
                'sale_id': sale['id'],
                'book_title': disc_check['book_title'],
                'book_isbn': disc_check['book_isbn'],
                'min_price': disc_check['min_price'],
                'final_price': disc_check['final_price'],
                'diff': disc_check['diff'],
                'actual_discount': disc_check['actual_discount'],
                'message': f'{disc_check["book_title"]} 售出价格 {disc_check["final_price"]} 低于约定底价 {disc_check["min_price"]}，差价 {disc_check["diff"]}'
            })
        
        return_check = _check_returned_book_sold(sale['book_id'], sale['sale_date'])
        if return_check['violation']:
            issues.append({
                'type': 'returned_book_sold',
                'severity': 'error',
                'sale_id': sale['id'],
                'book_title': return_check['book_title'],
                'book_isbn': return_check['book_isbn'],
                'return_date': return_check['return_date'],
                'sale_date': return_check['sale_date'],
                'reason': return_check['reason'],
                'message': f'{return_check["book_title"]} 已于 {return_check["return_date"]} 退回，但出现在 {return_check["sale_date"]} 的销售清单中'
            })
        
        split_rate = sale['split_rate']
        exact_owner = final_price * split_rate
        rounded_owner = _round_currency(exact_owner)
        exact_store = final_price * (1 - split_rate)
        rounded_store = _round_currency(exact_store)
        
        rounding_diff = (rounded_owner + rounded_store) - final_price
        if abs(rounding_diff) >= 0.01:
            issues.append({
                'type': 'rounding_diff',
                'severity': 'info',
                'sale_id': sale['id'],
                'book_title': sale['title'],
                'final_price': final_price,
                'exact_owner': exact_owner,
                'rounded_owner': rounded_owner,
                'exact_store': exact_store,
                'rounded_store': rounded_store,
                'rounding_diff': rounding_diff,
                'message': f'{sale["title"]} 分成四舍五入后总额有差异 {rounding_diff}'
            })
        
        total_owner_share += rounded_owner
        total_store_share += rounded_store
        rounding_diffs += rounding_diff
        
        owner_key = (sale['owner_code'], sale['owner_name'])
        if owner_key not in owner_breakdown:
            owner_breakdown[owner_key] = {
                'owner_code': sale['owner_code'],
                'owner_name': sale['owner_name'],
                'sale_count': 0,
                'total_amount': 0.0,
                'owner_share': 0.0,
                'split_rate': split_rate
            }
        ob = owner_breakdown[owner_key]
        ob['sale_count'] += 1
        ob['total_amount'] += final_price
        ob['owner_share'] += rounded_owner
    
    for ob in owner_breakdown.values():
        ob['total_amount'] = _round_currency(ob['total_amount'])
        ob['owner_share'] = _round_currency(ob['owner_share'])
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT o.code, o.name, COALESCE(SUM(p.amount), 0) as total_paid
            FROM owners o
            LEFT JOIN payments p ON o.id = p.owner_id
            GROUP BY o.id
        ''')
        payments = {row['code']: dict(row) for row in cursor.fetchall()}
    
    for ob in owner_breakdown.values():
        payment_info = payments.get(ob['owner_code'], {'total_paid': 0})
        ob['total_paid'] = _round_currency(payment_info['total_paid'])
        ob['balance'] = _round_currency(ob['owner_share'] - ob['total_paid'])
    
    total_amount = _round_currency(total_amount)
    total_owner_share = _round_currency(total_owner_share)
    total_store_share = _round_currency(total_store_share)
    rounding_diffs = _round_currency(rounding_diffs)
    
    return {
        'summary': {
            'sale_count': sale_count,
            'total_amount': total_amount,
            'total_owner_share': total_owner_share,
            'total_store_share': total_store_share,
            'rounding_diff_total': rounding_diffs
        },
        'owner_breakdown': list(owner_breakdown.values()),
        'issues': issues,
        'error_count': sum(1 for i in issues if i['severity'] == 'error'),
        'warning_count': sum(1 for i in issues if i['severity'] == 'warning'),
        'info_count': sum(1 for i in issues if i['severity'] == 'info')
    }


def create_settlement_batch(start_date: str, end_date: str, description: str = '') -> Dict:
    now = datetime.now()
    batch_no = f'SETTLE-{now.strftime("%Y%m%d-%H%M%S")}'
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO settlement_batches
            (batch_no, description, start_date, end_date, status, created_at)
            VALUES (?, ?, ?, ?, 'trial', ?)
        ''', (batch_no, description, start_date, end_date, now.isoformat()))
        
        batch_id = cursor.lastrowid
        
        cursor.execute('''
            UPDATE sales SET batch_id = ? 
            WHERE is_trial = 1 AND sale_date >= ? AND sale_date <= ?
        ''', (batch_id, start_date, end_date))
        
        conn.commit()
    
    return {
        'batch_id': batch_id,
        'batch_no': batch_no,
        'start_date': start_date,
        'end_date': end_date
    }


def confirm_settlement(batch_no: str) -> Dict:
    now = datetime.now()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM settlement_batches WHERE batch_no = ?', (batch_no,))
        batch = cursor.fetchone()
        
        if not batch:
            return {'success': False, 'message': f'找不到批次 {batch_no}'}
        
        if batch['status'] == 'confirmed':
            return {'success': False, 'message': f'批次 {batch_no} 已经确认过了'}
        
        cursor.execute('''
            UPDATE settlement_batches 
            SET status = 'confirmed', confirmed_at = ?
            WHERE batch_no = ?
        ''', (now.isoformat(), batch_no))
        
        cursor.execute('''
            UPDATE sales SET is_trial = 0 
            WHERE batch_id = (SELECT id FROM settlement_batches WHERE batch_no = ?)
        ''', (batch_no,))
        
        conn.commit()
    
    return {
        'success': True,
        'message': f'批次 {batch_no} 已确认',
        'confirmed_at': now.isoformat()
    }


def list_batches(status: Optional[str] = None) -> List[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        query = '''
            SELECT b.*, COUNT(s.id) as sale_count
            FROM settlement_batches b
            LEFT JOIN sales s ON b.id = s.batch_id
        '''
        params = []
        
        if status:
            query += ' WHERE b.status = ?'
            params.append(status)
        
        query += ' GROUP BY b.id ORDER BY b.created_at DESC'
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_batch_detail(batch_no: str) -> Optional[Dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM settlement_batches WHERE batch_no = ?', (batch_no,))
        batch = cursor.fetchone()
        
        if not batch:
            return None
        
        batch_id = batch['id']
        
        cursor.execute('''
            SELECT s.*, b.title, b.isbn, o.code as owner_code, o.name as owner_name, o.split_rate
            FROM sales s
            JOIN books b ON s.book_id = b.id
            JOIN owners o ON b.owner_id = o.id
            WHERE s.batch_id = ?
        ''', (batch_id,))
        sales = [dict(row) for row in cursor.fetchall()]
        
        owner_totals = {}
        for sale in sales:
            owner_key = (sale['owner_code'], sale['owner_name'])
            if owner_key not in owner_totals:
                owner_totals[owner_key] = {
                    'owner_code': sale['owner_code'],
                    'owner_name': sale['owner_name'],
                    'sale_count': 0,
                    'total_amount': 0.0,
                    'owner_share': 0.0,
                    'split_rate': sale['split_rate']
                }
            
            ot = owner_totals[owner_key]
            ot['sale_count'] += 1
            ot['total_amount'] += sale['final_sale_price']
            ot['owner_share'] += _round_currency(sale['final_sale_price'] * sale['split_rate'])
        
        for ot in owner_totals.values():
            ot['total_amount'] = _round_currency(ot['total_amount'])
            ot['owner_share'] = _round_currency(ot['owner_share'])
        
        return {
            'batch': dict(batch),
            'sales': sales,
            'owner_totals': list(owner_totals.values()),
            'total_amount': _round_currency(sum(s['final_sale_price'] for s in sales)),
            'sale_count': len(sales)
        }


def get_unsettled_summary() -> Dict:
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT o.code, o.name, COUNT(s.id) as sale_count,
                   COALESCE(SUM(s.final_sale_price), 0) as total_amount,
                   COALESCE(SUM(s.final_sale_price * o.split_rate), 0) as exact_owner_share
            FROM owners o
            JOIN books b ON o.id = b.owner_id
            LEFT JOIN sales s ON b.id = s.book_id AND s.is_trial = 1
            GROUP BY o.id
        ''')
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            rounded_share = _round_currency(row['exact_owner_share'])
            result.append({
                'owner_code': row['code'],
                'owner_name': row['name'],
                'sale_count': row['sale_count'],
                'total_amount': _round_currency(row['total_amount']),
                'owner_share': rounded_share
            })
        
        return {'owners': result}
