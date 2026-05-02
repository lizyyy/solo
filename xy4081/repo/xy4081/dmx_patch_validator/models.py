from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ActionType(str, Enum):
    MOVE = "move"
    CHANGE_MODE = "change_mode"
    ADD = "add"
    REMOVE = "remove"


class FixtureMode(BaseModel):
    mode_name: str = Field(..., description="灯具模式名称")
    channel_count: int = Field(..., ge=1, description="通道数量")
    description: Optional[str] = Field(None, description="模式描述")

    class Config:
        frozen = True


class FixtureLibrary(BaseModel):
    manufacturer: str = Field(..., description="制造商")
    model: str = Field(..., description="型号")
    modes: List[FixtureMode] = Field(default_factory=list, description="支持的模式列表")

    @validator('modes')
    def modes_must_not_be_empty(cls, v):
        if not v:
            raise ValueError("必须至少定义一个模式")
        return v

    class Config:
        frozen = True


class Fixture(BaseModel):
    id: str = Field(..., description="灯具唯一标识")
    name: Optional[str] = Field(None, description="灯具名称")
    manufacturer: str = Field(..., description="制造商")
    model: str = Field(..., description="型号")
    mode: str = Field(..., description="使用的模式")
    position: Optional[str] = Field(None, description="位置/吊杆编号")
    universe: int = Field(default=1, ge=1, description="宇宙号")
    start_address: int = Field(default=1, ge=1, le=512, description="起始地址")
    note: Optional[str] = Field(None, description="备注")
    custom_channel_count: Optional[int] = Field(None, ge=1, description="自定义通道数（如果已知）")

    @property
    def end_address(self) -> int:
        if self.custom_channel_count:
            return self.start_address + self.custom_channel_count - 1
        return self.start_address

    def overlaps_with(self, other: 'Fixture') -> bool:
        if self.universe != other.universe:
            return False
        return not (self.end_address < other.start_address or other.end_address < self.start_address)


class PatchEntry(BaseModel):
    id: str = Field(..., description="Patch条目唯一标识")
    universe: int = Field(ge=1, description="宇宙号")
    start_address: int = Field(ge=1, le=512, description="起始地址")
    fixture_id: Optional[str] = Field(None, description="关联的灯具ID")
    fixture_name: Optional[str] = Field(None, description="灯具名称")
    mode: Optional[str] = Field(None, description="灯具模式")
    channel_count: int = Field(ge=1, default=1, description="通道数量")
    position: Optional[str] = Field(None, description="位置/吊杆")
    note: Optional[str] = Field(None, description="备注")

    @property
    def end_address(self) -> int:
        return self.start_address + self.channel_count - 1

    def overlaps_with(self, other: 'PatchEntry') -> bool:
        if self.universe != other.universe:
            return False
        return not (self.end_address < other.start_address or other.end_address < self.start_address)


class ValidationIssue(BaseModel):
    severity: Severity = Field(..., description="严重程度")
    category: str = Field(..., description="问题类别")
    message: str = Field(..., description="问题描述")
    affected_items: List[str] = Field(default_factory=list, description="受影响的项目")
    suggestion: Optional[str] = Field(None, description="解决建议")


class ValidationResult(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    total_issues: int = Field(default=0)
    critical_count: int = Field(default=0)
    warning_count: int = Field(default=0)
    info_count: int = Field(default=0)
    issues: List[ValidationIssue] = Field(default_factory=list)

    def add_issue(self, issue: ValidationIssue):
        self.issues.append(issue)
        self.total_issues += 1
        if issue.severity == Severity.CRITICAL:
            self.critical_count += 1
        elif issue.severity == Severity.WARNING:
            self.warning_count += 1
        else:
            self.info_count += 1


class PlanAction(BaseModel):
    action_type: ActionType = Field(..., description="动作类型")
    target_id: str = Field(..., description="目标灯具/条目标识")
    description: str = Field(..., description="动作描述")
    from_universe: Optional[int] = Field(None, description="原宇宙号")
    from_address: Optional[int] = Field(None, description="原地址")
    to_universe: Optional[int] = Field(None, description="目标宇宙号")
    to_address: Optional[int] = Field(None, description="目标地址")
    old_mode: Optional[str] = Field(None, description="原模式")
    new_mode: Optional[str] = Field(None, description="新模式")
    priority: int = Field(default=1, ge=1, description="执行优先级（1=最高）")


class PlanResult(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    summary: str = Field(..., description="规划摘要")
    actions: List[PlanAction] = Field(default_factory=list)
    estimated_address_usage: Dict[int, int] = Field(default_factory=dict, description="各宇宙地址使用情况")
    warnings: List[str] = Field(default_factory=list)


class HistoryRecord(BaseModel):
    id: str = Field(..., description="记录ID")
    timestamp: datetime = Field(default_factory=datetime.now)
    action: str = Field(..., description="执行的动作")
    description: str = Field(..., description="描述")
    changes: List[Dict[str, Any]] = Field(default_factory=list, description="变更详情")
    user_note: Optional[str] = Field(None, description="用户备注")


class ProjectConfig(BaseModel):
    project_name: str = Field(default="DMX Patch Project", description="项目名称")
    created_at: datetime = Field(default_factory=datetime.now)
    modified_at: datetime = Field(default_factory=datetime.now)
    universe_count: int = Field(default=1, ge=1, description="使用的宇宙数量")
    default_library_path: Optional[str] = Field(None, description="默认灯具库路径")
    custom_settings: Dict[str, Any] = Field(default_factory=dict, description="自定义设置")


class ProjectData(BaseModel):
    config: ProjectConfig = Field(..., description="项目配置")
    fixtures: List[Fixture] = Field(default_factory=list, description="灯具列表")
    patch_entries: List[PatchEntry] = Field(default_factory=list, description="Patch表条目")
    fixture_libraries: List[FixtureLibrary] = Field(default_factory=list, description="灯具库")
    history: List[HistoryRecord] = Field(default_factory=list, description="历史记录")
