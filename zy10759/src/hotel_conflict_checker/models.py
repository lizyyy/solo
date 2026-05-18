from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import Optional


class RoomStatus(Enum):
    AVAILABLE = "可用"
    SOLD = "已售"
    LOCKED = "锁房"
    OUT_OF_ORDER = "维修"


class OrderSource(Enum):
    DIRECT = "直销"
    OTACOM = "携程"
    MEITUAN = "美团"
    FEIZHU = "飞猪"
    GROUPON = "去哪儿"


@dataclass
class RoomState:
    room_number: str
    room_type: str
    checkin_date: date
    checkout_date: date
    status: RoomStatus
    order_id: Optional[str] = None
    guest_name: Optional[str] = None
    source: Optional[OrderSource] = None
    update_time: Optional[datetime] = None

    @property
    def nights(self) -> int:
        return (self.checkout_date - self.checkin_date).days


@dataclass
class ChannelOrder:
    order_id: str
    channel_order_no: str
    channel: OrderSource
    guest_name: str
    guest_phone: str
    room_type: str
    room_number: Optional[str]
    checkin_date: date
    checkout_date: date
    amount: float
    order_status: str
    create_time: datetime
    confirm_time: Optional[datetime] = None

    @property
    def nights(self) -> int:
        return (self.checkout_date - self.checkin_date).days


@dataclass
class ManualLock:
    lock_id: str
    room_number: str
    room_type: str
    lock_reason: str
    checkin_date: date
    checkout_date: date
    operator: str
    create_time: datetime
    remark: Optional[str] = None

    @property
    def nights(self) -> int:
        return (self.checkout_date - self.checkin_date).days


class ConflictType(Enum):
    SOLD_AND_LOCKED = "已售又锁房"
    OVERLAP_CHANNEL = "渠道订单重叠"
    ROOM_CHANGE_CONFLICT = "换房冲突"
    EXTEND_STAY_CONFLICT = "续住冲突"
    CHANNEL_DELAY_CONFLICT = "渠道延迟冲突"


@dataclass
class ConflictRecord:
    conflict_id: str
    conflict_type: ConflictType
    room_number: str
    room_type: str
    checkin_date: date
    checkout_date: date
    order_info: Optional[ChannelOrder]
    lock_info: Optional[ManualLock]
    room_state_info: Optional[RoomState]
    description: str
    severity: str = "高"

    def to_dict(self) -> dict:
        return {
            "冲突编号": self.conflict_id,
            "冲突类型": self.conflict_type.value,
            "房号": self.room_number,
            "房型": self.room_type,
            "入住日期": self.checkin_date.strftime("%Y-%m-%d"),
            "退房日期": self.checkout_date.strftime("%Y-%m-%d"),
            "订单号": self.order_info.order_id if self.order_info else "",
            "渠道订单号": self.order_info.channel_order_no if self.order_info else "",
            "渠道": self.order_info.channel.value if self.order_info else "",
            "客人姓名": self.order_info.guest_name if self.order_info else "",
            "锁房编号": self.lock_info.lock_id if self.lock_info else "",
            "锁房原因": self.lock_info.lock_reason if self.lock_info else "",
            "锁房操作人": self.lock_info.operator if self.lock_info else "",
            "冲突描述": self.description,
            "严重程度": self.severity
        }
