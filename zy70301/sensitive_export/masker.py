import re
from typing import Any, Dict, List, Optional

from .config import DataCategory, FieldConfig, MaskType


class SensitiveMasker:
    PHONE_PATTERN = re.compile(r'1[3-9]\d{9}')
    EMAIL_PATTERN = re.compile(r'[\w.-]+@[\w.-]+\.\w+')
    ID_CARD_PATTERN = re.compile(r'\d{17}[\dXx]')
    BANK_CARD_PATTERN = re.compile(r'\d{16,19}')
    SENSITIVE_WORDS = ['密码', 'token', 'Token', 'secret', 'Secret', '密钥', '身份证', '银行卡', '手机号', '电话', '邮箱', '信用卡']

    def __init__(self):
        pass

    def mask_phone(self, value: str, mask_type: MaskType = MaskType.PARTIAL) -> str:
        if not value or not self.PHONE_PATTERN.search(value):
            return value
        
        def replace_phone(match: re.Match) -> str:
            phone = match.group(0)
            if mask_type == MaskType.FULL:
                return '*' * len(phone)
            elif mask_type == MaskType.PARTIAL:
                if len(phone) >= 11:
                    return phone[:3] + '****' + phone[-4:]
                return phone[:1] + '*' * (len(phone) - 2) + phone[-1]
            return phone
        
        return self.PHONE_PATTERN.sub(replace_phone, value)

    def mask_email(self, value: str, mask_type: MaskType = MaskType.PARTIAL) -> str:
        if not value:
            return value
        
        def replace_email(match: re.Match) -> str:
            email = match.group(0)
            if mask_type == MaskType.FULL:
                return '*' * len(email)
            elif mask_type == MaskType.PARTIAL:
                parts = email.split('@')
                if len(parts) == 2:
                    username = parts[0]
                    if len(username) > 2:
                        masked_username = username[0] + '*' * (len(username) - 2) + username[-1]
                    else:
                        masked_username = '*' * len(username)
                    return masked_username + '@' + parts[1]
            return email
        
        return self.EMAIL_PATTERN.sub(replace_email, value)

    def mask_id_card(self, value: str, mask_type: MaskType = MaskType.PARTIAL) -> str:
        if not value:
            return value
        
        def replace_id_card(match: re.Match) -> str:
            id_card = match.group(0)
            if mask_type == MaskType.FULL:
                return '*' * len(id_card)
            elif mask_type == MaskType.PARTIAL:
                if len(id_card) >= 18:
                    return id_card[:6] + '*' * 8 + id_card[-4:]
                elif len(id_card) >= 15:
                    return id_card[:6] + '*' * 5 + id_card[-4:]
                return id_card
            return id_card
        
        return self.ID_CARD_PATTERN.sub(replace_id_card, value)

    def mask_bank_card(self, value: str, mask_type: MaskType = MaskType.PARTIAL) -> str:
        if not value:
            return value
        
        def replace_bank_card(match: re.Match) -> str:
            card = match.group(0)
            if mask_type == MaskType.FULL:
                return '*' * len(card)
            elif mask_type == MaskType.PARTIAL:
                if len(card) >= 16:
                    return card[:4] + '*' * (len(card) - 8) + card[-4:]
                return card
            return card
        
        return self.BANK_CARD_PATTERN.sub(replace_bank_card, value)

    def mask_sensitive_text(self, value: str, mask_type: MaskType = MaskType.PARTIAL) -> str:
        if not value or not isinstance(value, str):
            return str(value) if value is not None else ''
        
        result = value
        result = self.mask_phone(result, mask_type)
        result = self.mask_email(result, mask_type)
        result = self.mask_id_card(result, mask_type)
        result = self.mask_bank_card(result, mask_type)
        
        for word in self.SENSITIVE_WORDS:
            result = result.replace(word, '*' * len(word))
        
        return result

    def mask_value(self, value: Any, field_config: FieldConfig, has_approval: bool = False) -> tuple[Any, bool]:
        if value is None:
            return value, False
        
        mask_type = field_config.mask_type
        data_category = field_config.data_category
        
        if field_config.approval_required:
            if has_approval and field_config.allow_approval:
                return value, False
            if mask_type == MaskType.REQUIRE_APPROVAL:
                if data_category == DataCategory.PHONE:
                    return self.mask_phone(str(value), MaskType.FULL), True
                elif data_category == DataCategory.EMAIL:
                    return self.mask_email(str(value), MaskType.FULL), True
                elif data_category == DataCategory.ID_CARD:
                    return self.mask_id_card(str(value), MaskType.FULL), True
                elif data_category == DataCategory.BANK_CARD:
                    return self.mask_bank_card(str(value), MaskType.FULL), True
                else:
                    return '*' * len(str(value)), True
        
        if mask_type == MaskType.NONE:
            return value, False
        elif mask_type == MaskType.FULL:
            return '*' * len(str(value)), True
        
        str_value = str(value)
        
        if data_category == DataCategory.PHONE:
            masked = self.mask_phone(str_value, mask_type)
        elif data_category == DataCategory.EMAIL:
            masked = self.mask_email(str_value, mask_type)
        elif data_category == DataCategory.ID_CARD:
            masked = self.mask_id_card(str_value, mask_type)
        elif data_category == DataCategory.BANK_CARD:
            masked = self.mask_bank_card(str_value, mask_type)
        elif data_category == DataCategory.SENSITIVE_TEXT:
            masked = self.mask_sensitive_text(str_value, mask_type)
        else:
            if mask_type == MaskType.PARTIAL:
                if len(str_value) > 4:
                    masked = str_value[:2] + '*' * (len(str_value) - 4) + str_value[-2:]
                else:
                    masked = '*' * len(str_value)
            else:
                masked = str_value
        
        return masked, masked != str_value

    def mask_row(
        self,
        row: Dict[str, Any],
        strategy_fields: List[FieldConfig],
        approved_fields: Optional[List[str]] = None
    ) -> tuple[Dict[str, Any], Dict[str, int], bool]:
        result = {}
        masked_count = {}
        rejected = False
        
        approved_set = set(approved_fields or [])
        
        for field_config in strategy_fields:
            field_name = field_config.name
            if field_name not in row:
                continue
            
            value = row[field_name]
            has_approval = field_name in approved_set
            
            if field_config.approval_required and not has_approval:
                rejected = True
            
            masked_value, was_masked = self.mask_value(value, field_config, has_approval)
            result[field_name] = masked_value
            
            if was_masked:
                masked_count[field_name] = masked_count.get(field_name, 0) + 1
        
        return result, masked_count, rejected
