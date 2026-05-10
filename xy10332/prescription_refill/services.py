import csv
from datetime import datetime, date, timedelta
from typing import List, Dict, Tuple, Optional, Set
from collections import defaultdict

from prescription_refill.database import get_db
from prescription_refill.models import (
    Customer, Drug, DrugRule, SalesRecord, SaleItem, RefillItem, ContactLog
)


def parse_date(date_str: str) -> date:
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    raise ValueError(f"无法解析日期: {date_str}")


def import_customers(csv_path: str) -> Tuple[int, List[str]]:
    imported = 0
    errors = []
    with get_db() as conn:
        cursor = conn.cursor()
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    code = row['customer_code'].strip()
                    if not code:
                        errors.append(f"第{row_num}行: 顾客编码为空")
                        continue
                    cursor.execute('''
                        INSERT OR REPLACE INTO customers 
                        (customer_code, name, phone, id_card, disease_type, notes)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        code,
                        row.get('name', '').strip(),
                        row.get('phone', '').strip(),
                        row.get('id_card', '').strip(),
                        row.get('disease_type', '').strip(),
                        row.get('notes', '').strip(),
                    ))
                    imported += 1
                except KeyError as e:
                    errors.append(f"第{row_num}行: 缺少列 {e}")
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
    return imported, errors


def import_drugs(csv_path: str) -> Tuple[int, List[str]]:
    imported = 0
    errors = []
    with get_db() as conn:
        cursor = conn.cursor()
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    code = row['drug_code'].strip()
                    if not code:
                        errors.append(f"第{row_num}行: 药品编码为空")
                        continue
                    price = float(row.get('unit_price', '0') or '0')
                    cursor.execute('''
                        INSERT OR REPLACE INTO drugs 
                        (drug_code, name, generic_name, specification, unit, 
                         unit_price, manufacturer, category)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        code,
                        row.get('name', '').strip(),
                        row.get('generic_name', '').strip(),
                        row.get('specification', '').strip(),
                        row.get('unit', '片').strip(),
                        price,
                        row.get('manufacturer', '').strip(),
                        row.get('category', '').strip(),
                    ))
                    imported += 1
                except KeyError as e:
                    errors.append(f"第{row_num}行: 缺少列 {e}")
                except ValueError:
                    errors.append(f"第{row_num}行: 单价格式错误")
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
    return imported, errors


