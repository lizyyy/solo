"""数据存储服务 - 管理导入的数据"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models.config import StoreConfig, ValidationRules
from ..models.frame import Frame
from ..models.lens import LensInventory, LensStock
from ..models.prescription import Prescription


class DataStore:
    """数据存储类"""
    
    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.work_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_dir = work_dir / "config"
        self.data_dir = work_dir / "data"
        self.exports_dir = work_dir / "exports"
        self.temp_dir = work_dir / "temp"
        
        for d in [self.config_dir, self.data_dir, self.exports_dir, self.temp_dir]:
            d.mkdir(exist_ok=True)
        
        self._prescriptions: list[Prescription] = []
        self._frames: list[Frame] = []
        self._inventory: LensInventory = LensInventory()
        self._store_config: Optional[StoreConfig] = None
        self._orders: list[dict] = []
        
        self._load_existing_data()
    
    def _load_existing_data(self) -> None:
        """加载现有数据"""
        config_file = self.config_dir / "store_config.json"
        if config_file.exists():
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._store_config = StoreConfig.model_validate(data)
            except Exception:
                pass
        
        orders_file = self.data_dir / "orders.json"
        if orders_file.exists():
            try:
                with open(orders_file, "r", encoding="utf-8") as f:
                    self._orders = json.load(f)
            except Exception:
                pass
    
    @property
    def store_config(self) -> Optional[StoreConfig]:
        return self._store_config
    
    @property
    def prescriptions(self) -> list[Prescription]:
        return self._prescriptions.copy()
    
    @property
    def frames(self) -> list[Frame]:
        return self._frames.copy()
    
    @property
    def inventory(self) -> LensInventory:
        return self._inventory
    
    @property
    def orders(self) -> list[dict]:
        return self._orders.copy()
    
    def initialize_store(
        self,
        store_id: str,
        store_name: str,
        rules: Optional[ValidationRules] = None,
    ) -> StoreConfig:
        """初始化门店配置
        
        Args:
            store_id: 门店ID
            store_name: 门店名称
            rules: 校验规则（可选，使用默认规则）
            
        Returns:
            门店配置
        """
        config = StoreConfig(
            store_id=store_id,
            store_name=store_name,
            rules=rules or ValidationRules(),
        )
        
        self._store_config = config
        self._save_config(config)
        
        self._prescriptions = []
        self._frames = []
        self._inventory = LensInventory()
        self._orders = []
        
        return config
    
    def _save_config(self, config: StoreConfig) -> None:
        """保存配置"""
        config_file = self.config_dir / "store_config.json"
        
        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(mode="json"), f, indent=2, ensure_ascii=False)
    
    def import_prescriptions(self, prescriptions: list[Prescription]) -> int:
        """导入处方
        
        Args:
            prescriptions: 处方列表
            
        Returns:
            导入数量
        """
        existing_ids = {p.prescription_id for p in self._prescriptions}
        new_count = 0
        
        for rx in prescriptions:
            if rx.prescription_id not in existing_ids:
                self._prescriptions.append(rx)
                existing_ids.add(rx.prescription_id)
                new_count += 1
        
        self._save_prescriptions()
        return new_count
    
    def import_frames(self, frames: list[Frame]) -> int:
        """导入镜架
        
        Args:
            frames: 镜架列表
            
        Returns:
            导入数量
        """
        existing_ids = {f.frame_id for f in self._frames}
        new_count = 0
        
        for frame in frames:
            if frame.frame_id not in existing_ids:
                self._frames.append(frame)
                existing_ids.add(frame.frame_id)
                new_count += 1
        
        self._save_frames()
        return new_count
    
    def import_inventory(self, inventory: LensInventory) -> int:
        """导入镜片库存
        
        Args:
            inventory: 镜片库存
            
        Returns:
            导入数量
        """
        existing_ids = {s.stock_id for s in self._inventory.items}
        new_count = 0
        
        for item in inventory.items:
            if item.stock_id not in existing_ids:
                self._inventory.add_item(item)
                existing_ids.add(item.stock_id)
                new_count += 1
            else:
                for existing in self._inventory.items:
                    if existing.stock_id == item.stock_id:
                        existing.quantity = item.quantity
                        existing.unit_price = item.unit_price
                        break
        
        self._save_inventory()
        return new_count
    
    def _save_prescriptions(self) -> None:
        """保存处方数据"""
        file_path = self.data_dir / "prescriptions.json"
        data = [p.model_dump(mode="json") for p in self._prescriptions]
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _save_frames(self) -> None:
        """保存镜架数据"""
        file_path = self.data_dir / "frames.json"
        data = [f.model_dump(mode="json") for f in self._frames]
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _save_inventory(self) -> None:
        """保存库存数据"""
        file_path = self.data_dir / "inventory.json"
        data = {
            "items": [s.model_dump(mode="json") for s in self._inventory.items]
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def save_order(self, order_data: dict) -> None:
        """保存订单"""
        self._orders.append(order_data)
        self._save_orders()
    
    def _save_orders(self) -> None:
        """保存订单数据"""
        file_path = self.data_dir / "orders.json"
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self._orders, f, indent=2, ensure_ascii=False)
    
    def get_prescription(self, rx_id: str) -> Optional[Prescription]:
        """获取处方"""
        for rx in self._prescriptions:
            if rx.prescription_id == rx_id:
                return rx
        return None
    
    def get_frame(self, frame_id: str) -> Optional[Frame]:
        """获取镜架"""
        for frame in self._frames:
            if frame.frame_id == frame_id:
                return frame
        return None
    
    def get_summary(self) -> dict:
        """获取数据摘要"""
        return {
            "store_config": {
                "store_id": self._store_config.store_id if self._store_config else None,
                "store_name": self._store_config.store_name if self._store_config else None,
            } if self._store_config else None,
            "prescriptions": {
                "count": len(self._prescriptions),
            },
            "frames": {
                "count": len(self._frames),
            },
            "inventory": self._inventory.get_summary(),
            "orders": {
                "count": len(self._orders),
            },
        }
    
    def export_to_json(self, data: dict, filename: str) -> Path:
        """导出为JSON"""
        file_path = self.exports_dir / filename
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return file_path
    
    def clear_temp(self) -> None:
        """清理临时目录"""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)
            self.temp_dir.mkdir()


class StoreManager:
    """门店管理器"""
    
    _instance: Optional["StoreManager"] = None
    _default_work_dir: Path = Path.home() / ".opto-guardian"
    
    def __new__(cls, work_dir: Optional[Path] = None):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, work_dir: Optional[Path] = None):
        if self._initialized:
            return
        
        self._work_dir = work_dir or self._default_work_dir
        self._data_store: Optional[DataStore] = None
        self._initialized = True
    
    def get_store(self, work_dir: Optional[Path] = None) -> DataStore:
        """获取数据存储"""
        use_dir = work_dir or self._work_dir
        
        if self._data_store is None or self._data_store.work_dir != use_dir:
            self._data_store = DataStore(use_dir)
        
        return self._data_store
    
    def is_initialized(self, work_dir: Optional[Path] = None) -> bool:
        """检查是否已初始化"""
        store = self.get_store(work_dir)
        return store.store_config is not None
    
    def initialize(
        self,
        store_id: str,
        store_name: str,
        work_dir: Optional[Path] = None,
        rules: Optional[ValidationRules] = None,
    ) -> StoreConfig:
        """初始化门店"""
        store = self.get_store(work_dir)
        return store.initialize_store(store_id, store_name, rules)
