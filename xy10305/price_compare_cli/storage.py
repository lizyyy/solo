import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from .models import SupplierQuote, Item, Package, Correction, WarningType


STORAGE_FILE = ".price_compare_db.json"


def _serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _deserialize_datetime(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _serialize_warning_types(warnings: List[WarningType]) -> List[str]:
    return [w.value for w in warnings]


def _deserialize_warning_types(warnings: List[str]) -> List[WarningType]:
    result = []
    for w in warnings:
        for wt in WarningType:
            if wt.value == w:
                result.append(wt)
                break
    return result


def _serialize_item(item: Item) -> Dict:
    return {
        'sku': item.sku,
        'name': item.name,
        'quantity': item.quantity,
        'unit': item.unit,
        'unit_price': item.unit_price,
        'tax_rate': item.tax_rate,
        'is_gift': item.is_gift,
        'is_package_item': item.is_package_item,
        'original_line': item.original_line,
        'warnings': _serialize_warning_types(item.warnings),
    }


def _deserialize_item(data: Dict) -> Item:
    return Item(
        sku=data['sku'],
        name=data['name'],
        quantity=data['quantity'],
        unit=data['unit'],
        unit_price=data['unit_price'],
        tax_rate=data.get('tax_rate'),
        is_gift=data.get('is_gift', False),
        is_package_item=data.get('is_package_item', False),
        original_line=data.get('original_line', {}),
        warnings=_deserialize_warning_types(data.get('warnings', [])),
    )


def _serialize_package(pkg: Package) -> Dict:
    return {
        'sku': pkg.sku,
        'name': pkg.name,
        'quantity': pkg.quantity,
        'unit': pkg.unit,
        'package_price': pkg.package_price,
        'items': [_serialize_item(i) for i in pkg.items],
        'tax_rate': pkg.tax_rate,
        'original_line': pkg.original_line,
        'warnings': _serialize_warning_types(pkg.warnings),
    }


def _deserialize_package(data: Dict) -> Package:
    return Package(
        sku=data['sku'],
        name=data['name'],
        quantity=data['quantity'],
        unit=data['unit'],
        package_price=data['package_price'],
        items=[_deserialize_item(i) for i in data.get('items', [])],
        tax_rate=data.get('tax_rate'),
        original_line=data.get('original_line', {}),
        warnings=_deserialize_warning_types(data.get('warnings', [])),
    )


def _serialize_correction(corr: Correction) -> Dict:
    return {
        'timestamp': _serialize_datetime(corr.timestamp),
        'field': corr.field,
        'old_value': corr.old_value,
        'new_value': corr.new_value,
        'reason': corr.reason,
    }


def _deserialize_correction(data: Dict) -> Correction:
    return Correction(
        timestamp=_deserialize_datetime(data['timestamp']),
        field=data['field'],
        old_value=data['old_value'],
        new_value=data['new_value'],
        reason=data['reason'],
    )


def _serialize_quote(quote: SupplierQuote) -> Dict:
    return {
        'supplier_name': quote.supplier_name,
        'quote_id': quote.quote_id,
        'quote_date': _serialize_datetime(quote.quote_date),
        'items': [_serialize_item(i) for i in quote.items],
        'packages': [_serialize_package(p) for p in quote.packages],
        'shipping_fee': quote.shipping_fee,
        'shipping_tax_rate': quote.shipping_tax_rate,
        'corrections': [_serialize_correction(c) for c in quote.corrections],
        'file_hash': quote.file_hash,
    }


def _deserialize_quote(data: Dict) -> SupplierQuote:
    return SupplierQuote(
        supplier_name=data['supplier_name'],
        quote_id=data['quote_id'],
        quote_date=_deserialize_datetime(data.get('quote_date')),
        items=[_deserialize_item(i) for i in data.get('items', [])],
        packages=[_deserialize_package(p) for p in data.get('packages', [])],
        shipping_fee=data.get('shipping_fee', 0.0),
        shipping_tax_rate=data.get('shipping_tax_rate'),
        corrections=[_deserialize_correction(c) for c in data.get('corrections', [])],
        file_hash=data.get('file_hash', ''),
    )


def load_database(storage_path: Optional[str] = None) -> Dict:
    path = Path(storage_path) if storage_path else Path(STORAGE_FILE)
    if not path.exists():
        return {
            'quotes': [],
            'metadata': {
                'created_at': _serialize_datetime(datetime.now()),
                'updated_at': _serialize_datetime(datetime.now()),
                'version': '1.0',
            }
        }
    
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data


def save_database(db: Dict, storage_path: Optional[str] = None):
    path = Path(storage_path) if storage_path else Path(STORAGE_FILE)
    db['metadata']['updated_at'] = _serialize_datetime(datetime.now())
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def load_all_quotes(storage_path: Optional[str] = None) -> List[SupplierQuote]:
    db = load_database(storage_path)
    return [_deserialize_quote(q) for q in db.get('quotes', [])]


def find_quote_by_hash(file_hash: str, storage_path: Optional[str] = None) -> Optional[SupplierQuote]:
    for quote in load_all_quotes(storage_path):
        if quote.file_hash == file_hash:
            return quote
    return None


def find_quote_by_supplier(supplier_name: str, storage_path: Optional[str] = None) -> Optional[SupplierQuote]:
    for quote in load_all_quotes(storage_path):
        if quote.supplier_name == supplier_name:
            return quote
    return None


def save_quote(quote: SupplierQuote, storage_path: Optional[str] = None) -> bool:
    db = load_database(storage_path)
    
    existing_idx = None
    for idx, q_data in enumerate(db.get('quotes', [])):
        if q_data.get('file_hash') == quote.file_hash:
            existing_idx = idx
            break
    
    quote_data = _serialize_quote(quote)
    
    if existing_idx is not None:
        db['quotes'][existing_idx] = quote_data
    else:
        db.setdefault('quotes', []).append(quote_data)
    
    save_database(db, storage_path)
    return existing_idx is None


def update_quote(quote: SupplierQuote, storage_path: Optional[str] = None):
    save_quote(quote, storage_path)


def delete_quote(supplier_name: str, storage_path: Optional[str] = None) -> bool:
    db = load_database(storage_path)
    
    original_count = len(db.get('quotes', []))
    db['quotes'] = [
        q for q in db.get('quotes', [])
        if q.get('supplier_name') != supplier_name
    ]
    
    if len(db['quotes']) < original_count:
        save_database(db, storage_path)
        return True
    return False


def add_correction(
    supplier_name: str,
    field: str,
    old_value: Any,
    new_value: Any,
    reason: str,
    storage_path: Optional[str] = None,
) -> bool:
    quote = find_quote_by_supplier(supplier_name, storage_path)
    if not quote:
        return False
    
    correction = Correction(
        timestamp=datetime.now(),
        field=field,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
    )
    quote.corrections.append(correction)
    update_quote(quote, storage_path)
    return True


def get_correction_history(supplier_name: str, storage_path: Optional[str] = None) -> List[Correction]:
    quote = find_quote_by_supplier(supplier_name, storage_path)
    if not quote:
        return []
    return quote.corrections


def clear_database(storage_path: Optional[str] = None):
    db = {
        'quotes': [],
        'metadata': {
            'created_at': _serialize_datetime(datetime.now()),
            'updated_at': _serialize_datetime(datetime.now()),
            'version': '1.0',
        }
    }
    save_database(db, storage_path)
