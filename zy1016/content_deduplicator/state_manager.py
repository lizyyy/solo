"""
状态管理模块
- 素材状态持久化到 JSON
- 支持的状态：待写、已用、先搁置
- 重新扫描时保留历史状态
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from datetime import datetime
from enum import Enum


class MaterialStatus(str, Enum):
    """
    素材状态枚举
    """
    PENDING = "pending"
    USED = "used"
    SHELVED = "shelved"
    UNSET = "unset"

    @classmethod
    def from_string(cls, value: str) -> "MaterialStatus":
        """
        从字符串转换为枚举
        """
        value_lower = value.lower()
        if value_lower in ["pending", "待写", "todo"]:
            return cls.PENDING
        elif value_lower in ["used", "已用", "done"]:
            return cls.USED
        elif value_lower in ["shelved", "搁置", "先搁置", "later"]:
            return cls.SHELVED
        else:
            return cls.UNSET

    @classmethod
    def get_display_name(cls, status: "MaterialStatus") -> str:
        """
        获取状态的显示名称
        """
        display_names = {
            cls.PENDING: "待写",
            cls.USED: "已用",
            cls.SHELVED: "先搁置",
            cls.UNSET: "未设置",
        }
        return display_names.get(status, "未设置")

    @classmethod
    def get_all_statuses(cls) -> List["MaterialStatus"]:
        """
        获取所有状态列表
        """
        return [cls.PENDING, cls.USED, cls.SHELVED, cls.UNSET]


@dataclass
class MaterialStateRecord:
    """
    素材状态记录
    """
    id: str
    status: MaterialStatus
    source_file: str
    line_number: int
    original_text: str
    created_at: str
    updated_at: str
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典（用于 JSON 序列化）
        """
        data = asdict(self)
        data["status"] = self.status.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MaterialStateRecord":
        """
        从字典创建实例
        """
        status_value = data.get("status", "unset")
        if isinstance(status_value, str):
            status = MaterialStatus.from_string(status_value)
        else:
            status = MaterialStatus.UNSET
        
        return cls(
            id=data.get("id", ""),
            status=status,
            source_file=data.get("source_file", ""),
            line_number=data.get("line_number", 0),
            original_text=data.get("original_text", ""),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            notes=data.get("notes", ""),
        )


