import sys
sys.path.insert(0, '.')

from app.database import init_db
from app.main import app
from fastapi.testclient import TestClient

init_db()
client = TestClient(app)

def test_gpu_registration():
    print("\n[1] 注册 GPU...")
    response = client.post('/api/v1/gpus/register', json={
        'gpu_id': 'gpu-e2e-001',
        'name': 'RTX 3090 E2E',
        'model': 'NVIDIA RTX 3090',
        'memory_gb': 24
    })
    print(f"  Status: {response.status_code}")
    assert response.status_code == 200
    gpu = response.json()
    print(f"  GPU ID: {gpu['gpu_id']}, Status: {gpu['status']}")
    return gpu

def test_task_submission():
    print("\n[2] 提交任务...")
    response = client.post('/api/v1/tasks/submit', json={
        'name': 'E2E Test Training',
        'user_id': 'tester',
        'priority': 7,
        'estimated_duration_minutes': 10,
        'timeout_minutes': 30,
        'max_retries': 2
    })
    print(f"  Status: {response.status_code}")
    assert response.status_code == 200
    task = response.json()
    print(f"  Task ID: {task['task_id']}, Status: {task['status']}")
    return task

def test_queue_overview():
    print("\n[3] 队列概览...")
    response = client.get('/api/v1/tasks/queue/overview')
    assert response.status_code == 200
    queue = response.json()
    print(f"  Total queued: {queue['total_queued']}")
    for item in queue['queue']:
        print(f"    Pos #{item['position']}: {item['name']} (P{item['priority']})")

def test_block_point(task_id):
    print(f"\n[4] 卡点查询 ({task_id})...")
    response = client.get(f'/api/v1/tasks/{task_id}/block-point')
    assert response.status_code == 200
    block = response.json()
    print(f"  Current status: {block['current_status']}")
    print(f"  Block point: {block['block_point']}")
    print(f"  Block reason: {block['block_reason']}")
    if block['latest_action']:
        print(f"  Latest action: {block['latest_action']['action']}")

def test_scheduler_execution():
    print("\n[5] 调度器执行...")
    from app.database import SessionLocal
    from app.core.scheduler import MainScheduler
    db = SessionLocal()
    scheduler = MainScheduler(db)
    scheduler.schedule_tick()
    db.close()
    print("  Done")

def test_task_history(task_id):
    print(f"\n[6] 任务历史 ({task_id})...")
    response = client.get(f'/api/v1/tasks/{task_id}/history')
    assert response.status_code == 200
    history = response.json()
    print(f"  Total records: {history['total']}")
    for h in history['items'][:5]:
        reason = h.get('reason') or h.get('details') or '-'
        print(f"    [{h['timestamp']}] {h['action']}: {reason}")

def test_reports():
    print("\n[7] 调度报告...")
    response = client.get('/api/v1/reports/scheduler')
    assert response.status_code == 200
    report = response.json()
    print(f"  GPUs: {report['total_gpus']} (avail={report['available_gpus']}, occ={report['occupied_gpus']})")
    print(f"  Tasks: {report['total_tasks']} (q={report['queued_tasks']}, r={report['running_tasks']}, s={report['succeeded_tasks']})")
    
    print("\n[8] 统计摘要...")
    response = client.get('/api/v1/reports/statistics')
    assert response.status_code == 200
    stats = response.json()
    print(f"  GPU: {stats['gpu_statistics']}")
    print(f"  Task success rate: {stats['task_statistics']['success_rate_percent']}%")

if __name__ == '__main__':
    print("=" * 60)
    print("GPU Task Queue Service - E2E Test")
    print("=" * 60)
    
    try:
        test_gpu_registration()
        task = test_task_submission()
        test_queue_overview()
        test_block_point(task['task_id'])
        test_scheduler_execution()
        test_task_history(task['task_id'])
        test_reports()
        
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED!")
        print("=" * 60)
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