def import_drug_rules(csv_path: str) -> Tuple[int, List[str]]:
    imported = 0
    errors = []
    with get_db() as conn:
        cursor = conn.cursor()
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    drug_code = row['drug_code'].strip()
                    cursor.execute('SELECT id FROM drugs WHERE drug_code = ?', (drug_code,))
                    drug_row = cursor.fetchone()
                    if not drug_row:
                        errors.append(f"第{row_num}行: 药品编码不存在 {drug_code}")
                        continue
                    drug_id = drug_row['id']

                    default_dosage = row.get('default_dosage', '').strip()
                    default_dosage = float(default_dosage) if default_dosage else None

                    daily_frequency = row.get('daily_frequency', '').strip()
                    daily_frequency = int(daily_frequency) if daily_frequency else None

                    refill_window = int(row.get('refill_window_days', '7') or '7')
                    min_remaining = int(row.get('min_days_remaining', '3') or '3')

                    cursor.execute('''
                        DELETE FROM drug_rules WHERE drug_id = ?
                    ''', (drug_id,))
                    cursor.execute('''
                        INSERT INTO drug_rules 
                        (drug_id, default_dosage, dosage_unit, daily_frequency, 
                         refill_window_days, min_days_remaining, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        drug_id,
                        default_dosage,
                        row.get('dosage_unit', '').strip(),
                        daily_frequency,
                        refill_window,
                        min_remaining,
                        row.get('notes', '').strip(),
                    ))
                    imported += 1
                except KeyError as e:
                    errors.append(f"第{row_num}行: 缺少列 {e}")
                except ValueError:
                    errors.append(f"第{row_num}行: 数字格式错误")
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
    return imported, errors


def import_contraindications(csv_path: str) -> Tuple[int, List[str]]:
    imported = 0
    errors = []
    with get_db() as conn:
        cursor = conn.cursor()
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    drug1_code = row['drug_code'].strip()
                    drug2_code = row['contraindicated_drug_code'].strip()

                    cursor.execute('SELECT id FROM drugs WHERE drug_code = ?', (drug1_code,))
                    drug1 = cursor.fetchone()
                    cursor.execute('SELECT id FROM drugs WHERE drug_code = ?', (drug2_code,))
                    drug2 = cursor.fetchone()

                    if not drug1 or not drug2:
                        errors.append(f"第{row_num}行: 药品编码不存在")
                        continue

                    cursor.execute('''
                        INSERT OR REPLACE INTO contraindications 
                        (drug_id, contraindicated_drug_id, description)
                        VALUES (?, ?, ?)
                    ''', (drug1['id'], drug2['id'], row.get('description', '').strip()))
                    imported += 1
                except KeyError as e:
                    errors.append(f"第{row_num}行: 缺少列 {e}")
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
    return imported, errors


def import_inventory(csv_path: str) -> Tuple[int, List[str]]:
    imported = 0
    errors = []
    with get_db() as conn:
        cursor = conn.cursor()
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    drug_code = row['drug_code'].strip()
                    cursor.execute('SELECT id FROM drugs WHERE drug_code = ?', (drug_code,))
                    drug_row = cursor.fetchone()
                    if not drug_row:
                        errors.append(f"第{row_num}行: 药品编码不存在 {drug_code}")
                        continue
                    drug_id = drug_row['id']

                    stock = float(row.get('stock_quantity', '0') or '0')
                    min_stock = float(row.get('minimum_stock', '0') or '0')

                    cursor.execute('''
                        INSERT OR REPLACE INTO inventory (drug_id, stock_quantity, minimum_stock)
                        VALUES (?, ?, ?)
                    ''', (drug_id, stock, min_stock))
                    imported += 1
                except KeyError as e:
                    errors.append(f"第{row_num}行: 缺少列 {e}")
                except ValueError:
                    errors.append(f"第{row_num}行: 库存数量格式错误")
                except Exception as e:
                    errors.append(f"第{row_num}行: {e}")
    return imported, errors


def import_sales(csv_path: str) -> Tuple[int, List[str], List[str]]:
    imported = 0
    warnings = []
    errors = []
    receipt_groups: Dict[str, List[Dict]] = defaultdict(list)

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            try:
                receipt_no = row['receipt_no'].strip()
                if not receipt_no:
                    errors.append(f"第{row_num}行: 小票号为空")
                    continue
                receipt_groups[receipt_no].append(row)
            except KeyError as e:
                errors.append(f"第{row_num}行: 缺少列 {e}")

    with get_db() as conn:
        cursor = conn.cursor()
        for receipt_no, items in receipt_groups.items():
            try:
                cursor.execute('SELECT id FROM sales_records WHERE receipt_no = ?', (receipt_no,))
                if cursor.fetchone():
                    warnings.append(f"跳过已存在小票: {receipt_no}")
                    continue

                first_item = items[0]
                customer_code = first_item['customer_code'].strip()
                sale_date_str = first_item['sale_date'].strip()
                sale_date = parse_date(sale_date_str).isoformat()

                cursor.execute('SELECT id FROM customers WHERE customer_code = ?', (customer_code,))
                customer_row = cursor.fetchone()
                if not customer_row:
                    errors.append(f"小票 {receipt_no}: 顾客编码不存在 {customer_code}")
                    continue
                customer_id = customer_row['id']

                total_amount = 0.0
                valid_items = []

                for item in items:
                    drug_code = item['drug_code'].strip()
                    cursor.execute('SELECT id, unit_price FROM drugs WHERE drug_code = ?', (drug_code,))
                    drug_row = cursor.fetchone()
                    if not drug_row:
                        errors.append(f"小票 {receipt_no}: 药品编码不存在 {drug_code}")
                        continue

                    drug_id = drug_row['id']
                    unit_price = float(item.get('unit_price', str(drug_row['unit_price'])) or str(drug_row['unit_price']))
                    quantity = float(item['quantity'])
                    subtotal = unit_price * quantity
                    total_amount += subtotal

                    dosage = item.get('dosage', '').strip()
                    dosage = float(dosage) if dosage else None

                    daily_freq = item.get('daily_frequency', '').strip()
                    daily_freq = int(daily_freq) if daily_freq else None

                    if dosage is None:
                        warnings.append(f"小票 {receipt_no}, 药品 {drug_code}: 缺少剂量")
                    if daily_freq is None:
                        warnings.append(f"小票 {receipt_no}, 药品 {drug_code}: 缺少服用频次")

                    valid_items.append({
                        'drug_id': drug_id,
                        'quantity': quantity,
                        'unit_price': unit_price,
                        'subtotal': subtotal,
                        'dosage': dosage,
                        'dosage_unit': item.get('dosage_unit', '').strip(),
                        'daily_frequency': daily_freq,
                    })

                if not valid_items:
                    errors.append(f"小票 {receipt_no}: 没有有效商品")
                    continue

                cursor.execute('''
                    INSERT INTO sales_records (receipt_no, customer_id, sale_date, total_amount)
                    VALUES (?, ?, ?, ?)
                ''', (receipt_no, customer_id, sale_date, total_amount))
                sales_record_id = cursor.lastrowid

                for item in valid_items:
                    cursor.execute('''
                        INSERT INTO sale_items 
                        (sales_record_id, drug_id, quantity, unit_price, subtotal,
                         dosage, dosage_unit, daily_frequency)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        sales_record_id,
                        item['drug_id'],
                        item['quantity'],
                        item['unit_price'],
                        item['subtotal'],
                        item['dosage'],
                        item['dosage_unit'],
                        item['daily_frequency'],
                    ))

                imported += 1
            except KeyError as e:
                errors.append(f"小票 {receipt_no}: 缺少列 {e}")
            except ValueError as e:
                errors.append(f"小票 {receipt_no}: {e}")
            except Exception as e:
                errors.append(f"小票 {receipt_no}: {e}")

    return imported, warnings, errors


