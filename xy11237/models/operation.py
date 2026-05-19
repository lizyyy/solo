from datetime import datetime
from typing import Optional, List
from pydantic import Field
from .base import IdempotentEntity
from .enums import OperationType, ExceptionType


class OutboundItem(IdempotentEntity):
    outbound_id: str
    reagent_id: str
    reagent_name: str
    specification: str
    batch_no: str
    quantity: float
    unit: str
    location: Optional[str] = None
    remark: Optional[str] = None


class OutboundRecord(IdempotentEntity):
    application_id: Optional[str] = None
    operator_id: str
    operator_name: str
    receiver_id: str
    receiver_name: str
    department: Optional[str] = None
    purpose: Optional[str] = None
    items: List[OutboundItem] = Field(default_factory=list)
    exception_type: ExceptionType = ExceptionType.NONE
    exception_message: Optional[str] = None
    remark: Optional[str] = None

    def add_item(self, item: OutboundItem):
        item.outbound_id = self.id
        self.items.append(item)
        self.update_timestamp()


class ReturnItem(IdempotentEntity):
    return_id: str
    reagent_id: str
    reagent_name: str
    specification: str
    batch_no: str
    quantity: float
    unit: str
    remaining_quantity: float
    condition: str
    location: Optional[str] = None
    remark: Optional[str] = None


class ReturnRecord(IdempotentEntity):
    application_id: Optional[str] = None
    outbound_id: Optional[str] = None
    operator_id: str
    operator_name: str
    returner_id: str
    returner_name: str
    items: List[ReturnItem] = Field(default_factory=list)
    exception_type: ExceptionType = ExceptionType.NONE
    exception_message: Optional[str] = None
    remark: Optional[str] = None

    def add_item(self, item: ReturnItem):
        item.return_id = self.id
        self.items.append(item)
        self.update_timestamp()


class InventoryItem(IdempotentEntity):
    inventory_id: str
    reagent_id: str
    reagent_name: str
    specification: str
    batch_no: str
    system_quantity: float
    actual_quantity: float
    unit: str
    difference: float
    difference_reason: Optional[str] = None
    location: Optional[str] = None


class InventoryRecord(IdempotentEntity):
    operator_id: str
    operator_name: str
    inventory_date: datetime = Field(default_factory=datetime.now)
    items: List[InventoryItem] = Field(default_factory=list)
    total_difference: float = 0.0
    exception_type: ExceptionType = ExceptionType.NONE
    exception_message: Optional[str] = None
    remark: Optional[str] = None

    def add_item(self, item: InventoryItem):
        item.inventory_id = self.id
        self.items.append(item)
        self.total_difference += item.difference
        self.update_timestamp()


class OperationLog(IdempotentEntity):
    operation_type: OperationType
    operator_id: str
    operator_name: str
    target_id: str
    target_type: str
    before_data: Optional[dict] = None
    after_data: Optional[dict] = None
    exception_type: ExceptionType = ExceptionType.NONE
    exception_message: Optional[str] = None
    remark: Optional[str] = None
