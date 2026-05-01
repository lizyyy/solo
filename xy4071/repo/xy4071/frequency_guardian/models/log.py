"""通联日志模型"""

from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator


class ContactLogEntry(BaseModel):
    """通联日志条目模型"""

    entry_id: str = Field(description="条目唯一标识")
    date: str = Field(description="通联日期 (YYYY-MM-DD)")
    time_start: str = Field(description="开始时间 (HH:MM 或 HH:MM:SS)")
    time_end: Optional[str] = Field(default=None, description="结束时间 (HH:MM 或 HH:MM:SS)")
    call_sign_own: str = Field(description="己方呼号")
    call_sign_other: str = Field(description="对方呼号")
    frequency_mhz: float = Field(description="频率 (MHz)")
    mode: str = Field(default="FM", description="调制模式")
    power_watts: Optional[float] = Field(default=None, description="发射功率 (瓦)")
    signal_report_sent: Optional[str] = Field(default=None, description="发送的信号报告")
    signal_report_received: Optional[str] = Field(default=None, description="收到的信号报告")
    operator_name: Optional[str] = Field(default=None, description="操作员姓名")
    location: Optional[str] = Field(default=None, description="位置")
    repeater_id: Optional[str] = Field(default=None, description="使用的中继台ID")
    repeater_switch: bool = Field(default=False, description="是否涉及中继台切换")
    previous_repeater_id: Optional[str] = Field(default=None, description="切换前的中继台ID")
    notes: Optional[str] = Field(default=None, description="备注/内容摘要")
    source_file: Optional[str] = Field(default=None, description="来源文件名")
    line_number: Optional[int] = Field(default=None, description="在源文件中的行号")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        """验证日期格式"""
        if not v:
            raise ValueError("日期不能为空")
        return v.strip()

    @field_validator("call_sign_own", "call_sign_other")
    @classmethod
    def validate_call_sign(cls, v: str) -> str:
        """基础呼号验证"""
        if not v or not v.strip():
            raise ValueError("呼号不能为空")
        return v.strip().upper()

    @field_validator("frequency_mhz")
    @classmethod
    def validate_frequency(cls, v: float) -> float:
        """验证频率"""
        if v <= 0:
            raise ValueError("频率必须大于0")
        return v

    @field_validator("power_watts")
    @classmethod
    def validate_power(cls, v: Optional[float]) -> Optional[float]:
        """验证功率"""
        if v is not None and v < 0:
            raise ValueError("功率不能为负数")
        return v

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        """验证调制模式"""
        return v.upper().strip()

    class Config:
        validate_assignment = True


class ContactLog(BaseModel):
    """通联日志模型"""

    entries: List[ContactLogEntry] = Field(default_factory=list, description="日志条目列表")
    log_name: str = Field(default="未命名通联日志", description="日志名称")
    call_sign_primary: Optional[str] = Field(default=None, description="主要操作呼号")
    start_date: Optional[str] = Field(default=None, description="日志开始日期")
    end_date: Optional[str] = Field(default=None, description="日志结束日期")
    last_updated: Optional[str] = Field(default=None, description="最后更新时间")
    source_files: List[str] = Field(default_factory=list, description="来源文件名列表")

    def get_entries_by_call_sign(self, call_sign: str, own_only: bool = False, other_only: bool = False) -> List[ContactLogEntry]:
        """根据呼号获取日志条目"""
        call_sign = call_sign.upper().strip()
        results = []
        for entry in self.entries:
            if own_only and entry.call_sign_own == call_sign:
                results.append(entry)
            elif other_only and entry.call_sign_other == call_sign:
                results.append(entry)
            elif not own_only and not other_only:
                if entry.call_sign_own == call_sign or entry.call_sign_other == call_sign:
                    results.append(entry)
        return results

    def get_entries_by_date(self, date: str) -> List[ContactLogEntry]:
        """获取指定日期的日志条目"""
        return [e for e in self.entries if e.date == date]

    def get_entries_by_frequency(self, frequency_mhz: float, tolerance: float = 0.001) -> List[ContactLogEntry]:
        """根据频率获取日志条目（带容差）"""
        return [e for e in self.entries if abs(e.frequency_mhz - frequency_mhz) <= tolerance]

    def get_repeater_switch_entries(self) -> List[ContactLogEntry]:
        """获取所有涉及中继台切换的条目"""
        return [e for e in self.entries if e.repeater_switch]

    class Config:
        validate_assignment = True
