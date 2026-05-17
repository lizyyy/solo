from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import re


class DeliverySorter:
    REQUIRED_FIELDS = ['供应商', '报价', '税率', '交期', '采购品类']
    
    def __init__(self):
        self.warnings = []
        self.errors = []
    
    def parse_delivery(self, delivery_str: Optional[str]) -> Dict[str, Any]:
        result = {
            'valid': False,
            'sort_key': None,
            'normalized': None,
            'days': None,
            'error': None
        }
        
        if delivery_str is None:
            result['error'] = '交期缺失'
            result['sort_key'] = 99999
            return result
        
        delivery_str = str(delivery_str).strip()
        
        days_match = re.match(r'_(\d+)days', delivery_str)
        if days_match:
            days = int(days_match.group(1))
            result['valid'] = True
            result['sort_key'] = days
            result['normalized'] = f"{days}天"
            result['days'] = days
            return result
        
        date_patterns = [
            r'(\d{4}-\d{2}-\d{2})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, delivery_str)
            if match:
                try:
                    date_obj = datetime.strptime(match.group(1), '%Y-%m-%d')
                    days = (date_obj - datetime.now()).days
                    result['valid'] = True
                    result['sort_key'] = days if days >= 0 else 99999
                    result['normalized'] = date_obj.strftime('%Y-%m-%d')
                    result['days'] = days
                    return result
                except:
                    pass
        
        days_match = re.search(r'(\d+)\s*(天|日)', delivery_str)
        if days_match:
            days = int(days_match.group(1))
            result['valid'] = True
            result['sort_key'] = days
            result['normalized'] = f"{days}天"
            result['days'] = days
            return result
        
        result['error'] = f'无法解析交期: {delivery_str}'
        result['sort_key'] = 99999
        return result
    
    def check_missing_fields(self, record: Dict[str, Any]) -> List[str]:
        missing = []
        for field in self.REQUIRED_FIELDS:
            value = record.get(field)
            if value is None or (isinstance(value, str) and value.strip() == '') or value == 'nan':
                missing.append(field)
        return missing
    
    def detect_conflicts(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        
        supplier_groups = {}
        for record in records:
            supplier = record.get('供应商')
            category = record.get('采购品类')
            key = (supplier, category)
            if key not in supplier_groups:
                supplier_groups[key] = []
            supplier_groups[key].append(record)
        
        for (supplier, category), group in supplier_groups.items():
            if len(group) > 1 and supplier and category:
                conflicts.append({
                    'type': '同一供应商同一品类多次报价',
                    'supplier': supplier,
                    'category': category,
                    'count': len(group),
                    'rows': [r.get('原始行号') for r in group]
                })
        
        if len(records) >= 2:
            price_valid = [r for r in records if r.get('不含税价') and r.get('不含税价') > 0]
            if len(price_valid) >= 2:
                min_price = min(r['不含税价'] for r in price_valid)
                max_price = max(r['不含税价'] for r in price_valid)
                if max_price > min_price * 3:
                    conflicts.append({
                        'type': '报价差异过大(>3倍)',
                        'min_price': min_price,
                        'max_price': max_price,
                        'ratio': round(max_price / min_price, 2)
                    })
        
        return conflicts
    
    def sort_by_delivery(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        parsed_records = []
        
        for record in records:
            delivery_info = self.parse_delivery(record.get('交期'))
            if delivery_info.get('error'):
                self.warnings.append(f"行{record.get('原始行号', '?')}: {delivery_info['error']}")
            
            parsed = record.copy()
            parsed['交期_排序键'] = delivery_info.get('sort_key', 99999)
            parsed['交期_标准化'] = delivery_info.get('normalized')
            parsed['交期_天数'] = delivery_info.get('days')
            parsed['交期_有效'] = delivery_info.get('valid', False)
            parsed['缺项列表'] = self.check_missing_fields(record)
            
            if parsed['缺项列表']:
                self.errors.append(f"行{record.get('原始行号', '?')}: 缺少必填字段: {', '.join(parsed['缺项列表'])}")
            
            parsed_records.append(parsed)
        
        sorted_records = sorted(parsed_records, key=lambda x: x['交期_排序键'])
        return sorted_records
    
    def process(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        sorted_records = self.sort_by_delivery(records)
        conflicts = self.detect_conflicts(sorted_records)
        
        missing_summary = {}
        for record in sorted_records:
            for field in record.get('缺项列表', []):
                missing_summary[field] = missing_summary.get(field, 0) + 1
        
        return {
            'sorted_records': sorted_records,
            'conflicts': conflicts,
            'missing_summary': missing_summary,
            'warnings': self.warnings,
            'errors': self.errors,
        }
