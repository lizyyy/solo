import re
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
from app.models import Bibliography, BadData, FixHistory, ManualCorrection
from app import db
from config import Config

class ValidationResult:
    def __init__(self, is_valid: bool = True):
        self.is_valid = is_valid
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
    
    def add_error(self, error_code: str, error_message: str, field_name: Optional[str] = None, 
                  original_data: Optional[Dict] = None, line_number: int = 0, isbn: Optional[str] = None):
        self.is_valid = False
        self.errors.append({
            'error_code': error_code,
            'error_message': error_message,
            'field_name': field_name,
            'original_data': original_data or {},
            'line_number': line_number,
            'isbn': isbn
        })
        return self
    
    def add_warning(self, warning_code: str, warning_message: str, field_name: Optional[str] = None,
                    original_data: Optional[Dict] = None, line_number: int = 0, isbn: Optional[str] = None):
        self.warnings.append({
            'warning_code': warning_code,
            'warning_message': warning_message,
            'field_name': field_name,
            'original_data': original_data or {},
            'line_number': line_number,
            'isbn': isbn
        })
        return self

class ISBNValidator:
    @staticmethod
    def validate_isbn10(isbn: str) -> bool:
        if not re.match(r'^\d{9}[\dX]$', isbn):
            return False
        
        total = 0
        for i in range(9):
            total += int(isbn[i]) * (10 - i)
        
        check_digit = isbn[9]
        if check_digit == 'X':
            total += 10
        else:
            total += int(check_digit)
        
        return total % 11 == 0
    
    @staticmethod
    def validate_isbn13(isbn: str) -> bool:
        if not re.match(r'^\d{13}$', isbn):
            return False
        
        total = 0
        for i in range(12):
            if i % 2 == 0:
                total += int(isbn[i])
            else:
                total += int(isbn[i]) * 3
        
        check_digit = (10 - (total % 10)) % 10
        return int(isbn[12]) == check_digit
    
    @staticmethod
    def validate(isbn: str) -> Tuple[bool, str]:
        if not isbn:
            return False, "ISBN为空"
        
        isbn_clean = re.sub(r'[- ]', '', str(isbn))
        
        if len(isbn_clean) == 10:
            if ISBNValidator.validate_isbn10(isbn_clean):
                return True, "ISBN-10格式有效"
            else:
                return False, "ISBN-10校验码无效"
        elif len(isbn_clean) == 13:
            if ISBNValidator.validate_isbn13(isbn_clean):
                return True, "ISBN-13格式有效"
            else:
                return False, "ISBN-13校验码无效"
        else:
            return False, f"ISBN长度无效: {len(isbn_clean)}位，应为10或13位"

class CurrencyValidator:
    @staticmethod
    def validate(currency: str, data: Dict = None) -> Tuple[bool, str]:
        if not currency:
            return False, "币种为空"
        
        currency_upper = str(currency).strip().upper()
        
        if currency_upper in Config.VALID_CURRENCIES:
            return True, f"币种有效: {currency_upper}"
        
        common_mistakes = {
            'RMB': 'CNY',
            '人民币': 'CNY',
            '¥': 'CNY',
            '$': 'USD',
            'USD$': 'USD',
            'EUR€': 'EUR',
            '€': 'EUR',
            '£': 'GBP',
            'GBP£': 'GBP',
            'JP¥': 'JPY',
            '日圆': 'JPY',
            '日元': 'JPY'
        }
        
        if currency_upper in common_mistakes:
            return False, f"不标准币种 '{currency}'，建议使用 '{common_mistakes[currency_upper]}'"
        
        return False, f"无效币种: {currency}，有效币种包括: {', '.join(Config.VALID_CURRENCIES)}"

