"""本地数据存储模块"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from .models import Rotor, TubeType, BalanceResult, BalanceConfig


class StorageManager:
    """本地存储管理器"""
    
    DEFAULT_DATA_DIR = "~/.centrifuge_balance"
    
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = self.DEFAULT_DATA_DIR
        self.data_dir = Path(os.path.expanduser(data_dir))
        self._ensure_directories()
    
    def _ensure_directories(self):
        """确保数据目录存在"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "rotors").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "tube_types").mkdir(parents=True, exist_ok=True)
        (self.data_dir / "history").mkdir(parents=True, exist_ok=True)
    
    def _save_json(self, filepath: Path, data: Any):
        """保存JSON文件"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_json(self, filepath: Path) -> Optional[Any]:
        """加载JSON文件"""
        if not filepath.exists():
            return None
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return None
    
    def save_rotor(self, rotor: Rotor) -> bool:
        """保存转子信息"""
        filepath = self.data_dir / "rotors" / f"{rotor.id}.json"
        self._save_json(filepath, rotor.to_dict())
        return True
    
    def load_rotor(self, rotor_id: str) -> Optional[Rotor]:
        """加载转子信息"""
        filepath = self.data_dir / "rotors" / f"{rotor_id}.json"
        data = self._load_json(filepath)
        if data:
            return Rotor.from_dict(data)
        return None
    
    def list_rotors(self) -> List[Rotor]:
        """列出所有转子"""
        rotors = []
        rotor_dir = self.data_dir / "rotors"
        if not rotor_dir.exists():
            return rotors
        
        for filepath in rotor_dir.glob("*.json"):
            data = self._load_json(filepath)
            if data:
                try:
                    rotor = Rotor.from_dict(data)
                    rotors.append(rotor)
                except (KeyError, ValueError):
                    continue
        
        return sorted(rotors, key=lambda r: r.name)
    
    def delete_rotor(self, rotor_id: str) -> bool:
        """删除转子"""
        filepath = self.data_dir / "rotors" / f"{rotor_id}.json"
        if filepath.exists():
            filepath.unlink()
            return True
        return False
    
    def increment_rotor_usage(self, rotor_id: str) -> Optional[Rotor]:
        """增加转子使用次数"""
        rotor = self.load_rotor(rotor_id)
        if rotor:
            rotor.usage_count += 1
            rotor.last_used = datetime.now()
            self.save_rotor(rotor)
            return rotor
        return None
    
    def save_tube_type(self, tube_type: TubeType) -> bool:
        """保存管型信息"""
        filepath = self.data_dir / "tube_types" / f"{tube_type.id}.json"
        self._save_json(filepath, tube_type.to_dict())
        return True
    
    def load_tube_type(self, tube_type_id: str) -> Optional[TubeType]:
        """加载管型信息"""
        filepath = self.data_dir / "tube_types" / f"{tube_type_id}.json"
        data = self._load_json(filepath)
        if data:
            return TubeType.from_dict(data)
        return None
    
    def list_tube_types(self) -> List[TubeType]:
        """列出所有管型"""
        tube_types = []
        tube_dir = self.data_dir / "tube_types"
        if not tube_dir.exists():
            return tube_types
        
        for filepath in tube_dir.glob("*.json"):
            data = self._load_json(filepath)
            if data:
                try:
                    tube_type = TubeType.from_dict(data)
                    tube_types.append(tube_type)
                except (KeyError, ValueError):
                    continue
        
        return sorted(tube_types, key=lambda t: t.name)
    
    def delete_tube_type(self, tube_type_id: str) -> bool:
        """删除管型"""
        filepath = self.data_dir / "tube_types" / f"{tube_type_id}.json"
        if filepath.exists():
            filepath.unlink()
            return True
        return False
    
    def get_tube_types_dict(self) -> Dict[str, TubeType]:
        """获取管型字典（ID到对象的映射）"""
        tube_types = self.list_tube_types()
        return {tt.id: tt for tt in tube_types}
    
    def save_history(self, result: BalanceResult, samples: List[Dict]) -> str:
        """
        保存历史记录
        
        Args:
            result: 配平结果
            samples: 样品数据列表（字典形式）
        
        Returns:
            历史记录ID
        """
        timestamp = datetime.now()
        history_id = timestamp.strftime("%Y%m%d_%H%M%S")
        
        history_data = {
            "id": history_id,
            "timestamp": timestamp.isoformat(),
            "result": result.to_dict(),
            "samples": samples,
            "notes": result.notes
        }
        
        filepath = self.data_dir / "history" / f"{history_id}.json"
        self._save_json(filepath, history_data)
        
        return history_id
    
    def load_history(self, history_id: str) -> Optional[Dict]:
        """加载历史记录"""
        filepath = self.data_dir / "history" / f"{history_id}.json"
        return self._load_json(filepath)
    
    def list_history(self, limit: int = 50) -> List[Dict]:
        """
        列出历史记录（最新的在前）
        
        Args:
            limit: 返回记录数量限制
        """
        history_list = []
        history_dir = self.data_dir / "history"
        if not history_dir.exists():
            return history_list
        
        filepaths = sorted(history_dir.glob("*.json"), reverse=True)
        
        for filepath in filepaths[:limit]:
            data = self._load_json(filepath)
            if data:
                history_list.append({
                    "id": data.get("id"),
                    "timestamp": data.get("timestamp"),
                    "rotor_id": data.get("result", {}).get("rotor_id"),
                    "is_balanced": data.get("result", {}).get("is_balanced"),
                    "max_mass_imbalance_g": data.get("result", {}).get("max_mass_imbalance_g")
                })
        
        return history_list
    
    def delete_history(self, history_id: str) -> bool:
        """删除历史记录"""
        filepath = self.data_dir / "history" / f"{history_id}.json"
        if filepath.exists():
            filepath.unlink()
            return True
        return False
    
    def save_config(self, config: BalanceConfig) -> bool:
        """保存配置"""
        filepath = self.data_dir / "config.json"
        self._save_json(filepath, config.to_dict())
        return True
    
    def load_config(self) -> BalanceConfig:
        """加载配置（不存在则返回默认配置）"""
        filepath = self.data_dir / "config.json"
        data = self._load_json(filepath)
        if data:
            return BalanceConfig.from_dict(data)
        return BalanceConfig()
    
    def initialize_default_data(self):
        """初始化默认数据（示例转子和管型）"""
        existing_rotors = self.list_rotors()
        if not existing_rotors:
            default_rotors = [
                Rotor(
                    id="rotor_12_10cm",
                    name="12孔角转子(10cm)",
                    hole_count=12,
                    radius_cm=10.0,
                    max_rpm=12000,
                    description="标准12孔角转子，半径10cm"
                ),
                Rotor(
                    id="rotor_24_8cm",
                    name="24孔微量转子(8cm)",
                    hole_count=24,
                    radius_cm=8.0,
                    max_rpm=15000,
                    description="24孔微量离心机转子"
                ),
                Rotor(
                    id="rotor_6_15cm",
                    name="6孔大容量转子(15cm)",
                    hole_count=6,
                    radius_cm=15.0,
                    max_rpm=8000,
                    description="6孔大容量离心机转子"
                )
            ]
            
            for rotor in default_rotors:
                self.save_rotor(rotor)
        
        existing_tubes = self.list_tube_types()
        if not existing_tubes:
            default_tubes = [
                TubeType(
                    id="tube_15ml_pp",
                    name="15ml聚丙烯离心管",
                    empty_weight_g=1.5,
                    max_volume_ml=15.0,
                    description="标准15ml离心管"
                ),
                TubeType(
                    id="tube_50ml_pp",
                    name="50ml聚丙烯离心管",
                    empty_weight_g=4.0,
                    max_volume_ml=50.0,
                    description="标准50ml离心管"
                ),
                TubeType(
                    id="tube_1.5ml_micro",
                    name="1.5ml微量离心管",
                    empty_weight_g=0.1,
                    max_volume_ml=1.5,
                    description="1.5ml微量离心管"
                ),
                TubeType(
                    id="tube_2ml_micro",
                    name="2ml微量离心管",
                    empty_weight_g=0.12,
                    max_volume_ml=2.0,
                    description="2ml微量离心管"
                )
            ]
            
            for tube in default_tubes:
                self.save_tube_type(tube)
    
    def get_data_dir(self) -> Path:
        """获取数据目录路径"""
        return self.data_dir
