from typing import Optional, Dict, Any, List
from pydantic import Field

from .base import BaseSchema, TimestampMixin


class OverhangDetail(BaseSchema):
    area: float
    angle: float
    height: float
    location: str


class MeshQualityIssue(BaseSchema):
    issue_type: str
    count: int
    severity: str
    description: str
    suggestion: str


class MeshAnalysisRequest(BaseSchema):
    task_id: int = Field(..., description="任务ID")
    model_file_id: Optional[int] = Field(None, description="模型文件ID，不指定则使用最新上传的")
    params_version: Optional[int] = Field(None, description="参数版本，不指定则使用最新版本")
    min_support_angle: Optional[float] = Field(45.0, ge=0, le=90, description="最小支撑角度")


class MeshAnalysisResponse(TimestampMixin):
    id: int
    task_id: int
    model_file_id: int
    params_version: int

    is_watertight: Optional[bool]
    is_manifold: Optional[bool]
    broken_face_count: int
    non_manifold_edges: int
    self_intersections: int
    duplicate_faces: int
    inverted_normals: int

    overhang_area: Optional[float]
    overhang_count: int
    min_support_angle: Optional[float]
    max_support_height: Optional[float]

    support_volume: Optional[float]
    support_contact_area: Optional[float]
    support_material_volume: Optional[float]

    total_volume: Optional[float]
    part_volume: Optional[float]
    bounding_box_volume: Optional[float]

    quality_score: Optional[float]
    processing_time_ms: Optional[int]

    quality_issues: List[MeshQualityIssue]
    overhang_details: List[OverhangDetail]
    analysis_details: Dict[str, Any]
    notes: Optional[str]


class ModelFileUploadResponse(TimestampMixin):
    id: int
    task_id: int
    file_name: str
    file_type: str
    file_size: Optional[int]
    vertex_count: Optional[int]
    face_count: Optional[int]
    bounding_box_x: Optional[float]
    bounding_box_y: Optional[float]
    bounding_box_z: Optional[float]
    volume: Optional[float]
    surface_area: Optional[float]
    md5_hash: Optional[str]
    is_processed: bool
    processing_notes: Optional[str]
