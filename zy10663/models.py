from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class TransferStatus(str, Enum):
    PENDING = "待调拨"
    LOCKED = "已锁定"
    IN_TRANSIT = "在途"
    COMPLETED = "已完成"
    FAILED = "处理失败"
    NEED_MANUAL = "待人工处理"


class ErrorType(str, Enum):
    DATA_ERROR = "数据错误"
    STOCK_CONFLICT = "库存冲突"
    WAREHOUSE_ERROR = "仓库错误"
    SKU_ERROR = "SKU不存在"
    SYSTEM_ERROR = "系统错误"


class TransferOrder(BaseModel):
    transfer_id: str = Field(..., description="调拨单ID")
    source_warehouse: str = Field(..., description="源仓库编码")
    target_warehouse: str = Field(..., description="目标仓库编码")
    sku: str = Field(..., description="SKU编码")
    sku_name: Optional[str] = Field(None, description="SKU名称")
    quantity: int = Field(..., ge=1, description="调拨数量")
    status: TransferStatus = Field(default=TransferStatus.PENDING, description="状态")
    lock_time: Optional[datetime] = Field(None, description="锁定时间")
    complete_time: Optional[datetime] = Field(None, description="完成时间")
    remark: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    created_by: Optional[str] = Field(None, description="创建人")
    is_imported: bool = Field(default=False, description="是否导入记录")
    error_type: Optional[ErrorType] = Field(None, description="错误类型")
    error_message: Optional[str] = Field(None, description="错误信息")
    need_manual: bool = Field(default=False, description="是否需要人工处理")


class TransferHistory(BaseModel):
    history_id: str
    transfer_id: str
    operation_type: str
    old_status: Optional[TransferStatus] = None
    new_status: Optional[TransferStatus] = None
    operator: Optional[str] = None
    remark: Optional[str] = None
    operation_time: datetime = Field(default_factory=datetime.now)
    extra_info: Optional[dict] = None


class ImportResult(BaseModel):
    success_count: int
    failed_count: int
    total_count: int
    failed_rows: List[dict]
    success_ids: List[str]


class StockInfo(BaseModel):
    sku: str
    warehouse: str
    available_qty: int
    locked_qty: int = 0
    last_updated: datetime
