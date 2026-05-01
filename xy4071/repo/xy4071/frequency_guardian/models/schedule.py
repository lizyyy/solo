"""值守排班模型"""

from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator


class DutyShift(BaseModel):
    """值守班次模型"""

    shift_id: str = Field(description="班次唯一标识")
    call_sign: str = Field(description="值守人员呼号")
    operator_name: Optional[str] = Field(default=None, description="操作员姓名")
    channel_id: str = Field(description="值守频道ID")
    device_id: Optional[str] = Field(default=None, description="使用的设备ID")
    date: str = Field(description="值守日期 (YYYY-MM-DD)")
    start_time: str = Field(description="开始时间 (HH:MM)")
    end_time: str = Field(description="结束时间 (HH:MM)")
    role: str = Field(default="operator", description="角色: operator, supervisor, net_control, scribe")
    team: Optional[str] = Field(default=None, description="所属团队")
    location: Optional[str] = Field(default=None, description="值守位置")
    notes: Optional[str] = Field(default=None, description="备注")
    is_backup: bool = Field(default=False, description="是否为备班")
    backup_for: Optional[str] = Field(default=None, description="为主班的班次ID")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        """验证日期格式"""
        if not v:
            raise ValueError("日期不能为空")
        return v.strip()

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        """验证时间格式 HH:MM"""
        try:
            h, m = map(int, v.split(":"))
            if not (0 <= h < 24 and 0 <= m < 60):
                raise ValueError("时间超出有效范围")
            return f"{h:02d}:{m:02d}"
        except Exception as e:
            raise ValueError(f"无效的时间格式: {v}, 应为 HH:MM") from e

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """验证角色"""
        valid_roles = ["operator", "supervisor", "net_control", "scribe", "relief"]
        if v.lower() not in valid_roles:
            raise ValueError(f"不支持的角色: {v}, 有效角色: {valid_roles}")
        return v.lower()

    class Config:
        validate_assignment = True


class DutySchedule(BaseModel):
    """值守排班表模型"""

    shifts: List[DutyShift] = Field(default_factory=list, description="班次列表")
    schedule_name: str = Field(default="未命名值守排班", description="排班名称")
    start_date: Optional[str] = Field(default=None, description="开始日期")
    end_date: Optional[str] = Field(default=None, description="结束日期")
    last_updated: Optional[str] = Field(default=None, description="最后更新时间")
    source_file: Optional[str] = Field(default=None, description="来源文件名")

    def get_shifts_by_date(self, date: str) -> List[DutyShift]:
        """获取指定日期的所有班次"""
        return [s for s in self.shifts if s.date == date]

    def get_shifts_by_call_sign(self, call_sign: str) -> List[DutyShift]:
        """获取指定呼号的所有班次"""
        call_sign = call_sign.upper().strip()
        return [s for s in self.shifts if s.call_sign.upper() == call_sign]

    def get_shifts_by_channel(self, channel_id: str) -> List[DutyShift]:
        """获取指定频道的所有班次"""
        return [s for s in self.shifts if s.channel_id == channel_id]

    def get_dates(self) -> List[str]:
        """获取排班表中所有日期（去重排序）"""
        dates = sorted({s.date for s in self.shifts})
        return dates

    class Config:
        validate_assignment = True
