import csv
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from .database import get_connection


def _calculate_file_hash(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def _check_duplicate_import(file_path: str, import_type: str) -> Tuple[bool, Optional[str]]:
    file_hash = _calculate_file_hash(file_path)
    file_name = file_path.split('/')[-1]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT file_name, import_time FROM import_sources WHERE file_hash = ?',
            (file_hash,)
        )
        row = cursor.fetchone()
        if row:
            return True, f"文件 {file_name} 已于 {row['import_time']} 导入过"
    
    return False, None


def _record_import(file_path: str, import_type: str, record_count: int) -> None:
    file_hash = _calculate_file_hash(file_path)
    file_name = file_path.split('/')[-1]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO import_sources 
            (file_name, file_hash, import_type, import_time, record_count)
            VALUES (?, ?, ?, ?, ?)
        ''', (file_name, file_hash, import_type, datetime.now().isoformat(), record_count))
        conn.commit()


def import_owners(file_path: str) -> Dict[str, Any]:
    is_dup, msg = _check_duplicate_import(file_path, 'owners')
    if is_dup:
        return {'success': False, 'message': msg, 'imported': 0, 'updated': 0}
    
    imported = 0
    updated = 0
    now = datetime.now().isoformat()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row['code'].strip()
                name = row['name'].strip()
                phone = row.get('phone', '').strip() or None
                email = row.get('email', '').strip() or None
                split_rate = float(row.get('split_rate', '0.7'))
                
                cursor.execute('SELECT id FROM owners WHERE code = ?', (code,))
                existing = cursor.fetchone()
                
                if existing:
                    cursor.execute('''
                        UPDATE owners SET name = ?, phone = ?, email = ?, split_rate = ?, updated_at = ?
                        WHERE code = ?
                    ''', (name, phone, email, split_rate, now, code))
                    updated += 1
                else:
                    cursor.execute('''
                        INSERT INTO owners (code, name, phone, email, split_rate, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (code, name, phone, email, split_rate, now, now))
                    imported += 1
        
        conn.commit()
    
    _record_import(file_path, 'owners', imported + updated)
    return {
        'success': True, 
        'message': f'成功导入 {imported} 个新书主，更新 {updated} 个',
        'imported': imported, 
        'updated': updated
    }


def import_books(file_path: str) -> Dict[str, Any]:
    is_dup, msg = _check_duplicate_import(file_path, 'books')
    if is_dup:
        return {'success': False, 'message': msg, 'imported': 0, 'updated': 0, 'skipped': 0}
    
    imported = 0
    updated = 0
    skipped = 0
    errors = []
    now = datetime.now().isoformat()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                owner_code = row['owner_code'].strip()
                title = row['title'].strip()
                isbn = row.get('isbn', '').strip() or None
                author = row.get('author', '').strip() or None
                original_price = float(row.get('original_price', '0') or '0')
                min_price = float(row.get('min_price', '0') or '0')
                consignment_date = row.get('consignment_date', '').strip() or None
                
                cursor.execute('SELECT id FROM owners WHERE code = ?', (owner_code,))
                owner = cursor.fetchone()
                if not owner:
                    errors.append(f"第{line_num}行: 书主编号 {owner_code} 不存在")
                    skipped += 1
                    continue
                
                owner_id = owner['id']
                
                query_fields = [owner_id]
                query_conditions = ['owner_id = ?']
                
                if isbn:
                    query_conditions.append('isbn = ?')
                    query_fields.append(isbn)
                else:
                    query_conditions.append('(isbn IS NULL OR isbn = "")')
                
                query_conditions.append('title = ?')
                query_fields.append(title)
                
                if consignment_date:
                    query_conditions.append('consignment_date = ?')
                    query_fields.append(consignment_date)
                else:
                    query_conditions.append('(consignment_date IS NULL OR consignment_date = "")')
                
                cursor.execute(
                    f'SELECT id FROM books WHERE {" AND ".join(query_conditions)}',
                    query_fields
                )
                existing = cursor.fetchone()
                
                if existing:
                    cursor.execute('''
                        UPDATE books SET original_price = ?, min_price = ?, updated_at = ?
                        WHERE id = ?
                    ''', (original_price, min_price, now, existing['id']))
                    updated += 1
                else:
                    cursor.execute('''
                        INSERT INTO books 
                        (isbn, title, author, owner_id, original_price, min_price, consignment_date, 
                         status, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'in_store', ?, ?)
                    ''', (isbn, title, author, owner_id, original_price, min_price, consignment_date, now, now))
                    imported += 1
        
        conn.commit()
    
    _record_import(file_path, 'books', imported + updated)
    
    if errors:
        return {
            'success': True,
            'message': f'导入完成: {imported} 新增, {updated} 更新, {skipped} 跳过',
            'imported': imported, 'updated': updated, 'skipped': skipped,
            'warnings': errors
        }
    
    return {
        'success': True, 
        'message': f'成功导入 {imported} 本新书，更新 {updated} 本',
        'imported': imported, 'updated': updated, 'skipped': skipped
    }


