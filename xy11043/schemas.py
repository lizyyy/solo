from pydantic import BaseModel, Field, validator
from datetime import date, datetime
from typing import Optional, List

class CuttingQueueBase(BaseModel):
    order_no: str = Field(..., max_length=50, description="订单编号")
    customer_name: str = Field(..., max_length=100, description="客户名称")
    store_name: str = Field(..., max_length=100, description="门店名称")
    salesperson: str = Field(..., max_length=50, description="销售员")
    order_date: date = Field(..., description="下单日期")
    delivery_date: date = Field(..., description="交货日期")
    
    board_type: str = Field(..., max_length=50, description="板材类型")
    board_color: str = Field(..., max_length=50, description="板材颜色")
    board_thickness: float = Field(..., gt=0, description="板材厚度(mm)")
    board_length: int = Field(..., gt=0, description="板材长度(mm)")
    board_width: int = Field(..., gt=0, description="板材宽度(mm)")
    
    required_pieces: int = Field(..., gt=0, description="需求数量")
    cut_pieces: int = Field(default=0, ge=0, description="已裁切数量")
    remaining_pieces: int = Field(..., ge=0, description="剩余数量")
    
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_batch: Optional[str] = Field(None, max_length=50, description="物料批次")
    material_location: Optional[str] = Field(None, max_length=100, description="物料位置")
    
    edge_banding: Optional[str] = Field(None, max_length=100, description="封边要求")
    drilling: Optional[str] = Field(None, max_length=100, description="钻孔要求")
    special_processing: Optional[str] = Field(None, description="特殊工艺")
    
    priority: int = Field(default=5, ge=1, le=10, description="优先级(1-10)")
    status: str = Field(default="pending", max_length=20, description="状态")
    assigned_to: Optional[str] = Field(None, max_length=50, description="负责人")
    machine_no: Optional[str] = Field(None, max_length=20, description="机器编号")
    
    estimated_cutting_time: Optional[int] = Field(None, description="预计裁切时间(分钟)")
    
    remarks: Optional[str] = Field(None, description="备注")
    is_urgent: bool = Field(default=False, description="是否急单")
    has_remaining_material: bool = Field(default=False, description="是否有余料")
    remaining_material_info: Optional[str] = Field(None, description="余料信息")
    created_by: Optional[str] = Field(None, max_length=50, description="创建人")
    
    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ['pending', 'queued', 'cutting', 'completed', 'paused', 'cancelled']
        if v not in valid_statuses:
            raise ValueError(f'状态必须是以下之一: {", ".join(valid_statuses)}')
        return v

class CuttingQueueCreate(CuttingQueueBase):
    pass

class CuttingQueueUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, max_length=100)
    store_name: Optional[str] = Field(None, max_length=100)
    salesperson: Optional[str] = Field(None, max_length=50)
    order_date: Optional[date] = None
    delivery_date: Optional[date] = None
    
    board_type: Optional[str] = Field(None, max_length=50)
    board_color: Optional[str] = Field(None, max_length=50)
    board_thickness: Optional[float] = Field(None, gt=0)
    board_length: Optional[int] = Field(None, gt=0)
    board_width: Optional[int] = Field(None, gt=0)
    
    required_pieces: Optional[int] = Field(None, gt=0)
    cut_pieces: Optional[int] = Field(None, ge=0)
    remaining_pieces: Optional[int] = Field(None, gt=0)
    
    material_code: Optional[str] = Field(None, max_length=50)
    material_batch: Optional[str] = Field(None, max_length=50)
    material_location: Optional[str] = Field(None, max_length=100)
    
    edge_banding: Optional[str] = Field(None, max_length=100)
    drilling: Optional[str] = Field(None, max_length=100)
    special_processing: Optional[str] = None
    
    priority: Optional[int] = Field(None, ge=1, le=10)
    status: Optional[str] = Field(None, max_length=20)
    assigned_to: Optional[str] = Field(None, max_length=50)
    machine_no: Optional[str] = Field(None, max_length=20)
    
    estimated_cutting_time: Optional[int] = None
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    
    remarks: Optional[str] = None
    is_urgent: Optional[bool] = None
    has_remaining_material: Optional[bool] = None
    remaining_material_info: Optional[str] = None
    updated_by: Optional[str] = Field(None, max_length=50)

class CuttingQueueResponse(CuttingQueueBase):
    id: int
    version: int
    created_at: datetime
    updated_at: datetime
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True

class BatchImportItem(BaseModel):
    order_no: str
    customer_name: str
    store_name: str
    salesperson: str
    order_date: date
    delivery_date: date
    board_type: str
    board_color: str
    board_thickness: float
    board_length: int
    board_width: int
    required_pieces: int
    cut_pieces: int = 0
    remaining_pieces: int
    material_code: str
    material_batch: Optional[str] = None
    material_location: Optional[str] = None
    edge_banding: Optional[str] = None
    drilling: Optional[str] = None
    special_processing: Optional[str] = None
    priority: int = 5
    status: str = "pending"
    assigned_to: Optional[str] = None
    machine_no: Optional[str] = None
    estimated_cutting_time: Optional[int] = None
    remarks: Optional[str] = None
    is_urgent: bool = False
    created_by: Optional[str] = None

class BatchImportResult(BaseModel):
    row: int
    order_no: str
    success: bool
    message: str
    error_type: Optional[str] = None
    data: Optional[CuttingQueueResponse] = None

class BatchImportResponse(BaseModel):
    total: int
    success_count: int
    failed_count: int
    results: List[BatchImportResult]
