from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
import uuid
from collections import defaultdict

from models import (
    Reader, BookCopy, Reservation, OverdueRecord, FlowReport,
    PickupWindow, ReservationStatus, CopyStatus, ReaderType
)


class ReservationEngine:
    def __init__(self):
        self.readers: Dict[str, Reader] = {}
        self.copies: Dict[str, BookCopy] = {}
        self.reservations: Dict[str, Reservation] = {}
        self.overdue_records: Dict[str, OverdueRecord] = {}
        self.pickup_windows: Dict[str, PickupWindow] = {}
        self.copy_reservation_map: Dict[str, List[str]] = defaultdict(list)
        self.reader_reservation_map: Dict[str, List[str]] = defaultdict(list)

    def add_reader(self, reader: Reader) -> bool:
        if reader.reader_id in self.readers:
            return False
        self.readers[reader.reader_id] = reader
        return True

    def add_copy(self, copy: BookCopy) -> bool:
        if copy.copy_id in self.copies:
            return False
        self.copies[copy.copy_id] = copy
        return True

    def add_pickup_window(self, window: PickupWindow) -> bool:
        if window.window_id in self.pickup_windows:
            return False
        self.pickup_windows[window.window_id] = window
        return True

    def has_active_reservation(self, reader_id: str, copy_id: str) -> bool:
        for res_id in self.reader_reservation_map.get(reader_id, []):
            res = self.reservations.get(res_id)
            if res and res.copy_id == copy_id and res.status in [
                ReservationStatus.PENDING,
                ReservationStatus.LOCKED
            ]:
                return True
        return False

    def create_reservation(self, reader_id: str, copy_id: str, 
                           status: ReservationStatus = ReservationStatus.PENDING,
                           created_at: datetime = None,
                           locked_until: datetime = None,
                           picked_up_at: datetime = None,
                           expired_at: datetime = None) -> Optional[Reservation]:
        if reader_id not in self.readers:
            return None
        if copy_id not in self.copies:
            return None
        
        if self.has_active_reservation(reader_id, copy_id) and status == ReservationStatus.PENDING:
            for res_id in self.reader_reservation_map[reader_id]:
                res = self.reservations[res_id]
                if res.copy_id == copy_id and res.status in [
                    ReservationStatus.PENDING, ReservationStatus.LOCKED
                ]:
                    return res

        reservation_id = f"RES-{uuid.uuid4().hex[:8].upper()}"
        actual_created = created_at if created_at else datetime.now()
        reservation = Reservation(
            reservation_id=reservation_id,
            reader_id=reader_id,
            copy_id=copy_id,
            status=status,
            created_at=actual_created,
            locked_until=locked_until,
            picked_up_at=picked_up_at,
            expired_at=expired_at
        )

        self.reservations[reservation_id] = reservation
        self.copy_reservation_map[copy_id].append(reservation_id)
        self.reader_reservation_map[reader_id].append(reservation_id)
        
        if status == ReservationStatus.LOCKED and locked_until:
            copy = self.copies[copy_id]
            copy.status = CopyStatus.RESERVED
            copy.current_reservation_id = reservation_id
        
        self._rebuild_queue(copy_id)
        return reservation

    def simulate_expire_locked(self, hours_ago: int = 25) -> int:
        expired_time = datetime.now() - timedelta(hours=hours_ago)
        count = 0
        for res in self.reservations.values():
            if res.status == ReservationStatus.PENDING:
                res.status = ReservationStatus.LOCKED
                res.locked_until = expired_time
                copy = self.copies.get(res.copy_id)
                if copy:
                    copy.status = CopyStatus.RESERVED
                    copy.current_reservation_id = res.reservation_id
                count += 1
        return count

    def _rebuild_queue(self, copy_id: str) -> None:
        reservation_ids = self.copy_reservation_map.get(copy_id, [])
        pending_reservations = []
        
        for res_id in reservation_ids:
            res = self.reservations.get(res_id)
            if res and res.status == ReservationStatus.PENDING:
                pending_reservations.append(res)
        
        pending_reservations.sort(
            key=lambda r: (
                -self.readers[r.reader_id].get_priority(),
                r.created_at
            )
        )
        
        for idx, res in enumerate(pending_reservations, 1):
            res.queue_position = idx

    def lock_reservation(self, reservation_id: str, window_id: str, 
                         lock_hours: int = 24) -> bool:
        if reservation_id not in self.reservations:
            return False
        if window_id not in self.pickup_windows:
            return False

        res = self.reservations[reservation_id]
        if res.status != ReservationStatus.PENDING:
            return False

        copy = self.copies[res.copy_id]
        if copy.status != CopyStatus.AVAILABLE:
            return False

        res.status = ReservationStatus.LOCKED
        res.pickup_window_id = window_id
        res.locked_until = datetime.now() + timedelta(hours=lock_hours)
        copy.status = CopyStatus.RESERVED
        copy.current_reservation_id = reservation_id

        self._rebuild_queue(res.copy_id)
        return True

    def pickup_book(self, reservation_id: str) -> bool:
        if reservation_id not in self.reservations:
            return False

        res = self.reservations[reservation_id]
        if res.status != ReservationStatus.LOCKED:
            return False
        if res.is_expired():
            return False

        res.status = ReservationStatus.PICKED_UP
        res.picked_up_at = datetime.now()
        
        copy = self.copies[res.copy_id]
        copy.status = CopyStatus.LENT
        copy.current_reservation_id = None

        return True

    def process_expired(self) -> Tuple[int, List[OverdueRecord]]:
        expired_count = 0
        new_overdue_records = []

        for res_id, res in list(self.reservations.items()):
            if res.status == ReservationStatus.LOCKED and res.is_expired():
                res.status = ReservationStatus.EXPIRED
                res.expired_at = datetime.now()

                copy = self.copies.get(res.copy_id)
                if copy:
                    copy.status = CopyStatus.AVAILABLE
                    copy.current_reservation_id = None

                record_id = f"OVR-{uuid.uuid4().hex[:8].upper()}"
                overdue = OverdueRecord(
                    record_id=record_id,
                    reservation_id=res_id,
                    reader_id=res.reader_id,
                    copy_id=res.copy_id,
                    expired_at=res.expired_at
                )
                self.overdue_records[record_id] = overdue
                new_overdue_records.append(overdue)

                reader = self.readers.get(res.reader_id)
                if reader:
                    reader.overdue_count += 1

                expired_count += 1
                self._process_next_in_queue(res.copy_id)

        return expired_count, new_overdue_records

    def _process_next_in_queue(self, copy_id: str) -> Optional[Reservation]:
        reservation_ids = self.copy_reservation_map.get(copy_id, [])
        for res_id in reservation_ids:
            res = self.reservations.get(res_id)
            if res and res.status == ReservationStatus.PENDING:
                return res
        return None

    def get_copy_queue(self, copy_id: str) -> List[Reservation]:
        if copy_id not in self.copy_reservation_map:
            return []
        
        queue = []
        for res_id in self.copy_reservation_map[copy_id]:
            res = self.reservations.get(res_id)
            if res and res.status == ReservationStatus.PENDING:
                queue.append(res)
        
        queue.sort(key=lambda r: r.queue_position)
        return queue

    def generate_flow_report(self) -> FlowReport:
        total = len(self.reservations)
        picked_up = sum(1 for r in self.reservations.values() 
                       if r.status == ReservationStatus.PICKED_UP)
        expired = sum(1 for r in self.reservations.values() 
                     if r.status == ReservationStatus.EXPIRED)
        
        teacher_count = 0
        for res in self.reservations.values():
            reader = self.readers.get(res.reader_id)
            if reader and reader.reader_type == ReaderType.TEACHER:
                if res.status in [ReservationStatus.PENDING, ReservationStatus.LOCKED]:
                    teacher_count += 1

        released_copies = [
            copy_id for copy_id, res_ids in self.copy_reservation_map.items()
            if any(self.reservations[rid].status == ReservationStatus.EXPIRED 
                   for rid in res_ids if rid in self.reservations)
        ]

        queue_changes = []
        for copy_id in self.copy_reservation_map:
            queue = self.get_copy_queue(copy_id)
            if queue:
                queue_changes.append({
                    "copy_id": copy_id,
                    "queue_length": len(queue),
                    "next_reader": queue[0].reader_id if queue else None
                })

        return FlowReport(
            report_id=f"RPT-{uuid.uuid4().hex[:8].upper()}",
            generated_at=datetime.now(),
            total_reservations=total,
            processed_reservations=picked_up + expired,
            expired_reservations=expired,
            picked_up_reservations=picked_up,
            teacher_priority_count=teacher_count,
            released_copies=list(set(released_copies)),
            queue_changes=queue_changes
        )

    def validate_data(self) -> Dict[str, List[str]]:
        errors = {
            "readers": [],
            "copies": [],
            "reservations": [],
            "overdue_records": []
        }

        for reader_id, reader in self.readers.items():
            if not reader.name.strip():
                errors["readers"].append(f"Reader {reader_id}: 姓名不能为空")
            if reader.overdue_count < 0:
                errors["readers"].append(f"Reader {reader_id}: 逾期次数不能为负数")

        for copy_id, copy in self.copies.items():
            if not copy.title.strip():
                errors["copies"].append(f"Copy {copy_id}: 书名不能为空")
            if not copy.isbn.strip():
                errors["copies"].append(f"Copy {copy_id}: ISBN不能为空")

        for res_id, res in self.reservations.items():
            if res.reader_id not in self.readers:
                errors["reservations"].append(f"Reservation {res_id}: 读者不存在")
            if res.copy_id not in self.copies:
                errors["reservations"].append(f"Reservation {res_id}: 书籍副本不存在")
            if res.queue_position < 0:
                errors["reservations"].append(f"Reservation {res_id}: 队列位置无效")

        return errors
