from dataclasses import dataclass, field, asdict
from typing import Optional, List
from datetime import datetime
import hashlib
import uuid
import json

def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def generate_hash(*args) -> str:
    """生成唯一哈希，用于防止重复导入。"""
    raw = json.dumps([str(a) for a in args], sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()[:16]

@dataclass
class Member:
    member_id: str
    name: str
    phone: str
    balance_hours: float = 0.0  # 剩余总课时（扣除/退回后）
    status: str = "active"  # active, suspended
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""

    def to_dict(self):
        return asdict(self)

@dataclass
class Package:
    """套餐/充值记录/包月权益。"""
    package_id: str
    member_id: str
    type: str  # "time_based" (按课时), "monthly" (包月)
    total_hours: float = 0.0  # 对于包月，可以设为 float('inf') 或一个很大的数，但实际受限于有效期
    remaining_hours: float = 0.0
    start_date: str = ""  # ISO format YYYY-MM-DD
    end_date: str = ""
    status: str = "active"  # active, expired, consumed
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return asdict(self)

@dataclass
class Transaction:
    """每一次操作记录（预约、核销、取消、补录、加时）。"""
    tx_id: str
    member_id: str
    
    type: str  # booking, checkin, add_hours, manual_entry, refund, penalty (取消扣课时)
    status: str # pending, confirmed, reviewed, cancelled
    
    # 时间信息
    date: str  # 活动日期 YYYY-MM-DD
    start_time: str = ""  # HH:MM
    end_time: str = ""    # HH:MM
    duration: float = 0.0 # 分钟
    
    # 关联与去重
    ref_id: str = "" # 关联原预约ID (用于补录、加时、取消扣费)
    source_hash: str = "" # 用于防止重复导入 (Member + Date + Slot)
    
    # 金额与余额
    amount: float = 0.0   # 正数为增加，负数为扣减
    balance_before: float = 0.0
    balance_after: float = 0.0
    
    # 人工审核相关
    requires_review: bool = False
    review_reason: str = ""
    operator: str = ""
    notes: str = ""
    
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    confirmed_at: str = ""

    def to_dict(self):
        return asdict(self)
