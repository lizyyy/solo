from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.database import AlarmLevel, FaultType, RepairStatus, TeamType

class RepairOrderBase(BaseModel):
    alarm_id: str = Field(..., description="告警编号，如ALM-20240515-001")
    charger_id: str = Field(..., description="充电桩编号，如CP-BJ-XC-001")
    charger_name: str = Field(..., description="充电桩名称")
    station_id: str = Field(..., description="运维站编号")
    station_name: str = Field(..., description="运维站名称")
    fault_type: FaultType = Field(..., description="故障类型")
    alarm_level: AlarmLevel = Field(..., description="告警级别")
    alarm_time: datetime = Field(..., description="告警发生时间")
    fault_description: str = Field(..., description="故障详细描述")
    manufacturer: Optional[str] = Field(None, description="充电桩厂商")
    model: Optional[str] = Field(None, description="充电桩型号")
    location: Optional[str] = Field(None, description="安装位置")
    remark: Optional[str] = Field(None, description="备注")

class RepairOrderCreate(RepairOrderBase):
    dispatch_user: str = Field(..., description="派单人")
    assigned_team: TeamType = Field(..., description="指派班组")
    team_leader: str = Field(..., description="班组长")
    team_phone: str = Field(..., description="班组联系电话")

class RepairOrderAccept(BaseModel):
    accept_user: str = Field(..., description="接单人")

class RepairOrderProcess(BaseModel):
    arrival_time: datetime = Field(..., description="到达现场时间")
    repair_start_time: datetime = Field(..., description="开始维修时间")

class RepairOrderComplete(BaseModel):
    repair_end_time: datetime = Field(..., description="维修结束时间")
    repair_content: str = Field(..., description="维修内容")
    replaced_parts: Optional[str] = Field(None, description="更换配件")

class RepairOrderVerify(BaseModel):
    verification_result: str = Field(..., description="验证结果")
    verification_user: str = Field(..., description="验证人")

class RepairOrderReject(BaseModel):
    reject_reason: str = Field(..., description="驳回原因")

class RepairOrderClose(BaseModel):
    close_user: str = Field(..., description="闭环人")

class RepairOrderResponse(RepairOrderBase):
    order_id: str = Field(..., description="派修单号")
    dispatch_time: Optional[datetime] = Field(None, description="派单时间")
    dispatch_user: Optional[str] = Field(None, description="派单人")
    assigned_team: Optional[TeamType] = Field(None, description="指派班组")
    team_leader: Optional[str] = Field(None, description="班组长")
    team_phone: Optional[str] = Field(None, description="班组联系电话")
    accept_time: Optional[datetime] = Field(None, description="接单时间")
    accept_user: Optional[str] = Field(None, description="接单人")
    arrival_time: Optional[datetime] = Field(None, description="到达现场时间")
    repair_start_time: Optional[datetime] = Field(None, description="开始维修时间")
    repair_end_time: Optional[datetime] = Field(None, description="维修结束时间")
    repair_content: Optional[str] = Field(None, description="维修内容")
    replaced_parts: Optional[str] = Field(None, description="更换配件")
    verification_result: Optional[str] = Field(None, description="验证结果")
    verification_user: Optional[str] = Field(None, description="验证人")
    verification_time: Optional[datetime] = Field(None, description="验证时间")
    close_time: Optional[datetime] = Field(None, description="闭环时间")
    close_user: Optional[str] = Field(None, description="闭环人")
    status: RepairStatus = Field(..., description="派修状态")
    reject_reason: Optional[str] = Field(None, description="驳回原因")

    class Config:
        from_attributes = True

class ErrorResponse(BaseModel):
    error_code: str = Field(..., description="错误码")
    message: str = Field(..., description="错误消息")
    detail: dict = Field(..., description="详细信息，包含拦截原因和处理建议")
    timestamp: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
