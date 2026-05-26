from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class MaterialCategory(str, Enum):
    NORMAL = "normal"
    PENDING_SUPPLEMENT = "pending_supplement"
    BLOCKED = "blocked"


class FollowUpType(str, Enum):
    POST_PURCHASE = "post_purchase"
    RETURN_VISIT = "return_visit"
    CONTRAINDICATION_BLOCK = "contraindication_block"


class MaterialStatus(str, Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    MODIFIED = "modified"


class MaterialBase(BaseModel):
    batch_no: str = Field(..., description="材料批次号，用于去重")
    patient_name: str = Field(..., description="患者姓名")
    phone: str = Field(..., description="手机号")
    id_card: Optional[str] = Field(None, description="身份证号")
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[str] = Field(None, pattern="^(男|女|其他)$")
    diagnosis: str = Field(..., description="诊断信息")
    drugs: List[str] = Field(..., description="购药清单")
    follow_up_type: FollowUpType = Field(..., description="随访类型")
    follow_up_date: Optional[datetime] = Field(None, description="随访日期")
    pharmacy_name: str = Field(..., description="药店名称")
    clerk_id: str = Field(..., description="提交店员ID")
    clerk_name: str = Field(..., description="提交店员姓名")
    remark: Optional[str] = Field(None, description="备注")

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 11:
            raise ValueError('手机号必须是11位数字')
        return v


class MaterialSubmitRequest(MaterialBase):
    pass


class CategoryResult(BaseModel):
    category: MaterialCategory
    reason: str
    follow_up_type: FollowUpType
    suggested_action: str
    processed_at: datetime
    processed_by: str


class ModificationLog(BaseModel):
    log_id: str
    material_id: str
    old_category: Optional[MaterialCategory]
    new_category: MaterialCategory
    old_reason: Optional[str]
    new_reason: str
    modified_by: str
    modified_at: datetime
    modification_reason: str
    old_follow_up_type: Optional[FollowUpType]
    new_follow_up_type: FollowUpType


class MaterialRecord(MaterialBase):
    material_id: str
    status: MaterialStatus
    submit_time: datetime
    category_result: Optional[CategoryResult] = None
    modification_history: List[ModificationLog] = Field(default_factory=list)
    field_trail: Dict[str, Any] = Field(default_factory=dict)


class MaterialResponse(BaseModel):
    material_id: str
    batch_no: str
    patient_name: str
    phone_masked: str
    category: Optional[MaterialCategory]
    follow_up_type: FollowUpType
    status: MaterialStatus
    submit_time: datetime
    is_duplicate: bool = False
    category_result: Optional[CategoryResult] = None


class MaterialDetailResponse(MaterialResponse):
    diagnosis: str
    drugs: List[str]
    pharmacy_name: str
    clerk_name: str
    remark: Optional[str]
    modification_history: List[ModificationLog]
    field_trail: Dict[str, Any]


class ModifyCategoryRequest(BaseModel):
    new_category: MaterialCategory
    new_reason: str
    new_follow_up_type: Optional[FollowUpType] = None
    suggested_action: str
    modification_reason: str
    operator_id: str
    operator_name: str


class QueryRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    category: Optional[MaterialCategory] = None
    follow_up_type: Optional[FollowUpType] = None
    pharmacy_name: Optional[str] = None
    clerk_id: Optional[str] = None
    patient_name: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class QueryResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[MaterialResponse]
