from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class ValidationError(BaseModel):
    row_number: int
    field: str
    error_type: str
    message: str
    value: Any = None


class CustomerRecord(BaseModel):
    customer_id: str = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    warehouse_location: str = Field(..., description="库位")
    volume: float = Field(..., gt=0, description="体积(立方米)")
    occupancy_days: int = Field(..., gt=0, description="占用天数")
    checkin_date: Optional[datetime] = Field(None, description="入仓日期")
    checkout_date: Optional[datetime] = Field(None, description="退仓日期")
    free_rent_days: int = Field(0, ge=0, description="约定免租天数")
    is_checked_out: bool = Field(False, description="是否已退仓")
    notes: Optional[str] = Field(None, description="备注")

    @validator("checkout_date")
    def checkout_after_checkin(cls, v, values):
        if v and values.get("checkin_date") and v < values["checkin_date"]:
            raise ValueError("退仓日期不能早于入仓日期")
        return v

    @validator("occupancy_days")
    def occupancy_days_match_dates(cls, v, values):
        if values.get("checkin_date") and values.get("checkout_date"):
            calculated_days = (values["checkout_date"] - values["checkin_date"]).days
            if calculated_days > 0 and abs(v - calculated_days) > 1:
                raise ValueError(f"占用天数与日期差不符，计算得{calculated_days}天")
        return v


class VolumeTier(BaseModel):
    min_volume: float = Field(..., ge=0)
    max_volume: Optional[float] = Field(None, ge=0)
    price_per_cbm: float = Field(..., gt=0)


class DaysTier(BaseModel):
    min_days: int = Field(..., ge=0)
    max_days: Optional[int] = Field(None, ge=0)
    discount_rate: float = Field(1.0, ge=0, le=2)


class RentRule(BaseModel):
    rule_id: str
    rule_name: str
    effective_date: datetime
    volume_tiers: List[VolumeTier]
    days_tiers: List[DaysTier]
    base_price_per_cbm_per_day: float = Field(..., gt=0)
    checkout_truncation_hours: int = Field(12, ge=0, le=24, description="退仓截断小时数")

    def get_volume_price(self, volume: float) -> float:
        for tier in sorted(self.volume_tiers, key=lambda x: x.min_volume, reverse=True):
            if volume >= tier.min_volume:
                if tier.max_volume is None or volume <= tier.max_volume:
                    return tier.price_per_cbm
        return self.base_price_per_cbm_per_day

    def get_days_discount(self, days: int) -> float:
        for tier in sorted(self.days_tiers, key=lambda x: x.min_days, reverse=True):
            if days >= tier.min_days:
                if tier.max_days is None or days <= tier.max_days:
                    return tier.discount_rate
        return 1.0


class CalculationResult(BaseModel):
    customer_id: str
    customer_name: str
    warehouse_location: str
    volume: float
    raw_occupancy_days: int
    checkout_truncated_days: int
    effective_occupancy_days: int
    free_rent_days_applied: int
    billable_days: int
    volume_tier_price: float
    days_discount_rate: float
    daily_rate: float
    base_amount: float
    discount_amount: float
    final_amount: float
    calculation_details: Dict[str, Any]
    warnings: List[str] = Field(default_factory=list)


class BillingReport(BaseModel):
    report_id: str
    generated_at: datetime
    total_records: int
    valid_records: int
    invalid_records: int
    total_base_amount: float
    total_discount_amount: float
    total_final_amount: float
    results: List[CalculationResult]
    errors: List[ValidationError]
    summary_stats: Dict[str, Any]
