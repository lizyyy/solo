"""回滚与人工覆盖机制模块。

处理优化过程中的特殊情况：
- 回滚机制：记录优化历史，支持撤销到之前的版本
- 重复检测：防止同一航班重复优化，或合并重复请求
- 人工覆盖：支持业务人员手动调整参数和结果
- 审计追踪：记录所有操作历史，便于追溯
"""
from __future__ import annotations

import logging
import json
import uuid
import hashlib
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .models import (
    OptimizationRequest, OptimizationResult, CabinClass
)

logger = logging.getLogger(__name__)


@dataclass
class OptimizationRecord:
    """优化记录 - 用于回滚和审计。"""
    record_id: str
    request: OptimizationRequest
    result: OptimizationResult
    created_at: datetime
    created_by: str
    status: str = "active"
    rollback_reason: Optional[str] = None
    rolled_back_at: Optional[datetime] = None
    rolled_back_by: Optional[str] = None
    parent_record_id: Optional[str] = None
    parameters_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "request": self.request.model_dump(mode='json'),
            "result": self.result.model_dump(mode='json'),
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
            "status": self.status,
            "rollback_reason": self.rollback_reason,
            "rolled_back_at": self.rolled_back_at.isoformat() if self.rolled_back_at else None,
            "rolled_back_by": self.rolled_back_by,
            "parent_record_id": self.parent_record_id,
            "parameters_hash": self.parameters_hash
        }


@dataclass
class ManualOverride:
    """人工覆盖记录。"""
    override_id: str
    record_id: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str
    applied_by: str
    applied_at: datetime
    status: str = "applied"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "override_id": self.override_id,
            "record_id": self.record_id,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "applied_by": self.applied_by,
            "applied_at": self.applied_at.isoformat(),
            "status": self.status
        }


