from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime


class CustomsDeclaration(BaseModel):
    order_id: str = Field(description="订单ID")
    sku_code: str = Field(description="SKU编码")
    product_name: str = Field(description="商品名称")
    category_code: str = Field(description="品类编码")
    amount: float = Field(description="订单金额")
    currency: str = Field(description="币种", default="USD")
    quantity: int = Field(description="数量", default=1)
    declared_tariff_rate: float = Field(description="申报税率", default=0.0)
    declaration_date: str = Field(description="申报日期")
    consignee: str = Field(description="收货人")
    destination_country: str = Field(description="目的国", default="CN")


class TariffRule(BaseModel):
    hs_code: str = Field(description="HS编码")
    category_name: str = Field(description="品类名称")
    tariff_rate: float = Field(description="税率")
    description: str = Field(description="描述")
    effective_date: str = Field(description="生效日期")
    expiry_date: str = Field(description="失效日期")


class ReturnReceipt(BaseModel):
    receipt_id: str = Field(description="回执ID")
    order_id: str = Field(description="订单ID")
    return_code: str = Field(description="退单代码")
    return_reason: str = Field(description="退单原因")
    suggestion: str = Field(description="处理建议")
    return_date: str = Field(description="退单日期")


class NormalItem(BaseModel):
    order_id: str = Field(description="订单ID")
    sku_code: str = Field(description="SKU编码")
    product_name: str = Field(description="商品名称")
    final_amount_cny: float = Field(description="人民币金额")
    tariff_rate: float = Field(description="适用税率")
    tariff_amount: float = Field(description="税额")
    category: str = Field(description="归并后品类")
    notes: List[str] = Field(description="处理说明", default_factory=list)


class PendingItem(BaseModel):
    order_id: str = Field(description="订单ID")
    original_data: Dict[str, Any] = Field(description="原始数据")
    pending_reason: str = Field(description="待确认原因")
    suggestion: str = Field(description="确认建议")


class FailedItem(BaseModel):
    order_id: str = Field(description="订单ID")
    original_data: Dict[str, Any] = Field(description="原始字段完整保留")
    failure_type: str = Field(description="失败类型")
    failure_reason: str = Field(description="失败原因详细说明")
    suggestion: str = Field(description="建议处理方式")
    boundary_note: Optional[str] = Field(description="边界情况说明", default=None)


class ProcessingResult(BaseModel):
    total_count: int = Field(description="总记录数")
    normal_count: int = Field(description="正常项数量")
    pending_count: int = Field(description="待确认项数量")
    failed_count: int = Field(description="失败项数量")
    normal_items: List[NormalItem] = Field(description="正常项列表")
    pending_items: List[PendingItem] = Field(description="待确认项列表")
    failed_items: List[FailedItem] = Field(description="失败项列表")
    currency_notes: List[str] = Field(description="币种换算说明")
    category_notes: List[str] = Field(description="品类归并说明")
    duplicate_notes: List[str] = Field(description="重复补税说明")


class BatchSubmissionRequest(BaseModel):
    batch_id: str = Field(description="批次ID")
    declaration_ids: Optional[List[str]] = Field(description="申报单ID列表", default=None)


class BatchSubmissionResponse(BaseModel):
    batch_id: str = Field(description="批次ID")
    status: str = Field(description="处理状态")
    message: str = Field(description="处理消息")
    result: Optional[ProcessingResult] = Field(description="处理结果", default=None)
    processed_at: str = Field(description="处理时间")


class BoundaryNote(BaseModel):
    type: str = Field(description="边界类型")
    description: str = Field(description="详细说明")
    affected_items: int = Field(description="影响数量")
