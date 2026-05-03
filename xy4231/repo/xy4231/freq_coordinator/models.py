from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class SupplyStation(BaseModel):
    id: str = Field(..., description="补给站唯一标识")
    name: str = Field(..., description="补给站名称")
    latitude: float = Field(..., ge=-90, le=90, description="纬度")
    longitude: float = Field(..., ge=-180, le=180, description="经度")
    distance_from_start: float = Field(..., ge=0, description="距起点距离(km)")
    elevation: float = Field(description="海拔高度(m)")
    criticality: str = Field(default="normal", description="重要程度: critical/high/normal/low")
    required_coverage: bool = Field(default=True, description="是否需要覆盖")
    contact_person: Optional[str] = Field(default=None, description="联系人")
    
    class Config:
        frozen = True


class RepeaterStation(BaseModel):
    id: str = Field(..., description="中继台唯一标识")
    name: str = Field(..., description="中继台名称")
    latitude: float = Field(..., ge=-90, le=90, description="纬度")
    longitude: float = Field(..., ge=-180, le=180, description="经度")
    elevation: float = Field(description="海拔高度(m)")
    tx_frequency: float = Field(..., ge=136, le=174, description="发射频率(MHz) - VHF频段")
    rx_frequency: float = Field(..., ge=136, le=174, description="接收频率(MHz)")
    power: float = Field(default=25.0, ge=1, le=100, description="发射功率(W)")
    antenna_gain: float = Field(default=3.0, ge=0, description="天线增益(dBi)")
    coverage_radius_km: float = Field(default=5.0, ge=0.1, description="覆盖半径(km)")
    height_agl: float = Field(default=10.0, ge=0, description="天线离地高度(m)")
    coverage_polygon: Optional[List[Dict[str, float]]] = Field(default=None, description="覆盖多边形坐标")
    
    class Config:
        frozen = True


class VolunteerShift(BaseModel):
    id: str = Field(..., description="班次唯一标识")
    volunteer_name: str = Field(..., description="志愿者姓名")
    volunteer_id: str = Field(..., description="志愿者ID")
    station_id: str = Field(..., description="值守站点ID")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    role: str = Field(default="operator", description="角色: operator/team_lead/technician")
    skills: List[str] = Field(default_factory=list, description="技能列表")
    phone: Optional[str] = Field(default=None, description="联系电话")
    assigned_device: Optional[str] = Field(default=None, description="已分配设备ID")
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time


class Device(BaseModel):
    id: str = Field(..., description="设备唯一标识")
    type: str = Field(default="handheld", description="设备类型: handheld/mobile/base")
    model: Optional[str] = Field(default=None, description="设备型号")
    status: str = Field(default="available", description="状态: available/in_use/maintenance")
    battery_capacity_mah: int = Field(..., ge=100, description="电池容量(mAh)")
    current_charge_percent: int = Field(default=100, ge=0, le=100, description="当前电量百分比")
    power_consumption_ma: float = Field(default=200.0, ge=10, description="平均功耗(mA)")
    standby_current_ma: float = Field(default=50.0, ge=1, description="待机电流(mA)")
    frequencies: List[float] = Field(default_factory=list, description="支持的频率列表")
    assigned_to: Optional[str] = Field(default=None, description="分配给的班次/人员ID")
    last_charged: Optional[datetime] = Field(default=None, description="最后充电时间")
    
    @property
    def estimated_runtime_hours(self) -> float:
        if self.power_consumption_ma <= 0:
            return float('inf')
        current_mah = self.battery_capacity_mah * (self.current_charge_percent / 100.0)
        return current_mah / self.power_consumption_ma
    
    @property
    def estimated_standby_hours(self) -> float:
        if self.standby_current_ma <= 0:
            return float('inf')
        current_mah = self.battery_capacity_mah * (self.current_charge_percent / 100.0)
        return current_mah / self.standby_current_ma


class AssignedChannel(BaseModel):
    frequency: float = Field(..., description="频率(MHz)")
    channel_number: int = Field(default=1, description="频道号")
    station_id: str = Field(..., description="站点ID")
    shift_id: str = Field(..., description="班次ID")
    is_repeater: bool = Field(default=False, description="是否为中继台频率")
    repeater_id: Optional[str] = Field(default=None, description="关联的中继台ID")
    purpose: str = Field(default="general", description="用途: general/emergency/technical")
    priority: int = Field(default=3, ge=1, le=5, description="优先级 1(最高)-5(最低)")


class ScheduleEntry(BaseModel):
    shift_id: str = Field(..., description="班次ID")
    volunteer_name: str = Field(..., description="志愿者姓名")
    station_id: str = Field(..., description="站点ID")
    station_name: str = Field(..., description="站点名称")
    start_time: datetime = Field(..., description="开始时间")
    end_time: datetime = Field(..., description="结束时间")
    device_id: str = Field(..., description="设备ID")
    assigned_channels: List[AssignedChannel] = Field(default_factory=list, description="分配的频道")


class RiskItem(BaseModel):
    id: str = Field(..., description="风险项ID")
    type: str = Field(..., description="风险类型: frequency_conflict/coverage_gap/handover_gap/battery_risk")
    severity: str = Field(default="medium", description="严重程度: critical/high/medium/low")
    title: str = Field(..., description="风险标题")
    description: str = Field(..., description="详细描述")
    affected_entities: List[str] = Field(default_factory=list, description="受影响的实体ID列表")
    location: Optional[Dict[str, float]] = Field(default=None, description="位置信息")
    time_window: Optional[Dict[str, datetime]] = Field(default=None, description="时间窗口")
    recommendation: Optional[str] = Field(default=None, description="建议措施")
    confidence: float = Field(default=1.0, ge=0, le=1, description="置信度")


class CommunicationPlan(BaseModel):
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")
    event_name: str = Field(default="山地越野赛", description="赛事名称")
    supply_stations: List[SupplyStation] = Field(default_factory=list, description="补给站列表")
    repeater_stations: List[RepeaterStation] = Field(default_factory=list, description="中继台列表")
    volunteer_shifts: List[VolunteerShift] = Field(default_factory=list, description="志愿者班次")
    devices: List[Device] = Field(default_factory=list, description="设备列表")
    schedule: List[ScheduleEntry] = Field(default_factory=list, description="编排表")
    risks: List[RiskItem] = Field(default_factory=list, description="风险列表")
    channel_plan: Dict[str, List[AssignedChannel]] = Field(default_factory=dict, description="按站点分组的频道计划")
    
    def get_risks_by_type(self, risk_type: str) -> List[RiskItem]:
        return [r for r in self.risks if r.type == risk_type]
    
    def get_risks_by_severity(self, severity: str) -> List[RiskItem]:
        return [r for r in self.risks if r.severity == severity]
    
    def get_critical_risks(self) -> List[RiskItem]:
        return [r for r in self.risks if r.severity in ["critical", "high"]]


class ValidationError(BaseModel):
    field: str = Field(..., description="字段名")
    value: Optional[Any] = Field(default=None, description="值")
    message: str = Field(..., description="错误消息")
    row_number: Optional[int] = Field(default=None, description="行号(针对表格文件)")
    severity: str = Field(default="error", description="严重程度: error/warning")


class ValidationResult(BaseModel):
    is_valid: bool = Field(..., description="是否有效")
    file_type: str = Field(..., description="文件类型")
    file_path: str = Field(..., description="文件路径")
    parsed_count: int = Field(default=0, description="解析记录数")
    errors: List[ValidationError] = Field(default_factory=list, description="错误列表")
    warnings: List[ValidationError] = Field(default_factory=list, description="警告列表")
