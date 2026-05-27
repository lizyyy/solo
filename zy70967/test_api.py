#!/usr/bin/env python3
"""完整的 API 集成测试脚本 - 包含去重和回写日志的关键断言"""
import sys
import os
import json
import requests

BASE_URL = 'http://127.0.0.1:5001'


def test_health():
    print("=" * 60)
    print("1. 健康检查")
    r = requests.get(f'{BASE_URL}/api/health')
    assert r.status_code == 200
    print(f"   OK: {r.json()}")
    return True


def test_create_batch():
    print("\n" + "=" * 60)
    print("2. 创建批次")
    payload = {
        "batch_number": "BATCH-2026-001",
        "name": "5月质检申诉第一批",
        "source_system": "QC-SYSTEM",
        "created_by": "supervisor_zhang"
    }
    r = requests.post(f'{BASE_URL}/api/batches', json=payload)
    assert r.status_code == 201
    batch = r.json()
    print(f"   OK: 批次 ID={batch['id']}, 编号={batch['batch_number']}, 状态={batch['status']}")

    r2 = requests.post(f'{BASE_URL}/api/batches', json=payload)
    assert r2.status_code == 409
    print(f"   OK: 重复批次号返回 409, {r2.json()}")
    return batch['id']


def test_upload_materials(batch_id):
    print("\n" + "=" * 60)
    print("3. 上传材料（含正常、缺字段、时间矛盾）")
    payload = {
        "source_system": "QC-SYSTEM",
        "operator": "supervisor_zhang",
        "materials": [
            {
                "appeal_number": "AP-001",
                "agent_id": "AGT001",
                "agent_name": "张三",
                "team_name": "A组",
                "call_time": "2026-05-20T10:30:00",
                "call_duration": 180,
                "appeal_type": "service_attitude",
                "appeal_reason": "客户反映态度问题",
                "original_score": 85,
                "original_conclusion": "qualified"
            },
            {
                "appeal_number": "AP-002",
                "agent_id": "AGT002",
                "agent_name": "李四",
                "team_name": "B组",
                "call_time": "2026-05-20T14:00:00",
                "call_duration": 240,
                "appeal_type": "process_error",
                "appeal_reason": "流程处理不当",
                "original_score": 72,
                "original_conclusion": "unqualified"
            },
            {
                "agent_id": "AGT003",
                "call_time": "2026-05-21T09:00:00",
                "call_duration": 150,
                "original_score": 90,
                "original_conclusion": "excellent"
            },
            {
                "appeal_number": "AP-004",
                "agent_id": "AGT004",
                "call_time": "2026-05-21T16:00:00",
                "appeal_time": "2026-05-20T10:00:00",
                "call_duration": 200,
                "original_score": 80,
                "original_conclusion": "qualified"
            }
        ]
    }
    r = requests.post(f'{BASE_URL}/api/batches/{batch_id}/materials', json=payload)
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 总数={result['total']}, 有效={result['valid_count']}, 错误={result['error_count']}, 重复={result['duplicate_count']}")
    print(f"   有效记录: {[p['appeal_number'] for p in result['results']['processed']]}")
    print(f"   错误行号: {[e['line_number'] for e in result['results']['errors']]}")
    for e in result['results']['errors']:
        print(f"     行{e['line_number']}: {[err['message'] for err in e['errors']]}")

    assert result['valid_count'] == 2, f"期望有效记录 2 条，实际 {result['valid_count']} 条"
    assert result['error_count'] == 2, f"期望错误 2 条，实际 {result['error_count']} 条"
    assert result['duplicate_count'] == 0, f"期望重复 0 条，实际 {result['duplicate_count']} 条"
    print("   断言通过: 首次上传数量正确")

    record_ids = [p['record_id'] for p in result['results']['processed']]
    return record_ids


