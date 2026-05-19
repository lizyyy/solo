#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def create_sample_visitors():
    print("=== 创建样例访客数据 ===")
    visitors = [
        {
            "name": "张三",
            "id_card": "110101199001011234",
            "phone": "13800138001",
            "company": "华为技术有限公司",
            "visit_purpose": "商务洽谈",
            "host_name": "李四",
            "host_department": "市场部",
            "expected_start": (datetime.now() - timedelta(hours=1)).isoformat(),
            "expected_end": (datetime.now() + timedelta(hours=3)).isoformat(),
            "license_plate": "京A12345",
            "gate_number": "东门",
            "responsible_person": "王队长",
            "notes": "重要客户"
        },
        {
            "name": "王五",
            "id_card": "310101199505055678",
            "phone": "13900139002",
            "company": "阿里巴巴集团",
            "visit_purpose": "项目对接",
            "host_name": "赵六",
            "host_department": "技术部",
            "expected_start": (datetime.now() + timedelta(days=1)).isoformat(),
            "expected_end": (datetime.now() + timedelta(days=1, hours=4)).isoformat(),
            "license_plate": "沪B88888",
            "gate_number": "南门",
            "responsible_person": "李队长",
            "notes": "技术团队"
        },
        {
            "name": "黑名单人员",
            "id_card": "440101198012129999",
            "phone": "13700137003",
            "company": "未知公司",
            "visit_purpose": "面试",
            "host_name": "孙七",
            "host_department": "人事部",
            "expected_start": (datetime.now() - timedelta(hours=2)).isoformat(),
            "expected_end": (datetime.now() + timedelta(hours=1)).isoformat(),
            "license_plate": "粤C66666",
            "gate_number": "西门",
            "responsible_person": "王队长",
            "notes": "已标记黑名单"
        },
        {
            "name": "过期预约",
            "id_card": "500101198808080000",
            "phone": "13600136004",
            "company": "腾讯科技",
            "visit_purpose": "参观",
            "host_name": "周八",
            "host_department": "行政部",
            "expected_start": (datetime.now() - timedelta(days=2)).isoformat(),
            "expected_end": (datetime.now() - timedelta(days=1)).isoformat(),
            "license_plate": "渝D77777",
            "gate_number": "北门",
            "responsible_person": "李队长",
            "notes": "已过期"
        }
    ]

    response = requests.post(f"{BASE_URL}/visitors/batch/", json=visitors)
    result = response.json()
    print(f"批量创建结果: 成功 {result['success_count']}, 失败 {result['failure_count']}")
    if result['failed']:
        print(f"失败项: {result['failed']}")
    return result


def create_sample_blacklist():
    print("\n=== 创建样例黑名单数据 ===")
    blacklist_entries = [
        {
            "identifier": "440101198012129999",
            "identifier_type": "id_card",
            "reason": "多次违规进入园区",
            "added_by": "系统管理员",
            "is_active": True,
            "notes": "永久黑名单"
        },
        {
            "identifier": "粤X99999",
            "identifier_type": "license_plate",
            "reason": "冲撞门岗逃逸",
            "added_by": "安保队长",
            "is_active": True,
            "notes": "高危车辆"
        }
    ]

    response = requests.post(f"{BASE_URL}/blacklist/batch/", json=blacklist_entries)
    result = response.json()
    print(f"批量创建结果: 成功 {result['success_count']}, 失败 {result['failure_count']}")
    if result['failed']:
        print(f"失败项: {result['failed']}")
    return result


def run_verification_scenarios():
    print("\n=== 运行核验场景测试 ===")
    scenarios = [
        {
            "name": "正常核验通过（张三）",
            "request": {
                "plate_number": "京A12345",
                "gate_number": "东门",
                "verified_by": "门岗1号"
            }
        },
        {
            "name": "黑名单身份证拦截",
            "request": {
                "id_card": "440101198012129999",
                "gate_number": "西门",
                "verified_by": "门岗2号"
            }
        },
        {
            "name": "错误门岗拦截",
            "request": {
                "plate_number": "京A12345",
                "gate_number": "西门",
                "verified_by": "门岗2号"
            }
        },
        {
            "name": "过期预约核验",
            "request": {
                "id_card": "500101198808080000",
                "gate_number": "北门",
                "verified_by": "门岗3号"
            }
        },
        {
            "name": "未预约人员核验",
            "request": {
                "id_card": "123456789012345678",
                "gate_number": "东门",
                "verified_by": "门岗1号"
            }
        },
        {
            "name": "尚未生效的预约",
            "request": {
                "plate_number": "沪B88888",
                "gate_number": "南门",
                "verified_by": "门岗4号"
            }
        }
    ]

    for scenario in scenarios:
        print(f"\n场景: {scenario['name']}")
        response = requests.post(f"{BASE_URL}/verify/", json=scenario['request'])
        result = response.json()
        print(f"  结果: {'成功' if result['success'] else '失败'}")
        print(f"  状态: {result['status']}")
        print(f"  异常类型: {result['exception_type']}")
        print(f"  消息: {result['message']}")
        print(f"  记录ID: {result['record_id']}")


def query_and_export():
    print("\n=== 查询核验记录并导出 ===")
    
    print("\n1. 查询王队长负责的所有记录:")
    params = {"responsible_person": "王队长"}
    response = requests.get(f"{BASE_URL}/verification-records/", params=params)
    records = response.json()
    print(f"   找到 {len(records)} 条记录")
    
    print("\n2. 查询所有被拒绝的记录:")
    params = {"status": "rejected"}
    response = requests.get(f"{BASE_URL}/verification-records/", params=params)
    records = response.json()
    print(f"   找到 {len(records)} 条被拒绝记录")
    
    print("\n3. 按异常类型查询（黑名单）:")
    params = {"exception_type": "blacklisted"}
    response = requests.get(f"{BASE_URL}/verification-records/", params=params)
    records = response.json()
    print(f"   找到 {len(records)} 条黑名单拦截记录")
    
    print("\n4. 导出所有核验记录到Excel:")
    response = requests.get(f"{BASE_URL}/verification-records/export/")
    if response.status_code == 200:
        with open("verification_records_export.xlsx", "wb") as f:
            f.write(response.content)
        print("   导出成功: verification_records_export.xlsx")
    else:
        print(f"   导出失败: {response.status_code}")


def get_system_stats():
    print("\n=== 系统统计信息 ===")
    response = requests.get(f"{BASE_URL}/stats/summary")
    stats = response.json()
    print(json.dumps(stats, indent=2, ensure_ascii=False))


def explain_rejection_reason():
    print("\n=== 解释拦截原因示例 ===")
    response = requests.get(f"{BASE_URL}/verification-records/", params={"exception_type": "blacklisted", "limit": 1})
    records = response.json()
    if records:
        record = records[0]
        print(f"记录ID: {record['id']}")
        print(f"拦截时间: {record['verified_at']}")
        print(f"身份证号: {record['id_card']}")
        print(f"门岗: {record['gate_number']}")
        print(f"异常类型: {record['exception_type']}")
        print(f"拦截原因: {record['exception_details']}")


if __name__ == "__main__":
    try:
        print("园区安保系统 - 样例数据导入和流程测试\n")
        create_sample_visitors()
        create_sample_blacklist()
        run_verification_scenarios()
        query_and_export()
        get_system_stats()
        explain_rejection_reason()
        print("\n=== 测试完成 ===")
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务: python main.py")
    except Exception as e:
        print(f"错误: {e}")
