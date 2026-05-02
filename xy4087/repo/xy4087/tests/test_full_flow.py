"""
全流程测试用例
测试从创建数据集、导入CSV、执行差分隐私查询到导出报告的完整流程
"""
import pytest
import os
import tempfile
import shutil
import json
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# 导入应用模块
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app
from app.config import settings

# 测试配置
TEST_DATABASE_URL = "sqlite:///:memory:"
TEST_UPLOAD_DIR = tempfile.mkdtemp()

# 覆盖配置
settings.DATABASE_URL = TEST_DATABASE_URL
settings.UPLOAD_DIR = TEST_UPLOAD_DIR


@pytest.fixture(scope="function")
def test_db():
    """创建测试数据库会话"""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # 创建表
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # 删除表
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """创建测试客户端"""
    
    def override_get_db():
        try:
            yield test_db
        finally:
            test_db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sample_csv_file():
    """创建临时CSV测试文件"""
    csv_content = """id,age_group,city,channel,conversion
1,18-24,北京,微信小程序,1
2,18-24,北京,微信小程序,1
3,18-24,北京,抖音,0
4,18-24,上海,微信小程序,1
5,18-24,上海,抖音,1
6,25-34,北京,微信小程序,1
7,25-34,北京,微信小程序,0
8,25-34,北京,抖音,1
9,25-34,上海,微信小程序,1
10,25-34,上海,抖音,0
"""
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(csv_content)
        temp_path = f.name
    
    yield temp_path
    
    # 清理
    if os.path.exists(temp_path):
        os.unlink(temp_path)


class TestDatasetManagement:
    """数据集管理测试"""
    
    def test_create_dataset(self, client):
        """测试创建数据集"""
        response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "活动报名数据",
                "description": "2024年春季活动报名数据",
                "fields": [
                    {"name": "id", "field_type": "sensitive", "description": "用户ID"},
                    {"name": "age_group", "field_type": "dimension", "description": "年龄段"},
                    {"name": "city", "field_type": "dimension", "description": "城市"},
                    {"name": "channel", "field_type": "dimension", "description": "渠道"},
                    {"name": "conversion", "field_type": "metric", "description": "是否转化"}
                ],
                "total_epsilon": 5.0,
                "delta": 1e-5,
                "suppression_threshold": 5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "活动报名数据"
        assert len(data["fields"]) == 5
        return data["id"]
    
    def test_list_datasets(self, client):
        """测试获取数据集列表"""
        # 先创建一个数据集
        self.test_create_dataset(client)
        
        response = client.get("/api/v1/datasets/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    def test_get_dataset(self, client):
        """测试获取单个数据集"""
        # 先创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "测试数据集",
                "description": "测试",
                "fields": [
                    {"name": "age_group", "field_type": "dimension"}
                ],
                "total_epsilon": 1.0
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 获取数据集
        response = client.get(f"/api/v1/datasets/{dataset_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "测试数据集"


class TestCSVImport:
    """CSV导入测试"""
    
    def test_import_csv(self, client, sample_csv_file):
        """测试导入CSV文件"""
        # 先创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "导入测试数据集",
                "description": "用于测试CSV导入",
                "fields": [
                    {"name": "id", "field_type": "sensitive"},
                    {"name": "age_group", "field_type": "dimension"},
                    {"name": "city", "field_type": "dimension"},
                    {"name": "channel", "field_type": "dimension"},
                    {"name": "conversion", "field_type": "metric"}
                ],
                "total_epsilon": 5.0
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 导入CSV
        with open(sample_csv_file, 'rb') as f:
            response = client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("test.csv", f, "text/csv")}
            )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["row_count"] == 10
        assert data["column_count"] == 5
        
        return dataset_id


