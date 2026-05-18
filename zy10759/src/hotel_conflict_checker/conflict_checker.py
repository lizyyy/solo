from datetime import date
from typing import List, Dict, Set, Tuple
from collections import defaultdict
import uuid
import logging

from .models import (
    RoomState, ChannelOrder, ManualLock,
    ConflictRecord, ConflictType, RoomStatus
)


class ConflictChecker:
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.logger = logging.getLogger(__name__)
        self.processing_logs = []

    def _log(self, message: str, level: str = "INFO"):
        self.processing_logs.append((level, message))
        if self.verbose:
            self.logger.log(getattr(logging, level), message)

    def _dates_overlap(self, start1: date, end1: date, start2: date, end2: date) -> bool:
        return max(start1, start2) < min(end1, end2)

    def _generate_conflict_id(self) -> str:
        return f"CF{uuid.uuid4().hex[:8].upper()}"

    def _get_overlap_dates(self, start1: date, end1: date, start2: date, end2: date) -> Tuple[date, date]:
        return max(start1, start2), min(end1, end2)

    def check_sold_and_locked(self, room_states: List[RoomState], manual_locks: List[ManualLock]) -> List[ConflictRecord]:
        conflicts = []
        self._log("【已售又锁房检测】开始检测...", "INFO")

        sold_rooms = defaultdict(list)
        for rs in room_states:
            if rs.status == RoomStatus.SOLD and rs.room_number:
                sold_rooms[rs.room_number].append(rs)

        locked_rooms = defaultdict(list)
        for lock in manual_locks:
            if lock.room_number:
                locked_rooms[lock.room_number].append(lock)

        for room_number in sold_rooms:
            if room_number not in locked_rooms:
                continue

            for sold in sold_rooms[room_number]:
                for lock in locked_rooms[room_number]:
                    if self._dates_overlap(sold.checkin_date, sold.checkout_date,
                                           lock.checkin_date, lock.checkout_date):
                        overlap_start, overlap_end = self._get_overlap_dates(
                            sold.checkin_date, sold.checkout_date,
                            lock.checkin_date, lock.checkout_date
                        )
                        conflict = ConflictRecord(
                            conflict_id=self._generate_conflict_id(),
                            conflict_type=ConflictType.SOLD_AND_LOCKED,
                            room_number=room_number,
                            room_type=sold.room_type,
                            checkin_date=overlap_start,
                            checkout_date=overlap_end,
                            order_info=None,
                            lock_info=lock,
                            room_state_info=sold,
                            description=f"房态显示已售客人[{sold.guest_name}]，同时存在锁房[{lock.lock_reason}]，日期重叠：{overlap_start} 至 {overlap_end}",
                            severity="高"
                        )
                        conflicts.append(conflict)
                        self._log(f"  发现冲突：房间{room_number}已售又锁房，客人：{sold.guest_name}，锁房原因：{lock.lock_reason}", "WARNING")

        self._log(f"【已售又锁房检测】完成，共发现 {len(conflicts)} 个冲突", "INFO")
        return conflicts

    def check_channel_delay_conflict(self, room_states: List[RoomState], channel_orders: List[ChannelOrder], manual_locks: List[ManualLock]) -> List[ConflictRecord]:
        conflicts = []
        self._log("【渠道延迟冲突检测】开始检测...", "INFO")

        lock_room_dates = defaultdict(list)
        for lock in manual_locks:
            lock_room_dates[lock.room_number].append(lock)

        for order in channel_orders:
            if not order.room_number:
                continue
            if order.room_number not in lock_room_dates:
                continue

            for lock in lock_room_dates[order.room_number]:
                if self._dates_overlap(order.checkin_date, order.checkout_date,
                                       lock.checkin_date, lock.checkout_date):
                    if lock.create_time > order.create_time:
                        overlap_start, overlap_end = self._get_overlap_dates(
                            order.checkin_date, order.checkout_date,
                            lock.checkin_date, lock.checkout_date
                        )
                        conflict = ConflictRecord(
                            conflict_id=self._generate_conflict_id(),
                            conflict_type=ConflictType.CHANNEL_DELAY_CONFLICT,
                            room_number=order.room_number,
                            room_type=order.room_type,
                            checkin_date=overlap_start,
                            checkout_date=overlap_end,
                            order_info=order,
                            lock_info=lock,
                            room_state_info=None,
                            description=f"渠道订单[{order.channel_order_no}]客人[{order.guest_name}]早于锁房创建，但因渠道延迟导致未同步，后被锁房[{lock.lock_id}]占用",
                            severity="高"
                        )
                        conflicts.append(conflict)
                        self._log(f"  发现冲突：房间{order.room_number}渠道延迟冲突，订单创建：{order.create_time}，锁房创建：{lock.create_time}", "WARNING")

        self._log(f"【渠道延迟冲突检测】完成，共发现 {len(conflicts)} 个冲突", "INFO")
        return conflicts

    def check_room_change_conflict(self, channel_orders: List[ChannelOrder]) -> List[ConflictRecord]:
        conflicts = []
        self._log("【换房冲突检测】开始检测...", "INFO")

        order_rooms = defaultdict(list)
        for order in channel_orders:
            if order.order_id:
                order_rooms[order.order_id].append(order)

        for order_id, orders in order_rooms.items():
            if len(orders) > 1:
                room_numbers = [o.room_number for o in orders if o.room_number]
                if len(set(room_numbers)) > 1:
                    base_order = orders[0]
                    conflict = ConflictRecord(
                        conflict_id=self._generate_conflict_id(),
                        conflict_type=ConflictType.ROOM_CHANGE_CONFLICT,
                        room_number=base_order.room_number,
                        room_type=base_order.room_type,
                        checkin_date=base_order.checkin_date,
                        checkout_date=base_order.checkout_date,
                        order_info=base_order,
                        lock_info=None,
                        room_state_info=None,
                        description=f"同一订单[{order_id}]存在多条换房记录：{', '.join(room_numbers)}，需确认最终房号",
                        severity="中"
                    )
                    conflicts.append(conflict)
                    self._log(f"  发现冲突：订单{order_id}换房记录不一致，涉及房间：{', '.join(room_numbers)}", "WARNING")

        self._log(f"【换房冲突检测】完成，共发现 {len(conflicts)} 个冲突", "INFO")
        return conflicts

    def check_extend_stay_conflict(self, channel_orders: List[ChannelOrder], manual_locks: List[ManualLock]) -> List[ConflictRecord]:
        conflicts = []
        self._log("【续住冲突检测】开始检测...", "INFO")

        guest_stays = defaultdict(list)
        for order in channel_orders:
            key = (order.guest_name, order.guest_phone)
            guest_stays[key].append(order)

        for (guest_name, guest_phone), stays in guest_stays.items():
            if len(stays) < 2:
                continue

            stays_sorted = sorted(stays, key=lambda x: x.checkin_date)
            for i in range(len(stays_sorted) - 1):
                current = stays_sorted[i]
                next_stay = stays_sorted[i + 1]

                if next_stay.checkin_date <= current.checkout_date:
                    for lock in manual_locks:
                        if lock.room_number == next_stay.room_number:
                            if self._dates_overlap(next_stay.checkin_date, next_stay.checkout_date,
                                                   lock.checkin_date, lock.checkout_date):
                                overlap_start, overlap_end = self._get_overlap_dates(
                                    next_stay.checkin_date, next_stay.checkout_date,
                                    lock.checkin_date, lock.checkout_date
                                )
                                conflict = ConflictRecord(
                                    conflict_id=self._generate_conflict_id(),
                                    conflict_type=ConflictType.EXTEND_STAY_CONFLICT,
                                    room_number=next_stay.room_number,
                                    room_type=next_stay.room_type,
                                    checkin_date=overlap_start,
                                    checkout_date=overlap_end,
                                    order_info=next_stay,
                                    lock_info=lock,
                                    room_state_info=None,
                                    description=f"客人[{guest_name}]续住订单[{next_stay.order_id}]与锁房[{lock.lock_id}]冲突，原退房{current.checkout_date}与新入住{next_stay.checkin_date}重叠",
                                    severity="高"
                                )
                                conflicts.append(conflict)
                                self._log(f"  发现冲突：客人{guest_name}续住与锁房冲突，房间：{next_stay.room_number}", "WARNING")

        self._log(f"【续住冲突检测】完成，共发现 {len(conflicts)} 个冲突", "INFO")
        return conflicts

    def check_all_conflicts(self, room_states: List[RoomState], channel_orders: List[ChannelOrder], manual_locks: List[ManualLock]) -> List[ConflictRecord]:
        self._log("=" * 60, "INFO")
        self._log("酒店房态导出锁房冲突核对 - 开始冲突检测", "INFO")
        self._log("=" * 60, "INFO")
        self._log(f"输入数据统计：房态{len(room_states)}条，渠道订单{len(channel_orders)}条，手工锁房{len(manual_locks)}条", "INFO")
        self._log("", "INFO")

        all_conflicts = []

        conflicts1 = self.check_sold_and_locked(room_states, manual_locks)
        all_conflicts.extend(conflicts1)

        conflicts2 = self.check_channel_delay_conflict(room_states, channel_orders, manual_locks)
        all_conflicts.extend(conflicts2)

        conflicts3 = self.check_room_change_conflict(channel_orders)
        all_conflicts.extend(conflicts3)

        conflicts4 = self.check_extend_stay_conflict(channel_orders, manual_locks)
        all_conflicts.extend(conflicts4)

        self._log("", "INFO")
        self._log("=" * 60, "INFO")
        self._log(f"冲突检测完成，共发现 {len(all_conflicts)} 个锁房冲突", "INFO")
        conflict_types = defaultdict(int)
        for c in all_conflicts:
            conflict_types[c.conflict_type.value] += 1
        for ctype, count in conflict_types.items():
            self._log(f"  - {ctype}: {count} 个", "INFO")
        self._log("=" * 60, "INFO")

        return all_conflicts

    def get_processing_logs(self) -> List[Tuple[str, str]]:
        return self.processing_logs
