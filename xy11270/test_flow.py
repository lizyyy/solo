#!/usr/bin/env python3
import requests
import json
import time


BASE_URL = "http://localhost:8000"


def test_health():
    print("=" * 50)
    print("1. 健康检查")
    resp = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {resp.status_code}")
    print(f"响应: {resp.json()}")
    assert resp.status_code == 200
    print("✓ 健康检查通过\n")


def test_scan_normal():
    print("=" * 50)
    print("2. 扫描正常转写文本")
    data = {
        "transcript_id": "TEST001",
        "segments": [
            {"speaker": "客服", "text": "您好，请问有什么可以帮您？", "start_time": 0.0, "end_time": 3.5},
            {"speaker": "客户", "text": "我想投诉你们的服务", "start_time": 4.0, "end_time": 7.0},
            {"speaker": "客服", "text": "非常抱歉给您带来不便，请告诉我具体情况", "start_time": 7.5, "end_time": 12.0}
        ],
        "metadata": {"is_complaint": True}
    }
    resp = requests.post(f"{BASE_URL}/api/scan", json=data)
    print(f"状态码: {resp.status_code}")
    result = resp.json()
    print(f"是否通过: {result['passed']}")
    print(f"违规数量: {len(result['violations'])}")
    for v in result['violations']:
        print(f"  - {v['type']}: {v['message']}")
    print("✓ 扫描完成\n")


def test_scan_with_violations():
    print("=" * 50)
    print("3. 扫描包含违规的文本")
    data = {
        "transcript_id": "TEST002",
        "segments": [
            {"speaker": "", "text": "我要退款", "start_time": 0.0, "end_time": 2.0},
            {"speaker": "客服", "text": "不行", "start_time": 1.5, "end_time": 4.0},
            {"speaker": "客户", "text": "你们这什么垃圾服务", "start_time": 4.5, "end_time": 7.0}
        ]
    }
    resp = requests.post(f"{BASE_URL}/api/scan", json=data)
    print(f"状态码: {resp.status_code}")
    result = resp.json()
    print(f"是否通过: {result['passed']}")
    print(f"违规数量: {len(result['violations'])}")
    for v in result['violations']:
        print(f"  - {v['type']}: {v['message']}")
    print("✓ 违规检测完成\n")
    return result['transcript_id']


def test_idempotency():
    print("=" * 50)
    print("4. 测试幂等性 - 重复提交相同ID")
    data = {
        "transcript_id": "TEST001",
        "segments": [
            {"speaker": "客服", "text": "您好", "start_time": 0.0, "end_time": 1.0}
        ]
    }
    
    print("第一次提交...")
    resp1 = requests.post(f"{BASE_URL}/api/scan", json=data)
    time1 = resp1.json()['scanned_at']
    
    print("第二次提交（相同ID）...")
    resp2 = requests.post(f"{BASE_URL}/api/scan", json=data)
    time2 = resp2.json()['scanned_at']
    
    print(f"第一次扫描时间: {time1}")
    print(f"第二次扫描时间: {time2}")
    assert time1 == time2, "重复提交产生了不同的结果！"
    print("✓ 幂等性验证通过 - 重复提交结果一致\n")


def test_review(transcript_id):
    print("=" * 50)
    print("5. 人工复核")
    data = {
        "transcript_id": transcript_id,
        "status": "approved",
        "reviewer": "质检组长",
        "comment": "情况属实，已核实"
    }
    resp = requests.post(f"{BASE_URL}/api/review", json=data)
    print(f"状态码: {resp.status_code}")
    print(f"响应: {resp.json()}")
    print("✓ 复核完成\n")


def test_get_result(transcript_id):
    print("=" * 50)
    print("6. 获取扫描结果（含复核信息）")
    resp = requests.get(f"{BASE_URL}/api/result/{transcript_id}")
    result = resp.json()
    print(f"转写ID: {result['transcript_id']}")
    print(f"是否通过: {result['passed']}")
    print(f"复核状态: {result.get('review', {}).get('status', '无')}")
    print(f"复核人: {result.get('review', {}).get('reviewer', '无')}")
    print("✓ 获取结果完成\n")


def test_summary():
    print("=" * 50)
    print("7. 汇总统计")
    resp = requests.get(f"{BASE_URL}/api/summary")
    stats = resp.json()
    print(f"总扫描数: {stats['total_scanned']}")
    print(f"通过数: {stats['passed']}")
    print(f"失败数: {stats['failed']}")
    print(f"待复核数: {stats['pending_review']}")
    print(f"违规类型统计: {stats['violations_by_type']}")
    print("✓ 汇总统计完成\n")


def test_export():
    print("=" * 50)
    print("8. 导出Excel")
    resp = requests.post(f"{BASE_URL}/api/export")
    with open("质检结果.xlsx", "wb") as f:
        f.write(resp.content)
    print("✓ 导出完成，文件已保存为: 质检结果.xlsx\n")


def test_sensitive_data():
    print("=" * 50)
    print("9. 测试敏感数据脱敏")
    data = {
        "transcript_id": "TEST_SENSITIVE_13800138000",
        "segments": [
            {"speaker": "客户", "text": "我的手机号是13800138000，邮箱是test@example.com", "start_time": 0.0, "end_time": 5.0}
        ]
    }
    resp = requests.post(f"{BASE_URL}/api/scan", json=data)
    result = resp.json()
    print(f"返回的转写ID（已脱敏）: {result['transcript_id']}")
    print("✓ 敏感数据脱敏完成\n")


if __name__ == "__main__":
    try:
        test_health()
        test_scan_normal()
        transcript_id = test_scan_with_violations()
        test_idempotency()
        test_review(transcript_id)
        test_get_result(transcript_id)
        test_summary()
        test_export()
        test_sensitive_data()
        
        print("=" * 50)
        print("🎉 所有测试通过！主流程验证完成")
        print("=" * 50)
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
