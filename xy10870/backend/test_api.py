import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def test_create_students():
    print("\n=== 测试创建学生 ===")
    students = [
        {"student_id": "T001", "name": "测试学生1", "email": "test1@example.com"},
        {"student_id": "T002", "name": "测试学生2", "email": "test2@example.com"},
    ]
    for s in students:
        response = requests.post(f"{BASE_URL}/students/", json=s)
        print(f"创建学生 {s['student_id']}: {response.status_code}")

def test_create_languages():
    print("\n=== 测试创建语言环境 ===")
    langs = [
        {"name": "Python", "version": "3.11", "container_image": "python:3.11-slim"},
    ]
    for lang in langs:
        response = requests.post(f"{BASE_URL}/languages/", json=lang)
        print(f"创建语言 {lang['name']}: {response.status_code}")

def test_create_request():
    print("\n=== 测试创建运行请求 ===")
    
    students = requests.get(f"{BASE_URL}/students/").json()
    langs = requests.get(f"{BASE_URL}/languages/").json()
    
    if not students or not langs:
        print("没有学生或语言数据，请先运行 init_data.py")
        return
    
    request_data = {
        "student_id": students[0]["id"],
        "language_id": langs[0]["id"],
        "code_snippet": "print('Hello, World!')"
    }
    
    response = requests.post(f"{BASE_URL}/requests/", json=request_data)
    print(f"创建请求: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"请求ID: {data['request_id']}, 状态: {data['status']}")
        return data["request_id"]
    return None

def test_duplicate_request(request_id):
    print("\n=== 测试重复提交（合并功能）===")
    
    students = requests.get(f"{BASE_URL}/students/").json()
    langs = requests.get(f"{BASE_URL}/languages/").json()
    
    request_data = {
        "student_id": students[0]["id"],
        "language_id": langs[0]["id"],
        "code_snippet": "print('Hello, World!')"
    }
    
    response = requests.post(f"{BASE_URL}/requests/", json=request_data)
    print(f"重复提交请求: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"新请求状态: {data['status']}, 是否合并: {data['status'] == 'merged'}")

def test_get_requests():
    print("\n=== 测试查询请求列表 ===")
    response = requests.get(f"{BASE_URL}/requests/?page=1&page_size=10")
    print(f"查询请求: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"总数: {data['total']}, 当前页数量: {len(data['items'])}")

def test_get_request_detail(request_id):
    print(f"\n=== 测试查询请求详情: {request_id} ===")
    response = requests.get(f"{BASE_URL}/requests/{request_id}")
    print(f"查询详情: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"请求ID: {data['request_id']}, 状态: {data['status']}")

def test_get_timeline(request_id):
    print(f"\n=== 测试查询状态时间线: {request_id} ===")
    response = requests.get(f"{BASE_URL}/requests/{request_id}/timeline")
    print(f"查询时间线: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"时间线记录数: {len(data)}")
        for item in data[:3]:
            print(f"  - {item['to_status']}: {item.get('message', '')}")

def test_manual_fix(request_id):
    print(f"\n=== 测试人工修正状态 ===")
    update_data = {"status": "success", "stdout": "Manual fixed output"}
    response = requests.patch(
        f"{BASE_URL}/requests/{request_id}?manual=true",
        json=update_data
    )
    print(f"人工修正: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"新状态: {data['status']}, 人工标记: {data.get('created_by_manual', False)}")

def test_batch_import():
    print("\n=== 测试批量导入 ===")
    batch_data = {
        "items": [
            {"student_id": "S001", "language": "Python", "code_snippet": "print('Batch 1')"},
            {"student_id": "S002", "language": "Python", "code_snippet": "print('Batch 2')"},
            {"student_id": "S003", "language": "Python", "code_snippet": "print('Batch 3')"},
        ]
    }
    response = requests.post(f"{BASE_URL}/requests/batch-import", json=batch_data)
    print(f"批量导入: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"处理总数: {data['total']}")
        for result in data['results']:
            print(f"  - {result['student_id']}: {'成功' if result['success'] else '失败'}")

def test_report_stats():
    print("\n=== 测试报告统计 ===")
    response = requests.get(f"{BASE_URL}/report/stats?days=7")
    print(f"获取统计: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"总请求数: {data['total_requests']}")
        print(f"成功率: {data['success_rate']}%")
        print(f"平均执行时间: {data['avg_execution_time']}ms")

def test_quota_check():
    print("\n=== 测试配额检查 ===")
    response = requests.get(f"{BASE_URL}/students/S001/quota")
    print(f"检查配额: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"学生ID: {data['student_id']}")
        print(f"已用配额: {data['used_quota']}/{data['max_quota']}")
        print(f"剩余配额: {data['max_quota'] - data['used_quota']}")

def main():
    print("=" * 50)
    print("代码片段运行配额台 API 测试")
    print("=" * 50)
    
    try:
        response = requests.get("http://localhost:8000/api/health")
        if response.status_code != 200:
            print("API 服务未运行，请先启动服务")
            return
    except:
        print("无法连接到 API 服务，请先启动服务")
        return
    
    print("API 服务运行正常")
    
    test_create_students()
    test_create_languages()
    
    request_id = test_create_request()
    
    if request_id:
        time.sleep(2)
        test_duplicate_request(request_id)
        
        test_get_requests()
        test_get_request_detail(request_id)
        test_get_timeline(request_id)
        test_manual_fix(request_id)
    
    test_batch_import()
    test_report_stats()
    test_quota_check()
    
    print("\n" + "=" * 50)
    print("测试完成！")
    print("=" * 50)

if __name__ == "__main__":
    main()
