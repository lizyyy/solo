from decimal import Decimal
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator


class Unit(str, Enum):
    GRAM = "g"
    KILOGRAM = "kg"
    MILLIGRAM = "mg"
    PERCENT = "%"


class WaterActivityTarget(BaseModel):
    target_aw: Decimal = Field(ge=0, le=1, description="目标水分活度")
    safety_margin_aw: Optional[Decimal] = Field(default=Decimal("0.02"), ge=0, description="安全余量")
    min_aw: Optional[Decimal] = Field(None, ge=0, le=1, description="最低允许水分活度")
    max_aw: Optional[Decimal] = Field(None, ge=0, le=1, description="最高允许水分活度")

    @field_validator("min_aw", "max_aw")
    @classmethod
    def check_aw_bounds(cls, v: Optional[Decimal], info) -> Optional[Decimal]:
        if v is not None:
            if v <= 0 or v >= 1:
                raise ValueError("水分活度必须在0到1之间")
        return v


class Ingredient(BaseModel):
    name: str = Field(description="原料名称")
    moisture_content_wet: Decimal = Field(ge=0, le=1, description="湿基含水率（小数）")
    moisture_content_dry: Optional[Decimal] = Field(None, ge=0, description="干基含水率（小数）")
    aw: Optional[Decimal] = Field(None, ge=0, le=1, description="水分活度")
    sorption_isotherm: Optional[Dict[str, Decimal]] = Field(None, description="水分吸附等温线数据 {aw: moisture_dry_basis}")
    notes: Optional[str] = Field(None, description="备注")

    @property
    def dry_basis_moisture(self) -> Decimal:
        if self.moisture_content_dry is not None:
            return self.moisture_content_dry
        wet = self.moisture_content_wet
        if wet == Decimal("1"):
            return Decimal("0")
        return wet / (Decimal("1") - wet)

    @property
    def wet_basis_moisture(self) -> Decimal:
        return self.moisture_content_wet


class FormulaIngredient(BaseModel):
    name: str = Field(description="原料名称")
    amount: Decimal = Field(gt=0, description="用量")
    unit: Unit = Field(default=Unit.GRAM, description="单位")
    moisture_override: Optional[Decimal] = Field(None, ge=0, le=1, description="覆盖原料库含水率")
    aw_override: Optional[Decimal] = Field(None, gt=0, lt=1, description="覆盖原料库水分活度")


class BakingProfile(BaseModel):
    loss_percentage: Decimal = Field(ge=0, le=1, description="烘烤损耗率（小数）")
    loss_is_water_only: bool = Field(default=True, description="损耗是否仅为水分")
    notes: Optional[str] = Field(None, description="备注")


class Recipe(BaseModel):
    name: str = Field(description="配方名称")
    version: Optional[str] = Field(None, description="版本号")
    batch_size: Decimal = Field(gt=0, description="批次重量")
    batch_unit: Unit = Field(default=Unit.KILOGRAM, description="批次单位")
    ingredients: List[FormulaIngredient] = Field(description="原料列表")
    target: WaterActivityTarget = Field(description="目标水分活度")
    baking_profile: Optional[BakingProfile] = Field(None, description="烘烤工艺")
    notes: Optional[str] = Field(None, description="备注")


class CalculationResult(BaseModel):
    recipe_name: str
    timestamp: str
    
    total_input_weight: Decimal
    total_input_weight_unit: Unit
    
    total_dry_solids: Decimal
    total_water_input: Decimal
    
    initial_moisture_wet_basis: Decimal
    initial_moisture_dry_basis: Decimal
    initial_aw_estimate: Optional[Decimal]
    
    baking_loss_amount: Decimal
    baking_water_loss: Decimal
    baking_solids_loss: Decimal
    
    water_after_baking: Decimal
    total_after_baking: Decimal
    
    moisture_after_baking_wet: Decimal
    moisture_after_baking_dry: Decimal
    aw_after_baking: Optional[Decimal]
    
    target_moisture_wet_basis: Decimal
    target_moisture_dry_basis: Decimal
    
    water_adjustment_needed: Decimal
    adjustment_direction: str
    
    final_expected_weight: Decimal
    final_moisture_wet: Decimal
    final_moisture_dry: Decimal
    final_aw: Optional[Decimal]
    
    safety_checks: Dict[str, Any]
    warnings: List[str]


class ValidationIssue(BaseModel):
    level: str
    category: str
    message: str
    location: Optional[str]
    suggestion: Optional[str]


class ValidationReport(BaseModel):
    valid: bool
    issues: List[ValidationIssue]
    summary: Dict[str, int]


class ExportPackage(BaseModel):
    markdown: str
    csv_content: List[Dict[str, Any]]
    json_content: Dict[str, Any]
