from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PaintBase(BaseModel):
    name: str = Field(..., max_length=100)
    brand: str = Field(..., max_length=50)
    l_value: float
    a_value: float
    b_value: float
    hex_code: Optional[str] = None
    stock: int = 0
    price: float = 0.0
    purchase_link: Optional[str] = None
    notes: Optional[str] = None


class PaintCreate(PaintBase):
    pass


class PaintUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    l_value: Optional[float] = None
    a_value: Optional[float] = None
    b_value: Optional[float] = None
    stock: Optional[int] = None
    price: Optional[float] = None
    purchase_link: Optional[str] = None
    is_discontinued: Optional[bool] = None
    notes: Optional[str] = None


class PaintResponse(PaintBase):
    id: int
    is_discontinued: bool
    data_quality: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StudentBase(BaseModel):
    name: str = Field(..., max_length=50)
    student_no: str = Field(..., max_length=20)
    budget: float = 0.0
    grade: Optional[str] = None
    notes: Optional[str] = None


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    budget: Optional[float] = None
    remaining_budget: Optional[float] = None
    grade: Optional[str] = None
    notes: Optional[str] = None


class StudentResponse(StudentBase):
    id: int
    remaining_budget: float
    data_quality: str
    created_at: datetime

    class Config:
        from_attributes = True


class SubstituteRequest(BaseModel):
    paint_id: int
    student_id: Optional[int] = None
    max_color_difference: float = 5.0
    min_stock: int = 1


class SubstituteItem(BaseModel):
    paint_id: int
    paint_name: str
    brand: str
    color_difference: float
    stock: int
    price: float
    purchase_link: Optional[str]
    is_best_match: bool = False


class SubstituteResponse(BaseModel):
    original_paint: PaintResponse
    substitutes: List[SubstituteItem]
    warning: Optional[str] = None
    data_issues: List[str] = []


class PurchaseItemRequest(BaseModel):
    paint_id: int
    quantity: int = 1
    use_substitute_if_out_of_stock: bool = True
    max_color_difference: float = 5.0


class PurchaseCreate(BaseModel):
    student_id: int
    items: List[PurchaseItemRequest]
    notes: Optional[str] = None


class PurchaseItemResponse(BaseModel):
    id: int
    paint_id: int
    paint_name: str
    brand: str
    quantity: int
    unit_price: float
    subtotal: float
    is_substitute: bool
    original_paint_id: Optional[int] = None
    color_difference: Optional[float] = None
    substitute_reason: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    status: str
    total_amount: float
    budget_warning: bool
    budget_message: Optional[str] = None
    items: List[PurchaseItemResponse]
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DataIssueResponse(BaseModel):
    id: int
    issue_type: str
    severity: str
    table_name: Optional[str] = None
    record_id: Optional[int] = None
    description: str
    fix_suggestion: Optional[str] = None
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StockDeductRequest(BaseModel):
    paint_id: int
    quantity: int
    student_id: Optional[int] = None
    notes: Optional[str] = None


class StockDeductResponse(BaseModel):
    success: bool
    paint_id: int
    paint_name: str
    deducted_quantity: int
    remaining_stock: int
    message: Optional[str] = None


class ReportGenerateRequest(BaseModel):
    report_type: str = Field(..., description="substitution, purchase, inventory, budget")
    student_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ReportResponse(BaseModel):
    id: int
    report_type: str
    file_path: str
    download_url: str
    created_at: datetime


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None
    fix_suggestion: Optional[str] = None
