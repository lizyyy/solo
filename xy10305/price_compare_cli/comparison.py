from typing import Dict, List, Tuple, Optional, Set
from collections import defaultdict
from dataclasses import dataclass, field
from .models import Item, Package, SupplierQuote, WarningType


UNIT_ALIASES = {
    '个': ['个', 'pcs', 'pc', 'piece', '件', '只'],
    '箱': ['箱', 'box', 'case', 'ctn', 'carton'],
    '盒': ['盒', '盒', 'pack', 'pkg'],
    '包': ['包', 'bag', 'bottle'],
    '本': ['本', 'book', 'notebook'],
    '支': ['支', '支', 'stick'],
    '卷': ['卷', 'roll', 'reel'],
    '瓶': ['瓶', 'bottle'],
    '袋': ['袋', 'bag'],
    '套': ['套', 'set', 'kit'],
}

NORMALIZE_MAP = {}
for canonical, aliases in UNIT_ALIASES.items():
    for alias in aliases:
        NORMALIZE_MAP[alias.lower()] = canonical


def normalize_unit(unit: str) -> str:
    key = str(unit).strip().lower()
    return NORMALIZE_MAP.get(key, str(unit).strip())


def match_product(item1: Item, item2: Item) -> float:
    if item1.sku and item2.sku and item1.sku.lower() == item2.sku.lower():
        return 1.0
    
    name1 = item1.name.lower()
    name2 = item2.name.lower()
    
    if name1 == name2:
        return 0.95
    
    words1 = set(name1.split())
    words2 = set(name2.split())
    if words1 and words2:
        common = words1.intersection(words2)
        union = words1.union(words2)
        if union:
            return len(common) / len(union) * 0.8
    
    return 0.0


@dataclass
class NormalizedProduct:
    product_key: str
    name: str
    sku: str
    normalized_unit: str
    
    supplier_quotations: Dict[str, Dict] = field(default_factory=dict)
    
    best_supplier: Optional[str] = None
    best_unit_price_tax_incl: Optional[float] = None
    
    all_same_unit: bool = True
    unit_mismatch_suppliers: List[str] = field(default_factory=list)
    
    def add_quotation(self, supplier_name: str, item: Item):
        unit_norm = normalize_unit(item.unit)
        
        if self.normalized_unit and unit_norm != self.normalized_unit:
            self.all_same_unit = False
            self.unit_mismatch_suppliers.append(supplier_name)
        
        if not self.normalized_unit:
            self.normalized_unit = unit_norm
        
        tax_rate = item.tax_rate if item.tax_rate is not None else 0.0
        unit_price_tax_incl = item.unit_price * (1 + tax_rate / 100)
        
        self.supplier_quotations[supplier_name] = {
            'item': item,
            'quantity': item.quantity,
            'unit': item.unit,
            'unit_price': item.unit_price,
            'tax_rate': item.tax_rate,
            'unit_price_tax_incl': unit_price_tax_incl,
            'is_gift': item.is_gift,
            'warnings': [w.value for w in item.warnings],
        }
    
    def calculate_best(self):
        valid_prices = []
        for supplier, data in self.supplier_quotations.items():
            if not data['is_gift'] and data['unit_price'] > 0:
                valid_prices.append((supplier, data['unit_price_tax_incl']))
        
        if valid_prices:
            valid_prices.sort(key=lambda x: x[1])
            self.best_supplier = valid_prices[0][0]
            self.best_unit_price_tax_incl = valid_prices[0][1]


@dataclass
class ComparisonResult:
    products: Dict[str, NormalizedProduct] = field(default_factory=dict)
    supplier_totals: Dict[str, Dict] = field(default_factory=dict)
    unmatched_items: Dict[str, List[Item]] = field(default_factory=lambda: defaultdict(list))
    warnings: List[str] = field(default_factory=list)
    
    @property
    def products_with_issues(self) -> List[NormalizedProduct]:
        return [p for p in self.products.values() if not p.all_same_unit]


def normalize_quotes(quotes: List[SupplierQuote]) -> ComparisonResult:
    result = ComparisonResult()
    product_map: Dict[str, NormalizedProduct] = {}
    sku_to_product: Dict[str, str] = {}
    
    for quote in quotes:
        result.supplier_totals[quote.supplier_name] = {
            'items_subtotal': quote.items_subtotal,
            'items_tax': quote.items_tax,
            'shipping_fee': quote.shipping_fee,
            'shipping_tax': quote.shipping_tax,
            'grand_total': quote.grand_total,
            'quote_id': quote.quote_id,
            'quote_date': quote.quote_date,
            'warnings': quote.all_warnings,
        }
        
        for item in quote.items:
            if item.is_gift:
                result.warnings.append(
                    f"[{quote.supplier_name}] 赠品: {item.name} (SKU: {item.sku}) - {WarningType.GIFT_NOT_CONVERTIBLE.value}"
                )
                continue
            
            product_key = None
            
            if item.sku:
                for existing_key, prod in product_map.items():
                    if prod.sku and prod.sku.lower() == item.sku.lower():
                        product_key = existing_key
                        break
            
            if not product_key:
                for existing_key, prod in product_map.items():
                    score = match_product(item, Item(
                        sku=prod.sku, name=prod.name, quantity=1, unit='', unit_price=0
                    ))
                    if score > 0.7:
                        product_key = existing_key
                        break
            
            if not product_key:
                product_key = item.sku if item.sku else f"PROD_{len(product_map) + 1:04d}"
                product_map[product_key] = NormalizedProduct(
                    product_key=product_key,
                    name=item.name,
                    sku=item.sku,
                    normalized_unit=normalize_unit(item.unit),
                )
            
            product_map[product_key].add_quotation(quote.supplier_name, item)
        
        for pkg in quote.packages:
            result.warnings.append(
                f"[{quote.supplier_name}] 套餐包: {pkg.name} (SKU: {pkg.sku}) - {WarningType.PACKAGE_UNKNOWN.value}"
            )
    
    for product in product_map.values():
        product.calculate_best()
        if not product.all_same_unit:
            for supplier in product.unit_mismatch_suppliers:
                result.warnings.append(
                    f"[单位不一致] {product.name}: {supplier} 使用 {product.supplier_quotations[supplier]['unit']}"
                )
    
    result.products = product_map
    return result


def generate_comparison_summary(result: ComparisonResult) -> Dict:
    total_products = len(result.products)
    products_with_multiple_quotes = sum(
        1 for p in result.products.values() if len(p.supplier_quotations) > 1
    )
    
    savings = 0.0
    potential_savings_products = 0
    
    for product in result.products.values():
        if len(product.supplier_quotations) > 1 and product.best_unit_price_tax_incl is not None:
            for supplier, data in product.supplier_quotations.items():
                if supplier != product.best_supplier:
                    if data['unit_price_tax_incl'] > product.best_unit_price_tax_incl:
                        diff = (data['unit_price_tax_incl'] - product.best_unit_price_tax_incl) * data['quantity']
                        savings += diff
                        potential_savings_products += 1
    
    return {
        'total_products': total_products,
        'products_with_multiple_quotes': products_with_multiple_quotes,
        'products_with_unit_issues': len(result.products_with_issues),
        'total_warnings': len(result.warnings),
        'estimated_savings': savings,
        'potential_savings_products': potential_savings_products,
    }
