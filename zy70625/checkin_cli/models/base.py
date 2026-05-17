from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ValidationStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"
    PENDING = "PENDING"


class IssueSeverity(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class RuleType(str, Enum):
    MATERIAL_CHECK = "材料校验"
    GROUP_RESTRICTION = "组别限制"
    SUBSTITUTE_ELIGIBILITY = "替补资格"
    DUPLICATE_CHECKIN = "重复检录"


class SourceLocation(BaseModel):
    file_path: str
    sheet_name: Optional[str] = None
    row_number: int
    original_data: Dict[str, Any]

    def __hash__(self):
        return hash((self.file_path, self.sheet_name, self.row_number))


class Player(BaseModel):
    player_id: str
    name: str
    id_card: Optional[str] = None
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    group_id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    source: Optional[SourceLocation] = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v):
        if v and v not in ["男", "女", "M", "F"]:
            raise ValueError(f"无效的性别: {v}")
        return v

    def __hash__(self):
        return hash(self.player_id)

    def __eq__(self, other):
        if isinstance(other, Player):
            return self.player_id == other.player_id
        return False


class Group(BaseModel):
    group_id: str
    group_name: str
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    allowed_gender: Optional[str] = None
    max_players: Optional[int] = None
    require_materials: List[str] = Field(default_factory=list)
    source: Optional[SourceLocation] = None

    def __hash__(self):
        return hash(self.group_id)


class Material(BaseModel):
    player_id: str
    material_type: str
    material_status: str
    upload_date: Optional[date] = None
    expiry_date: Optional[date] = None
    source: Optional[SourceLocation] = None

    @field_validator("material_status")
    @classmethod
    def validate_status(cls, v):
        if v not in ["已上传", "已验证", "未上传", "已过期"]:
            raise ValueError(f"无效的材料状态: {v}")
        return v


class Substitute(BaseModel):
    player_id: str
    target_group_id: str
    priority: int
    substitute_reason: Optional[str] = None
    source: Optional[SourceLocation] = None

    def __hash__(self):
        return hash((self.player_id, self.target_group_id))


class CheckinEvent(BaseModel):
    checkin_id: str
    player_id: str
    checkin_time: datetime
    checkin_station: Optional[str] = None
    source: Optional[SourceLocation] = None


class ValidationIssue(BaseModel):
    rule_type: RuleType
    severity: IssueSeverity
    message: str
    source: Optional[SourceLocation] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class PlayerQualification(BaseModel):
    player: Player
    overall_status: ValidationStatus
    issues: List[ValidationIssue] = Field(default_factory=list)
    is_substitute: bool = False
    substitute_priority: Optional[int] = None
    is_qualified: bool = True
    checkin_count: int = 0


class ValidationResult(BaseModel):
    status: ValidationStatus
    message: str
    issues: List[ValidationIssue] = Field(default_factory=list)


class QualificationReport(BaseModel):
    report_id: str
    generated_at: datetime
    total_players: int
    qualified_count: int
    disqualified_count: int
    warning_count: int
    pending_count: int
    player_qualifications: List[PlayerQualification]
    all_issues: List[ValidationIssue]
    parse_errors: List[Dict[str, Any]] = Field(default_factory=list)

    def model_post_init(self, __context):
        self.player_qualifications.sort(key=lambda x: x.player.player_id)
        self.all_issues.sort(key=lambda x: (x.severity, x.rule_type))
