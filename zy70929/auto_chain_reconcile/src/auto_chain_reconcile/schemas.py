from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class ReconcileRequest(BaseModel):
    batch_key: str = Field(..., description="幂等批次号；同值再次提交直接返回历史结果")
    store_id: str = Field(..., description="当前提交的门店 ID")
    packages: list[dict[str, Any]] = Field(default_factory=list, description="套餐列表或 CSV 解析结果")
    work_orders: list[dict[str, Any]] = Field(default_factory=list, description="工单列表")
    inventory: list[dict[str, Any]] = Field(default_factory=list, description="配件库存批次列表")


class ReconcileOrderOut(BaseModel):
    order_id: str
    status: str
    reason: str
    suggestion: str
    matched_package_id: Optional[str] = None
    consumed_batches: list[dict[str, Any]] = Field(default_factory=list)
    raw: dict[str, Any] = Field(default_factory=dict)
    rules: list[str] = Field(default_factory=list)


class ReconcileResponse(BaseModel):
    batch_key: str
    store_id: str
    summary: dict[str, int]
    normal: list[ReconcileOrderOut]
    pending: list[ReconcileOrderOut]
    failed: list[ReconcileOrderOut]


class TracePartIn(BaseModel):
    part_code: str
    store_id: Optional[str] = None
    order_id: Optional[str] = None


class TracePartOut(BaseModel):
    part_code: str
    part_name: str
    batch_no: str
    supplier: str
    inbound_date: str
    store_id: str
    initial_qty: int
    remaining_qty: int
    consumed_by_orders: list[str] = Field(default_factory=list)
