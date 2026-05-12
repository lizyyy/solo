import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pathlib import Path


class Storage:
    """数据存储管理类"""
    
    def __init__(self, workspace: str = "."):
        self.workspace = Path(workspace).resolve()
        self.data_dir = self.workspace / ".purge_data"
        self.datasets_dir = self.data_dir / "datasets"
        self.labels_dir = self.data_dir / "labels"
        self.sensitive_dir = self.data_dir / "sensitive"
        self.history_dir = self.data_dir / "history"
        self.snapshots_dir = self.data_dir / "snapshots"
        self.reports_dir = self.data_dir / "reports"
        
    def ensure_dirs(self):
        """确保所有必要目录存在"""
        for d in [self.data_dir, self.datasets_dir, self.labels_dir, 
                  self.sensitive_dir, self.history_dir, 
                  self.snapshots_dir, self.reports_dir]:
            d.mkdir(parents=True, exist_ok=True)
    
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self.data_dir.exists()
    
    def save_dataset(self, name: str, data: Dict[str, Any]):
        """保存数据集信息"""
        path = self.datasets_dir / f"{name}.json"
        self._write_json(path, data)
    
    def load_dataset(self, name: str) -> Optional[Dict[str, Any]]:
        """加载数据集信息"""
        path = self.datasets_dir / f"{name}.json"
        return self._read_json(path)
    
    def list_datasets(self) -> List[str]:
        """列出所有数据集"""
        if not self.datasets_dir.exists():
            return []
        return [f.stem for f in self.datasets_dir.glob("*.json")]
    
    def save_labels(self, dataset_name: str, version: str, data: Dict[str, Any]):
        """保存标签文件"""
        version_dir = self.labels_dir / dataset_name
        version_dir.mkdir(parents=True, exist_ok=True)
        path = version_dir / f"{version}.json"
        self._write_json(path, data)
    
    def load_labels(self, dataset_name: str, version: str) -> Optional[Dict[str, Any]]:
        """加载标签文件"""
        path = self.labels_dir / dataset_name / f"{version}.json"
        return self._read_json(path)
    
    def list_versions(self, dataset_name: str) -> List[str]:
        """列出数据集的所有版本"""
        version_dir = self.labels_dir / dataset_name
        if not version_dir.exists():
            return []
        return [f.stem for f in version_dir.glob("*.json")]
    
    def save_sensitive_samples(self, operation_id: str, data: Dict[str, Any]):
        """保存敏感样本清单"""
        path = self.sensitive_dir / f"{operation_id}.json"
        self._write_json(path, data)
    
    def load_sensitive_samples(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """加载敏感样本清单"""
        path = self.sensitive_dir / f"{operation_id}.json"
        return self._read_json(path)
    
    def save_operation(self, operation: Dict[str, Any]):
        """保存操作历史"""
        operation_id = operation.get("id", str(uuid.uuid4()))
        path = self.history_dir / f"{operation_id}.json"
        operation["id"] = operation_id
        if "created_at" not in operation:
            operation["created_at"] = datetime.now().isoformat()
        self._write_json(path, operation)
        return operation_id
    
    def load_operation(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """加载操作历史"""
        path = self.history_dir / f"{operation_id}.json"
        return self._read_json(path)
    
    def list_operations(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出所有操作"""
        if not self.history_dir.exists():
            return []
        
        operations = []
        for f in self.history_dir.glob("*.json"):
            op = self._read_json(f)
            if op and (status is None or op.get("status") == status):
                operations.append(op)
        
        operations.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return operations
    
    def update_operation_status(self, operation_id: str, status: str, 
                                 error: Optional[str] = None):
        """更新操作状态"""
        op = self.load_operation(operation_id)
        if op:
            op["status"] = status
            op["updated_at"] = datetime.now().isoformat()
            if error:
                op["error"] = error
            self.save_operation(op)
    
    def save_snapshot(self, dataset_name: str, version: str, 
                       snapshot_type: str, data: Dict[str, Any]):
        """保存版本快照"""
        snapshot_dir = self.snapshots_dir / dataset_name / version
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = snapshot_dir / f"{snapshot_type}_{timestamp}.json"
        self._write_json(path, data)
        return str(path)
    
    def save_report(self, operation_id: str, report: Dict[str, Any]):
        """保存报告"""
        path = self.reports_dir / f"{operation_id}_report.json"
        self._write_json(path, report)
        return str(path)
    
    def load_report(self, operation_id: str) -> Optional[Dict[str, Any]]:
        """加载报告"""
        path = self.reports_dir / f"{operation_id}_report.json"
        return self._read_json(path)
    
    def _write_json(self, path: Path, data: Dict[str, Any]):
        """写入 JSON 文件"""
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _read_json(self, path: Path) -> Optional[Dict[str, Any]]:
        """读取 JSON 文件"""
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
