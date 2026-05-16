import unittest
import json
import os
import sys

os.environ["STREAM_TASK_DB_PATH"] = "/tmp/test_tasks.db"

if os.path.exists("/tmp/test_tasks.db"):
    os.remove("/tmp/test_tasks.db")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/test_tasks.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.models.task import Base
from app.database import get_db

def get_test_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

Base.metadata.create_all(bind=engine)

from app.api.tasks import router as tasks_router

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(tasks_router, prefix="/api/v1")
app.dependency_overrides[get_db] = get_test_db
client = TestClient(app)


class TestTaskAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        pass

    @classmethod
    def tearDownClass(cls):
        if os.path.exists("/tmp/test_tasks.db"):
            os.remove("/tmp/test_tasks.db")

    def test_01_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_02_create_task(self):
        task_data = {
            "task_id": "task_001",
            "task_name": "流式数据同步任务",
            "total_shards": 3,
            "target_watermark": 100000
        }
        response = client.post("/api/v1/tasks", json=task_data)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["id"], "task_001")
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["total_shards"], 3)

    def test_03_duplicate_task_creation(self):
        task_data = {
            "task_id": "task_001",
            "task_name": "流式数据同步任务",
            "total_shards": 3
        }
        response = client.post("/api/v1/tasks", json=task_data)
        self.assertEqual(response.status_code, 400)

    def test_04_get_task_detail(self):
        response = client.get("/api/v1/tasks/task_001")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["shards"]), 3)
        self.assertEqual(data["shards"][0]["shard_no"], 0)

    def test_05_start_task(self):
        response = client.post("/api/v1/tasks/task_001/start")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "running")

    def test_06_update_progress_normal(self):
        progress_data = {
            "shards": [
                {"shard_no": 0, "current_offset": 1000, "processed_count": 1000, "success_count": 998, "failed_count": 2},
                {"shard_no": 1, "current_offset": 800, "processed_count": 800, "success_count": 800, "failed_count": 0},
                {"shard_no": 2, "current_offset": 500, "processed_count": 500, "success_count": 499, "failed_count": 1}
            ],
            "watermark": 500
        }
        response = client.post("/api/v1/tasks/task_001/progress", json=progress_data)
        self.assertEqual(response.status_code, 200)

    def test_07_offset_rollback_prevention(self):
        progress_data = {
            "shards": [
                {"shard_no": 0, "current_offset": 500, "processed_count": 500}
            ]
        }
        response = client.post("/api/v1/tasks/task_001/progress", json=progress_data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("rollback", response.json()["detail"].lower())

    def test_08_record_failure(self):
        failure_data = {
            "shard_no": 0,
            "offset": 567,
            "raw_input": json.dumps({"id": 567, "data": "corrupted data here", "timestamp": "2024-01-15"}),
            "process_context": "正在执行字段校验，预期字段missing_field不存在",
            "error_message": "KeyError: 'missing_field'",
            "error_stack": "Traceback (most recent call last):\n  File \"processor.py\", line 42\n    KeyError: 'missing_field'"
        }
        response = client.post("/api/v1/tasks/task_001/failures", json=failure_data)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["offset"], 567)

    def test_09_duplicate_failure_idempotent(self):
        failure_data = {
            "shard_no": 0,
            "offset": 567,
            "raw_input": json.dumps({"id": 567, "data": "corrupted data here"}),
            "error_message": "KeyError: 'missing_field'"
        }
        response = client.post("/api/v1/tasks/task_001/failures", json=failure_data)
        self.assertEqual(response.status_code, 201)
        failures = client.get("/api/v1/tasks/task_001/failures").json()
        self.assertEqual(len(failures), 1)

    def test_10_dirty_data_rejection(self):
        failure_data = {
            "shard_no": 1,
            "offset": 234,
            "raw_input": "INVALID_JSON_{{broken__",
            "process_context": "解析JSON时发现格式错误",
            "error_message": "JSONDecodeError: Expecting value"
        }
        response = client.post("/api/v1/tasks/task_001/failures", json=failure_data)
        self.assertEqual(response.status_code, 201)

    def test_11_manual_fix(self):
        failures = client.get("/api/v1/tasks/task_001/failures").json()
        self.assertGreater(len(failures), 0)
        failure_id = failures[0]["id"]
        
        fix_data = {
            "failure_id": failure_id,
            "fix_note": "已手动补全missing_field字段，数据已修正并入库",
            "final_status": "fixed"
        }
        response = client.post("/api/v1/tasks/task_001/manual-fix", json=fix_data)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["is_manually_fixed"], True)
        self.assertIn("手动补全", data["fix_note"])

    def test_12_resume_task(self):
        response = client.post("/api/v1/tasks/task_001/shards/2/complete")
        self.assertEqual(response.status_code, 200)

        resume_data = {"resume_reason": "服务重启，从断点继续"}
        response = client.post("/api/v1/tasks/task_001/resume", json=resume_data)
        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["resume_no"], 1)
        self.assertEqual(len(report["already_synced"]), 1)
        self.assertEqual(report["already_synced"][0]["shard_no"], 2)

    def test_13_complete_task(self):
        client.post("/api/v1/tasks/task_001/shards/0/complete")
        client.post("/api/v1/tasks/task_001/shards/1/complete")
        
        task = client.get("/api/v1/tasks/task_001").json()
        self.assertEqual(task["status"], "completed")

    def test_14_export_task_data(self):
        response = client.get("/api/v1/tasks/task_001/export")
        self.assertEqual(response.status_code, 200)
        export_data = response.json()
        
        self.assertIn("task", export_data)
        self.assertIn("shards", export_data)
        self.assertIn("failures", export_data)
        self.assertIn("resume_reports", export_data)
        self.assertIn("summary", export_data)

    def test_15_get_resume_reports(self):
        response = client.get("/api/v1/tasks/task_001/resume-reports")
        self.assertEqual(response.status_code, 200)
        reports = response.json()
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]["resume_no"], 1)

    def test_16_task_not_found(self):
        response = client.get("/api/v1/tasks/nonexistent_task")
        self.assertEqual(response.status_code, 404)


def run_tests():
    print("\n" + "="*60)
    print("流式任务断点API 测试套件")
    print("="*60)
    
    loader = unittest.TestLoader()
    loader.sortTestMethodsUsing = None
    suite = loader.loadTestsFromTestCase(TestTaskAPI)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "="*60)
    print(f"测试结果: 运行 {result.testsRun} 个测试")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    print("="*60)
    
    if result.failures:
        print("\n失败详情:")
        for test, trace in result.failures:
            print(f"\n  {test}:")
            print(f"    {trace.split(chr(10))[0]}")


if __name__ == "__main__":
    run_tests()
