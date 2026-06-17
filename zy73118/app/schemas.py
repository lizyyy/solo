from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CadLayerIn(BaseModel):
    layer_name: str = Field(..., description="图层原始名称")
    entity_count: int = Field(0, ge=0)
    order_index: int = 0


class CollisionPointIn(BaseModel):
    point_code: str = Field(..., description="碰撞点唯一编码")
    layer_a: str
    layer_b: str
    anchor_x: float
    anchor_y: float
    anchor_z: float = 0.0
    view_params: Dict[str, Any] = Field(default_factory=dict, description="视角快照：rotation,zoom,viewport")
    description: str = ""
    severity: str = "warning"


class ManualJudgmentIn(BaseModel):
    judgment_code: str = Field(..., description="改判单号，幂等去重用")
    point_code: str = Field(..., description="关联的碰撞点编码")
    judge: str = Field(..., description="判定人")
    original_result: str = Field(..., description="原始判定")
    final_result: str = Field(..., description="最终判定")
    reason: str = Field(..., description="改判理由")
    evidence: Dict[str, Any] = Field(default_factory=dict)


class SurveyPlanSubmit(BaseModel):
    plan_code: str = Field(..., description="方案编号，幂等键")
    plan_name: str = Field(..., min_length=1, max_length=200)
    building_address: str = Field(..., min_length=1)
    submitter: str = Field(..., min_length=1)
    survey_method: str = Field(..., description="测绘方式")
    total_stations: int = Field(1, ge=1)
    remark: str = ""
    layers: List[CadLayerIn] = Field(default_factory=list)
    collision_points: List[CollisionPointIn] = Field(default_factory=list)
    manual_judgments: List[ManualJudgmentIn] = Field(default_factory=list, description="预留一笔人工改判走异常分支")


class CadLayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    layer_name: str
    normalized_name: str
    layer_type: str
    entity_count: int
    is_valid: bool
    block_reason: str
    order_index: int


class CollisionPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    point_code: str
    layer_a: str
    layer_b: str
    anchor_x: float
    anchor_y: float
    anchor_z: float
    view_params: Dict[str, Any]
    description: str
    severity: str
    is_judged: bool
    coordinate_anchor: str = ""

    @classmethod
    def model_validate(cls, obj, **kwargs):
        inst = super().model_validate(obj, **kwargs)
        inst.coordinate_anchor = f"[WGS84] X={inst.anchor_x:.3f}, Y={inst.anchor_y:.3f}, Z={inst.anchor_z:.3f}"
        return inst


class ManualJudgmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    judgment_code: str
    point_code: Optional[str]
    judge: str
    original_result: str
    final_result: str
    reason: str
    evidence: Dict[str, Any]
    created_at: datetime


class ReviewHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    reviewer: str
    action: str
    before_snapshot: Dict[str, Any]
    after_snapshot: Dict[str, Any]
    diff_summary: str
    comment: str
    created_at: datetime


class IdempotencyNotice(BaseModel):
    is_duplicate: bool
    original_plan_code: str
    submitted_at: datetime
    note: str = "相同请求不重复计数，人工改判也不累加为两份"


class SurveyPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    plan_code: str
    plan_name: str
    building_address: str
    submitter: str
    survey_method: str
    total_stations: int
    status: str
    remark: str
    created_at: datetime
    updated_at: datetime


class PublicSummaryBlockedLayer(BaseModel):
    layer_name: str
    block_reason: str
    suggestion: str


class PublicSummaryAbnormalItem(BaseModel):
    category: str
    point_code: str
    coordinate_anchor: str
    description: str
    judgment_result: str
    judge: str = ""
    reason: str = ""


class PublicSummaryResponse(BaseModel):
    """社区公示用：直接拿去沟通的格式，不是功能清单"""
    report_title: str
    generated_at: datetime
    plan_basic: Dict[str, Any]
    overview: Dict[str, Any]
    abnormal_summary: Dict[str, Any]
    abnormal_details: List[PublicSummaryAbnormalItem]
    blocked_layers: List[PublicSummaryBlockedLayer]
    history_timeline: List[Dict[str, Any]]
    reviewer_note: str


class PlanDetailResponse(BaseModel):
    plan: SurveyPlanOut
    idempotency: Optional[IdempotencyNotice] = None
    layers: List[CadLayerOut]
    collision_points: List[CollisionPointOut]
    manual_judgments: List[ManualJudgmentOut]
    review_histories: List[ReviewHistoryOut]
    stats: Dict[str, Any]
