import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app
from database import Base, get_db
from models import TaskStatus, OperationSource

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


class TestReportExportFlow:
    """测试完整的报表导出任务流转"""

    def test_complete_task_flow(self):
        """规则1: 完整任务流转 - 排队中 → 生成中 → 已交付，列表/详情/历史互相对应"""

        task_data = {
            "tenant_id": "TENANT_001",
            "report_type": "销售日报",
            "filter_conditions": {"start_date": "2024-01-01", "end_date": "2024-01-31", "region": "华东"},
            "created_by": "张三@tenant001.com",
            "operation_source": "用户操作"
        }

        create_response = client.post("/api/v1/tasks", json=task_data)
        assert create_response.status_code == 201, "创建任务失败"
        task_no = create_response.json()["task_no"]
        assert create_response.json()["status"] == TaskStatus.QUEUED.value, "初始状态应为排队中"

        list_response = client.get("/api/v1/tasks", params={"tenant_id": "TENANT_001"})
        assert list_response.status_code == 200, "获取任务列表失败"
        assert len(list_response.json()) >= 1, "任务列表应包含新建任务"

        detail_response = client.get(f"/api/v1/tasks/{task_no}")
        assert detail_response.status_code == 200, "获取任务详情失败"
        assert detail_response.json()["task_no"] == task_no, "详情task_no不匹配"
        assert len(detail_response.json()["history"]) == 1, "应有1条历史记录"

        update_response1 = client.put(f"/api/v1/tasks/{task_no}/status", json={
            "status": TaskStatus.GENERATING.value,
            "operator": "system_worker_01",
            "operation_source": OperationSource.SYSTEM.value,
            "change_reason": "开始生成报表文件"
        })
        assert update_response1.status_code == 200, "更新为生成中失败"
        assert update_response1.json()["status"] == TaskStatus.GENERATING.value

        update_response2 = client.put(f"/api/v1/tasks/{task_no}/status", json={
            "status": TaskStatus.DELIVERED.value,
            "operator": "system_worker_01",
            "operation_source": OperationSource.SYSTEM.value,
            "change_reason": "报表生成完成，已上传至文件服务器",
            "file_size": 15 * 1024 * 1024,
            "file_url": "https://example.com/reports/report_001.xlsx"
        })
        assert update_response2.status_code == 200, "更新为已交付失败"
        assert update_response2.json()["status"] == TaskStatus.DELIVERED.value
        assert update_response2.json()["file_size"] == 15 * 1024 * 1024, "文件大小不匹配"

        history_response = client.get(f"/api/v1/tasks/{task_no}/history")
        assert history_response.status_code == 200, "获取历史记录失败"
        history_records = history_response.json()
        assert len(history_records) == 3, "应有3条历史记录（排队/生成中/已交付）"
        assert history_records[0]["status"] == TaskStatus.QUEUED.value
        assert history_records[1]["status"] == TaskStatus.GENERATING.value
        assert history_records[2]["status"] == TaskStatus.DELIVERED.value
        assert history_records[2]["file_size"] == 15 * 1024 * 1024, "历史记录文件大小不匹配"

        final_detail = client.get(f"/api/v1/tasks/{task_no}").json()
        assert final_detail["status"] == TaskStatus.DELIVERED.value
        assert len(final_detail["history"]) == 3, "详情中的历史记录数量不匹配"
        print("✓ 规则1通过: 完整流转验证成功")


