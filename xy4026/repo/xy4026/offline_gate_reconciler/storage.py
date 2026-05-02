"""存储层模块"""
import json
import shutil
from dataclasses import asdict, is_dataclass
from datetime import datetime, date
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from .models import (
    HistoryRecord,
    ReconciliationResult,
    TicketLedgerEntry,
    TicketStatus,
    AnomalyType,
)


class StorageManager:
    """存储管理器"""
    
    def __init__(self, workspace_dir: Path):
        """
        初始化存储管理器
        
        Args:
            workspace_dir: 工作目录
        """
        self.workspace_dir = workspace_dir
        self.data_dir = workspace_dir / "data"
        self.output_dir = workspace_dir / "output"
        self.history_dir = workspace_dir / "history"
        self.reports_dir = self.output_dir / "reports"
        self.ledgers_dir = self.output_dir / "ledgers"
        
        # 确保目录存在
        for directory in [
            self.data_dir,
            self.data_dir / "rosters",
            self.data_dir / "logs",
            self.output_dir,
            self.reports_dir,
            self.ledgers_dir,
            self.history_dir,
        ]:
            directory.mkdir(parents=True, exist_ok=True)
    
    def save_roster(
        self, 
        source_path: Path, 
        roster_name: str
    ) -> Path:
        """
        保存票务名单
        
        Args:
            source_path: 源文件路径
            roster_name: 名单名称（不带扩展名）
            
        Returns:
            保存后的文件路径
        """
        target_path = self.data_dir / "rosters" / f"{roster_name}.csv"
        shutil.copy2(source_path, target_path)
        return target_path
    
    def save_scan_log(
        self, 
        source_path: Path, 
        log_name: str
    ) -> Path:
        """
        保存扫码日志
        
        Args:
            source_path: 源文件路径
            log_name: 日志名称（不带扩展名）
            
        Returns:
            保存后的文件路径
        """
        target_path = self.data_dir / "logs" / f"{log_name}.csv"
        shutil.copy2(source_path, target_path)
        return target_path
    
    def get_roster_files(self) -> List[Path]:
        """获取所有票务名单文件"""
        roster_dir = self.data_dir / "rosters"
        if not roster_dir.exists():
            return []
        return list(roster_dir.glob("*.csv"))
    
    def get_log_files(self) -> List[Path]:
        """获取所有扫码日志文件"""
        log_dir = self.data_dir / "logs"
        if not log_dir.exists():
            return []
        return list(log_dir.glob("*.csv"))
    
    def save_ledger(
        self,
        result: ReconciliationResult,
        filename: Optional[str] = None,
    ) -> Path:
        """
        保存台账
        
        Args:
            result: 对账结果
            filename: 文件名（不带扩展名），默认使用日期
            
        Returns:
            保存后的文件路径
        """
        if filename is None:
            filename = f"ledger_{result.event_date}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # 转换为可序列化格式
        ledger_data = {
            "event_date": result.event_date,
            "reconciliation_time": result.reconciliation_time.isoformat(),
            "summary": {
                "total_tickets": result.total_tickets,
                "tickets_scanned": result.tickets_scanned,
                "tickets_in_venue": result.tickets_in_venue,
                "tickets_exited": result.tickets_exited,
                "total_anomalies": result.total_anomalies,
                "quarantined_count": result.quarantined_count,
                "duplicate_merges": result.duplicate_merges,
            },
            "entries_by_gate": result.entries_by_gate,
            "entries_by_ticket_type": result.entries_by_ticket_type,
            "anomaly_counts": {k.value: v for k, v in result.anomaly_counts.items()},
            "stats": result.stats,
            "ledger": {
                ticket_number: self._ledger_entry_to_dict(entry)
                for ticket_number, entry in result.ledger.items()
            },
        }
        
        target_path = self.ledgers_dir / f"{filename}.json"
        
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(ledger_data, f, indent=2, ensure_ascii=False, default=self._json_default)
        
        return target_path
    
    def save_history(
        self,
        result: ReconciliationResult,
        ledger_path: Optional[Path] = None,
        report_path: Optional[Path] = None,
        anomalies_path: Optional[Path] = None,
    ) -> Path:
        """
        保存历史记录
        
        Args:
            result: 对账结果
            ledger_path: 台账文件路径
            report_path: 报告文件路径
            anomalies_path: 异常清单路径
            
        Returns:
            保存后的文件路径
        """
        history_record = HistoryRecord(
            event_date=result.event_date,
            reconciliation_time=result.reconciliation_time,
            summary={
                "total_tickets": result.total_tickets,
                "tickets_scanned": result.tickets_scanned,
                "tickets_in_venue": result.tickets_in_venue,
                "tickets_exited": result.tickets_exited,
                "total_anomalies": result.total_anomalies,
            },
            ledger_path=str(ledger_path) if ledger_path else None,
            report_path=str(report_path) if report_path else None,
            anomalies_path=str(anomalies_path) if anomalies_path else None,
            total_scans=result.stats.get("total_logs_processed", 0),
            total_anomalies=result.total_anomalies,
            quarantined_count=result.quarantined_count,
        )
        
        # 使用日期和时间作为文件名
        filename = f"history_{result.event_date}_{result.reconciliation_time.strftime('%Y%m%d_%H%M%S')}"
        target_path = self.history_dir / f"{filename}.json"
        
        # 转换为可序列化格式
        data = history_record.model_dump()
        data["reconciliation_time"] = data["reconciliation_time"].isoformat()
        
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return target_path
    
    def load_history(
        self,
        event_date: Optional[str] = None,
        entry: Optional[str] = None,
        anomaly_type: Optional[AnomalyType] = None,
    ) -> List[Dict[str, Any]]:
        """
        查询历史记录
        
        Args:
            event_date: 按日期筛选（格式：YYYY-MM-DD）
            entry: 按入口筛选
            anomaly_type: 按异常类型筛选
            
        Returns:
            匹配的历史记录列表
        """
        if not self.history_dir.exists():
            return []
        
        results = []
        
        for history_file in self.history_dir.glob("history_*.json"):
            try:
                with open(history_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                # 解析日期时间
                if "reconciliation_time" in data:
                    data["reconciliation_time"] = datetime.fromisoformat(
                        data["reconciliation_time"]
                    )
                
                # 应用筛选
                if event_date and data.get("event_date") != event_date:
                    continue
                
                # 注意：entry 和 anomaly_type 的筛选需要加载对应的台账
                # 这里只做基本筛选，详细筛选需要在对账结果中处理
                
                results.append(data)
            except (json.JSONDecodeError, KeyError, ValueError):
                continue
        
        # 按时间倒序排序
        results.sort(key=lambda x: x["reconciliation_time"], reverse=True)
        
        return results
    
    def get_latest_ledger(self) -> Optional[Dict[str, Any]]:
        """获取最新的台账"""
        ledger_files = list(self.ledgers_dir.glob("ledger_*.json"))
        if not ledger_files:
            return None
        
        # 按修改时间排序
        ledger_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        latest_path = ledger_files[0]
        
        try:
            with open(latest_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
    
    def _ledger_entry_to_dict(self, entry: TicketLedgerEntry) -> Dict[str, Any]:
        """将台账条目转换为字典"""
        return {
            "ticket_number": entry.ticket_number,
            "name": entry.name,
            "phone_last_four": entry.phone_last_four,
            "ticket_type": entry.ticket_type,
            "allowed_entries": entry.allowed_entries,
            "is_blacklisted": entry.is_blacklisted,
            "current_status": entry.current_status.value if isinstance(entry.current_status, Enum) else entry.current_status,
            "first_entry_time": entry.first_entry_time.isoformat() if entry.first_entry_time else None,
            "last_exit_time": entry.last_exit_time.isoformat() if entry.last_exit_time else None,
            "total_entries": entry.total_entries,
            "total_exits": entry.total_exits,
            "timeline": [
                {
                    "timestamp": t.timestamp.isoformat(),
                    "action": t.action.value if isinstance(t.action, Enum) else t.action,
                    "entry": t.entry,
                    "device_id": t.device_id,
                    "operator": t.operator,
                    "corrected_timestamp": t.corrected_timestamp.isoformat(),
                    "is_duplicate": t.is_duplicate,
                    "anomalies": [
                        {
                            "anomaly_type": a.anomaly_type.value if isinstance(a.anomaly_type, Enum) else a.anomaly_type,
                            "description": a.description,
                            "timestamp": a.timestamp.isoformat(),
                            "ticket_number": a.ticket_number,
                            "entry": a.entry,
                            "device_id": a.device_id,
                            "operator": a.operator,
                            "severity": a.severity,
                        }
                        for a in t.anomalies
                    ],
                }
                for t in entry.timeline
            ],
            "anomalies": [
                {
                    "anomaly_type": a.anomaly_type.value if isinstance(a.anomaly_type, Enum) else a.anomaly_type,
                    "description": a.description,
                    "timestamp": a.timestamp.isoformat(),
                    "ticket_number": a.ticket_number,
                    "entry": a.entry,
                    "device_id": a.device_id,
                    "operator": a.operator,
                    "severity": a.severity,
                }
                for a in entry.anomalies
            ],
        }
    
    def _json_default(self, obj: Any) -> Any:
        """JSON 序列化默认处理"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if is_dataclass(obj):
            return asdict(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
