from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import PackageStatus, ViolationStatus, RuleType, ViolationType


class PackageBase(BaseModel):
    name: str = Field(..., max_length=255)
    path: str = Field(..., max_length=500)
    description: Optional[str] = None
    layer: Optional[str] = Field(None, max_length=100)
    status: PackageStatus = PackageStatus.ACTIVE


class PackageCreate(PackageBase):
    pass


class PackageUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    path: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    layer: Optional[str] = Field(None, max_length=100)
    status: Optional[PackageStatus] = None


class Package(PackageBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SourceFileBase(BaseModel):
    package_id: int
    file_path: str = Field(..., max_length=500)
    language: str = Field("python", max_length=50)
    content_hash: Optional[str] = Field(None, max_length=64)


class SourceFileCreate(SourceFileBase):
    pass


class SourceFile(SourceFileBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportPathBase(BaseModel):
    from_file_id: int
    to_file_id: int
    import_statement: str = Field(..., max_length=500)
    line_number: Optional[int] = None


class ImportPathCreate(ImportPathBase):
    pass


class ImportPath(ImportPathBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BoundaryRuleBase(BaseModel):
    rule_type: RuleType
    from_package_id: Optional[int] = None
    to_package_id: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True


class BoundaryRuleCreate(BoundaryRuleBase):
    pass


class BoundaryRuleUpdate(BaseModel):
    rule_type: Optional[RuleType] = None
    from_package_id: Optional[int] = None
    to_package_id: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class BoundaryRule(BoundaryRuleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ViolationBase(BaseModel):
    violation_type: ViolationType = ViolationType.UNKNOWN
    source_file_id: Optional[int] = None
    import_path_id: Optional[int] = None
    rule_id: Optional[int] = None
    description: Optional[str] = None
    status: ViolationStatus = ViolationStatus.OPEN
    assignee: Optional[str] = Field(None, max_length=255)
    fix_suggestion: Optional[str] = None


class ViolationCreate(ViolationBase):
    pass


class ViolationUpdate(BaseModel):
    violation_type: Optional[ViolationType] = None
    description: Optional[str] = None
    status: Optional[ViolationStatus] = None
    assignee: Optional[str] = Field(None, max_length=255)
    fix_suggestion: Optional[str] = None


class ViolationStatusUpdate(BaseModel):
    to_status: ViolationStatus
    handler: str = Field(..., max_length=255)
    conclusion: Optional[str] = None
    original_input: Optional[str] = None


class Violation(ViolationBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ViolationStatusHistoryBase(BaseModel):
    violation_id: int
    from_status: Optional[ViolationStatus] = None
    to_status: ViolationStatus
    handler: str = Field(..., max_length=255)
    conclusion: Optional[str] = None
    original_input: Optional[str] = None


class ViolationStatusHistoryCreate(ViolationStatusHistoryBase):
    pass


class ViolationStatusHistory(ViolationStatusHistoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DependencyNode(BaseModel):
    package_id: int
    package_name: str
    file_count: int


class DependencyEdge(BaseModel):
    from_package: str
    to_package: str
    import_count: int


class DependencyGraph(BaseModel):
    nodes: List[DependencyNode]
    edges: List[DependencyEdge]


class CircularDependency(BaseModel):
    packages: List[str]
    path: List[str]


class ViolationReportItem(BaseModel):
    id: int
    violation_type: ViolationType
    source_file: str
    import_statement: str
    from_package: str
    to_package: str
    description: str
    status: ViolationStatus
    assignee: Optional[str]
    fix_suggestion: Optional[str]


class ViolationReport(BaseModel):
    total_count: int
    by_type: dict
    by_status: dict
    violations: List[ViolationReportItem]
