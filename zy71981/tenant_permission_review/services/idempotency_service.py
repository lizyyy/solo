from datetime import datetime
from typing import Optional, Tuple
from uuid import uuid4

from ..storage import Database
from ..models import CallLog, EvidenceChain, EvidenceNode, RecordStatus
from ..utils import DuplicateRecordError, LateArrivalError


class IdempotencyService:
    def __init__(self, db: Database):
        self.db = db
        self._processed_keys = set()

    def check_and_register(self, log: CallLog) -> Tuple[bool, Optional[str]]:
        idempotency_key = log.generate_idempotency_key()

        existing = self.db.find_call_by_idempotency_key(idempotency_key)
        if existing:
            return False, existing.log_id

        self._processed_keys.add(idempotency_key)
        return True, None

    def check_duplicate(
        self,
        log: CallLog,
        raise_on_duplicate: bool = True,
    ) -> Tuple[bool, Optional[CallLog]]:
        idempotency_key = log.generate_idempotency_key()
        existing = self.db.find_call_by_idempotency_key(idempotency_key)

        if existing and raise_on_duplicate:
            raise DuplicateRecordError(
                idempotency_key=idempotency_key,
                existing_record_id=existing.log_id,
                existing_timestamp=existing.timestamp.isoformat(),
            )

        return existing is not None, existing

    def check_late_arrival(
        self,
        log: CallLog,
        batch_cutoff_time: datetime,
        batch_id: str,
        raise_on_late: bool = True,
    ) -> bool:
        is_late = log.timestamp < batch_cutoff_time

        if is_late and raise_on_late:
            raise LateArrivalError(
                record_id=log.log_id,
                record_timestamp=log.timestamp.isoformat(),
                expected_before=batch_cutoff_time.isoformat(),
                reference_batch=batch_id,
            )

        return is_late

    def build_duplicate_evidence_chain(
        self,
        duplicate_log: CallLog,
        existing_log: CallLog,
    ) -> EvidenceChain:
        chain = EvidenceChain(root_record_id=duplicate_log.log_id)

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="ORIGINAL_RECORD",
            timestamp=existing_log.timestamp,
            description=f"原始调用记录已成功处理",
            data_reference=f"call_log:{existing_log.log_id}",
            metadata={
                "action": existing_log.action,
                "user_id": existing_log.user_id,
                "response_status": existing_log.response_status,
            },
        ))

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="DUPLICATE_DETECTED",
            timestamp=datetime.now(),
            description=f"检测到重复调用，幂等键匹配",
            data_reference=f"idempotency:{duplicate_log.idempotency_key}",
            metadata={
                "idempotency_key": duplicate_log.idempotency_key,
                "duplicate_log_id": duplicate_log.log_id,
            },
        ))

        self.db.save_evidence_chain(chain)
        return chain

    def build_late_arrival_chain(
        self,
        late_log: CallLog,
        batch_id: str,
        batch_cutoff: datetime,
    ) -> EvidenceChain:
        chain = EvidenceChain(root_record_id=late_log.log_id)

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="BATCH_COMPLETED",
            timestamp=batch_cutoff,
            description=f"迁移批次 {batch_id} 已完成处理",
            data_reference=f"migration:{batch_id}",
            metadata={
                "batch_id": batch_id,
                "cutoff_time": batch_cutoff.isoformat(),
            },
        ))

        chain.add_node(EvidenceNode(
            node_id=str(uuid4()),
            node_type="LATE_ARRIVAL",
            timestamp=datetime.now(),
            description=f"记录到达时间晚于批次截止时间，标记为晚到",
            data_reference=f"call_log:{late_log.log_id}",
            metadata={
                "log_timestamp": late_log.timestamp.isoformat(),
                "time_diff_seconds": (batch_cutoff - late_log.timestamp).total_seconds(),
            },
        ))

        self.db.save_evidence_chain(chain)
        return chain
