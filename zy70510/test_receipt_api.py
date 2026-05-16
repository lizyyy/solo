#!/usr/bin/env python3
import sys
import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_health_check():
    print_section("1. 健康检查")
    try:
        response = requests.get("http://127.0.0.1:8000/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"连接失败: {e}")
        print("请先启动服务: python main.py")
        return False


def test_create_receipt():
    print_section("2. 测试创建收据")

    idempotent_key = f"test_batch_{int(time.time())}"

    payload = {
        "batch_name": "用户批量导入测试",
        "trigger_source": "api",
        "idempotent_key": idempotent_key,
        "original_input": {
            "file_name": "users_20240115.xlsx",
            "upload_time": "2024-01-15 10:30:00",
            "operator": "admin"
        },
        "items": [
            {"item_key": "user_001", "name": "张三", "email": "zhangsan@test.com"},
            {"item_key": "user_002", "name": "李四", "email": "lisi@test.com"},
            {"item_key": "user_003", "name": "王五", "email": "wangwu@test.com"}
        ],
        "operator": "admin",
        "remark": "首次导入测试"
    }

    print(f"请求数据: {json.dumps(payload, ensure_ascii=False, indent=2)}")
    response = requests.post(f"{BASE_URL}/receipts", json=payload)
    print(f"\n状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] in [200, 201]:
        receipt_no = result["data"]["receipt_no"]
        batch_id = result["data"]["batch_id"]
        print(f"\n✅ 创建成功! 收据编号: {receipt_no}, 批次ID: {batch_id}")
        return receipt_no, batch_id, idempotent_key
    else:
        print("\n❌ 创建失败")
        return None, None, None


def test_duplicate_request(idempotent_key):
    print_section("3. 测试重复请求（幂等性验证）")

    payload = {
        "batch_name": "重复导入测试",
        "trigger_source": "scheduler",
        "idempotent_key": idempotent_key,
        "original_input": {
            "file_name": "users_20240115.xlsx",
            "duplicate": True
        },
        "items": [
            {"item_key": "user_001", "name": "张三"},
            {"item_key": "user_002", "name": "李四"}
        ]
    }

    print(f"使用相同幂等键再次请求: {idempotent_key}")
    response = requests.post(f"{BASE_URL}/receipts", json=payload)
    print(f"\n状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["data"].get("is_duplicate"):
        print("\n✅ 幂等性验证通过! 重复请求被正确识别并返回已有收据")
        return True
    else:
        print("\n❌ 幂等性验证失败!")
        return False


def test_query_by_idempotent(idempotent_key):
    print_section("4. 测试根据幂等键查询")

    response = requests.get(f"{BASE_URL}/receipts/idempotent/{idempotent_key}")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        print("\n✅ 幂等键查询成功")
        return True
    return False


def test_update_details(batch_id):
    print_section("5. 测试更新处理明细")

    payload = [
        {
            "item_key": "user_001",
            "status": "success",
            "result_data": {"user_id": 1001, "status": "created"},
            "processing_basis": {"rule": "auto_create", "version": "v1.0"}
        },
        {
            "item_key": "user_002",
            "status": "success",
            "result_data": {"user_id": 1002, "status": "created"},
            "processing_basis": {"rule": "auto_create", "version": "v1.0"}
        },
        {
            "item_key": "user_003",
            "status": "failed",
            "error_message": "邮箱格式不符合要求",
            "processing_basis": {"rule": "email_validation", "version": "v1.0"}
        }
    ]

    print(f"更新明细数据: {json.dumps(payload, ensure_ascii=False, indent=2)}")
    response = requests.patch(f"{BASE_URL}/receipts/{batch_id}/details", json=payload)
    print(f"\n状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        success_count = result["data"]["success_count"]
        failed_count = result["data"]["failed_count"]
        print(f"\n✅ 明细更新成功! 成功: {success_count}, 失败: {failed_count}")
        return True
    return False


def test_update_status(batch_id):
    print_section("6. 测试推进批次状态")

    payload = {
        "status": "success",
        "result_snapshot": {
            "total": 3,
            "success": 2,
            "failed": 1,
            "duration_seconds": 5.2
        },
        "operator": "system"
    }

    print(f"更新批次状态为: success")
    response = requests.patch(f"{BASE_URL}/receipts/{batch_id}/status", json=payload)
    print(f"\n状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        print(f"\n✅ 批次状态更新成功! 当前状态: {result['data']['status']}")
        return True
    return False


def test_get_details(batch_id):
    print_section("7. 测试获取处理明细")

    response = requests.get(f"{BASE_URL}/receipts/{batch_id}/details")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        print(f"\n✅ 获取明细成功! 共 {len(result['data'])} 条记录")
        return True
    return False


def test_manual_fix(receipt_no):
    print_section("8. 测试人工修正")

    payload = {
        "receipt_no": receipt_no,
        "final_conclusion": "经人工核查，user_003数据虽格式有误，但为历史遗留问题，予以特殊通过。整体批次标记为完成。",
        "result_summary": {
            "total": 3,
            "success": 3,
            "failed": 0,
            "manual_fixed": True
        },
        "operator": "manager",
        "detail_fixes": [
            {
                "item_key": "user_003",
                "status": "success",
                "result_data": {"user_id": 1003, "status": "manual_approved"},
                "processing_basis": {"rule": "manual_exception", "approved_by": "manager"}
            }
        ]
    }

    print(f"人工修正收据: {receipt_no}")
    response = requests.post(f"{BASE_URL}/receipts/manual-fix", json=payload)
    print(f"\n状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        print(f"\n✅ 人工修正成功! 最终状态: {result['data']['status']}")
        return True
    return False


def test_query_list():
    print_section("9. 测试分页查询列表")

    payload = {
        "page": 1,
        "page_size": 10
    }

    response = requests.post(f"{BASE_URL}/receipts/query", json=payload)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        print(f"\n✅ 列表查询成功! 共 {result['data']['total']} 条记录")
        return True
    return False


def test_export():
    print_section("10. 测试导出功能")

    payload = {
        "query": {
            "page": 1,
            "page_size": 100
        },
        "export_format": "xlsx",
        "include_details": True
    }

    print("正在导出数据...")
    response = requests.post(f"{BASE_URL}/receipts/export", json=payload)
    print(f"状态码: {response.status_code}")

    if response.status_code == 200:
        content_disposition = response.headers.get('Content-Disposition', '')
        print(f"响应头: {content_disposition}")
        print(f"文件大小: {len(response.content)} bytes")

        with open("test_export_result.xlsx", "wb") as f:
            f.write(response.content)
        print("文件已保存为: test_export_result.xlsx")
        print("\n✅ 导出成功!")
        return True
    return False


def test_stats():
    print_section("11. 测试统计数据")

    response = requests.get(f"{BASE_URL}/stats")
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")

    if result["code"] == 200:
        print(f"\n✅ 统计查询成功!")
        return True
    return False


def main():
    print("\n" + "="*60)
    print("  任务幂等收据API 集成测试")
    print("="*60)

    if not test_health_check():
        sys.exit(1)

    receipt_no, batch_id, idempotent_key = test_create_receipt()
    if not receipt_no:
        sys.exit(1)

    results = []
    results.append(("重复请求幂等性", test_duplicate_request(idempotent_key)))
    results.append(("幂等键查询", test_query_by_idempotent(idempotent_key)))
    results.append(("更新明细", test_update_details(batch_id)))
    results.append(("推进状态", test_update_status(batch_id)))
    results.append(("获取明细", test_get_details(batch_id)))
    results.append(("人工修正", test_manual_fix(receipt_no)))
    results.append(("列表查询", test_query_list()))
    results.append(("导出功能", test_export()))
    results.append(("统计数据", test_stats()))

    print_section("测试结果汇总")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    print(f"通过: {passed}/{total}")
    print()
    for name, r in results:
        status = "✅ PASS" if r else "❌ FAIL"
        print(f"  {status} - {name}")

    if passed == total:
        print("\n🎉 所有测试通过!")
    else:
        print(f"\n⚠️  {total - passed} 项测试未通过")
        sys.exit(1)


if __name__ == "__main__":
    main()
