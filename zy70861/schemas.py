from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class MaterialItem(BaseModel):
    repair_order_no: str = Field(..., description="抢修单号")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    quantity: float = Field(..., description="数量")
    unit: str = Field(..., description="单位")
    vehicle_id: str = Field(..., description="车辆ID")
    operator: str = Field(..., description="操作人")
    operation_type: str = Field(..., description="操作类型：领用/归还")
    is_emergency: Optional[bool] = Field(False, description="是否紧急领用")


class VehicleItem(BaseModel):
    vehicle_id: str = Field(..., description="车辆ID")
    vehicle_plate: str = Field(..., description="车牌号")
    driver: str = Field(..., description="司机")
    team: str = Field(..., description="所属班组")
    status: str = Field(..., description="车辆状态")


class InventoryItem(BaseModel):
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    quantity: float = Field(..., description="库存数量")
    unit: str = Field(..., description="单位")
    warehouse: str = Field(..., description="仓库")


class ProcessedItem(BaseModel):
    item: Dict[str, Any]
    status: str
    suggestion: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class ImportResult(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
    success_items: List[ProcessedItem]
    pending_items: List[ProcessedItem]
    failed_items: List[ProcessedItem]


class BatchInfo(BaseModel):
    batch_id: str
    process_time: datetime
    total_count: int
    success_count: int
    pending_count: int
    failed_count: int