def test_duplicate_detection(batch_id):
    print("\n" + "=" * 60)
    print("4. 重复提交去重测试（同批次内重复应识别并返回原结果）")
    payload = {
        "source_system": "QC-SYSTEM",
        "operator": "supervisor_zhang",
        "materials": [
            {
                "appeal_number": "AP-001",
                "agent_id": "AGT001",
                "agent_name": "张三",
                "team_name": "A组",
                "call_time": "2026-05-20T10:30:00",
                "call_duration": 180,
                "appeal_type": "service_attitude",
                "appeal_reason": "客户反映态度问题",
                "original_score": 85,
                "original_conclusion": "qualified"
            },
            {
                "appeal_number": "AP-005",
                "agent_id": "AGT005",
                "agent_name": "王五",
                "team_name": "C组",
                "call_time": "2026-05-22T11:00:00",
                "call_duration": 300,
                "appeal_type": "knowledge",
                "appeal_reason": "业务知识不足",
                "original_score": 65,
                "original_conclusion": "unqualified"
            }
        ]
    }
    r = requests.post(f'{BASE_URL}/api/batches/{batch_id}/materials', json=payload)
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 有效={result['valid_count']}, 错误={result['error_count']}, 重复={result['duplicate_count']}")

    assert result['duplicate_count'] >= 1, f"期望至少检测到 1 条重复，实际 {result['duplicate_count']} 条"
    print(f"   断言通过: 检测到 {result['duplicate_count']} 条重复材料")

    assert len(result['results']['duplicates']) >= 1, "duplicates 数组不应为空"
    print(f"   断言通过: duplicates 数组有 {len(result['results']['duplicates'])} 条记录")

    dup = result['results']['duplicates'][0]
    assert dup.get('existing_record') is not None, "重复材料应返回原有处理结果 existing_record"
    assert dup['existing_record']['appeal_number'] == 'AP-001', f"期望申诉号 AP-001，实际 {dup['existing_record']['appeal_number']}"
    assert dup['existing_record']['original_conclusion'] == 'qualified', "原有记录结论应为 qualified"
    assert dup['existing_record']['original_score'] == 85, "原有记录分数应为 85"
    print(f"   断言通过: 重复材料返回了原有处理结果（申诉号={dup['existing_record']['appeal_number']}, 结论={dup['existing_record']['original_conclusion']}, 分数={dup['existing_record']['original_score']}）")

    for d in result['results']['duplicates']:
        print(f"   重复材料: 行{d['line_number']}, 申诉号={d['appeal_number']}, 原始批次ID={d.get('original_batch_id')}")
        if d.get('existing_record'):
            print(f"     原有记录: 结论={d['existing_record']['original_conclusion']}, 分数={d['existing_record']['original_score']}")

    for p in result['results']['processed']:
        print(f"   新处理: 行{p['line_number']}, 申诉号={p['appeal_number']}, record_id={p['record_id']}")

    return result


def test_list_records(batch_id):
    print("\n" + "=" * 60)
    print("5. 查询批次记录列表")
    r = requests.get(f'{BASE_URL}/api/batches/{batch_id}/records')
    assert r.status_code == 200
    data = r.json()
    print(f"   OK: 共 {data['total']} 条记录")
    for item in data['items']:
        print(f"   ID={item['id']}, 申诉号={item['appeal_number']}, 状态={item['status']}, 原始结论={item['original_conclusion']}")

    assert data['total'] == 3, f"期望 3 条有效记录（排除重复的 AP-001），实际 {data['total']} 条"
    print("   断言通过: 重复提交未生成新的有效记录")
    return data['items']


def test_update_record(record_id):
    print("\n" + "=" * 60)
    print(f"6. 修改记录结论 (ID={record_id})")
    payload = {
        "operator": "supervisor_li",
        "reason": "复核后发现原始评分有误，通话记录显示服务态度良好",
        "current_score": 95,
        "current_conclusion": "excellent"
    }
    r = requests.patch(f'{BASE_URL}/api/records/{record_id}', json=payload)
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 修改字段={result['changed_fields']}")
    print(f"   修改后: 当前分数={result['record']['current_score']}, 当前结论={result['record']['current_conclusion']}")
    print(f"   日志: 操作人={result['change_log']['operator']}, 原因={result['change_log']['reason']}")
    print(f"        旧值={result['change_log']['old_value']}")
    print(f"        新值={result['change_log']['new_value']}")
    return result