class TestPrivacyQuery:
    """差分隐私查询测试"""
    
    def test_basic_count_query(self, client, sample_csv_file):
        """测试基础计数查询"""
        # 创建数据集并导入数据
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "查询测试数据集",
                "description": "用于测试差分隐私查询",
                "fields": [
                    {"name": "id", "field_type": "sensitive"},
                    {"name": "age_group", "field_type": "dimension"},
                    {"name": "city", "field_type": "dimension"},
                    {"name": "channel", "field_type": "dimension"},
                    {"name": "conversion", "field_type": "metric"}
                ],
                "total_epsilon": 5.0,
                "suppression_threshold": 3  # 降低阈值以便测试
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 导入CSV
        with open(sample_csv_file, 'rb') as f:
            client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("test.csv", f, "text/csv")}
            )
        
        # 执行查询：按年龄段分组统计人数
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json={
                "group_by": ["age_group"],
                "aggregations": [
                    {"type": "count", "name": "total_users"}
                ],
                "epsilon": 0.5,
                "use_cache": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["dataset_id"] == dataset_id
        assert data["epsilon_used"] == 0.5
        assert data["from_cache"] == False
        assert len(data["results"]) > 0
        
        # 验证结果结构
        for result in data["results"]:
            assert "group" in result
            assert "aggregations" in result
            assert "suppressed" in result
    
    def test_sum_and_avg_query(self, client, sample_csv_file):
        """测试求和和平均值查询"""
        # 创建数据集并导入数据
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "聚合查询测试",
                "description": "测试求和和平均值查询",
                "fields": [
                    {"name": "id", "field_type": "sensitive"},
                    {"name": "age_group", "field_type": "dimension"},
                    {"name": "city", "field_type": "dimension"},
                    {"name": "channel", "field_type": "dimension"},
                    {"name": "conversion", "field_type": "metric"}
                ],
                "total_epsilon": 5.0,
                "suppression_threshold": 3
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 导入CSV
        with open(sample_csv_file, 'rb') as f:
            client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("test.csv", f, "text/csv")}
            )
        
        # 执行查询：按城市分组统计转化数和转化率
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json={
                "group_by": ["city"],
                "aggregations": [
                    {"type": "count", "name": "total_users"},
                    {"type": "sum", "metric": "conversion", "name": "conversion_count"},
                    {"type": "avg", "metric": "conversion", "name": "conversion_rate"}
                ],
                "epsilon": 1.0,
                "use_cache": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["epsilon_used"] == 1.0
        
        # 验证所有聚合都被计算
        for result in data["results"]:
            aggs = result["aggregations"]
            assert "total_users" in aggs
            assert "conversion_count" in aggs
            assert "conversion_rate" in aggs
    
    def test_query_with_filters(self, client, sample_csv_file):
        """测试带筛选条件的查询"""
        # 创建数据集并导入数据
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "筛选查询测试",
                "description": "测试带筛选条件的查询",
                "fields": [
                    {"name": "id", "field_type": "sensitive"},
                    {"name": "age_group", "field_type": "dimension"},
                    {"name": "city", "field_type": "dimension"},
                    {"name": "channel", "field_type": "dimension"},
                    {"name": "conversion", "field_type": "metric"}
                ],
                "total_epsilon": 5.0,
                "suppression_threshold": 3
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 导入CSV
        with open(sample_csv_file, 'rb') as f:
            client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("test.csv", f, "text/csv")}
            )
        
        # 执行查询：只查询北京的数据
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json={
                "group_by": ["channel"],
                "aggregations": [
                    {"type": "count", "name": "total_users"}
                ],
                "filters": {
                    "city": {"eq": "北京"}
                },
                "epsilon": 0.3,
                "use_cache": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["epsilon_used"] == 0.3
    
    def test_insufficient_budget(self, client, sample_csv_file):
        """测试预算不足的情况"""
        # 创建数据集（预算很小）
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "预算不足测试",
                "description": "测试预算不足的情况",
                "fields": [
                    {"name": "id", "field_type": "sensitive"},
                    {"name": "age_group", "field_type": "dimension"}
                ],
                "total_epsilon": 0.1  # 很小的预算
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 导入CSV
        with open(sample_csv_file, 'rb') as f:
            client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("test.csv", f, "text/csv")}
            )
        
        # 请求超过预算的查询
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json={
                "group_by": ["age_group"],
                "aggregations": [{"type": "count"}],
                "epsilon": 0.5,  # 超过预算
                "use_cache": False
            }
        )
        
        assert response.status_code == 403  # Forbidden
    
    def test_cache_hit(self, client, sample_csv_file):
        """测试缓存命中"""
        # 创建数据集并导入数据
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "缓存测试数据集",
                "description": "测试缓存功能",
                "fields": [
                    {"name": "id", "field_type": "sensitive"},
                    {"name": "age_group", "field_type": "dimension"}
                ],
                "total_epsilon": 5.0,
                "suppression_threshold": 3
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 导入CSV
        with open(sample_csv_file, 'rb') as f:
            client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("test.csv", f, "text/csv")}
            )
        
        query_params = {
            "group_by": ["age_group"],
            "aggregations": [{"type": "count", "name": "total"}],
            "epsilon": 0.3,
            "use_cache": True
        }
        
        # 第一次查询
        response1 = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json=query_params
        )
        assert response1.status_code == 200
        assert response1.json()["from_cache"] == False
        assert response1.json()["epsilon_used"] == 0.3
        
        # 第二次查询（应该命中缓存）
        response2 = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json=query_params
        )
        assert response2.status_code == 200
        assert response2.json()["from_cache"] == True
        assert response2.json()["epsilon_used"] == 0  # 缓存命中不消耗预算


