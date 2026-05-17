from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import json
from pathlib import Path


class RuleConfig(BaseModel):
    long_short_keywords: Dict[str, List[str]] = Field(
        default_factory=lambda: {
            "长款": ["长款", "溢余", "多出来", "盘盈", "多出"],
            "短款": ["短款", "短缺", "少了", "盘亏", "少收"]
        }
    )
    imprest_keywords: List[str] = Field(
        default_factory=lambda: ["备用金", "周转金", "零用金", "imprest"]
    )
    imprest_adjust_keywords: List[str] = Field(
        default_factory=lambda: ["调", "增加", "减少", "补", "退", "调整"]
    )
    diff_levels: Dict[str, float] = Field(
        default_factory=lambda: {
            "轻微": 50.0,
            "一般": 200.0,
            "重大": 1000.0
        }
    )
    required_columns: List[str] = Field(
        default_factory=lambda: [
            "网点编号", "网点名称", "日期", "账面金额", 
            "盘点金额", "备用金余额", "备注"
        ]
    )


class Config:
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = Path(config_path) if config_path else None
        self.rules = RuleConfig()
        self._load_config()

    def _load_config(self):
        if self.config_path and self.config_path.exists():
            with open(self.config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.rules = RuleConfig(**data)

    def save(self, path: str):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.rules.dict(), f, ensure_ascii=False, indent=2)