def test_finalize_record(record_id):
    print("\n" + "=" * 60)
    print(f"7. 终审定论 (ID={record_id})")
    payload = {
        "operator": "director_wang",
        "reason": "经最终复核，确认申诉成立，原评分确实偏高",
        "final_score": 92,
        "final_conclusion": "excellent"
    }
    r = requests.post(f'{BASE_URL}/api/records/{record_id}/finalize', json=payload)
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 最终分数={result['record']['final_score']}, 最终结论={result['record']['final_conclusion']}")
    print(f"   状态: {result['record']['status']}")
    print(f"   日志: 操作人={result['change_log']['operator']}")
    print(f"        旧结论={result['change_log']['old_value']['final_conclusion']}")
    print(f"        新结论={result['change_log']['new_value']['final_conclusion']}")
    return result


def test_trace_record_before_writeback(record_id):
    print("\n" + "=" * 60)
    print(f"8. 查询处理轨迹 - 回写前 (ID={record_id})")
    r = requests.get(f'{BASE_URL}/api/records/{record_id}/trace')
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 申诉号={result['appeal_number']}")
    print(f"   原始材料: 批次ID={result['raw_material']['batch_id']}, 行号={result['raw_material']['line_number']}")
    print(f"   完整操作日志 ({len(result['process_logs'])} 条)")
    print(f"   回写历史 ({len(result['writeback_history'])} 条)")

    assert len(result['writeback_history']) == 0, "回写前回写历史应为空"
    print("   断言通过: 回写前回写历史为空")

    return result


def test_writeback(batch_id):
    print("\n" + "=" * 60)
    print("9. 触发回写流程")
    payload = {
        "target_system": "HR-SYSTEM",
        "triggered_by": "supervisor_zhang"
    }
    r = requests.post(f'{BASE_URL}/api/batches/{batch_id}/writeback', json=payload)
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 目标系统={result['target_system']}, 状态={result['status']}")
    print(f"   总计={result['total_count']}, 成功={result['success_count']}, 失败={result['failed_count']}")
    print(f"   启动时间={result['started_at']}, 完成时间={result['completed_at']}")

    assert result['status'] == 'success', f"期望回写状态 success，实际 {result['status']}"
    assert result['success_count'] == result['total_count'], "期望全部成功"
    print("   断言通过: 回写成功")
    return result


def test_trace_record_after_writeback(record_id):
    print("\n" + "=" * 60)
    print(f"10. 查询处理轨迹 - 回写后验证日志入库 (ID={record_id})")
    r = requests.get(f'{BASE_URL}/api/records/{record_id}/trace')
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 申诉号={result['appeal_number']}")
    print(f"   完整操作日志 ({len(result['process_logs'])} 条)")
    print(f"   回写历史 ({len(result['writeback_history'])} 条)")

    assert len(result['writeback_history']) >= 1, f"回写后回写历史不应为空，实际 {len(result['writeback_history'])} 条"
    print(f"   断言通过: 回写日志已入库，共 {len(result['writeback_history'])} 条回写记录")

    wb = result['writeback_history'][0]
    assert wb['action_type'] == 'writeback', f"期望 action_type=writeback，实际 {wb['action_type']}"
    assert wb['operator'] == 'supervisor_zhang', f"期望操作人 supervisor_zhang，实际 {wb['operator']}"
    assert '回写到系统: HR-SYSTEM' in wb['reason'], f"期望回写原因包含 HR-SYSTEM"
    print(f"   断言通过: 回写日志内容正确（类型={wb['action_type']}, 操作人={wb['operator']}）")

    for wb in result['writeback_history']:
        print(f"     {wb['created_at']}: {wb['action_type']} by {wb['operator']}")
        print(f"       原因: {wb['reason']}")
        print(f"       回写系统: {wb['new_value'].get('writeback_system') if wb['new_value'] else 'N/A'}")

    print(f"\n   字段追踪（验证从原始输入追到最终报告的闭环）:")
    for ft in result['field_trace']:
        if ft['history'] or ft['source_value'] is not None:
            print(f"     {ft['field']}: 源值={ft['source_value']} → 当前值={ft['current_value']}")
            for h in ft['history']:
                print(f"       {h['changed_at'][:19]}: {h['old_value']} → {h['new_value']} by {h['operator']}")

    return result


