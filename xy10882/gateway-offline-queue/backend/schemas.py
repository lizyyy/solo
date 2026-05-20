from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class GatewayDeviceBase(BaseModel):
    device_id: str
    name: str


class GatewayDeviceCreate(GatewayDeviceBase):
    pass


class GatewayDevice(GatewayDeviceBase):
    id: int
    status: str
    last_heartbeat: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class OfflineWindowBase(BaseModel):
    device_id: int


class OfflineWindowCreate(OfflineWindowBase):
    pass


class OfflineWindow(OfflineWindowBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    is_active: bool
    command_count: int

    class Config:
        from_attributes = True


class ControlCommandBase(BaseModel):
    device_id: int
    command_type: str
    payload: str
    priority: int = 0
    expire_hours: int = 24


class ControlCommandCreate(ControlCommandBase):
    pass


class ControlCommand(BaseModel):
    id: int
    command_id: str
    device_id: int
    command_type: str
    payload: str
    priority: int
    sequence: int
    status: str
    expire_at: datetime
    created_at: datetime
    executed_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class CommandHistoryBase(BaseModel):
    command_id: int
    new_status: str
    description: Optional[str] = None


class CommandHistoryCreate(CommandHistoryBase):
    old_status: Optional[str] = None


class CommandHistory(BaseModel):
    id: int
    command_id: int
    old_status: Optional[str]
    new_status: str
    timestamp: datetime
    description: Optional[str]

    class Config:
        from_attributes = True


class ReceiptRecordBase(BaseModel):
    command_id: int
    device_id: int
    receipt_code: str
    receipt_data: Optional[str] = None
    is_success: bool = True


class ReceiptRecordCreate(ReceiptRecordBase):
    pass


class ReceiptRecord(BaseModel):
    id: int
    command_id: int
    device_id: int
    receipt_code: str
    receipt_data: Optional[str]
    received_at: datetime
    is_success: bool

    class Config:
        from_attributes = True


class CommandWithHistory(ControlCommand):
    history: List[CommandHistory] = []


class DeviceWithCommands(GatewayDevice):
    commands: List[ControlCommand] = []
    offline_windows: List[OfflineWindow] = []


class StatusUpdate(BaseModel):
    status: str
    description: Optional[str] = None


class BatchOperation(BaseModel):
    command_ids: List[int]
    operation: str
