"""状态存储模块 - 负责配置和数据的持久化存储。"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from pydantic import BaseModel

from zha_beng_yan_suan_qi.types import (
    SiteConfig,
    ImportedData,
    SimulationResult,
)


class DateTimeEncoder(json.JSONEncoder):
    """支持datetime类型的JSON编码器。"""
    
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, BaseModel):
            return obj.model_dump()
        return super().default(obj)


def datetime_decoder(dct: Dict[str, Any]) -> Dict[str, Any]:
    """解码包含datetime字符串的字典。"""
    for key, value in dct.items():
        if isinstance(value, str):
            try:
                dct[key] = datetime.fromisoformat(value)
            except (ValueError, TypeError):
                pass
        elif isinstance(value, dict):
            dct[key] = datetime_decoder(value)
        elif isinstance(value, list):
            dct[key] = [
                datetime_decoder(item) if isinstance(item, dict) else item
                for item in value
            ]
    return dct


class StateStorage:
    """状态存储类。"""
    
    def __init__(self, workspace_path: Path):
        self.workspace = workspace_path
        self.workspace.mkdir(exist_ok=True)
        
        self.config_path = workspace_path / "site_config.json"
        self.imported_data_path = workspace_path / "imported_data.json"
        self.simulation_result_path = workspace_path / "simulation_result.json"
    
    def save_config(self, config: SiteConfig) -> None:
        """保存站点配置。"""
        data = config.model_dump(mode='json')
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
    
    def load_config(self) -> SiteConfig:
        """加载站点配置。"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            data = json.load(f, object_hook=datetime_decoder)
        
        return SiteConfig(**data)
    
    def save_imported_data(self, data: ImportedData) -> None:
        """保存导入的数据。"""
        data_dict = data.model_dump(mode='json')
        with open(self.imported_data_path, 'w', encoding='utf-8') as f:
            json.dump(data_dict, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
    
    def load_imported_data(self) -> ImportedData:
        """加载导入的数据。"""
        if not self.imported_data_path.exists():
            raise FileNotFoundError(f"导入数据文件不存在: {self.imported_data_path}")
        
        with open(self.imported_data_path, 'r', encoding='utf-8') as f:
            data = json.load(f, object_hook=datetime_decoder)
        
        return ImportedData(**data)
    
    def save_simulation_result(self, result: SimulationResult) -> None:
        """保存仿真结果。"""
        data = result.model_dump(mode='json')
        with open(self.simulation_result_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
    
    def load_simulation_result(self) -> SimulationResult:
        """加载仿真结果。"""
        if not self.simulation_result_path.exists():
            raise FileNotFoundError(f"仿真结果文件不存在: {self.simulation_result_path}")
        
        with open(self.simulation_result_path, 'r', encoding='utf-8') as f:
            data = json.load(f, object_hook=datetime_decoder)
        
        return SimulationResult(**data)
    
    def clear_all(self) -> None:
        """清除所有存储的数据。"""
        for path in [
            self.config_path,
            self.imported_data_path,
            self.simulation_result_path,
        ]:
            if path.exists():
                path.unlink()
    
    def get_status(self) -> Dict[str, bool]:
        """获取存储状态。"""
        return {
            "config_exists": self.config_path.exists(),
            "imported_data_exists": self.imported_data_path.exists(),
            "simulation_result_exists": self.simulation_result_path.exists(),
        }
