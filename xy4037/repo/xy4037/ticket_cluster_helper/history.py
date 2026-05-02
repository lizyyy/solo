"""
历史查询模块
负责按日期、产品线、簇标签查询历次导入和训练结果
"""

import json
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from .config import Config


@dataclass
class ImportRecord:
    import_id: str
    source_file: str
    import_time: datetime
    ticket_count: int
    valid_count: int = 0
    invalid_count: int = 0
    file_path: str = ""
    product_lines: List[str] = field(default_factory=list)
    channels: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "import_id": self.import_id,
            "source_file": self.source_file,
            "import_time": self.import_time.isoformat(),
            "ticket_count": self.ticket_count,
            "valid_count": self.valid_count,
            "invalid_count": self.invalid_count,
            "file_path": self.file_path,
            "product_lines": self.product_lines,
            "channels": self.channels
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ImportRecord':
        return cls(
            import_id=data["import_id"],
            source_file=data["source_file"],
            import_time=datetime.fromisoformat(data["import_time"]),
            ticket_count=data["ticket_count"],
            valid_count=data.get("valid_count", 0),
            invalid_count=data.get("invalid_count", 0),
            file_path=data.get("file_path", ""),
            product_lines=data.get("product_lines", []),
            channels=data.get("channels", [])
        )


@dataclass
class TrainingRecord:
    training_id: str
    training_time: datetime
    n_clusters: int
    total_tickets: int
    algorithm: str
    silhouette_score: Optional[float] = None
    cluster_tags: Dict[int, List[str]] = field(default_factory=dict)
    product_lines_covered: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "training_id": self.training_id,
            "training_time": self.training_time.isoformat(),
            "n_clusters": self.n_clusters,
            "total_tickets": self.total_tickets,
            "algorithm": self.algorithm,
            "silhouette_score": self.silhouette_score,
            "cluster_tags": {str(k): v for k, v in self.cluster_tags.items()},
            "product_lines_covered": self.product_lines_covered
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TrainingRecord':
        return cls(
            training_id=data["training_id"],
            training_time=datetime.fromisoformat(data["training_time"]),
            n_clusters=data["n_clusters"],
            total_tickets=data["total_tickets"],
            algorithm=data["algorithm"],
            silhouette_score=data.get("silhouette_score"),
            cluster_tags={int(k): v for k, v in data.get("cluster_tags", {}).items()},
            product_lines_covered=data.get("product_lines_covered", [])
        )


