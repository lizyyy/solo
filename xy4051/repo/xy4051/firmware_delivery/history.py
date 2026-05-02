import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .executor import ExecutionJournal
from .utils import parse_datetime


@dataclass
class HistoryQuery:
    device_id: Optional[str] = None
    region: Optional[str] = None
    version: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    execution_type: Optional[str] = None


@dataclass
class HistoryResult:
    query: HistoryQuery
    total_count: int
    journals: List[Dict] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "query": {
                "device_id": self.query.device_id,
                "region": self.query.region,
                "version": self.query.version,
                "start_date": self.query.start_date,
                "end_date": self.query.end_date,
                "execution_type": self.query.execution_type
            },
            "total_count": self.total_count,
            "journals": self.journals
        }


class HistoryManager:
    def __init__(self, audit_dir: Path):
        self.audit_dir = audit_dir
    
    def _get_all_journal_paths(self) -> List[Path]:
        return sorted(
            self.audit_dir.glob("journal-*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )
    
    def _load_journal(self, path: Path) -> Optional[Dict]:
        if not path.exists():
            return None
        
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def query(self, q: HistoryQuery) -> HistoryResult:
        matching_journals: List[Dict] = []
        
        for journal_path in self._get_all_journal_paths():
            journal_data = self._load_journal(journal_path)
            if not journal_data:
                continue
            
            if self._matches_query(journal_data, q):
                matching_journals.append(journal_data)
        
        return HistoryResult(
            query=q,
            total_count=len(matching_journals),
            journals=matching_journals
        )
    
    def _matches_query(self, journal: Dict, q: HistoryQuery) -> bool:
        if q.execution_type:
            journal_type = journal.get("execution_type", "delivery")
            if q.execution_type != journal_type:
                return False
        
        if q.start_date or q.end_date:
            created_at = journal.get("completed_at") or journal.get("started_at")
            if created_at:
                try:
                    journal_date = parse_datetime(created_at).date()
                    
                    if q.start_date:
                        start_date = datetime.strptime(q.start_date, "%Y-%m-%d").date()
                        if journal_date < start_date:
                            return False
                    
                    if q.end_date:
                        end_date = datetime.strptime(q.end_date, "%Y-%m-%d").date()
                        if journal_date > end_date:
                            return False
                except (ValueError, TypeError):
                    pass
        
        if q.device_id or q.region or q.version:
            results = journal.get("results", [])
            
            if q.device_id:
                has_device = any(
                    r.get("device_id") == q.device_id for r in results
                )
                if not has_device:
                    return False
            
            if q.version:
                has_version = False
                for r in results:
                    pkg = r.get("package_id", "")
                    if q.version in pkg:
                        has_version = True
                        break
                if not has_version:
                    return False
        
        return True
    
    def format_result(self, result: HistoryResult, format_type: str = "table") -> str:
        if format_type == "json":
            import json
            return json.dumps(result.to_dict(), indent=2, ensure_ascii=False)
        
        lines = []
        
        lines.append(f"历史记录查询结果")
        lines.append(f"=" * 60)
        lines.append(f"")
        lines.append(f"查询条件:")
        if result.query.device_id:
            lines.append(f"  - 设备号: {result.query.device_id}")
        if result.query.region:
            lines.append(f"  - 区域: {result.query.region}")
        if result.query.version:
            lines.append(f"  - 版本: {result.query.version}")
        if result.query.start_date:
            lines.append(f"  - 开始日期: {result.query.start_date}")
        if result.query.end_date:
            lines.append(f"  - 结束日期: {result.query.end_date}")
        if result.query.execution_type:
            lines.append(f"  - 执行类型: {result.query.execution_type}")
        lines.append(f"")
        lines.append(f"匹配记录数: {result.total_count}")
        lines.append(f"")
        
        if result.journals:
            lines.append(f"记录明细:")
            lines.append(f"-" * 60)
            lines.append("")
            
            for journal in result.journals:
                lines.append(f"【执行ID】{journal.get('journal_id', 'N/A')}")
                lines.append(f"  类型: {journal.get('execution_type', 'delivery')}")
                lines.append(f"  计划ID: {journal.get('plan_id', 'N/A')}")
                lines.append(f"  时间: {journal.get('started_at', 'N/A')} - {journal.get('completed_at', 'N/A')}")
                lines.append(f"  结果: 成功 {journal.get('success_count', 0)}, 失败 {journal.get('failure_count', 0)}")
                
                results = journal.get("results", [])
                if results:
                    lines.append(f"  设备:")
                    for r in results[:5]:
                        status = "✅" if r.get("success") else "❌"
                        lines.append(f"    {status} {r.get('device_id')}")
                    if len(results) > 5:
                        lines.append(f"    ... 还有 {len(results) - 5} 个设备")
                lines.append("")
        
        return "\n".join(lines)
