"""电台设备模型"""

from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class RadioDevice(BaseModel):
    """电台设备模型"""

    device_id: str = Field(description="设备唯一标识")
    call_sign: str = Field(description="呼号")
    model: Optional[str] = Field(default=None, description="设备型号")
    serial_number: Optional[str] = Field(default=None, description="序列号")
    max_power_watts: float = Field(default=25.0, description="最大发射功率 (瓦)")
    frequency_bands: List[str] = Field(default_factory=list, description="支持的频段")
    is_repeater: bool = Field(default=False, description="是否为中继台")
    repeater_id: Optional[str] = Field(default=None, description="关联的中继台ID")
    location: Optional[str] = Field(default=None, description="设备位置")
    status: str = Field(default="active", description="设备状态: active, inactive, maintenance")
    notes: Optional[str] = Field(default=None, description="备注")

    @field_validator("call_sign")
    @classmethod
    def validate_call_sign_basic(cls, v: str) -> str:
        """基础呼号验证"""
        if not v or not v.strip():
            raise ValueError("呼号不能为空")
        return v.strip().upper()

    class Config:
        validate_assignment = True


class RadioInventory(BaseModel):
    """电台设备清单模型"""

    devices: List[RadioDevice] = Field(default_factory=list, description="设备列表")
    last_updated: Optional[str] = Field(default=None, description="最后更新时间")
    source_file: Optional[str] = Field(default=None, description="来源文件名")

    def get_device_by_id(self, device_id: str) -> Optional[RadioDevice]:
        """根据设备ID获取设备"""
        for device in self.devices:
            if device.device_id == device_id:
                return device
        return None

    def get_device_by_call_sign(self, call_sign: str) -> Optional[RadioDevice]:
        """根据呼号获取设备"""
        call_sign = call_sign.upper().strip()
        for device in self.devices:
            if device.call_sign == call_sign:
                return device
        return None

    def get_repeaters(self) -> List[RadioDevice]:
        """获取所有中继台"""
        return [d for d in self.devices if d.is_repeater]

    class Config:
        validate_assignment = True
