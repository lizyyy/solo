from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import DATA_DIR, LOG_DIR
from .models import PickingResult, ChangeLog, ValidationStatus


class VersionManager:
    def __init__(self):
        self._versions: Dict[str, Dict[int, PickingResult]] = {}
        self._change_logs: List[ChangeLog] = []
        self._latest_versions: Dict[str, int] = {}
        self._storage_file = DATA_DIR / "version_data.json"
        self._log_file = LOG_DIR / "change_logs.json"
        self._load_from_storage()

    def _generate_log_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def _load_from_storage(self) -> None:
        if self._storage_file.exists():
            try:
                with open(self._storage_file, "r", encoding="utf-8") as f:
                    pass
            except Exception:
                pass

        if self._log_file.exists():
            try:
                with open(self._log_file, "r", encoding="utf-8") as f:
                    pass
            except Exception:
                pass

    def _save_to_storage(self) -> None:
        pass

    def add_results(self, results: List[PickingResult], operator: str = "system") -> None:
        for result in results:
            record_id = result.record_id
            if record_id not in self._versions:
                self._versions[record_id] = {}
                self._latest_versions[record_id] = 0

            current_version = self._latest_versions[record_id]
            new_version = current_version + 1
            result.version = new_version
            self._versions[record_id][new_version] = result
            self._latest_versions[record_id] = new_version

            log = ChangeLog(
                log_id=self._generate_log_id(),
                record_id=record_id,
                action="IMPORT",
                previous_version=current_version if current_version > 0 else None,
                new_version=new_version,
                operator=operator,
                reason="数据导入",
                details={
                    "run_id": result.run_id,
                    "batch_no": result.batch_no,
                },
            )
            self._change_logs.append(log)

    def update_record(
        self,
        record_id: str,
        updates: Dict[str, Any],
        operator: str,
        reason: str,
    ) -> Optional[PickingResult]:
        if record_id not in self._versions:
            return None

        current_version = self._latest_versions[record_id]
        current_result = self._versions[record_id][current_version]

        new_result = PickingResult(
            record_id=current_result.record_id,
            order_no=current_result.order_no,
            sku_code=current_result.sku_code,
            sku_name=current_result.sku_name,
            pick_qty=current_result.pick_qty,
            unit=current_result.unit,
            pick_location=current_result.pick_location,
            picker=current_result.picker,
            pick_time=current_result.pick_time,
            run_id=current_result.run_id,
            batch_no=current_result.batch_no,
            version=current_result.version,
            status=current_result.status,
            issues=current_result.issues.copy(),
            validation_notes=current_result.validation_notes,
            created_at=current_result.created_at,
            updated_at=datetime.now(),
            extra=current_result.extra.copy(),
        )

        for key, value in updates.items():
            if hasattr(new_result, key):
                setattr(new_result, key, value)

        new_version = current_version + 1
        new_result.version = new_version
        self._versions[record_id][new_version] = new_result
        self._latest_versions[record_id] = new_version

        log = ChangeLog(
            log_id=self._generate_log_id(),
            record_id=record_id,
            action="UPDATE",
            previous_version=current_version,
            new_version=new_version,
            operator=operator,
            reason=reason,
            details={
                "updates": updates,
            },
        )
        self._change_logs.append(log)

        return new_result

    def rollback(
        self,
        record_id: str,
        target_version: int,
        operator: str,
        reason: str,
    ) -> Optional[PickingResult]:
        if record_id not in self._versions:
            return None
        if target_version not in self._versions[record_id]:
            return None

        current_version = self._latest_versions[record_id]
        if current_version == target_version:
            return self._versions[record_id][target_version]

        target_result = self._versions[record_id][target_version]

        new_version = current_version + 1
        rolled_back_result = PickingResult(
            record_id=target_result.record_id,
            order_no=target_result.order_no,
            sku_code=target_result.sku_code,
            sku_name=target_result.sku_name,
            pick_qty=target_result.pick_qty,
            unit=target_result.unit,
            pick_location=target_result.pick_location,
            picker=target_result.picker,
            pick_time=target_result.pick_time,
            run_id=target_result.run_id,
            batch_no=target_result.batch_no,
            version=new_version,
            status=target_result.status,
            issues=target_result.issues.copy(),
            validation_notes=target_result.validation_notes,
            created_at=target_result.created_at,
            updated_at=datetime.now(),
            extra=target_result.extra.copy(),
        )

        self._versions[record_id][new_version] = rolled_back_result
        self._latest_versions[record_id] = new_version

        log = ChangeLog(
            log_id=self._generate_log_id(),
            record_id=record_id,
            action="ROLLBACK",
            previous_version=current_version,
            new_version=new_version,
            operator=operator,
            reason=reason,
            details={
                "target_version": target_version,
            },
        )
        self._change_logs.append(log)

        return rolled_back_result

    def get_latest(self, record_id: str) -> Optional[PickingResult]:
        if record_id not in self._latest_versions:
            return None
        version = self._latest_versions[record_id]
        return self._versions[record_id].get(version)

    def get_version(self, record_id: str, version: int) -> Optional[PickingResult]:
        if record_id not in self._versions:
            return None
        return self._versions[record_id].get(version)

    def get_all_latest(self) -> List[PickingResult]:
        results = []
        for record_id in self._latest_versions:
            result = self.get_latest(record_id)
            if result:
                results.append(result)
        return results

    def get_change_logs(self, record_id: str = None) -> List[ChangeLog]:
        if record_id:
            return [log for log in self._change_logs if log.record_id == record_id]
        return self._change_logs.copy()

    def get_version_history(self, record_id: str) -> List[Dict[str, Any]]:
        if record_id not in self._versions:
            return []

        history = []
        for version in sorted(self._versions[record_id].keys()):
            result = self._versions[record_id][version]
            history.append(
                {
                    "version": version,
                    "pick_qty": result.pick_qty,
                    "unit": result.unit,
                    "status": result.status.value,
                    "updated_at": result.updated_at.isoformat(),
                    "issues_count": len(result.issues),
                }
            )
        return history

    def confirm_status(
        self,
        record_id: str,
        new_status: ValidationStatus,
        operator: str,
        notes: str = "",
    ) -> Optional[PickingResult]:
        return self.update_record(
            record_id=record_id,
            updates={
                "status": new_status,
                "validation_notes": notes,
            },
            operator=operator,
            reason=f"人工复核确认状态为: {new_status.value}",
        )