class TestConflictDetection:
    """测试冲突检测 - 用户重复点击导致多个相同任务排队"""

    def test_duplicate_task_detection(self):
        """规则2: 冲突检测 - 相同租户+报表类型+筛选条件的任务应被检测为冲突"""

        task_data = {
            "tenant_id": "TENANT_002",
            "report_type": "库存月报",
            "filter_conditions": {"warehouse": "WH_001", "category": "电子产品"},
            "created_by": "李四@tenant002.com",
            "operation_source": "用户操作"
        }

        first_response = client.post("/api/v1/tasks", json=task_data)
        assert first_response.status_code == 201, "第一个任务创建失败"
        first_task_no = first_response.json()["task_no"]

        conflict_check = client.post("/api/v1/tasks/check-conflict", json=task_data)
        assert conflict_check.status_code == 200, "冲突检测请求失败"
        assert conflict_check.json()["has_conflict"] is True, "应检测到冲突"
        assert len(conflict_check.json()["existing_tasks"]) == 1, "应有1个冲突任务"
        assert conflict_check.json()["existing_tasks"][0]["task_no"] == first_task_no, "冲突任务不匹配"

        second_response = client.post("/api/v1/tasks", json=task_data)
        assert second_response.status_code == 201, "第二个任务创建失败"
        second_task_no = second_response.json()["task_no"]

        conflict_check2 = client.post("/api/v1/tasks/check-conflict", json=task_data)
        assert conflict_check2.json()["has_conflict"] is True, "应检测到冲突"
        assert len(conflict_check2.json()["existing_tasks"]) == 2, "应有2个冲突任务"

        task1_detail = client.get(f"/api/v1/tasks/{first_task_no}").json()
        task2_detail = client.get(f"/api/v1/tasks/{second_task_no}").json()
        assert task1_detail["filter_conditions"] == task2_detail["filter_conditions"], "筛选条件应相同"
        assert task1_detail["tenant_id"] == task2_detail["tenant_id"], "租户应相同"
        assert task1_detail["report_type"] == task2_detail["report_type"], "报表类型应相同"
        assert task1_detail["status"] == TaskStatus.QUEUED.value
        assert task2_detail["status"] == TaskStatus.QUEUED.value

        task_list = client.get("/api/v1/tasks", params={"tenant_id": "TENANT_002"}).json()
        assert len(task_list) == 2, "列表应显示2个排队任务"

        update_to_failed = client.put(f"/api/v1/tasks/{first_task_no}/status", json={
            "status": TaskStatus.FAILED.value,
            "operator": "system_worker_01",
            "operation_source": OperationSource.SYSTEM.value,
            "change_reason": "磁盘空间不足，生成失败",
            "error_message": "OSError: No space left on device"
        })
        assert update_to_failed.status_code == 200

        conflict_check3 = client.post("/api/v1/tasks/check-conflict", json=task_data)
        assert len(conflict_check3.json()["existing_tasks"]) == 1, "第一个任务已失败，应只剩第二个冲突"

        retry_response = client.post(f"/api/v1/tasks/{first_task_no}/retry", json={
            "operator": "王五（管理员）",
            "operation_source": OperationSource.ADMIN.value,
            "change_reason": "磁盘空间已清理，手动重试"
        })
        assert retry_response.status_code == 200, "重试失败"
        assert retry_response.json()["status"] == TaskStatus.RETRYING.value
        assert retry_response.json()["retry_count"] == 1, "重试次数应为1"

        history = client.get(f"/api/v1/tasks/{first_task_no}/history").json()
        history_statuses = [h["status"] for h in history]
        assert TaskStatus.QUEUED.value in history_statuses
        assert TaskStatus.FAILED.value in history_statuses
        assert TaskStatus.RETRYING.value in history_statuses
        print("✓ 规则2通过: 冲突检测和重试验证成功")


