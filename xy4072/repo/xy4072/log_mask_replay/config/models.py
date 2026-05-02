"""策略模型模块 - 定义敏感字段规则、密钥管理和配置模型"""

import json
import os
import re
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Pattern

from pydantic import BaseModel, Field


class SensitiveFieldType(str, Enum):
    """敏感字段类型枚举"""
    PHONE = "phone"
    EMAIL = "email"
    TOKEN = "token"
    DEVICE_ID = "device_id"
    ADDRESS = "address"
    ID_CARD = "id_card"
    BANK_CARD = "bank_card"
    USER_NAME = "user_name"


class MaskStrategy(str, Enum):
    """脱敏策略枚举"""
    REPLACE = "replace"
    HASH = "hash"
    PARTIAL_MASK = "partial_mask"
    FAKE_VALUE = "fake_value"


class SensitiveFieldRule(BaseModel):
    """敏感字段规则模型"""
    field_type: SensitiveFieldType
    name: str
    description: str
    pattern: str
    mask_strategy: MaskStrategy
    enabled: bool = True
    priority: int = 0
    examples: List[str] = Field(default_factory=list)
    
    def get_compiled_pattern(self) -> Pattern:
        """获取编译后的正则表达式"""
        return re.compile(self.pattern, re.IGNORECASE)


class KeyConfig(BaseModel):
    """密钥配置模型"""
    key_id: str
    algorithm: str = "AES-256-GCM"
    created_at: datetime = Field(default_factory=datetime.now)
    description: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class MaskingPolicy(BaseModel):
    """脱敏策略模型"""
    policy_id: str
    name: str
    description: str
    version: str = "1.0.0"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    rules: List[SensitiveFieldRule] = Field(default_factory=list)
    default_strategy: MaskStrategy = MaskStrategy.FAKE_VALUE
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def get_rule_by_type(self, field_type: SensitiveFieldType) -> Optional[SensitiveFieldRule]:
        """根据字段类型获取规则"""
        for rule in self.rules:
            if rule.field_type == field_type and rule.enabled:
                return rule
        return None
    
    def get_enabled_rules(self) -> List[SensitiveFieldRule]:
        """获取所有启用的规则，按优先级排序"""
        return sorted(
            [r for r in self.rules if r.enabled],
            key=lambda x: x.priority,
            reverse=True
        )


class AppConfig(BaseModel):
    """应用配置模型"""
    config_version: str = "1.0.0"
    workspace: str = "./workspace"
    masking_policy: MaskingPolicy
    key_config: KeyConfig
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    @classmethod
    def from_file(cls, config_path: Path) -> "AppConfig":
        """从文件加载配置"""
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        # 解析日期时间字段
        if "masking_policy" in data:
            if "created_at" in data["masking_policy"]:
                data["masking_policy"]["created_at"] = datetime.fromisoformat(
                    data["masking_policy"]["created_at"]
                )
            if "updated_at" in data["masking_policy"]:
                data["masking_policy"]["updated_at"] = datetime.fromisoformat(
                    data["masking_policy"]["updated_at"]
                )
        
        if "key_config" in data:
            if "created_at" in data["key_config"]:
                data["key_config"]["created_at"] = datetime.fromisoformat(
                    data["key_config"]["created_at"]
                )
        
        return cls(**data)
    
    def to_file(self, config_path: Path) -> None:
        """保存配置到文件"""
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(self.model_dump(), f, ensure_ascii=False, indent=2, default=str)


def create_default_policy() -> MaskingPolicy:
    """创建默认的脱敏策略"""
    return MaskingPolicy(
        policy_id="default-policy-001",
        name="默认安全脱敏策略",
        description="适用于安全运营场景的默认敏感字段脱敏策略",
        rules=[
            SensitiveFieldRule(
                field_type=SensitiveFieldType.PHONE,
                name="手机号码",
                description="中国大陆手机号码，支持+86前缀",
                pattern=r"(\+?86)?1[3-9]\d{9}",
                mask_strategy=MaskStrategy.FAKE_VALUE,
                enabled=True,
                priority=100,
                examples=["13812345678", "+8613987654321"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.EMAIL,
                name="电子邮箱",
                description="标准电子邮箱格式",
                pattern=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
                mask_strategy=MaskStrategy.FAKE_VALUE,
                enabled=True,
                priority=90,
                examples=["user@example.com", "test.user+tag@company.org"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.TOKEN,
                name="访问令牌",
                description="JWT、API Key、Session Token等",
                pattern=r"(?:Bearer\s+)?[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{20,}){0,2}",
                mask_strategy=MaskStrategy.HASH,
                enabled=True,
                priority=80,
                examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "FAKE_STRIPE_KEY_SAMPLE_abc123def456"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.DEVICE_ID,
                name="设备标识符",
                description="IMEI、MAC地址、UUID、Android ID等",
                pattern=r"(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}|[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}|\d{15,16}",
                mask_strategy=MaskStrategy.FAKE_VALUE,
                enabled=True,
                priority=70,
                examples ["00:1A:2B:3C:4D:5E", "550e8400-e29b-41d4-a716-446655440000", "861234567890123"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.ADDRESS,
                name="物理地址",
                description="包含省、市、区、街道等的中文地址",
                pattern=r"[北京市上海市天津市重庆市][市区]?[^\s,，]{2,}(?:[路街道巷][\d号]{0,10})?",
                mask_strategy=MaskStrategy.PARTIAL_MASK,
                enabled=True,
                priority=60,
                examples ["北京市朝阳区建国路88号", "上海市浦东新区张江高科技园区"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.ID_CARD,
                name="身份证号",
                description="18位或15位中国大陆身份证号",
                pattern=r"[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]|[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}",
                mask_strategy=MaskStrategy.PARTIAL_MASK,
                enabled=True,
                priority=50,
                examples ["110101199001011234", "110101900101123"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.BANK_CARD,
                name="银行卡号",
                description="16-19位银行卡号",
                pattern=r"\d{16,19}",
                mask_strategy=MaskStrategy.PARTIAL_MASK,
                enabled=True,
                priority=40,
                examples ["6222021234567890123", "4111111111111111"]
            ),
            SensitiveFieldRule(
                field_type=SensitiveFieldType.USER_NAME,
                name="用户名/真实姓名",
                description="2-4个中文字符的姓名",
                pattern=r"[\u4e00-\u9fa5]{2,4}",
                mask_strategy=MaskStrategy.FAKE_VALUE,
                enabled=True,
                priority=30,
                examples ["张三", "李四", "欧阳铁柱"]
            )
        ]
    )


def create_default_key_config() -> KeyConfig:
    """创建默认密钥配置"""
    import uuid
    return KeyConfig(
        key_id=str(uuid.uuid4()),
        algorithm="AES-256-GCM",
        description="默认生成的加密密钥，用于映射库加密存储"
    )


def create_default_config(workspace: str = "./workspace") -> AppConfig:
    """创建默认应用配置"""
    return AppConfig(
        workspace=workspace,
        masking_policy=create_default_policy(),
        key_config=create_default_key_config()
    )
