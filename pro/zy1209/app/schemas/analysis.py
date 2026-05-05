from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ConnectionPoolConfig(BaseModel):
    max_connections: Optional[int] = Field(100, description="最大连接数")
    current_connections: Optional[int] = Field(None, description="当前连接数")
    wait_timeout: Optional[int] = Field(28800, description="等待超时时间(秒)")
    connection_usage_threshold: Optional[float] = Field(0.8, description="连接使用率阈值")


class BatchWriteConfig(BaseModel):
    batch_size: Optional[int] = Field(1000, description="批量写入大小")
    total_records: Optional[int] = Field(None, description="总记录数")
    single_insert_time: Optional[float] = Field(None, description="单条插入时间(ms)")
    batch_insert_time: Optional[float] = Field(None, description="批量插入时间(ms)")


class IndexAnalysisConfig(BaseModel):
    analyze_missing_indexes: Optional[bool] = Field(True, description="分析缺失索引")
    analyze_redundant_indexes: Optional[bool] = Field(True, description="分析冗余索引")
    analyze_unused_indexes: Optional[bool] = Field(True, description="分析未使用索引")
    usage_threshold: Optional[float] = Field(0.01, description="使用率阈值")


class SlowSQLConfig(BaseModel):
    slow_query_threshold: Optional[float] = Field(1.0, description="慢查询阈值(秒)")
    analyze_execution_plan: Optional[bool] = Field(True, description="分析执行计划")
    top_n_queries: Optional[int] = Field(20, description="分析前N条慢查询")


class ReadWriteSplitConfig(BaseModel):
    read_ratio: Optional[float] = Field(0.8, description="读操作比例")
    master_write_ratio: Optional[float] = Field(0.95, description="主库写比例")
    analyze_read_route_efficiency: Optional[bool] = Field(True, description="分析读路由效率")


class ShardingHotspotConfig(BaseModel):
    shard_count: Optional[int] = Field(4, description="分片数量")
    hotspot_threshold: Optional[float] = Field(0.3, description="热点阈值")
    analyze_data_distribution: Optional[bool] = Field(True, description="分析数据分布")
    analyze_query_distribution: Optional[bool] = Field(True, description="分析查询分布")


class AnalysisConfig(BaseModel):
    connection_pool: Optional[ConnectionPoolConfig] = Field(None, description="连接池分析配置")
    batch_write: Optional[BatchWriteConfig] = Field(None, description="批量写入分析配置")
    index_analysis: Optional[IndexAnalysisConfig] = Field(None, description="索引分析配置")
    slow_sql: Optional[SlowSQLConfig] = Field(None, description="慢SQL分析配置")
    read_write_split: Optional[ReadWriteSplitConfig] = Field(None, description="读写分离分析配置")
    sharding_hotspot: Optional[ShardingHotspotConfig] = Field(None, description="分库分表热点分析配置")
    
    enabled_analyses: Optional[List[str]] = Field(
        None,
        description="启用的分析类型列表，为空则启用全部"
    )
