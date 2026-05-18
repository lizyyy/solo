from pathlib import Path
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
import yaml


class ValidationRules(BaseModel):
    id_expiry_days_warning: int = Field(default=30, description="证件过期警告天数")
    id_expiry_days_error: int = Field(default=0, description="证件过期错误天数")
    require_child_id: bool = Field(default=True, description="是否必须提供儿童证件号")
    require_parent_id: bool = Field(default=True, description="是否必须提供家长证件号")
    require_relationship: bool = Field(default=True, description="是否必须提供与儿童关系")


class DuplicateHandling(BaseModel):
    match_columns: List[str] = Field(default_factory=lambda: ["parent_name", "parent_id_number"])
    conflict_resolution: str = Field(default="latest_timestamp")


class OutputSettings(BaseModel):
    separate_expired: bool = Field(default=True, description="是否单独输出过期记录")
    separate_duplicates: bool = Field(default=True, description="是否单独输出重复记录")
    timestamp_format: str = Field(default="%Y%m%d_%H%M%S")
    encoding: str = Field(default="utf-8-sig")


class ColumnsMapping(BaseModel):
    child_name: str = Field(default="儿童姓名")
    child_id: str = Field(default="儿童证件号")
    child_class: str = Field(default="班级")
    parent_name: str = Field(default="家长姓名")
    parent_id_type: str = Field(default="家长证件类型")
    parent_id_number: str = Field(default="家长证件号")
    parent_phone: str = Field(default="联系电话")
    relationship: str = Field(default="与儿童关系")
    auth_start_date: str = Field(default="授权开始日期")
    auth_end_date: str = Field(default="授权结束日期")
    id_expiry_date: str = Field(default="证件有效期")
    timestamp: str = Field(default="录入时间")


class AppConfig(BaseModel):
    validation_rules: ValidationRules = Field(default_factory=ValidationRules)
    duplicate_handling: DuplicateHandling = Field(default_factory=DuplicateHandling)
    output_settings: OutputSettings = Field(default_factory=OutputSettings)
    columns_mapping: ColumnsMapping = Field(default_factory=ColumnsMapping)

    @classmethod
    def load(cls, config_path: Optional[Path] = None) -> "AppConfig":
        if config_path is None or not config_path.exists():
            return cls()
        
        with open(config_path, "r", encoding="utf-8") as f:
            config_data = yaml.safe_load(f) or {}
        
        return cls(**config_data)

    def get_column_name(self, field_name: str) -> str:
        return getattr(self.columns_mapping, field_name, field_name)

    def get_all_columns(self) -> Dict[str, str]:
        return self.columns_mapping.model_dump()
