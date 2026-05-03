"""数据存储模块 - 数据持久化和审计日志"""

import json
import uuid
from dataclasses import asdict, is_dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from nickel_plating_calculator.models.data_models import (
    BatchContext,
    AuditEntry,
    RiskLevel,
    ApprovalStatus,
)


class EnhancedJSONEncoder(json.JSONEncoder):
    """增强的JSON编码器 - 支持dataclass、enum、datetime"""
    
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if is_dataclass(obj) and not isinstance(obj, type):
            return asdict(obj)
        if isinstance(obj, Path):
            return str(obj)
        return super().default(obj)


def decode_datetime(obj: Dict[str, Any]) -> Dict[str, Any]:
    """解码datetime字段"""
    for key, value in obj.items():
        if isinstance(value, str):
            try:
                obj[key] = datetime.fromisoformat(value)
            except (ValueError, TypeError):
                pass
        elif isinstance(value, dict):
            obj[key] = decode_datetime(value)
        elif isinstance(value, list):
            obj[key] = [
                decode_datetime(item) if isinstance(item, dict) else item
                for item in value
            ]
    return obj


class DataStore:
    """数据存储管理器"""
    
    def __init__(self, storage_dir: Optional[Union[str, Path]] = None):
        if storage_dir is None:
            storage_dir = Path.home() / ".nickel_plating_calculator" / "data"
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.batches_dir = self.storage_dir / "batches"
        self.batches_dir.mkdir(parents=True, exist_ok=True)
        
        self.audit_dir = self.storage_dir / "audit"
        self.audit_dir.mkdir(parents=True, exist_ok=True)
    
    def save_batch(self, context: BatchContext) -> Path:
        """保存批次数据"""
        batch_file = self.batches_dir / f"{context.batch_id}.json"
        
        data = {
            "batch_id": context.batch_id,
            "created_at": context.created_at,
            "updated_at": datetime.now(),
            "titration": context.titration,
            "tank_record": context.tank_record,
            "production": context.production,
            "concentrations": context.concentrations,
            "process_params": context.process_params,
            "inventory": context.inventory,
            "plans": context.plans,
            "approval": context.approval,
            "audit_log": context.audit_log,
        }
        
        with open(batch_file, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        return batch_file
    
    def load_batch(self, batch_id: str) -> Optional[BatchContext]:
        """加载批次数据"""
        batch_file = self.batches_dir / f"{batch_id}.json"
        
        if not batch_file.exists():
            return None
        
        with open(batch_file, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=decode_datetime)
        
        return self._reconstruct_batch_context(data)
    
    def _reconstruct_batch_context(self, data: Dict[str, Any]) -> BatchContext:
        """从字典重建BatchContext（简化版）"""
        from nickel_plating_calculator.models.data_models import (
            TitrationData, TankRecord, ProductionRecord,
            ChemicalInventory, ProcessParameters, CalculatedConcentrations,
            DosageResult, SimulatedResult, RiskItem, RiskAssessment,
            InventoryCheck, SolutionPlan, ApprovalRecord, AuditEntry,
        )
        
        context = BatchContext(
            batch_id=data["batch_id"],
            created_at=data["created_at"],
        )
        
        if data.get("titration"):
            t = data["titration"]
            context.titration = TitrationData(
                batch_id=t["batch_id"],
                timestamp=t["timestamp"],
                operator=t["operator"],
                nickel_sulfate_edta_volume=t["nickel_sulfate_edta_volume"],
                nickel_chloride_edta_volume=t["nickel_chloride_edta_volume"],
                boric_titrant_volume=t["boric_titrant_volume"],
                ph_value=t["ph_value"],
                sample_volume=t.get("sample_volume", 2.0),
                edta_concentration=t.get("edta_concentration", 0.05),
                naoh_concentration=t.get("naoh_concentration", 0.1),
            )
        
        if data.get("tank_record"):
            t = data["tank_record"]
            context.tank_record = TankRecord(
                tank_id=t["tank_id"],
                batch_id=t["batch_id"],
                timestamp=t["timestamp"],
                operator=t["operator"],
                volume_liters=t["volume_liters"],
                temperature_celsius=t["temperature_celsius"],
                current_ph=t["current_ph"],
                notes=t.get("notes", ""),
            )
        
        if data.get("production"):
            p = data["production"]
            context.production = ProductionRecord(
                batch_id=p["batch_id"],
                timestamp=p["timestamp"],
                operator=p["operator"],
                total_area_dm2=p["total_area_dm2"],
                parts_count=p["parts_count"],
                plating_time_minutes=p["plating_time_minutes"],
                estimated_nickel_consumption_g=p.get("estimated_nickel_consumption_g"),
                estimated_acid_consumption_ml=p.get("estimated_acid_consumption_ml"),
            )
        
        if data.get("concentrations"):
            c = data["concentrations"]
            context.concentrations = CalculatedConcentrations(
                batch_id=c["batch_id"],
                timestamp=c["timestamp"],
                nickel_sulfate_g_l=c["nickel_sulfate_g_l"],
                nickel_chloride_g_l=c["nickel_chloride_g_l"],
                boric_acid_g_l=c["boric_acid_g_l"],
                ph_value=c["ph_value"],
                nickel_sulfate_status=c.get("nickel_sulfate_status", "normal"),
                nickel_chloride_status=c.get("nickel_chloride_status", "normal"),
                boric_acid_status=c.get("boric_acid_status", "normal"),
                ph_status=c.get("ph_status", "normal"),
            )
        
        if data.get("process_params"):
            p = data["process_params"]
            context.process_params = ProcessParameters(
                nickel_sulfate_target_g_l=p.get("nickel_sulfate_target_g_l", 250.0),
                nickel_sulfate_min_g_l=p.get("nickel_sulfate_min_g_l", 220.0),
                nickel_sulfate_max_g_l=p.get("nickel_sulfate_max_g_l", 280.0),
                nickel_chloride_target_g_l=p.get("nickel_chloride_target_g_l", 45.0),
                nickel_chloride_min_g_l=p.get("nickel_chloride_min_g_l", 35.0),
                nickel_chloride_max_g_l=p.get("nickel_chloride_max_g_l", 55.0),
                boric_acid_target_g_l=p.get("boric_acid_target_g_l", 40.0),
                boric_acid_min_g_l=p.get("boric_acid_min_g_l", 30.0),
                boric_acid_max_g_l=p.get("boric_acid_max_g_l", 50.0),
                ph_target=p.get("ph_target", 4.2),
                ph_min=p.get("ph_min", 4.0),
                ph_max=p.get("ph_max", 4.5),
                temperature_target_c=p.get("temperature_target_c", 50.0),
                temperature_min_c=p.get("temperature_min_c", 45.0),
                temperature_max_c=p.get("temperature_max_c", 55.0),
                nickel_sulfate_purity=p.get("nickel_sulfate_purity", 0.98),
                nickel_chloride_purity=p.get("nickel_chloride_purity", 0.97),
                boric_acid_purity=p.get("boric_acid_purity", 0.99),
                sulfuric_acid_concentration=p.get("sulfuric_acid_concentration", 0.98),
                sodium_hydroxide_concentration=p.get("sodium_hydroxide_concentration", 0.30),
            )
        
        if data.get("inventory"):
            for name, inv_data in data["inventory"].items():
                context.inventory[name] = ChemicalInventory(
                    chemical_name=inv_data["chemical_name"],
                    batch_id=inv_data["batch_id"],
                    timestamp=inv_data["timestamp"],
                    operator=inv_data["operator"],
                    current_quantity_kg=inv_data["current_quantity_kg"],
                    minimum_stock_kg=inv_data["minimum_stock_kg"],
                    unit_price_per_kg=inv_data.get("unit_price_per_kg"),
                    supplier=inv_data.get("supplier", ""),
                    lot_number=inv_data.get("lot_number", ""),
                )
        
        return context
    
    def list_batches(self) -> List[str]:
        """列出所有批次ID"""
        batch_files = self.batches_dir.glob("*.json")
        return [f.stem for f in batch_files]
    
    def delete_batch(self, batch_id: str) -> bool:
        """删除批次数据"""
        batch_file = self.batches_dir / f"{batch_id}.json"
        if batch_file.exists():
            batch_file.unlink()
            return True
        return False


class AuditLogger:
    """审计日志管理器"""
    
    def __init__(self, storage_dir: Optional[Union[str, Path]] = None):
        if storage_dir is None:
            storage_dir = Path.home() / ".nickel_plating_calculator" / "audit"
        self.audit_dir = Path(storage_dir)
        self.audit_dir.mkdir(parents=True, exist_ok=True)
    
    def log_action(
        self,
        operator: str,
        action: str,
        details: Dict[str, Any],
        batch_id: Optional[str] = None,
        plan_id: Optional[str] = None,
        approval_id: Optional[str] = None,
    ) -> AuditEntry:
        """记录审计日志"""
        entry = AuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            details=details,
            batch_id=batch_id,
            plan_id=plan_id,
            approval_id=approval_id,
        )
        
        self._save_entry(entry)
        return entry
    
    def _save_entry(self, entry: AuditEntry):
        """保存审计条目"""
        date_str = entry.timestamp.strftime("%Y-%m-%d")
        daily_file = self.audit_dir / f"audit_{date_str}.jsonl"
        
        with open(daily_file, "a", encoding="utf-8") as f:
            line = json.dumps(asdict(entry), cls=EnhancedJSONEncoder, ensure_ascii=False)
            f.write(line + "\n")
    
    def query_by_batch(self, batch_id: str) -> List[AuditEntry]:
        """按批次查询审计日志"""
        entries: List[AuditEntry] = []
        
        for audit_file in sorted(self.audit_dir.glob("audit_*.jsonl")):
            with open(audit_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    data = json.loads(line, object_hook=decode_datetime)
                    if data.get("batch_id") == batch_id:
                        entries.append(self._dict_to_audit_entry(data))
        
        return entries
    
    def query_by_operator(self, operator: str) -> List[AuditEntry]:
        """按操作员查询审计日志"""
        entries: List[AuditEntry] = []
        
        for audit_file in sorted(self.audit_dir.glob("audit_*.jsonl")):
            with open(audit_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    data = json.loads(line, object_hook=decode_datetime)
                    if data.get("operator") == operator:
                        entries.append(self._dict_to_audit_entry(data))
        
        return entries
    
    def query_by_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> List[AuditEntry]:
        """按日期范围查询审计日志"""
        entries: List[AuditEntry] = []
        
        for audit_file in sorted(self.audit_dir.glob("audit_*.jsonl")):
            with open(audit_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    data = json.loads(line, object_hook=decode_datetime)
                    ts = data.get("timestamp")
                    if isinstance(ts, datetime) and start_date <= ts <= end_date:
                        entries.append(self._dict_to_audit_entry(data))
        
        return entries
    
    def _dict_to_audit_entry(self, data: Dict[str, Any]) -> AuditEntry:
        """从字典重建AuditEntry"""
        return AuditEntry(
            entry_id=data["entry_id"],
            timestamp=data["timestamp"],
            operator=data["operator"],
            action=data["action"],
            details=data.get("details", {}),
            batch_id=data.get("batch_id"),
            plan_id=data.get("plan_id"),
            approval_id=data.get("approval_id"),
        )


def to_json(obj: Any, indent: int = 2) -> str:
    """将对象转换为JSON字符串"""
    return json.dumps(obj, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=indent)


def from_json(json_str: str) -> Any:
    """从JSON字符串解析对象"""
    return json.loads(json_str, object_hook=decode_datetime)