def test_error_details(batch_id):
    print("\n" + "=" * 60)
    print("11. 查询错误明细（返回原始位置）")
    r = requests.get(f'{BASE_URL}/api/batches/{batch_id}/error-details')
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 共 {result['total_errors']} 条错误")
    for item in result['items']:
        print(f"   行{item['line_number']}:")
        print(f"     原始内容: {json.dumps(item['raw_content'], ensure_ascii=False)}")
        for err in item['errors']:
            print(f"     错误类型: {err['type']}, 字段: {err.get('field', '-')}, 消息: {err['message']}")
    return result


def test_duplicate_details(batch_id):
    print("\n" + "=" * 60)
    print("12. 查询重复明细")
    r = requests.get(f'{BASE_URL}/api/batches/{batch_id}/duplicate-details')
    assert r.status_code == 200
    result = r.json()
    print(f"   OK: 共 {result['total_duplicates']} 条重复")

    assert result['total_duplicates'] >= 1, f"期望至少 1 条重复，实际 {result['total_duplicates']} 条"
    print(f"   断言通过: duplicate-details 返回 {result['total_duplicates']} 条重复记录")

    for item in result['items']:
        print(f"   行{item['line_number']}: 申诉号={item['appeal_number']}")
        if item.get('existing_record'):
            print(f"     原有记录: ID={item['existing_record']['id']}, 结论={item['existing_record']['original_conclusion']}")
    return result


def test_list_batches():
    print("\n" + "=" * 60)
    print("13. 查询所有批次")
    r = requests.get(f'{BASE_URL}/api/batches')
    assert r.status_code == 200
    batches = r.json()
    print(f"   OK: 共 {len(batches)} 个批次")
    for b in batches:
        print(f"   ID={b['id']}, 编号={b['batch_number']}, 状态={b['status']}, 总数={b['total_count']}, 有效={b['valid_count']}, 错误={b['error_count']}, 重复={b['duplicate_count']}")
    return batches


def main():
    print("=" * 60)
    print("呼叫中心质检申诉 API 服务 - 集成测试（含关键断言）")
    print("=" * 60)

    try:
        test_health()
        batch_id = test_create_batch()
        record_ids = test_upload_materials(batch_id)
        test_duplicate_detection(batch_id)
        records = test_list_records(batch_id)

        record_for_trace = None
        if records:
            record_id = records[0]['id']
            test_update_record(record_id)
            test_finalize_record(record_id)
            test_trace_record_before_writeback(record_id)
            record_for_trace = record_id

        test_writeback(batch_id)

        if record_for_trace:
            test_trace_record_after_writeback(record_for_trace)

        test_error_details(batch_id)
        test_duplicate_details(batch_id)
        test_list_batches()

        print("\n" + "=" * 60)
        print("所有测试通过!")
        print("  ✓ 同批次重复提交正确识别并返回原结果")
        print("  ✓ 重复提交不生成新有效记录")
        print("  ✓ 回写日志正确入库可追溯")
        print("  ✓ 错误明细带原始行号可回溯")
        print("  ✓ 完整字段变更历史可追踪")
        print("=" * 60)
    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
