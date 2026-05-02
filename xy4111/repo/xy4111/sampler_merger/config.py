import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional


class ConfigManager:
    """项目配置管理器"""
    
    def __init__(self, config_path: Path):
        self.config_path = config_path
    
    def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def save_config(self, config: Dict[str, Any]) -> None:
        """保存配置文件"""
        # 更新时间戳
        if config.get("created_at") is None:
            config["created_at"] = datetime.now().isoformat()
        
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False, default=str)
    
    def update_config(self, updates: Dict[str, Any]) -> None:
        """更新配置的部分内容"""
        config = self.load_config()
        config.update(updates)
        self.save_config(config)
    
    def get_project_info(self) -> Dict[str, Any]:
        """获取项目基本信息"""
        config = self.load_config()
        return {
            "project_name": config.get("project_name", "unknown"),
            "created_at": config.get("created_at"),
            "timezone": config.get("timezone", "UTC"),
            "coordinate_system": config.get("coordinate_system", "WGS84"),
            "ingested_file_count": len(config.get("ingested_files", [])),
            "has_merged_samples": config.get("merged_samples") is not None,
            "has_check_results": config.get("check_results") is not None,
            "review_count": len(config.get("reviews", [])),
        }


class Sample:
    """样点数据模型"""
    
    def __init__(
        self,
        sample_id: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        timestamp: Optional[datetime] = None,
        source_file: str = "",
        source_type: str = "",
        attachments: list = None,
        metadata: Dict = None,
        original_data: Dict = None
    ):
        self.sample_id = sample_id
        self.latitude = latitude
        self.longitude = longitude
        self.timestamp = timestamp
        self.source_file = source_file
        self.source_type = source_type
        self.attachments = attachments or []
        self.metadata = metadata or {}
        self.original_data = original_data or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "sample_id": self.sample_id,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "source_file": self.source_file,
            "source_type": self.source_type,
            "attachments": self.attachments,
            "metadata": self.metadata,
            "original_data": self.original_data,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Sample':
        """从字典创建"""
        timestamp = None
        if data.get("timestamp"):
            try:
                timestamp = datetime.fromisoformat(data["timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            sample_id=data.get("sample_id", ""),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            timestamp=timestamp,
            source_file=data.get("source_file", ""),
            source_type=data.get("source_type", ""),
            attachments=data.get("attachments", []),
            metadata=data.get("metadata", {}),
            original_data=data.get("original_data", {}),
        )
    
    def has_valid_coordinates(self) -> bool:
        """检查坐标是否有效"""
        if self.latitude is None or self.longitude is None:
            return False
        return -90 <= self.latitude <= 90 and -180 <= self.longitude <= 180
    
    def get_coordinate_tuple(self) -> Optional[tuple]:
        """获取坐标元组 (longitude, latitude)"""
        if self.has_valid_coordinates():
            return (self.longitude, self.latitude)
        return None
