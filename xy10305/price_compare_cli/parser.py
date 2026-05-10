import os
import re
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd

from .models import Item, Package, SupplierQuote, WarningType


COLUMN_MAPPINGS = {
    'sku': ['sku', '货号', '商品编码', '编号', 'item_code', 'product_code'],
    'name': ['名称', '商品名称', '品名', 'product_name', 'name', 'description'],
    'quantity': ['数量', '采购量', 'qty', 'quantity', 'number'],
    'unit': ['单位', '计量单位', 'unit', 'uom'],
    'unit_price': ['单价', '价格', 'unit_price', 'price', '单价(元)'],
    'subtotal': ['小计', '金额', '金额(元)', 'subtotal', 'amount', 'line_total'],
    'tax_rate': ['税率', '增值税率', 'tax_rate', 'vat_rate', 'tax'],
    'tax_amount': ['税额', '税金', 'tax_amount', 'vat'],
    'total': ['价税合计', '总计', 'total', 'total_amount'],
    'is_gift': ['是否赠品', '赠品', 'gift', 'free', '备注'],
    'is_package': ['是否套餐', '套餐', 'package', 'bundle', '组合'],
    'package_content': ['套餐内容', '包含', 'package_items', 'content'],
}

PACKAGE_PATTERNS = [
    r'套餐', r'组合', r'套装', r'bundle', r'package', r'套装',
]

GIFT_PATTERNS = [
    r'赠品', r'赠送', r'免费', r'0元', r'价格.*0', r'单价.*0',
    r'\b免费\b', r'\b赠送\b', r'\bgift\b', r'\bfree\b',
]

GIFT_PRICE_THRESHOLD = 0.01


def normalize_column_name(col: str) -> str:
    return str(col).strip().lower().replace(' ', '_').replace('（', '(').replace('）', ')')


