from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class MachineCapacityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="机器名称")
    machine_type: str = Field(..., min_length=1, max_length=100, description="机器类型")
    description: Optional[str] = Field(None, description="描述")
    cpu_cores: int = Field(..., ge=1, description="CPU核心数")
    cpu_model: Optional[str] = Field(None, max_length=255, description="CPU型号")
    memory_gb: float = Field(..., ge=0, description="内存(GB)")
    disk_gb: Optional[int] = Field(None, ge=0, description="磁盘(GB)")
    network_bandwidth_gbps: Optional[float] = Field(None, ge=0, description="网络带宽(Gbps)")
    max_qps_estimated: Optional[int] = Field(None, ge=0, description="预估最大QPS")
    max_connections: Optional[int] = Field(None, ge=0, description="最大连接数")
    tags: Optional[List[str]] = Field(None, description="标签")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")
    is_active: Optional[bool] = Field(default=True, description="是否激活")


class MachineCapacityCreate(MachineCapacityBase):
    project_id: int = Field(..., ge=1, description="项目ID")
    
    @validator('cpu_cores')
    def cpu_cores_valid(cls, v):
        if v < 1:
            raise ValueError('CPU核心数必须大于0')
        if v > 1024:
            raise ValueError('CPU核心数不能超过1024')
        return v
    
    @validator('memory_gb')
    def memory_valid(cls, v):
        if v < 0:
            raise ValueError('内存不能为负数')
        if v > 1048576:
            raise ValueError('内存不能超过1PB')
        return v


class MachineCapacityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    machine_type: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    cpu_cores: Optional[int] = Field(None, ge=1)
    cpu_model: Optional[str] = Field(None, max_length=255)
    memory_gb: Optional[float] = Field(None, ge=0)
    disk_gb: Optional[int] = Field(None, ge=0)
    network_bandwidth_gbps: Optional[float] = Field(None, ge=0)
    max_qps_estimated: Optional[int] = Field(None, ge=0)
    max_connections: Optional[int] = Field(None, ge=0)
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class MachineCapacityInDBBase(MachineCapacityBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MachineCapacity(MachineCapacityInDBBase):
    pass


class MachineCapacityList(BaseModel):
    total: int
    items: List[MachineCapacity]
    page: int
    page_size: int


class CapacityUtilizationEstimate(BaseModel):
    machine_id: int
    estimated_qps: float
    cpu_utilization_percent: float
    memory_utilization_percent: float
    network_utilization_percent: float
    is_overloaded: bool
    recommendations: List[str]


class ProjectCapacityReport(BaseModel):
    total_machines: int
    total_cpu_cores: int
    total_memory_gb: float
    estimated_max_qps: float
    current_utilization_percent: Optional[float]
    bottleneck_machines: List[Dict[str, Any]]
    recommendations: List[str]
