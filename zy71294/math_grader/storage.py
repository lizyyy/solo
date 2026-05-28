"""数据存储与历史记录追踪模块"""

import json
import os
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import hashlib

from .error_analyzer import GradeReport


@dataclass
class GradingRecord:
    """批改记录（包含历史版本）"""
    record_id: str
    problem_id: str
    student_name: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    reports: List[Dict] = field(default_factory=list)
    current_report_index: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "problem_id": self.problem_id,
            "student_name": self.student_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "reports": self.reports,
            "current_report_index": self.current_report_index,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'GradingRecord':
        return cls(
            record_id=data["record_id"],
            problem_id=data["problem_id"],
            student_name=data.get("student_name", ""),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            reports=data.get("reports", []),
            current_report_index=data.get("current_report_index", 0),
            metadata=data.get("metadata", {})
        )
    
    def add_report(self, report_dict: Dict, note: str = "") -> None:
        """添加新的批改报告版本"""
        report_dict["version"] = len(self.reports)
        report_dict["version_note"] = note
        report_dict["graded_at"] = datetime.now().isoformat()
        self.reports.append(report_dict)
        self.current_report_index = len(self.reports) - 1
        self.updated_at = datetime.now().isoformat()
    
    def get_current_report(self) -> Optional[Dict]:
        """获取当前批改报告"""
        if self.reports and 0 <= self.current_report_index < len(self.reports):
            return self.reports[self.current_report_index]
        return None
    
    def get_report_history(self) -> List[Dict]:
        """获取报告历史列表"""
        return [
            {
                "version": i,
                "graded_at": r.get("graded_at", ""),
                "note": r.get("version_note", ""),
                "score": r.get("overall_score", 0),
                "is_correct": r.get("is_correct", False)
            }
            for i, r in enumerate(self.reports)
        ]


class RecordStorage:
    """记录存储管理器"""
    
    def __init__(self, storage_path: str = "./grading_records"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.index_file = self.storage_path / "index.json"
        self._load_index()
    
    def _load_index(self) -> None:
        """加载索引文件"""
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                self.index = json.load(f)
        else:
            self.index = {
                "records": [],
                "last_updated": datetime.now().isoformat()
            }
    
    def _save_index(self) -> None:
        """保存索引文件"""
        self.index["last_updated"] = datetime.now().isoformat()
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)
    
    def _generate_record_id(self, problem_id: str, student_name: str = "") -> str:
        """生成记录ID"""
        raw = f"{problem_id}:{student_name}:{datetime.now().isoformat()}"
        return hashlib.md5(raw.encode()).hexdigest()[:12]
    
    def _get_record_path(self, record_id: str) -> Path:
        """获取记录文件路径"""
        return self.storage_path / f"record_{record_id}.json"
    
    def create_record(
        self, 
        problem_id: str, 
        student_name: str = "",
        initial_report: Optional[Dict] = None,
        note: str = ""
    ) -> GradingRecord:
        """创建新的批改记录"""
        record_id = self._generate_record_id(problem_id, student_name)
        record = GradingRecord(
            record_id=record_id,
            problem_id=problem_id,
            student_name=student_name
        )
        
        if initial_report:
            record.add_report(initial_report, note)
        
        self._save_record(record)
        
        self.index["records"].append({
            "record_id": record_id,
            "problem_id": problem_id,
            "student_name": student_name,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "report_count": len(record.reports),
            "last_score": record.get_current_report().get("overall_score", 0) if record.reports else 0
        })
        self._save_index()
        
        return record
    
    def _save_record(self, record: GradingRecord) -> None:
        """保存单条记录"""
        record_path = self._get_record_path(record.record_id)
        with open(record_path, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_record(self, record_id: str) -> Optional[GradingRecord]:
        """加载记录"""
        record_path = self._get_record_path(record_id)
        if not record_path.exists():
            return None
        
        with open(record_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return GradingRecord.from_dict(data)
    
    def update_record(
        self, 
        record_id: str, 
        new_report: Dict, 
        note: str = ""
    ) -> Optional[GradingRecord]:
        """更新记录（添加新报告版本）"""
        record = self.load_record(record_id)
        if not record:
            return None
        
        record.add_report(new_report, note)
        self._save_record(record)
        
        for idx, r in enumerate(self.index["records"]):
            if r["record_id"] == record_id:
                self.index["records"][idx]["updated_at"] = record.updated_at
                self.index["records"][idx]["report_count"] = len(record.reports)
                self.index["records"][idx]["last_score"] = new_report.get("overall_score", 0)
                break
        self._save_index()
        
        return record
    
    def find_records(
        self,
        problem_id: Optional[str] = None,
        student_name: Optional[str] = None
    ) -> List[Dict]:
        """查找记录"""
        results = []
        for r in self.index["records"]:
            if problem_id and r["problem_id"] != problem_id:
                continue
            if student_name and student_name not in r["student_name"]:
                continue
            results.append(r)
        return results
    
    def list_all_records(self, limit: int = 100) -> List[Dict]:
        """列出所有记录"""
        records = sorted(
            self.index["records"],
            key=lambda x: x["updated_at"],
            reverse=True
        )
        return records[:limit]
    
    def delete_record(self, record_id: str) -> bool:
        """删除记录"""
        record_path = self._get_record_path(record_id)
        if not record_path.exists():
            return False
        
        record_path.unlink()
        
        self.index["records"] = [
            r for r in self.index["records"] 
            if r["record_id"] != record_id
        ]
        self._save_index()
        
        return True
    
    def export_record_to_json(self, record_id: str, output_path: str) -> bool:
        """导出单条记录为JSON"""
        record = self.load_record(record_id)
        if not record:
            return False
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
        return True
    
    def import_record_from_json(self, input_path: str) -> Optional[GradingRecord]:
        """从JSON导入记录
        
        如果记录已存在，则去重追加新版本；如果不存在，则直接导入。
        """
        if not os.path.exists(input_path):
            return None
        
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        imported_record = GradingRecord.from_dict(data)
        existing = self.load_record(imported_record.record_id)
        
        if not existing:
            record = imported_record
        else:
            existing_keys = set()
            for r in existing.reports:
                key = (r.get("graded_at", ""), r.get("overall_score", 0), r.get("is_correct", False))
                existing_keys.add(key)
            
            new_reports = []
            for r in imported_record.reports:
                key = (r.get("graded_at", ""), r.get("overall_score", 0), r.get("is_correct", False))
                if key not in existing_keys:
                    r["version"] = len(existing.reports) + len(new_reports)
                    new_reports.append(r)
            
            record = existing
            record.reports.extend(new_reports)
            record.current_report_index = len(record.reports) - 1
            record.updated_at = datetime.now().isoformat()
        
        self._save_record(record)
        
        if not existing:
            self.index["records"].append({
                "record_id": record.record_id,
                "problem_id": record.problem_id,
                "student_name": record.student_name,
                "created_at": record.created_at,
                "updated_at": record.updated_at,
                "report_count": len(record.reports),
                "last_score": record.get_current_report().get("overall_score", 0) if record.reports else 0
            })
        else:
            for idx, r in enumerate(self.index["records"]):
                if r["record_id"] == record.record_id:
                    self.index["records"][idx]["updated_at"] = record.updated_at
                    self.index["records"][idx]["report_count"] = len(record.reports)
                    self.index["records"][idx]["last_score"] = record.get_current_report().get("overall_score", 0)
                    break
        
        self._save_index()
        return record
