import os
import json
from admission_reconciliation_service import AdmissionReconciliationService
from models import AdmissionStatus


def main():
    print("=" * 60)
    print("研究生院招生对账服务 - 演示程序")
    print("=" * 60)

    service = AdmissionReconciliationService()
    data_dir = os.path.join(os.path.dirname(__file__), 'sample_data')

    print("\n1. 创建对账会话")
    session_id = service.create_session("2024年硕士研究生招生对账", "研究生院-张秘书")
    print(f"   会话ID: {session_id}")

    print("\n2. 导入数据")
    supervisor_count = service.import_supervisors(session_id, os.path.join(data_dir, 'supervisors.csv'))
    print(f"   导师数据: {supervisor_count} 条")
    
    student_count = service.import_students(session_id, os.path.join(data_dir, 'students.csv'))
    print(f"   学生数据: {student_count} 条")
    
    choice_count = service.import_choices(session_id, os.path.join(data_dir, 'choices.json'))
    print(f"   志愿数据: {choice_count} 条")
    
    adj_count = service.import_adjustments(session_id, os.path.join(data_dir, 'adjustments.json'))
    print(f"   调剂数据: {adj_count} 条")

    print("\n3. 运行自动对账")
    success = service.run_reconciliation(session_id)
    if success:
        print("   对账完成!")
    else:
        print("   对账失败!")
        return

    print("\n4. 查看汇总统计")
    summary = service.get_summary(session_id)
    print(f"   总记录数: {summary['statistics']['total_records']}")
    print(f"   待审核: {summary['statistics']['pending_count']}")
    print(f"   存在冲突: {summary['statistics']['conflict_count']}")
    print(f"   跨专业申请: {summary['statistics']['cross_major_count']}")
    print(f"   重复录取: {summary['statistics']['duplicate_count']}")

    print("\n5. 查看冲突记录列表")
    conflict_items = service.get_items_by_status(session_id, AdmissionStatus.CONFLICT)
    for item in conflict_items:
        print(f"   - {item['student_name']} -> {item['supervisor_name']} ({item['application_type']})")

    if conflict_items:
        target_item_id = conflict_items[0]['id']
        print(f"\n6. 查看单条记录的决策说明: {conflict_items[0]['student_name']}")
        explanation = service.get_item_explanation(session_id, target_item_id)
        print(json.dumps(explanation, ensure_ascii=False, indent=2))

    print("\n7. 人工审核 - 放行无冲突记录")
    pending_items = service.get_items_by_status(session_id, AdmissionStatus.PENDING)
    if pending_items:
        item_id = pending_items[0]['id']
        result = service.review_item(
            session_id,
            item_id,
            "张秘书",
            AdmissionStatus.APPROVED,
            "材料齐全，符合录取条件，同意放行"
        )
        print(f"   审核结果: {result['original_status']} -> {result['new_status']}")

    print("\n8. 人工审核 - 退回有冲突记录")
    if conflict_items:
        item_id = conflict_items[0]['id']
        result = service.review_item(
            session_id,
            item_id,
            "张秘书",
            AdmissionStatus.REJECTED,
            "存在重复录取风险，退回处理"
        )
        print(f"   审核结果: {result['original_status']} -> {result['new_status']}")

    print("\n9. 重新对账计算（审核后自动触发）")
    summary = service.get_summary(session_id)
    print(f"   已放行: {summary['statistics']['approved_count']}")
    print(f"   已退回: {summary['statistics']['rejected_count']}")

    print("\n10. 追踪学生调剂来源")
    student_trace = service.get_student_trace(session_id, "S002")
    print(f"   学生: {student_trace['student_name']}")
    print(f"   录取记录数: {len(student_trace['admission_records'])}")
    for record in student_trace['admission_records']:
        source_info = record['source_trace'][0] if record['source_trace'] else {}
        print(f"   - {record['application_type']}: {record['supervisor_name']}, 状态: {record['status']}")
        if 'reason' in source_info:
            print(f"     调剂原因: {source_info['reason']}")

    print("\n11. 导出报告")
    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    os.makedirs(output_dir, exist_ok=True)
    files = service.export_reports(session_id, output_dir)
    for name, path in files.items():
        print(f"   {name}: {path}")

    print("\n12. 锁定对账会话")
    service.lock_session(session_id)
    print("   会话已锁定，禁止修改")

    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)


if __name__ == '__main__':
    main()
