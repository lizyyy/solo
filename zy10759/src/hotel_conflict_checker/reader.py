import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Tuple

from .models import (
    RoomState, ChannelOrder, ManualLock,
    RoomStatus, OrderSource
)


class DataReader:
    def __init__(self):
        self.room_state_columns = [
            "房号", "房型", "入住日期", "退房日期", "房态",
            "订单号", "客人姓名", "渠道", "更新时间"
        ]
        self.channel_order_columns = [
            "订单号", "渠道订单号", "渠道", "客人姓名", "客人电话",
            "房型", "房号", "入住日期", "退房日期", "金额",
            "订单状态", "创建时间", "确认时间"
        ]
        self.manual_lock_columns = [
            "锁房编号", "房号", "房型", "锁房原因",
            "入住日期", "退房日期", "操作人", "创建时间", "备注"
        ]

    def _parse_date(self, value) -> datetime.date:
        if pd.isna(value):
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"]:
                try:
                    return datetime.strptime(value.strip(), fmt).date()
                except (ValueError, AttributeError):
                    continue
        return None

    def _parse_datetime(self, value) -> datetime:
        if pd.isna(value):
            return None
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"]:
                try:
                    return datetime.strptime(value.strip(), fmt)
                except (ValueError, AttributeError):
                    continue
        return None

    def _parse_room_status(self, value) -> RoomStatus:
        if pd.isna(value):
            return None
        value = str(value).strip()
        status_map = {
            "可用": RoomStatus.AVAILABLE,
            "已售": RoomStatus.SOLD,
            "在住": RoomStatus.SOLD,
            "锁房": RoomStatus.LOCKED,
            "维修": RoomStatus.OUT_OF_ORDER,
            "停用": RoomStatus.OUT_OF_ORDER,
        }
        return status_map.get(value)

    def _parse_order_source(self, value) -> OrderSource:
        if pd.isna(value):
            return None
        value = str(value).strip()
        source_map = {
            "直销": OrderSource.DIRECT,
            "携程": OrderSource.OTACOM,
            "美团": OrderSource.MEITUAN,
            "飞猪": OrderSource.FEIZHU,
            "去哪儿": OrderSource.GROUPON,
            "Qunar": OrderSource.GROUPON,
        }
        return source_map.get(value)

    def read_room_state(self, file_path: str) -> List[RoomState]:
        path = Path(file_path)
        if path.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        room_states = []
        for _, row in df.iterrows():
            room_state = RoomState(
                room_number=str(row.get("房号", "")).strip(),
                room_type=str(row.get("房型", "")).strip(),
                checkin_date=self._parse_date(row.get("入住日期")),
                checkout_date=self._parse_date(row.get("退房日期")),
                status=self._parse_room_status(row.get("房态")),
                order_id=str(row.get("订单号", "")).strip() if pd.notna(row.get("订单号")) else None,
                guest_name=str(row.get("客人姓名", "")).strip() if pd.notna(row.get("客人姓名")) else None,
                source=self._parse_order_source(row.get("渠道")),
                update_time=self._parse_datetime(row.get("更新时间"))
            )
            room_states.append(room_state)
        return room_states

    def read_channel_orders(self, file_path: str) -> List[ChannelOrder]:
        path = Path(file_path)
        if path.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        orders = []
        for _, row in df.iterrows():
            order = ChannelOrder(
                order_id=str(row.get("订单号", "")).strip(),
                channel_order_no=str(row.get("渠道订单号", "")).strip(),
                channel=self._parse_order_source(row.get("渠道")),
                guest_name=str(row.get("客人姓名", "")).strip(),
                guest_phone=str(row.get("客人电话", "")).strip(),
                room_type=str(row.get("房型", "")).strip(),
                room_number=str(row.get("房号", "")).strip() if pd.notna(row.get("房号")) else None,
                checkin_date=self._parse_date(row.get("入住日期")),
                checkout_date=self._parse_date(row.get("退房日期")),
                amount=float(row.get("金额", 0)) if pd.notna(row.get("金额")) else 0.0,
                order_status=str(row.get("订单状态", "")).strip(),
                create_time=self._parse_datetime(row.get("创建时间")),
                confirm_time=self._parse_datetime(row.get("确认时间"))
            )
            orders.append(order)
        return orders

    def read_manual_locks(self, file_path: str) -> List[ManualLock]:
        path = Path(file_path)
        if path.suffix.lower() in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        locks = []
        for _, row in df.iterrows():
            lock = ManualLock(
                lock_id=str(row.get("锁房编号", "")).strip(),
                room_number=str(row.get("房号", "")).strip(),
                room_type=str(row.get("房型", "")).strip(),
                lock_reason=str(row.get("锁房原因", "")).strip(),
                checkin_date=self._parse_date(row.get("入住日期")),
                checkout_date=self._parse_date(row.get("退房日期")),
                operator=str(row.get("操作人", "")).strip(),
                create_time=self._parse_datetime(row.get("创建时间")),
                remark=str(row.get("备注", "")).strip() if pd.notna(row.get("备注")) else None
            )
            locks.append(lock)
        return locks

    def read_all_data(self, room_state_file: str, channel_order_file: str, manual_lock_file: str) -> Tuple[
        List[RoomState], List[ChannelOrder], List[ManualLock]
    ]:
        room_states = self.read_room_state(room_state_file)
        channel_orders = self.read_channel_orders(channel_order_file)
        manual_locks = self.read_manual_locks(manual_lock_file)
        return room_states, channel_orders, manual_locks