def find_column(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    norm_cols = {normalize_column_name(c): c for c in df.columns}
    for alias in aliases:
        norm_alias = normalize_column_name(alias)
        if norm_alias in norm_cols:
            return norm_cols[norm_alias]
        for nc, original in norm_cols.items():
            if norm_alias in nc or nc in norm_alias:
                return original
    return None


def parse_number(value: Any) -> float:
    if pd.isna(value) or value is None:
        return 0.0
    s = str(value).strip()
    if not s:
        return 0.0
    s = s.replace(',', '').replace('，', '').replace('¥', '').replace('￥', '').replace('元', '')
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_tax_rate(value: Any) -> Optional[float]:
    if pd.isna(value) or value is None:
        return None
    s = str(value).strip()
    if not s or s in ['-', '无', '未知']:
        return None
    if '%' in s:
        s = s.replace('%', '').strip()
    try:
        rate = float(s)
        if rate <= 1 and rate > 0:
            return rate * 100
        return rate
    except ValueError:
        return None


def is_gift_row(row: pd.Series, col_map: Dict[str, str]) -> bool:
    if 'is_gift' in col_map and col_map['is_gift'] in row.index:
        val = str(row[col_map['is_gift']]).strip().lower()
        if any(g in val for g in ['是', '赠', '免费', 'gift', 'free', 'true', 'yes']):
            return True
    
    name = str(row.get(col_map.get('name', ''), '')).strip().lower()
    if any(re.search(p, name, re.IGNORECASE) for p in GIFT_PATTERNS):
        return True
    
    unit_price = parse_number(row.get(col_map.get('unit_price', '')))
    subtotal = parse_number(row.get(col_map.get('subtotal', '')))
    if unit_price < GIFT_PRICE_THRESHOLD and subtotal < GIFT_PRICE_THRESHOLD:
        return True
    
    return False


def is_package_row(row: pd.Series, col_map: Dict[str, str]) -> bool:
    if 'is_package' in col_map and col_map['is_package'] in row.index:
        val = str(row[col_map['is_package']]).strip().lower()
        if any(p in val for p in ['是', '套餐', '组合', 'bundle', 'package', 'true', 'yes']):
            return True
    
    name = str(row.get(col_map.get('name', ''), '')).strip().lower()
    if any(re.search(p, name, re.IGNORECASE) for p in PACKAGE_PATTERNS):
        return True
    
    return False


def build_column_map(df: pd.DataFrame) -> Dict[str, str]:
    col_map = {}
    for field, aliases in COLUMN_MAPPINGS.items():
        found = find_column(df, aliases)
        if found:
            col_map[field] = found
    return col_map


def extract_shipping_info(df: pd.DataFrame, col_map: Dict[str, str]) -> Tuple[float, Optional[float]]:
    shipping_fee = 0.0
    shipping_tax_rate = None
    
    shipping_keywords = ['运费', '物流', '快递', '配送', 'shipping', 'delivery', 'freight']
    
    name_col = col_map.get('name')
    if name_col:
        for _, row in df.iterrows():
            name_val = str(row[name_col]).strip().lower()
            if any(kw in name_val for kw in shipping_keywords):
                shipping_fee = parse_number(row.get(col_map.get('unit_price', ''), 0)) or \
                               parse_number(row.get(col_map.get('subtotal', ''), 0))
                shipping_tax_rate = parse_tax_rate(row.get(col_map.get('tax_rate', '')))
                break
    
    return shipping_fee, shipping_tax_rate


def extract_supplier_and_date(file_path: str, df: pd.DataFrame) -> Tuple[str, Optional[datetime]]:
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    
    supplier_match = re.search(r'supplier[_-]?(.+?)(?:[_-]|$)', base_name, re.IGNORECASE)
    if supplier_match:
        supplier_name = supplier_match.group(1)
    else:
        date_pattern = r'(\d{4}[-_年]?\d{1,2}[-_月]?\d{1,2})'
        name_without_date = re.sub(date_pattern, '', base_name)
        parts = re.split(r'[_-]', name_without_date)
        parts = [p for p in parts if p and not p.isdigit()]
        supplier_name = parts[-1] if parts else base_name
    
    date_match = re.search(r'(\d{4}[-_年]?\d{1,2}[-_月]?\d{1,2})', base_name)
    quote_date = None
    if date_match:
        date_str = date_match.group(1).replace('_', '-').replace('年', '-').replace('月', '')
        try:
            quote_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            try:
                quote_date = datetime.strptime(date_str, '%Y%m%d')
            except ValueError:
                pass
    
    return supplier_name, quote_date


def parse_quote_file(file_path: str) -> SupplierQuote:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"报价文件不存在: {file_path}")
    
    ext = os.path.splitext(file_path)[1].lower()
    if ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path, dtype=str)
    elif ext == '.csv':
        df = pd.read_csv(file_path, dtype=str, encoding='utf-8-sig')
    else:
        raise ValueError(f"不支持的文件格式: {ext}，仅支持 CSV 和 Excel")
    
    with open(file_path, 'rb') as f:
        file_hash = hashlib.md5(f.read()).hexdigest()
    
    col_map = build_column_map(df)
    supplier_name, quote_date = extract_supplier_and_date(file_path, df)
    
    items: List[Item] = []
    packages: List[Package] = []
    shipping_fee, shipping_tax_rate = extract_shipping_info(df, col_map)
    
    shipping_keywords = ['运费', '物流', '快递', '配送', 'shipping', 'delivery', 'freight']
    name_col = col_map.get('name', '')
    
    for idx, row in df.iterrows():
        name_val = str(row.get(name_col, '')).strip().lower()
        if any(kw in name_val for kw in shipping_keywords):
            continue
        
        is_gift = is_gift_row(row, col_map)
        is_pkg = is_package_row(row, col_map)
        
        sku = str(row.get(col_map.get('sku', ''), '')).strip() or f"ITEM_{idx:04d}"
        name = str(row.get(col_map.get('name', ''), '')).strip() or "未命名商品"
        quantity = parse_number(row.get(col_map.get('quantity', ''))) or 1.0
        unit = str(row.get(col_map.get('unit', ''), '')).strip() or "个"
        tax_rate = parse_tax_rate(row.get(col_map.get('tax_rate', '')))
        
        warnings = []
        if tax_rate is None and not is_gift:
            warnings.append(WarningType.MISSING_TAX_RATE)
        
        if is_gift:
            unit_price = 0.0
            if tax_rate is None:
                warnings.append(WarningType.GIFT_NOT_CONVERTIBLE)
        else:
            unit_price = parse_number(row.get(col_map.get('unit_price', '')))
            subtotal = parse_number(row.get(col_map.get('subtotal', '')))
            if unit_price <= 0 and subtotal > 0 and quantity > 0:
                unit_price = subtotal / quantity
        
        original_line = {k: str(v) for k, v in row.to_dict().items()}
        
        if is_pkg:
            package = Package(
                sku=sku,
                name=name,
                quantity=quantity,
                unit=unit,
                package_price=unit_price,
                items=[],
                tax_rate=tax_rate,
                original_line=original_line,
                warnings=warnings if warnings else [],
            )
            if not package.items:
                package.warnings.append(WarningType.PACKAGE_UNKNOWN)
            packages.append(package)
        else:
            item = Item(
                sku=sku,
                name=name,
                quantity=quantity,
                unit=unit,
                unit_price=unit_price,
                tax_rate=tax_rate,
                is_gift=is_gift,
                original_line=original_line,
                warnings=warnings,
            )
            items.append(item)
    
    quote = SupplierQuote(
        supplier_name=supplier_name,
        quote_id=file_hash[:12],
        quote_date=quote_date,
        items=items,
        packages=packages,
        shipping_fee=shipping_fee,
        shipping_tax_rate=shipping_tax_rate,
        file_hash=file_hash,
    )
    
    return quote
