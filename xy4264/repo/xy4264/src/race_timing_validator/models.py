"""计时系统数据模型"""

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class CheckpointType(str, Enum):
    START = "START"
    CP = "CP"
    FINISH = "FINISH"


class Gender(str, Enum):
    MALE = "M"
    FEMALE = "F"


class WaveType(str, Enum):
    ELITE = "精英"
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class Checkpoint(BaseModel):
    checkpoint_id: str = Field(..., description="检查点唯一标识")
    name: str = Field(..., description="检查点名称")
    cp_type: CheckpointType = Field(..., description="检查点类型")
    distance_from_start: float = Field(..., ge=0, description="距起点距离(km)")
    order: int = Field(..., ge=1, description="检查点顺序")

    class Config:
        frozen = True


class Wave(BaseModel):
    wave_id: str = Field(..., description="波次ID")
    wave_name: WaveType = Field(..., description="波次名称")
    start_time: datetime = Field(..., description="起跑时间")
    max_participants: Optional[int] = Field(None, gt=0, description="最大人数")

    class Config:
        frozen = True

    @field_validator("start_time", mode="before")
    @classmethod
    def parse_start_time(cls, v):
        if isinstance(v, str):
            try:
                return datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    return datetime.strptime(v, "%H:%M:%S")
                except ValueError:
                    raise ValueError(f"无法解析时间: {v}")
        return v


class Participant(BaseModel):
    bib_number: str = Field(..., description="号码布号码")
    name: str = Field(..., description="姓名")
    gender: Optional[Gender] = Field(None, description="性别")
    age: Optional[int] = Field(None, ge=1, description="年龄")
    category: Optional[str] = Field(None, description="参赛组别")
    phone: Optional[str] = Field(None, description="联系电话")
    emergency_contact: Optional[str] = Field(None, description="紧急联系人")
    wave_id: Optional[str] = Field(None, description="分配的波次ID")

    class Config:
        frozen = True


class ChipBinding(BaseModel):
    chip_id: str = Field(..., description="RFID芯片ID")
    bib_number: str = Field(..., description="绑定的号码布")
    bind_time: Optional[datetime] = Field(None, description="绑定时间")
    device_id: Optional[str] = Field(None, description="绑定设备ID")

    class Config:
        frozen = True

    @field_validator("bind_time", mode="before")
    @classmethod
    def parse_bind_time(cls, v):
        if isinstance(v, str) and v:
            try:
                return datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                return None
        return v


class CheckpointLog(BaseModel):
    log_id: str = Field(..., description="日志记录ID")
    chip_id: str = Field(..., description="芯片ID")
    checkpoint_id: str = Field(..., description="检查点ID")
    read_time: datetime = Field(..., description="读取时间")
    device_id: Optional[str] = Field(None, description="读取设备ID")
    signal_strength: Optional[float] = Field(None, description="信号强度")
    antenna_port: Optional[int] = Field(None, description="天线端口")

    class Config:
        frozen = True

    @field_validator("read_time", mode="before")
    @classmethod
    def parse_read_time(cls, v):
        if isinstance(v, str):
            try:
                return datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    return datetime.strptime(v, "%H:%M:%S")
                except ValueError:
                    raise ValueError(f"无法解析时间: {v}")
        return v


