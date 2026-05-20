import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)


def test_schema_validation():
    """测试字段约束验证"""
    print("=== 测试字段约束 ===")
    
    # 测试 file_size = 0
    response = client.post("/api/tasks", json={
        "file_name": "test.dat",
        "file_size": 0,
        "chunk_size": 1024,
        "file_hash": "abc"
    })
    print(f"file_size=0: 状态码 {response.status_code}")
    assert response.status_code == 422, "应该拒绝 file_size=0"
    
    # 测试 file_size 为负数
    response = client.post("/api/tasks", json={
        "file_name": "test.dat",
        "file_size": -100,
        "chunk_size": 1024,
        "file_hash": "abc"
    })
    print(f"file_size=-100: 状态码 {response.status_code}")
    assert response.status_code == 422, "应该拒绝负 file_size"
    
    # 测试 chunk_size = 0
    response = client.post("/api/tasks", json={
        "file_name": "test.dat",
        "file_size": 10240,
        "chunk_size": 0,
        "file_hash": "abc"
    })
    print(f"chunk_size=0: 状态码 {response.status_code}")
    assert response.status_code == 422, "应该拒绝 chunk_size=0"
    
    # 测试 max_retries 超出范围
    response = client.post("/api/tasks", json={
        "file_name": "test.dat",
        "file_size": 10240,
        "chunk_size": 1024,
        "file_hash": "abc",
        "max_retries": 15
    })
    print(f"max_retries=15: 状态码 {response.status_code}")
    assert response.status_code == 422, "应该拒绝 max_retries 超出范围"
    
    # 测试空文件名
    response = client.post("/api/tasks", json={
        "file_name": "",
        "file_size": 10240,
        "chunk_size": 1024,
        "file_hash": "abc"
    })
    print(f"空文件名: 状态码 {response.status_code}")
    assert response.status_code == 422, "应该拒绝空文件名"
    
    # 正常参数应该通过
    response = client.post("/api/tasks", json={
        "file_name": "test.dat",
        "file_size": 10240,
        "chunk_size": 1024,
        "file_hash": "abc",
        "max_retries": 2
    })
    print(f"正常参数: 状态码 {response.status_code}")
    assert response.status_code == 201, "正常参数应该成功"
    
    print("✅ 字段约束验证通过!")
    return response.json()["id"]


def test_failure_retry_logic(task_id):
    """测试失败重试逻辑"""
    print("\n=== 测试失败重试逻辑 ===")
    
    # 登记分片
    for i in range(2):
        response = client.post("/api/chunks/register", json={
            "task_id": task_id,
            "chunk_number": i,
            "chunk_size": 1024,
            "chunk_hash": f"hash_{i}"
        })
    
    # 分片 0 正常完成
    response = client.post("/api/chunks/complete", json={
        "chunk_id": f"{task_id}_chunk_0",
        "chunk_hash": "hash_0"
    })
    print(f"分片 0 正常完成: 状态 {response.json()['status']}")
    
    # 分片 1 第一次失败 (哈希不匹配)
    response = client.post("/api/chunks/complete", json={
        "chunk_id": f"{task_id}_chunk_1",
        "chunk_hash": "WRONG_HASH"
    })
    chunk1 = response.json()
    print(f"分片 1 第一次失败: 状态 {chunk1['status']}, 重试次数 {chunk1['retry_count']}, error: {chunk1['error_message']}")
    assert chunk1['status'] == 'retrying', "第一次失败应该进入 RETRYING 状态"
    assert chunk1['retry_count'] == 1, "重试次数应该是 1"
    assert chunk1['error_message'] is not None, "分片应该有错误信息"
    
    # 检查任务状态
    response = client.get(f"/api/tasks/{task_id}")
    task = response.json()
    print(f"任务状态: {task['status']}, 任务 error_message: {task['error_message']}")
    
    # 分片 1 第二次失败 (超过 max_retries=2)
    response = client.post(f"/api/chunks/{task_id}_chunk_1/fail", json={
        "error_message": "网络超时"
    })
    chunk1 = response.json()
    print(f"分片 1 第二次失败: 状态 {chunk1['status']}, 重试次数 {chunk1['retry_count']}")
    assert chunk1['status'] == 'failed', "第二次失败应该进入 FAILED 状态"
    assert chunk1['retry_count'] == 2, "重试次数应该是 2"
    
    # 检查任务最终状态
    response = client.get(f"/api/tasks/{task_id}")
    task = response.json()
    print(f"任务最终状态: {task['status']}, 任务 error_message: {task['error_message']}")
    assert task['status'] == 'failed', "任务应该进入 FAILED 状态"
    assert task['error_message'] is not None, "任务 error_message 不应该为空"
    assert "超过最大重试次数" in task['error_message'], "错误信息应该包含重试次数"
    
    print("✅ 失败重试逻辑验证通过!")
    
    # 测试人工复核
    print("\n=== 测试人工复核 ===")
    response = client.post(f"/api/tasks/{task_id}/review", json={
        "task_id": task_id,
        "action": "retry"
    })
    print(f"人工复核重试: {response.json()['message']}")
    
    response = client.get(f"/api/tasks/{task_id}")
    task = response.json()
    print(f"复核后任务状态: {task['status']}, error_message: {task['error_message']}")
    assert task['status'] == 'uploading', "复核后应该进入 UPLOADING 状态"
    assert task['error_message'] is None, "复核后 error_message 应该清空"
    
    # 检查分片状态
    for chunk in task['chunks']:
        if chunk['chunk_number'] == 1:
            print(f"分片 1 复核后状态: {chunk['status']}, error: {chunk['error_message']}")
            assert chunk['status'] == 'pending', "失败分片应该重置为 PENDING"
            assert chunk['error_message'] is None, "分片错误信息应该清空"
    
    print("✅ 人工复核验证通过!")


def test_success_flow():
    """测试成功流程"""
    print("\n=== 测试成功流程 ===")
    
    response = client.post("/api/tasks", json={
        "file_name": "success_test.dat",
        "file_size": 2048,
        "chunk_size": 1024,
        "file_hash": "abc123",
        "callback_url": "http://localhost:9999/callback"
    })
    task_id = response.json()["id"]
    
    # 登记并完成所有分片
    for i in range(2):
        client.post("/api/chunks/register", json={
            "task_id": task_id,
            "chunk_number": i,
            "chunk_size": 1024,
            "chunk_hash": f"hash_{i}"
        })
        client.post("/api/chunks/complete", json={
            "chunk_id": f"{task_id}_chunk_{i}",
            "chunk_hash": f"hash_{i}"
        })
    
    response = client.get(f"/api/tasks/{task_id}")
    task = response.json()
    print(f"任务最终状态: {task['status']}")
    print(f"续传点: {task['resume_point']}")
    assert task['status'] == 'completed', "任务应该完成"
    assert task['resume_point'] == 2, "续传点应该是 2"
    
    # 检查历史记录
    print(f"状态变更历史数: {len(task['history'])}")
    for h in task['history']:
        print(f"  - {h['changed_at']}: {h['previous_status']} -> {h['new_status']} ({h['note']})")
    
    print("✅ 成功流程验证通过!")


if __name__ == "__main__":
    print("分片上传协调器 - 修复验证测试\n")
    
    try:
        task_id = test_schema_validation()
        test_failure_retry_logic(task_id)
        test_success_flow()
        
        print("\n🎉 所有测试通过!")
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