def _check_duplicate_sale_record(cursor, book_id: int, sale_date: str, final_price: float) -> bool:
    cursor.execute('''
        SELECT COUNT(*) as cnt FROM sales 
        WHERE book_id = ? AND sale_date = ? AND ABS(final_sale_price - ?) < 0.01
    ''', (book_id, sale_date, final_price))
    return cursor.fetchone()['cnt'] > 0


def import_sales(file_path: str) -> Dict[str, Any]:
    is_dup, msg = _check_duplicate_import(file_path, 'sales')
    if is_dup:
        return {'success': False, 'message': msg, 'imported': 0, 'skipped': 0, 'errors': []}
    
    imported = 0
    skipped = 0
    errors = []
    now = datetime.now().isoformat()
    file_name = file_path.split('/')[-1]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                owner_code = row['owner_code'].strip()
                book_identifier = row.get('book_identifier', row.get('isbn', '')).strip()
                title = row.get('title', '').strip()
                sale_date = row['sale_date'].strip()
                original_price = float(row.get('original_price', row.get('price', '0')) or '0')
                discount = float(row.get('discount', '1.0') or '1.0')
                final_price = float(row.get('final_price', str(original_price * discount)) or str(original_price * discount))
                
                if discount <= 0 or discount > 1:
                    errors.append(f"第{line_num}行: 折扣 {discount} 不在有效范围(0, 1]")
                    continue
                
                cursor.execute('SELECT id FROM owners WHERE code = ?', (owner_code,))
                owner = cursor.fetchone()
                if not owner:
                    errors.append(f"第{line_num}行: 书主编号 {owner_code} 不存在")
                    continue
                owner_id = owner['id']
                
                book_id = None
                if book_identifier:
                    cursor.execute('''
                        SELECT id FROM books WHERE owner_id = ? AND (isbn = ? OR id = ? OR title = ?)
                        LIMIT 1
                    ''', (owner_id, book_identifier, book_identifier, book_identifier))
                    book = cursor.fetchone()
                    if book:
                        book_id = book['id']
                
                if not book_id and title:
                    cursor.execute('''
                        SELECT id FROM books WHERE owner_id = ? AND title = ? LIMIT 1
                    ''', (owner_id, title))
                    book = cursor.fetchone()
                    if book:
                        book_id = book['id']
                
                if not book_id:
                    errors.append(f"第{line_num}行: 找不到匹配的书籍 (标识: {book_identifier}, 书名: {title})")
                    continue
                
                if _check_duplicate_sale_record(cursor, book_id, sale_date, final_price):
                    skipped += 1
                    errors.append(f"第{line_num}行: 同一本书已在 {sale_date} 以 ¥{final_price} 售出，已跳过（疑似重复导入）")
                    continue
                
                cursor.execute('''
                    INSERT INTO sales 
                    (book_id, sale_date, original_sale_price, discount, final_sale_price, 
                     source_file, source_line, is_trial, batch_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
                ''', (book_id, sale_date, original_price, discount, final_price, file_name, line_num, now))
                imported += 1
        
        conn.commit()
    
    _record_import(file_path, 'sales', imported)
    
    message = f'导入 {imported} 条销售记录'
    if skipped > 0:
        message += f'，跳过 {skipped} 条疑似重复的记录'
    
    return {
        'success': True,
        'message': message,
        'imported': imported,
        'skipped': skipped,
        'errors': errors
    }


