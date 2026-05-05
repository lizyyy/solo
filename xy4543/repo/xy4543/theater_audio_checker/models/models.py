from datetime import datetime, time
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class AudioType(str, Enum):
    OPENING_BELL = "opening_bell"
    TOUR_PROMPT = "tour_prompt"
    EVACUATION = "evacuation"
    BACKGROUND = "background"
    ANNOUNCEMENT = "announcement"
    OTHER = "other"


class ZoneStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"


class CheckSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class CheckStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    MANUAL_REVIEW = "manual_review"


class AudioItem(BaseModel):
    audio_id: str = Field(..., description="音频唯一标识")
    name: str = Field(..., description="音频名称")
    audio_type: AudioType = Field(..., description="音频类型")
    file_path: str = Field(..., description="音频文件路径")
    duration_seconds: float = Field(gt=0, description="时长(秒)")
    loudness_dbfs: float = Field(description="响度(dBFS)")
    target_loudness_min: float = Field(default=-24.0, description="目标响度最小值")
    target_loudness_max: float = Field(default=-16.0, description="目标响度最大值")
    description: Optional[str] = Field(default=None, description="描述")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

    @validator('loudness_dbfs')
    def validate_loudness(cls, v: float) -> float:
        if v < -60 or v > 0:
            raise ValueError(f"响度值 {v} dBFS 超出合理范围 (-60 到 0)")
        return v

    @property
    def is_loudness_ok(self) -> bool:
        return self.target_loudness_min <= self.loudness_dbfs <= self.target_loudness_max


class ZoneSchedule(BaseModel):
    schedule_id: str = Field(..., description="计划唯一标识")
    zone_name: str = Field(..., description="分区名称(如: 大剧场、小剧场、前厅、走廊)")
    audio_id: str = Field(..., description="关联的音频ID")
    start_time: time = Field(..., description="开始时间")
    end_time: time = Field(..., description="结束时间")
    date: Optional[str] = Field(default=None, description="日期(YYYY-MM-DD)，None表示每日")
    repeat_days: Optional[List[str]] = Field(default=None, description="重复日期: ['mon', 'tue', ...]")
    is_override: bool = Field(default=False, description="是否覆盖常规计划")
    notes: Optional[str] = Field(default=None, description="备注")

    @validator('end_time')
    def end_time_must_be_after_start(cls, v: time, values: Dict) -> time:
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError("结束时间必须晚于开始时间")
        return v


class DeviceLog(BaseModel):
    device_id: str = Field(..., description="设备唯一标识")
    zone_name: str = Field(..., description="所属分区")
    device_name: str = Field(..., description="设备名称")
    status: ZoneStatus = Field(..., description="设备状态")
    check_time: datetime = Field(..., description="检查时间")
    response_time_ms: Optional[int] = Field(default=None, description="响应时间(毫秒)")
    last_online_time: Optional[datetime] = Field(default=None, description="最后在线时间")
    notes: Optional[str] = Field(default=None, description="异常说明")


class ReviewNote(BaseModel):
    note_id: str = Field(..., description="备注唯一标识")
    item_type: str = Field(..., description="关联项目类型: audio, schedule, device, check")
    item_id: str = Field(..., description="关联项目ID")
    reviewer: str = Field(..., description="复核人")
    review_time: datetime = Field(default_factory=datetime.now, description="复核时间")
    status: CheckStatus = Field(..., description="复核状态")
    comment: str = Field(..., description="复核意见")
    attachments: Optional[List[str]] = Field(default=None, description="附件路径列表")


class CheckIssue(BaseModel):
    issue_id: str = Field(..., description="问题唯一标识")
    check_type: str = Field(..., description="检查类型")
    severity: CheckSeverity = Field(..., description="严重程度")
    message: str = Field(..., description="问题描述")
    affected_item: Optional[str] = Field(default=None, description="受影响项目ID")
    affected_item_name: Optional[str] = Field(default=None, description="受影响项目名称")
    details: Optional[Dict[str, Any]] = Field(default=None, description="详细信息")
    review_note_id: Optional[str] = Field(default=None, description="关联的复核备注ID")


class CheckResult(BaseModel):
    check_id: str = Field(..., description="检查结果唯一标识")
    check_time: datetime = Field(default_factory=datetime.now, description="检查时间")
    target_date: str = Field(..., description="目标检查日期(YYYY-MM-DD)")
    
    total_audio_items: int = Field(0, description="总音频项目数")
    total_schedules: int = Field(0, description="总播放计划数")
    total_devices: int = Field(0, description="总设备数")
    
    pass_count: int = Field(0, description="通过检查数")
    fail_count: int = Field(0, description="未通过检查数")
    warning_count: int = Field(0, description="警告数")
    needs_review_count: int = Field(0, description="需要人工复核数")
    
    issues: List[CheckIssue] = Field(default_factory=list, description="发现的问题列表")
    
    @property
    def total_issues(self) -> int:
        return len(self.issues)
    
    @property
    def is_all_clear(self) -> bool:
        return self.fail_count == 0 and self.needs_review_count == 0


class ExportData(BaseModel):
    version: str = Field(..., description="工具版本")
    export_time: datetime = Field(default_factory=datetime.now, description="导出时间")
    target_date: str = Field(..., description="目标日期")
    
    audio_items: List[AudioItem] = Field(default_factory=list, description="音频清单")
    zone_schedules: List[ZoneSchedule] = Field(default_factory=list, description="分区播放计划")
    device_logs: List[DeviceLog] = Field(default_factory=list, description="设备在线日志")
    review_notes: List[ReviewNote] = Field(default_factory=list, description="人工复核备注")
    
    check_result: Optional[CheckResult] = Field(default=None, description="检查结果")


class InputConfig(BaseModel):
    audio_manifest_path: Optional[str] = Field(default=None, description="音频清单路径")
    zone_schedule_path: Optional[str] = Field(default=None, description="分区播放计划路径")
    device_log_path: Optional[str] = Field(default=None, description="设备在线日志路径")
    review_notes_path: Optional[str] = Field(default=None, description="人工备注路径")
    target_date: Optional[str] = Field(default=None, description="目标检查日期")
    output_dir: str = Field(default="./output", description="输出目录")
