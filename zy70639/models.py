#!/usr/bin/env python3
"""
衣物分拣消毒转赠追踪排查CLI
核心数据模型定义
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
import uuid


class ClothingCategory(Enum):
    """衣物分类"""
    TOP = "上衣"
    BOTTOM = "下装"
    OUTERWEAR = "外套"
    UNDERWEAR = "内衣"
    SOCKS = "袜子"
    SHOES = "鞋子"
    ACCESSORY = "配饰"
    BEDDING = "床上用品"
    OTHER = "其他"


class ClothingStatus(Enum):
    """衣物状态"""
    WAITING_SORT = "待分拣"
    SORTED = "已分拣"
    WAITING_DISINFECT = "待消毒"
    DISINFECTED = "已消毒"
    WAITING_DONATE = "待转赠"
    DONATED = "已转赠"
    ELIMINATED = "已淘汰"


class DisinfectMethod(Enum):
    """消毒方式"""
    HIGH_TEMPERATURE = "高温消毒"
    UV = "紫外线消毒"
    OZONE = "臭氧消毒"
    CHEMICAL = "化学消毒"
    WASH_DRY = "洗涤烘干"


class EliminateReason(Enum):
    """淘汰原因"""
    DAMAGED = "破损严重"
    STAINED = "污渍无法清除"
    MOLDY = "发霉"
    NOT_SUITABLE = "不适宜捐赠"
    DUPLICATE = "重复过多"
    OTHER = "其他原因"


@dataclass
class DonationBatch:
    """捐赠批次"""
    batch_id: str
    donor_name: str
    donor_contact: str
    receive_date: str
    total_count: int
    received_count: int = 0
    description: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.batch_id:
            self.batch_id = f"BATCH{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"


@dataclass
class ClothingItem:
    """单件衣物记录"""
    item_id: str
    batch_id: str
    category: ClothingCategory
    description: str
    brand: str = ""
    size: str = ""
    color: str = ""
    status: ClothingStatus = ClothingStatus.WAITING_SORT
    sort_time: Optional[str] = None
    sort_operator: str = ""
    sort_notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.item_id:
            self.item_id = f"ITEM{uuid.uuid4().hex[:8]}"


@dataclass
class DisinfectRecord:
    """消毒记录"""
    record_id: str
    item_id: str
    batch_id: str
    method: DisinfectMethod
    operator: str
    disinfect_time: str
    duration_minutes: int = 0
    temperature: Optional[float] = None
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.record_id:
            self.record_id = f"DISINF{uuid.uuid4().hex[:6]}"


@dataclass
class DonationRecord:
    """转赠记录"""
    record_id: str
    item_id: str
    batch_id: str
    organization_id: str
    organization_name: str
    operator: str
    donate_time: str
    receiver: str = ""
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.record_id:
            self.record_id = f"DONATE{uuid.uuid4().hex[:6]}"


@dataclass
class EliminateRecord:
    """淘汰记录"""
    record_id: str
    item_id: str
    batch_id: str
    reason: EliminateReason
    operator: str
    eliminate_time: str
    notes: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.record_id:
            self.record_id = f"ELIM{uuid.uuid4().hex[:6]}"


@dataclass
class Organization:
    """转赠机构"""
    org_id: str
    name: str
    contact: str
    phone: str
    address: str = ""
    description: str = ""
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def __post_init__(self):
        if not self.org_id:
            self.org_id = f"ORG{uuid.uuid4().hex[:6]}"


class SortReport:
    """分拣报告数据结构"""
    def __init__(self, batch_id: str):
        self.batch_id = batch_id
        self.total_items: int = 0
        self.sorted_items: int = 0
        self.disinfected_items: int = 0
        self.donated_items: int = 0
        self.eliminated_items: int = 0
        self.category_stats: Dict[str, int] = {}
        self.status_stats: Dict[str, int] = {}
        self.eliminate_reason_stats: Dict[str, int] = {}
        self.generated_at: str = datetime.now().isoformat()