class TestBadRowImport:
    """测试坏行导入记录"""

    def test_bad_row_recording(self):
        """规则3: 坏行导入 - 导入错误行应被记录在历史记录中"""

        task_data = {
            "tenant_id": "TENANT_003",
            "report_type": "订单明细",
            "filter_conditions": {"date_range": "2024-Q1"},
            "created_by": "赵六@tenant003.com",
            "operation_source": "用户操作"
        }

        create_response = client.post("/api/v1/tasks", json=task_data)
        assert create_response.status_code == 201
        task_no = create_response.json()["task_no"]

        update_response = client.put(f"/api/v1/tasks/{task_no}/status", json={
            "status": TaskStatus.GENERATING.value,
            "operator": "import_worker_01",
            "operation_source": OperationSource.SYSTEM.value,
            "change_reason": "开始导入数据"
        })
        assert update_response.status_code == 200

        bad_row1 = {
            "task_no": task_no,
            "row_data": {
                "order_id": "ORD_99999",
                "customer_id": None,
                "amount": "invalid_number",
                "raw_line": "ORD_99999,,invalid_number,2024-01-15"
            },
            "error_message": "customer_id不能为空，amount格式错误",
            "operator": "import_worker_01"
        }

        bad_row_response1 = client.post("/api/v1/tasks/bad-row", json=bad_row1)
        assert bad_row_response1.status_code == 201, "记录坏行1失败"

        bad_row2 = {
            "task_no": task_no,
            "row_data": {
                "order_id": "ORD_88888",
                "customer_id": "CUST_001",
                "amount": "-999.99",
                "raw_line": "ORD_88888,CUST_001,-999.99,2024-01-16"
            },
            "error_message": "金额不能为负数",
            "operator": "import_worker_01"
        }

        bad_row_response2 = client.post("/api/v1/tasks/bad-row", json=bad_row2)
        assert bad_row_response2.status_code == 201, "记录坏行2失败"

        history = client.get(f"/api/v1/tasks/{task_no}/history").json()
        bad_row_records = [h for h in history if "坏行导入失败" in (h["change_reason"] or "")]
        assert len(bad_row_records) == 2, "应有2条坏行记录"

        assert "customer_id不能为空" in bad_row_records[0]["change_reason"], "第一条坏行错误信息不匹配"
        assert "ORD_99999" in bad_row_records[0]["change_reason"], "应包含订单号"
        assert "金额不能为负数" in bad_row_records[1]["change_reason"], "第二条坏行错误信息不匹配"
        assert bad_row_records[0]["operation_source"] == OperationSource.SYSTEM.value
        assert bad_row_records[0]["operator"] == "import_worker_01"

        detail = client.get(f"/api/v1/tasks/{task_no}").json()
        detail_bad_rows = [h for h in detail["history"] if "坏行导入失败" in (h["change_reason"] or "")]
        assert len(detail_bad_rows) == 2, "详情中应包含坏行历史"

        update_to_delivered = client.put(f"/api/v1/tasks/{task_no}/status", json={
            "status": TaskStatus.DELIVERED.value,
            "operator": "import_worker_01",
            "operation_source": OperationSource.SYSTEM.value,
            "change_reason": "报表生成完成（跳过2条错误行）",
            "file_size": 8 * 1024 * 1024
        })
        assert update_to_delivered.status_code == 200

        final_history = client.get(f"/api/v1/tasks/{task_no}/history").json()
        assert len(final_history) >= 4, "最终历史记录应包含排队、生成中、2条坏行、已交付"
        print("✓ 规则3通过: 坏行导入记录验证成功")


class TestMaxRetryLimit:
    """测试最大重试次数限制"""

    def test_max_retry_limit(self):
        """规则4: 达到最大重试次数后不应允许再重试"""

        task_data = {
            "tenant_id": "TENANT_004",
            "report_type": "财务报表",
            "filter_conditions": {"period": "2024-01"},
            "created_by": "钱七@tenant004.com",
            "operation_source": "用户操作"
        }

        create_response = client.post("/api/v1/tasks", json=task_data)
        task_no = create_response.json()["task_no"]

        for i in range(3):
            client.put(f"/api/v1/tasks/{task_no}/status", json={
                "status": TaskStatus.FAILED.value,
                "operator": "system",
                "operation_source": OperationSource.SYSTEM.value,
                "change_reason": f"第{i+1}次失败"
            })

            retry_response = client.post(f"/api/v1/tasks/{task_no}/retry", json={
                "operator": "admin",
                "operation_source": OperationSource.ADMIN.value,
                "change_reason": "自动重试"
            })
            assert retry_response.status_code == 200
            assert retry_response.json()["retry_count"] == i + 1

        client.put(f"/api/v1/tasks/{task_no}/status", json={
            "status": TaskStatus.FAILED.value,
            "operator": "system",
            "operation_source": OperationSource.SYSTEM.value
        })

        retry_response = client.post(f"/api/v1/tasks/{task_no}/retry", json={
            "operator": "admin",
            "operation_source": OperationSource.ADMIN.value
        })
        assert retry_response.status_code == 400, "超过最大重试次数应返回400"
        assert "最大重试次数" in retry_response.json()["detail"]

        history = client.get(f"/api/v1/tasks/{task_no}/history").json()
        retry_count_in_history = sum(1 for h in history if h["status"] == TaskStatus.RETRYING.value)
        assert retry_count_in_history == 3, "历史中应有3次重试记录"
        print("✓ 规则4通过: 最大重试次数限制验证成功")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
