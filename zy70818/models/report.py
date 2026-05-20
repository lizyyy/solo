from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ReportType(str, Enum):
    SUMMARY = "汇总报告"
    DETAIL = "明细报告"
    DISCREPANCY = "差异报告"
    RECALL = "召回专项报告"
    EXPIRY = "效期专项报告"


class ReportFormat(str, Enum):
    EXCEL = "xlsx"
    CSV = "csv"
    PDF = "pdf"


class ReportSummaryItem(BaseModel):
    category: str = Field(..., description="类别")
    total_quantity: int = Field(..., description="总数量")
    normal_quantity: int = Field(..., description="正常数量")
    recalled_quantity: int = Field(..., description="召回数量")
    near_expiry_quantity: int = Field(..., description="近效期数量")
    expired_quantity: int = Field(..., description="过期数量")
    discrepancy_quantity: int = Field(..., description="差异数量")


class ReportDetailItem(BaseModel):
    batch_number: str = Field(..., description="批号")
    material_name: str = Field(..., description="物料名称")
    material_type: str = Field(..., description="物料类型")
    specification: str = Field(..., description="规格型号")
    store_name: str = Field(..., description="门店名称")
    initial_quantity: int = Field(..., description="期初数量")
    consumed_quantity: int = Field(..., description="消耗数量")
    transfer_in_quantity: int = Field(..., description="调入数量")
    transfer_out_quantity: int = Field(..., description="调出数量")
    current_quantity: int = Field(..., description="当前数量")
    expected_quantity: int = Field(..., description="应存数量")
    diff_quantity: int = Field(..., description="差异数量")
    status: str = Field(..., description="状态")
    is_recalled: bool = Field(..., description="是否召回")
    expiry_date: Optional[date] = Field(None, description="有效期至")
    remarks: Optional[str] = Field(None, description="备注")


class ReportData(BaseModel):
    id: Optional[str] = None
    reconciliation_id: str = Field(..., description="对账任务ID")
    report_type: ReportType = Field(..., description="报告类型")
    report_format: ReportFormat = Field(..., description="报告格式")
    title: str = Field(..., description="报告标题")
    generated_at: datetime = Field(default_factory=datetime.now)
    generated_by: Optional[str] = None
    summary: List[ReportSummaryItem] = Field(default_factory=list)
    details: List[ReportDetailItem] = Field(default_factory=list)
    discrepancies: List[Dict[str, Any]] = Field(default_factory=list)
    statistics: Dict[str, Any] = Field(default_factory=dict)
    file_path: Optional[str] = None
    file_size: Optional[int] = None

    class Config:
        use_enum_values = True