class TestBudgetManagement:
    """预算管理测试"""
    
    def test_get_budget_summary(self, client):
        """测试获取预算摘要"""
        # 创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "预算测试数据集",
                "description": "测试预算管理",
                "fields": [
                    {"name": "id", "field_type": "sensitive"}
                ],
                "total_epsilon": 10.0
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 获取预算摘要
        response = client.get(f"/api/v1/datasets/{dataset_id}/budget/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["total_epsilon"] == 10.0
        assert data["remaining_epsilon"] == 10.0
        assert data["usage_percentage"] == 0.0
    
    def test_reset_budget(self, client):
        """测试重置预算"""
        # 创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "重置预算测试",
                "description": "测试预算重置功能",
                "fields": [
                    {"name": "id", "field_type": "sensitive"}
                ],
                "total_epsilon": 5.0
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 重置预算（设置新的总预算）
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/budget/reset?new_total_epsilon=15.0"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_epsilon"] == 15.0
        assert data["remaining_epsilon"] == 15.0


class TestReportGeneration:
    """报告生成测试"""
    
    def test_generate_markdown_report(self, client):
        """测试生成Markdown报告"""
        # 创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "报告测试数据集",
                "description": "测试报告生成",
                "fields": [
                    {"name": "id", "field_type": "sensitive"}
                ],
                "total_epsilon": 5.0
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 生成报告
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/reports/generate",
            json={
                "format": "markdown",
                "include_transactions": True,
                "include_audit_logs": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "markdown"
        assert "## 1. 预算摘要" in data["content"]  # 验证报告结构
    
    def test_generate_csv_report(self, client):
        """测试生成CSV报告"""
        # 创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "CSV报告测试",
                "description": "测试CSV报告生成",
                "fields": [
                    {"name": "id", "field_type": "sensitive"}
                ],
                "total_epsilon": 5.0
            }
        )
        dataset_id = create_response.json()["id"]
        
        # 生成报告
        response = client.post(
            f"/api/v1/datasets/{dataset_id}/reports/generate",
            json={
                "format": "csv",
                "include_transactions": True,
                "include_audit_logs": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "csv"


class TestFullFlow:
    """完整流程测试"""
    
    def test_complete_flow(self, client, sample_csv_file):
        """测试完整流程：创建数据集 -> 导入数据 -> 查询 -> 导出报告"""
        
        # 1. 创建数据集
        create_response = client.post(
            "/api/v1/datasets/",
            json={
                "name": "完整流程测试数据集",
                "description": "测试从创建到报告的完整流程",
                "fields": [
                    {"name": "id", "field_type": "sensitive", "description": "用户ID"},
                    {"name": "age_group", "field_type": "dimension", "description": "年龄段"},
                    {"name": "city", "field_type": "dimension", "description": "城市"},
                    {"name": "channel", "field_type": "dimension", "description": "渠道"},
                    {"name": "conversion", "field_type": "metric", "description": "转化标识"}
                ],
                "total_epsilon": 10.0,
                "delta": 1e-5,
                "suppression_threshold": 3
            }
        )
        assert create_response.status_code == 200
        dataset_id = create_response.json()["id"]
        
        # 2. 导入CSV数据
        with open(sample_csv_file, 'rb') as f:
            import_response = client.post(
                f"/api/v1/datasets/{dataset_id}/import",
                files={"file": ("data.csv", f, "text/csv")}
            )
        assert import_response.status_code == 200
        assert import_response.json()["row_count"] == 10
        
        # 3. 检查预算（应该还是100%）
        budget_response = client.get(f"/api/v1/datasets/{dataset_id}/budget/summary")
        assert budget_response.status_code == 200
        assert budget_response.json()["usage_percentage"] == 0.0
        
        # 4. 执行多次差分隐私查询
        
        # 查询1：按年龄段统计人数和转化数
        query1_response = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json={
                "group_by": ["age_group"],
                "aggregations": [
                    {"type": "count", "name": "total_users"},
                    {"type": "sum", "metric": "conversion", "name": "conversion_count"}
                ],
                "epsilon": 1.0,
                "use_cache": True
            }
        )
        assert query1_response.status_code == 200
        
        # 查询2：按城市和渠道统计转化率
        query2_response = client.post(
            f"/api/v1/datasets/{dataset_id}/queries/",
            json={
                "group_by": ["city", "channel"],
                "aggregations": [
                    {"type": "count", "name": "total"},
                    {"type": "avg", "metric": "conversion", "name": "conversion_rate"}
                ],
                "filters": {
                    "age_group": {"eq": "25-34"}
                },
                "epsilon": 1.5,
                "use_cache": True
            }
        )
        assert query2_response.status_code == 200
        
        # 5. 检查预算使用情况
        budget_response2 = client.get(f"/api/v1/datasets/{dataset_id}/budget/summary")
        assert budget_response2.status_code == 200
        budget_data = budget_response2.json()
        assert budget_data["usage_percentage"] > 0  # 应该有消耗
        assert budget_data["remaining_epsilon"] < 10.0
        
        # 6. 检查审计日志
        audit_response = client.get(f"/api/v1/datasets/{dataset_id}/audit/logs")
        assert audit_response.status_code == 200
        audit_logs = audit_response.json()
        assert len(audit_logs) >= 2  # 至少有2次查询
        
        # 7. 导出审计报告
        report_response = client.post(
            f"/api/v1/datasets/{dataset_id}/reports/generate",
            json={
                "format": "markdown",
                "include_transactions": True,
                "include_audit_logs": True
            }
        )
        assert report_response.status_code == 200
        report_content = report_response.json()["content"]
        
        # 验证报告包含关键信息
        assert "预算摘要" in report_content
        assert "查询审计统计" in report_content
        
        # 8. 验证审计统计
        stats_response = client.get(f"/api/v1/datasets/{dataset_id}/audit/statistics")
        assert stats_response.status_code == 200
        stats_data = stats_response.json()
        assert stats_data["total_queries"] >= 2
        assert stats_data["success_count"] >= 2
        
        print("\n" + "="*60)
        print("完整流程测试完成！")
        print(f"数据集ID: {dataset_id}")
        print(f"总预算: {budget_data['total_epsilon']} ε")
        print(f"剩余预算: {budget_data['remaining_epsilon']:.4f} ε")
        print(f"使用率: {budget_data['usage_percentage']:.2f}%")
        print(f"查询次数: {stats_data['total_queries']}")
        print(f"总消耗预算: {stats_data['total_epsilon_consumed']:.4f} ε")
        print("="*60)


# 清理测试上传目录
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_dir():
    """清理测试上传目录"""
    yield
    if os.path.exists(TEST_UPLOAD_DIR):
        shutil.rmtree(TEST_UPLOAD_DIR)