class RollbackManager:
    """回滚管理器 - 处理回滚、重复检测和人工覆盖。"""

    def __init__(self, storage_path: Optional[str] = None):
        self.records: Dict[str, OptimizationRecord] = {}
        self.overrides: Dict[str, List[ManualOverride]] = {}
        self._request_hash_index: Dict[str, List[str]] = {}
        self._flight_index: Dict[Tuple[str, str], List[str]] = {}

        if storage_path:
            self.storage_path = Path(storage_path)
            self.storage_path.mkdir(parents=True, exist_ok=True)
            self._load_from_storage()
        else:
            self.storage_path = None

    def _generate_id(self, prefix: str = "rec") -> str:
        return f"{prefix}_{uuid.uuid4().hex[:12]}"

    def _calculate_parameters_hash(
        self,
        request: OptimizationRequest,
        flight_orders_count: int,
        no_show_count: int
    ) -> str:
        """计算参数哈希，用于检测重复请求。"""
        params = {
            "flight_no": request.flight_no,
            "flight_date": request.flight_date.isoformat(),
            "manual_override": request.manual_override,
            "override_params": request.override_params,
            "orders_count": flight_orders_count,
            "no_show_count": no_show_count
        }
        param_str = json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha256(param_str.encode()).hexdigest()[:16]

    def check_duplicate_request(
        self,
        request: OptimizationRequest,
        flight_orders_count: int,
        no_show_count: int,
        tolerance_seconds: int = 3600
    ) -> Tuple[bool, Optional[OptimizationRecord]]:
        """检测是否为重复请求。

        Args:
            request: 优化请求
            flight_orders_count: 订单数量
            no_show_count: 爽约历史数量
            tolerance_seconds: 时间容忍窗口（秒）

        Returns:
            (是否重复, 重复的记录)
        """
        params_hash = self._calculate_parameters_hash(
            request, flight_orders_count, no_show_count
        )

        matching_records = self._request_hash_index.get(params_hash, [])

        for record_id in matching_records:
            record = self.records.get(record_id)
            if not record or record.status != "active":
                continue

            time_diff = (datetime.now() - record.created_at).total_seconds()
            if time_diff <= tolerance_seconds:
                logger.info(
                    f"检测到重复请求: 航班 {request.flight_no} {request.flight_date}, "
                    f"最近一次优化在 {time_diff:.0f} 秒前"
                )
                return True, record

        return False, None

    def save_optimization(
        self,
        request: OptimizationRequest,
        result: OptimizationResult,
        created_by: str = "system",
        flight_orders_count: int = 0,
        no_show_count: int = 0,
        parent_record_id: Optional[str] = None
    ) -> OptimizationRecord:
        """保存优化结果。

        自动检测重复并建立索引。
        """
        params_hash = self._calculate_parameters_hash(
            request, flight_orders_count, no_show_count
        )

        record = OptimizationRecord(
            record_id=self._generate_id("rec"),
            request=request,
            result=result,
            created_at=datetime.now(),
            created_by=created_by,
            status="active",
            parent_record_id=parent_record_id,
            parameters_hash=params_hash
        )

        self.records[record.record_id] = record

        if params_hash not in self._request_hash_index:
            self._request_hash_index[params_hash] = []
        self._request_hash_index[params_hash].append(record.record_id)

        flight_key = (request.flight_no, request.flight_date.isoformat())
        if flight_key not in self._flight_index:
            self._flight_index[flight_key] = []
        self._flight_index[flight_key].append(record.record_id)

        self.overrides[record.record_id] = []

        if self.storage_path:
            self._save_to_storage(record)

        logger.info(
            f"优化结果已保存: {record.record_id}, "
            f"航班 {request.flight_no} {request.flight_date}"
        )

        return record

    def rollback(
        self,
        record_id: str,
        reason: str,
        rolled_back_by: str
    ) -> bool:
        """回滚指定的优化记录。

        Args:
            record_id: 要回滚的记录ID
            reason: 回滚原因
            rolled_back_by: 执行人

        Returns:
            是否回滚成功
        """
        record = self.records.get(record_id)
        if not record:
            logger.error(f"回滚失败：记录 {record_id} 不存在")
            return False

        if record.status == "rolled_back":
            logger.warning(f"记录 {record_id} 已经是回滚状态")
            return False

        record.status = "rolled_back"
        record.rollback_reason = reason
        record.rolled_back_at = datetime.now()
        record.rolled_back_by = rolled_back_by

        if self.storage_path:
            self._save_to_storage(record)

        logger.info(
            f"记录 {record_id} 已回滚, 原因: {reason}, 执行人: {rolled_back_by}"
        )
        return True

    def rollback_flight(
        self,
        flight_no: str,
        flight_date: str,
        reason: str,
        rolled_back_by: str
    ) -> List[str]:
        """回滚指定航班的所有优化记录。

        Returns:
            回滚的记录ID列表
        """
        flight_key = (flight_no, flight_date)
        record_ids = self._flight_index.get(flight_key, [])
        rolled_back = []

        for record_id in record_ids:
            if self.rollback(record_id, reason, rolled_back_by):
                rolled_back.append(record_id)

        logger.info(
            f"航班 {flight_no} {flight_date} 已回滚 {len(rolled_back)} 条记录"
        )
        return rolled_back

    def apply_manual_override(
        self,
        record_id: str,
        field_name: str,
        new_value: Any,
        reason: str,
        applied_by: str
    ) -> Optional[ManualOverride]:
        """应用人工覆盖。

        支持覆盖的字段：
        - optimal_overbooking.{舱位代码}
        - expected_no_show_rate.{舱位代码}
        - risk_level

        Args:
            record_id: 记录ID
            field_name: 字段名（支持点号嵌套）
            new_value: 新值
            reason: 覆盖原因
            applied_by: 执行人

        Returns:
            覆盖记录（如果成功）
        """
        record = self.records.get(record_id)
        if not record:
            logger.error(f"人工覆盖失败：记录 {record_id} 不存在")
            return None

        if record.status != "active":
            logger.error(f"人工覆盖失败：记录 {record_id} 状态为 {record.status}")
            return None

        old_value = self._get_nested_value(record.result, field_name)
        if old_value is None:
            logger.error(f"人工覆盖失败：字段 {field_name} 不存在")
            return None

        success = self._set_nested_value(record.result, field_name, new_value)
        if not success:
            return None

        override = ManualOverride(
            override_id=self._generate_id("ovr"),
            record_id=record_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            applied_by=applied_by,
            applied_at=datetime.now()
        )

        if record_id not in self.overrides:
            self.overrides[record_id] = []
        self.overrides[record_id].append(override)

        if self.storage_path:
            self._save_to_storage(record)
            self._save_override_to_storage(override)

        logger.info(
            f"人工覆盖已应用: {field_name} = {new_value} "
            f"(原: {old_value}), 记录: {record_id}, 原因: {reason}"
        )

        return override

    def _get_nested_value(self, obj: Any, field_path: str) -> Optional[Any]:
        """获取嵌套字段值。"""
        parts = field_path.split(".")
        current = obj

        for part in parts:
            if hasattr(current, part):
                current = getattr(current, part)
            elif isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None

        return current

    def _set_nested_value(self, obj: Any, field_path: str, value: Any) -> bool:
        """设置嵌套字段值。"""
        parts = field_path.split(".")
        current = obj

        for i, part in enumerate(parts[:-1]):
            if hasattr(current, part):
                current = getattr(current, part)
            elif isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return False

        last_part = parts[-1]
        if hasattr(current, last_part):
            if isinstance(getattr(current, last_part), dict) and isinstance(value, dict):
                for k, v in value.items():
                    if k in getattr(current, last_part):
                        try:
                            enum_val = CabinClass(k)
                            getattr(current, last_part)[enum_val] = v
                        except ValueError:
                            getattr(current, last_part)[k] = v
            else:
                setattr(current, last_part, value)
            return True
        elif isinstance(current, dict) and last_part in current:
            current[last_part] = value
            return True

        return False

    def get_flight_history(
        self,
        flight_no: str,
        flight_date: str,
        include_rolled_back: bool = False
    ) -> List[OptimizationRecord]:
        """获取航班的优化历史。"""
        flight_key = (flight_no, flight_date)
        record_ids = self._flight_index.get(flight_key, [])

        history = []
        for record_id in record_ids:
            record = self.records.get(record_id)
            if record and (include_rolled_back or record.status == "active"):
                history.append(record)

        history.sort(key=lambda r: r.created_at, reverse=True)
        return history

    def get_latest_active(
        self,
        flight_no: str,
        flight_date: str
    ) -> Optional[OptimizationRecord]:
        """获取航班最新的有效优化记录。"""
        history = self.get_flight_history(flight_no, flight_date, include_rolled_back=False)
        return history[0] if history else None

    def get_audit_trail(self, record_id: str) -> Dict[str, Any]:
        """获取记录的完整审计追踪。"""
        record = self.records.get(record_id)
        if not record:
            return {}

        overrides = self.overrides.get(record_id, [])
        parent_record = None
        if record.parent_record_id:
            parent_record = self.records.get(record.parent_record_id)

        return {
            "record": record.to_dict(),
            "manual_overrides": [o.to_dict() for o in overrides],
            "parent_record": parent_record.to_dict() if parent_record else None,
            "has_been_rolled_back": record.status == "rolled_back",
            "override_count": len(overrides)
        }

    def get_override_summary(self, record_id: str) -> List[Dict[str, Any]]:
        """获取记录的人工覆盖摘要（用于报告）。"""
        overrides = self.overrides.get(record_id, [])
        return [
            {
                "override_id": o.override_id,
                "field": o.field_name,
                "old_value": o.old_value,
                "new_value": o.new_value,
                "reason": o.reason,
                "applied_by": o.applied_by,
                "applied_at": o.applied_at.isoformat()
            }
            for o in overrides
        ]

    def _save_to_storage(self, record: OptimizationRecord):
        """保存到磁盘。"""
        if not self.storage_path:
            return
        filepath = self.storage_path / f"{record.record_id}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)

    def _save_override_to_storage(self, override: ManualOverride):
        """保存覆盖记录到磁盘。"""
        if not self.storage_path:
            return
        filepath = self.storage_path / f"override_{override.override_id}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(override.to_dict(), f, ensure_ascii=False, indent=2)

    def _load_from_storage(self):
        """从磁盘加载记录。"""
        if not self.storage_path or not self.storage_path.exists():
            return

        for filepath in self.storage_path.glob("rec_*.json"):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                record = self._reconstruct_record(data)
                if record:
                    self.records[record.record_id] = record
                    self._index_record(record)
            except Exception as e:
                logger.error(f"加载记录失败 {filepath}: {e}")

        for filepath in self.storage_path.glob("override_*.json"):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                override = self._reconstruct_override(data)
                if override:
                    if override.record_id not in self.overrides:
                        self.overrides[override.record_id] = []
                    self.overrides[override.record_id].append(override)
            except Exception as e:
                logger.error(f"加载覆盖记录失败 {filepath}: {e}")

    def _reconstruct_record(self, data: Dict[str, Any]) -> Optional[OptimizationRecord]:
        """从字典重建记录。"""
        try:
            from .models import OptimizationRequest, OptimizationResult
            request = OptimizationRequest(**data["request"])
            result = OptimizationResult(**data["result"])
            return OptimizationRecord(
                record_id=data["record_id"],
                request=request,
                result=result,
                created_at=datetime.fromisoformat(data["created_at"]),
                created_by=data["created_by"],
                status=data.get("status", "active"),
                rollback_reason=data.get("rollback_reason"),
                rolled_back_at=datetime.fromisoformat(data["rolled_back_at"]) if data.get("rolled_back_at") else None,
                rolled_back_by=data.get("rolled_back_by"),
                parent_record_id=data.get("parent_record_id"),
                parameters_hash=data.get("parameters_hash", "")
            )
        except Exception as e:
            logger.error(f"重建记录失败: {e}")
            return None

    def _reconstruct_override(self, data: Dict[str, Any]) -> Optional[ManualOverride]:
        """从字典重建覆盖记录。"""
        try:
            return ManualOverride(
                override_id=data["override_id"],
                record_id=data["record_id"],
                field_name=data["field_name"],
                old_value=data["old_value"],
                new_value=data["new_value"],
                reason=data["reason"],
                applied_by=data["applied_by"],
                applied_at=datetime.fromisoformat(data["applied_at"]),
                status=data.get("status", "applied")
            )
        except Exception as e:
            logger.error(f"重建覆盖记录失败: {e}")
            return None

    def _index_record(self, record: OptimizationRecord):
        """建立记录索引。"""
        if record.parameters_hash not in self._request_hash_index:
            self._request_hash_index[record.parameters_hash] = []
        self._request_hash_index[record.parameters_hash].append(record.record_id)

        flight_key = (record.request.flight_no, record.request.flight_date.isoformat())
        if flight_key not in self._flight_index:
            self._flight_index[flight_key] = []
        self._flight_index[flight_key].append(record.record_id)

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息。"""
        active_count = sum(1 for r in self.records.values() if r.status == "active")
        rolled_back_count = sum(1 for r in self.records.values() if r.status == "rolled_back")
        total_overrides = sum(len(os) for os in self.overrides.values())

        return {
            "total_records": len(self.records),
            "active_records": active_count,
            "rolled_back_records": rolled_back_count,
            "unique_flights": len(self._flight_index),
            "total_manual_overrides": total_overrides
        }
