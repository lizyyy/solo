import re
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Tuple

class FieldMapper:
    STANDARD_FIELDS = {
        '姓名': ['姓名', 'name', '员工姓名', '联系人', 'NAME', 'Name'],
        '手机号': ['手机号', '电话', '手机', '联系电话', 'phone', 'mobile', 'PHONE', 'MOBILE'],
        '邮箱': ['邮箱', 'email', '电子邮箱', '邮件', 'EMAIL', 'Email'],
        '部门': ['部门', 'department', '所属部门', 'DEPARTMENT', 'Dept'],
        '入职日期': ['入职日期', '入职时间', 'join_date', 'date', '入职', 'JOIN_DATE'],
        '薪资': ['薪资', '工资', 'salary', '薪酬', 'SALARY', 'Salary'],
        '负责人': ['负责人', 'owner', '主管', 'leader', 'OWNER', 'Leader']
    }
    
    def map_fields(self, input_columns: List[str]) -> Dict[str, str]:
        mapping = {}
        for col in input_columns:
            mapped = False
            for standard_field, aliases in self.STANDARD_FIELDS.items():
                if col in aliases or col.lower() in [a.lower() for a in aliases]:
                    mapping[col] = standard_field
                    mapped = True
                    break
            if not mapped:
                mapping[col] = col
        return mapping

class DataValidator:
    def __init__(self):
        self.rules = {
            '手机号': self.validate_phone,
            '邮箱': self.validate_email,
            '入职日期': self.validate_date,
            '薪资': self.validate_salary,
            '姓名': self.validate_name
        }
        self.fix_suggestions = {
            '手机号': self.suggest_phone_fix,
            '邮箱': self.suggest_email_fix,
            '入职日期': self.suggest_date_fix,
            '薪资': self.suggest_salary_fix
        }
    
    def validate_phone(self, value: Any) -> Tuple[bool, str]:
        if pd.isna(value) or value == '':
            return False, '手机号不能为空'
        phone_str = str(value).strip()
        phone_str = re.sub(r'[\s\-\+]', '', phone_str)
        if re.match(r'^1[3-9]\d{9}$', phone_str):
            return True, ''
        return False, '手机号格式不正确，应为11位有效手机号'
    
    def validate_email(self, value: Any) -> Tuple[bool, str]:
        if pd.isna(value) or value == '':
            return True, ''
        email_str = str(value).strip()
        if re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email_str):
            return True, ''
        return False, '邮箱格式不正确'
    
    def validate_date(self, value: Any) -> Tuple[bool, str]:
        if pd.isna(value) or value == '':
            return True, ''
        date_str = str(value).strip()
        formats = ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%Y%m%d']
        for fmt in formats:
            try:
                datetime.strptime(date_str, fmt)
                return True, ''
            except ValueError:
                continue
        return False, '日期格式不正确，建议使用 YYYY-MM-DD 格式'
    
    def validate_salary(self, value: Any) -> Tuple[bool, str]:
        if pd.isna(value) or value == '':
            return True, ''
        salary_str = str(value).strip()
        salary_str = re.sub(r'[^\d.]', '', salary_str)
        try:
            salary = float(salary_str)
            if salary > 0 and salary < 1000000:
                return True, ''
            return False, '薪资数值异常'
        except ValueError:
            return False, '薪资格式不正确'
    
    def validate_name(self, value: Any) -> Tuple[bool, str]:
        if pd.isna(value) or value == '':
            return False, '姓名不能为空'
        name_str = str(value).strip()
        if len(name_str) >= 2 and len(name_str) <= 20:
            return True, ''
        return False, '姓名字长异常'
    
    def suggest_phone_fix(self, value: Any) -> str:
        if pd.isna(value) or value == '':
            return '请补充手机号'
        phone_str = str(value).strip()
        phone_str = re.sub(r'[^\d]', '', phone_str)
        if len(phone_str) == 11 and phone_str.startswith('1'):
            return f"建议修正为: {phone_str}"
        if len(phone_str) > 11:
            return f"检测到多余数字，建议截取: {phone_str[:11]}"
        return '请检查并修正手机号'
    
    def suggest_email_fix(self, value: Any) -> str:
        if pd.isna(value) or value == '':
            return ''
        email_str = str(value).strip()
        if '@' not in email_str:
            return '缺少 @ 符号，请检查'
        if '.' not in email_str.split('@')[-1]:
            return '域名格式不正确，建议添加 .com/.cn 等后缀'
        return '请检查邮箱格式'
    
    def suggest_date_fix(self, value: Any) -> str:
        if pd.isna(value) or value == '':
            return ''
        date_str = str(value).strip()
        digits = re.sub(r'[^\d]', '', date_str)
        if len(digits) == 8:
            return f"建议格式化为: {digits[:4]}-{digits[4:6]}-{digits[6:8]}"
        return '请使用 YYYY-MM-DD 格式，例如: 2024-01-15'
    
    def suggest_salary_fix(self, value: Any) -> str:
        if pd.isna(value) or value == '':
            return ''
        salary_str = str(value).strip()
        digits = re.sub(r'[^\d.]', '', salary_str)
        if digits:
            return f"建议提取数字部分: {digits}"
        return '请输入有效数字'
    
    def validate_dataframe(self, df, mapped_fields: Dict[str, str]) -> Dict[str, Any]:
        errors = []
        warnings = []
        dirty_row_indices = set()
        fix_suggestions = {}
        
        for idx, row in df.iterrows():
            row_errors = []
            row_fixes = {}
            
            for col, standard_field in mapped_fields.items():
                if standard_field in self.rules:
                    value = row[col]
                    is_valid, error_msg = self.rules[standard_field](value)
                    
                    if not is_valid:
                        row_errors.append({
                            'field': standard_field,
                            'original_field': col,
                            'value': str(value) if not pd.isna(value) else '',
                            'error': error_msg
                        })
                        dirty_row_indices.add(idx)
                        
                        if standard_field in self.fix_suggestions:
                            suggestion = self.fix_suggestions[standard_field](value)
                            if suggestion:
                                row_fixes[standard_field] = {
                                    'suggestion': suggestion,
                                    'original_value': str(value) if not pd.isna(value) else ''
                                }
            
            if row_errors:
                errors.append({
                    'row_index': idx,
                    'row_number': idx + 2,
                    'errors': row_errors
                })
                
                if row_fixes:
                    fix_suggestions[idx] = row_fixes
        
        return {
            'total_rows': len(df),
            'clean_rows': len(df) - len(dirty_row_indices),
            'dirty_rows': len(dirty_row_indices),
            'dirty_row_indices': list(dirty_row_indices),
            'errors': errors,
            'warnings': warnings,
            'fix_suggestions': fix_suggestions,
            'is_importable': len(dirty_row_indices) == 0
        }
