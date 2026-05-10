from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ReportStatusEnum(str, Enum):
    DRAFT = "草稿"
    GENERATING = "生成中"
    COMPLETED = "已完成"
    ARCHIVED = "已归档"


class VerificationReportBase(BaseModel):
    report_name: str = Field(..., description="报告名称")
    batch_code: str = Field(..., description="批次编号")
    remark: Optional[str] = Field(default=None, description="备注")


class VerificationReportCreate(BaseModel):
    batch_code: str = Field(..., description="批次编号")
    report_name: Optional[str] = Field(default=None, description="报告名称")
    generated_by: str = Field(..., description="生成人")


class VerificationReportResponse(BaseModel):
    id: int = Field(..., description="主键ID")
    report_code: str = Field(..., description="报告编号")
    report_name: str = Field(..., description="报告名称")
    batch_code: str = Field(..., description="批次编号")
    flight_date: Optional[datetime] = Field(default=None, description="飞行日期")
    flight_area: Optional[str] = Field(default=None, description="飞行区域")
    total_lesion_count: int = Field(default=0, description="疑似病斑总数")
    confirmed_count: int = Field(default=0, description="确认为病斑数量")
    false_positive_count: int = Field(default=0, description="误报数量")
    pending_count: int = Field(default=0, description="待核验数量")
    total_area_m2: float = Field(default=0.0, description="病斑总面积(平方米)")
    confirmed_area_m2: float = Field(default=0.0, description="确认病斑面积(平方米)")
    verification_rate: float = Field(default=0.0, description="核验完成率(%)")
    false_positive_rate: float = Field(default=0.0, description="误报率(%)")
    grid_summary: Optional[List[Dict[str, Any]]] = Field(default=None, description="地块维度汇总")
    crop_type_summary: Optional[List[Dict[str, Any]]] = Field(default=None, description="作物类型维度汇总")
    lesion_type_summary: Optional[List[Dict[str, Any]]] = Field(default=None, description="病斑类型维度汇总")
    export_file_path: Optional[str] = Field(default=None, description="导出文件路径")
    export_file_name: Optional[str] = Field(default=None, description="导出文件名")
    export_format: Optional[str] = Field(default=None, description="导出格式")
    status: ReportStatusEnum = Field(default=ReportStatusEnum.DRAFT, description="报告状态")
    generated_by: str = Field(..., description="生成人")
    generated_at: datetime = Field(..., description="生成时间")
    updated_at: datetime = Field(..., description="更新时间")
    remark: Optional[str] = Field(default=None, description="备注")
    
    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: list[VerificationReportResponse] = Field(..., description="报告列表")


class ReportExportRequest(BaseModel):
    report_code: str = Field(..., description="报告编号")
    output_dir: Optional[str] = Field(default="./exports", description="导出目录")
