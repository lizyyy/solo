import json
import requests

BASE_URL = 'http://localhost:5000/api'

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"【{title}】")
    print(f"状态码: {response.status_code}")
    data = response.json()
    print(f"成功: {data['success']}")
    if data['message']:
        print(f"消息: {data['message']}")
    if data['data']:
        print(f"数据: {json.dumps(data['data'], indent=2, ensure_ascii=False)[:500]}")
    print(f"{'='*60}\n")

def main():
    print("="*60)
    print("评测集污染检测服务 - 示例流程")
    print("="*60)
    
    print("\n--- 步骤 1: 健康检查 ---")
    response = requests.get(f"{BASE_URL}/health")
    print_response("健康检查", response)
    assert response.status_code == 200, "服务未启动"
    
    print("\n--- 步骤 2: 创建评测集 ---")
    eval_set_payload = {
        "name": "ML评测基准集",
        "version": "v1.0",
        "description": "用于模型评测的标准题目集",
        "created_by": "qa_team",
        "items": [
            {
                "item_id": "q1",
                "content": "什么是机器学习？请简述其定义。"
            },
            {
                "item_id": "q2", 
                "content": "什么是监督学习和无监督学习？"
            },
            {
                "item_id": "q3",
                "content": "请解释过拟合和欠拟合的概念。"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/evaluation-sets", json=eval_set_payload)
    print_response("创建评测集", response)
    eval_set_id = response.json()['data']['id']
    
    print(f"\n评测集 ID: {eval_set_id}")
    
    print("\n--- 步骤 3: 查看所有评测集 ---")
    response = requests.get(f"{BASE_URL}/evaluation-sets")
    print_response("评测集列表", response)
    
    print("\n--- 步骤 4: 创建检测任务 - 包含污染数据 ---")
    polluted_task_payload = {
        "evaluation_set_id": eval_set_id,
        "training_data_signature": "training_dataset_2024_v1",
        "training_data_description": "从互联网爬取的ML训练数据",
        "created_by": "data_engineer",
        "training_data": [
            {
                "content": "什么是机器学习？请简述其定义。",
                "data_source": "crawled_data/file1.txt",
                "meta_info": {"source_type": "web", "crawl_date": "2024-01-15"}
            },
            {
                "content": "这是干净的训练数据，不包含评测题",
                "data_source": "crawled_data/file2.txt",
                "meta_info": {"source_type": "book"}
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/detection-tasks", json=polluted_task_payload)
    print_response("创建检测任务", response)
    polluted_task_id = response.json()['data']['id']
    
    print(f"\n污染任务 ID: {polluted_task_id}")
    
    print("\n--- 步骤 5: 尝试重复提交同一任务 ---")
    response = requests.post(f"{BASE_URL}/detection-tasks", json={
        "evaluation_set_id": eval_set_id,
        "training_data_signature": "training_dataset_2024_v1"
    })
    print_response("重复提交检测", response)
    
    print("\n--- 步骤 6: 运行污染检测 ---")
    response = requests.post(f"{BASE_URL}/detection-tasks/{polluted_task_id}/run")
    print_response("运行检测", response)
    
    task_status = response.json()['data']['task']['status']
    matches = response.json()['data']['matches']
    print(f"\n检测后状态: {task_status}")
    print(f"发现匹配数: {len(matches)}")
    
    if matches:
        print("\n--- 步骤 7: 查看匹配详情 ---")
        response = requests.get(f"{BASE_URL}/detection-tasks/{polluted_task_id}/matches")
        print_response("匹配详情", response)
        
        match_id = matches[0]['id']
        
        print("\n--- 步骤 8: 查看任务历史 ---")
        response = requests.get(f"{BASE_URL}/detection-tasks/{polluted_task_id}/history")
        print_response("状态历史", response)
        
        print("\n--- 步骤 9: 人工确认污染 ---")
        confirm_payload = {
            "match_id": match_id,
            "is_polluted": True,
            "confirmed_by": "security_reviewer",
            "comment": "经核查，训练数据确实包含了评测题目"
        }
        
        response = requests.post(f"{BASE_URL}/detection-tasks/{polluted_task_id}/confirm", json=confirm_payload)
        print_response("人工确认", response)
        
        task_status = response.json()['data']['task']['status']
        print(f"\n确认后状态: {task_status}")
        
        print("\n--- 步骤 10: 生成检测报告 ---")
        response = requests.post(f"{BASE_URL}/detection-tasks/{polluted_task_id}/report", json={
            "report_type": "summary",
            "generated_by": "system"
        })
        print_response("生成报告", response)
        
        report = response.json()['data']
        print(f"\n报告摘要: {report['summary']}")
        print(f"总匹配数: {report['findings']['total_matches']}")
        print(f"活跃匹配数: {report['findings']['active_matches']}")
        print(f"是否豁免: {report['findings']['task_exempted']}")
    
    print("\n--- 步骤 11: 创建干净任务 ---")
    clean_task_payload = {
        "evaluation_set_id": eval_set_id,
        "training_data_signature": "clean_training_dataset",
        "training_data_description": "经过审核的干净训练数据",
        "created_by": "data_engineer",
        "training_data": [
            {
                "content": "机器学习算法有很多种，包括决策树、SVM等。",
                "data_source": "verified_data/file1.txt"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/detection-tasks", json=clean_task_payload)
    clean_task_id = response.json()['data']['id']
    
    response = requests.post(f"{BASE_URL}/detection-tasks/{clean_task_id}/run")
    print_response("运行干净任务检测", response)
    
    print(f"\n干净任务状态: {response.json()['data']['task']['status']}")
    
    print("\n--- 步骤 12: 查看所有任务列表 ---")
    response = requests.get(f"{BASE_URL}/detection-tasks")
    print_response("任务列表", response)
    
    print("\n--- 步骤 13: 演示非法状态流转 ---")
    pending_task_payload = {
        "evaluation_set_id": eval_set_id,
        "training_data_signature": "pending_test_sig",
        "created_by": "test_user"
    }
    
    response = requests.post(f"{BASE_URL}/detection-tasks", json=pending_task_payload)
    pending_task_id = response.json()['data']['id']
    
    print(f"\n在 pending 状态尝试豁免...")
    response = requests.post(f"{BASE_URL}/detection-tasks/{pending_task_id}/exempt", json={
        "reason": "false_positive",
        "justification": "测试",
        "exempted_by": "admin"
    })
    print_response("非法流转测试", response)
    
    if not response.json()['success']:
        print(f"\n错误消息: {response.json()['message']}")
        print(f"下一步允许的状态: {response.json()['details']['next_allowed_states']}")
    
    print("\n" + "="*60)
    print("示例流程执行完成！")
    print("="*60)
    
    print("\n" + "="*60)
    print("状态流转说明:")
    print("="*60)
    print("""
状态流转图:
pending → scanning → completed → needs_confirmation → confirmed_polluted/confirmed_clean
   ↓         ↓
 failed  ← failed
              ↓
           exempted (可从 completed/needs_confirmation/confirmed_* 到达)

关键约束:
1. 只有 pending 或 failed 状态才能开始扫描
2. 扫描完成后，有匹配→needs_confirmation，无匹配→completed
3. 只有 needs_confirmation 状态才能人工确认
4. 终态 (exempted, confirmed_*) 无法再流转
5. 豁免可以从 completed/needs_confirmation/confirmed_* 状态触发
""")

if __name__ == '__main__':
    main()
