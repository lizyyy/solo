#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"


def demo():
    print("=" * 60)
    print("政务材料预审 API 服务演示")
    print("=" * 60)
    
    headers = {"Content-Type": "application/json"}
    
    print("\n【1. 查看材料目录（入口）")
    response = requests.get(f"{BASE_URL}/materials")
    print(f"  材料目录数量: {len(response.json())}")
    for mat in response.json()[:3]:
        print(f"  - {mat['code']}: {mat['name']} ({mat['category']})")
    
    print("\n【2. 创建办件 - 上传材料")
    app_data = {
        "applicant_name": "张三",
        "applicant_id": "110101199001011234",
        "business_type": "居住证办理",
        "materials": [
            {"material_id": 1, "material_name": "身份证复印件", "file_name": "身份证.pdf", "file_size": 102400},
            {"material_id": 3, "material_name": "申请表", "file_name": "申请表.docx", "file_size": 51200},
            {"material_id": 5, "material_name": "居住证明", "file_name": "居住证明.jpg", "file_size": 204800}
        ]
    }
    response = requests.post(f"{BASE_URL}/applications", json=app_data, headers=headers)
    app = response.json()
    print(f"  办件ID: {app['id']}")
    print(f"  办件状态: {app['status']}")
    print(f"  材料数量: {len(app['materials'])}")
    
    print("\n【3. 提交预审")
    submit_data = {"application_id": app['id']}
    response = requests.post(f"{BASE_URL}/applications/submit", json=submit_data, headers=headers)
    app = response.json()
    print(f"  受理号: {app['application_no']}")
    print(f"  办件状态: {app['status']}")
    
    print("\n【4. 开始预审")
    response = requests.post(f"{BASE_URL}/applications/{app['id']}/start-review?reviewer=李预审", headers=headers)
    app = response.json()
    print(f"  办件状态: {app['status']}")
    print(f"  当前步骤: {app['current_step']}")
    
    print("\n【5. 审核第一个材料 - 通过")
    review_data = {
        "application_material_id": app['materials'][0]['id'],
        "status": "通过",
        "review_result": "身份证有效期内，信息一致",
        "reviewer": "李预审"
    }
    response = requests.post(f"{BASE_URL}/materials/review", json=review_data, headers=headers)
    app = response.json()
    print(f"  办件状态: {app['status']}")
    
    print("\n【6. 审核第二个材料 - 需补正")
    review_data = {
        "application_material_id": app['materials'][1]['id'],
        "status": "需补正",
        "review_result": "申请表缺少申请人签字",
        "reviewer": "李预审"
    }
    response = requests.post(f"{BASE_URL}/materials/review", json=review_data, headers=headers)
    app = response.json()
    print(f"  办件状态: {app['status']}")
    
    print("\n【7. 创建补正任务")
    task_data = {
        "application_id": app['id'],
        "application_material_id": app['materials'][1]['id'],
        "task_name": "补全申请表签字",
        "correction_content": "申请表第2页申请人签字处需本人签字确认",
        "assignee": "张三",
        "due_date": "2026-05-15T17:00:00"
    }
    response = requests.post(f"{BASE_URL}/correction-tasks", json=task_data, headers=headers)
    task = response.json()
    print(f"  任务ID: {task['id']}")
    print(f"  任务状态: {task['status']}")
    
    print("\n【8. 开始处理补正任务")
    response = requests.post(f"{BASE_URL}/correction-tasks/{task['id']}/start", headers=headers)
    task = response.json()
    print(f"  任务状态: {task['status']}")
    
    print("\n【9. 模拟任务失败")
    response = requests.post(f"{BASE_URL}/correction-tasks/{task['id']}/fail?error_message=补正材料上传失败，请检查网络", headers=headers)
    print(f"  失败: {response.json()}")
    
    print("\n【10. 重试失败任务")
    retry_data = {"task_id": task['id'], "operator": "系统管理员"}
    response = requests.post(f"{BASE_URL}/correction-tasks/retry", json=retry_data, headers=headers)
    task = response.json()
    print(f"  任务状态: {task['status']}")
    print(f"  重试次数: {task['retry_count']}")
    
    print("\n【11. 完成补正任务")
    response = requests.post(f"{BASE_URL}/correction-tasks/{task['id']}/complete", headers=headers)
    task = response.json()
    print(f"  任务状态: {task['status']}")
    
    print("\n【12. 查看办件详情")
    response = requests.get(f"{BASE_URL}/applications/{app['id']}", headers=headers)
    app = response.json()
    print(f"  办件状态: {app['status']}")
    print(f"  当前步骤: {app['current_step']}")
    
    print("\n【13. 重新开始预审（补正完成后")
    response = requests.post(f"{BASE_URL}/applications/{app['id']}/start-review?reviewer=李预审", headers=headers)
    app = response.json()
    print(f"  办件状态: {app['status']}")
    
    print("\n【14. 审核剩余材料 - 通过")
    for mat in app['materials']:
        if mat['status'] != "通过":
            review_data = {
                "application_material_id": mat['id'],
                "status": "通过",
                "review_result": "材料审核通过",
                "reviewer": "李预审"
            }
            response = requests.post(f"{BASE_URL}/materials/review", json=review_data, headers=headers)
    app = response.json()
    print(f"  最终办件状态: {app['status']}")
    
    print("\n【15. 查看办件历史")
    response = requests.get(f"{BASE_URL}/applications/{app['id']}/history", headers=headers)
    history = response.json()
    print(f"  状态变更记录:")
    for h in history:
        from_s = h.get('from_status', '无')
        print(f"    {h['created_at'][:19]}: {from_s} -> {h['to_status']} - {h['reason']}")
    
    print("\n【16. 查看汇总统计")
    response = requests.get(f"{BASE_URL}/applications/summary", headers=headers)
    summary = response.json()
    print(f"  办件汇总:")
    for key, value in summary.items():
        if value > 0:
            print(f"    {key}: {value}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)


if __name__ == "__main__":
    demo()
