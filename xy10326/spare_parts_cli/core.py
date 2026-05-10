import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from .database import get_db


class SparePartsManager:
    def __init__(self):
        self.db = get_db()

    def _parse_date(self, date_str: str) -> str:
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
        except ValueError:
            return date_str

    def _record_history(self, part_number: str, change_type: str, quantity: float,
                        previous_stock: float, new_stock: float, reference_id: str,
                        reference_type: str, operator: str = None, remarks: str = None):
        self.db.execute('''
            INSERT INTO history (part_number, change_type, quantity, previous_stock,
                                new_stock, reference_id, reference_type, operator, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (part_number, change_type, quantity, previous_stock, new_stock,
              reference_id, reference_type, operator, remarks))

    def _record_approval(self, reference_id: str, reference_type: str, action: str,
                         decision: str, reasons: str = None, operator: str = None):
        self.db.execute('''
            UPDATE approvals SET is_active = 0 
            WHERE reference_id = ? AND reference_type = ? AND is_active = 1
        ''', (reference_id, reference_type))
        
        self.db.execute('''
            INSERT INTO approvals (reference_id, reference_type, action, decision, reasons, operator)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (reference_id, reference_type, action, decision, reasons, operator))

    def _record_exception(self, exception_type: str, part_number: str = None,
                          reference_id: str = None, message: str = None, details: str = None):
        self.db.execute('''
            INSERT INTO exceptions (exception_type, part_number, reference_id, message, details)
            VALUES (?, ?, ?, ?, ?)
        ''', (exception_type, part_number, reference_id, message, details))

    def import_inventory(self, file_path: str, operator: str = None) -> Dict[str, Any]:
        result = {'success': 0, 'failed': 0, 'errors': []}
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.csv':
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        part_number = row['part_number']
                        cursor = self.db.execute(
                            'SELECT current_stock FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            old_stock = existing['current_stock']
                            new_stock = float(row.get('current_stock', old_stock))
                            self.db.execute('''
                                UPDATE inventory SET 
                                    name = ?, category = ?, unit = ?, min_stock = ?,
                                    max_stock = ?, current_stock = ?, safety_stock = ?,
                                    location = ?, description = ?, updated_at = ?
                                WHERE part_number = ?
                            ''', (
                                row.get('name'), row.get('category'), row.get('unit'),
                                float(row.get('min_stock', 0)), float(row.get('max_stock', 0)),
                                new_stock, float(row.get('safety_stock', 0)),
                                row.get('location'), row.get('description'),
                                datetime.now().isoformat(), part_number
                            ))
                            
                            if old_stock != new_stock:
                                self._record_history(
                                    part_number, 'inventory_adjustment',
                                    new_stock - old_stock, old_stock, new_stock,
                                    None, 'import', operator, '库存台账导入更新'
                                )
                        else:
                            current_stock = float(row.get('current_stock', 0))
                            self.db.execute('''
                                INSERT INTO inventory 
                                (part_number, name, category, unit, min_stock, max_stock,
                                 current_stock, safety_stock, location, description)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                part_number, row.get('name'), row.get('category'),
                                row.get('unit'), float(row.get('min_stock', 0)),
                                float(row.get('max_stock', 0)), current_stock,
                                float(row.get('safety_stock', 0)),
                                row.get('location'), row.get('description')
                            ))
                            
                            self._record_history(
                                part_number, 'initial_stock', current_stock, 0, current_stock,
                                None, 'import', operator, '库存台账初始化导入'
                            )
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'row': row, 'error': str(e)})
        elif file_ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    try:
                        part_number = item['part_number']
                        cursor = self.db.execute(
                            'SELECT current_stock FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            old_stock = existing['current_stock']
                            new_stock = float(item.get('current_stock', old_stock))
                            self.db.execute('''
                                UPDATE inventory SET 
                                    name = ?, category = ?, unit = ?, min_stock = ?,
                                    max_stock = ?, current_stock = ?, safety_stock = ?,
                                    location = ?, description = ?, updated_at = ?
                                WHERE part_number = ?
                            ''', (
                                item.get('name'), item.get('category'), item.get('unit'),
                                float(item.get('min_stock', 0)), float(item.get('max_stock', 0)),
                                new_stock, float(item.get('safety_stock', 0)),
                                item.get('location'), item.get('description'),
                                datetime.now().isoformat(), part_number
                            ))
                            
                            if old_stock != new_stock:
                                self._record_history(
                                    part_number, 'inventory_adjustment',
                                    new_stock - old_stock, old_stock, new_stock,
                                    None, 'import', operator, '库存台账导入更新'
                                )
                        else:
                            current_stock = float(item.get('current_stock', 0))
                            self.db.execute('''
                                INSERT INTO inventory 
                                (part_number, name, category, unit, min_stock, max_stock,
                                 current_stock, safety_stock, location, description)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                part_number, item.get('name'), item.get('category'),
                                item.get('unit'), float(item.get('min_stock', 0)),
                                float(item.get('max_stock', 0)), current_stock,
                                float(item.get('safety_stock', 0)),
                                item.get('location'), item.get('description')
                            ))
                            
                            self._record_history(
                                part_number, 'initial_stock', current_stock, 0, current_stock,
                                None, 'import', operator, '库存台账初始化导入'
                            )
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'item': item, 'error': str(e)})
        
        self.db.commit()
        return result

    def import_consumption(self, file_path: str, operator: str = None) -> Dict[str, Any]:
        result = {'success': 0, 'failed': 0, 'skipped': 0, 'errors': []}
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.csv':
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        repair_order_id = row['repair_order_id']
                        cursor = self.db.execute(
                            'SELECT * FROM consumption WHERE repair_order_id = ?',
                            (repair_order_id,)
                        )
                        if cursor.fetchone():
                            result['skipped'] += 1
                            continue
                        
                        part_number = row['part_number']
                        quantity = float(row['quantity'])
                        
                        cursor = self.db.execute(
                            'SELECT current_stock FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        inventory = cursor.fetchone()
                        
                        if not inventory:
                            self._record_exception(
                                'unknown_part', part_number, repair_order_id,
                                f'未知备件: {part_number}',
                                f'维修单 {repair_order_id} 消耗未知备件 {part_number}'
                            )
                            result['failed'] += 1
                            continue
                        
                        old_stock = inventory['current_stock']
                        new_stock = old_stock - quantity
                        
                        if new_stock < 0:
                            self._record_exception(
                                'negative_stock', part_number, repair_order_id,
                                f'负库存: {part_number}',
                                f'维修单 {repair_order_id} 消耗后库存为负: {new_stock}'
                            )
                        
                        self.db.execute('''
                            INSERT INTO consumption 
                            (repair_order_id, part_number, quantity, repair_date, team,
                             equipment, fault_type, remarks)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            repair_order_id, part_number, quantity,
                            self._parse_date(row.get('repair_date')),
                            row.get('team'), row.get('equipment'),
                            row.get('fault_type'), row.get('remarks')
                        ))
                        
                        self.db.execute('''
                            UPDATE inventory SET current_stock = ?, updated_at = ?
                            WHERE part_number = ?
                        ''', (new_stock, datetime.now().isoformat(), part_number))
                        
                        self._record_history(
                            part_number, 'consumption', -quantity, old_stock, new_stock,
                            repair_order_id, 'consumption', operator,
                            f'维修单 {repair_order_id} 消耗'
                        )
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'row': row, 'error': str(e)})
        elif file_ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    try:
                        repair_order_id = item['repair_order_id']
                        cursor = self.db.execute(
                            'SELECT * FROM consumption WHERE repair_order_id = ?',
                            (repair_order_id,)
                        )
                        if cursor.fetchone():
                            result['skipped'] += 1
                            continue
                        
                        part_number = item['part_number']
                        quantity = float(item['quantity'])
                        
                        cursor = self.db.execute(
                            'SELECT current_stock FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        inventory = cursor.fetchone()
                        
                        if not inventory:
                            self._record_exception(
                                'unknown_part', part_number, repair_order_id,
                                f'未知备件: {part_number}',
                                f'维修单 {repair_order_id} 消耗未知备件 {part_number}'
                            )
                            result['failed'] += 1
                            continue
                        
                        old_stock = inventory['current_stock']
                        new_stock = old_stock - quantity
                        
                        if new_stock < 0:
                            self._record_exception(
                                'negative_stock', part_number, repair_order_id,
                                f'负库存: {part_number}',
                                f'维修单 {repair_order_id} 消耗后库存为负: {new_stock}'
                            )
                        
                        self.db.execute('''
                            INSERT INTO consumption 
                            (repair_order_id, part_number, quantity, repair_date, team,
                             equipment, fault_type, remarks)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            repair_order_id, part_number, quantity,
                            self._parse_date(item.get('repair_date')),
                            item.get('team'), item.get('equipment'),
                            item.get('fault_type'), item.get('remarks')
                        ))
                        
                        self.db.execute('''
                            UPDATE inventory SET current_stock = ?, updated_at = ?
                            WHERE part_number = ?
                        ''', (new_stock, datetime.now().isoformat(), part_number))
                        
                        self._record_history(
                            part_number, 'consumption', -quantity, old_stock, new_stock,
                            repair_order_id, 'consumption', operator,
                            f'维修单 {repair_order_id} 消耗'
                        )
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'item': item, 'error': str(e)})
        
        self.db.commit()
        return result

    def import_purchase(self, file_path: str, operator: str = None) -> Dict[str, Any]:
        result = {'success': 0, 'failed': 0, 'errors': []}
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.csv':
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        po_number = row['po_number']
                        part_number = row['part_number']
                        ordered_quantity = float(row['ordered_quantity'])
                        status = row.get('status', 'in_transit')
                        
                        cursor = self.db.execute(
                            'SELECT * FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        if not cursor.fetchone():
                            self._record_exception(
                                'unknown_part', part_number, po_number,
                                f'未知备件: {part_number}',
                                f'采购单 {po_number} 涉及未知备件 {part_number}'
                            )
                            result['failed'] += 1
                            continue
                        
                        cursor = self.db.execute(
                            'SELECT * FROM purchase_orders WHERE po_number = ?',
                            (po_number,)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            received_quantity = float(row.get('received_quantity', existing['received_quantity']))
                            actual_delivery = row.get('actual_delivery') or existing['actual_delivery']
                            
                            if status == 'received' and actual_delivery:
                                if ordered_quantity != received_quantity:
                                    self._record_exception(
                                        'quantity_mismatch', part_number, po_number,
                                        f'采购数量与到货数量不一致',
                                        f'采购单 {po_number}: 订购 {ordered_quantity}, 到货 {received_quantity}'
                                    )
                                
                                cursor = self.db.execute(
                                    'SELECT current_stock FROM inventory WHERE part_number = ?',
                                    (part_number,)
                                )
                                inventory = cursor.fetchone()
                                old_stock = inventory['current_stock']
                                new_stock = old_stock + received_quantity
                                
                                self.db.execute('''
                                    UPDATE inventory SET current_stock = ?, updated_at = ?
                                    WHERE part_number = ?
                                ''', (new_stock, datetime.now().isoformat(), part_number))
                                
                                self._record_history(
                                    part_number, 'purchase_receipt', received_quantity,
                                    old_stock, new_stock, po_number, 'purchase', operator,
                                    f'采购单 {po_number} 到货入库'
                                )
                            
                            self.db.execute('''
                                UPDATE purchase_orders SET
                                    ordered_quantity = ?, received_quantity = ?,
                                    order_date = ?, expected_delivery = ?,
                                    actual_delivery = ?, status = ?,
                                    supplier = ?, price = ?
                                WHERE po_number = ?
                            ''', (
                                ordered_quantity, received_quantity,
                                self._parse_date(row.get('order_date')),
                                self._parse_date(row.get('expected_delivery')),
                                self._parse_date(actual_delivery) if actual_delivery else None,
                                status, row.get('supplier'),
                                float(row.get('price', 0)) if row.get('price') else None,
                                po_number
                            ))
                        else:
                            self.db.execute('''
                                INSERT INTO purchase_orders 
                                (po_number, part_number, ordered_quantity, received_quantity,
                                 order_date, expected_delivery, actual_delivery, status,
                                 supplier, price)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                po_number, part_number, ordered_quantity,
                                float(row.get('received_quantity', 0)),
                                self._parse_date(row.get('order_date')),
                                self._parse_date(row.get('expected_delivery')),
                                self._parse_date(row.get('actual_delivery')) if row.get('actual_delivery') else None,
                                status, row.get('supplier'),
                                float(row.get('price', 0)) if row.get('price') else None
                            ))
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'row': row, 'error': str(e)})
        elif file_ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    try:
                        po_number = item['po_number']
                        part_number = item['part_number']
                        ordered_quantity = float(item['ordered_quantity'])
                        status = item.get('status', 'in_transit')
                        
                        cursor = self.db.execute(
                            'SELECT * FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        if not cursor.fetchone():
                            self._record_exception(
                                'unknown_part', part_number, po_number,
                                f'未知备件: {part_number}',
                                f'采购单 {po_number} 涉及未知备件 {part_number}'
                            )
                            result['failed'] += 1
                            continue
                        
                        cursor = self.db.execute(
                            'SELECT * FROM purchase_orders WHERE po_number = ?',
                            (po_number,)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            received_quantity = float(item.get('received_quantity', existing['received_quantity']))
                            actual_delivery = item.get('actual_delivery') or existing['actual_delivery']
                            
                            if status == 'received' and actual_delivery:
                                if ordered_quantity != received_quantity:
                                    self._record_exception(
                                        'quantity_mismatch', part_number, po_number,
                                        f'采购数量与到货数量不一致',
                                        f'采购单 {po_number}: 订购 {ordered_quantity}, 到货 {received_quantity}'
                                    )
                                
                                cursor = self.db.execute(
                                    'SELECT current_stock FROM inventory WHERE part_number = ?',
                                    (part_number,)
                                )
                                inventory = cursor.fetchone()
                                old_stock = inventory['current_stock']
                                new_stock = old_stock + received_quantity
                                
                                self.db.execute('''
                                    UPDATE inventory SET current_stock = ?, updated_at = ?
                                    WHERE part_number = ?
                                ''', (new_stock, datetime.now().isoformat(), part_number))
                                
                                self._record_history(
                                    part_number, 'purchase_receipt', received_quantity,
                                    old_stock, new_stock, po_number, 'purchase', operator,
                                    f'采购单 {po_number} 到货入库'
                                )
                            
                            self.db.execute('''
                                UPDATE purchase_orders SET
                                    ordered_quantity = ?, received_quantity = ?,
                                    order_date = ?, expected_delivery = ?,
                                    actual_delivery = ?, status = ?,
                                    supplier = ?, price = ?
                                WHERE po_number = ?
                            ''', (
                                ordered_quantity, received_quantity,
                                self._parse_date(item.get('order_date')),
                                self._parse_date(item.get('expected_delivery')),
                                self._parse_date(actual_delivery) if actual_delivery else None,
                                status, item.get('supplier'),
                                float(item.get('price', 0)) if item.get('price') else None,
                                po_number
                            ))
                        else:
                            self.db.execute('''
                                INSERT INTO purchase_orders 
                                (po_number, part_number, ordered_quantity, received_quantity,
                                 order_date, expected_delivery, actual_delivery, status,
                                 supplier, price)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                po_number, part_number, ordered_quantity,
                                float(item.get('received_quantity', 0)),
                                self._parse_date(item.get('order_date')),
                                self._parse_date(item.get('expected_delivery')),
                                self._parse_date(item.get('actual_delivery')) if item.get('actual_delivery') else None,
                                status, item.get('supplier'),
                                float(item.get('price', 0)) if item.get('price') else None
                            ))
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'item': item, 'error': str(e)})
        
        self.db.commit()
        return result

    def import_borrow(self, file_path: str, operator: str = None) -> Dict[str, Any]:
        result = {'success': 0, 'failed': 0, 'errors': []}
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.csv':
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        borrow_number = row['borrow_number']
                        part_number = row['part_number']
                        borrowed_quantity = float(row['borrowed_quantity'])
                        status = row.get('status', 'borrowed')
                        
                        cursor = self.db.execute(
                            'SELECT * FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        if not cursor.fetchone():
                            self._record_exception(
                                'unknown_part', part_number, borrow_number,
                                f'未知备件: {part_number}',
                                f'借调单 {borrow_number} 涉及未知备件 {part_number}'
                            )
                            result['failed'] += 1
                            continue
                        
                        cursor = self.db.execute(
                            'SELECT * FROM borrows WHERE borrow_number = ?',
                            (borrow_number,)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            returned_quantity = float(row.get('returned_quantity', existing['returned_quantity']))
                            actual_return = row.get('actual_return') or existing['actual_return']
                            
                            if status == 'returned' and actual_return:
                                cursor = self.db.execute(
                                    'SELECT current_stock FROM inventory WHERE part_number = ?',
                                    (part_number,)
                                )
                                inventory = cursor.fetchone()
                                old_stock = inventory['current_stock']
                                new_stock = old_stock + (returned_quantity - existing['returned_quantity'])
                                
                                self.db.execute('''
                                    UPDATE inventory SET current_stock = ?, updated_at = ?
                                    WHERE part_number = ?
                                ''', (new_stock, datetime.now().isoformat(), part_number))
                                
                                self._record_history(
                                    part_number, 'borrow_return', 
                                    returned_quantity - existing['returned_quantity'],
                                    old_stock, new_stock, borrow_number, 'borrow', operator,
                                    f'借调单 {borrow_number} 归还'
                                )
                            
                            self.db.execute('''
                                UPDATE borrows SET
                                    borrowed_quantity = ?, returned_quantity = ?,
                                    borrow_date = ?, expected_return = ?,
                                    actual_return = ?, status = ?,
                                    from_location = ?, to_location = ?, borrower = ?, remarks = ?
                                WHERE borrow_number = ?
                            ''', (
                                borrowed_quantity, returned_quantity,
                                self._parse_date(row.get('borrow_date')),
                                self._parse_date(row.get('expected_return')),
                                self._parse_date(actual_return) if actual_return else None,
                                status, row.get('from_location'), row.get('to_location'),
                                row.get('borrower'), row.get('remarks'),
                                borrow_number
                            ))
                        else:
                            cursor = self.db.execute(
                                'SELECT current_stock FROM inventory WHERE part_number = ?',
                                (part_number,)
                            )
                            inventory = cursor.fetchone()
                            old_stock = inventory['current_stock']
                            new_stock = old_stock - borrowed_quantity
                            
                            if new_stock < 0:
                                self._record_exception(
                                    'negative_stock', part_number, borrow_number,
                                    f'负库存: {part_number}',
                                    f'借调单 {borrow_number} 借出后库存为负: {new_stock}'
                                )
                            
                            self.db.execute('''
                                UPDATE inventory SET current_stock = ?, updated_at = ?
                                WHERE part_number = ?
                            ''', (new_stock, datetime.now().isoformat(), part_number))
                            
                            self._record_history(
                                part_number, 'borrow_out', -borrowed_quantity,
                                old_stock, new_stock, borrow_number, 'borrow', operator,
                                f'借调单 {borrow_number} 借出'
                            )
                            
                            self.db.execute('''
                                INSERT INTO borrows 
                                (borrow_number, part_number, borrowed_quantity, returned_quantity,
                                 borrow_date, expected_return, actual_return, status,
                                 from_location, to_location, borrower, remarks)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                borrow_number, part_number, borrowed_quantity,
                                float(row.get('returned_quantity', 0)),
                                self._parse_date(row.get('borrow_date')),
                                self._parse_date(row.get('expected_return')),
                                self._parse_date(row.get('actual_return')) if row.get('actual_return') else None,
                                status, row.get('from_location'), row.get('to_location'),
                                row.get('borrower'), row.get('remarks')
                            ))
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'row': row, 'error': str(e)})
        elif file_ext == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    try:
                        borrow_number = item['borrow_number']
                        part_number = item['part_number']
                        borrowed_quantity = float(item['borrowed_quantity'])
                        status = item.get('status', 'borrowed')
                        
                        cursor = self.db.execute(
                            'SELECT * FROM inventory WHERE part_number = ?',
                            (part_number,)
                        )
                        if not cursor.fetchone():
                            self._record_exception(
                                'unknown_part', part_number, borrow_number,
                                f'未知备件: {part_number}',
                                f'借调单 {borrow_number} 涉及未知备件 {part_number}'
                            )
                            result['failed'] += 1
                            continue
                        
                        cursor = self.db.execute(
                            'SELECT * FROM borrows WHERE borrow_number = ?',
                            (borrow_number,)
                        )
                        existing = cursor.fetchone()
                        
                        if existing:
                            returned_quantity = float(item.get('returned_quantity', existing['returned_quantity']))
                            actual_return = item.get('actual_return') or existing['actual_return']
                            
                            if status == 'returned' and actual_return:
                                cursor = self.db.execute(
                                    'SELECT current_stock FROM inventory WHERE part_number = ?',
                                    (part_number,)
                                )
                                inventory = cursor.fetchone()
                                old_stock = inventory['current_stock']
                                new_stock = old_stock + (returned_quantity - existing['returned_quantity'])
                                
                                self.db.execute('''
                                    UPDATE inventory SET current_stock = ?, updated_at = ?
                                    WHERE part_number = ?
                                ''', (new_stock, datetime.now().isoformat(), part_number))
                                
                                self._record_history(
                                    part_number, 'borrow_return', 
                                    returned_quantity - existing['returned_quantity'],
                                    old_stock, new_stock, borrow_number, 'borrow', operator,
                                    f'借调单 {borrow_number} 归还'
                                )
                            
                            self.db.execute('''
                                UPDATE borrows SET
                                    borrowed_quantity = ?, returned_quantity = ?,
                                    borrow_date = ?, expected_return = ?,
                                    actual_return = ?, status = ?,
                                    from_location = ?, to_location = ?, borrower = ?, remarks = ?
                                WHERE borrow_number = ?
                            ''', (
                                borrowed_quantity, returned_quantity,
                                self._parse_date(item.get('borrow_date')),
                                self._parse_date(item.get('expected_return')),
                                self._parse_date(actual_return) if actual_return else None,
                                status, item.get('from_location'), item.get('to_location'),
                                item.get('borrower'), item.get('remarks'),
                                borrow_number
                            ))
                        else:
                            cursor = self.db.execute(
                                'SELECT current_stock FROM inventory WHERE part_number = ?',
                                (part_number,)
                            )
                            inventory = cursor.fetchone()
                            old_stock = inventory['current_stock']
                            new_stock = old_stock - borrowed_quantity
                            
                            if new_stock < 0:
                                self._record_exception(
                                    'negative_stock', part_number, borrow_number,
                                    f'负库存: {part_number}',
                                    f'借调单 {borrow_number} 借出后库存为负: {new_stock}'
                                )
                            
                            self.db.execute('''
                                UPDATE inventory SET current_stock = ?, updated_at = ?
                                WHERE part_number = ?
                            ''', (new_stock, datetime.now().isoformat(), part_number))
                            
                            self._record_history(
                                part_number, 'borrow_out', -borrowed_quantity,
                                old_stock, new_stock, borrow_number, 'borrow', operator,
                                f'借调单 {borrow_number} 借出'
                            )
                            
                            self.db.execute('''
                                INSERT INTO borrows 
                                (borrow_number, part_number, borrowed_quantity, returned_quantity,
                                 borrow_date, expected_return, actual_return, status,
                                 from_location, to_location, borrower, remarks)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                borrow_number, part_number, borrowed_quantity,
                                float(item.get('returned_quantity', 0)),
                                self._parse_date(item.get('borrow_date')),
                                self._parse_date(item.get('expected_return')),
                                self._parse_date(item.get('actual_return')) if item.get('actual_return') else None,
                                status, item.get('from_location'), item.get('to_location'),
                                item.get('borrower'), item.get('remarks')
                            ))
                        
                        result['success'] += 1
                    except Exception as e:
                        result['failed'] += 1
                        result['errors'].append({'item': item, 'error': str(e)})
        
        self.db.commit()
        return result

    def calculate_available_stock(self) -> List[Dict[str, Any]]:
        cursor = self.db.execute('''
            SELECT i.*,
                   COALESCE((SELECT SUM(po.ordered_quantity - po.received_quantity) 
                            FROM purchase_orders po 
                            WHERE po.part_number = i.part_number AND po.status = 'in_transit'), 0) AS in_transit,
                   COALESCE((SELECT SUM(b.borrowed_quantity - b.returned_quantity) 
                            FROM borrows b 
                            WHERE b.part_number = i.part_number AND b.status = 'borrowed'), 0) AS borrowed_out
            FROM inventory i
            ORDER BY i.category, i.part_number
        ''')
        
        results = []
        for row in cursor.fetchall():
            result = dict(row)
            result['available_stock'] = result['current_stock']
            result['available_including_transit'] = result['current_stock'] + result['in_transit']
            results.append(result)
        
        return results

    def calculate_restock_suggestions(self, operator: str = None) -> List[Dict[str, Any]]:
        stock_data = self.calculate_available_stock()
        suggestions = []
        
        for item in stock_data:
            need_suggestion = False
            reason = []
            
            if item['current_stock'] < item['safety_stock']:
                need_suggestion = True
                reason.append(f'当前库存({item["current_stock"]})低于安全库存({item["safety_stock"]})')
            
            if item['current_stock'] < item['min_stock']:
                need_suggestion = True
                reason.append(f'当前库存({item["current_stock"]})低于最低库存({item["min_stock"]})')
            
            available = item['current_stock'] + item['in_transit']
            if available < item['safety_stock']:
                need_suggestion = True
                reason.append(f'含在途可用库存({available})仍低于安全库存({item["safety_stock"]})')
            
            if item['borrowed_out'] > item['current_stock'] * 0.5:
                need_suggestion = True
                reason.append(f'借出数量({item["borrowed_out"]})占当前库存比例过高')
            
            if need_suggestion:
                suggested_quantity = max(
                    item['max_stock'] - item['current_stock'],
                    item['safety_stock'] - item['current_stock'],
                    0
                )
                
                cursor = self.db.execute('''
                    SELECT * FROM restock_suggestions 
                    WHERE part_number = ? AND status = 'pending'
                ''', (item['part_number'],))
                
                existing = cursor.fetchone()
                reason_text = '; '.join(reason)
                
                if existing:
                    if (existing['suggested_quantity'] != suggested_quantity or 
                        existing['reason'] != reason_text):
                        self.db.execute('''
                            UPDATE restock_suggestions 
                            SET suggested_quantity = ?, reason = ?, created_at = ?
                            WHERE id = ?
                        ''', (suggested_quantity, reason_text, datetime.now().isoformat(), existing['id']))
                else:
                    self.db.execute('''
                        INSERT INTO restock_suggestions (part_number, suggested_quantity, reason)
                        VALUES (?, ?, ?)
                    ''', (item['part_number'], suggested_quantity, reason_text))
                
                suggestions.append({
                    'part_number': item['part_number'],
                    'name': item['name'],
                    'current_stock': item['current_stock'],
                    'safety_stock': item['safety_stock'],
                    'min_stock': item['min_stock'],
                    'in_transit': item['in_transit'],
                    'borrowed_out': item['borrowed_out'],
                    'suggested_quantity': suggested_quantity,
                    'reason': reason_text
                })
        
        self.db.commit()
        return suggestions

    def get_alerts(self) -> Dict[str, Any]:
        alerts = {
            'low_stock': [],
            'negative_stock': [],
            'unknown_parts': [],
            'quantity_mismatch': [],
            'unreturned_borrows': [],
            'open_exceptions': []
        }
        
        stock_data = self.calculate_available_stock()
        for item in stock_data:
            if item['current_stock'] < item['safety_stock']:
                alerts['low_stock'].append({
                    'part_number': item['part_number'],
                    'name': item['name'],
                    'current_stock': item['current_stock'],
                    'safety_stock': item['safety_stock'],
                    'gap': item['safety_stock'] - item['current_stock']
                })
            if item['current_stock'] < 0:
                alerts['negative_stock'].append({
                    'part_number': item['part_number'],
                    'name': item['name'],
                    'current_stock': item['current_stock']
                })
        
        cursor = self.db.execute('''
            SELECT * FROM borrows WHERE status = 'borrowed' 
            AND (expected_return IS NULL OR expected_return < date('now'))
            ORDER BY borrow_date
        ''')
        for row in cursor.fetchall():
            alerts['unreturned_borrows'].append(dict(row))
        
        cursor = self.db.execute('''
            SELECT * FROM exceptions WHERE status = 'open'
            ORDER BY created_at DESC
        ''')
        for row in cursor.fetchall():
            exc = dict(row)
            if exc['exception_type'] == 'unknown_part':
                alerts['unknown_parts'].append(exc)
            elif exc['exception_type'] == 'quantity_mismatch':
                alerts['quantity_mismatch'].append(exc)
            alerts['open_exceptions'].append(exc)
        
        return alerts

    def approve_restock(self, suggestion_id: int, decision: str, reasons: str = None,
                        operator: str = None) -> bool:
        cursor = self.db.execute(
            'SELECT * FROM restock_suggestions WHERE id = ?', (suggestion_id,)
        )
        suggestion = cursor.fetchone()
        
        if not suggestion:
            return False
        
        self._record_approval(
            str(suggestion_id), 'restock_suggestion', 'approve',
            decision, reasons, operator
        )
        
        self.db.execute('''
            UPDATE restock_suggestions SET status = ? WHERE id = ?
        ''', (decision, suggestion_id))
        
        self.db.commit()
        return True

    def resolve_exception(self, exception_id: int, operator: str = None) -> bool:
        cursor = self.db.execute(
            'SELECT * FROM exceptions WHERE id = ?', (exception_id,)
        )
        exception = cursor.fetchone()
        
        if not exception:
            return False
        
        self.db.execute('''
            UPDATE exceptions SET status = 'resolved', resolved_at = ?
            WHERE id = ?
        ''', (datetime.now().isoformat(), exception_id))
        
        self._record_approval(
            str(exception_id), 'exception', 'resolve', 'resolved',
            f'异常已解决，操作人: {operator}', operator
        )
        
        self.db.commit()
        return True

    def get_history(self, part_number: str = None, limit: int = 100) -> List[Dict[str, Any]]:
        if part_number:
            cursor = self.db.execute('''
                SELECT * FROM history 
                WHERE part_number = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (part_number, limit))
        else:
            cursor = self.db.execute('''
                SELECT * FROM history 
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (limit,))
        
        return [dict(row) for row in cursor.fetchall()]

    def get_approvals(self, reference_id: str = None,
                      reference_type: str = None) -> List[Dict[str, Any]]:
        if reference_id and reference_type:
            cursor = self.db.execute('''
                SELECT * FROM approvals 
                WHERE reference_id = ? AND reference_type = ?
                ORDER BY timestamp DESC
            ''', (reference_id, reference_type))
        elif reference_id:
            cursor = self.db.execute('''
                SELECT * FROM approvals 
                WHERE reference_id = ?
                ORDER BY timestamp DESC
            ''', (reference_id,))
        else:
            cursor = self.db.execute('''
                SELECT * FROM approvals 
                ORDER BY timestamp DESC
            ''')
        
        return [dict(row) for row in cursor.fetchall()]
