from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date
from models import ReservationStatus, TransferStatus
import re


def generate_id(prefix: str) -> str:
    import uuid
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class ReaderCreate(BaseModel):
    reader_id: str = Field(..., min_length=1, max_length=50, description="读者编号")
    name: str = Field(..., min_length=1, max_length=100, description="读者姓名")
    phone: str = Field(..., min_length=11, max_length=20, description="联系电话")
    
    @validator('phone')
    def validate_phone(cls, v):
        if not re.match(r'^1[3-9]\d{9}$', v):
            raise ValueError('请输入有效的11位手机号')
        return v


class BranchCreate(BaseModel):
    branch_id: str = Field(..., min_length=1, max_length=50, description="分馆编号")
    name: str = Field(..., min_length=1, max_length=100, description="分馆名称")
    address: Optional[str] = Field(None, max_length=200, description="分馆地址")


class BookCreate(BaseModel):
    book_id: str = Field(..., min_length=1, max_length=50, description="图书编号")
    isbn: str = Field(..., min_length=10, max_length=20, description="ISBN号")
    title: str = Field(..., min_length=1, max_length=200, description="书名")
    author: Optional[str] = Field(None, max_length=100, description="作者")
    publisher: Optional[str] = Field(None, max_length=100, description="出版社")


class HoldingCreate(BaseModel):
    holding_id: str = Field(..., min_length=1, max_length=50, description="馆藏编号")
    book_id: str = Field(..., min_length=1, max_length=50, description="图书编号")
    branch_id: str = Field(..., min_length=1, max_length=50, description="所属分馆")
    barcode: str = Field(..., min_length=1, max_length=50, description="条码号")
    location: Optional[str] = Field(None, max_length=100, description="馆藏位置")


class ReservationCreate(BaseModel):
    request_id: str = Field(..., min_length=1, max_length=100, description="请求唯一标识（用于幂等）")
    reader_id: str = Field(..., min_length=1, max_length=50, description="读者编号")
    book_id: str = Field(..., min_length=1, max_length=50, description="图书编号")
    pickup_branch_id: str = Field(..., min_length=1, max_length=50, description="取书分馆")
    remarks: Optional[str] = Field(None, description="备注")


class TransferCreate(BaseModel):
    request_id: str = Field(..., min_length=1, max_length=100, description="请求唯一标识（用于幂等）")
    reservation_id: str = Field(..., min_length=1, max_length=50, description="预约编号")
    from_holding_id: str = Field(..., min_length=1, max_length=50, description="调出馆藏")
    estimated_days: Optional[int] = Field(2, ge=1, le=30, description="预计调拨天数")


class TransferStart(BaseModel):
    operator: Optional[str] = Field("系统", max_length=100, description="操作人")


class TransferArrive(BaseModel):
    operator: Optional[str] = Field("系统", max_length=100, description="操作人")


class PickupBook(BaseModel):
    request_id: str = Field(..., min_length=1, max_length=100, description="请求唯一标识（用于幂等）")
    operator: Optional[str] = Field("系统", max_length=100, description="操作人")
    borrow_days: Optional[int] = Field(30, ge=7, le=180, description="借阅天数")


class ManualCorrection(BaseModel):
    operator: str = Field(..., min_length=1, max_length=100, description="操作人")
    new_status: Optional[ReservationStatus] = Field(None, description="新状态")
    new_queue_position: Optional[int] = Field(None, ge=1, description="新队列位置")
    new_pickup_deadline: Optional[datetime] = Field(None, description="新取书截止时间")
    reason: str = Field(..., min_length=1, max_length=500, description="修正原因")


class ReservationResponse(BaseModel):
    reservation_id: str
    status: str
    reader_name: str
    book_title: str
    pickup_branch: str
    queue_position: Optional[int]
    created_at: datetime
    picked_up_at: Optional[datetime]
    remarks: Optional[str]
    
    class Config:
        from_attributes = True


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    operation_time: datetime = Field(default_factory=datetime.utcnow)
