#!/usr/bin/env python3
"""
验证修复：人工审核后状态不被覆盖
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from admission_reconciliation_service import AdmissionReconciliationService
from models import AdmissionStatus

def main():
    print("=" * 60)
    print("验证：人工审核后状态不会被重新计算覆盖")
    print("=" * 60)

    service = AdmissionReconciliationService()
    data_dir = os.path.join(os.path.dirname(__file__), 'sample_data')

    session_id = service.create_session("验证测试", "测试员")

    service.import_supervisors(session_id, os.path.join(data_dir, 'supervisors.csv'))
    service.import_students(session_id, os.path.join(data_dir, 'students.csv'))
    service.import_choices(session_id, os.path.join(data_dir, 'choices.json'))
    service.import_adjustments(session_id, os.path.join(data_dir, 'adjustments.json'))

    service.run_reconciliation(session_id)

    print("\n1. 获取一条冲突记录并执行退回")
    conflict_items = service.get_items_by_status(session_id, AdmissionStatus.CONFLICT)
    print(f"   退回前状态: {conflict_items[0]['student_name']} = 存在冲突")
    
    item_id = conflict_items[0]['id']
    result = service.review_item(
        session_id, item_id, "测试员", AdmissionStatus.REJECTED, "测试退回")
    print(f"   审核接口返回: {result['original_status']} -> {result['new_status']}")

    print("\n2. 重新查询该记录详情，验证状态保持为已退回")
    explanation = service.get_item_explanation(session_id, item_id)
    print(f"   查询到的当前状态: {explanation['current_status']}")
    
    assert explanation['current_status'] == '已退回', "状态被错误覆盖了！"
    print("   ✓ 状态正确保持为'已退回'")

    print("\n3. 验证汇总统计正确")
    summary = service.get_summary(session_id)
    print(f"   汇总统计: rejected_count = {summary['statistics']['rejected_count']}")
    
    assert summary['statistics']['rejected_count'] == 1, "rejected_count 统计错误！"
    print("   ✓ rejected_count 正确统计为 1")

    print("\n4. 验证冲突信息仍然保留（供秘书说明决策参考")
    print(f"   冲突分析数量: {len(explanation['conflict_analysis'])}")
    print(f"   审核决策记录: {len(explanation['review_decisions'])} 条")
    
    assert len(explanation['conflict_analysis']) > 0, "冲突信息被错误清空了！"
    assert len(explanation['review_decisions']) == 1, "审核记录丢失！"
    print("   ✓ 冲突信息和审核记录都完整保留")

    print("\n" + "=" * 60)
    print("所有验证通过！")
    print("=" * 60)
    return 0

if __name__ == '__main__':
    sys.exit(main())