class CategoryValidator:
    REQUIRED_CATEGORY_FIELDS = ['channel_category', 'category']
    
    @staticmethod
    def validate_category(data: Dict, data_type: str) -> Tuple[bool, str]:
        if data_type == 'channel_listing':
            channel_category = data.get('channel_category', '').strip()
            if not channel_category:
                return False, "渠道分类为空或缺失"
            return True, "渠道分类有效"
        
        elif data_type == 'bibliography':
            category = data.get('category', '').strip()
            if not category:
                return False, "图书分类为空或缺失"
            return True, "图书分类有效"
        
        return True, "无需分类验证"

class ReboundDetector:
    @staticmethod
    def check_rebound(isbn: str, field_name: str, new_value: Any) -> Tuple[bool, str, Optional[Dict]]:
        if not isbn or not field_name:
            return False, "", None
        
        corrections = ManualCorrection.query.filter_by(
            isbn=isbn,
            field_name=field_name
        ).order_by(ManualCorrection.correction_time.desc()).all()
        
        if len(corrections) >= 2:
            last_correction = corrections[0]
            prev_correction = corrections[1]
            
            if str(new_value).strip() == str(prev_correction.old_value).strip():
                return True, "检测到数据反弹: 值已恢复到之前被修正过的旧值", {
                    'isbn': isbn,
                    'field_name': field_name,
                    'current_value': new_value,
                    'previous_correction': {
                        'old_value': prev_correction.old_value,
                        'new_value': prev_correction.new_value,
                        'correction_time': prev_correction.correction_time,
                        'corrector': prev_correction.corrector,
                        'reason': prev_correction.correction_reason
                    },
                    'last_correction': {
                        'old_value': last_correction.old_value,
                        'new_value': last_correction.new_value,
                        'correction_time': last_correction.correction_time
                    }
                }
        
        bad_data_records = BadData.query.filter_by(
            isbn=isbn,
            field_name=field_name,
            fix_status='fixed'
        ).order_by(BadData.fixed_at.desc()).all()
        
        if bad_data_records:
            for bad_data in bad_data_records[:2]:
                fix_histories = FixHistory.query.filter_by(
                    bad_data_id=bad_data.id,
                    action='fixed'
                ).order_by(FixHistory.action_time.desc()).first()
                
                if fix_histories:
                    original_data = bad_data.original_data
                    if isinstance(original_data, str):
                        import json
                        try:
                            original_data = json.loads(original_data)
                        except:
                            original_data = {}
                    
                    old_field_value = original_data.get(field_name, '')
                    if str(new_value).strip() == str(old_field_value).strip():
                        return True, "检测到数据反弹: 值已恢复到之前被标记为坏数据的值", {
                            'isbn': isbn,
                            'field_name': field_name,
                            'current_value': new_value,
                            'bad_data_id': bad_data.id,
                            'original_bad_value': old_field_value,
                            'fix_time': fix_histories.action_time,
                            'fixed_by': fix_histories.actor
                        }
        
        return False, "", None

