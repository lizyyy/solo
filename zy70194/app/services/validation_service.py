from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

class ValidationError(Exception):
    def __init__(self, field: str, message: str, code: str = None):
        self.field = field
        self.message = message
        self.code = code or 'validation_error'
        super().__init__(message)

class ValidationResult:
    def __init__(self):
        self.valid = True
        self.errors: List[ValidationError] = []
    
    def add_error(self, field: str, message: str, code: str = None):
        self.valid = False
        self.errors.append(ValidationError(field, message, code))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'valid': self.valid,
            'errors': [
                {
                    'field': e.field,
                    'message': e.message,
                    'code': e.code
                }
                for e in self.errors
            ]
        }

class ValidationService:
    @staticmethod
    def validate_required_fields(data: Dict[str, Any], required_fields: List[str]) -> ValidationResult:
        result = ValidationResult()
        for field in required_fields:
            if field not in data or data[field] is None or (isinstance(data[field], str) and not data[field].strip()):
                result.add_error(field, f'{field} 为必填项', 'required_field_missing')
        return result
    
    @staticmethod
    def validate_date_range(start_date: Optional[datetime], end_date: Optional[datetime], 
                          start_field: str = 'start_date', end_field: str = 'end_date') -> ValidationResult:
        result = ValidationResult()
        if start_date and end_date and start_date >= end_date:
            result.add_error(end_field, f'{end_field} 必须大于 {start_field}', 'invalid_date_range')
        return result
    
    @staticmethod
    def validate_positive_number(value: Any, field: str) -> ValidationResult:
        result = ValidationResult()
        try:
            num = float(value)
            if num <= 0:
                result.add_error(field, f'{field} 必须大于 0', 'non_positive_number')
        except (TypeError, ValueError):
            result.add_error(field, f'{field} 必须是有效的数字', 'invalid_number')
        return result
    
    @staticmethod
    def validate_percentage(value: Any, field: str) -> ValidationResult:
        result = ValidationResult()
        try:
            num = float(value)
            if num < 0 or num > 1:
                result.add_error(field, f'{field} 必须在 0 到 1 之间', 'invalid_percentage')
        except (TypeError, ValueError):
            result.add_error(field, f'{field} 必须是有效的数字', 'invalid_number')
        return result
    
    @staticmethod
    def validate_inquiry(data: Dict[str, Any]) -> ValidationResult:
        result = ValidationResult()
        
        required_fields = ['title', 'created_by', 'quote_deadline']
        field_result = ValidationService.validate_required_fields(data, required_fields)
        if not field_result.valid:
            result.errors.extend(field_result.errors)
            result.valid = False
        
        if 'quote_deadline' in data and data['quote_deadline']:
            try:
                deadline = datetime.fromisoformat(str(data['quote_deadline']).replace('Z', '+00:00'))
                if deadline <= datetime.utcnow():
                    result.add_error('quote_deadline', '报价截止时间必须大于当前时间', 'invalid_deadline')
            except (ValueError, TypeError):
                result.add_error('quote_deadline', '报价截止时间格式无效', 'invalid_date_format')
        
        if 'required_items' in data:
            if not isinstance(data['required_items'], list):
                result.add_error('required_items', 'required_items 必须是数组', 'invalid_type')
            else:
                for idx, item in enumerate(data['required_items']):
                    if not isinstance(item, dict):
                        result.add_error(f'required_items[{idx}]', '每个采购项必须是对象', 'invalid_type')
                        continue
                    
                    if 'item_name' not in item or not item['item_name']:
                        result.add_error(f'required_items[{idx}].item_name', f'第{idx+1}个采购项名称为必填', 'required_field_missing')
                    
                    if 'quantity' in item:
                        qty_result = ValidationService.validate_positive_number(item['quantity'], f'required_items[{idx}].quantity')
                        if not qty_result.valid:
                            result.errors.extend(qty_result.errors)
                            result.valid = False
        
        return result
    
    @staticmethod
    def validate_quote(data: Dict[str, Any]) -> ValidationResult:
        result = ValidationResult()
        
        required_fields = ['inquiry_id', 'vendor_id', 'vendor_name', 'valid_until', 'created_by']
        field_result = ValidationService.validate_required_fields(data, required_fields)
        if not field_result.valid:
            result.errors.extend(field_result.errors)
            result.valid = False
        
        if 'tax_rate' in data and data['tax_rate'] is not None:
            tax_result = ValidationService.validate_percentage(data['tax_rate'], 'tax_rate')
            if not tax_result.valid:
                result.errors.extend(tax_result.errors)
                result.valid = False
        
        if 'valid_from' in data and 'valid_until' in data and data['valid_from'] and data['valid_until']:
            try:
                valid_from = datetime.fromisoformat(str(data['valid_from']).replace('Z', '+00:00'))
                valid_until = datetime.fromisoformat(str(data['valid_until']).replace('Z', '+00:00'))
                date_result = ValidationService.validate_date_range(valid_from, valid_until, 'valid_from', 'valid_until')
                if not date_result.valid:
                    result.errors.extend(date_result.errors)
                    result.valid = False
            except (ValueError, TypeError):
                pass
        
        if 'total_freight' in data and data['total_freight'] is not None:
            try:
                freight = float(data['total_freight'])
                if freight < 0:
                    result.add_error('total_freight', '运费不能为负数', 'negative_value')
            except (TypeError, ValueError):
                result.add_error('total_freight', '运费必须是有效的数字', 'invalid_number')
        
        return result
    
    @staticmethod
    def validate_quote_item(data: Dict[str, Any], item_idx: int = 0) -> ValidationResult:
        result = ValidationResult()
        prefix = f'items[{item_idx}]'
        
        required_fields = ['item_name', 'unit', 'quantity', 'unit_price_excl_tax']
        for field in required_fields:
            if field not in data or data[field] is None or (isinstance(data[field], str) and not data[field].strip()):
                result.add_error(f'{prefix}.{field}', f'第{item_idx+1}个报价项{field}为必填', 'required_field_missing')
        
        qty_result = ValidationService.validate_positive_number(data.get('quantity'), f'{prefix}.quantity')
        if not qty_result.valid:
            result.errors.extend(qty_result.errors)
            result.valid = False
        
        price_result = ValidationService.validate_positive_number(data.get('unit_price_excl_tax'), f'{prefix}.unit_price_excl_tax')
        if not price_result.valid:
            result.errors.extend(price_result.errors)
            result.valid = False
        
        if 'tax_rate' in data and data['tax_rate'] is not None:
            tax_result = ValidationService.validate_percentage(data['tax_rate'], f'{prefix}.tax_rate')
            if not tax_result.valid:
                result.errors.extend(tax_result.errors)
                result.valid = False
        
        if 'freight_per_unit' in data and data['freight_per_unit'] is not None:
            try:
                freight = float(data['freight_per_unit'])
                if freight < 0:
                    result.add_error(f'{prefix}.freight_per_unit', '单位运费不能为负数', 'negative_value')
            except (TypeError, ValueError):
                result.add_error(f'{prefix}.freight_per_unit', '单位运费必须是有效的数字', 'invalid_number')
        
        return result
