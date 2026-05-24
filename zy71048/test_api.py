#!/usr/bin/env python3
import httpx
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"
client = httpx.Client(trust_env=False)


def test_create_plan():
    print("=== 测试创建爆破计划 ===")
    plan_data = {
        "business_no": f"BLST{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "quarry_name": "青石采石场",
        "blast_time": (datetime.now() + timedelta(days=3)).isoformat(),
        "expected_blast_volume": 500.0,
        "safety_measures": "设置警戒线、人员疏散、设备检查",
        "wind_direction": "北",
        "wind_speed": 5.0,
        "created_by": "张三",
        "remark": "常规爆破作业",
        "zones": [
            {
                "zone_name": "核心警戒区",
                "boundary_description": "以爆破点为中心，半径200米范围内",
                "radius_meters": 200.0
            },
            {
                "zone_name": "外围警戒区",
                "boundary_description": "核心警戒区外延300米范围",
                "radius_meters": 500.0
            }
        ],
        "notices": [
            {
                "notice_type": "施工队",
                "recipient_name": "基建工程队",
                "contact_phone": "13800138001",
                "address": "采石场东侧工棚",
                "notice_content": "请于爆破前1小时撤离作业区"
            },
            {
                "notice_type": "村委",
                "recipient_name": "东山村村委会",
                "contact_phone": "010-12345678",
                "address": "东山村委办公楼",
                "notice_content": "请通知村民注意安全"
            }
        ]
    }

    try:
        response = client.post(f"{BASE_URL}/plans/", json=plan_data)
        print(f"状态码: {response.status_code}")
        if response.status_code == 201:
            data = response.json()
            print(f"创建成功! 计划ID: {data['id']}")
            print(f"业务编号: {data['business_no']}")
            print(f"当前状态: {data['status']}")
            return data['id'], data['business_no']
        else:
            print(f"错误: {response.json()}")
    except Exception as e:
        print(f"请求失败: {e}")
    return None, None


def test_submit_plan(plan_id):
    print("\n=== 测试提交爆破计划 ===")
    try:
        response = client.post(f"{BASE_URL}/plans/{plan_id}/submit?operator=李四")
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"新状态: {data.get('status')}")
        if data.get('audits'):
            print(f"最近操作: {data['audits'][-1]['detail']}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_get_plan(plan_id):
    print("\n=== 测试查询计划详情 ===")
    try:
        response = client.get(f"{BASE_URL}/plans/{plan_id}")
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"业务编号: {data['business_no']}")
        print(f"采石场: {data['quarry_name']}")
        print(f"状态: {data['status']}")
        print(f"警戒区数量: {len(data['zones'])}")
        print(f"通知对象数量: {len(data['notices'])}")
        print(f"回执数量: {len(data['receipts'])}")
        print(f"审计日志数量: {len(data['audits'])}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_add_receipt(plan_id):
    print("\n=== 测试添加回执 ===")
    try:
        response = client.get(f"{BASE_URL}/plans/{plan_id}")
        data = response.json()
        if not data['notices']:
            print("没有通知对象")
            return

        notice_id = data['notices'][0]['id']
        receipt_data = {
            "notice_id": notice_id,
            "recipient_name": "基建工程队-王队长",
            "confirmed_at": datetime.now().isoformat(),
            "confirm_method": "电话确认",
            "remark": "已收到通知，将按时撤离"
        }

        response = client.post(f"{BASE_URL}/plans/{plan_id}/receipts", json=receipt_data)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            print("回执添加成功!")
        else:
            print(f"响应: {response.json()}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_exception_split():
    print("\n=== 测试异常拆分 ===")
    try:
        response = client.get(f"{BASE_URL}/exceptions/split")
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"风向异常: {len(data['wind_exceptions'])} 个")
        print(f"回执异常: {len(data['receipt_exceptions'])} 个")
        print(f"警戒区变更: {len(data['zone_exceptions'])} 个")
        print(f"待复核: {len(data['normal_plans'])} 个")
    except Exception as e:
        print(f"请求失败: {e}")


def test_get_audit_trail(plan_id):
    print("\n=== 测试审计轨迹 ===")
    try:
        response = client.get(f"{BASE_URL}/plans/{plan_id}/audit-trail")
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"业务编号: {data['business_no']}")
        print(f"当前状态: {data['current_status']}")
        print("审计日志:")
        for log in data['audit_logs']:
            print(f"  [{log['created_at']}] {log['action']} - {log['detail']}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_review_plan(plan_id, approve: bool = True):
    print("\n=== 测试复核计划 ===")
    try:
        review_data = {
            "operator": "王五",
            "review_comment": "复核通过，材料齐全",
            "approve": approve
        }
        response = client.post(f"{BASE_URL}/plans/{plan_id}/review", json=review_data)
        print(f"状态码: {response.status_code}")
        data = response.json()
        if response.status_code == 200:
            print(f"新状态: {data.get('status')}")
            print(f"操作成功")
        else:
            print(f"错误码: {data.get('error_code')}")
            print(f"消息: {data.get('message')}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_export_plan(plan_id):
    print("\n=== 测试导出单条计划 ===")
    try:
        response = client.get(f"{BASE_URL}/plans/{plan_id}/export")
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            content_disposition = response.headers.get('Content-Disposition', '')
            print(f"Content-Disposition: {content_disposition}")
            print(f"文件大小: {len(response.content)} bytes")
            print("导出成功!")
        else:
            print(f"响应: {response.json()}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_export_batch():
    print("\n=== 测试批量导出 ===")
    try:
        response = client.get(f"{BASE_URL}/export/batch")
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            content_disposition = response.headers.get('Content-Disposition', '')
            print(f"Content-Disposition: {content_disposition}")
            print(f"文件大小: {len(response.content)} bytes")
            print("导出成功!")
        else:
            print(f"响应: {response.json()}")
    except Exception as e:
        print(f"请求失败: {e}")


def test_duplicate_business_no(business_no):
    print("\n=== 测试重复业务编号 ===")
    plan_data = {
        "business_no": business_no,
        "quarry_name": "测试采石场",
        "blast_time": (datetime.now() + timedelta(days=1)).isoformat(),
        "expected_blast_volume": 100.0,
        "zones": [
            {
                "zone_name": "测试区",
                "boundary_description": "测试",
                "radius_meters": 100.0
            }
        ],
        "notices": [
            {
                "notice_type": "施工队",
                "recipient_name": "测试队"
            }
        ]
    }

    try:
        response = client.post(f"{BASE_URL}/plans/", json=plan_data)
        print(f"状态码: {response.status_code}")
        data = response.json()
        print(f"错误码: {data.get('error_code')}")
        print(f"消息: {data.get('message')}")
        if data.get('error_details'):
            print(f"详情: {data['error_details']}")
    except Exception as e:
        print(f"请求失败: {e}")


def main():
    print("采石场爆破通知 API 测试脚本")
    print("=" * 50)

    plan_id, business_no = test_create_plan()
    if not plan_id:
        print("创建计划失败，终止测试")
        return

    test_get_plan(plan_id)
    test_submit_plan(plan_id)
    test_get_plan(plan_id)
    test_add_receipt(plan_id)
    test_get_plan(plan_id)
    test_review_plan(plan_id, approve=True)
    test_get_plan(plan_id)
    test_export_plan(plan_id)
    test_export_batch()
    test_exception_split()
    test_get_audit_trail(plan_id)
    test_duplicate_business_no(business_no)

    print("\n" + "=" * 50)
    print("测试完成!")
    print(f"Swagger 文档: http://localhost:8000/docs")


if __name__ == "__main__":
    main()