def _get_drug_info() -> Dict[int, Dict]:
    info: Dict[int, Dict] = {}
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT id, drug_code, name, unit, unit_price FROM drugs')
        for row in cursor.fetchall():
            info[row['id']] = dict(row)
    return info


def _get_drug_rules() -> Dict[int, DrugRule]:
    rules: Dict[int, DrugRule] = {}
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM drug_rules')
        for row in cursor.fetchall():
            rules[row['drug_id']] = DrugRule(
                id=row['id'],
                drug_id=row['drug_id'],
                default_dosage=row['default_dosage'],
                dosage_unit=row['dosage_unit'] or '',
                daily_frequency=row['daily_frequency'],
                refill_window_days=row['refill_window_days'],
                min_days_remaining=row['min_days_remaining'],
            )
    return rules


def _get_contraindications() -> Dict[int, Set[int]]:
    contra: Dict[int, Set[int]] = defaultdict(set)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT drug_id, contraindicated_drug_id FROM contraindications')
        for row in cursor.fetchall():
            contra[row['drug_id']].add(row['contraindicated_drug_id'])
            contra[row['contraindicated_drug_id']].add(row['drug_id'])
    return contra


def _get_inventory() -> Dict[int, float]:
    inventory: Dict[int, float] = {}
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT drug_id, stock_quantity FROM inventory')
        for row in cursor.fetchall():
            inventory[row['drug_id']] = row['stock_quantity']
    return inventory


