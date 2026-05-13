"""配置管理"""
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from pydantic import BaseModel


class SystemConfig(BaseModel):
    """系统配置"""
    name: Optional[str] = None
    high_risk_roles: List[str] = []


class Config(BaseModel):
    """整体配置"""
    data_directory: str = "./data"
    output_directory: str = "./output"
    history_file: str = "./output/history.json"
    systems: Dict[str, SystemConfig] = {}
    match_threshold: float = 0.6
    risk_threshold_high: float = 0.7
    risk_threshold_medium: float = 0.4


DEFAULT_CONFIG = """# 影子账号清理工具配置
data_directory: "./data"
output_directory: "./output"
history_file: "./output/history.json"

# 各系统配置
systems:
  git:
    high_risk_roles:
      - "admin"
      - "owner"
      - "maintainer"
  bi:
    high_risk_roles:
      - "admin"
      - "super_admin"
      - "data_owner"
  crm:
    high_risk_roles:
      - "admin"
      - "system_admin"
      - "data_manager"

# 匹配和风险阈值
match_threshold: 0.6
risk_threshold_high: 0.7
risk_threshold_medium: 0.4
"""


def load_config(config_path: Optional[str] = None) -> Config:
    """加载配置文件"""
    if config_path:
        path = Path(config_path)
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            return Config(**data)
    
    default_config_path = Path("shadow_account_cleaner.yaml")
    if default_config_path.exists():
        with open(default_config_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        return Config(**data)
    
    return Config()


def create_default_config(path: str = "shadow_account_cleaner.yaml"):
    """创建默认配置文件"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(DEFAULT_CONFIG)
