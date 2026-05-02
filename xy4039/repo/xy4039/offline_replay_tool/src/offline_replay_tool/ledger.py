import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import AppConfig
from .models import (
    AuditEntry,
    BatchInfo,
    CabinetInventory,
    OrderReplayState,
    OrderStatus,
)


class InventoryState:
    def __init__(self, cabinet_id: str):
        self.cabinet_id = cabinet_id
        self.channels: Dict[str, int] = {}
        self.version: int = 0
        self.last_updated: datetime = datetime.now()

    def to_model(self) -> CabinetInventory:
        return CabinetInventory(
            cabinet_id=self.cabinet_id,
            last_updated=self.last_updated,
            channels=self.channels.copy(),
            version=self.version,
        )


class Ledger:
    def __init__(self, data_dir: Path, config: AppConfig):
        self.data_dir = data_dir
        self.config = config
        self.ledger_file = data_dir / "ledger.json"
        self.inventory_file = data_dir / "inventory.json"
        self.batches_file = data_dir / "batches.json"
        self.audit_file = data_dir / "audit.json"
        self.snapshots_dir = data_dir / "snapshots"

        self._inventories: Dict[str, InventoryState] = {}
        self._batches: Dict[str, BatchInfo] = {}
        self._applied_batches: List[str] = []
        self._audit_log: List[AuditEntry] = []

        self._load()

    def _load(self):
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

        if self.inventory_file.exists():
            try:
                with open(self.inventory_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for cabinet_id, inv_data in data.items():
                        state = InventoryState(cabinet_id)
                        state.channels = inv_data.get("channels", {})
                        state.version = inv_data.get("version", 0)
                        state.last_updated = datetime.fromisoformat(
                            inv_data.get("last_updated", datetime.now().isoformat())
                        )
                        self._inventories[cabinet_id] = state
            except (json.JSONDecodeError, KeyError) as e:
                print(f"警告: 读取库存文件失败: {e}")

        if self.batches_file.exists():
            try:
                with open(self.batches_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for batch_data in data:
                        batch = BatchInfo(
                            batch_id=batch_data["batch_id"],
                            import_time=datetime.fromisoformat(batch_data["import_time"]),
                            source_files=batch_data.get("source_files", []),
                            event_count=batch_data.get("event_count", 0),
                            valid_event_count=batch_data.get("valid_event_count", 0),
                            quarantined_count=batch_data.get("quarantined_count", 0),
                            applied=batch_data.get("applied", False),
                            applied_at=(
                                datetime.fromisoformat(batch_data["applied_at"])
                                if batch_data.get("applied_at")
                                else None
                            ),
                            dry_run=batch_data.get("dry_run", False),
                        )
                        self._batches[batch.batch_id] = batch
                        if batch.applied:
                            self._applied_batches.append(batch.batch_id)
            except (json.JSONDecodeError, KeyError) as e:
                print(f"警告: 读取批次文件失败: {e}")

        if self.audit_file.exists():
            try:
                with open(self.audit_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for entry_data in data:
                        entry = AuditEntry(
                            timestamp=datetime.fromisoformat(entry_data["timestamp"]),
                            action=entry_data["action"],
                            batch_id=entry_data["batch_id"],
                            user=entry_data.get("user", "system"),
                            details=entry_data.get("details", {}),
                        )
                        self._audit_log.append(entry)
            except (json.JSONDecodeError, KeyError) as e:
                print(f"警告: 读取审计日志失败: {e}")

    def _save(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)

        inv_data = {}
        for cabinet_id, state in self._inventories.items():
            inv_data[cabinet_id] = {
                "channels": state.channels,
                "version": state.version,
                "last_updated": state.last_updated.isoformat(),
            }
        with open(self.inventory_file, "w", encoding="utf-8") as f:
            json.dump(inv_data, f, ensure_ascii=False, indent=2)

        batches_data = []
        for batch in self._batches.values():
            batches_data.append({
                "batch_id": batch.batch_id,
                "import_time": batch.import_time.isoformat(),
                "source_files": batch.source_files,
                "event_count": batch.event_count,
                "valid_event_count": batch.valid_event_count,
                "quarantined_count": batch.quarantined_count,
                "applied": batch.applied,
                "applied_at": batch.applied_at.isoformat() if batch.applied_at else None,
                "dry_run": batch.dry_run,
            })
        with open(self.batches_file, "w", encoding="utf-8") as f:
            json.dump(batches_data, f, ensure_ascii=False, indent=2)

        audit_data = []
        for entry in self._audit_log:
            audit_data.append({
                "timestamp": entry.timestamp.isoformat(),
                "action": entry.action,
                "batch_id": entry.batch_id,
                "user": entry.user,
                "details": entry.details,
            })
        with open(self.audit_file, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

    def _create_snapshot(self, batch_id: str):
        snapshot_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{batch_id}"
        snapshot_file = self.snapshots_dir / f"snapshot_{snapshot_id}.json"

        snapshot = {
            "snapshot_id": snapshot_id,
            "created_at": datetime.now().isoformat(),
            "before_batch": batch_id,
            "inventories": {},
            "applied_batches": self._applied_batches.copy(),
        }

        for cabinet_id, state in self._inventories.items():
            snapshot["inventories"][cabinet_id] = {
                "channels": state.channels.copy(),
                "version": state.version,
                "last_updated": state.last_updated.isoformat(),
            }

        with open(snapshot_file, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)

        return snapshot_file

    def _get_latest_snapshot(self) -> Optional[Path]:
        if not self.snapshots_dir.exists():
            return None
        snapshots = sorted(
            self.snapshots_dir.glob("snapshot_*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        return snapshots[0] if snapshots else None

    def register_batch(self, batch: BatchInfo):
        self._batches[batch.batch_id] = batch
        self._audit_log.append(AuditEntry(
            timestamp=datetime.now(),
            action="import",
            batch_id=batch.batch_id,
            details={
                "source_files": batch.source_files,
                "event_count": batch.event_count,
            },
        ))
        self._save()

    def is_batch_applied(self, batch_id: str) -> bool:
        batch = self._batches.get(batch_id)
        return batch.applied if batch else False

    def get_batch(self, batch_id: str) -> Optional[BatchInfo]:
        return self._batches.get(batch_id)

    def get_all_batches(self) -> List[BatchInfo]:
        return list(self._batches.values())

    def get_applied_batches(self) -> List[str]:
        return self._applied_batches.copy()

    def apply_batch(
        self,
        batch_id: str,
        orders: List[OrderReplayState],
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        batch = self._batches.get(batch_id)
        if not batch:
            raise ValueError(f"批次不存在: {batch_id}")

        if batch.applied:
            return {
                "success": True,
                "dry_run": dry_run,
                "already_applied": True,
                "message": f"批次 {batch_id} 已应用，跳过重复应用",
            }

        if not dry_run:
            self._create_snapshot(batch_id)

        inventory_changes: Dict[str, Dict[str, int]] = {}
        for cabinet_id in self._inventories:
            inventory_changes[cabinet_id] = {}

        for order in orders:
            if order.status not in [OrderStatus.PAID, OrderStatus.CLOSED]:
                continue

            cabinet_id = order.cabinet_id
            if cabinet_id not in self._inventories:
                self._inventories[cabinet_id] = InventoryState(cabinet_id)
            if cabinet_id not in inventory_changes:
                inventory_changes[cabinet_id] = {}

            if order.has_manual_override:
                for correction in order.manual_corrections:
                    for change in correction.item_changes:
                        ch = change.channel_id
                        if ch not in self._inventories[cabinet_id].channels:
                            self._inventories[cabinet_id].channels[ch] = 0
                        self._inventories[cabinet_id].channels[ch] -= change.quantity
                        inventory_changes[cabinet_id][ch] = (
                            inventory_changes[cabinet_id].get(ch, 0) - change.quantity
                        )
            else:
                for take in order.item_takes:
                    ch = take.channel_id
                    if ch not in self._inventories[cabinet_id].channels:
                        self._inventories[cabinet_id].channels[ch] = 0
                    self._inventories[cabinet_id].channels[ch] -= take.quantity
                    inventory_changes[cabinet_id][ch] = (
                        inventory_changes[cabinet_id].get(ch, 0) - take.quantity
                    )

                for ret in order.item_returns:
                    ch = ret.channel_id
                    if ch not in self._inventories[cabinet_id].channels:
                        self._inventories[cabinet_id].channels[ch] = 0
                    self._inventories[cabinet_id].channels[ch] += ret.quantity
                    inventory_changes[cabinet_id][ch] = (
                        inventory_changes[cabinet_id].get(ch, 0) + ret.quantity
                    )

        for cabinet_id in inventory_changes:
            if inventory_changes[cabinet_id]:
                self._inventories[cabinet_id].version += 1
                self._inventories[cabinet_id].last_updated = datetime.now()

        batch.applied = True
        batch.applied_at = datetime.now()
        batch.dry_run = dry_run

        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "inventory_changes": inventory_changes,
                "orders_processed": len(orders),
                "message": "试运行完成，未实际应用更改",
            }

        self._applied_batches.append(batch_id)
        self._audit_log.append(AuditEntry(
            timestamp=datetime.now(),
            action="apply",
            batch_id=batch_id,
            details={
                "orders_processed": len(orders),
                "inventory_changes": inventory_changes,
            },
        ))
        self._save()

        return {
            "success": True,
            "dry_run": False,
            "inventory_changes": inventory_changes,
            "orders_processed": len(orders),
            "message": f"批次 {batch_id} 已应用",
        }

    def undo_last_batch(self) -> Dict[str, Any]:
        if not self._applied_batches:
            return {
                "success": False,
                "message": "没有已应用的批次可撤销",
            }

        last_batch_id = self._applied_batches[-1]
        last_batch = self._batches.get(last_batch_id)

        snapshot_file = self._get_latest_snapshot()
        if not snapshot_file:
            return {
                "success": False,
                "message": f"无法找到撤销快照，批次 {last_batch_id} 不可撤销",
            }

        try:
            with open(snapshot_file, "r", encoding="utf-8") as f:
                snapshot = json.load(f)
        except Exception as e:
            return {
                "success": False,
                "message": f"读取快照失败: {e}",
            }

        self._inventories.clear()
        for cabinet_id, inv_data in snapshot["inventories"].items():
            state = InventoryState(cabinet_id)
            state.channels = inv_data.get("channels", {})
            state.version = inv_data.get("version", 0)
            state.last_updated = datetime.fromisoformat(
                inv_data.get("last_updated", datetime.now().isoformat())
            )
            self._inventories[cabinet_id] = state

        self._applied_batches = snapshot.get("applied_batches", [])

        if last_batch:
            last_batch.applied = False
            last_batch.applied_at = None

        self._audit_log.append(AuditEntry(
            timestamp=datetime.now(),
            action="undo",
            batch_id=last_batch_id,
            details={
                "snapshot_used": str(snapshot_file),
            },
        ))
        self._save()

        snapshot_file.unlink()

        return {
            "success": True,
            "batch_id": last_batch_id,
            "message": f"已撤销批次 {last_batch_id}",
        }

    def get_inventory(self, cabinet_id: str) -> Optional[CabinetInventory]:
        if cabinet_id in self._inventories:
            return self._inventories[cabinet_id].to_model()
        return None

    def get_all_inventories(self) -> List[CabinetInventory]:
        return [state.to_model() for state in self._inventories.values()]

    def get_audit_log(self) -> List[AuditEntry]:
        return self._audit_log.copy()
