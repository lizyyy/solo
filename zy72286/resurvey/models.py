from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ProcessingStatus(str, Enum):
    PENDING = "待处理"
    IMPORTED = "已导入"
    NEEDS_REVIEW = "待客户复核"
    LENGTH_NOT_RECALCULATED = "补录路线未重算"
    SUPPLEMENTED = "已补录"
    RECALCULATED = "已重算"
    VERIFIED = "已核实"
    EXPORTED = "已导出"
    NORMAL = "正常"


class ObstacleRemark(BaseModel):
    record_id: str
    original_line_number: int
    original_content: str
    manual_changes: List[str] = Field(default_factory=list)
    processing_status: ProcessingStatus = ProcessingStatus.PENDING
    route_length: Optional[float] = None
    original_route_length: Optional[float] = None
    building_a: Optional[str] = None
    building_b: Optional[str] = None
    measured_distance: Optional[float] = None
    supplement_note: Optional[str] = None
    is_duplicate: bool = False
    needs_customer_review: bool = False
    review_evidence: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    updated_by: Optional[str] = None

    @field_validator('manual_changes', mode='before')
    @classmethod
    def ensure_list(cls, v):
        if isinstance(v, str):
            return [v]
        return v

    def add_manual_change(self, change: str, operator: str = "许工"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.manual_changes.append(f"[{timestamp}] {operator}: {change}")
        self.updated_at = datetime.now()
        self.updated_by = operator

    def to_evidence_summary(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "原始行号": self.original_line_number,
            "原始内容": self.original_content,
            "人工改动记录": self.manual_changes,
            "当前处理状态": self.processing_status.value,
            "路线长度": self.route_length,
            "原始路线长度": self.original_route_length,
            "是否需要客户复核": self.needs_customer_review,
            "更新时间": self.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新人": self.updated_by,
        }


class FloorProfileSketch(BaseModel):
    sketch_id: str
    record_id: str
    file_path: str
    building: str
    floors: int
    has_supplement_view: bool = False
    view_notes: List[str] = Field(default_factory=list)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)

    def add_view_note(self, note: str, reviewer: str = "许工"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.view_notes.append(f"[{timestamp}] {reviewer}: {note}")
        self.has_supplement_view = True
        self.reviewed_by = reviewer
        self.reviewed_at = datetime.now()

    def to_evidence_summary(self) -> Dict[str, Any]:
        return {
            "sketch_id": self.sketch_id,
            "关联记录ID": self.record_id,
            "文件路径": self.file_path,
            "楼栋": self.building,
            "楼层数": self.floors,
            "是否已补看": self.has_supplement_view,
            "补看记录": self.view_notes,
            "补看人": self.reviewed_by,
            "补看时间": self.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if self.reviewed_at else None,
        }


class MeasurementRecord(BaseModel):
    record_id: str
    community_name: str
    building_a: str
    building_b: str
    measured_distance: float
    route_points: List[Dict[str, float]] = Field(default_factory=list)
    route_length: Optional[float] = None
    is_supplementary: bool = False
    length_recalculated: bool = False
    obstacle_remark: Optional[ObstacleRemark] = None
    floor_sketches: List[FloorProfileSketch] = Field(default_factory=list)
    export_screenshots: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def calculate_route_length(self) -> float:
        if len(self.route_points) < 2:
            return 0.0
        total = 0.0
        for i in range(1, len(self.route_points)):
            p1 = self.route_points[i - 1]
            p2 = self.route_points[i]
            dx = p2.get("x", 0) - p1.get("x", 0)
            dy = p2.get("y", 0) - p1.get("y", 0)
            total += (dx ** 2 + dy ** 2) ** 0.5
        self.route_length = round(total, 2)
        self.length_recalculated = True
        self.updated_at = datetime.now()
        return self.route_length

    def mark_length_not_recalculated(self):
        self.length_recalculated = False
        if self.obstacle_remark:
            self.obstacle_remark.processing_status = ProcessingStatus.LENGTH_NOT_RECALCULATED
            self.obstacle_remark.needs_customer_review = True

    def to_dict(self) -> Dict[str, Any]:
        data = self.model_dump()
        if self.obstacle_remark:
            data["obstacle_remark"] = self.obstacle_remark.to_evidence_summary()
        data["floor_sketches"] = [s.to_evidence_summary() for s in self.floor_sketches]
        return data


class ResurveyProject(BaseModel):
    project_id: str
    project_name: str = "老旧小区楼间距复测"
    records: Dict[str, MeasurementRecord] = Field(default_factory=dict)
    import_history: List[Dict[str, Any]] = Field(default_factory=list)
    self_check_results: List[Dict[str, Any]] = Field(default_factory=list)

    def get_unified_view(self) -> List[Dict[str, Any]]:
        return [record.to_dict() for record in self.records.values()]

    def get_record(self, record_id: str) -> Optional[MeasurementRecord]:
        return self.records.get(record_id)
