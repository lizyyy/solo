import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json
from datetime import datetime, timedelta

from app.main import app
from app.database import Base, get_db
from app import models, schemas

TEST_DATABASE_URL = "sqlite:///./test_embedding_batch.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def setup_module():
    Base.metadata.create_all(bind=engine)

def teardown_module():
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_embedding_batch.db"):
        os.remove("./test_embedding_batch.db")

def test_1_create_strategy():
    """测试1: 创建切片策略"""
    print("\n=== 测试1: 创建切片策略 ===")
    
    response = client.post(
        "/api/strategies/",
        json={
            "name": "test-strategy-512",
            "chunk_size": 512,
            "chunk_overlap": 50,
            "separator": "\n\n",
            "description": "测试策略"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "test-strategy-512"
    print(f"✓ 创建策略成功: ID={data['id']}")
    return data["id"]

def test_2_create_batch():
    """测试2: 创建文档批次"""
    print("\n=== 测试2: 创建文档批次 ===")
    
    request_id = "batch-test-001"
    response = client.post(
        f"/api/batches/?request_id={request_id}",
        json={
            "batch_name": "测试批次-001",
            "source_type": "PDF",
            "total_documents": 10,
            "total_chunks": 50,
            "metadata": {"project": "test", "author": "tester"}
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["batch_name"] == "测试批次-001"
    assert data["status"] == "pending"
    print(f"✓ 创建批次成功: ID={data['id']}, 状态={data['status']}")
    return data["id"]

def test_3_idempotent_request():
    """测试3: 幂等性请求 - 相同request_id不会重复创建"""
    print("\n=== 测试3: 幂等性请求验证 ===")
    
    request_id = "batch-test-001"
    
    response1 = client.post(
        f"/api/batches/?request_id={request_id}",
        json={
            "batch_name": "测试批次-001-重复",
            "source_type": "PDF",
            "total_documents": 10,
            "total_chunks": 50
        }
    )
    
    response2 = client.post(
        f"/api/batches/?request_id={request_id}",
        json={
            "batch_name": "测试批次-001-重复",
            "source_type": "PDF",
            "total_documents": 10,
            "total_chunks": 50
        }
    )
    
    batches = client.get("/api/batches/").json()
    count = sum(1 for b in batches if b["batch_name"].startswith("测试批次-001"))
    
    assert count == 1, f"期望只有1个批次，但实际有{count}个"
    print(f"✓ 幂等性验证通过: 相同request_id不会重复创建，总批次数={count}")

def test_4_create_tasks_and_start_batch(batch_id):
    """测试4: 创建任务并启动批次"""
    print("\n=== 测试4: 创建任务并启动批次 ===")
    
    for i in range(5):
        response = client.post(
            "/api/tasks/",
            json={
                "batch_id": batch_id,
                "document_id": f"doc-{i}",
                "chunk_index": i,
                "chunk_text": f"这是第{i}个测试文档的内容...",
                "embedding_model": "text-embedding-ada-002"
            }
        )
        assert response.status_code == 200
    
    response = client.post(f"/api/batches/{batch_id}/start")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    print(f"✓ 批次启动成功: 状态={data['status']}")

def test_5_task_completion_and_progress(batch_id):
    """测试5: 任务完成与进度更新"""
    print("\n=== 测试5: 任务完成与进度更新 ===")
    
    tasks = client.get(f"/api/batches/{batch_id}/tasks/").json()
    
    for i, task in enumerate(tasks[:3]):
        response = client.post(f"/api/tasks/{task['id']}/complete")
        assert response.status_code == 200
        print(f"  ✓ 任务 {task['id']} 标记完成")
    
    batch = client.get(f"/api/batches/{batch_id}").json()
    print(f"✓ 批次进度: {batch['progress']:.1f}%, 完成任务数={batch['completed_count']}")
    assert batch["progress"] > 0

def test_6_task_failure_and_failed_chunk(batch_id):
    """测试6: 任务失败与失败片段记录"""
    print("\n=== 测试6: 任务失败与失败片段记录 ===")
    
    tasks = client.get(f"/api/batches/{batch_id}/tasks/").json()
    pending_tasks = [t for t in tasks if t["status"] == "pending"]
    
    for task in pending_tasks[:2]:
        response = client.post(
            f"/api/tasks/{task['id']}/fail",
            params={
                "error_message": "API调用超时，请检查网络连接",
                "error_type": "NetworkError"
            }
        )
        assert response.status_code == 200
        print(f"  ✓ 任务 {task['id']} 标记失败")
    
    failed_chunks = client.get(f"/api/batches/{batch_id}/failed-chunks/").json()
    assert len(failed_chunks) >= 2
    print(f"✓ 失败片段已记录: {len(failed_chunks)} 个")
    
    for chunk in failed_chunks:
        print(f"  - 类型: {chunk['error_type']}, 信息: {chunk['error_message'][:30]}...")

def test_7_retry_mechanism(batch_id):
    """测试7: 重试机制"""
    print("\n=== 测试7: 重试机制 ===")
    
    tasks = client.get(f"/api/batches/{batch_id}/tasks/").json()
    failed_tasks = [t for t in tasks if t["status"] == "failed"]
    
    for task in failed_tasks[:1]:
        response = client.post(f"/api/tasks/{task['id']}/retry")
        assert response.status_code == 200
        data = response.json()
        assert data["retry_count"] == 1
        print(f"  ✓ 任务 {task['id']} 加入重试队列, 重试次数={data['retry_count']}")
    
    retry_queue = client.get(f"/api/batches/{batch_id}/retry-queue/").json()
    print(f"✓ 重试队列中有 {len(retry_queue)} 个任务")
    
    response = client.post(f"/api/batches/{batch_id}/retry-queue/process")
    assert response.status_code == 200
    result = response.json()
    print(f"✓ 处理重试队列: {result['processed']} 个任务已处理")

def test_8_create_stuck_task_for_cleanup(batch_id):
    """测试8: 创建卡住的任务用于脏数据清理测试"""
    print("\n=== 测试8: 准备脏数据清理测试 ===")
    
    db = TestingSessionLocal()
    
    stuck_time = datetime.now() - timedelta(hours=3)
    stuck_task = models.VectorTask(
        batch_id=batch_id,
        document_id="doc-stuck-001",
        chunk_index=999,
        chunk_text="这是一个卡住的任务，状态为processing但超过2小时无更新",
        embedding_model="text-embedding-ada-002",
        status=models.TaskStatus.PROCESSING,
        processing_started_at=stuck_time
    )
    db.add(stuck_task)
    db.commit()
    
    tasks_before = db.query(models.VectorTask).filter(
        models.VectorTask.batch_id == batch_id,
        models.VectorTask.status == models.TaskStatus.PROCESSING
    ).count()
    print(f"✓ 创建卡住的任务成功, 当前processing状态任务数: {tasks_before}")
    db.close()

def test_9_dirty_data_cleanup(batch_id):
    """测试9: 脏数据清理"""
    print("\n=== 测试9: 脏数据清理 ===")
    
    response = client.post(f"/api/batches/{batch_id}/cleanup")
    assert response.status_code == 200
    result = response.json()
    
    print(f"✓ 清理结果:")
    print(f"  - 卡住的任务: {result.get('stuck_processing', 0)} 个")
    print(f"  - 孤儿任务: {result.get('orphaned_tasks', 0)} 个")
    print(f"  - 重复索引: {result.get('duplicate_indexes', 0)} 个")
    
    db = TestingSessionLocal()
    stuck_tasks = db.query(models.VectorTask).filter(
        models.VectorTask.batch_id == batch_id,
        models.VectorTask.status == models.TaskStatus.PROCESSING
    ).count()
    pending_tasks = db.query(models.VectorTask).filter(
        models.VectorTask.batch_id == batch_id,
        models.VectorTask.status == models.TaskStatus.PENDING
    ).count()
    db.close()
    
    print(f"✓ 清理后状态: processing={stuck_tasks}, pending={pending_tasks}")
    assert stuck_tasks == 0, "卡住的任务应该被重置为pending"

def test_10_index_verification(batch_id):
    """测试10: 索引结果校验"""
    print("\n=== 测试10: 索引结果校验 ===")
    
    tasks = client.get(f"/api/batches/{batch_id}/tasks/").json()
    completed_tasks = [t for t in tasks if t["status"] == "completed"]
    
    for i, task in enumerate(completed_tasks[:2]):
        response = client.post(
            "/api/index-results/",
            json={
                "batch_id": batch_id,
                "task_id": task["id"],
                "document_id": task["document_id"],
                "chunk_index": task["chunk_index"],
                "vector_id": f"vec-{batch_id}-{task['id']}-{i}",
                "vector_checksum": f"checksum-{i}"
            }
        )
        assert response.status_code == 200
        print(f"  ✓ 为任务 {task['id']} 创建索引结果")
    
    response = client.get(f"/api/batches/{batch_id}/verify-indexes")
    assert response.status_code == 200
    result = response.json()
    
    print(f"✓ 批次索引校验结果:")
    print(f"  - 总任务数: {result['total_tasks']}")
    print(f"  - 已索引: {result['indexed_count']}")
    print(f"  - 已验证: {result['verified_count']}")
    print(f"  - 缺失索引: {len(result['missing_indexes'])} 个")
    print(f"  - 是否有缺失: {result['has_missing']}")
    
    index_results = client.get(f"/api/batches/{batch_id}/index-results/").json()
    for idx in index_results:
        response = client.post(
            f"/api/index-results/{idx['id']}/verify",
            params={"is_valid": True}
        )
        assert response.status_code == 200
    print(f"✓ 所有索引结果已验证")

def test_11_batch_report_and_export(batch_id):
    """测试11: 批次报告与数据导出"""
    print("\n=== 测试11: 批次报告与数据导出 ===")
    
    response = client.get(f"/api/batches/{batch_id}/report")
    assert response.status_code == 200
    report = response.json()
    
    print(f"✓ 批次报告:")
    print(f"  - 批次名称: {report['batch_name']}")
    print(f"  - 状态: {report['status']}")
    print(f"  - 总任务数: {report['total_tasks']}")
    print(f"  - 已完成: {report['completed_tasks']}")
    print(f"  - 已失败: {report['failed_tasks']}")
    print(f"  - 待处理: {report['pending_tasks']}")
    print(f"  - 进度: {report['progress']:.1f}%")
    print(f"  - 失败片段数: {len(report['failed_chunks'])}")
    print(f"  - 重试队列数: {report['retry_queue_count']}")
    
    response = client.get(f"/api/batches/{batch_id}/export")
    assert response.status_code == 200
    export_data = response.json()
    
    print(f"✓ 数据导出成功:")
    print(f"  - 任务数: {len(export_data['tasks'])}")
    print(f"  - 失败片段数: {len(export_data['failed_chunks'])}")
    print(f"  - 索引结果数: {len(export_data['index_results'])}")
    
    with open("batch_export_sample.json", "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    print(f"✓ 导出数据已保存到 batch_export_sample.json")

def test_12_complete_batch(batch_id):
    """测试12: 完成批次"""
    print("\n=== 测试12: 完成批次 ===")
    
    response = client.post(f"/api/batches/{batch_id}/complete")
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "completed"
    assert data["progress"] == 100.0
    
    print(f"✓ 批次已完成: 状态={data['status']}, 进度={data['progress']}%")

def main():
    print("=" * 60)
    print("Embedding Batch Manager - 核心功能测试套件")
    print("=" * 60)
    print("\n测试场景:")
    print("  1. 基础 CRUD 操作")
    print("  2. 幂等性请求（防重复提交）")
    print("  3. 失败补偿流程（重试机制）")
    print("  4. 脏数据清理（断点续跑）")
    print("  5. 索引校验与报告导出")
    print()
    
    try:
        setup_module()
        
        strategy_id = test_1_create_strategy()
        batch_id = test_2_create_batch()
        test_3_idempotent_request()
        test_4_create_tasks_and_start_batch(batch_id)
        test_5_task_completion_and_progress(batch_id)
        test_6_task_failure_and_failed_chunk(batch_id)
        test_7_retry_mechanism(batch_id)
        test_8_create_stuck_task_for_cleanup(batch_id)
        test_9_dirty_data_cleanup(batch_id)
        test_10_index_verification(batch_id)
        test_11_batch_report_and_export(batch_id)
        test_12_complete_batch(batch_id)
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        print("\n核心功能验证完成:")
        print("  ✓ 幂等性请求可防止重复提交")
        print("  ✓ 失败任务自动记录失败片段")
        print("  ✓ 重试队列支持断点续跑")
        print("  ✓ 脏数据清理可重置卡住的任务")
        print("  ✓ 索引校验可检测缺失索引")
        print("  ✓ 报告导出包含完整执行信息")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        teardown_module()

if __name__ == "__main__":
    main()
