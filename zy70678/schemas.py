from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import date, datetime
import enum


class MaterialStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEED_REVIEW = "need_review"
    PROCESSED = "processed"


class IssueLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class FamilyMemberBase(BaseModel):
    name: str = Field(..., description="家庭成员姓名")
    relation: str = Field(..., description="与学生关系")
    age: Optional[int] = Field(None, description="年龄")
    id_card: Optional[str] = Field(None, description="身份证号")
    workplace: Optional[str] = Field(None, description="工作单位")
    annual_income: Optional[float] = Field(None, description="年收入")
    health_status: Optional[str] = Field(None, description="健康状况")
    is_source_of_income: Optional[bool] = Field(False, description="是否为收入来源")


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMember(FamilyMemberBase):
    id: int
    student_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudentBase(BaseModel):
    student_id: str = Field(..., description="学号")
    name: str = Field(..., description="姓名")
    gender: Optional[str] = Field(None, description="性别")
    grade: Optional[str] = Field(None, description="年级")
    major: Optional[str] = Field(None, description="专业")
    phone: Optional[str] = Field(None, description="联系电话")
    id_card: Optional[str] = Field(None, description="身份证号")
    address: Optional[str] = Field(None, description="家庭住址")


class StudentCreate(StudentBase):
    family_members: List[FamilyMemberCreate] = Field(default_factory=list, description="家庭成员列表")


class Student(StudentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    family_members: List[FamilyMember]

    class Config:
        from_attributes = True


class MaterialTypeBase(BaseModel):
    code: str = Field(..., description="材料类型编码")
    name: str = Field(..., description="材料类型名称")
    description: Optional[str] = Field(None, description="描述")
    validity_days: Optional[int] = Field(None, description="有效天数")
    is_required: Optional[bool] = Field(True, description="是否必填")
    need_stamp: Optional[bool] = Field(True, description="是否需要盖章")
    sort_order: Optional[int] = Field(0, description="排序")


class MaterialTypeCreate(MaterialTypeBase):
    pass


class MaterialType(MaterialTypeBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudentMaterialBase(BaseModel):
    material_type_id: int = Field(..., description="材料类型ID")
    file_name: Optional[str] = Field(None, description="文件名")
    upload_date: Optional[date] = Field(None, description="上传日期")
    issue_date: Optional[date] = Field(None, description="签发日期")
    expiry_date: Optional[date] = Field(None, description="有效期至")
    has_stamp: Optional[bool] = Field(False, description="是否有章")
    remarks: Optional[str] = Field(None, description="备注")


class StudentMaterialCreate(StudentMaterialBase):
    pass


class StudentMaterial(StudentMaterialBase):
    id: int
    student_id: int
    status: MaterialStatus
    created_at: datetime
    updated_at: Optional[datetime]
    material_type: Optional[MaterialType]

    class Config:
        from_attributes = True


class MaterialIssueBase(BaseModel):
    issue_type: str = Field(..., description="问题类型")
    issue_level: IssueLevel = Field(..., description="问题级别")
    description: str = Field(..., description="问题描述")


class MaterialIssueCreate(MaterialIssueBase):
    material_id: int


class MaterialIssue(MaterialIssueBase):
    id: int
    material_id: int
    is_resolved: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewReportBase(BaseModel):
    reviewer: Optional[str] = Field(None, description="审核人")
    remarks: Optional[str] = Field(None, description="备注")


class ReviewReportCreate(ReviewReportBase):
    student_id: int


class ReviewReport(ReviewReportBase):
    id: int
    student_id: int
    report_code: str
    total_materials: int
    missing_materials: int
    expired_materials: int
    no_stamp_materials: int
    family_consistency_issues: int
    total_issues: int
    critical_issues: int
    status: MaterialStatus
    review_date: Optional[date]
    exported_file_path: Optional[str]
    created_at: datetime
    student: Optional[Student]

    class Config:
        from_attributes = True


class MaterialUploadRequest(BaseModel):
    student_id: str = Field(..., description="学号")
    materials: List[StudentMaterialCreate] = Field(..., description="材料列表")


class BatchImportRequest(BaseModel):
    students: List[StudentCreate] = Field(..., description="学生列表")


class ReviewResult(BaseModel):
    student_id: str
    student_name: str
    total_materials: int
    missing_materials: List[str]
    expired_materials: List[str]
    no_stamp_materials: List[str]
    family_consistency_issues: List[str]
    issue_summary: dict
    status: MaterialStatus


class ErrorResponse(BaseModel):
    error_code: str
    error_type: str
    message: str
    details: Optional[dict] = None


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
