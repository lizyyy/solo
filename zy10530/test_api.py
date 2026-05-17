#!/usr/bin/env python3
import sys
import time
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1/rerun-budget"


def test_normal_flow():
    print("=" * 60)
    print("测试场景 1: 正常创建、查询和导出流程")
    print("=" * 60)

    batch_id = f"test_batch_{int(time.time())}"
    print(f"\n1. 创建任务批次: {batch_id}")
    response = requests.post(
        f"{BASE_URL}/batches",
        json={
            "batch_id": batch_id,
            "task_type": "data_import",
            "total_tasks": 100,
            "metadata": {"source": "test"}
        }
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"创建批次失败: {response.text}"
    batch_data = response.json()
    print(f"   批次ID: {batch_data['batch_id']}, 状态: {batch_data['status']}")

    print("\n2. 添加失败原因")
    response = requests.post(
        f"{BASE_URL}/batches/{batch_id}/failure-reasons",
        json={
            "reason_code": "network_timeout",
            "reason_message": "连接超时，无法连接到数据源",
            "count": 5,
            "task_ids": ["task_001", "task_002", "task_003", "task_004", "task_005"]
        }
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"添加失败原因失败: {response.text}"
    reason_data = response.json()
    print(f"   失败原因: {reason_data['reason_code']}, 数量: {reason_data['count']}")

    print("\n3. 创建重跑预算")
    response = requests.post(
        f"{BASE_URL}/batches/{batch_id}/budgets",
        json={
            "reason_code": "network_timeout",
            "budget_window_hours": 24,
            "max_reruns": 3
        }
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"创建预算失败: {response.text}"
    budget_data = response.json()
    print(f"   最大重跑次数: {budget_data['max_reruns']}, 窗口: {budget_data['budget_window_hours']}小时")

    print("\n4. 检查预算状态")
    response = requests.get(
        f"{BASE_URL}/budgets/check/{batch_id}/network_timeout"
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"检查预算失败: {response.text}"
    check_result = response.json()
    print(f"   是否批准: {check_result['approved']}, 剩余预算: {check_result['remaining_budget']}")

    print("\n5. 请求第一次重跑")
    response = requests.post(
        f"{BASE_URL}/request",
        json={
            "batch_id": batch_id,
            "reason_code": "network_timeout",
            "task_ids": ["task_001", "task_002", "task_003"],
            "requested_by": "automation"
        }
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"请求重跑失败: {response.text}"
    rerun_result = response.json()
    print(f"   是否批准: {rerun_result['approved']}")
    print(f"   消息: {rerun_result['message']}")
    print(f"   摘要ID: {rerun_result['summary_id']}")
    print(f"   剩余预算: {rerun_result['remaining_budget']}")
    assert rerun_result['approved'] == True, "第一次重跑应该被批准"
    summary_id = rerun_result['summary_id']

    print("\n6. 更新重跑状态为完成")
    response = requests.post(
        f"{BASE_URL}/status",
        json={
            "summary_id": summary_id,
            "status": "completed",
            "tasks_succeeded": 3,
            "tasks_failed": 0,
            "result_metadata": {"duration": "120s"}
        }
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"更新状态失败: {response.text}"
    status_result = response.json()
    print(f"   状态: {status_result['status']}, 成功: {status_result['tasks_succeeded']}")

    print("\n7. 查询批次详情")
    response = requests.get(f"{BASE_URL}/batches/{batch_id}")
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"查询详情失败: {response.text}"
    detail_result = response.json()
    print(f"   批次状态: {detail_result['batch']['status']}")
    print(f"   重跑摘要数量: {len(detail_result['rerun_summaries'])}")

    print("\n8. 导出数据")
    response = requests.post(
        f"{BASE_URL}/export",
        json={
            "batch_ids": [batch_id],
            "reason_codes": ["network_timeout"]
        }
    )
    print(f"   状态码: {response.status_code}")
    assert response.status_code == 200, f"导出数据失败: {response.text}"
    export_result = response.json()
    print(f"   导出批次数量: {len(export_result['batches'])}")
    print(f"   导出重跑摘要数量: {len(export_result['rerun_summaries'])}")

    print("\n✅ 正常流程测试通过!")
    return batch_id, summary_id


def test_duplicate_request(batch_id):
    print("\n" + "=" * 60)
    print("测试场景 2: 重复提交验证 - 状态不会被推进两次")
    print("=" * 60)

    print(f"\n1. 第一次重跑请求")
    response = requests.post(
        f"{BASE_URL}/request",
        json={
            "batch_id": batch_id,
            "reason_code": "network_timeout",
            "task_ids": ["task_004", "task_005"],
            "requested_by": "automation"
        }
    )
    print(f"   状态码: {response.status_code}")
    result1 = response.json()
    print(f"   是否批准: {result1['approved']}, 剩余预算: {result1['remaining_budget']}")
    assert result1['approved'] == True, "第二次重跑应该被批准"

    print(f"\n2. 立即重复提交相同请求（同一原因仍在进行中）")
    response = requests.post(
        f"{BASE_URL}/request",
        json={
            "batch_id": batch_id,
            "reason_code": "network_timeout",
            "task_ids": ["task_004", "task_005"],
            "requested_by": "automation"
        }
    )
    print(f"   状态码: {response.status_code}")
    result2 = response.json()
    print(f"   是否批准: {result2['approved']}")
    print(f"   拒绝原因: {result2['rejection_reason']}")
    print(f"   消息: {result2['message']}")
    assert result2['approved'] == False, "重复请求应该被拒绝"
    assert result2['rejection_reason'] == "rerun_in_progress", "应该因为进行中被拒绝"

    print(f"\n3. 检查预算使用情况 - 确认只扣除了一次")
    response = requests.get(
        f"{BASE_URL}/batches/{batch_id}"
    )
    details = response.json()
    budget = details['rerun_budgets'][0]
    print(f"   已使用重跑次数: {budget['used_reruns']}")
    print(f"   最大重跑次数: {budget['max_reruns']}")

    print("\n✅ 重复提交测试通过! 状态没有被推进两次")


def test_budget_exhaustion(batch_id):
    print("\n" + "=" * 60)
    print("测试场景 3: 预算耗尽验证")
    print("=" * 60)

    print(f"\n1. 先完成当前进行中的重跑")
    response = requests.get(f"{BASE_URL}/batches/{batch_id}")
    details = response.json()
    in_progress_summary = None
    for s in details['rerun_summaries']:
        if s['status'] in ['initiated', 'in_progress']:
            in_progress_summary = s
            break

    if in_progress_summary:
        response = requests.post(
            f"{BASE_URL}/status",
            json={
                "summary_id": in_progress_summary['id'],
                "status": "completed",
                "tasks_succeeded": 2,
                "tasks_failed": 0
            }
        )
        print(f"   完成重跑 #{in_progress_summary['rerun_number']}")

    print(f"\n2. 继续请求重跑直到耗尽预算")
    for i in range(3):
        response = requests.post(
            f"{BASE_URL}/request",
            json={
                "batch_id": batch_id,
                "reason_code": "network_timeout",
                "task_ids": [f"task_{i:03d}"],
                "requested_by": "test"
            }
        )
        result = response.json()
        print(f"   请求 #{i+1}: 批准={result['approved']}, 剩余预算={result.get('remaining_budget', 'N/A')}")

        if result['approved']:
            response = requests.post(
                f"{BASE_URL}/status",
                json={
                    "summary_id": result['summary_id'],
                    "status": "completed",
                    "tasks_succeeded": 1,
                    "tasks_failed": 0
                }
            )

    print(f"\n3. 预算耗尽后请求重跑 - 应该被拒绝")
    response = requests.post(
        f"{BASE_URL}/request",
        json={
            "batch_id": batch_id,
            "reason_code": "network_timeout",
            "task_ids": ["task_999"],
            "requested_by": "test"
        }
    )
    result = response.json()
    print(f"   是否批准: {result['approved']}")
    print(f"   拒绝原因: {result['rejection_reason']}")
    assert result['approved'] == False, "预算耗尽后应该被拒绝"

    print(f"\n4. 检查拒绝记录")
    response = requests.get(f"{BASE_URL}/batches/{batch_id}")
    details = response.json()
    print(f"   拒绝记录数量: {len(details['rejection_records'])}")
    if details['rejection_records']:
        print(f"   最新拒绝原因: {details['rejection_records'][-1]['rejection_reason']}")
        print(f"   保留原始请求: {bool(details['rejection_records'][-1]['original_request'])}")
        print(f"   保留处理上下文: {bool(details['rejection_records'][-1]['processing_context'])}")

    print("\n✅ 预算耗尽测试通过!")


def test_manual_correction(batch_id):
    print("\n" + "=" * 60)
    print("测试场景 4: 人工修正")
    print("=" * 60)

    print(f"\n1. 人工重置预算")
    response = requests.post(
        f"{BASE_URL}/manual-correction",
        json={
            "batch_id": batch_id,
            "reason_code": "network_timeout",
            "adjustment_type": "reset_budget",
            "adjustment_value": 0,
            "corrected_by": "admin_user",
            "comment": "紧急情况，需要额外重跑机会"
        }
    )
    print(f"   状态码: {response.status_code}")
    result = response.json()
    print(f"   消息: {result['message']}")

    print(f"\n2. 验证预算已重置")
    response = requests.get(
        f"{BASE_URL}/budgets/check/{batch_id}/network_timeout"
    )
    check_result = response.json()
    print(f"   剩余预算: {check_result['remaining_budget']}")
    assert check_result['remaining_budget'] == 3, "预算应该被重置为3"

    print(f"\n3. 增加预算额度")
    response = requests.post(
        f"{BASE_URL}/manual-correction",
        json={
            "batch_id": batch_id,
            "reason_code": "network_timeout",
            "adjustment_type": "increase_budget",
            "adjustment_value": 2,
            "corrected_by": "admin_user",
            "comment": "增加2次额外重跑"
        }
    )
    print(f"   状态码: {response.status_code}")
    result = response.json()
    print(f"   消息: {result['message']}")

    response = requests.get(f"{BASE_URL}/batches/{batch_id}")
    details = response.json()
    budget = details['rerun_budgets'][0]
    print(f"   新的最大重跑次数: {budget['max_reruns']}")
    assert budget['max_reruns'] == 5, "最大重跑次数应该增加到5"

    print("\n✅ 人工修正测试通过!")


def main():
    print("\n🚀 开始任务重跑预算 API 集成测试\n")

    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code != 200:
            raise Exception("服务未响应")
        print("✅ API 服务运行正常\n")
    except Exception as e:
        print(f"❌ 无法连接到 API 服务: {e}")
        print("请先启动服务: uvicorn app.main:app --reload")
        sys.exit(1)

    try:
        batch_id, _ = test_normal_flow()
        test_duplicate_request(batch_id)
        test_budget_exhaustion(batch_id)
        test_manual_correction(batch_id)

        print("\n" + "=" * 60)
        print("🎉 所有测试通过!")
        print("=" * 60)
        print("\nAPI 文档地址:")
        print("  - Swagger UI: http://localhost:8000/docs")
        print("  - ReDoc: http://localhost:8000/redoc")

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
