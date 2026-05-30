from datetime import datetime
from typing import Optional
from models import (
    RecordStatus,
    PriceTier,
    SightlineScoreRecord,
    ExceptionItem,
    SightlineScoreCreate,
    SightlineScoreUpdate,
)
from scoring import compute_sightline_score, compute_price_tier, compute_price_range


VALID_TRANSITIONS: dict[RecordStatus, set[RecordStatus]] = {
    RecordStatus.PENDING: {RecordStatus.PROCESSED, RecordStatus.RETURNED},
    RecordStatus.PROCESSED: {RecordStatus.PENDING, RecordStatus.RETURNED},
    RecordStatus.RETURNED: {RecordStatus.PENDING},
}


class StateMachineError(Exception):
    def __init__(self, record_id: str, from_status: RecordStatus, to_status: RecordStatus):
        self.record_id = record_id
        self.from_status = from_status
        self.to_status = to_status
        super().__init__(
            f"Invalid transition for record {record_id}: {from_status.value} -> {to_status.value}"
        )


class DuplicateSeatError(Exception):
    def __init__(self, seat_id: str, existing_record_id: str):
        self.seat_id = seat_id
        self.existing_record_id = existing_record_id
        super().__init__(
            f"Duplicate seat {seat_id}, existing record: {existing_record_id}"
        )


class PriceRangeError(Exception):
    def __init__(self, seat_id: str, tier: PriceTier, price_min: float, price_max: float, expected_min: float, expected_max: float):
        self.seat_id = seat_id
        self.tier = tier
        self.price_min = price_min
        self.price_max = price_max
        self.expected_min = expected_min
        self.expected_max = expected_max
        super().__init__(
            f"Price range [{price_min}, {price_max}] out of tier {tier.value} expected [{expected_min}, {expected_max}] for seat {seat_id}"
        )


class MissingFieldError(Exception):
    def __init__(self, record_id: str, missing_fields: list[str]):
        self.record_id = record_id
        self.missing_fields = missing_fields
        super().__init__(
            f"Record {record_id} missing required fields: {', '.join(missing_fields)}"
        )


def validate_transition(record: SightlineScoreRecord, target: RecordStatus) -> bool:
    allowed = VALID_TRANSITIONS.get(record.status, set())
    return target in allowed


