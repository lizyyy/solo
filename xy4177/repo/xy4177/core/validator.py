# -*- coding: utf-8 -*-
"""
数据校验模块
"""

import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import Counter
from core.models import (
    SKUData, LabelTemplate, TemplateField, ValidationResult, ValidationError
)
from core.constants import (
    BarcodeType, ErrorLevel, BARCODE_MAX_LENGTH, BARCODE_REQUIRES_CHECKSUM
)


class BarcodeValidator:
    """条码校验器"""
    
    @staticmethod
    def validate_code128(value: str) -> Tuple[bool, List[str]]:
        """校验CODE128条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        if len(value) > BARCODE_MAX_LENGTH[BarcodeType.CODE128]:
            errors.append(f"条码内容超长（最大{BARCODE_MAX_LENGTH[BarcodeType.CODE128]}字符）")
        
        try:
            value.encode('ascii')
        except UnicodeEncodeError:
            errors.append("条码包含非ASCII字符")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_code39(value: str) -> Tuple[bool, List[str]]:
        """校验CODE39条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        if len(value) > BARCODE_MAX_LENGTH[BarcodeType.CODE39]:
            errors.append(f"条码内容超长（最大{BARCODE_MAX_LENGTH[BarcodeType.CODE39]}字符）")
        
        valid_chars = re.compile(r'^[A-Z0-9 .\-/$%+]*$')
        if not valid_chars.match(value):
            errors.append("CODE39条码包含非法字符（仅允许A-Z、0-9、空格、.-/$%+）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_ean13(value: str) -> Tuple[bool, List[str]]:
        """校验EAN-13条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        value = value.strip()
        
        if len(value) not in [12, 13]:
            errors.append(f"EAN-13条码必须为12或13位数字，当前为{len(value)}位")
            return False, errors
        
        if not value.isdigit():
            errors.append("EAN-13条码必须为纯数字")
            return False, errors
        
        if len(value) == 13:
            calculated_checksum = BarcodeValidator._calculate_ean_checksum(value[:12])
            if int(value[-1]) != calculated_checksum:
                errors.append(f"EAN-13校验码错误（应为{calculated_checksum}）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_ean8(value: str) -> Tuple[bool, List[str]]:
        """校验EAN-8条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        value = value.strip()
        
        if len(value) not in [7, 8]:
            errors.append(f"EAN-8条码必须为7或8位数字，当前为{len(value)}位")
            return False, errors
        
        if not value.isdigit():
            errors.append("EAN-8条码必须为纯数字")
            return False, errors
        
        if len(value) == 8:
            calculated_checksum = BarcodeValidator._calculate_ean_checksum(value[:7])
            if int(value[-1]) != calculated_checksum:
                errors.append(f"EAN-8校验码错误（应为{calculated_checksum}）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_upca(value: str) -> Tuple[bool, List[str]]:
        """校验UPC-A条码"""
        return BarcodeValidator.validate_ean13(value)
    
    @staticmethod
    def validate_upce(value: str) -> Tuple[bool, List[str]]:
        """校验UPC-E条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        value = value.strip()
        
        if len(value) not in [6, 7, 8]:
            errors.append(f"UPC-E条码必须为6、7或8位数字，当前为{len(value)}位")
            return False, errors
        
        if not value.isdigit():
            errors.append("UPC-E条码必须为纯数字")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_qrcode(value: str) -> Tuple[bool, List[str]]:
        """校验QR Code条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        if len(value) > BARCODE_MAX_LENGTH[BarcodeType.QRCODE]:
            errors.append(f"QR Code内容超长（最大{BARCODE_MAX_LENGTH[BarcodeType.QRCODE]}字符）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_datamatrix(value: str) -> Tuple[bool, List[str]]:
        """校验DataMatrix条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        if len(value) > BARCODE_MAX_LENGTH[BarcodeType.DATAMATRIX]:
            errors.append(f"DataMatrix内容超长（最大{BARCODE_MAX_LENGTH[BarcodeType.DATAMATRIX]}字符）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_pdf417(value: str) -> Tuple[bool, List[str]]:
        """校验PDF417条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        if len(value) > BARCODE_MAX_LENGTH[BarcodeType.PDF417]:
            errors.append(f"PDF417内容超长（最大{BARCODE_MAX_LENGTH[BarcodeType.PDF417]}字符）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def validate_itf14(value: str) -> Tuple[bool, List[str]]:
        """校验ITF-14条码"""
        errors = []
        if not value:
            return False, ["条码内容为空"]
        
        value = value.strip()
        
        if len(value) not in [13, 14]:
            errors.append(f"ITF-14条码必须为13或14位数字，当前为{len(value)}位")
            return False, errors
        
        if not value.isdigit():
            errors.append("ITF-14条码必须为纯数字")
            return False, errors
        
        if len(value) == 14:
            calculated_checksum = BarcodeValidator._calculate_ean_checksum(value[:13])
            if int(value[-1]) != calculated_checksum:
                errors.append(f"ITF-14校验码错误（应为{calculated_checksum}）")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def _calculate_ean_checksum(digits: str) -> int:
        """计算EAN校验码"""
        total = 0
        for i, digit in enumerate(reversed(digits)):
            if i % 2 == 0:
                total += int(digit) * 3
            else:
                total += int(digit)
        checksum = (10 - (total % 10)) % 10
        return checksum
    
    @staticmethod
    def validate(barcode_type: BarcodeType, value: str) -> Tuple[bool, List[str]]:
        """根据条码类型校验"""
        validators = {
            BarcodeType.CODE128: BarcodeValidator.validate_code128,
            BarcodeType.CODE39: BarcodeValidator.validate_code39,
            BarcodeType.EAN13: BarcodeValidator.validate_ean13,
            BarcodeType.EAN8: BarcodeValidator.validate_ean8,
            BarcodeType.UPCA: BarcodeValidator.validate_upca,
            BarcodeType.UPCE: BarcodeValidator.validate_upce,
            BarcodeType.QRCODE: BarcodeValidator.validate_qrcode,
            BarcodeType.DATAMATRIX: BarcodeValidator.validate_datamatrix,
            BarcodeType.PDF417: BarcodeValidator.validate_pdf417,
            BarcodeType.ITF14: BarcodeValidator.validate_itf14,
        }
        
        validator = validators.get(barcode_type)
        if validator:
            return validator(value)
        return True, []


class DateValidator:
    """日期效期校验器"""
    
    DATE_FORMATS = [
        '%Y-%m-%d',
        '%Y/%m/%d',
        '%d-%m-%Y',
        '%d/%m/%Y',
        '%m-%d-%Y',
        '%m/%d/%Y',
        '%Y%m%d',
        '%d%m%Y',
        '%m%d%Y',
    ]
    
    @staticmethod
    def parse_date(date_str: str) -> Optional[datetime]:
        """尝试多种格式解析日期"""
        if not date_str or not isinstance(date_str, str):
            return None
        
        date_str = date_str.strip()
        
        for fmt in DateValidator.DATE_FORMATS:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        match = re.match(r'^(\d{4})(\d{2})(\d{2})$', date_str)
        if match:
            try:
                return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                pass
        
        return None
    
    @staticmethod
    def validate_expiry(date_str: str, today: Optional[datetime] = None) -> Tuple[bool, List[str]]:
        """校验效期"""
        errors = []
        
        if not date_str:
            errors.append("效期字段为空")
            return False, errors
        
        parsed_date = DateValidator.parse_date(date_str)
        
        if not parsed_date:
            errors.append(f"无法识别的日期格式: {date_str}")
            return False, errors
        
        if today is None:
            today = datetime.now()
        
        if parsed_date < today:
            errors.append(f"效期已过期: {date_str}")
        
        return len(errors) == 0, errors


class DataValidator:
    """主数据校验器"""
    
    def __init__(self, template: Optional[LabelTemplate] = None):
        self.template = template
    
    def set_template(self, template: LabelTemplate):
        self.template = template
    
    def validate_single(
        self, 
        sku_data: SKUData, 
        template: Optional[LabelTemplate] = None
    ) -> ValidationResult:
        """校验单条SKU数据"""
        if template is None:
            template = self.template
        
        result = ValidationResult(sku_data=sku_data)
        
        if template is None:
            result.add_error(ValidationError(
                error_code='NO_TEMPLATE',
                message='未加载标签模板',
                level=ErrorLevel.ERROR,
                row_index=sku_data.row_index,
            ))
            return result
        
        data_dict = sku_data.to_dict()
        
        for field in template.fields:
            field_value = data_dict.get(field.name)
            
            if field.is_required and (field_value is None or field_value == ''):
                result.add_error(ValidationError(
                    error_code='MISSING_REQUIRED_FIELD',
                    message=f'必填字段缺失: {field.name}',
                    level=ErrorLevel.ERROR,
                    field=field.name,
                    box_number=sku_data.box_number,
                    row_index=sku_data.row_index,
                ))
            
            if field_value is not None and field_value != '':
                str_value = str(field_value)
                
                if field.barcode_type:
                    is_valid, errors = BarcodeValidator.validate(field.barcode_type, str_value)
                    for error in errors:
                        result.add_error(ValidationError(
                            error_code='BARCODE_INVALID',
                            message=f'条码字段 {field.name} 校验失败: {error}',
                            level=ErrorLevel.ERROR,
                            field=field.name,
                            box_number=sku_data.box_number,
                            row_index=sku_data.row_index,
                            details={'barcode_type': field.barcode_type.value},
                        ))
                
                if field.name in ['expiry_date', 'expiryDate', '效期', '有效期']:
                    is_valid, errors = DateValidator.validate_expiry(str_value)
                    for error in errors:
                        result.add_error(ValidationError(
                            error_code='EXPIRY_INVALID',
                            message=f'效期字段校验失败: {error}',
                            level=ErrorLevel.WARNING,
                            field=field.name,
                            box_number=sku_data.box_number,
                            row_index=sku_data.row_index,
                        ))
        
        if not sku_data.box_number:
            result.add_error(ValidationError(
                error_code='MISSING_BOX_NUMBER',
                message='箱号不能为空',
                level=ErrorLevel.ERROR,
                field='box_number',
                row_index=sku_data.row_index,
            ))
        
        return result
    
    def validate_all(
        self, 
        sku_list: List[SKUData], 
        template: Optional[LabelTemplate] = None
    ) -> List[ValidationResult]:
        """批量校验所有SKU数据"""
        results = []
        box_number_counts: Counter = Counter()
        
        for sku in sku_list:
            result = self.validate_single(sku, template)
            results.append(result)
            
            if sku.box_number:
                box_number_counts[sku.box_number] += 1
        
        duplicate_boxes = [box for box, count in box_number_counts.items() if count > 1]
        
        for result in results:
            if result.sku_data.box_number in duplicate_boxes:
                result.add_error(ValidationError(
                    error_code='DUPLICATE_BOX_NUMBER',
                    message=f'箱号重复: {result.sku_data.box_number} (共出现{box_number_counts[result.sku_data.box_number]}次)',
                    level=ErrorLevel.ERROR,
                    field='box_number',
                    box_number=result.sku_data.box_number,
                    row_index=result.sku_data.row_index,
                ))
        
        return results
    
    def check_template_fields(
        self, 
        sku_list: List[SKUData], 
        template: Optional[LabelTemplate] = None
    ) -> Tuple[List[str], List[str]]:
        """检查模板字段与CSV数据的匹配情况
        
        返回: (缺失的字段列表, 额外的字段列表)
        """
        if template is None:
            template = self.template
        
        if template is None or not sku_list:
            return [], []
        
        template_fields = set(template.get_field_names())
        
        sample_data = sku_list[0].to_dict()
        data_fields = set(sample_data.keys())
        
        missing_fields = template_fields - data_fields
        extra_fields = data_fields - template_fields
        
        return list(missing_fields), list(extra_fields)
