from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass, field
import hashlib
import json
from sla_models import PauseRecord, PauseRequest, ResumeRequest, PauseType, Ticket, SLAStatus


@dataclass
class IdempotentResult:
    is_duplicate: bool
    existing_record: Optional[PauseRecord] = None
    new_record: Optional[PauseRecord] = None
    message: str = ""
    conflicts: List[str] = field(default_factory=list)


class IdempotentHandler:
    def __init__(self, idempotency_ttl_hours: int = 24, calendar_engine=None):
        self.idempotency_ttl_hours = idempotency_ttl_hours
        self._key_store: Dict[str, Tuple[PauseRecord, datetime]] = {}
        self._pause_records: List[PauseRecord] = []
        self._calendar_engine = calendar_engine

    def _generate_idempotency_key(self, request: PauseRequest) -> str:
        if request.idempotency_key:
            return request.idempotency_key

        key_components = {
            "ticket_id": request.ticket_id,
            "pause_type": request.pause_type.value,
            "reason": request.reason,
            "start_time": request.start_time.isoformat() if request.start_time else None,
            "operator": request.operator,
        }
        key_str = json.dumps(key_components, sort_keys=True)
        return hashlib.sha256(key_str.encode()).hexdigest()

    def _check_time_overlap(self, ticket_id: str, start_time: datetime,
                            end_time: Optional[datetime] = None) -> List[PauseRecord]:
        overlaps = []
        for record in self._pause_records:
            if record.ticket_id != ticket_id:
                continue
            if not record.is_active:
                continue

            record_end = record.end_time or datetime.max

            if start_time < record_end and (end_time is None or end_time > record.start_time):
                overlaps.append(record)

        return overlaps

    def add_existing_records(self, records: List[PauseRecord]):
        for record in records:
            self._pause_records.append(record)
            if record.idempotency_key:
                self._key_store[record.idempotency_key] = (record, datetime.now())

    def check_and_prepare_pause(self, request: PauseRequest,
                                 ticket: Ticket) -> IdempotentResult:
        idempotency_key = self._generate_idempotency_key(request)

        if idempotency_key in self._key_store:
            existing_record, stored_at = self._key_store[idempotency_key]
            ttl_expired = datetime.now() - stored_at > timedelta(hours=self.idempotency_ttl_hours)

            if not ttl_expired:
                return IdempotentResult(
                    is_duplicate=True,
                    existing_record=existing_record,
                    message="检测到重复的暂停请求，返回已有记录",
                    conflicts=[]
                )

        if ticket.status not in [SLAStatus.RUNNING, SLAStatus.WAITING_CUSTOMER]:
            return IdempotentResult(
                is_duplicate=False,
                message=f"无法在 {ticket.status.value} 状态下暂停",
                conflicts=[f"当前状态 {ticket.status.value} 不允许暂停，仅允许在 running 或 waiting_customer 状态下暂停"]
            )

        start_time = request.start_time or datetime.now()
        overlapping = self._check_time_overlap(request.ticket_id, start_time)

        if overlapping:
            conflicts = []
            for overlap in overlapping:
                overlap_end = overlap.end_time.isoformat() if overlap.end_time else "进行中"
                conflicts.append(
                    f"与现有暂停记录重叠: {overlap.pause_type.value} "
                    f"({overlap.start_time.isoformat()} ~ {overlap_end}), 原因: {overlap.reason}"
                )

            return IdempotentResult(
                is_duplicate=False,
                message="检测到时间重叠",
                conflicts=conflicts
            )

        new_record = PauseRecord(
            ticket_id=request.ticket_id,
            pause_type=request.pause_type,
            start_time=start_time,
            reason=request.reason,
            operator=request.operator,
            idempotency_key=idempotency_key,
            is_active=True
        )

        return IdempotentResult(
            is_duplicate=False,
            new_record=new_record,
            message="可以创建新的暂停记录"
        )

    def commit_pause(self, record: PauseRecord) -> PauseRecord:
        self._pause_records.append(record)
        if record.idempotency_key:
            self._key_store[record.idempotency_key] = (record, datetime.now())
        if self._calendar_engine:
            self._calendar_engine.add_pause_record(record)
        return record

    def _sync_to_calendar_engine(self, record: PauseRecord):
        if self._calendar_engine:
            for i, pr in enumerate(self._calendar_engine.pause_records):
                if pr.id == record.id:
                    self._calendar_engine.pause_records[i] = record
                    return
            self._calendar_engine.add_pause_record(record)

    def resume_pause(self, request: ResumeRequest,
                      ticket: Ticket) -> Tuple[Optional[PauseRecord], List[str]]:
        resume_time = request.resume_time or datetime.now()
        errors = []

        if ticket.status not in [SLAStatus.PAUSED, SLAStatus.WAITING_CUSTOMER]:
            errors.append(f"无法在 {ticket.status.value} 状态下恢复，仅允许在 paused 或 waiting_customer 状态下恢复")
            return None, errors

        active_pauses = [p for p in self._pause_records
                         if p.ticket_id == request.ticket_id and p.is_active]

        if not active_pauses:
            errors.append("未找到活跃的暂停记录")
            return None, errors

        if len(active_pauses) > 1:
            errors.append(f"存在 {len(active_pauses)} 条活跃暂停记录，将全部恢复")

        resumed_records = []
        for pause in active_pauses:
            if resume_time < pause.start_time:
                errors.append(f"恢复时间 {resume_time.isoformat()} 早于暂停开始时间 {pause.start_time.isoformat()}")
                continue

            pause.end_time = resume_time
            pause.is_active = False
            pause.metadata["resume_reason"] = request.reason or "手动恢复"
            pause.metadata["resume_operator"] = request.operator
            self._sync_to_calendar_engine(pause)
            resumed_records.append(pause)

        if not resumed_records:
            return None, errors

        return resumed_records[0] if len(resumed_records) == 1 else resumed_records[-1], errors

    def get_active_pauses(self, ticket_id: str) -> List[PauseRecord]:
        return [p for p in self._pause_records
                if p.ticket_id == ticket_id and p.is_active]

    def get_pause_history(self, ticket_id: str) -> List[PauseRecord]:
        return [p for p in self._pause_records if p.ticket_id == ticket_id]

    def cleanup_expired_keys(self):
        now = datetime.now()
        expired_keys = [
            key for key, (_, stored_at) in self._key_store.items()
            if now - stored_at > timedelta(hours=self.idempotency_ttl_hours)
        ]
        for key in expired_keys:
            del self._key_store[key]
        return len(expired_keys)

    def force_pause(self, request: PauseRequest, ticket: Ticket) -> IdempotentResult:
        active_pauses = self.get_active_pauses(request.ticket_id)
        resume_time = request.start_time or datetime.now()

        for pause in active_pauses:
            pause.end_time = resume_time
            pause.is_active = False
            pause.metadata["superceded_by"] = "force_pause"
            self._sync_to_calendar_engine(pause)

        new_record = PauseRecord(
            ticket_id=request.ticket_id,
            pause_type=request.pause_type,
            start_time=resume_time,
            reason=request.reason + " (强制暂停，已覆盖之前的暂停)",
            operator=request.operator,
            idempotency_key=self._generate_idempotency_key(request),
            is_active=True,
            metadata={"force_pause": True, "previous_active_count": len(active_pauses)}
        )

        self._pause_records.append(new_record)
        self._sync_to_calendar_engine(new_record)

        return IdempotentResult(
            is_duplicate=False,
            new_record=new_record,
            message=f"强制暂停成功，已结束 {len(active_pauses)} 条活跃暂停记录",
            conflicts=[f"已结束之前的活跃暂停记录"] if active_pauses else []
        )
