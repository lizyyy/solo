from __future__ import annotations
from typing import Dict, List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class Room(BaseModel):
    id: str
    name: str
    volume: float = Field(..., description="房间体积 (m³)")
    area: Optional[float] = Field(None, description="房间面积 (m²)")
    height: Optional[float] = Field(None, description="房间高度 (m)")
    target_pressure: float = Field(..., description="目标压差 (Pa)，相对大气压")
    target_air_change_rate: Optional[float] = Field(None, description="目标换气次数 (次/小时)")
    target_airflow: Optional[float] = Field(None, description="目标送风量 (m³/h)")
    cleanliness_class: Optional[str] = Field(None, description="洁净度等级")
    room_type: str = Field(default="general", description="房间类型")
    
    @property
    def required_airflow(self) -> float:
        if self.target_airflow:
            return self.target_airflow
        if self.target_air_change_rate and self.volume:
            return self.volume * self.target_air_change_rate
        return 0.0


class Valve(BaseModel):
    id: str
    room_id: str
    valve_type: str = Field(..., description="valve_type: supply or return")
    current_opening: float = Field(..., description="当前开度 (0-100%)")
    rated_flow: float = Field(..., description="额定风量 (m³/h)")
    kv_value: Optional[float] = Field(None, description="流量系数")
    pressure_drop: Optional[float] = Field(None, description="阀前后压降 (Pa)")
    actual_flow: Optional[float] = Field(None, description="实际风量 (m³/h)")


class FanCurvePoint(BaseModel):
    flow_rate: float = Field(..., description="风量 (m³/h)")
    static_pressure: float = Field(..., description="静压 (Pa)")
    efficiency: Optional[float] = Field(None, description="效率 (%)")
    power: Optional[float] = Field(None, description="功率 (kW)")


class FanCurve(BaseModel):
    id: str
    name: str
    supply_rooms: List[str] = Field(default_factory=list)
    return_rooms: List[str] = Field(default_factory=list)
    curve_points: List[FanCurvePoint] = Field(default_factory=list)
    current_frequency: Optional[float] = Field(50.0, description="当前频率 (Hz)")
    max_frequency: float = Field(60.0, description="最大频率 (Hz)")
    min_frequency: float = Field(30.0, description="最小频率 (Hz)")
    design_static_pressure: Optional[float] = Field(None, description="设计静压 (Pa)")


class AccessLog(BaseModel):
    id: str
    room_id: str
    timestamp: datetime
    door_id: str
    door_type: str = Field(default="general", description="门类型")
    duration: float = Field(..., description="开门持续时间 (秒)")
    adjacent_room: Optional[str] = Field(None, description="相邻房间ID")
    pressure_difference_during_open: Optional[float] = Field(None, description="开门时压差 (Pa)")


class ParticleCount(BaseModel):
    id: str
    room_id: str
    timestamp: datetime
    particle_size: float = Field(..., description="粒子粒径 (μm)")
    concentration: float = Field(..., description="粒子浓度 (个/m³)")
    limit_value: Optional[float] = Field(None, description="限值 (个/m³)")
    is_pass: Optional[bool] = Field(None)


class Adjacency(BaseModel):
    room_a: str
    room_b: str
    pressure_direction: str = Field(..., description="压差方向: a_to_b 或 b_to_a")
    required_differential: float = Field(..., description="要求压差 (Pa)")
    door_area: Optional[float] = Field(None, description="门面积 (m²)")
    leakage_coefficient: Optional[float] = Field(0.1, description="泄漏系数")


class RoomTopology(BaseModel):
    rooms: Dict[str, Room] = Field(default_factory=dict)
    adjacencies: List[Adjacency] = Field(default_factory=list)
    supply_valves: Dict[str, Valve] = Field(default_factory=dict)
    return_valves: Dict[str, Valve] = Field(default_factory=dict)
    fan_curves: Dict[str, FanCurve] = Field(default_factory=dict)
    access_logs: List[AccessLog] = Field(default_factory=list)
    particle_counts: List[ParticleCount] = Field(default_factory=list)
    
    def get_adjacent_rooms(self, room_id: str) -> List[str]:
        adjacent = []
        for adj in self.adjacencies:
            if adj.room_a == room_id:
                adjacent.append(adj.room_b)
            elif adj.room_b == room_id:
                adjacent.append(adj.room_a)
        return adjacent
    
    def get_required_differential(self, room_a: str, room_b: str) -> Optional[float]:
        for adj in self.adjacencies:
            if (adj.room_a == room_a and adj.room_b == room_b):
                return adj.required_differential if adj.pressure_direction == 'a_to_b' else -adj.required_differential
            if (adj.room_a == room_b and adj.room_b == room_a):
                return adj.required_differential if adj.pressure_direction == 'b_to_a' else -adj.required_differential
        return None


class PressureCalculationResult(BaseModel):
    room_id: str
    calculated_pressure: float = Field(..., description="计算压差 (Pa)")
    target_pressure: float
    pressure_deviation: float
    supply_airflow: Optional[float] = Field(None, description="送风量 (m³/h)")
    return_airflow: Optional[float] = Field(None, description="回风量 (m³/h)")
    exhaust_airflow: Optional[float] = Field(None, description="排风量 (m³/h)")
    air_change_rate: Optional[float] = Field(None, description="换气次数 (次/小时)")
    target_air_change_rate: Optional[float] = None
    air_change_deviation: Optional[float] = None
    leakage_flow: Optional[float] = Field(None, description="泄漏风量 (m³/h)")
    is_pressure_ok: bool = False
    is_air_change_ok: bool = False
    issues: List[str] = Field(default_factory=list)
    supply_valve_adjustment: Optional[float] = Field(None, description="送风阀调节建议 (%)")
    return_valve_adjustment: Optional[float] = Field(None, description="回风阀调节建议 (%)")
    fan_adjustment: Optional[Dict[str, float]] = Field(None, description="风机调节建议")


class OptimizationResult(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    room_results: Dict[str, PressureCalculationResult] = Field(default_factory=dict)
    total_issues: int = 0
    pressure_issues: List[str] = Field(default_factory=list)
    air_change_issues: List[str] = Field(default_factory=list)
    door_disturbance_issues: List[str] = Field(default_factory=list)
    particle_issues: List[str] = Field(default_factory=list)
    valve_adjustments: Dict[str, float] = Field(default_factory=dict)
    fan_adjustments: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    manual_corrections: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    remarks: List[str] = Field(default_factory=list)


class ProjectData(BaseModel):
    project_name: str = "未命名项目"
    project_id: str = "PRJ001"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    topology: RoomTopology = Field(default_factory=RoomTopology)
    optimization_results: Optional[OptimizationResult] = None
    version: str = "1.0"
