from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ApprovalNode(str, Enum):
    STORE_MANAGER = "门店经理"
    DISTRICT_SUPERVISOR = "区域督导"
    FINANCE_AUDIT = "财务审核"
    GENERAL_MANAGER = "总经理审批"


class ReportCaliber(str, Enum):
    OLD = "旧口径"
    NEW = "新口径"
    UNKNOWN = "未知"


class ReceiptStatus(str, Enum):
    PENDING = "待处理"
    DUPLICATE = "重复"
    VALID = "有效"
    ABNORMAL = "异常"
    CALIBER_CHANGED = "口径变更"


class MeetingAttachment(BaseModel):
    id: str
    file_name: str
    original_value: str
    corrected_value: Optional[str] = None
    upload_time: datetime
    uploader: str


class DeviceLedger(BaseModel):
    id: str = Field(description="台账记录唯一ID")
    original_id: str = Field(description="原始输入ID，用于回溯")
    source_file: str = Field(description="来源文件名")
    row_number: int = Field(description="原始行号")
    
    store_code: str = Field(description="门店编号")
    store_name: str = Field(description="门店名称")
    device_code: str = Field(description="设备编号")
    device_name: str = Field(description="设备名称")
    device_type: str = Field(description="设备类型")
    brand: str = Field(description="品牌")
    model: str = Field(description="型号")
    serial_number: str = Field(description="序列号")
    purchase_date: str = Field(description="采购日期")
    purchase_amount: float = Field(description="采购金额")
    receipt_number: str = Field(description="收据编号")
    receipt_date: str = Field(description="收据日期")
    supplier: str = Field(description="供应商")
    operator: str = Field(description="经办人")
    approval_node: ApprovalNode = Field(description="当前审批节点")
    approval_status: str = Field(description="审批状态")
    report_caliber: ReportCaliber = Field(description="报告口径")
    
    meeting_attachments: Optional[List[MeetingAttachment]] = None
    raw_data: Dict[str, Any] = Field(description="原始输入数据完整备份")
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class DuplicateRecord(BaseModel):
    id: str
    original_receipt_id: str
    duplicate_receipt_id: str
    duplicate_fields: List[str]
    duplicate_reason: str
    confidence: float
    detected_at: datetime
    reviewed: bool = False
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None


class AbnormalRecord(BaseModel):
    id: str
    receipt_id: str
    abnormal_type: str
    description: str
    field_name: Optional[str] = None
    original_value: Optional[str] = None
    expected_value: Optional[str] = None
    detected_at: datetime
    export_status: str = "待导出"
    exported_at: Optional[datetime] = None


class BatchPreviewRequest(BaseModel):
    file_names: List[str]
    deduplication_fields: List[str]
    enable_caliber_check: bool = True


class BatchPreviewResult(BaseModel):
    total_records: int
    potential_duplicates: int
    potential_abnormal: int
    caliber_changed_count: int
    affected_stores: List[str]
    affected_approval_nodes: Dict[ApprovalNode, int]
    sample_preview: List[Dict[str, Any]]


class ExportRequest(BaseModel):
    record_ids: Optional[List[str]] = None
    export_type: str = Field(description="all/duplicates/abnormal/caliber_changed")
    include_original_data: bool = True
    include_approval_history: bool = True


class ExportResult(BaseModel):
    file_path: str
    record_count: int
    export_time: datetime
    checksum: str


class DeduplicationResult(BaseModel):
    total_processed: int
    duplicates_found: int
    valid_records: int
    abnormal_records: int
    caliber_changed_records: int
    duplicate_records: List[DuplicateRecord]
    abnormal_records_list: List[AbnormalRecord]