class RecordStore:
    def __init__(self):
        self.records: dict[str, SightlineScoreRecord] = {}
        self.seat_index: dict[str, str] = {}
        self.exceptions: dict[str, ExceptionItem] = {}
        self._counter = 0
        self._exc_counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"REC-{self._counter:04d}"

    def _next_exc_id(self) -> str:
        self._exc_counter += 1
        return f"EXC-{self._exc_counter:04d}"

    def _add_exception(
        self,
        exception_type: str,
        detail: str,
        record_id: Optional[str] = None,
        seat_id: Optional[str] = None,
    ) -> ExceptionItem:
        item = ExceptionItem(
            item_id=self._next_exc_id(),
            record_id=record_id,
            seat_id=seat_id,
            exception_type=exception_type,
            detail=detail,
        )
        self.exceptions[item.item_id] = item
        return item

    def check_missing_fields(self, data: SightlineScoreCreate) -> list[str]:
        missing = []
        if data.score is None:
            missing.append("score")
        if data.price_tier is None:
            missing.append("price_tier")
        if data.price_min is None:
            missing.append("price_min")
        if data.price_max is None:
            missing.append("price_max")
        return missing

    def check_price_range(
        self, tier: PriceTier, price_min: float, price_max: float
    ) -> bool:
        expected_min, expected_max = compute_price_range(tier)
        return expected_min <= price_min <= expected_max and expected_min <= price_max <= expected_max

    def check_duplicate(self, seat_id: str, stage_id: str, exclude_record_id: Optional[str] = None) -> Optional[str]:
        key = f"{stage_id}:{seat_id}"
        existing_id = self.seat_index.get(key)
        if existing_id and existing_id != exclude_record_id:
            return existing_id
        return None

    def create_record(
        self,
        data: SightlineScoreCreate,
        seat_map: Optional[dict] = None,
        stage_map: Optional[dict] = None,
        obstruction_map: Optional[dict] = None,
        force_supplement: bool = False,
    ) -> SightlineScoreRecord:
        record_id = self._next_id()
        issue_tags: list[str] = []

        duplicate_id = self.check_duplicate(data.seat_id, data.stage_id)
        if duplicate_id and not data.is_supplement and not force_supplement:
            self._add_exception(
                exception_type="duplicate_seat",
                detail=f"座位 {data.seat_id} 在舞台 {data.stage_id} 已存在记录 {duplicate_id}",
                record_id=record_id,
                seat_id=data.seat_id,
            )
            issue_tags.append("duplicate_seat")
            record = SightlineScoreRecord(
                record_id=record_id,
                seat_id=data.seat_id,
                stage_id=data.stage_id,
                score=data.score,
                price_tier=data.price_tier,
                price_min=data.price_min,
                price_max=data.price_max,
                status=RecordStatus.PENDING,
                obstruction_ids=data.obstruction_ids,
                issue_tags=issue_tags,
                notes=data.notes,
                is_supplement=data.is_supplement,
                supplement_for=data.supplement_for,
            )
            self.records[record_id] = record
            self.seat_index[f"{data.stage_id}:{data.seat_id}"] = record_id
            return record

        missing = self.check_missing_fields(data)
        if missing:
            self._add_exception(
                exception_type="missing_fields",
                detail=f"记录 {record_id} 缺少字段: {', '.join(missing)}",
                record_id=record_id,
                seat_id=data.seat_id,
            )
            issue_tags.append("missing_fields")

        if data.price_tier and data.price_min is not None and data.price_max is not None:
            if not self.check_price_range(data.price_tier, data.price_min, data.price_max):
                expected_min, expected_max = compute_price_range(data.price_tier)
                self._add_exception(
                    exception_type="price_range_error",
                    detail=(
                        f"座位 {data.seat_id} 票价 [{data.price_min}, {data.price_max}] "
                        f"不在 {data.price_tier.value} 区间 [{expected_min}, {expected_max}]"
                    ),
                    record_id=record_id,
                    seat_id=data.seat_id,
                )
                issue_tags.append("price_range_error")

        if data.score is None and seat_map and stage_map and obstruction_map:
            seat = seat_map.get(data.seat_id)
            stage = stage_map.get(data.stage_id)
            obstructions = [obstruction_map[oid] for oid in data.obstruction_ids if oid in obstruction_map]
            if seat and stage:
                computed_score = compute_sightline_score(seat, stage, obstructions)
                computed_tier = compute_price_tier(computed_score)
                computed_min, computed_max = compute_price_range(computed_tier)
                record = SightlineScoreRecord(
                    record_id=record_id,
                    seat_id=data.seat_id,
                    stage_id=data.stage_id,
                    score=computed_score,
                    price_tier=computed_tier,
                    price_min=computed_min,
                    price_max=computed_max,
                    status=RecordStatus.PENDING if issue_tags else RecordStatus.PROCESSED,
                    obstruction_ids=data.obstruction_ids,
                    issue_tags=issue_tags,
                    notes=data.notes,
                    is_supplement=data.is_supplement,
                    supplement_for=data.supplement_for,
                )
                self.records[record_id] = record
                self.seat_index[f"{data.stage_id}:{data.seat_id}"] = record_id
                return record

        status = RecordStatus.PENDING if issue_tags else RecordStatus.PROCESSED
        record = SightlineScoreRecord(
            record_id=record_id,
            seat_id=data.seat_id,
            stage_id=data.stage_id,
            score=data.score,
            price_tier=data.price_tier,
            price_min=data.price_min,
            price_max=data.price_max,
            status=status,
            obstruction_ids=data.obstruction_ids,
            issue_tags=issue_tags,
            notes=data.notes,
            is_supplement=data.is_supplement,
            supplement_for=data.supplement_for,
        )
        self.records[record_id] = record
        self.seat_index[f"{data.stage_id}:{data.seat_id}"] = record_id
        return record

    def transition_status(
        self, record_id: str, target: RecordStatus, reason: Optional[str] = None
    ) -> SightlineScoreRecord:
        record = self.records.get(record_id)
        if not record:
            raise KeyError(f"Record {record_id} not found")

        if not validate_transition(record, target):
            raise StateMachineError(record_id, record.status, target)

        record.status = target
        record.updated_at = datetime.now()
        if reason:
            if record.notes:
                record.notes += f"\n[{target.value}] {reason}"
            else:
                record.notes = f"[{target.value}] {reason}"
        return record

    def withdraw_record(self, record_id: str, reason: Optional[str] = None) -> SightlineScoreRecord:
        record = self.records.get(record_id)
        if not record:
            raise KeyError(f"Record {record_id} not found")
        record.is_withdrawn = True
        record.status = RecordStatus.RETURNED
        record.updated_at = datetime.now()
        if reason:
            if record.notes:
                record.notes += f"\n[withdrawn] {reason}"
            else:
                record.notes = f"[withdrawn] {reason}"
        return record

    def update_record(self, record_id: str, update: SightlineScoreUpdate) -> SightlineScoreRecord:
        record = self.records.get(record_id)
        if not record:
            raise KeyError(f"Record {record_id} not found")

        if update.score is not None:
            record.score = update.score
        if update.price_tier is not None:
            record.price_tier = update.price_tier
        if update.price_min is not None:
            record.price_min = update.price_min
        if update.price_max is not None:
            record.price_max = update.price_max
        if update.notes is not None:
            record.notes = update.notes
        if update.obstruction_ids is not None:
            record.obstruction_ids = update.obstruction_ids

        record.revision += 1
        record.updated_at = datetime.now()

        if record.price_tier and record.price_min is not None and record.price_max is not None:
            if not self.check_price_range(record.price_tier, record.price_min, record.price_max):
                expected_min, expected_max = compute_price_range(record.price_tier)
                self._add_exception(
                    exception_type="price_range_error",
                    detail=(
                        f"座位 {record.seat_id} 更新后票价 [{record.price_min}, {record.price_max}] "
                        f"不在 {record.price_tier.value} 区间 [{expected_min}, {expected_max}]"
                    ),
                    record_id=record_id,
                    seat_id=record.seat_id,
                )
                if "price_range_error" not in record.issue_tags:
                    record.issue_tags.append("price_range_error")
                record.status = RecordStatus.PENDING

        return record

    def get_record(self, record_id: str) -> Optional[SightlineScoreRecord]:
        return self.records.get(record_id)

    def list_by_status(self, status: RecordStatus) -> list[SightlineScoreRecord]:
        return [r for r in self.records.values() if r.status == status and not r.is_withdrawn]

    def list_withdrawn(self) -> list[SightlineScoreRecord]:
        return [r for r in self.records.values() if r.is_withdrawn]

    def list_all(self) -> list[SightlineScoreRecord]:
        return list(self.records.values())

    def list_exceptions(self, resolved: Optional[bool] = None) -> list[ExceptionItem]:
        items = list(self.exceptions.values())
        if resolved is not None:
            items = [i for i in items if i.resolved == resolved]
        return items

    def resolve_exception(self, item_id: str) -> Optional[ExceptionItem]:
        item = self.exceptions.get(item_id)
        if item:
            item.resolved = True
        return item

    def get_summary(self) -> dict:
        processed = [r for r in self.records.values() if r.status == RecordStatus.PROCESSED and not r.is_withdrawn]
        pending = [r for r in self.records.values() if r.status == RecordStatus.PENDING and not r.is_withdrawn]
        returned = [r for r in self.records.values() if r.status == RecordStatus.RETURNED and not r.is_withdrawn]
        withdrawn = [r for r in self.records.values() if r.is_withdrawn]
        unresolved = [e for e in self.exceptions.values() if not e.resolved]
        return {
            "processed_count": len(processed),
            "pending_count": len(pending),
            "returned_count": len(returned),
            "withdrawn_count": len(withdrawn),
            "unresolved_exceptions": len(unresolved),
            "total_records": len(self.records),
        }