@dataclass
class StateStorage:
    """
    状态存储（整个存储文件的结构）
    """
    version: str = "1.0"
    created_at: str = ""
    updated_at: str = ""
    source_directory: str = ""
    records: Dict[str, MaterialStateRecord] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        转换为字典
        """
        return {
            "version": self.version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "source_directory": self.source_directory,
            "records": {
                item_id: record.to_dict()
                for item_id, record in self.records.items()
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StateStorage":
        """
        从字典创建实例
        """
        records = {}
        records_data = data.get("records", {})
        for item_id, record_data in records_data.items():
            records[item_id] = MaterialStateRecord.from_dict(record_data)
        
        return cls(
            version=data.get("version", "1.0"),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            source_directory=data.get("source_directory", ""),
            records=records,
        )


class StateManager:
    """
    状态管理器
    - 加载和保存状态到 JSON
    - 管理素材状态
    - 合并新旧扫描结果
    """
    
    STATE_FILE_NAME = ".material_state.json"
    
    def __init__(self, output_directory: str, source_directory: str = ""):
        """
        初始化状态管理器
        
        Args:
            output_directory: 输出目录（状态文件存放位置）
            source_directory: 素材源目录
        """
        self.output_path = Path(output_directory).resolve()
        self.source_path = Path(source_directory).resolve() if source_directory else None
        self.state_file = self.output_path / self.STATE_FILE_NAME
        
        self.storage: Optional[StateStorage] = None
        
        self._ensure_output_directory()
        self._load_or_init()
    
    def _ensure_output_directory(self):
        """
        确保输出目录存在
        """
        if not self.output_path.exists():
            self.output_path.mkdir(parents=True, exist_ok=True)
    
    def _load_or_init(self):
        """
        加载现有状态或初始化新的
        """
        if self.state_file.exists():
            self._load()
        else:
            self._init_new()
    
    def _init_new(self):
        """
        初始化新的状态存储
        """
        now = self._get_timestamp()
        self.storage = StateStorage(
            created_at=now,
            updated_at=now,
            source_directory=str(self.source_path) if self.source_path else "",
            records={}
        )
    
    def _load(self):
        """
        从文件加载状态
        """
        try:
            with open(self.state_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.storage = StateStorage.from_dict(data)
        except (json.JSONDecodeError, KeyError) as e:
            print(f"状态文件格式错误，将创建新文件: {e}")
            self._init_new()
        except Exception as e:
            print(f"读取状态文件时出错: {e}")
            self._init_new()
    
    def _save(self):
        """
        保存状态到文件
        """
        if self.storage is None:
            return
        
        self.storage.updated_at = self._get_timestamp()
        
        try:
            with open(self.state_file, 'w', encoding='utf-8') as f:
                json.dump(self.storage.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"保存状态文件时出错: {e}")
    
    def _get_timestamp(self) -> str:
        """
        获取当前时间戳
        """
        return datetime.now().isoformat()
    
    def get_status(self, item_id: str) -> MaterialStatus:
        """
        获取素材的状态
        
        Args:
            item_id: 素材ID
            
        Returns:
            MaterialStatus: 状态
        """
        if self.storage is None:
            return MaterialStatus.UNSET
        
        record = self.storage.records.get(item_id)
        if record is None:
            return MaterialStatus.UNSET
        
        return record.status
    
    def get_record(self, item_id: str) -> Optional[MaterialStateRecord]:
        """
        获取素材的完整记录
        
        Args:
            item_id: 素材ID
            
        Returns:
            Optional[MaterialStateRecord]: 状态记录
        """
        if self.storage is None:
            return None
        
        return self.storage.records.get(item_id)
    
    def set_status(
        self,
        item_id: str,
        status: MaterialStatus,
        source_file: str = "",
        line_number: int = 0,
        original_text: str = "",
        notes: str = ""
    ) -> MaterialStateRecord:
        """
        设置素材的状态
        
        Args:
            item_id: 素材ID
            status: 状态
            source_file: 来源文件
            line_number: 行号
            original_text: 原始文本
            notes: 备注
            
        Returns:
            MaterialStateRecord: 更新后的状态记录
        """
        if self.storage is None:
            self._init_new()
        
        now = self._get_timestamp()
        
        existing = self.storage.records.get(item_id)
        
        if existing:
            existing.status = status
            existing.updated_at = now
            if notes:
                existing.notes = notes
            if source_file:
                existing.source_file = source_file
            if line_number > 0:
                existing.line_number = line_number
            if original_text:
                existing.original_text = original_text
            record = existing
        else:
            record = MaterialStateRecord(
                id=item_id,
                status=status,
                source_file=source_file,
                line_number=line_number,
                original_text=original_text,
                created_at=now,
                updated_at=now,
                notes=notes,
            )
            self.storage.records[item_id] = record
        
        self._save()
        return record
    
    def set_statuses(
        self,
        status_updates: Dict[str, MaterialStatus]
    ) -> List[MaterialStateRecord]:
        """
        批量设置状态
        
        Args:
            status_updates: item_id 到 status 的映射
            
        Returns:
            List[MaterialStateRecord]: 更新后的记录列表
        """
        updated_records = []
        
        for item_id, status in status_updates.items():
            record = self.set_status(item_id, status)
            updated_records.append(record)
        
        return updated_records
    
    def get_all_statuses(self) -> Dict[str, MaterialStatus]:
        """
        获取所有素材的状态
        
        Returns:
            Dict[str, MaterialStatus]: item_id 到状态的映射
        """
        if self.storage is None:
            return {}
        
        return {
            item_id: record.status
            for item_id, record in self.storage.records.items()
        }
    
    def get_items_by_status(self, status: MaterialStatus) -> List[str]:
        """
        获取指定状态的所有素材ID
        
        Args:
            status: 状态
            
        Returns:
            List[str]: 素材ID列表
        """
        if self.storage is None:
            return []
        
        return [
            item_id
            for item_id, record in self.storage.records.items()
            if record.status == status
        ]
    
    def merge_with_current_items(
        self,
        current_items: List["MaterialItem"],
        preserve_existing: bool = True
    ) -> Dict[str, MaterialStateRecord]:
        """
        将当前扫描的素材与现有状态合并
        
        Args:
            current_items: 当前扫描到的素材列表
            preserve_existing: 是否保留现有状态
            
        Returns:
            Dict[str, MaterialStateRecord]: 合并后的状态记录
        """
        if self.storage is None:
            self._init_new()
        
        now = self._get_timestamp()
        
        current_item_ids = {item.id for item in current_items}
        
        if not preserve_existing:
            for item_id in list(self.storage.records.keys()):
                if item_id not in current_item_ids:
                    del self.storage.records[item_id]
        
        for item in current_items:
            if item.id not in self.storage.records:
                record = MaterialStateRecord(
                    id=item.id,
                    status=MaterialStatus.UNSET,
                    source_file=item.source_file,
                    line_number=item.line_number,
                    original_text=item.text,
                    created_at=now,
                    updated_at=now,
                    notes="",
                )
                self.storage.records[item.id] = record
        
        self._save()
        
        return self.storage.records.copy()
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取状态统计
        
        Returns:
            Dict[str, Any]: 统计信息
        """
        if self.storage is None:
            return {
                "total": 0,
                "by_status": {
                    "pending": 0,
                    "used": 0,
                    "shelved": 0,
                    "unset": 0,
                }
            }
        
        stats = {
            "total": len(self.storage.records),
            "by_status": {
                "pending": 0,
                "used": 0,
                "shelved": 0,
                "unset": 0,
            }
        }
        
        for record in self.storage.records.values():
            status_key = record.status.value
            if status_key in stats["by_status"]:
                stats["by_status"][status_key] += 1
        
        return stats
    
    def import_from_dict(self, data: Dict[str, Any], merge: bool = True) -> int:
        """
        从字典导入状态
        
        Args:
            data: 状态数据
            merge: 是否与现有数据合并（False则替换）
            
        Returns:
            int: 导入的记录数
        """
        imported = StateStorage.from_dict(data)
        
        if not merge:
            self.storage = imported
        else:
            if self.storage is None:
                self.storage = imported
            else:
                for item_id, record in imported.records.items():
                    if item_id not in self.storage.records:
                        self.storage.records[item_id] = record
        
        self._save()
        return len(imported.records)
    
    def export_to_dict(self) -> Dict[str, Any]:
        """
        导出状态为字典
        
        Returns:
            Dict[str, Any]: 状态数据
        """
        if self.storage is None:
            return StateStorage().to_dict()
        
        return self.storage.to_dict()


from .reader import MaterialItem
