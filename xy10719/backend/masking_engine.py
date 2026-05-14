import hashlib
import re
from typing import Optional
from models import MaskingConfig, MaskingStrategy, FieldType

class MaskingEngine:
    def __init__(self):
        self.field_patterns = {
            FieldType.PHONE: r'^1[3-9]\d{9}$',
            FieldType.EMAIL: r'^[\w\.-]+@[\w\.-]+\.\w+$',
            FieldType.ID_CARD: r'^\d{17}[\dXx]$',
            FieldType.BANK_CARD: r'^\d{16,19}$'
        }
    
    def validate_field(self, value: str, field_type: FieldType) -> tuple[bool, Optional[str]]:
        if field_type not in self.field_patterns:
            return True, None
        
        pattern = self.field_patterns[field_type]
        if not re.match(pattern, value):
            return False, f"{field_type}格式校验失败"
        
        if field_type == FieldType.ID_CARD:
            if not self._validate_id_card_checksum(value):
                return False, "身份证校验码无效"
        
        return True, None
    
    def _validate_id_card_checksum(self, id_card: str) -> bool:
        if len(id_card) != 18:
            return False
        weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
        check_codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
        total = sum(int(id_card[i]) * weights[i] for i in range(17))
        return id_card[17].upper() == check_codes[total % 11]
    
    def apply_mask(self, value: str, config: MaskingConfig) -> str:
        if not value:
            return value
        
        strategy = config.strategy
        
        if strategy == MaskingStrategy.MASK:
            return self._mask_value(value, config)
        elif strategy == MaskingStrategy.REPLACE:
            return config.replacement
        elif strategy == MaskingStrategy.HASH:
            return self._hash_value(value)
        elif strategy == MaskingStrategy.TRUNCATE:
            return self._truncate_value(value, config)
        elif strategy == MaskingStrategy.ENCRYPT:
            return self._encrypt_value(value)
        else:
            return value
    
    def _mask_value(self, value: str, config: MaskingConfig) -> str:
        if len(value) <= config.left_visible + config.right_visible:
            return config.mask_char * len(value)
        
        left = value[:config.left_visible]
        right = value[-config.right_visible:] if config.right_visible > 0 else ''
        mask_length = len(value) - config.left_visible - config.right_visible
        masked = config.mask_char * mask_length
        return left + masked + right
    
    def _hash_value(self, value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()[:16]
    
    def _truncate_value(self, value: str, config: MaskingConfig) -> str:
        max_len = config.left_visible + config.right_visible
        if len(value) <= max_len:
            return value
        return value[:max_len] + "..."
    
    def _encrypt_value(self, value: str) -> str:
        return f"ENCRYPTED:{hashlib.md5(value.encode()).hexdigest()[:8]}"

masking_engine = MaskingEngine()