class DNFRecord(BaseModel):
    bib_number: str = Field(..., description="号码布")
    dnf_time: Optional[datetime] = Field(None, description="退赛时间")
    last_checkpoint: Optional[str] = Field(None, description="最后通过的检查点")
    reason: Optional[str] = Field(None, description="退赛原因")
    reported_by: Optional[str] = Field(None, description="上报人")

    class Config:
        frozen = True

    @field_validator("dnf_time", mode="before")
    @classmethod
    def parse_dnf_time(cls, v):
        if isinstance(v, str) and v:
            try:
                return datetime.strptime(v, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                return None
        return v


class SplitRecord(BaseModel):
    participant: Participant
    chip_id: str
    checkpoint: Checkpoint
    wave: Wave
    log_time: datetime
    split_time: Optional[timedelta] = Field(None, description="从起点到该点的时间")
    segment_time: Optional[timedelta] = Field(None, description="从上一检查点的时间")

    class Config:
        frozen = True


class ViolationType(str, Enum):
    DUPLICATE_CHIP = "重复芯片绑定"
    WAVE_CONFLICT = "波次分配冲突"
    MISSING_SPLIT = "缺失计时点"
    ABNORMAL_SPEED = "异常速度"
    DNF_FINISH = "退赛后仍完赛"
    EARLY_START = "抢跑"
    WRONG_WAVE = "波次发错"
    UNREGISTERED_CHIP = "未注册芯片"


class ViolationLevel(str, Enum):
    CRITICAL = "严重"
    WARNING = "警告"
    INFO = "信息"


class Violation(BaseModel):
    violation_id: str = Field(..., description="违规记录ID")
    violation_type: ViolationType = Field(..., description="违规类型")
    level: ViolationLevel = Field(..., description="严重程度")
    bib_number: Optional[str] = Field(None, description="涉及的号码布")
    chip_id: Optional[str] = Field(None, description="涉及的芯片ID")
    wave_id: Optional[str] = Field(None, description="涉及的波次")
    checkpoint_id: Optional[str] = Field(None, description="涉及的检查点")
    message: str = Field(..., description="详细描述")
    evidence: Optional[Dict[str, Any]] = Field(default_factory=dict, description="证据数据")
    discovered_at: datetime = Field(default_factory=datetime.now, description="发现时间")
    reviewed: bool = Field(default=False, description="是否已复核")
    resolution: Optional[str] = Field(None, description="复核结论")
    resolved_by: Optional[str] = Field(None, description="复核人")
    resolved_at: Optional[datetime] = Field(None, description="复核时间")


class RaceData(BaseModel):
    race_name: str = Field(default="未命名赛事", description="赛事名称")
    race_date: Optional[datetime] = Field(None, description="比赛日期")
    
    participants: Dict[str, Participant] = Field(default_factory=dict, description="选手表")
    chip_bindings: Dict[str, ChipBinding] = Field(default_factory=dict, description="芯片绑定")
    bib_to_chip: Dict[str, List[str]] = Field(default_factory=dict, description="号码布到芯片映射")
    waves: Dict[str, Wave] = Field(default_factory=dict, description="波次表")
    checkpoints: Dict[str, Checkpoint] = Field(default_factory=dict, description="检查点表")
    checkpoint_logs: List[CheckpointLog] = Field(default_factory=list, description="设备日志")
    dnf_records: Dict[str, DNFRecord] = Field(default_factory=dict, description="退赛记录")
    
    violations: List[Violation] = Field(default_factory=list, description="违规记录")
    reviewed_violations: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="已复核记录")

    def get_participant_by_bib(self, bib_number: str) -> Optional[Participant]:
        return self.participants.get(bib_number)

    def get_chip_by_bib(self, bib_number: str) -> List[str]:
        return self.bib_to_chip.get(bib_number, [])

    def get_chip_binding(self, chip_id: str) -> Optional[ChipBinding]:
        return self.chip_bindings.get(chip_id)

    def get_wave(self, wave_id: str) -> Optional[Wave]:
        return self.waves.get(wave_id)

    def get_checkpoint(self, checkpoint_id: str) -> Optional[Checkpoint]:
        return self.checkpoints.get(checkpoint_id)

    def get_dnf_record(self, bib_number: str) -> Optional[DNFRecord]:
        return self.dnf_records.get(bib_number)

    def is_dnf(self, bib_number: str) -> bool:
        return bib_number in self.dnf_records

    def get_sorted_checkpoints(self) -> List[Checkpoint]:
        return sorted(self.checkpoints.values(), key=lambda c: c.order)

    def add_violation(self, violation: Violation) -> None:
        self.violations.append(violation)

    def get_violations_by_type(self, violation_type: ViolationType) -> List[Violation]:
        return [v for v in self.violations if v.violation_type == violation_type]

    def get_violations_by_level(self, level: ViolationLevel) -> List[Violation]:
        return [v for v in self.violations if v.level == level]

    def get_unreviewed_violations(self) -> List[Violation]:
        return [v for v in self.violations if not v.reviewed]
