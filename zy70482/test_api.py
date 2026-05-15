import requests
import json

BASE_URL = "http://localhost:8001"

def test_submit_materials():
    print("=== 1. 提交测试材料 ===")
    batch_id = "test_batch_001"
    
    materials = [
        {
            "batch_id": batch_id,
            "file_name": "法务证据_全部通过.txt",
            "file_summary": "灰度发布-法务合规证据",
            "content": "用户协议检查成功\n隐私政策检查通过\n数据处理合规PASS"
        },
        {
            "batch_id": batch_id,
            "file_name": "法务证据_半成功.txt",
            "file_summary": "灰度发布-法务合规证据",
            "content": "用户协议检查成功\n隐私政策检查失败\n数据处理合规PASS"
        },
        {
            "batch_id": batch_id,
            "file_name": "法务证据_全部失败.txt",
            "file_summary": "灰度发布-法务合规证据",
            "content": "用户协议检查失败\n隐私政策检查失败\n数据处理合规失败"
        }
    ]
    
    response = requests.post(
        f"{BASE_URL}/api/materials/batch",
        json={"batch_id": batch_id, "materials": materials}
    )
    print(f"批量提交结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.json()


def test_list_materials():
    print("\n=== 2. 查询材料列表 ===")
    response = requests.get(f"{BASE_URL}/api/materials/")
    print(f"材料列表: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    return response.json()


def test_filter_by_summary():
    print("\n=== 3. 按文件摘要过滤 ===")
    response = requests.get(f"{BASE_URL}/api/materials/", params={"file_summary": "灰度发布"})
    print(f"过滤结果数量: {len(response.json())}")


def test_evaluation_detail(material_id):
    print(f"\n=== 4. 查看材料 {material_id} 的评估详情 ===")
    response = requests.get(f"{BASE_URL}/api/evaluations/material/{material_id}")
    evaluations = response.json()
    for eval in evaluations:
        print(f"评估结果: {eval['result']}, 失败路径: {eval.get('failure_path', '无')}")
        print(f"成功/总数: {eval['success_count']}/{eval['total_count']}")
    return evaluations[0] if evaluations else None


def test_manual_correction(material_id, evaluation_id):
    print("\n=== 5. 人工修正 ===")
    response = requests.post(
        f"{BASE_URL}/api/corrections/",
        json={
            "material_id": material_id,
            "evaluation_id": evaluation_id,
            "operator": "审核员张三",
            "corrected_result": "pass",
            "remark": "经人工复核，该证据实际上符合要求"
        }
    )
    print(f"修正结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def test_confirm_evaluation(evaluation_id):
    print("\n=== 6. 人工确认评估 ===")
    response = requests.post(
        f"{BASE_URL}/api/evaluations/{evaluation_id}/confirm",
        json={"operator": "审核员张三", "confirmed": True}
    )
    print(f"确认结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def test_candidate_list(material_ids):
    print("\n=== 7. 创建候选清单（批量删除） ===")
    response = requests.post(
        f"{BASE_URL}/api/operations/candidates",
        json={
            "operation_type": "delete",
            "name": "清理测试数据",
            "target_ids": material_ids
        }
    )
    candidate = response.json()
    print(f"候选清单ID: {candidate['id']}")
    
    print("\n=== 8. 预览批量操作影响 ===")
    response = requests.get(f"{BASE_URL}/api/operations/candidates/{candidate['id']}/preview")
    preview = response.json()
    print(f"影响数量: {preview['affected_count']}")
    print(f"影响材料: {[m['file_name'] for m in preview['affected_materials']]}")
    
    return candidate['id']


def test_duplicate_submit():
    print("\n=== 9. 测试重复提交（复用旧结论） ===")
    batch_id = "test_batch_001"
    materials = [{
        "batch_id": batch_id,
        "file_name": "法务证据_全部通过.txt",
        "file_summary": "灰度发布-法务合规证据",
        "content": "用户协议检查成功\n隐私政策检查通过\n数据处理合规PASS"
    }]
    
    response = requests.post(
        f"{BASE_URL}/api/materials/batch",
        json={"batch_id": batch_id, "materials": materials}
    )
    result = response.json()
    print(f"复用数量: {result['reused_count']}, 冲突数量: {result['conflict_count']}")


def test_operation_logs():
    print("\n=== 10. 查看操作日志 ===")
    response = requests.get(f"{BASE_URL}/api/operations/logs", params={"limit": 5})
    logs = response.json()
    for log in logs[:3]:
        print(f"[{log['operation_type']}] {log['operator']}: {log['remark']}")


if __name__ == "__main__":
    # 1. 提交材料
    batch_result = test_submit_materials()
    material_ids = [m['id'] for m in batch_result['materials']]
    
    # 2. 列出材料
    materials = test_list_materials()
    
    # 3. 按摘要过滤
    test_filter_by_summary()
    
    # 4. 查看评估详情
    first_material_id = material_ids[1]  # 半成功的材料
    evaluation = test_evaluation_detail(first_material_id)
    
    # 5. 人工修正
    if evaluation:
        test_manual_correction(first_material_id, evaluation['id'])
    
    # 6. 人工确认
    if evaluation:
        test_confirm_evaluation(evaluation['id'])
    
    # 9. 重复提交测试
    test_duplicate_submit()
    
    # 10. 操作日志
    test_operation_logs()
    
    # 7-8. 候选清单（最后执行，避免删除测试数据）
    candidate_id = test_candidate_list(material_ids[:1])
    print(f"\n提示: 如需执行删除，请调用 POST /api/operations/candidates/{candidate_id}/execute")
    
    print("\n=== 测试完成 ===")
    print(f"API文档地址: http://localhost:8001/docs")
