import requests
import json

BASE_URL = "http://localhost:8000"


def test_health_check():
    print("=" * 60)
    print("1. 健康检查")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/health")
    print(f"响应: {response.json()}")
    print()


def test_submit_material():
    print("=" * 60)
    print("2. 提交新材料")
    print("=" * 60)
    data = {
        "submitter": "张三",
        "department": "技术部",
        "benefit_type": "节日福利",
        "beneficiary": "李四",
        "beneficiary_id_card": "110101199001011234",
        "amount": 50000,
        "application_date": "2024-05-01",
        "description": "五一劳动节福利申请",
        "raw_materials": {
            "application_form": "申请书.pdf",
            "id_card_copy": "身份证复印件.jpg",
            "employee_proof": "在职证明.pdf",
            "approval_chain": ["部门主管", "工会主席"],
        },
    }
    response = requests.post(f"{BASE_URL}/api/submissions", json=data)
    result = response.json()
    print(f"提交结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    print()
    return result["submission"]["id"], result["verification_result"]


def test_duplicate_submit():
    print("=" * 60)
    print("3. 重复提交同一批材料（测试幂等性")
    print("=" * 60)
    data = {
        "submitter": "张三",
        "department": "技术部",
        "benefit_type": "节日福利",
        "beneficiary": "李四",
        "beneficiary_id_card": "110101199001011234",
        "amount": 50000,
        "application_date": "2024-05-01",
        "description": "五一劳动节福利申请-重复提交",
        "raw_materials": {
            "application_form": "申请书_v2.pdf",
            "id_card_copy": "身份证复印件.jpg",
        },
    }
    response = requests.post(f"{BASE_URL}/api/submissions", json=data)
    result = response.json()
    print(f"重复提交结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    print(f"是否重复: {result['is_duplicate']}")
    print()


def test_update_conclusion(record_id):
    print("=" * 60)
    print("4. 修改审核结论")
    print("=" * 60)
    data = {
        "operator": "王五",
        "conclusion": "审核不通过",
        "reason": "材料不完整，缺少医院证明未提交",
        "review_notes": "需要补充医疗证明材料",
    }
    response = requests.put(f"{BASE_URL}/api/verifications/{record_id}", json=data)
    result = response.json()
    print(f"修改结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    print()


def test_update_conclusion_again(record_id):
    print("=" * 60)
    print("5. 再次修改审核结论")
    print("=" * 60)
    data = {
        "operator": "赵六",
        "conclusion": "审核通过（补充材料后）",
        "reason": "已补充完整的医疗证明材料，符合福利申领条件",
        "review_notes": "补充材料已审核通过",
    }
    response = requests.put(f"{BASE_URL}/api/verifications/{record_id}", json=data)
    result = response.json()
    print(f"修改结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    print()


def test_get_trace(submission_id):
    print("=" * 60)
    print("6. 查询数据追溯和审计日志")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/submissions/{submission_id}/trace")
    result = response.json()
    print(f"追溯详情: {json.dumps(result, ensure_ascii=False, indent=2)}")
    print()


def test_list_audit_logs(submission_id):
    print("=" * 60)
    print("7. 列出所有审计日志")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/audit-logs", params={"submission_id": submission_id})
    logs = response.json()
    print(f"审计日志列表:")
    for log in logs:
        print(
            f"  - [{log['created_at']}] {log['operator']} {log['operation']} "
            f"{log.get('field_name', '')}: "
            f"{log.get('old_value', '')} -> {log.get('new_value', '')}"
        )
        print(f"    原因: {log['reason']}")
    print()


def test_list_submissions():
    print("=" * 60)
    print("8. 列出所有提交记录")
    print("=" * 60)
    response = requests.get(f"{BASE_URL}/api/submissions")
    submissions = response.json()
    print(f"共 {len(submissions)} 条提交记录")
    for s in submissions:
        print(f"  - ID: {s['id']}, 提交人: {s['submitter']}, 受益人: {s['beneficiary']}, 金额: {s['amount']}分")
    print()


if __name__ == "__main__":
    try:
        test_health_check()
        submission_id, verification = test_submit_material()
        test_duplicate_submit()
        test_update_conclusion(1)
        test_update_conclusion_again(1)
        test_get_trace(submission_id)
        test_list_audit_logs(submission_id)
        test_list_submissions()

        print("=" * 60)
        print("所有测试完成！")
        print("=" * 60)
    except requests.exceptions.ConnectionError:
        print("错误：无法连接到服务器。请先启动服务：uvicorn main:app --reload")
