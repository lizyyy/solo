from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ShiftStatus(str, Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    SIGNED = "已签字"
    PENDING_MANUAL = "待人工处理"
    MANUAL_PROCESSED = "人工处理完成"
    WITHDRAWN = "已撤回"


class BabyStatus(str, Enum):
    NORMAL = "正常"
    NEED_ATTENTION = "需关注"
    ABNORMAL = "异常"


class HandoverRecord(BaseModel):
    id: str
    shift_date: str
    shift_type: str = "夜班"
    on_duty_nurse: str
    off_duty_nurse: str
    on_duty_signature: Optional[str] = None
    off_duty_signature: Optional[str] = None
    status: ShiftStatus
    created_at: datetime
    updated_at: datetime
    
    baby_count: int
    
    maternal_conditions: List[dict] = []
    baby_conditions: List[dict] = []
    
    special_notes: str = ""
    equipment_status: str = ""
    emergency_supplies: str = ""
    
    next_shift_tasks: str = ""
    manual_process_notes: str = ""
    
    version: int = 1
    history: List[dict] = []


class HandoverHistory(BaseModel):
    id: str
    handover_id: str
    version: int
    changed_by: str
    changed_at: datetime
    change_type: str
    previous_values: dict
    new_values: dict
    remarks: str = ""
