from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class AudioTrackBase(BaseModel):
    track_no: str = Field(description="音轨编号")
    title: str = Field(description="标题")
    duration: float = Field(default=0.0, description="时长(秒)")
    file_path: Optional[str] = Field(default=None, description="文件路径")
    file_hash: str = Field(description="文件哈希")
    recorded_at: Optional[datetime] = Field(default=None, description="录制时间")


class AudioTrackCreate(AudioTrackBase):
    pass


class AudioTrackUpdate(BaseModel):
    title: Optional[str] = None
    duration: Optional[float] = None
    file_path: Optional[str] = None
    recorded_at: Optional[datetime] = None


class AudioTrackResponse(AudioTrackBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trace_id: str
    created_at: datetime
    updated_at: datetime


class AdScriptBase(BaseModel):
    script_no: str = Field(description="口播编号")
    track_id: int = Field(description="关联音轨ID")
    track_no: str = Field(description="关联音轨编号")
    content: str = Field(description="口播内容")
    start_time: float = Field(default=0.0, description="开始时间(秒)")
    end_time: float = Field(default=0.0, description="结束时间(秒)")
    batch_no: str = Field(description="批次号")
    version: int = Field(default=1, description="版本")


class AdScriptCreate(AdScriptBase):
    pass


class AdScriptUpdate(BaseModel):
    content: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    batch_no: Optional[str] = None
    version: Optional[int] = None


class AdScriptResponse(AdScriptBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trace_id: str
    created_at: datetime
    updated_at: datetime


class SoundMaterialBase(BaseModel):
    material_no: str = Field(description="素材编号")
    name: str = Field(description="素材名称")
    type: str = Field(description="素材类型")
    duration: float = Field(default=0.0, description="时长(秒)")
    file_path: Optional[str] = Field(default=None, description="文件路径")
    file_hash: str = Field(description="文件哈希")
    tags: Optional[List[str]] = Field(default_factory=list, description="标签")
    description: Optional[str] = Field(default=None, description="描述")
    status: str = Field(default="pending", description="状态")
    confidence: Optional[float] = Field(default=None, description="匹配置信度")


class SoundMaterialCreate(SoundMaterialBase):
    pass


class SoundMaterialUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    duration: Optional[float] = None
    file_path: Optional[str] = None
    tags: Optional[List[str]] = None
    description: Optional[str] = None
    status: Optional[str] = None


class SoundMaterialResponse(SoundMaterialBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trace_id: str
    created_at: datetime
    updated_at: datetime


class MatchRelationBase(BaseModel):
    material_id: int = Field(description="素材ID")
    ad_script_id: int = Field(description="口播ID")
    audio_track_id: int = Field(description="音轨ID")
    match_type: str = Field(default="auto", description="匹配类型")
    confidence: Optional[float] = Field(default=None, description="置信度")
    status: str = Field(default="pending", description="状态")
    remark: Optional[str] = Field(default=None, description="备注")
    created_by: str = Field(default="system", description="创建人")


class MatchRelationCreate(MatchRelationBase):
    pass


class MatchRelationUpdate(BaseModel):
    ad_script_id: Optional[int] = None
    audio_track_id: Optional[int] = None
    match_type: Optional[str] = None
    status: Optional[str] = None
    remark: Optional[str] = None


class MatchRelationResponse(MatchRelationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trace_id: str
    created_at: datetime
    updated_at: datetime
    sound_material: Optional[SoundMaterialResponse] = None
    ad_script: Optional[AdScriptResponse] = None
    audio_track: Optional[AudioTrackResponse] = None


class TraceLink(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    level: int = Field(description="层级")
    type: str = Field(description="类型")
    id: int = Field(description="ID")
    no: str = Field(description="编号")
    name: str = Field(description="名称")
    timestamp: Optional[datetime] = Field(default=None, description="时间")
    operator: Optional[str] = Field(default=None, description="操作人")


class TraceChainResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(description="素材ID")
    links: List[TraceLink] = Field(description="溯源链路")
    export_records: List[Dict[str, Any]] = Field(default_factory=list, description="导出记录")


class AutoMatchRequest(BaseModel):
    match_threshold: float = Field(default=0.6, ge=0, le=1, description="匹配阈值")
    created_by: str = Field(default="system", description="操作人")


class AutoMatchResponse(BaseModel):
    total_processed: int = Field(description="处理总数")
    new_matches: int = Field(description="新增匹配数")
    updated_matches: int = Field(description="更新匹配数")
    skipped: int = Field(description="跳过数")


class BatchOperationRequest(BaseModel):
    ids: List[int] = Field(description="目标ID列表")
    operator: str = Field(default="system", description="操作人")
    remark: Optional[str] = Field(default=None, description="备注")


class BatchOperationResponse(BaseModel):
    total: int = Field(description="总数")
    success: int = Field(description="成功数")
    failed: int = Field(description="失败数")
    failed_ids: List[int] = Field(default_factory=list, description="失败ID列表")


class ImportResult(BaseModel):
    batch_no: str = Field(description="批次号")
    total_count: int = Field(description="总数")
    success_count: int = Field(description="成功数")
    failed_count: int = Field(description="失败数")
    skipped_count: int = Field(description="跳过数")
    error_log: List[str] = Field(default_factory=list, description="错误日志")
