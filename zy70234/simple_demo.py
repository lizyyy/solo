#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"


def print_section(title):
    print("\n" + "-" * 50)
    print(title)
    print("-" * 50)


def main():
    print_section("1. 检查服务状态")
    response = requests.get(f"{BASE_URL}/")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

    print_section("2. 创建检查项目")
    projects = [
        {"name": "空腹抽血", "code": "BLOOD_FASTING", "project_type": "fasting"},
        {"name": "B超", "code": "ULTRASOUND", "project_type": "fasting"},
        {"name": "餐后血糖", "code": "BLOOD_POST", "project_type": "post_meal"},
    ]
    project_ids = {}
    for p in projects:
        resp = requests.post(f"{BASE_URL}/api/projects/", json=p)
        if resp.status_code == 200:
            data = resp.json()
            project_ids[p['code']] = data['id']
            print(f"创建成功: {data['name']} (ID: {data['id']})")
        else:
            print(f"创建失败或已存在: {p['name']}")

    print_section("3. 查看所有项目")
    response = requests.get(f"{BASE_URL}/api/projects/")
    for p in response.json():
        print(f"{p['name']}: {p['project_type']}")

    print_section("4. 创建患者")
    patient_resp = requests.post(f"{BASE_URL}/api/patients/", json={
        "name": "测试患者",
        "id_card": "123456789012345678",
        "phone": "13800138000"
    })
    if patient_resp.status_code == 200:
        patient = patient_resp.json()
        print(f"患者: {patient['name']} (ID: {patient['id']})")
    else:
        patients = requests.get(f"{BASE_URL}/api/patients/").json()
        patient = patients[0] if patients else None
        print(f"使用已有患者: {patient['name']}" if patient else "无法获取患者")

    if not patient:
        return

    print_section("5. 创建套餐")
    package_resp = requests.post(f"{BASE_URL}/api/packages/", json={
        "name": "测试套餐",
        "code": "TEST_PKG",
        "projects": [
            {"project_id": project_ids.get('BLOOD_FASTING', 1), "sort_order": 1},
            {"project_id": project_ids.get('ULTRASOUND', 2), "sort_order": 2},
            {"project_id": project_ids.get('BLOOD_POST', 3), "sort_order": 3},
        ]
    })
    if package_resp.status_code == 200:
        package = package_resp.json()
        print(f"套餐: {package['name']} (ID: {package['id']})")
    else:
        packages = requests.get(f"{BASE_URL}/api/packages/").json()
        package = packages[0] if packages else None
        print(f"使用已有套餐: {package['name']}" if package else "无法获取套餐")

    if not package:
        return

    print_section("6. 查看规则摘要")
    response = requests.get(f"{BASE_URL}/api/rules-summary")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))

    print_section("7. 测试规则: 餐后项目不能在空腹项目之前")
    response = requests.post(f"{BASE_URL}/api/queue-numbers/", json={
        "patient_id": patient['id'],
        "package_id": package['id'],
        "project_id": project_ids.get('BLOOD_POST', 3),
        "source": "demo_test"
    })
    print("尝试直接创建餐后项目排队号:")
    if response.status_code == 400:
        error = response.json()
        print(f"  ✓ 正确拒绝: {error['error_code']}")
        print(f"    原因: {error['error_message']}")
    else:
        print(f"  ✗ 不应成功，但创建成功了")

    print_section("8. 查看问题列表（脏数据记录）")
    response = requests.get(f"{BASE_URL}/api/queue-numbers/problems/")
    problems = response.json()
    print(f"问题记录数: {len(problems)}")
    for p in problems[:3]:
        print(f"  - {p['error_type']}: {p['error_message'][:50]}...")


if __name__ == "__main__":
    main()
