from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import math
import re


class TaxCalculator:
    VALID_TAX_RATES = [0, 0.03, 0.06, 0.09, 0.13, 0.16, 0.17]
    
    def __init__(self):
        self.warnings = []
        self.errors = []
    
    def _is_invalid_numeric(self, value: Any) -> bool:
        if value is None:
            return True
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return True
        return False
    
    def validate_tax_rate(self, tax_rate: Optional[float]) -> Dict[str, Any]:
        result = {
            'valid': False,
            'normalized': None,
            'warning': None,
            'error': None
        }
        
        if self._is_invalid_numeric(tax_rate):
            result['error'] = '税率缺失'
            return result
        
        if tax_rate > 1:
            tax_rate = tax_rate / 100
        
        if not (0 <= tax_rate <= 1):
            result['error'] = f'税率超出合理范围: {tax_rate}'
            return result
        
        closest_rate = min(self.VALID_TAX_RATES, key=lambda x: abs(x - tax_rate))
        if abs(tax_rate - closest_rate) > 0.001:
            result['warning'] = f'税率 {tax_rate:.2%} 非标准税率，接近标准税率 {closest_rate:.2%}'
        
        result['valid'] = True
        result['normalized'] = tax_rate
        return result
    
    def calculate_price_ex_tax(self, price: Optional[float], tax_rate: Optional[float]) -> Dict[str, Any]:
        result = {
            'price_ex_tax': None,
            'tax_amount': None,
            'error': None
        }
        
        if self._is_invalid_numeric(price):
            result['error'] = '报价缺失'
            return result
        
        if self._is_invalid_numeric(tax_rate):
            result['price_ex_tax'] = price
            result['tax_amount'] = 0
            result['warning'] = '税率缺失，默认按0计算'
            return result
        
        if tax_rate > 1:
            tax_rate = tax_rate / 100
        
        try:
            price_ex_tax = price / (1 + tax_rate)
            tax_amount = price - price_ex_tax
            result['price_ex_tax'] = round(price_ex_tax, 4)
            result['tax_amount'] = round(tax_amount, 4)
        except Exception as e:
            result['error'] = f'计算失败: {str(e)}'
        
        return result
    
    def validate_price(self, price: Optional[float]) -> Dict[str, Any]:
        result = {
            'valid': False,
            'normalized': None,
            'error': None
        }
        
        if self._is_invalid_numeric(price):
            result['error'] = '报价缺失'
            return result
        
        if price < 0:
            result['error'] = f'报价为负数: {price}'
            return result
        
        if price == 0:
            result['warning'] = '报价为0，请确认是否为免费样品'
        
        result['valid'] = True
        result['normalized'] = price
        return result
    
    def process_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        processed = record.copy()
        
        price_validation = self.validate_price(record.get('报价'))
        if price_validation.get('error'):
            self.errors.append(f"行{record.get('原始行号', '?')}: {price_validation['error']}")
        if price_validation.get('warning'):
            self.warnings.append(f"行{record.get('原始行号', '?')}: {price_validation['warning']}")
        
        tax_validation = self.validate_tax_rate(record.get('税率'))
        if tax_validation.get('error'):
            self.errors.append(f"行{record.get('原始行号', '?')}: {tax_validation['error']}")
        if tax_validation.get('warning'):
            self.warnings.append(f"行{record.get('原始行号', '?')}: {tax_validation['warning']}")
        
        price_calc = None
        if price_validation.get('valid', False):
            price_calc = self.calculate_price_ex_tax(
                record.get('报价'),
                tax_validation.get('normalized')
            )
            if price_calc.get('error'):
                self.errors.append(f"行{record.get('原始行号', '?')}: {price_calc['error']}")
            if price_calc.get('warning'):
                self.warnings.append(f"行{record.get('原始行号', '?')}: {price_calc['warning']}")
        
        processed['不含税价'] = price_calc.get('price_ex_tax') if price_calc else None
        processed['税额'] = price_calc.get('tax_amount') if price_calc else None
        processed['税率_标准化'] = tax_validation.get('normalized')
        processed['报价_有效'] = price_validation.get('valid', False)
        processed['税率_有效'] = tax_validation.get('valid', False)
        
        return processed
    
    def batch_process(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        processed_records = []
        valid_count = 0
        
        for record in records:
            processed = self.process_record(record)
            processed_records.append(processed)
            if processed.get('报价_有效') and processed.get('税率_有效'):
                valid_count += 1
        
        return {
            'records': processed_records,
            'total_count': len(records),
            'valid_count': valid_count,
            'invalid_count': len(records) - valid_count,
            'warnings': self.warnings,
            'errors': self.errors,
        }
