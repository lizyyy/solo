from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class RefundFeeCreate(BaseModel):
    原购票单号: str = Field(..., description="原购票单号")
    乘车日期: datetime
    退票日期: datetime
    班次号: str
    起点站: str
    终点站: str
    乘客姓名: str
    身份证号: str
    联系电话: str
    原票价: float
    退票手续费比例: float
    退票手续费金额: float
    实退金额: float
    退票原因: str
    退票类型: str
    班次状态: str
    门店名称: str
    门店编号: str
    负责人姓名: str
    审核人: Optional[str] = None
    审核时间: Optional[datetime] = None
    当前状态: str = "待审核"
    备注: Optional[str] = None
    是否旧记录修正: bool = False
    修正原因: Optional[str] = None


class RefundFeeUpdate(BaseModel):
    原购票单号: Optional[str] = None
    乘车日期: Optional[datetime] = None
    退票日期: Optional[datetime] = None
    班次号: Optional[str] = None
    起点站: Optional[str] = None
    终点站: Optional[str] = None
    乘客姓名: Optional[str] = None
    身份证号: Optional[str] = None
    联系电话: Optional[str] = None
    原票价: Optional[float] = None
    退票手续费比例: Optional[float] = None
    退票手续费金额: Optional[float] = None
    实退金额: Optional[float] = None
    退票原因: Optional[str] = None
    退票类型: Optional[str] = None
    班次状态: Optional[str] = None
    门店名称: Optional[str] = None
    门店编号: Optional[str] = None
    负责人姓名: Optional[str] = None
    审核人: Optional[str] = None
    审核时间: Optional[datetime] = None
    当前状态: Optional[str] = None
    备注: Optional[str] = None
    是否旧记录修正: Optional[bool] = None
    修正原因: Optional[str] = None
    操作人: str
    IP地址: Optional[str] = None


class RefundFeeResponse(BaseModel):
    id: int
    退票单号: str
    原购票单号: str
    乘车日期: datetime
    退票日期: datetime
    班次号: str
    起点站: str
    终点站: str
    乘客姓名: str
    身份证号: str
    联系电话: str
    原票价: float
    退票手续费比例: float
    退票手续费金额: float
    实退金额: float
    退票原因: str
    退票类型: str
    班次状态: str
    门店名称: str
    门店编号: str
    负责人姓名: str
    审核人: Optional[str] = None
    审核时间: Optional[datetime] = None
    当前状态: str
    备注: Optional[str] = None
    是否旧记录修正: bool
    修正原因: Optional[str] = None
    创建时间: datetime
    更新时间: datetime

    class Config:
        orm_mode = True


class RefundFeeHistoryResponse(BaseModel):
    id: int
    退票单号: str
    操作类型: str
    操作人: str
    操作时间: datetime
    变更前数据: Optional[str] = None
    变更后数据: Optional[str] = None
    变更字段: Optional[str] = None
    IP地址: Optional[str] = None
    备注: Optional[str] = None

    class Config:
        orm_mode = True


class BatchImportResult(BaseModel):
    行号: int
    退票单号: Optional[str] = None
    状态: str
    消息: str
    错误类型: Optional[str] = None


class BatchImportResponse(BaseModel):
    总行数: int
    成功行数: int
    失败行数: int
    结果详情: List[BatchImportResult]