class DataValidator:
    def __init__(self):
        self.isbn_validator = ISBNValidator()
        self.currency_validator = CurrencyValidator()
        self.category_validator = CategoryValidator()
        self.rebound_detector = ReboundDetector()
    
    def validate_bibliography(self, data: Dict, line_number: int = 0, 
                               existing_isbns: set = None) -> ValidationResult:
        result = ValidationResult()
        isbn = data.get('isbn', '').strip()
        
        isbn_valid, isbn_msg = self.isbn_validator.validate(isbn)
        if not isbn_valid:
            result.add_error(
                error_code='ISBN_INVALID',
                error_message=isbn_msg,
                field_name='isbn',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        if existing_isbns and isbn in existing_isbns:
            result.add_error(
                error_code='ISBN_DUPLICATE',
                error_message=f"ISBN重复: {isbn} 在当前导入批次中已存在",
                field_name='isbn',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        if isbn and isbn_valid:
            existing_book = Bibliography.query.filter_by(isbn=isbn).first()
            if existing_book:
                result.add_warning(
                    warning_code='ISBN_EXISTS',
                    warning_message=f"ISBN已存在于数据库中: {isbn}，将执行更新操作",
                    field_name='isbn',
                    original_data=data.copy(),
                    line_number=line_number,
                    isbn=isbn
                )
        
        if not data.get('title', '').strip():
            result.add_error(
                error_code='TITLE_MISSING',
                error_message="书名不能为空",
                field_name='title',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        return result
    
    def validate_price_list(self, data: Dict, line_number: int = 0) -> ValidationResult:
        result = ValidationResult()
        isbn = data.get('isbn', '').strip()
        
        isbn_valid, isbn_msg = self.isbn_validator.validate(isbn)
        if not isbn_valid:
            result.add_error(
                error_code='ISBN_INVALID',
                error_message=isbn_msg,
                field_name='isbn',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        try:
            price = float(data.get('price', 0))
            if price <= 0:
                result.add_error(
                    error_code='PRICE_INVALID',
                    error_message=f"价格必须大于0: {price}",
                    field_name='price',
                    original_data=data.copy(),
                    line_number=line_number,
                    isbn=isbn
                )
        except (ValueError, TypeError):
            result.add_error(
                error_code='PRICE_FORMAT',
                error_message=f"价格格式无效: {data.get('price')}",
                field_name='price',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        currency = data.get('currency', '')
        if currency:
            currency_valid, currency_msg = self.currency_validator.validate(currency)
            if not currency_valid:
                result.add_error(
                    error_code='CURRENCY_INVALID',
                    error_message=currency_msg,
                    field_name='currency',
                    original_data=data.copy(),
                    line_number=line_number,
                    isbn=isbn
                )
        
        if not data.get('print_run', '').strip():
            result.add_error(
                error_code='PRINT_RUN_MISSING',
                error_message="印次不能为空",
                field_name='print_run',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        return result
    
    def validate_channel_listing(self, data: Dict, line_number: int = 0) -> ValidationResult:
        result = ValidationResult()
        isbn = data.get('isbn', '').strip()
        
        isbn_valid, isbn_msg = self.isbn_validator.validate(isbn)
        if not isbn_valid:
            result.add_error(
                error_code='ISBN_INVALID',
                error_message=isbn_msg,
                field_name='isbn',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        if not data.get('channel_name', '').strip():
            result.add_error(
                error_code='CHANNEL_NAME_MISSING',
                error_message="渠道名称不能为空",
                field_name='channel_name',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        category_valid, category_msg = self.category_validator.validate_category(data, 'channel_listing')
        if not category_valid:
            result.add_error(
                error_code='CHANNEL_CATEGORY_MISSING',
                error_message=category_msg,
                field_name='channel_category',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        return result
    
    def validate_manual_correction(self, data: Dict, line_number: int = 0) -> ValidationResult:
        result = ValidationResult()
        isbn = data.get('isbn', '').strip()
        field_name = data.get('field_name', '').strip()
        new_value = data.get('new_value', '')
        
        isbn_valid, isbn_msg = self.isbn_validator.validate(isbn)
        if not isbn_valid:
            result.add_error(
                error_code='ISBN_INVALID',
                error_message=isbn_msg,
                field_name='isbn',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        if not field_name:
            result.add_error(
                error_code='FIELD_NAME_MISSING',
                error_message="字段名称不能为空",
                field_name='field_name',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        if new_value is None or str(new_value).strip() == '':
            result.add_error(
                error_code='NEW_VALUE_MISSING',
                error_message="新值不能为空",
                field_name='new_value',
                original_data=data.copy(),
                line_number=line_number,
                isbn=isbn
            )
        
        return result
    
    def check_rebound_for_import(self, data: Dict, field_name: str, isbn: str) -> Tuple[bool, str, Optional[Dict]]:
        new_value = data.get(field_name, '')
        return self.rebound_detector.check_rebound(isbn, field_name, new_value)
