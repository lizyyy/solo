from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class ComponentBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: Optional[str] = None


class ComponentCreate(ComponentBase):
    pass


class ComponentUpdate(ComponentBase):
    current_version: Optional[str] = None


class Component(ComponentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    current_version: Optional[str] = None

    class Config:
        from_attributes = True


class ComponentSchemaBase(BaseModel):
    version: str
    schema_content: Dict[str, Any]
    created_by: Optional[str] = None


class ComponentSchemaCreate(ComponentSchemaBase):
    component_id: int


class ComponentSchema(ComponentSchemaBase):
    id: int
    component_id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class PropertyPanelBase(BaseModel):
    schema_version: str
    panel_config: Dict[str, Any]


class PropertyPanelCreate(PropertyPanelBase):
    component_id: int


class PropertyPanelUpdate(BaseModel):
    panel_config: Dict[str, Any]


class PropertyPanel(PropertyPanelBase):
    id: int
    component_id: int
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ComponentVersionBase(BaseModel):
    version: str
    release_notes: Optional[str] = None
    status: Optional[str] = "draft"


class ComponentVersionCreate(ComponentVersionBase):
    component_id: int


class ComponentVersion(ComponentVersionBase):
    id: int
    component_id: int
    created_at: datetime
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None

    class Config:
        from_attributes = True


class DependencyCheckBase(BaseModel):
    version: str
    property_panel_version: Optional[int] = None


class DependencyCheckCreate(DependencyCheckBase):
    component_id: int


class DependencyCheckUpdate(BaseModel):
    status: Optional[str] = None
    dependencies: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None


class DependencyCheck(DependencyCheckBase):
    id: int
    component_id: int
    status: str
    dependencies: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    check_id: Optional[str] = None
    retry_count: int

    class Config:
        from_attributes = True


class ExamplePreviewBase(BaseModel):
    version: str
    property_panel_version: Optional[int] = None


class ExamplePreviewCreate(ExamplePreviewBase):
    component_id: int


class ExamplePreviewUpdate(BaseModel):
    status: Optional[str] = None
    preview_data: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None


class ExamplePreview(ExamplePreviewBase):
    id: int
    component_id: int
    status: str
    preview_data: Optional[Dict[str, Any]] = None
    errors: Optional[List[str]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    preview_id: Optional[str] = None
    retry_count: int

    class Config:
        from_attributes = True


class CompatibilityReportBase(BaseModel):
    version: str
    property_panel_version: Optional[int] = None


class CompatibilityReportCreate(CompatibilityReportBase):
    component_id: int


class CompatibilityReportManualUpdate(BaseModel):
    manual_override: bool = True
    override_notes: str
    report_content: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class CompatibilityReport(CompatibilityReportBase):
    id: int
    component_id: int
    dependency_check_id: Optional[int] = None
    example_preview_id: Optional[int] = None
    status: str
    report_content: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    manual_override: bool
    override_by: Optional[str] = None
    override_notes: Optional[str] = None

    class Config:
        from_attributes = True


class ProcessingChainBase(BaseModel):
    version: str
    property_panel_version: Optional[int] = None


class ProcessingChainCreate(ProcessingChainBase):
    component_id: int
    chain_id: str


class ProcessingChainUpdate(BaseModel):
    status: Optional[str] = None
    current_step: Optional[str] = None
    current_step_index: Optional[int] = None
    last_action_hash: Optional[str] = None


class ProcessingChainStep(BaseModel):
    name: str
    status: str = "pending"
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None


class ProcessingChain(ProcessingChainBase):
    id: int
    component_id: int
    chain_id: str
    status: str
    current_step: Optional[str] = None
    steps: Optional[List[ProcessingChainStep]] = None
    current_step_index: int
    created_at: datetime
    updated_at: datetime
    last_action_hash: Optional[str] = None

    class Config:
        from_attributes = True


class ChainTraceResponse(BaseModel):
    chain: ProcessingChain
    component: Component
    schema: Optional[ComponentSchema] = None
    property_panel: Optional[PropertyPanel] = None
    dependency_check: Optional[DependencyCheck] = None
    example_preview: Optional[ExamplePreview] = None
    compatibility_report: Optional[CompatibilityReport] = None


class ExportRequest(BaseModel):
    component_ids: Optional[List[int]] = None
    version: Optional[str] = None
    format: str = "json"