def import_returns(file_path: str) -> Dict[str, Any]:
    is_dup, msg = _check_duplicate_import(file_path, 'returns')
    if is_dup:
        return {'success': False, 'message': msg, 'imported': 0, 'errors': []}
    
    imported = 0
    errors = []
    now = datetime.now().isoformat()
    file_name = file_path.split('/')[-1]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                owner_code = row['owner_code'].strip()
                book_identifier = row.get('book_identifier', row.get('isbn', '')).strip()
                title = row.get('title', '').strip()
                return_date = row['return_date'].strip()
                reason = row.get('reason', '').strip() or None
                
                cursor.execute('SELECT id FROM owners WHERE code = ?', (owner_code,))
                owner = cursor.fetchone()
                if not owner:
                    errors.append(f"第{line_num}行: 书主编号 {owner_code} 不存在")
                    continue
                owner_id = owner['id']
                
                book_id = None
                if book_identifier:
                    cursor.execute('''
                        SELECT id FROM books WHERE owner_id = ? AND (isbn = ? OR id = ? OR title = ?)
                        LIMIT 1
                    ''', (owner_id, book_identifier, book_identifier, book_identifier))
                    book = cursor.fetchone()
                    if book:
                        book_id = book['id']
                
                if not book_id and title:
                    cursor.execute('''
                        SELECT id FROM books WHERE owner_id = ? AND title = ? LIMIT 1
                    ''', (owner_id, title))
                    book = cursor.fetchone()
                    if book:
                        book_id = book['id']
                
                if not book_id:
                    errors.append(f"第{line_num}行: 找不到匹配的书籍")
                    continue
                
                cursor.execute('''
                    INSERT INTO returns 
                    (book_id, return_date, reason, source_file, source_line, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (book_id, return_date, reason, file_name, line_num, now))
                imported += 1
        
        conn.commit()
    
    _record_import(file_path, 'returns', imported)
    
    return {
        'success': len(errors) == 0,
        'message': f'导入 {imported} 条退回记录' + (f'，有 {len(errors)} 条错误' if errors else ''),
        'imported': imported,
        'errors': errors
    }


def import_payments(file_path: str) -> Dict[str, Any]:
    is_dup, msg = _check_duplicate_import(file_path, 'payments')
    if is_dup:
        return {'success': False, 'message': msg, 'imported': 0, 'errors': []}
    
    imported = 0
    errors = []
    now = datetime.now().isoformat()
    file_name = file_path.split('/')[-1]
    
    with get_connection() as conn:
        cursor = conn.cursor()
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                owner_code = row['owner_code'].strip()
                amount = float(row['amount'])
                payment_date = row['payment_date'].strip()
                method = row.get('method', '').strip() or None
                remark = row.get('remark', '').strip() or None
                
                if amount <= 0:
                    errors.append(f"第{line_num}行: 付款金额必须大于0")
                    continue
                
                cursor.execute('SELECT id FROM owners WHERE code = ?', (owner_code,))
                owner = cursor.fetchone()
                if not owner:
                    errors.append(f"第{line_num}行: 书主编号 {owner_code} 不存在")
                    continue
                owner_id = owner['id']
                
                cursor.execute('''
                    INSERT INTO payments 
                    (owner_id, amount, payment_date, method, remark, source_file, source_line, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (owner_id, amount, payment_date, method, remark, file_name, line_num, now))
                imported += 1
        
        conn.commit()
    
    _record_import(file_path, 'payments', imported)
    
    return {
        'success': len(errors) == 0,
        'message': f'导入 {imported} 条付款记录' + (f'，有 {len(errors)} 条错误' if errors else ''),
        'imported': imported,
        'errors': errors
    }
