from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import TestTypeEnum, EnvironmentEnum, SLOStatusEnum
from app.schemas.common import SLOEvaluationResult, BottleneckAnalysis, BaselineComparisonResult


class LoadTestBatchBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="批次名称")
    batch_number: int = Field(..., ge=1, description="批次号")
    description: Optional[str] = Field(None, description="描述")
    test_type: TestTypeEnum = Field(default=TestTypeEnum.stress, description="测试类型")
    environment: EnvironmentEnum = Field(default=EnvironmentEnum.staging, description="环境")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    total_requests: int = Field(default=0, ge=0, description="总请求数")
    failed_requests: int = Field(default=0, ge=0, description="失败请求数")
    avg_response_time_ms: Optional[float] = Field(None, ge=0, description="平均响应时间(ms)")
    min_response_time_ms: Optional[float] = Field(None, ge=0, description="最小响应时间(ms)")
    max_response_time_ms: Optional[float] = Field(None, ge=0, description="最大响应时间(ms)")
    p50_response_time_ms: Optional[float] = Field(None, ge=0, description="P50响应时间(ms)")
    p95_response_time_ms: Optional[float] = Field(None, ge=0, description="P95响应时间(ms)")
    p99_response_time_ms: Optional[float] = Field(None, ge=0, description="P99响应时间(ms)")
    qps: Optional[float] = Field(None, ge=0, description="QPS")
    tps: Optional[float] = Field(None, ge=0, description="TPS")
    throughput_bytes_per_sec: Optional[float] = Field(None, ge=0, description="吞吐量(字节/秒)")
    error_rate: Optional[float] = Field(None, ge=0, le=1, description="错误率")
    capacity_utilization_percent: Optional[float] = Field(None, ge=0, le=100, description="容量利用率(%)")
    raw_data_source: Optional[str] = Field(None, max_length=255, description="原始数据源")
    raw_data: Optional[Dict[str, Any]] = Field(None, description="原始数据")
    is_baseline: bool = Field(default=False, description="是否为基线")
    baseline_comparison: Optional[BaselineComparisonResult] = Field(None, description="基线比较结果")
    slo_evaluation: Optional[SLOEvaluationResult] = Field(None, description="SLO评估结果")
    bottleneck_analysis: Optional[List[BottleneckAnalysis]] = Field(None, description="瓶颈分析")
    status: str = Field(default="completed", max_length=50, description="状态")
    notes: Optional[str] = Field(None, description="备注")


class LoadTestBatchCreate(LoadTestBatchBase):
    project_id: int = Field(..., ge=1, description="项目ID")
    traffic_model_id: Optional[int] = Field(None, ge=1, description="流量模型ID")
    
    @validator('failed_requests')
    def failed_requests_less_than_total(cls, v, values):
        if 'total_requests' in values and v > values['total_requests']:
            raise ValueError('失败请求数不能大于总请求数')
        return v
    
    @validator('end_time')
    def end_time_after_start(cls, v, values):
        if v is not None and 'start_time' in values:
            start = values.get('start_time')
            if start is not None and v < start:
                raise ValueError('结束时间不能早于开始时间')
        return v
    
    @validator('p50_response_time_ms', 'p95_response_time_ms', 'p99_response_time_ms')
    def percentile_order(cls, v, field):
        if v is not None and v < 0:
            raise ValueError('百分位响应时间不能为负数')
        return v


class LoadTestBatchRawDataImport(BaseModel):
    project_id: int = Field(..., ge=1)
    batch_number: int = Field(..., ge=1)
    name: str = Field(..., min_length=1)
    test_type: TestTypeEnum = Field(default=TestTypeEnum.stress)
    environment: EnvironmentEnum = Field(default=EnvironmentEnum.staging)
    
    response_times_ms: List[float] = Field(..., min_length=1)
    request_counts: Optional[Dict[str, int]] = None
    error_details: Optional[Dict[str, int]] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    k6_summary: Optional[Dict[str, Any]] = None
    jmeter_summary: Optional[Dict[str, Any]] = None
    
    notes: Optional[str] = None


class LoadTestBatchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    batch_number: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None
    test_type: Optional[TestTypeEnum] = None
    environment: Optional[EnvironmentEnum] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_requests: Optional[int] = Field(None, ge=0)
    failed_requests: Optional[int] = Field(None, ge=0)
    avg_response_time_ms: Optional[float] = Field(None, ge=0)
    min_response_time_ms: Optional[float] = Field(None, ge=0)
    max_response_time_ms: Optional[float] = Field(None, ge=0)
    p50_response_time_ms: Optional[float] = Field(None, ge=0)
    p95_response_time_ms: Optional[float] = Field(None, ge=0)
    p99_response_time_ms: Optional[float] = Field(None, ge=0)
    qps: Optional[float] = Field(None, ge=0)
    tps: Optional[float] = Field(None, ge=0)
    throughput_bytes_per_sec: Optional[float] = Field(None, ge=0)
    error_rate: Optional[float] = Field(None, ge=0, le=1)
    capacity_utilization_percent: Optional[float] = Field(None, ge=0, le=100)
    raw_data_source: Optional[str] = Field(None, max_length=255)
    raw_data: Optional[Dict[str, Any]] = None
    is_baseline: Optional[bool] = None
    baseline_comparison: Optional[BaselineComparisonResult] = None
    slo_evaluation: Optional[SLOEvaluationResult] = None
    bottleneck_analysis: Optional[List[BottleneckAnalysis]] = None
    status: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class LoadTestBatchInDBBase(LoadTestBatchBase):
    id: int
    project_id: int
    traffic_model_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LoadTestBatch(LoadTestBatchInDBBase):
    pass


class LoadTestBatchDetail(LoadTestBatchInDBBase):
    monitoring_snapshot_count: Optional[int] = None
    related_optimization_actions: Optional[List[Dict[str, Any]]] = None


class LoadTestBatchList(BaseModel):
    total: int
    items: List[LoadTestBatch]
    page: int
    page_size: int


class LoadTestMetrics(BaseModel):
    qps: float
    tps: Optional[float]
    avg_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    p50_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    throughput_bytes_per_sec: float
    error_rate: float
    total_requests: int
    failed_requests: int


class BatchComparisonRequest(BaseModel):
    baseline_batch_id: int = Field(..., ge=1, description="基线批次ID")
    current_batch_id: int = Field(..., ge=1, description="当前批次ID")
    metrics_to_compare: Optional[List[str]] = Field(
        default=None,
        description="要比较的指标列表，默认比较所有"
    )


class SLOEvaluationRequest(BaseModel):
    batch_id: int = Field(..., ge=1)
    criteria: "SLOCriteria"
