from datetime import datetime
from typing import List, Optional, Tuple, Dict
import hashlib
import json

from .models import (
    DutyRecord,
    CandidateItem,
    InspectionBatch,
    HistoryRecord,
    RiskType,
    OperationType,
    OperationStatus,
    generate_id
)
from .storage import Storage


class TaskInspector:
    def __init__(self, storage: Storage):
        self.storage = storage

    def _generate_content_hash(self, records: List[DutyRecord]) -> str:
        sorted_records = sorted(records, key=lambda x: (x.date, x.engineer, x.content))
        hash_parts = []
        for r in sorted_records:
            record_dict = {
                "date": r.date,
                "engineer": r.engineer,
                "content": r.content,
                "version": r.version,
                "is_expired": r.is_expired,
                "has_version_history": "version_history" in r.metadata
            }
            hash_parts.append(json.dumps(record_dict, sort_keys=True, ensure_ascii=False))
        content = "|".join(hash_parts)
        return hashlib.md5(content.encode()).hexdigest()

    def _check_duplicate_batch(self, content_hash: str) -> Optional[InspectionBatch]:
        batches = self.storage.get_all_batches()
        for batch in batches:
            if batch.notes and batch.notes.startswith(f"hash:{content_hash}"):
                return batch
        return None

    def inspect_version_conflicts(self) -> List[CandidateItem]:
        records = self.storage.get_all_duty_records()
        candidates = []

        for record in records:
            metadata = record.metadata
            found_issue = False

            if "version_history" in metadata:
                version_history = metadata["version_history"]
                history_versions = [v["version"] for v in version_history]
                max_version = max(history_versions) if history_versions else 0

                if record.version < max_version:
                    found_issue = True
                    last_newer_update = None
                    for v_entry in version_history:
                        if v_entry["version"] == max_version:
                            last_newer_update = v_entry["updated_at"]
                            break

                    candidates.append(CandidateItem(
                        record_id=record.record_id,
                        risk_type=RiskType.OLD_VERSION_OVERWRITES_NEW,
                        description=f"记录版本(v{record.version})低于历史最高版本(v{max_version})，存在旧版本覆盖风险",
                        suggestion="建议回滚到历史最高版本，或确认当前版本是否为预期更新",
                        current_version=record.version,
                        detected_version=max_version,
                        details={
                            "date": record.date,
                            "engineer": record.engineer,
                            "last_newer_update": last_newer_update,
                            "current_update": record.last_updated.isoformat()
                        }
                    ))
            else:
                if record.is_expired and record.version < 3:
                    found_issue = True
                    candidates.append(CandidateItem(
                        record_id=record.record_id,
                        risk_type=RiskType.EXPIRED_RECORD,
                        description=f"过期记录版本过低(v{record.version})，数据可能不完整",
                        suggestion="建议清理该过期记录，或补充完整信息后保留",
                        current_version=record.version,
                        details={
                            "date": record.date,
                            "engineer": record.engineer
                        }
                    ))

            if not found_issue:
                candidates.append(CandidateItem(
                    record_id=record.record_id,
                    risk_type=RiskType.NORMAL_RECORD,
                    description="记录正常，无版本冲突问题",
                    suggestion="无需处理，保持原样",
                    current_version=record.version,
                    detected_version=None,
                    details={
                        "date": record.date,
                        "engineer": record.engineer
                    }
                ))

        return candidates

    def create_inspection_batch(self, operator: str, operation_type: OperationType) -> Tuple[InspectionBatch, Optional[str]]:
        candidates = self.inspect_version_conflicts()
        content_hash = self._generate_content_hash(self.storage.get_all_duty_records())

        duplicate_batch = self._check_duplicate_batch(content_hash)
        if duplicate_batch:
            return duplicate_batch, f"检测到相同内容批次，已复用历史结果 (批次ID: {duplicate_batch.batch_id})"

        batch = InspectionBatch(
            batch_id=generate_id(),
            operator=operator,
            operation_type=operation_type,
            created_at=datetime.now(),
            status=OperationStatus.PENDING,
            candidates=candidates,
            notes=f"hash:{content_hash}"
        )
        self.storage.save_batch(batch)
        return batch, None

    def confirm_batch(self, batch_id: str, operator: str) -> bool:
        batch = self.storage.get_batch(batch_id)
        if not batch or batch.status != OperationStatus.PENDING:
            return False

        batch.status = OperationStatus.CONFIRMED
        batch.notes += f" | 确认人:{operator} | 确认时间:{datetime.now().isoformat()}"
        self.storage.save_batch(batch)
        return True

    def execute_batch(self, batch_id: str, operator: str) -> List[HistoryRecord]:
        batch = self.storage.get_batch(batch_id)
        if not batch or batch.status != OperationStatus.CONFIRMED:
            return []

        history_records = []
        executed_at = datetime.now()

        for candidate in batch.candidates:
            record = self.storage.get_duty_record(candidate.record_id)
            if not record:
                continue

            before_state = record.to_dict()

            is_anomaly = False
            result = ""

            if candidate.risk_type == RiskType.OLD_VERSION_OVERWRITES_NEW:
                if "version_history" in record.metadata:
                    version_history = record.metadata["version_history"]
                    target_version = candidate.detected_version
                    target_entry = next((v for v in version_history if v["version"] == target_version), None)

                    if target_entry:
                        record.content = target_entry["content"]
                        record.version = target_version
                        record.last_updated = datetime.fromisoformat(target_entry["updated_at"])
                        result = f"已回滚到版本v{target_version}，内容已恢复到历史状态"
                    else:
                        is_anomaly = True
                        result = "异常：未找到目标历史版本，跳过回滚"
                else:
                    is_anomaly = True
                    result = "异常：记录缺少版本历史，无法回滚"

            elif candidate.risk_type == RiskType.EXPIRED_RECORD:
                record.is_expired = True
                record.metadata["cleaned_at"] = executed_at.isoformat()
                result = "已标记为已清理的过期记录"

            elif candidate.risk_type == RiskType.NORMAL_RECORD:
                result = "记录正常，无需处理"

            after_state = record.to_dict()
            self.storage.save_duty_record(record)

            history = HistoryRecord(
                history_id=generate_id(),
                batch_id=batch_id,
                record_id=record.record_id,
                operator=operator,
                risk_type=candidate.risk_type,
                operation_type=batch.operation_type,
                executed_at=executed_at,
                before_state=before_state,
                after_state=after_state,
                result=result,
                is_anomaly=is_anomaly,
                details={
                    "candidate_description": candidate.description,
                    "suggestion": candidate.suggestion
                }
            )
            self.storage.save_history(history)
            history_records.append(history)

        batch.status = OperationStatus.EXECUTED
        batch.executed_at = executed_at
        self.storage.save_batch(batch)

        return history_records

    def cancel_batch(self, batch_id: str, operator: str) -> bool:
        batch = self.storage.get_batch(batch_id)
        if not batch or batch.status != OperationStatus.PENDING:
            return False

        batch.status = OperationStatus.CANCELLED
        batch.notes += f" | 取消人:{operator} | 取消时间:{datetime.now().isoformat()}"
        self.storage.save_batch(batch)
        return True

    def query_history(self, batch_id: Optional[str] = None, operator: Optional[str] = None, risk_type: Optional[RiskType] = None) -> List[HistoryRecord]:
        histories = self.storage.get_all_history()
        result = []

        for h in histories:
            if batch_id and h.batch_id != batch_id:
                continue
            if operator and h.operator != operator:
                continue
            if risk_type and h.risk_type != risk_type:
                continue
            result.append(h)

        return result

    def get_traceable_history(self, history_id: str) -> Optional[Dict]:
        histories = self.storage.get_all_history()
        for h in histories:
            if h.history_id == history_id:
                return {
                    "history_id": h.history_id,
                    "batch_id": h.batch_id,
                    "record_id": h.record_id,
                    "executed_at": h.executed_at.isoformat(),
                    "operator": h.operator,
                    "risk_type": h.risk_type.value,
                    "operation_type": h.operation_type.value,
                    "result": h.result,
                    "is_anomaly": h.is_anomaly,
                    "data_erasure_application": {
                        "before_state": h.before_state,
                        "after_state": h.after_state,
                        "details": h.details
                    }
                }
        return None
