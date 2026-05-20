import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_demo():
    print("=" * 60)
    print("晨检管理系统演示")
    print("=" * 60)
    
    print("\n1. 创建新批次")
    response = requests.post(
        f"{BASE_URL}/api/batches",
        json={"name": "2024年5月20日晨检", "created_by": "保健室张老师"}
    )
    batch = response.json()
    print(f"   批次创建成功: {batch['batch_number']}")
    batch_id = batch['id']
    
    time.sleep(0.5)
    
    print("\n2. 导入班级名单CSV")
    with open('sample_data/class_list.csv', 'rb') as f:
        response = requests.post(
            f"{BASE_URL}/api/batches/{batch_id}/import/class-list",
            files={'file': ('class_list.csv', f, 'text/csv')}
        )
    result = response.json()
    print(f"   {result['message']}")
    
    time.sleep(0.5)
    
    print("\n3. 导入用药授权JSON")
    with open('sample_data/medication.json', 'rb') as f:
        response = requests.post(
            f"{BASE_URL}/api/batches/{batch_id}/import/medication",
            files={'file': ('medication.json', f, 'application/json')}
        )
    result = response.json()
    print(f"   {result['message']}")
    
    time.sleep(0.5)
    
    print("\n4. 导入晨检CSV")
    with open('sample_data/morning_check.csv', 'rb') as f:
        response = requests.post(
            f"{BASE_URL}/api/batches/{batch_id}/import/morning-check",
            files={'file': ('morning_check.csv', f, 'text/csv')}
        )
    result = response.json()
    print(f"   {result['message']}")
    
    time.sleep(0.5)
    
    print("\n5. 获取批次所有记录")
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}/records")
    records = response.json()
    print(f"   共 {len(records)} 条记录")
    for rec in records[:3]:
        print(f"   - {rec['student_name']}: {rec['temperature']}℃, 状态: {rec['status']}")
    
    time.sleep(0.5)
    
    print("\n6. 校验记录并发现问题")
    record_id = records[1]['id']
    response = requests.get(f"{BASE_URL}/api/records/{record_id}/validate")
    validation = response.json()
    print(f"   记录 {records[1]['student_name']} 的校验结果:")
    for issue in validation['issues']:
        print(f"   - [{issue['severity']}] {issue['reason']}")
    
    time.sleep(0.5)
    
    print("\n7. 处理记录 - 隔离发热学生")
    response = requests.post(
        f"{BASE_URL}/api/records/{record_id}/process",
        json={
            "action": "isolate",
            "reason": "体温38.2℃，超过阈值，已通知家长，安排隔离观察",
            "handler": "保健室张老师",
            "details": "已联系家长，家长确认下午来接"
        }
    )
    result = response.json()
    print(f"   处理结果: {result['message']}, 新状态: {result['new_status']}")
    
    time.sleep(0.5)
    
    print("\n8. 处理记录 - 退回修正(缺少家长签名)")
    record_id_correction = records[2]['id']
    response = requests.post(
        f"{BASE_URL}/api/records/{record_id_correction}/process",
        json={
            "action": "return_for_correction",
            "reason": "缺少家长签名，需要补充",
            "handler": "保健室张老师",
            "details": "请家长签字确认后重新提交"
        }
    )
    result = response.json()
    print(f"   处理结果: {result['message']}, 新状态: {result['new_status']}")
    
    time.sleep(0.5)
    
    print("\n9. 处理记录 - 批准正常学生")
    record_id_approve = records[0]['id']
    response = requests.post(
        f"{BASE_URL}/api/records/{record_id_approve}/process",
        json={
            "action": "approve",
            "reason": "体温正常，症状无，家长已确认签字",
            "handler": "保健室张老师"
        }
    )
    result = response.json()
    print(f"   处理结果: {result['message']}, 新状态: {result['new_status']}")
    
    time.sleep(0.5)
    
    print("\n10. 查看记录的完整处理轨迹")
    response = requests.get(f"{BASE_URL}/api/records/{record_id}/logs")
    log_data = response.json()
    print(f"   学生: {log_data['record']['student_name']}")
    print(f"   当前状态: {log_data['record']['status']}")
    print(f"   处理日志:")
    for log in log_data['processing_logs']:
        print(f"   - {log['handled_at']} | {log['handler']} | 操作: {log['action']}")
        print(f"     原因: {log['reason']}")
    
    time.sleep(0.5)
    
    print("\n11. 按班主任查询历史记录")
    response = requests.get(
        f"{BASE_URL}/api/records/search",
        params={"class_teacher": "王老师"}
    )
    teacher_records = response.json()
    print(f"   王老师班级共有 {len(teacher_records)} 条记录")
    
    time.sleep(0.5)
    
    print("\n12. 查询需要隔离观察的记录")
    response = requests.get(
        f"{BASE_URL}/api/records/search",
        params={"need_isolation": "true"}
    )
    isolated_records = response.json()
    print(f"   需要隔离的记录共 {len(isolated_records)} 条")
    for rec in isolated_records:
        print(f"   - {rec['student_name']}: {rec['temperature']}℃")
    
    time.sleep(0.5)
    
    print("\n13. 导出筛选后的记录")
    response = requests.post(
        f"{BASE_URL}/api/records/export",
        json={"class_teacher": "王老师"}
    )
    print(f"   导出CSV成功，文件名包含记录数量")
    print(f"   CSV内容预览:")
    lines = response.text.split('\n')[:5]
    for line in lines:
        if line:
            print(f"   {line}")
    
    time.sleep(0.5)
    
    print("\n14. 查看所有批次列表")
    response = requests.get(f"{BASE_URL}/api/batches")
    batches = response.json()
    print(f"   共有 {len(batches)} 个批次")
    for b in batches:
        print(f"   - {b['batch_number']}: {b['name']} ({b['total_records']}条记录)")
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)

if __name__ == "__main__":
    test_demo()
