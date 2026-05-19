from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class TicketStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RESOLVED = "resolved"
    CLOSED = "closed"
    ESCALATED = "escalated"


class CustomerServiceTicket(BaseModel):
    ticket_id: str = Field(..., description="工单ID")
    station_id: str = Field(..., description="换电站ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    user_phone: Optional[str] = Field(None, description="用户手机号")
    title: str = Field(..., description="工单标题")
    description: str = Field(..., description="工单描述")
    create_time: datetime = Field(..., description="创建时间")
    status: TicketStatus = Field(default=TicketStatus.PENDING, description="工单状态")
    assignee: Optional[str] = Field(None, description="负责人")
    priority: int = Field(default=1, description="优先级: 1-低, 2-中, 3-高")
    tags: list[str] = Field(default_factory=list, description="标签")
    raw_data: Optional[str] = Field(None, description="原始数据")
    created_at: datetime = Field(default_factory=datetime.now)

    @validator("create_time", pre=True)
    def parse_create_time(cls, v):
        if isinstance(v, str):
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y%m%d%H%M%S"]:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
        return v

    class Config:
        use_enum_values = True
