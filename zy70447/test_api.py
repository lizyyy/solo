#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"


def test_health_check():
    print("1. 健康检查...")
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.json()}")
    return response.status_code == 200


def test_process_batch():
    print("\n2. 测试批次处理...")
    payload = {
        "batch_no": "BATCH-2024-001",
        "temp_permission_ticket": "TEMP-PERM-12345",
        "parameters": {"source": "crm"},
        "created_by": "admin",
        "records": [
            {
                "record_no": "REC-001",
                "is_exception": False,
                "original_data": {"name": "测试用户1", "amount": 100},
                "parameter_combination": {"channel": "online", "product": "A", "region": "domestic"}
            },
            {
                "record_no": "REC-002",
                "is_exception": True,
                "exception_type": "DATA_VALIDATION_ERROR",
                "exception_message": "金额超出范围",
                "original_data": {"name": "测试用户2", "amount": 999999},
                "parameter_combination": {"channel": "online", "product": "A", "region": "domestic"}
            },
            {
                "record_no": "REC-003",
                "is_exception": False,
                "original_data": {"name": "测试用户3", "amount": 200},
                "parameter_combination": {"channel": "online", "product": "C", "region": "domestic"}
            },
            {
                "record_no": "REC-004",
                "is_exception": False,
                "original_data": {"name": "测试用户4", "amount": 300},
                "parameter_combination": {"channel": "offline", "product": "B", "region": "international"}
            }
        ]
    }

    response = requests.post(f"{BASE_URL}/api/batch/process", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"批次ID: {result['batch_id']}")
        print(f"处理总数: {result['total_processed']}")
        print(f"成功: {result['success_count']}, 失败: {result['failed_count']}, 拦截: {result['blocked_count']}")
        print(f"执行时间: {result['execution_time_seconds']}秒")
        if result['blocked_reasons']:
            print("\n拦截原因详情:")
            for reason in result['blocked_reasons']:
                print(f"  参数组合: {reason['parameter_combination']}")
                print(f"  原因: {reason['block_reason']}")
                if reason['suggestion']:
                    print(f"  建议: {reason['suggestion']}")
        return result['batch_id']
    else:
        print(f"错误: {response.text}")
        return None


def test_get_batch_report(batch_id):
    print(f"\n3. 获取批次 {batch_id} 报告...")
    response = requests.get(f"{BASE_URL}/api/batch/{batch_id}/report")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        report = response.json()
        print(f"报告编号: {report['report_no']}")
        print(f"处理前后对比:\n{report['comparison_summary']}")
        print(f"执行时间: {report['execution_time_seconds']}秒")
        print(f"下一步建议:\n{report['next_step_suggestions']}")
        print(f"拦截记录分析: {report['blocked_items_analysis']}")
        print(f"失败项总结: {report['failed_items_summary']}")


def test_get_failed_items(batch_id):
    print(f"\n4. 获取批次 {batch_id} 失败项...")
    response = requests.get(f"{BASE_URL}/api/batch/{batch_id}/failed")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        items = response.json()
        print(f"失败项数量: {len(items)}")
        for item in items:
            print(f"  记录号: {item['record_no']}, 类型: {item['failure_type']}, 原因: {item['failure_reason']}")


def test_generate_rollback_candidates(batch_id):
    print(f"\n5. 生成批次 {batch_id} 回滚候选清单...")
    response = requests.post(
        f"{BASE_URL}/api/batch/{batch_id}/rollback/candidates",
        params={"operation_type": "rollback", "created_by": "manager"}
    )
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        candidates = response.json()
        print(f"生成候选记录: {len(candidates)}条")
        if candidates:
            print(f"候选记录ID: {candidates[0]['id']}")
            return candidates[0]['id']
    return None


def test_create_manual_correction():
    print("\n6. 测试人工修正备注...")
    payload = {
        "record_id": 1,
        "corrected_by": "reviewer",
        "correction_notes": "经复核, 该参数组合虽不在常规列表中, 但属特殊业务场景, 予以放行",
        "original_judgment": "blocked",
        "corrected_judgment": "approved",
        "review_opinion": "业务方已确认该场景合规",
        "related_ticket_id": "CS-2024-0815-001",
        "original_record_reference": "原始工单记录位置: /data/records/2024/08/15/original.log"
    }

    response = requests.post(f"{BASE_URL}/api/correction", json=payload)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        correction = response.json()
        print(f"修正记录ID: {correction['id']}")
        print(f"关联工单号: {correction['related_ticket_id']}")
        return correction['related_ticket_id']
    return None


def test_get_correction_by_ticket(ticket_id):
    print(f"\n7. 根据工单号 {ticket_id} 查询修正记录...")
    response = requests.get(f"{BASE_URL}/api/correction/ticket/{ticket_id}")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        corrections = response.json()
        print(f"找到修正记录: {len(corrections)}条")
        for corr in corrections:
            print(f"  修正人: {corr['corrected_by']}")
            print(f"  原始记录引用: {corr['original_record_reference']}")
            print(f"  修正备注: {corr['correction_notes']}")


def main():
    print("=" * 60)
    print("任务批次水印服务 API 测试")
    print("=" * 60)

    if not test_health_check():
        print("\n服务未启动，请先运行: uvicorn main:app --reload")
        return

    batch_id = test_process_batch()
    if batch_id:
        test_get_batch_report(batch_id)
        test_get_failed_items(batch_id)
        candidate_id = test_generate_rollback_candidates(batch_id)

    ticket_id = test_create_manual_correction()
    if ticket_id:
        test_get_correction_by_ticket(ticket_id)

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
