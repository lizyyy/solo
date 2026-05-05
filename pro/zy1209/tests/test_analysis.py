import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session
import json

from app.analyzers import (
    ConnectionPoolAnalyzer, BatchWriteAnalyzer,
    IndexAnalysisAnalyzer, SlowSQLAnalyzer,
    ReadWriteSplitAnalyzer, ShardingHotspotAnalyzer
)
from app.models.enums import AnalysisType, SeverityLevel


class TestAnalyzers:
    
    def test_connection_pool_analyzer_high_usage(self):
        analyzer = ConnectionPoolAnalyzer(config={})
        
        inputs = {
            "db_profile": {
                "max_connections": 100,
                "current_connections": 95,
                "active_connections": 90
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert result.analysis_type == AnalysisType.CONNECTION_POOL
        assert any("连接池使用率过高" in f.title for f in result.findings)
        assert result.metrics["usage_ratio"] == 0.95
    
    def test_connection_pool_analyzer_normal(self):
        analyzer = ConnectionPoolAnalyzer(config={})
        
        inputs = {
            "db_profile": {
                "max_connections": 200,
                "current_connections": 50,
                "active_connections": 30
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert result.metrics["usage_ratio"] == 0.25
    
    def test_batch_write_analyzer_high_improvement(self):
        analyzer = BatchWriteAnalyzer(config={})
        
        inputs = {
            "batch_write_sample": {
                "batch_size": 1000,
                "total_records": 100000,
                "single_insert_time_ms": 5.0,
                "batch_insert_time_ms": 100.0
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert result.analysis_type == AnalysisType.BATCH_WRITE
        assert result.metrics["improvement_ratio"] > 0.5
    
    def test_batch_write_analyzer_low_improvement(self):
        analyzer = BatchWriteAnalyzer(config={})
        
        inputs = {
            "batch_write_sample": {
                "batch_size": 10,
                "total_records": 1000,
                "single_insert_time_ms": 5.0,
                "batch_insert_time_ms": 50.0
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert any("批量写入收益不明显" in f.title or "批量写入大小偏小" in f.title for f in result.findings)
    
    def test_slow_sql_analyzer_with_queries(self):
        analyzer = SlowSQLAnalyzer(config={})
        
        slow_log = """# Time: 2024-01-15T10:05:00
# Query_time: 12.3456  Lock_time: 0.0012  Rows_sent: 1  Rows_examined: 100000
SELECT * FROM orders WHERE status = 1;

# Time: 2024-01-15T10:06:00
# Query_time: 35.1234  Lock_time: 0.0020  Rows_sent: 1000  Rows_examined: 500000
SELECT * FROM large_table;
"""
        
        inputs = {"slow_sql_log": slow_log}
        
        result = analyzer.analyze(inputs)
        
        assert result.analysis_type == AnalysisType.SLOW_SQL
        assert result.metrics["total_slow_queries"] == 2
        assert result.metrics["max_query_time"] == 35.123
        assert any("极端慢查询" in f.title for f in result.findings)
    
    def test_read_write_split_analyzer_low_slave_util(self):
        analyzer = ReadWriteSplitAnalyzer(config={})
        
        inputs = {
            "db_profile": {
                "read_ratio": 0.8,
                "master_write_ratio": 0.95,
                "slave_read_count": 1000,
                "master_read_count": 9000,
                "misrouted_reads": 500,
                "replication_lag_ms": 3000,
                "slave_availability": 0.9
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert result.analysis_type == AnalysisType.READ_WRITE_SPLIT
        assert result.metrics["slave_utilization"] == 0.1
        assert any("从库利用率偏低" in f.title for f in result.findings)
        assert any("主从延迟过高" in f.title for f in result.findings)
    
    def test_sharding_hotspot_analyzer_balanced(self):
        analyzer = ShardingHotspotAnalyzer(config={})
        
        inputs = {
            "db_profile": {
                "shard_count": 4,
                "data_distribution": {
                    "shard_1": 10000,
                    "shard_2": 10500,
                    "shard_3": 9800,
                    "shard_4": 10200
                },
                "query_distribution": {
                    "shard_1": 5000,
                    "shard_2": 5100,
                    "shard_3": 4900,
                    "shard_4": 5050
                }
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert result.analysis_type == AnalysisType.SHARDING_HOTSPOT
        assert any("分片分布良好" in f.title for f in result.findings)
    
    def test_sharding_hotspot_analyzer_hotspot(self):
        analyzer = ShardingHotspotAnalyzer(config={})
        
        inputs = {
            "db_profile": {
                "shard_count": 4,
                "data_distribution": {
                    "shard_1": 50000,
                    "shard_2": 10000,
                    "shard_3": 10000,
                    "shard_4": 10000
                },
                "query_distribution": {
                    "shard_1": 40000,
                    "shard_2": 3000,
                    "shard_3": 3500,
                    "shard_4": 3000
                }
            }
        }
        
        result = analyzer.analyze(inputs)
        
        assert any("数据热点" in f.title or "查询热点" in f.title for f in result.findings)


class TestAnalysisAPI:
    
    @pytest.mark.asyncio
    async def test_get_analysis_types(self, async_client: AsyncClient, test_db: Session):
        response = await async_client.get("/api/v1/analysis/types")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) == 6
    
    @pytest.mark.asyncio
    async def test_run_analysis(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "分析测试任务",
                "description": "测试执行分析",
                "config": {
                    "enabled_analyses": ["connection_pool", "batch_write"]
                }
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 100,
                    "current_connections": 90
                })
            }
        )
        
        response = await async_client.post(f"/api/v1/analysis/{task_id}/run")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] == "completed"
    
    @pytest.mark.asyncio
    async def test_get_results(self, async_client: AsyncClient, test_db: Session):
        create_response = await async_client.post(
            "/api/v1/tasks",
            json={
                "name": "结果测试任务",
                "description": "测试获取分析结果"
            }
        )
        task_id = create_response.json()["data"]["id"]
        
        await async_client.post(
            f"/api/v1/tasks/{task_id}/snapshots",
            json={
                "snapshot_type": "db_profile",
                "content": json.dumps({
                    "max_connections": 200,
                    "current_connections": 100
                })
            }
        )
        
        await async_client.post(f"/api/v1/analysis/{task_id}/run")
        
        response = await async_client.get(f"/api/v1/analysis/{task_id}/results")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) > 0