class HistoryManager:
    def __init__(self, config: Config):
        self.config = config
        self.history_path = config.get_history_path()
        self.import_records: List[ImportRecord] = []
        self.training_records: List[TrainingRecord] = []
        self._load()
    
    def _load(self):
        imports_file = self.history_path / "imports.json"
        if imports_file.exists():
            try:
                with open(imports_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.import_records = [ImportRecord.from_dict(r) for r in data.get("records", [])]
            except Exception:
                self.import_records = []
        
        training_file = self.history_path / "training.json"
        if training_file.exists():
            try:
                with open(training_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.training_records = [TrainingRecord.from_dict(r) for r in data.get("records", [])]
            except Exception:
                self.training_records = []
    
    def _save_imports(self):
        self.history_path.mkdir(exist_ok=True)
        imports_file = self.history_path / "imports.json"
        
        data = {
            "records": [r.to_dict() for r in self.import_records]
        }
        
        with open(imports_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _save_training(self):
        self.history_path.mkdir(exist_ok=True)
        training_file = self.history_path / "training.json"
        
        data = {
            "records": [r.to_dict() for r in self.training_records]
        }
        
        with open(training_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def add_import_record(
        self,
        import_id: str,
        source_file: str,
        import_time: datetime,
        ticket_count: int,
        valid_count: int = 0,
        invalid_count: int = 0,
        file_path: str = "",
        product_lines: List[str] = None,
        channels: List[str] = None
    ) -> ImportRecord:
        record = ImportRecord(
            import_id=import_id,
            source_file=source_file,
            import_time=import_time,
            ticket_count=ticket_count,
            valid_count=valid_count,
            invalid_count=invalid_count,
            file_path=file_path,
            product_lines=product_lines or [],
            channels=channels or []
        )
        
        self.import_records.append(record)
        self._save_imports()
        return record
    
    def add_training_record(
        self,
        training_id: str,
        training_time: datetime,
        n_clusters: int,
        total_tickets: int,
        algorithm: str,
        silhouette_score: Optional[float] = None,
        cluster_tags: Dict[int, List[str]] = None,
        product_lines_covered: List[str] = None
    ) -> TrainingRecord:
        record = TrainingRecord(
            training_id=training_id,
            training_time=training_time,
            n_clusters=n_clusters,
            total_tickets=total_tickets,
            algorithm=algorithm,
            silhouette_score=silhouette_score,
            cluster_tags=cluster_tags or {},
            product_lines_covered=product_lines_covered or []
        )
        
        self.training_records.append(record)
        self._save_training()
        return record
    
    def query_imports(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        product_line: Optional[str] = None,
        channel: Optional[str] = None,
        limit: int = 100
    ) -> List[ImportRecord]:
        results = []
        
        for record in self.import_records:
            if start_date and record.import_time.date() < start_date:
                continue
            if end_date and record.import_time.date() > end_date:
                continue
            if product_line and product_line not in record.product_lines:
                continue
            if channel and channel not in record.channels:
                continue
            
            results.append(record)
        
        results = sorted(results, key=lambda r: r.import_time, reverse=True)
        return results[:limit]
    
    def query_training(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        product_line: Optional[str] = None,
        cluster_tag: Optional[str] = None,
        limit: int = 100
    ) -> List[TrainingRecord]:
        results = []
        
        for record in self.training_records:
            if start_date and record.training_time.date() < start_date:
                continue
            if end_date and record.training_time.date() > end_date:
                continue
            if product_line and product_line not in record.product_lines_covered:
                continue
            if cluster_tag:
                has_tag = any(cluster_tag in tags for tags in record.cluster_tags.values())
                if not has_tag:
                    continue
            
            results.append(record)
        
        results = sorted(results, key=lambda r: r.training_time, reverse=True)
        return results[:limit]
    
    def get_latest_import(self) -> Optional[ImportRecord]:
        if not self.import_records:
            return None
        return max(self.import_records, key=lambda r: r.import_time)
    
    def get_latest_training(self) -> Optional[TrainingRecord]:
        if not self.training_records:
            return None
        return max(self.training_records, key=lambda r: r.training_time)
    
    def get_import_by_id(self, import_id: str) -> Optional[ImportRecord]:
        for record in self.import_records:
            if record.import_id == import_id:
                return record
        return None
    
    def get_training_by_id(self, training_id: str) -> Optional[TrainingRecord]:
        for record in self.training_records:
            if record.training_id == training_id:
                return record
        return None
    
    def get_statistics(self) -> Dict[str, Any]:
        total_imports = len(self.import_records)
        total_tickets_imported = sum(r.ticket_count for r in self.import_records)
        total_valid = sum(r.valid_count for r in self.import_records)
        total_invalid = sum(r.invalid_count for r in self.import_records)
        
        total_training = len(self.training_records)
        avg_clusters = 0.0
        if total_training > 0:
            avg_clusters = sum(r.n_clusters for r in self.training_records) / total_training
        
        all_product_lines = set()
        for record in self.import_records:
            all_product_lines.update(record.product_lines)
        
        all_channels = set()
        for record in self.import_records:
            all_channels.update(record.channels)
        
        return {
            "total_imports": total_imports,
            "total_tickets_imported": total_tickets_imported,
            "total_valid_tickets": total_valid,
            "total_invalid_tickets": total_invalid,
            "total_training_runs": total_training,
            "average_clusters_per_training": round(avg_clusters, 2),
            "product_lines_used": list(all_product_lines),
            "channels_used": list(all_channels),
            "latest_import": self.get_latest_import().to_dict() if self.get_latest_import() else None,
            "latest_training": self.get_latest_training().to_dict() if self.get_latest_training() else None
        }


def get_history_manager(config: Config) -> HistoryManager:
    return HistoryManager(config)
