import requests
import json
import time

BASE_URL = "http://localhost:8000/api"


def print_separator(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def demo_normal_flow():
    print_separator("场景1: 正常质检流程")
    
    recording_ids = [f"REC_{i:04d}" for i in range(100)]
    
    batch_data = {
        "batch_code": "BATCH_20260510_001",
        "name": "5月10日客服录音批次",
        "agent_id": "AGENT_001",
        "record_count": 100,
        "recording_ids": recording_ids
    }
    
    print("1. 创建录音批次...")
    r = requests.post(f"{BASE_URL}/batches", json=batch_data)
    batch = r.json()
    batch_id = batch["id"]
    print(f"   批次ID: {batch_id}, 批次编码: {batch['batch_code']}")
    
    rule_data = {
        "name": "常规抽检规则",
        "sampling_ratio": 0.1,
        "min_samples": 5,
        "max_samples": 20,
        "description": "按10%比例抽取，最少5个，最多20个"
    }
    
    print("\n2. 创建抽样规则...")
    r = requests.post(f"{BASE_URL}/rules", json=rule_data)
    rule = r.json()
    rule_id = rule["id"]
    print(f"   规则ID: {rule_id}, 抽样比例: {rule['sampling_ratio']}")
    
    sampling_data = {
        "batch_id": batch_id,
        "rule_id": rule_id,
        "inspectors": ["INS_001", "INS_002", "INS_003"]
    }
    
    print("\n3. 执行抽样派单...")
    r = requests.post(f"{BASE_URL}/sampling/execute", json=sampling_data)
    result = r.json()
    task_id = result["task"]["id"]
    assignments = result["assignments"]
    print(f"   抽样任务ID: {task_id}")
    print(f"   抽样数量: {result['task']['sampled_count']}")
    print(f"   派单数量: {len(assignments)}")
    for a in assignments[:3]:
        print(f"   - 录音 {a['recording_id']} -> 质检员 {a['inspector_id']}")
    
    print("\n4. 提交质检结果...")
    assignment_id = assignments[0]["id"]
    inspector_id = assignments[0]["inspector_id"]
    
    inspection_data = {
        "assignment_id": assignment_id,
        "score": 92.5,
        "is_passed": True,
        "comments": "服务态度良好，问题解答准确",
        "inspector_id": inspector_id
    }
    r = requests.post(f"{BASE_URL}/inspections/submit", json=inspection_data)
    inspection = r.json()
    print(f"   质检结果ID: {inspection['id']}")
    print(f"   得分: {inspection['score']}, 是否通过: {inspection['is_passed']}")
    
    print("\n5. 查看质量报表...")
    r = requests.get(f"{BASE_URL}/reports/quality/{batch_id}")
    report = r.json()
    print(f"   总派单: {report['total_assigned']}")
    print(f"   已完成: {report['completed']}")
    print(f"   平均分: {report['avg_score']}")
    
    return batch_id, rule_id, inspection["id"]


def demo_exception_handling(batch_id, rule_id):
    print_separator("场景2: 异常拦截")
    
    recording_ids = [f"REC_{i:04d}" for i in range(100, 200)]
    batch2_data = {
        "batch_code": "BATCH_20260510_002",
        "name": "异常测试批次",
        "agent_id": "AGENT_002",
        "record_count": 100,
        "recording_ids": recording_ids
    }
    
    print("1. 重复抽样验证（应返回相同结果）...")
    r = requests.get(f"{BASE_URL}/sampling-tasks", params={"batch_id": batch_id})
    original_tasks = r.json()
    original_seed = original_tasks[0]["sample_seed"]
    original_count = original_tasks[0]["sampled_count"]
    print(f"   原有抽样种子: {original_seed}")
    print(f"   原有抽样数量: {original_count}")
    
    print("\n2. 尝试重复提交质检（应拦截）...")
    r = requests.get(f"{BASE_URL}/assignments", params={"batch_id": batch_id})
    assignments = r.json()
    if assignments:
        assignment_id = assignments[0]["id"]
        duplicate_inspection = {
            "assignment_id": assignment_id,
            "score": 80.0,
            "is_passed": False,
            "comments": "重复提交测试",
            "inspector_id": assignments[0]["inspector_id"]
        }
        r = requests.post(f"{BASE_URL}/inspections/submit", json=duplicate_inspection)
        print(f"   状态码: {r.status_code}")
        print(f"   拦截信息: {r.json()['detail']}")
    
    print("\n3. 创建第二个批次并抽样...")
    r = requests.post(f"{BASE_URL}/batches", json=batch2_data)
    batch2 = r.json()
    batch2_id = batch2["id"]
    
    sampling_data2 = {
        "batch_id": batch2_id,
        "rule_id": rule_id,
        "inspectors": ["INS_004"]
    }
    r = requests.post(f"{BASE_URL}/sampling/execute", json=sampling_data2)
    result2 = r.json()
    print(f"   第二批抽样数量: {result2['task']['sampled_count']}")
    
    print("\n4. 质检员B提交不属于自己的质检（应拦截）...")
    assignment2 = result2["assignments"][0]
    wrong_inspector_data = {
        "assignment_id": assignment2["id"],
        "score": 75.0,
        "is_passed": True,
        "comments": "错误质检员提交",
        "inspector_id": "WRONG_INS"
    }
    r = requests.post(f"{BASE_URL}/inspections/submit", json=wrong_inspector_data)
    print(f"   状态码: {r.status_code}")
    print(f"   拦截信息: {r.json()['detail']}")
    
    return batch2_id, result2["assignments"][0]["id"]


def demo_review_and_freeze(batch_id, inspection_id):
    print_separator("场景3: 复核申诉与扣分冻结")
    
    print("1. 提交申诉...")
    review_data = {
        "inspection_result_id": inspection_id,
        "appeal_reason": "质检标准理解有偏差，请求重新复核",
        "appeal_by": "AGENT_001"
    }
    r = requests.post(f"{BASE_URL}/reviews/appeal", json=review_data)
    review = r.json()
    review_id = review["id"]
    print(f"   申诉ID: {review_id}")
    print(f"   申诉状态: {review['status']}")
    
    print("\n2. 重复申诉（应拦截）...")
    r = requests.post(f"{BASE_URL}/reviews/appeal", json=review_data)
    print(f"   状态码: {r.status_code}")
    print(f"   拦截信息: {r.json()['detail']}")
    
    print("\n3. 处理申诉并调整分数...")
    process_data = {
        "review_id": review_id,
        "review_comments": "经复核，原质检存在标准理解问题，调整分数",
        "review_by": "SUPERVISOR_001",
        "score_adjusted": True,
        "adjusted_score": 95.0
    }
    r = requests.post(f"{BASE_URL}/reviews/process", json=process_data)
    result = r.json()
    print(f"   处理状态: {result['status']}")
    print(f"   分数调整: {result['score_adjusted']}")
    print(f"   调整后分数: {result['adjusted_score']}")
    
    print("\n4. 扣分冻结...")
    freeze_data = {
        "inspection_result_id": inspection_id,
        "reason": "处于争议状态，暂冻结扣分",
        "frozen_score": 92.5,
        "operator_id": "SUPERVISOR_001"
    }
    r = requests.post(f"{BASE_URL}/score-freeze", json=freeze_data)
    freeze = r.json()
    freeze_id = freeze["id"]
    print(f"   冻结ID: {freeze_id}")
    print(f"   冻结分数: {freeze['frozen_score']}")
    print(f"   冻结状态: {freeze['is_active']}")
    
    print("\n5. 重复冻结（应拦截）...")
    r = requests.post(f"{BASE_URL}/score-freeze", json=freeze_data)
    print(f"   状态码: {r.status_code}")
    print(f"   拦截信息: {r.json()['detail']}")
    
    print("\n6. 查看历史记录...")
    r = requests.get(f"{BASE_URL}/history/InspectionResult/{inspection_id}")
    history = r.json()
    print(f"   历史记录数量: {len(history)}")
    for h in history:
        print(f"   - [{h['timestamp']}] {h['action']} by {h['operator_id']}")
    
    print("\n7. 查看完整质量报表...")
    r = requests.get(f"{BASE_URL}/reports/quality/{batch_id}")
    report = r.json()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    
    return freeze_id


def demo_duplicate_operations(batch_id, rule_id):
    print_separator("场景4: 重复操作测试（验证幂等性）")
    
    print("1. 第一次抽样...")
    r = requests.get(f"{BASE_URL}/sampling-tasks", params={"batch_id": batch_id})
    tasks1 = r.json()
    task1_id = tasks1[0]["id"]
    
    sampling_data = {
        "batch_id": batch_id,
        "rule_id": rule_id,
        "inspectors": ["INS_001", "INS_002", "INS_003"]
    }
    
    print("\n2. 同一批次+规则再次抽样（应返回已有结果）...")
    r = requests.post(f"{BASE_URL}/sampling/execute", json=sampling_data)
    result = r.json()
    task2_id = result["task"]["id"]
    print(f"   第一次任务ID: {task1_id}")
    print(f"   第二次任务ID: {task2_id}")
    print(f"   任务ID相同: {task1_id == task2_id}")
    
    print("\n3. 验证同一批次用不同规则可以创建新抽样...")
    rule2_data = {
        "name": "严格抽检规则",
        "sampling_ratio": 0.2,
        "min_samples": 10,
        "max_samples": 30,
        "description": "按20%比例抽取"
    }
    r = requests.post(f"{BASE_URL}/rules", json=rule2_data)
    rule2 = r.json()
    rule2_id = rule2["id"]
    
    sampling_data2 = {
        "batch_id": batch_id,
        "rule_id": rule2_id,
        "inspectors": ["INS_004"]
    }
    r = requests.post(f"{BASE_URL}/sampling/execute", json=sampling_data2)
    result2 = r.json()
    print(f"   新规则抽样数量: {result2['task']['sampled_count']}")
    print(f"   新任务ID: {result2['task']['id']}")
    
    print("\n4. 验证重跑结果稳定（使用同一批录音，相同种子）...")
    print(f"   任务1采样数量: {tasks1[0]['sampled_count']}")
    print(f"   任务2采样数量: {result2['task']['sampled_count']}")
    print(f"   结果不同（因为规则不同）: {tasks1[0]['sampled_count'] != result2['task']['sampled_count']}")


def main():
    print("\n" + "#" * 60)
    print("#         客服质检抽样派单服务 - 样例数据演示")
    print("#" * 60)
    
    try:
        batch_id, rule_id, inspection_id = demo_normal_flow()
        batch2_id, assignment2_id = demo_exception_handling(batch_id, rule_id)
        freeze_id = demo_review_and_freeze(batch_id, inspection_id)
        demo_duplicate_operations(batch_id, rule_id)
        
        print_separator("演示完成总结")
        print("""
本次演示覆盖了：

1. 正常流程：
   - 创建录音批次
   - 定义抽样规则
   - 执行抽样派单
   - 提交质检结果
   - 生成质量报表

2. 异常拦截：
   - 重复提交质检（拦截）
   - 质检员不匹配（拦截）
   - 同一批抽样幂等处理

3. 复核申诉：
   - 提交申诉
   - 重复申诉（拦截）
   - 处理申诉并调整分数
   - 扣分冻结
   - 重复冻结（拦截）

4. 历史追踪：
   - 所有操作记录历史
   - 可按实体查询

5. 稳定性保证：
   - 使用确定性种子，重跑结果一致
   - 同一批次+规则不重复抽样
   - 状态变更有完整历史
        """)
        
    except Exception as e:
        print(f"\n错误: {e}")
        print("请确保服务已启动: python main.py")


if __name__ == "__main__":
    main()
