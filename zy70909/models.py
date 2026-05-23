from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional

class OrderRecord(BaseModel):
    order_id: str
    station_id: str
    pile_number: str
    user_id: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    charge_duration: Optional[float] = None
    charged_kwh: Optional[float] = None
    total_amount: Optional[float] = None
    payment_amount: Optional[float] = None
    refund_amount: Optional[float] = 0.0
    status: str
    source_platform: str
    payment_status: Optional[str] = None
    refund_status: Optional[str] = None
    raw_data: Dict[str, Any]


class ChargingLog(BaseModel):
    log_id: str
    pile_number: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    start_soc: Optional[float] = None
    end_soc: Optional[float] = None
    charged_kwh: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    power: Optional[float] = None
    status: str
    error_code: Optional[str] = None
    raw_data: Dict[str, Any]

class PaymentReceipt(BaseModel):
    receipt_id: str
    order_id: str
    transaction_id: str
    amount: float
    payment_time: Optional[datetime] = None
    payment_method: str
    status: str
    type: str
    raw_data: Dict[str, Any]

class FailedRecord(BaseModel):
    record_id: str
    record_type: str
    raw_data: Dict[str, Any]
    error_type: str
    error_message: str
    suggested_action: str
    pile_number: Optional[str] = None

class ProcessResult(BaseModel):
    batch_id: str
    total_records: int
    normal_count: int
    pending_count: int
    failed_count: int
    normal_items: List[Dict[str, Any]]
    pending_items: List[Dict[str, Any]]
    failed_items: List[FailedRecord]
    normal_items: List[Dict[str, Any]]
    pending_items: List[Dict[str, Any]]
    failed_items: List[FailedRecord]
