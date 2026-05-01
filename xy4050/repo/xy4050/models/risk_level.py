from enum import Enum
from typing import Optional

class RiskLevel(Enum):
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "紧急"
    
    @classmethod
    def from_string(cls, value: str) -> Optional['RiskLevel']:
        value = value.strip()
        mapping = {
            '低': cls.LOW,
            '中': cls.MEDIUM,
            '高': cls.HIGH,
            '紧急': cls.CRITICAL,
            'low': cls.LOW,
            'medium': cls.MEDIUM,
            'high': cls.HIGH,
            'critical': cls.CRITICAL,
            'Low': cls.LOW,
            'Medium': cls.MEDIUM,
            'High': cls.HIGH,
            'Critical': cls.CRITICAL,
        }
        return mapping.get(value)
    
    def to_int(self) -> int:
        mapping = {
            RiskLevel.LOW: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.HIGH: 3,
            RiskLevel.CRITICAL: 4,
        }
        return mapping[self]
    
    @classmethod
    def from_int(cls, value: int) -> Optional['RiskLevel']:
        mapping = {
            1: cls.LOW,
            2: cls.MEDIUM,
            3: cls.HIGH,
            4: cls.CRITICAL,
        }
        return mapping.get(value)
    
    def __str__(self) -> str:
        return self.value
