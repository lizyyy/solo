import re
from typing import Dict, Any, List, Optional, Tuple
from database import ProductManager


class ValidationError:
    def __init__(self, error_type: str, field_name: str, original_value: Any, 
                 error_message: str, fix_suggestion: str):
        self.error_type = error_type
        self.field_name = field_name
        self.original_value = original_value
        self.error_message = error_message
        self.fix_suggestion = fix_suggestion

    def to_dict(self) -> Dict[str, Any]:
        return {
            'error_type': self.error_type,
            'field_name': self.field_name,
            'original_value': str(self.original_value) if self.original_value is not None else '',
            'error_message': self.error_message,
            'fix_suggestion': self.fix_suggestion
        }


class FieldValidator:
    REQUIRED_FIELDS = ['product_code', 'product_name']
    
    PRICE_FIELDS = ['cost_price', 'sale_price']
    
    NUMERIC_FIELDS = ['stock_quantity']
    
    FIELD_MAPPING = {
        '商品编码': 'product_code',
        '商品代码': 'product_code',
        '商品编号': 'product_code',
        'product_code': 'product_code',
        'ProductCode': 'product_code',
        'sku': 'product_code',
        'SKU': 'product_code',
        
        '商品名称': 'product_name',
        '商品名': 'product_name',
        '品名': 'product_name',
        'product_name': 'product_name',
        'ProductName': 'product_name',
        'name': 'product_name',
        'Name': 'product_name',
        
        '分类': 'category',
        '类别': 'category',
        '商品分类': 'category',
        'category': 'category',
        'Category': 'category',
        
        '成本价': 'cost_price',
        '进货价': 'cost_price',
        '成本价格': 'cost_price',
        'cost_price': 'cost_price',
        'CostPrice': 'cost_price',
        'cost': 'cost_price',
        'Cost': 'cost_price',
        
        '售价': 'sale_price',
        '销售价': 'sale_price',
        '零售价': 'sale_price',
        'sale_price': 'sale_price',
        'SalePrice': 'sale_price',
        'price': 'sale_price',
        'Price': 'sale_price',
        
        '库存数量': 'stock_quantity',
        '库存': 'stock_quantity',
        '数量': 'stock_quantity',
        'stock_quantity': 'stock_quantity',
        'StockQuantity': 'stock_quantity',
        'stock': 'stock_quantity',
        'Stock': 'stock_quantity',
        'quantity': 'stock_quantity',
        'Quantity': 'stock_quantity',
        
        '单位': 'unit',
        '计量单位': 'unit',
        'unit': 'unit',
        'Unit': 'unit',
        
        '供应商': 'supplier',
        '供货商': 'supplier',
        'supplier': 'supplier',
        'Supplier': 'supplier'
    }

    @classmethod
    def normalize_fields(cls, row: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        for key, value in row.items():
            normalized_key = cls.FIELD_MAPPING.get(key.strip(), key.strip())
            normalized[normalized_key] = value
        return normalized

    @classmethod
    def validate_required_fields(cls, row: Dict[str, Any]) -> List[ValidationError]:
        errors = []
        for field in cls.REQUIRED_FIELDS:
            value = row.get(field)
            if value is None or str(value).strip() == '':
                original_field_name = cls._get_original_field_name(field)
                errors.append(ValidationError(
                    error_type='required_missing',
                    field_name=original_field_name,
                    original_value='',
                    error_message=f'必填字段 "{original_field_name}" 缺失或为空',
                    fix_suggestion=f'请补充 "{original_field_name}" 的值，商品编码和商品名称是导入必需的字段'
                ))
        return errors

    @classmethod
    def _get_original_field_name(cls, field: str) -> str:
        for original, normalized in cls.FIELD_MAPPING.items():
            if normalized == field:
                return original
        return field

    @classmethod
    def validate_price_format(cls, row: Dict[str, Any]) -> List[ValidationError]:
        errors = []
        
        for field in cls.PRICE_FIELDS:
            value = row.get(field)
            if value is not None and str(value).strip() != '':
                parsed_price = cls._parse_price(value)
                if parsed_price is None:
                    original_field_name = cls._get_original_field_name(field)
                    errors.append(ValidationError(
                        error_type='price_format_error',
                        field_name=original_field_name,
                        original_value=str(value),
                        error_message=f'价格格式错误: "{value}"',
                        fix_suggestion=f'请检查 "{original_field_name}" 格式，支持的格式包括：19.99、¥19.99、19元9角、19,99等，确保为有效的数字或货币格式'
                    ))
        
        return errors

    @classmethod
    def _parse_price(cls, value: Any) -> Optional[float]:
        if value is None:
            return None
        
        str_value = str(value).strip()
        if str_value == '':
            return None
        
        str_value = re.sub(r'[¥￥元$,\s]', '', str_value)
        str_value = str_value.replace('角', '').replace('分', '')
        
        try:
            return float(str_value)
        except ValueError:
            return None

    @classmethod
    def validate_numeric_fields(cls, row: Dict[str, Any]) -> List[ValidationError]:
        errors = []
        
        for field in cls.NUMERIC_FIELDS:
            value = row.get(field)
            if value is not None and str(value).strip() != '':
                parsed_num = cls._parse_integer(value)
                if parsed_num is None:
                    original_field_name = cls._get_original_field_name(field)
                    errors.append(ValidationError(
                        error_type='numeric_format_error',
                        field_name=original_field_name,
                        original_value=str(value),
                        error_message=f'数字格式错误: "{value}"',
                        fix_suggestion=f'请检查 "{original_field_name}" 格式，库存数量必须为有效的整数，例如：100、50等'
                    ))
        
        return errors

    @classmethod
    def _parse_integer(cls, value: Any) -> Optional[int]:
        if value is None:
            return None
        
        str_value = str(value).strip()
        if str_value == '':
            return None
        
        try:
            return int(float(str_value.replace(',', '')))
        except (ValueError, TypeError):
            return None

    @classmethod
    def validate_duplicate_product_code(cls, row: Dict[str, Any], existing_codes: set = None) -> List[ValidationError]:
        errors = []
        product_code = row.get('product_code')
        
        if product_code and str(product_code).strip() != '':
            product_code_str = str(product_code).strip()
            
            if existing_codes and product_code_str in existing_codes:
                original_field_name = cls._get_original_field_name('product_code')
                errors.append(ValidationError(
                    error_type='duplicate_in_file',
                    field_name=original_field_name,
                    original_value=product_code_str,
                    error_message=f'商品编码在导入文件中重复: "{product_code_str}"',
                    fix_suggestion='请检查导入文件，确保每个商品编码唯一，或修改重复的商品编码'
                ))
            
            if ProductManager.product_exists(product_code_str):
                original_field_name = cls._get_original_field_name('product_code')
                errors.append(ValidationError(
                    error_type='duplicate_in_database',
                    field_name=original_field_name,
                    original_value=product_code_str,
                    error_message=f'商品编码已存在于数据库中: "{product_code_str}"',
                    fix_suggestion='该商品编码已存在于系统中。您可以选择：1) 修改文件中的商品编码；2) 如果需要更新已有商品，请使用更新功能'
                ))
        
        return errors

    @classmethod
    def parse_row(cls, row: Dict[str, Any]) -> Dict[str, Any]:
        normalized = cls.normalize_fields(row)
        parsed = {}
        
        for key, value in normalized.items():
            if key in cls.PRICE_FIELDS and value is not None:
                parsed[key] = cls._parse_price(value)
            elif key in cls.NUMERIC_FIELDS and value is not None:
                parsed[key] = cls._parse_integer(value)
            elif value is not None:
                parsed[key] = str(value).strip()
            else:
                parsed[key] = None
        
        if 'product_code' in parsed and parsed['product_code']:
            parsed['product_code'] = parsed['product_code'].strip()
        
        return parsed

    @classmethod
    def validate_row(cls, row: Dict[str, Any], existing_codes_in_file: set = None, 
                     check_db_duplicate: bool = True) -> Tuple[bool, List[ValidationError]]:
        all_errors = []
        
        normalized = cls.normalize_fields(row)
        
        all_errors.extend(cls.validate_required_fields(normalized))
        
        all_errors.extend(cls.validate_price_format(normalized))
        
        all_errors.extend(cls.validate_numeric_fields(normalized))
        
        if check_db_duplicate:
            all_errors.extend(cls.validate_duplicate_product_code(normalized, existing_codes_in_file))
        
        return len(all_errors) == 0, all_errors
