"""数据模型定义"""
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, validator


class BatchStatus(str, Enum):
    NORMAL = "normal"
    HOLD = "hold"
    RECALL = "recall"
    CLEARED = "cleared"


class CheckType(str, Enum):
    GREEN_BATCH_MIX = "green_batch_mix"
    ROAST_CURVE_ANOMALY = "roast_curve_anomaly"
    CUPPING_DEFECT_EXCEED = "cupping_defect_exceed"
    LABEL_MISMATCH = "label_mismatch"
    SHIPMENT_RISK = "shipment_risk"


class GreenBeanBatch(BaseModel):
    batch_id: str = Field(..., description="生豆批次号")
    origin: str = Field(..., description="产地")
    variety: str = Field(..., description="品种")
    process: str = Field(..., description="处理法")
    arrival_date: date = Field(..., description="到货日期")
    quantity_kg: float = Field(..., gt=0, description="到货数量(kg)")
    supplier: str = Field(..., description="供应商")
    certificate: Optional[str] = Field(None, description="认证编号")
    notes: Optional[str] = Field(None, description="备注")

    @validator("arrival_date", pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v


class RoastLog(BaseModel):
    roast_batch_id: str = Field(..., description="烘焙批次号")
    green_batch_ids: list[str] = Field(..., description="使用的生豆批次号列表")
    roast_date: date = Field(..., description="烘焙日期")
    green_weight_kg: float = Field(..., gt=0, description="生豆重量(kg)")
    roasted_weight_kg: float = Field(..., gt=0, description="熟豆重量(kg)")
    roast_curve_points: list[dict[str, Any]] = Field(
        ..., description="烘焙曲线点，包含time, temperature等"
    )
    first_crack_time: Optional[int] = Field(None, description="一爆时间(秒)")
    first_crack_temp: Optional[float] = Field(None, description="一爆温度(°C)")
    second_crack_time: Optional[int] = Field(None, description="二爆时间(秒)")
    second_crack_temp: Optional[float] = Field(None, description="二爆温度(°C)")
    drop_temp: float = Field(..., gt=0, description="出锅温度(°C)")
    drop_time: int = Field(..., gt=0, description="总烘焙时间(秒)")
    roast_level: str = Field(..., description="烘焙度")
    roaster: str = Field(..., description="烘焙师")

    @validator("roast_date", pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v

    @validator("green_batch_ids", pre=True)
    def parse_green_batch_ids(cls, v):
        if isinstance(v, str):
            return [b.strip() for b in v.split(",") if b.strip()]
        return v


class CuppingRecord(BaseModel):
    roast_batch_id: str = Field(..., description="烘焙批次号")
    cupping_date: date = Field(..., description="杯测日期")
    cupper: str = Field(..., description="杯测师")
    dry_aroma: float = Field(..., ge=0, le=10, description="干香")
    wet_aroma: float = Field(..., ge=0, le=10, description="湿香")
    flavor: float = Field(..., ge=0, le=10, description="风味")
    aftertaste: float = Field(..., ge=0, le=10, description="余韵")
    acidity: float = Field(..., ge=0, le=10, description="酸度")
    body: float = Field(..., ge=0, le=10, description="醇厚度")
    uniformity: float = Field(..., ge=0, le=10, description="一致性")
    clean_cup: float = Field(..., ge=0, le=10, description="干净度")
    sweetness: float = Field(..., ge=0, le=10, description="甜度")
    overall: float = Field(..., ge=0, le=10, description="综合得分")
    defects: list[dict[str, Any]] = Field(default_factory=list, description="缺陷列表")
    total_defect_points: float = Field(ge=0, default=0, description="缺陷点数总计")
    notes: Optional[str] = Field(None, description="备注")

    @validator("cupping_date", pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v

    @validator("defects", pre=True)
    def parse_defects(cls, v):
        if isinstance(v, str):
            import ast
            try:
                return ast.literal_eval(v)
            except (ValueError, SyntaxError):
                return []
        return v


class PackagingLabel(BaseModel):
    label_id: str = Field(..., description="贴标编号")
    roast_batch_id: str = Field(..., description="烘焙批次号")
    product_name: str = Field(..., description="产品名称")
    net_weight_g: int = Field(..., gt=0, description="净含量(g)")
    roast_date: date = Field(..., description="烘焙日期")
    best_before_date: date = Field(..., description="最佳赏味期")
    batch_number: str = Field(..., description="生产批号")
    origin: str = Field(..., description="产地")
    process: str = Field(..., description="处理法")
    quantity: int = Field(..., gt=0, description="贴标数量")
    packer: str = Field(..., description="包装员")
    pack_date: date = Field(..., description="包装日期")

    @validator("roast_date", "best_before_date", "pack_date", pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v


class ShipmentRecord(BaseModel):
    shipment_id: str = Field(..., description="发货单号")
    shipment_date: date = Field(..., description="发货日期")
    store_name: str = Field(..., description="门店名称")
    items: list[dict[str, Any]] = Field(..., description="发货明细")
    total_quantity: int = Field(..., gt=0, description="总数量")
    recipient: str = Field(..., description="收货人")
    contact: str = Field(..., description="联系方式")
    address: str = Field(..., description="收货地址")
    courier: Optional[str] = Field(None, description="快递公司")
    tracking_number: Optional[str] = Field(None, description="运单号")
    status: str = Field(default="shipped", description="发货状态")

    @validator("shipment_date", pre=True)
    def parse_date(cls, v):
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v

    @validator("items", pre=True)
    def parse_items(cls, v):
        if isinstance(v, str):
            import ast
            try:
                return ast.literal_eval(v)
            except (ValueError, SyntaxError):
                return []
        return v


class CheckResult(BaseModel):
    check_type: CheckType
    roast_batch_id: str
    severity: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    detected_at: datetime = Field(default_factory=datetime.now)


class BatchReview(BaseModel):
    roast_batch_id: str
    reviewer: str
    review_date: datetime = Field(default_factory=datetime.now)
    status: BatchStatus
    notes: str
    action_items: list[str] = Field(default_factory=list)


class AuditPackage(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.now)
    batches: list[dict[str, Any]] = Field(default_factory=list)
    check_results: list[dict[str, Any]] = Field(default_factory=list)
    reviews: list[dict[str, Any]] = Field(default_factory=list)
    green_batches: list[dict[str, Any]] = Field(default_factory=list)
    roast_logs: list[dict[str, Any]] = Field(default_factory=list)
    cupping_records: list[dict[str, Any]] = Field(default_factory=list)
    labels: list[dict[str, Any]] = Field(default_factory=list)
    shipments: list[dict[str, Any]] = Field(default_factory=list)
