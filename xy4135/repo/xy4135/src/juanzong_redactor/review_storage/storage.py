"""复核存储模块 - 保存人工确认记录"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from collections import defaultdict


class ReviewStorage:
    """复核记录存储类"""
    
    REVIEW_LOG_FILE = "review_log.json"
    REVIEW_INDEX_FILE = "review_index.json"
    
    def __init__(self, storage_dir: str):
        """初始化复核存储
        
        Args:
            storage_dir: 存储目录路径
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.review_log_path = self.storage_dir / self.REVIEW_LOG_FILE
        self.review_index_path = self.storage_dir / self.REVIEW_INDEX_FILE
        
        # 加载现有数据
        self.review_log = self._load_json(self.review_log_path, default=[])
        self.review_index = self._load_json(self.review_index_path, default={})
    
    def _load_json(self, file_path: Path, default: Any = None) -> Any:
        """加载JSON文件
        
        Args:
            file_path: 文件路径
            default: 文件不存在时的默认值
        
        Returns:
            加载的数据或默认值
        """
        if file_path.exists():
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return default
        return default
    
    def _save_json(self, file_path: Path, data: Any) -> bool:
        """保存JSON文件
        
        Args:
            file_path: 文件路径
            data: 要保存的数据
        
        Returns:
            是否成功保存
        """
        try:
            # 创建备份
            if file_path.exists():
                backup_path = file_path.with_suffix(file_path.suffix + ".bak")
                import shutil
                shutil.copy2(file_path, backup_path)
            
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            return True
        except IOError:
            return False
    
    def save_review(
        self,
        item_id: str,
        status: str,
        notes: Optional[str] = None,
        reviewer: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """保存复核记录
        
        Args:
            item_id: 复核项目ID
            status: 复核状态（approved/rejected/pending）
            notes: 复核备注
            reviewer: 复核人姓名
            metadata: 附加元数据
        
        Returns:
            保存的记录
        """
        review_entry = {
            "id": self._generate_id(),
            "item_id": item_id,
            "status": status,
            "notes": notes,
            "reviewer": reviewer,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {},
        }
        
        # 添加到日志
        self.review_log.append(review_entry)
        
        # 更新索引
        if item_id not in self.review_index:
            self.review_index[item_id] = {
                "first_review": review_entry["timestamp"],
                "last_review": review_entry["timestamp"],
                "status_history": [],
                "current_status": status,
                "review_count": 0,
            }
        
        index_entry = self.review_index[item_id]
        index_entry["last_review"] = review_entry["timestamp"]
        index_entry["current_status"] = status
        index_entry["review_count"] += 1
        index_entry["status_history"].append({
            "status": status,
            "timestamp": review_entry["timestamp"],
            "reviewer": reviewer,
        })
        
        # 保存到文件
        self._save_json(self.review_log_path, self.review_log)
        self._save_json(self.review_index_path, self.review_index)
        
        return review_entry
    
    def _generate_id(self) -> str:
        """生成唯一ID
        
        Returns:
            唯一ID字符串
        """
        import uuid
        return str(uuid.uuid4())[:8]
    
    def get_review_by_item(self, item_id: str) -> List[Dict[str, Any]]:
        """获取指定项目的所有复核记录
        
        Args:
            item_id: 项目ID
        
        Returns:
            复核记录列表
        """
        return [
            entry for entry in self.review_log
            if entry.get("item_id") == item_id
        ]
    
    def get_item_status(self, item_id: str) -> Optional[Dict[str, Any]]:
        """获取项目的当前状态
        
        Args:
            item_id: 项目ID
        
        Returns:
            状态信息或None
        """
        return self.review_index.get(item_id)
    
    def get_all_reviews(
        self,
        status: Optional[str] = None,
        reviewer: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """查询所有复核记录
        
        Args:
            status: 按状态过滤
            reviewer: 按复核人过滤
            start_time: 开始时间
            end_time: 结束时间
        
        Returns:
            符合条件的复核记录列表
        """
        results = self.review_log.copy()
        
        if status:
            results = [r for r in results if r.get("status") == status]
        
        if reviewer:
            results = [r for r in results if r.get("reviewer") == reviewer]
        
        if start_time:
            results = [r for r in results if r.get("timestamp", "") >= start_time]
        
        if end_time:
            results = [r for r in results if r.get("timestamp", "") <= end_time]
        
        # 按时间倒序排列
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取复核统计信息
        
        Returns:
            统计信息字典
        """
        stats = {
            "total_reviews": len(self.review_log),
            "total_items": len(self.review_index),
            "by_status": defaultdict(int),
            "by_reviewer": defaultdict(int),
            "recent_reviews": [],
        }
        
        for entry in self.review_log:
            status = entry.get("status", "unknown")
            reviewer = entry.get("reviewer") or "unknown"
            
            stats["by_status"][status] += 1
            stats["by_reviewer"][reviewer] += 1
        
        # 获取最近10条记录
        sorted_log = sorted(
            self.review_log,
            key=lambda x: x.get("timestamp", ""),
            reverse=True
        )
        stats["recent_reviews"] = sorted_log[:10]
        
        # 转换为普通字典
        stats["by_status"] = dict(stats["by_status"])
        stats["by_reviewer"] = dict(stats["by_reviewer"])
        
        return stats
    
    def export_reviews(
        self,
        output_path: str,
        format: str = "json",
    ) -> bool:
        """导出复核记录
        
        Args:
            output_path: 输出文件路径
            format: 导出格式（json/csv）
        
        Returns:
            是否成功导出
        """
        if format == "json":
            return self._save_json(Path(output_path), self.review_log)
        elif format == "csv":
            return self._export_to_csv(output_path)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
    
    def _export_to_csv(self, output_path: str) -> bool:
        """导出到CSV文件
        
        Args:
            output_path: 输出文件路径
        
        Returns:
            是否成功
        """
        import csv
        
        if not self.review_log:
            # 没有数据，创建空文件
            with open(output_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["id", "item_id", "status", "notes", "reviewer", "timestamp"])
            return True
        
        # 获取所有字段
        all_keys = set()
        for entry in self.review_log:
            all_keys.update(entry.keys())
        
        # 定义字段顺序
        field_order = ["id", "item_id", "status", "notes", "reviewer", "timestamp"]
        for key in sorted(all_keys):
            if key not in field_order:
                field_order.append(key)
        
        try:
            with open(output_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=field_order)
                writer.writeheader()
                
                for entry in self.review_log:
                    # 处理元数据
                    row = {}
                    for key, value in entry.items():
                        if isinstance(value, dict):
                            row[key] = json.dumps(value, ensure_ascii=False)
                        else:
                            row[key] = value
                    writer.writerow(row)
            
            return True
        except IOError:
            return False
    
    def clear_all(self, confirm: bool = False) -> bool:
        """清空所有复核记录（危险操作）
        
        Args:
            confirm: 是否确认
        
        Returns:
            是否成功
        """
        if not confirm:
            raise ValueError("请设置 confirm=True 以确认清空操作")
        
        self.review_log = []
        self.review_index = {}
        
        return (
            self._save_json(self.review_log_path, self.review_log) and
            self._save_json(self.review_index_path, self.review_index)
        )
