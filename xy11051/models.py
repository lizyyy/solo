from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class AddItemStatus(str, Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    VERBAL_NO_CONFIRM = "口头加项待确认"
    CUSTOMER_CONFIRMED = "客户已确认"
    MANUAL_PROCESSING = "人工处理中"
    WITHDRAWN = "已撤回"
    APPROVED = "已批准"
    REJECTED = "已驳回"
    LEDGER_MATCHED = "台账已匹配"
    LEDGER_MISMATCH = "台账不匹配"


class AddItemType(str, Enum):
    STRUCTURE = "结构加项"
    ELECTRICAL = "电气加项"
    DECORATION = "装饰加项"
    FURNITURE = "家具加项"
    AV = "音视频加项"
    OTHER = "其他加项"


class ModificationRecord(BaseModel):
    id: str
    add_item_id: str
    modify_time: datetime = Field(default_factory=datetime.now)
    operator: str
    old_status: Optional[AddItemStatus] = None
    new_status: AddItemStatus
    change_type: str
    description: str
    remark: Optional[str] = None
    old_data: Optional[dict] = None
    new_data: Optional[dict] = None


class BoothAddItem(BaseModel):
    id: str
    exhibition_name: str
    booth_number: str
    construction_team: str
    project_manager: str
    add_item_type: AddItemType
    add_item_name: str
    add_item_description: str
    quantity: int
    unit: str
    unit_price: float
    total_price: float
    is_verbal: bool = False
    verbal_operator: Optional[str] = None
    verbal_time: Optional[datetime] = None
    customer_confirmed: bool = False
    customer_confirm_time: Optional[datetime] = None
    customer_confirmer: Optional[str] = None
    ledger_matched: Optional[bool] = None
    ledger_match_time: Optional[datetime] = None
    ledger_mismatch_reason: Optional[str] = None
    status: AddItemStatus = AddItemStatus.DRAFT
    create_time: datetime = Field(default_factory=datetime.now)
    update_time: datetime = Field(default_factory=datetime.now)
    creator: str
    current_remark: Optional[str] = None
    manual_processor: Optional[str] = None
    manual_process_start_time: Optional[datetime] = None


class BoothAddItemCreate(BaseModel):
    exhibition_name: str
    booth_number: str
    construction_team: str
    project_manager: str
    add_item_type: AddItemType
    add_item_name: str
    add_item_description: str
    quantity: int
    unit: str
    unit_price: float
    creator: str
    is_verbal: bool = False
    verbal_operator: Optional[str] = None


class BoothAddItemUpdate(BaseModel):
    add_item_name: Optional[str] = None
    add_item_description: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None


class SubmitRequest(BaseModel):
    operator: str
    remark: Optional[str] = None


class CustomerConfirmRequest(BaseModel):
    confirmer: str
    remark: Optional[str] = None


class WithdrawRequest(BaseModel):
    operator: str
    reason: str


class ManualProcessRequest(BaseModel):
    processor: str
    remark: str


class LedgerMatchRequest(BaseModel):
    matched: bool
    mismatch_reason: Optional[str] = None
    operator: str


class Database:
    def __init__(self):
        self.add_items: List[BoothAddItem] = []
        self.modification_records: List[ModificationRecord] = []

    def get_add_item(self, item_id: str) -> Optional[BoothAddItem]:
        return next((item for item in self.add_items if item.id == item_id), None)

    def get_modification_history(self, add_item_id: str) -> List[ModificationRecord]:
        return sorted(
            [record for record in self.modification_records if record.add_item_id == add_item_id],
            key=lambda x: x.modify_time,
            reverse=True
        )


db = Database()