def _get_active_drugs_for_customer(customer_id: int) -> Dict[int, List[Tuple[date, SaleItem]]]:
    drug_history: Dict[int, List[Tuple[date, SaleItem]]] = defaultdict(list)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT sr.id, sr.receipt_no, sr.sale_date, 
                   si.id as item_id, si.drug_id, si.quantity, si.unit_price, 
                   si.subtotal, si.dosage, si.dosage_unit, si.daily_frequency,
                   d.name as drug_name
            FROM sales_records sr
            JOIN sale_items si ON sr.id = si.sales_record_id
            JOIN drugs d ON si.drug_id = d.id
            WHERE sr.customer_id = ?
            ORDER BY sr.sale_date DESC
        ''', (customer_id,))
        for row in cursor.fetchall():
            sale_date = parse_date(row['sale_date'])
            item = SaleItem(
                id=row['item_id'],
                drug_id=row['drug_id'],
                drug_name=row['drug_name'],
                quantity=row['quantity'],
                unit_price=row['unit_price'],
                subtotal=row['subtotal'],
                dosage=row['dosage'],
                dosage_unit=row['dosage_unit'] or '',
                daily_frequency=row['daily_frequency'],
            )
            drug_history[row['drug_id']].append((sale_date, item))
    return drug_history


def calculate_days_supplied(
    quantity: float,
    dosage: Optional[float],
    daily_frequency: Optional[int],
    drug_rules: Dict[int, DrugRule],
    drug_id: int,
) -> Tuple[Optional[float], List[str]]:
    warnings: List[str] = []

    if dosage is None and drug_id in drug_rules:
        dosage = drug_rules[drug_id].default_dosage
        if dosage is not None:
            warnings.append(f"使用默认剂量: {dosage}")

    if daily_frequency is None and drug_id in drug_rules:
        daily_frequency = drug_rules[drug_id].daily_frequency
        if daily_frequency is not None:
            warnings.append(f"使用默认服用频次: {daily_frequency}次/天")

    if dosage is None:
        return None, ["缺少剂量，无法计算供应天数"]
    if daily_frequency is None or daily_frequency == 0:
        return None, ["缺少服用频次，无法计算供应天数"]

    daily_usage = dosage * daily_frequency
    if daily_usage <= 0:
        return None, ["每日用量为0，无法计算供应天数"]

    days = quantity / daily_usage
    return days, warnings


def get_all_customers() -> List[Customer]:
    customers: List[Customer] = []
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM customers ORDER BY customer_code')
        for row in cursor.fetchall():
            customers.append(Customer(
                id=row['id'],
                customer_code=row['customer_code'],
                name=row['name'],
                phone=row['phone'] or '',
                id_card=row['id_card'] or '',
                disease_type=row['disease_type'] or '',
                notes=row['notes'] or '',
            ))
    return customers


def get_customer_by_code(customer_code: str) -> Optional[Customer]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM customers WHERE customer_code = ?', (customer_code,))
        row = cursor.fetchone()
        if not row:
            return None
        return Customer(
            id=row['id'],
            customer_code=row['customer_code'],
            name=row['name'],
            phone=row['phone'] or '',
            id_card=row['id_card'] or '',
            disease_type=row['disease_type'] or '',
            notes=row['notes'] or '',
        )


def check_contraindications_for_customer(customer_id: int, contraindications: Dict[int, Set[int]]) -> List[str]:
    drug_history = _get_active_drugs_for_customer(customer_id)
    active_drugs = set(drug_history.keys())
    warnings: List[str] = []
    checked = set()

    for drug_id in active_drugs:
        if drug_id not in contraindications:
            continue
        for contra_drug in contraindications[drug_id]:
            if contra_drug in active_drugs and (drug_id, contra_drug) not in checked:
                checked.add((drug_id, contra_drug))
                checked.add((contra_drug, drug_id))
                warnings.append(f"存在禁忌用药组合，请立即联系顾客确认")

    return warnings


def calculate_refill_for_customer(
    customer: Customer,
    today: Optional[date] = None,
) -> Tuple[List[RefillItem], List[str]]:
    if today is None:
        today = date.today()

    drug_info = _get_drug_info()
    drug_rules = _get_drug_rules()
    contraindications = _get_contraindications()
    inventory = _get_inventory()
    drug_history = _get_active_drugs_for_customer(customer.id)

    refill_items: List[RefillItem] = []
    global_warnings = check_contraindications_for_customer(customer.id, contraindications)

    all_drug_ids = set()
    for drug_id, history in drug_history.items():
        if not history:
            continue

        last_sale_date, last_item = history[0]
        rule = drug_rules.get(drug_id)
        refill_window = rule.refill_window_days if rule else 7
        min_remaining = rule.min_days_remaining if rule else 3

        days_supplied, supply_warnings = calculate_days_supplied(
            last_item.quantity,
            last_item.dosage,
            last_item.daily_frequency,
            drug_rules,
            drug_id,
        )

        all_drug_ids.add(drug_id)

        if days_supplied is None:
            di = drug_info.get(drug_id, {})
            refill_items.append(RefillItem(
                customer_id=customer.id,
                customer_name=customer.name,
                phone=customer.phone,
                customer_code=customer.customer_code,
                drug_id=drug_id,
                drug_name=di.get('name', '未知'),
                last_sale_date=last_sale_date,
                days_supplied=0,
                days_remaining=0,
                estimated_finish_date=last_sale_date,
                refill_window_start=last_sale_date,
                refill_window_end=last_sale_date,
                quantity_needed=0,
                unit_price=di.get('unit_price', 0),
                estimated_amount=0,
                status='异常',
                warnings=supply_warnings,
            ))
            continue

        estimated_finish = last_sale_date + timedelta(days=int(days_supplied))
        days_remaining = (estimated_finish - today).days

        refill_window_start = estimated_finish - timedelta(days=refill_window)
        refill_window_end = estimated_finish + timedelta(days=min_remaining)

        if days_remaining < 0:
            status = '已过期'
        elif refill_window_start <= today <= refill_window_end:
            status = '续配窗口'
        elif today < refill_window_start:
            status = '未到续配'
        else:
            status = '已过期'

        if rule and last_item.dosage and last_item.daily_frequency:
            quantity_needed = last_item.dosage * last_item.daily_frequency * 30
            quantity_needed = round(quantity_needed, 2)
        else:
            quantity_needed = last_item.quantity

        di = drug_info.get(drug_id, {})
        unit_price = di.get('unit_price', 0)
        estimated_amount = round(quantity_needed * unit_price, 2)

        warnings = []
        warnings.extend(supply_warnings)

        if days_remaining < 0:
            warnings.append(f"药品已过期 {-days_remaining} 天")

        if len(history) >= 2:
            prev_sale_date, prev_item = history[1]
            interval_days = (last_sale_date - prev_sale_date).days
            prev_days_supplied, _ = calculate_days_supplied(
                prev_item.quantity,
                prev_item.dosage,
                prev_item.daily_frequency,
                drug_rules,
                drug_id,
            )
            if prev_days_supplied and interval_days < prev_days_supplied * 0.7:
                warnings.append(f"过早购药：距上次购买仅 {interval_days} 天，上次供应 {int(prev_days_supplied)} 天")

        if drug_id in inventory and inventory[drug_id] < quantity_needed:
            warnings.append(f"库存不足：现有 {inventory[drug_id]}，需 {quantity_needed}")

        refill_items.append(RefillItem(
            customer_id=customer.id,
            customer_name=customer.name,
            phone=customer.phone,
            customer_code=customer.customer_code,
            drug_id=drug_id,
            drug_name=di.get('name', '未知'),
            last_sale_date=last_sale_date,
            days_supplied=round(days_supplied, 1),
            days_remaining=days_remaining,
            estimated_finish_date=estimated_finish,
            refill_window_start=refill_window_start,
            refill_window_end=refill_window_end,
            quantity_needed=quantity_needed,
            unit_price=unit_price,
            estimated_amount=estimated_amount,
            status=status,
            warnings=warnings,
        ))

    if global_warnings:
        for item in refill_items:
            item.warnings.extend(global_warnings)

    return refill_items, global_warnings


def calculate_all_refills(today: Optional[date] = None) -> List[RefillItem]:
    if today is None:
        today = date.today()

    all_items: List[RefillItem] = []
    customers = get_all_customers()

    for customer in customers:
        items, _ = calculate_refill_for_customer(customer, today)
        all_items.extend(items)

    return all_items


def get_today_contact_list(today: Optional[date] = None) -> List[RefillItem]:
    if today is None:
        today = date.today()

    all_items = calculate_all_refills(today)

    contact_items = [
        item for item in all_items
        if item.status in ['续配窗口', '已过期'] or len(item.warnings) > 0
    ]

    contact_items.sort(key=lambda x: (x.days_remaining, x.customer_name))
    return contact_items


def get_customer_sales_history(customer_id: int) -> List[SalesRecord]:
    records: List[SalesRecord] = []
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, receipt_no, customer_id, sale_date, total_amount
            FROM sales_records
            WHERE customer_id = ?
            ORDER BY sale_date DESC
        ''', (customer_id,))
        for row in cursor.fetchall():
            record = SalesRecord(
                id=row['id'],
                receipt_no=row['receipt_no'],
                customer_id=row['customer_id'],
                sale_date=row['sale_date'],
                total_amount=row['total_amount'],
                items=[],
            )

            cursor.execute('''
                SELECT si.id, si.drug_id, si.quantity, si.unit_price, 
                       si.subtotal, si.dosage, si.dosage_unit, si.daily_frequency,
                       d.name as drug_name
                FROM sale_items si
                JOIN drugs d ON si.drug_id = d.id
                WHERE si.sales_record_id = ?
            ''', (row['id'],))
            for item_row in cursor.fetchall():
                record.items.append(SaleItem(
                    id=item_row['id'],
                    drug_id=item_row['drug_id'],
                    drug_name=item_row['drug_name'],
                    quantity=item_row['quantity'],
                    unit_price=item_row['unit_price'],
                    subtotal=item_row['subtotal'],
                    dosage=item_row['dosage'],
                    dosage_unit=item_row['dosage_unit'] or '',
                    daily_frequency=item_row['daily_frequency'],
                ))
            records.append(record)

    return records


def mark_contacted(customer_code: str, contacted_by: str = '', status: str = '已联系', notes: str = '') -> bool:
    customer = get_customer_by_code(customer_code)
    if not customer:
        return False

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO contact_logs (customer_id, contact_date, contacted_by, status, notes)
            VALUES (?, DATE('now'), ?, ?, ?)
        ''', (customer.id, contacted_by, status, notes))
    return True


def get_contact_logs(customer_code: str) -> List[ContactLog]:
    customer = get_customer_by_code(customer_code)
    if not customer:
        return []

    logs: List[ContactLog] = []
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, customer_id, contact_date, contacted_by, status, notes
            FROM contact_logs
            WHERE customer_id = ?
            ORDER BY contact_date DESC
        ''', (customer.id,))
        for row in cursor.fetchall():
            logs.append(ContactLog(
                id=row['id'],
                customer_id=row['customer_id'],
                contact_date=row['contact_date'],
                contacted_by=row['contacted_by'] or '',
                status=row['status'] or '',
                notes=row['notes'] or '',
            ))
    return logs
