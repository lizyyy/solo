"""隔离区模块"""
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import AnomalyType, QuarantineItem


class QuarantineManager:
    """隔离区管理器"""
    
    QUARANTINE_FILENAME = "quarantine.json"
    
    def __init__(self, workspace_dir: Path):
        """
        初始化隔离区管理器
        
        Args:
            workspace_dir: 工作目录
        """
        self.workspace_dir = workspace_dir
        self.quarantine_dir = workspace_dir / "quarantine"
        self.quarantine_path = self.quarantine_dir / self.QUARANTINE_FILENAME
        
        # 确保目录存在
        self.quarantine_dir.mkdir(parents=True, exist_ok=True)
    
    def add(
        self,
        anomaly_type: AnomalyType,
        description: str,
        raw_data: Optional[Dict] = None,
        source_file: Optional[str] = None,
        line_number: Optional[int] = None,
        ticket_number: Optional[str] = None,
        device_id: Optional[str] = None,
        entry: Optional[str] = None,
        timestamp_str: Optional[str] = None,
    ) -> QuarantineItem:
        """
        添加隔离条目
        
        Args:
            anomaly_type: 异常类型
            description: 异常描述
            raw_data: 原始数据
            source_file: 源文件名
            line_number: 行号
            ticket_number: 票号
            device_id: 设备号
            entry: 入口
            timestamp_str: 原始时间戳字符串
            
        Returns:
            创建的隔离条目
        """
        item = QuarantineItem(
            id=str(uuid.uuid4()),
            quarantine_time=datetime.now(),
            anomaly_type=anomaly_type,
            description=description,
            raw_data=raw_data,
            source_file=source_file,
            line_number=line_number,
            ticket_number=ticket_number,
            device_id=device_id,
            entry=entry,
            timestamp_str=timestamp_str,
        )
        
        # 加载现有条目
        items = self._load_items()
        items.append(item)
        self._save_items(items)
        
        return item
    
    def add_bad_row(
        self,
        error: str,
        raw_data: Dict,
        source_file: str,
        line_number: int,
    ) -> QuarantineItem:
        """
        添加坏行（解析失败的行）到隔离区
        
        Args:
            error: 错误信息
            raw_data: 原始行数据
            source_file: 源文件名
            line_number: 行号
            
        Returns:
            创建的隔离条目
        """
        # 尝试从原始数据中提取票号
        ticket_number = None
        for key in ["票号", "ticket_number", "ticketNo", "ticket"]:
            if key in raw_data and raw_data[key]:
                ticket_number = str(raw_data[key]).strip()
                break
        
        return self.add(
            anomaly_type=AnomalyType.BAD_ROW,
            description=f"解析失败: {error}",
            raw_data=raw_data,
            source_file=source_file,
            line_number=line_number,
            ticket_number=ticket_number,
        )
    
    def add_from_anomaly(
        self,
        anomaly_type: AnomalyType,
        description: str,
        ticket_number: str,
        entry: str,
        device_id: str,
        raw_log: Optional[Dict],
        source_file: Optional[str] = None,
    ) -> QuarantineItem:
        """
        从异常记录创建隔离条目
        
        Args:
            anomaly_type: 异常类型
            description: 异常描述
            ticket_number: 票号
            entry: 入口
            device_id: 设备号
            raw_log: 原始日志数据
            source_file: 源文件名
            
        Returns:
            创建的隔离条目
        """
        return self.add(
            anomaly_type=anomaly_type,
            description=description,
            raw_data=raw_log,
            source_file=source_file,
            ticket_number=ticket_number,
            device_id=device_id,
            entry=entry,
        )
    
    def get_all(self) -> List[QuarantineItem]:
        """获取所有隔离条目"""
        return self._load_items()
    
    def get_by_type(self, anomaly_type: AnomalyType) -> List[QuarantineItem]:
        """按异常类型获取隔离条目"""
        items = self._load_items()
        return [item for item in items if item.anomaly_type == anomaly_type]
    
    def get_by_ticket(self, ticket_number: str) -> List[QuarantineItem]:
        """按票号获取隔离条目"""
        items = self._load_items()
        return [item for item in items if item.ticket_number == ticket_number]
    
    def get_unresolved(self) -> List[QuarantineItem]:
        """获取未处理的隔离条目"""
        items = self._load_items()
        return [item for item in items if not item.resolved]
    
    def resolve(
        self, 
        item_id: str, 
        resolution: str
    ) -> bool:
        """
        标记隔离条目为已处理
        
        Args:
            item_id: 条目ID
            resolution: 处理说明
            
        Returns:
            是否成功找到并标记
        """
        items = self._load_items()
        
        for item in items:
            if item.id == item_id:
                item.resolved = True
                item.resolution = resolution
                item.resolved_at = datetime.now()
                self._save_items(items)
                return True
        
        return False
    
    def clear_resolved(self) -> int:
        """
        清理已处理的隔离条目
        
        Returns:
            清理的条目数量
        """
        items = self._load_items()
        original_count = len(items)
        
        # 只保留未处理的
        items = [item for item in items if not item.resolved]
        self._save_items(items)
        
        return original_count - len(items)
    
    def get_count(self) -> int:
        """获取隔离条目总数"""
        return len(self._load_items())
    
    def get_count_by_type(self) -> Dict[AnomalyType, int]:
        """按类型统计隔离条目"""
        items = self._load_items()
        counts: Dict[AnomalyType, int] = {}
        
        for item in items:
            if item.anomaly_type not in counts:
                counts[item.anomaly_type] = 0
            counts[item.anomaly_type] += 1
        
        return counts
    
    def _load_items(self) -> List[QuarantineItem]:
        """加载隔离条目"""
        if not self.quarantine_path.exists():
            return []
        
        try:
            with open(self.quarantine_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            items = []
            for item_data in data:
                # 解析日期时间
                if "quarantine_time" in item_data:
                    item_data["quarantine_time"] = datetime.fromisoformat(
                        item_data["quarantine_time"]
                    )
                if "resolved_at" in item_data and item_data["resolved_at"]:
                    item_data["resolved_at"] = datetime.fromisoformat(
                        item_data["resolved_at"]
                    )
                
                items.append(QuarantineItem(**item_data))
            
            return items
        except (json.JSONDecodeError, ValueError, KeyError):
            return []
    
    def _save_items(self, items: List[QuarantineItem]):
        """保存隔离条目"""
        # 转换为可序列化的格式
        data = []
        for item in items:
            item_dict = item.model_dump()
            
            # 转换日期时间
            if item_dict["quarantine_time"]:
                item_dict["quarantine_time"] = item_dict["quarantine_time"].isoformat()
            if item_dict["resolved_at"]:
                item_dict["resolved_at"] = item_dict["resolved_at"].isoformat()
            
            data.append(item_dict)
        
        with open(self.quarantine_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
