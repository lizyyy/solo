"""数据存储模块 - 基于本地JSON文件的持久化存储"""

import json
import os
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Type, TypeVar, Generic, Any
from uuid import uuid4

from pydantic import BaseModel

from ..models.base import BaseModel as MortgageBaseModel, ConflictResolution
from ..models.loan import LoanContract
from ..models.repayment import RepaymentRecord
from ..models.budget import Budget
from ..models.penalty import PenaltyRule
from ..models.goal import ClientGoal
from ..exceptions.base import ErrorContext
from ..exceptions.data_errors import DuplicateRecordError


T = TypeVar("T", bound=MortgageBaseModel)


class RecordStatus(str, Enum):
    """记录状态"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    PENDING = "pending"
    CONFLICTED = "conflicted"


class StoredRecord(BaseModel, Generic[T]):
    """存储记录包装器"""
    model_config = {"arbitrary_types_allowed": True}

    id: str
    data: T
    status: RecordStatus = RecordStatus.ACTIVE
    created_at: datetime
    updated_at: datetime
    version: int = 1
    data_type: str
    business_key: Dict[str, Any]
    conflict_info: Optional[Dict[str, Any]] = None


class DataStore:
    """数据存储"""
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self._collections: Dict[str, Dict[str, StoredRecord]] = {
            "loans": {},
            "repayments": {},
            "budgets": {},
            "penalty_rules": {},
            "goals": {},
        }

        self._indexes: Dict[str, Dict[str, str]] = {
            "loans": {},
            "repayments": {},
            "budgets": {},
            "penalty_rules": {},
            "goals": {},
        }

        self._load_all()

    def _get_collection_name(self, data_type: Type) -> str:
        """获取集合名称"""
        type_map = {
            LoanContract: "loans",
            RepaymentRecord: "repayments",
            Budget: "budgets",
            PenaltyRule: "penalty_rules",
            ClientGoal: "goals",
        }
        for cls, name in type_map.items():
            if issubclass(data_type, cls):
                return name
        raise ValueError(f"未知数据类型: {data_type}")

    def _get_business_key(self, data: T) -> Dict[str, Any]:
        """获取业务键"""
        if isinstance(data, LoanContract):
            return {"contract_no": data.contract_no}
        elif isinstance(data, RepaymentRecord):
            return {"contract_no": data.contract_no, "period_no": data.period_no}
        elif isinstance(data, Budget):
            return {"customer_id": data.customer_id, "budget_month": data.budget_month.isoformat()}
        elif isinstance(data, PenaltyRule):
            return {"contract_no": data.contract_no, "rule_name": data.rule_name}
        elif isinstance(data, ClientGoal):
            return {"customer_id": data.customer_id}
        return {"id": data.id}

    def _get_index_key(self, business_key: Dict[str, Any]) -> str:
        """生成索引键"""
        return "|".join([f"{k}={v}" for k, v in sorted(business_key.items())])

    def save(
        self,
        data: T,
        conflict_resolution: ConflictResolution = ConflictResolution.ASK,
        operator: Optional[str] = None,
    ) -> tuple[StoredRecord[T], List[DuplicateRecordError]]:
        """
        保存数据

        Args:
            data: 要保存的数据
            conflict_resolution: 冲突处理策略
            operator: 操作人

        Returns:
            (保存的记录, 冲突异常列表)
        """
        collection_name = self._get_collection_name(type(data))
        collection = self._collections[collection_name]
        index = self._indexes[collection_name]
        business_key = self._get_business_key(data)
        index_key = self._get_index_key(business_key)

        conflicts: List[DuplicateRecordError] = []
        existing_id = index.get(index_key)

        if existing_id and existing_id != data.id:
            existing = collection[existing_id]
            conflict = DuplicateRecordError(
                entity=collection_name[:-1],
                key_fields=business_key,
                existing_id=existing_id,
            )

            if conflict_resolution == ConflictResolution.SKIP:
                return existing, [conflict]
            elif conflict_resolution == ConflictResolution.ERROR:
                conflicts.append(conflict)
                return existing, conflicts
            elif conflict_resolution == ConflictResolution.UPDATE:
                data.id = existing_id
                data.version = existing.version + 1
                data.created_at = existing.created_at
                data.touch()
                if operator and hasattr(data, "record_change"):
                    for field, value in business_key.items():
                        old_val = getattr(existing.data, field, None)
                        new_val = getattr(data, field, None)
                        if old_val != new_val:
                            data.record_change(field, old_val, new_val, operator)
                conflicts.append(conflict)
            elif conflict_resolution == ConflictResolution.ASK:
                conflicts.append(conflict)
                record = StoredRecord(
                    id=data.id,
                    data=data,
                    status=RecordStatus.CONFLICTED,
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                    version=1,
                    data_type=type(data).__name__,
                    business_key=business_key,
                    conflict_info={
                        "existing_id": existing_id,
                        "existing_data": existing.data.model_dump(mode="json"),
                        "new_data": data.model_dump(mode="json"),
                    },
                )
                collection[data.id] = record
                return record, conflicts

        now = datetime.now()
        record = StoredRecord(
            id=data.id,
            data=data,
            status=RecordStatus.ACTIVE,
            created_at=data.created_at if hasattr(data, "created_at") else now,
            updated_at=now,
            version=data.version,
            data_type=type(data).__name__,
            business_key=business_key,
        )

        collection[data.id] = record
        index[index_key] = data.id

        self._save_collection(collection_name)
        return record, conflicts

    def get(self, data_type: Type[T], record_id: str) -> Optional[T]:
        """按ID获取数据"""
        collection_name = self._get_collection_name(data_type)
        collection = self._collections[collection_name]
        record = collection.get(record_id)
        return record.data if record and record.status == RecordStatus.ACTIVE else None

    def get_by_business_key(self, data_type: Type[T], **kwargs) -> Optional[T]:
        """按业务键获取数据"""
        collection_name = self._get_collection_name(data_type)
        index = self._indexes[collection_name]
        index_key = self._get_index_key(kwargs)
        record_id = index.get(index_key)
        if record_id:
            return self.get(data_type, record_id)
        return None

    def list(self, data_type: Type[T], include_archived: bool = False) -> List[T]:
        """列出所有数据"""
        collection_name = self._get_collection_name(data_type)
        collection = self._collections[collection_name]
        results = []
        for record in collection.values():
            if record.status == RecordStatus.ACTIVE or (include_archived and record.status == RecordStatus.ARCHIVED):
                results.append(record.data)
        return results

    def delete(self, data_type: Type[T], record_id: str, soft: bool = True) -> bool:
        """删除数据"""
        collection_name = self._get_collection_name(data_type)
        collection = self._collections[collection_name]
        if record_id not in collection:
            return False

        if soft:
            collection[record_id].status = RecordStatus.ARCHIVED
            collection[record_id].updated_at = datetime.now()
        else:
            record = collection.pop(record_id)
            index_key = self._get_index_key(record.business_key)
            self._indexes[collection_name].pop(index_key, None)

        self._save_collection(collection_name)
        return True

    def update_notes(self, data_type: Type[T], record_id: str, notes: str, operator: Optional[str] = None) -> bool:
        """更新备注"""
        record_data = self.get(data_type, record_id)
        if not record_data:
            return False

        old_notes = record_data.notes
        record_data.notes = notes
        record_data.touch()

        if operator and hasattr(record_data, "record_change"):
            record_data.record_change("notes", old_notes, notes, operator)

        collection_name = self._get_collection_name(data_type)
        collection = self._collections[collection_name]
        if record_id in collection:
            collection[record_id].data = record_data
            collection[record_id].updated_at = datetime.now()
            collection[record_id].version = record_data.version
            self._save_collection(collection_name)
            return True
        return False

    def confirm(self, data_type: Type[T], record_id: str, operator: str) -> bool:
        """确认数据"""
        record_data = self.get(data_type, record_id)
        if not record_data or not hasattr(record_data, "confirm"):
            return False

        record_data.confirm(operator)
        record_data.touch()

        collection_name = self._get_collection_name(data_type)
        collection = self._collections[collection_name]
        if record_id in collection:
            collection[record_id].data = record_data
            collection[record_id].updated_at = datetime.now()
            self._save_collection(collection_name)
            return True
        return False

    def resolve_conflict(
        self,
        data_type: Type[T],
        record_id: str,
        resolution: ConflictResolution,
        operator: Optional[str] = None,
    ) -> Optional[T]:
        """解决冲突"""
        collection_name = self._get_collection_name(data_type)
        collection = self._collections[collection_name]
        record = collection.get(record_id)

        if not record or record.status != RecordStatus.CONFLICTED:
            return None

        conflict_info = record.conflict_info or {}
        existing_id = conflict_info.get("existing_id")

        if resolution == ConflictResolution.UPDATE and existing_id:
            existing = collection.get(existing_id)
            if existing:
                new_data = record.data
                new_data.id = existing_id
                new_data.version = existing.version + 1
                new_data.created_at = existing.created_at
                new_data.touch()
                existing.data = new_data
                existing.updated_at = datetime.now()
                existing.version = new_data.version
                collection.pop(record_id)
                self._save_collection(collection_name)
                return new_data

        elif resolution == ConflictResolution.SKIP:
            collection.pop(record_id)
            self._save_collection(collection_name)
            return None

        record.status = RecordStatus.ACTIVE
        record.conflict_info = None
        business_key = self._get_business_key(record.data)
        index_key = self._get_index_key(business_key)
        self._indexes[collection_name][index_key] = record_id
        self._save_collection(collection_name)
        return record.data

    def get_pending_confirmations(self, data_type: Optional[Type[T]] = None) -> List[tuple[str, T]]:
        """获取待确认的数据"""
        results = []
        types = [data_type] if data_type else [LoanContract, RepaymentRecord, Budget, PenaltyRule, ClientGoal]

        for dtype in types:
            collection_name = self._get_collection_name(dtype)
            collection = self._collections[collection_name]
            for record in collection.values():
                if record.status == RecordStatus.ACTIVE:
                    data = record.data
                    if hasattr(data, "is_confirmed") and not data.is_confirmed:
                        results.append((collection_name, data))
        return results

    def get_conflicts(self, data_type: Optional[Type[T]] = None) -> List[tuple[str, StoredRecord]]:
        """获取冲突记录"""
        results = []
        types = [data_type] if data_type else [LoanContract, RepaymentRecord, Budget, PenaltyRule, ClientGoal]

        for dtype in types:
            collection_name = self._get_collection_name(dtype)
            collection = self._collections[collection_name]
            for record in collection.values():
                if record.status == RecordStatus.CONFLICTED:
                    results.append((collection_name, record))
        return results

    def get_stats(self) -> Dict[str, Any]:
        """获取存储统计"""
        stats = {}
        for name, collection in self._collections.items():
            active = sum(1 for r in collection.values() if r.status == RecordStatus.ACTIVE)
            archived = sum(1 for r in collection.values() if r.status == RecordStatus.ARCHIVED)
            conflicted = sum(1 for r in collection.values() if r.status == RecordStatus.CONFLICTED)
            stats[name] = {
                "total": len(collection),
                "active": active,
                "archived": archived,
                "conflicted": conflicted,
            }
        return stats

    def _get_file_path(self, collection_name: str) -> Path:
        """获取数据文件路径"""
        return self.data_dir / f"{collection_name}.json"

    def _save_collection(self, collection_name: str) -> None:
        """保存集合到文件"""
        file_path = self._get_file_path(collection_name)
        collection = self._collections[collection_name]

        data = {}
        for record_id, record in collection.items():
            data[record_id] = {
                "id": record.id,
                "data": record.data.model_dump(mode="json"),
                "status": record.status.value,
                "created_at": record.created_at.isoformat(),
                "updated_at": record.updated_at.isoformat(),
                "version": record.version,
                "data_type": record.data_type,
                "business_key": record.business_key,
                "conflict_info": record.conflict_info,
            }

        file_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_collection(self, collection_name: str, data_type: Type[T]) -> None:
        """从文件加载集合"""
        file_path = self._get_file_path(collection_name)
        if not file_path.exists():
            return

        try:
            raw_data = json.loads(file_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            print(f"警告: {file_path} 格式损坏，已跳过")
            return

        collection = self._collections[collection_name]
        index = self._indexes[collection_name]

        for record_id, record_data in raw_data.items():
            try:
                data = data_type.model_validate(record_data["data"])
                record = StoredRecord(
                    id=record_data["id"],
                    data=data,
                    status=RecordStatus(record_data.get("status", "active")),
                    created_at=datetime.fromisoformat(record_data["created_at"]),
                    updated_at=datetime.fromisoformat(record_data["updated_at"]),
                    version=record_data.get("version", 1),
                    data_type=record_data.get("data_type", data_type.__name__),
                    business_key=record_data.get("business_key", {}),
                    conflict_info=record_data.get("conflict_info"),
                )
                collection[record_id] = record
                if record.status == RecordStatus.ACTIVE:
                    index_key = self._get_index_key(record.business_key)
                    index[index_key] = record_id
            except Exception as e:
                print(f"警告: 加载 {collection_name} 记录 {record_id} 失败: {e}")

    def _load_all(self) -> None:
        """加载所有集合"""
        type_map = {
            "loans": LoanContract,
            "repayments": RepaymentRecord,
            "budgets": Budget,
            "penalty_rules": PenaltyRule,
            "goals": ClientGoal,
        }
        for collection_name, data_type in type_map.items():
            self._load_collection(collection_name, data_type)

    def export_all(self, export_dir: str) -> List[str]:
        """导出所有数据"""
        export_path = Path(export_dir)
        export_path.mkdir(parents=True, exist_ok=True)
        exported_files = []

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        for collection_name in self._collections.keys():
            src_file = self._get_file_path(collection_name)
            if src_file.exists():
                dst_file = export_path / f"{collection_name}_{timestamp}.json"
                dst_file.write_text(src_file.read_text(encoding="utf-8"), encoding="utf-8")
                exported_files.append(str(dst_file))

        return exported_files
