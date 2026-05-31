from datetime import datetime, timedelta

from models import (
    InspectionRecord, CustomerServiceDialog, KnowledgeBaseChange,
    RecordStatus, ChangeType, ConclusionType
)
from inspection_engine import RAGInspectionEngine
from weekly_report import WeeklyReportGenerator
from analyst_tools import AnalystTools


def create_sample_data(engine: RAGInspectionEngine) -> None:
    """创建示例数据，模拟真实业务场景"""

    base_date = datetime(2026, 5, 26, 9, 0, 0)

    record1 = InspectionRecord(
        record_id="INS-2026-001",
        received_at=base_date,
        question="如何申请退款？",
        standard_answer="用户可在订单详情页点击申请退款按钮，填写退款原因后提交，审核通过后3-5个工作日原路退回。",
        initial_conclusion=ConclusionType.PASS,
        current_conclusion=ConclusionType.PASS,
        status=RecordStatus.CONFIRMED,
        inspection_items={"accuracy": 95, "completeness": 90, "timeliness": 85},
        inspector="张质检",
        remarks="答案准确完整，符合知识库标准"
    )
    engine.add_inspection_record(record1)

    dialog1 = CustomerServiceDialog(
        dialog_id="CS-2026-001",
        record_id="INS-2026-001",
        received_at=base_date + timedelta(hours=1),
        customer_id="CUST-001",
        session_content=[
            {"role": "customer", "content": "我买的东西想退款怎么操作？"},
            {"role": "agent", "content": "您好，您可以在订单详情页点击申请退款按钮..."}
        ],
        key_points=["退款申请流程", "退款时效"],
        is_delayed=False
    )
    engine.add_customer_dialog(dialog1)

    engine.create_evidence_link(
        record_id="INS-2026-001",
        evidence_type="客服对话",
        evidence_id="CS-2026-001",
        evidence_title="退款咨询对话记录",
        evidence_summary="用户咨询退款流程，客服回答与知识库一致",
        conclusion_point="答案准确性验证通过",
        confidence=0.95
    )

    record2 = InspectionRecord(
        record_id="INS-2026-002",
        received_at=base_date + timedelta(hours=2),
        question="优惠券怎么用？",
        standard_answer="优惠券可在结算页面选择使用，满足使用条件即可抵扣相应金额。",
        initial_conclusion=ConclusionType.NEEDS_REVIEW,
        current_conclusion=ConclusionType.NEEDS_REVIEW,
        status=RecordStatus.PENDING_SUPPLEMENT,
        inspection_items={"accuracy": 70, "completeness": 60},
        inspector="李质检",
        remarks="需等待客服对话确认实际使用场景"
    )
    engine.add_inspection_record(record2)

    dialog2 = CustomerServiceDialog(
        dialog_id="CS-2026-002",
        record_id="INS-2026-002",
        received_at=base_date + timedelta(hours=14),
        customer_id="CUST-002",
        session_content=[
            {"role": "customer", "content": "我的优惠券用不了"},
            {"role": "agent", "content": "请检查优惠券的使用条件，是否满足满减要求..."}
        ],
        key_points=["优惠券使用限制", "异常问题排查"],
        is_delayed=True,
        delay_hours=12.0
    )
    engine.add_customer_dialog(dialog2)

    record3 = InspectionRecord(
        record_id="INS-2026-003",
        received_at=base_date + timedelta(hours=5),
        question="会员有什么权益？",
        standard_answer="会员享受积分加倍、专属折扣、生日礼包等权益。",
        initial_conclusion=ConclusionType.FAIL,
        current_conclusion=ConclusionType.PASS,
        status=RecordStatus.MANUAL_MODIFIED,
        inspection_items={"accuracy": 80, "completeness": 75},
        inspector="王质检",
        remarks="初始结论有误，已修正"
    )
    engine.add_inspection_record(record3)

    kb_change1 = KnowledgeBaseChange(
        change_id="KB-2026-001",
        record_id="INS-2026-003",
        changed_at=base_date + timedelta(hours=8),
        change_type=ChangeType.MATERIAL_SUPPLEMENT,
        field_name="standard_answer",
        old_value="会员享受积分加倍、专属折扣、生日礼包等权益。",
        new_value="会员享受积分加倍(1.5倍)、专属折扣(95折)、生日礼包(100元券)等权益。",
        operator="运营-小赵",
        is_manual=True,
        reason="补充具体权益数值，使答案更明确"
    )
    engine.add_knowledge_change(kb_change1)

    kb_change2 = KnowledgeBaseChange(
        change_id="KB-2026-002",
        record_id="INS-2026-003",
        changed_at=base_date + timedelta(hours=10),
        change_type=ChangeType.CONCLUSION_CHANGE,
        field_name="current_conclusion",
        old_value="不通过",
        new_value="通过",
        operator="质检主管",
        is_manual=True,
        reason="补充材料后答案已达标，修正结论为通过"
    )
    engine.add_knowledge_change(kb_change2)

    engine.create_evidence_link(
        record_id="INS-2026-003",
        evidence_type="知识库修改",
        evidence_id="KB-2026-001",
        evidence_title="会员权益答案补充",
        evidence_summary="补充了积分倍率、折扣力度等具体数值",
        conclusion_point="答案完整性提升",
        confidence=0.88
    )

    engine.create_evidence_link(
        record_id="INS-2026-003",
        evidence_type="知识库修改",
        evidence_id="KB-2026-002",
        evidence_title="质检结论修正",
        evidence_summary="经主管审核，结论从不通过改为通过",
        conclusion_point="结论变更依据",
        confidence=1.0
    )

    record4 = InspectionRecord(
        record_id="INS-2026-004",
        received_at=base_date + timedelta(days=1, hours=3),
        question="物流多久能到？",
        standard_answer="一般3-5天送达，偏远地区可能延迟。",
        initial_conclusion=ConclusionType.PASS,
        current_conclusion=ConclusionType.PASS,
        status=RecordStatus.CONFIRMED,
        inspection_items={"accuracy": 88, "completeness": 85},
        inspector="张质检"
    )
    engine.add_inspection_record(record4)

    kb_change3 = KnowledgeBaseChange(
        change_id="KB-2026-003",
        record_id="INS-2026-004",
        changed_at=base_date + timedelta(days=1, hours=6),
        change_type=ChangeType.MATERIAL_SUPPLEMENT,
        field_name="remarks",
        old_value="",
        new_value="已核对物流时效标准，答案符合要求",
        operator="运营-小钱",
        is_manual=True,
        reason="补充核对备注"
    )
    engine.add_knowledge_change(kb_change3)

    record5 = InspectionRecord(
        record_id="INS-2026-005",
        received_at=base_date + timedelta(days=2),
        question="怎么修改收货地址？",
        standard_answer="可在个人中心-地址管理中修改。",
        initial_conclusion=ConclusionType.NEEDS_REVIEW,
        current_conclusion=ConclusionType.NEEDS_REVIEW,
        status=RecordStatus.PENDING_SUPPLEMENT,
        inspection_items={"accuracy": 65},
        inspector="李质检",
        remarks="等待客服对话补充"
    )
    engine.add_inspection_record(record5)


def run_demo():
    """运行完整演示流程"""

    print("\n" + "=" * 70)
    print("                    RAG素材体检系统 - 完整演示")
    print("=" * 70)

    engine = RAGInspectionEngine()
    reporter = WeeklyReportGenerator(engine)
    analyst = AnalystTools(engine)

    print("\n【步骤1】导入示例数据...")
    create_sample_data(engine)
    print(f"  ✓ 已导入 {len(engine.records)} 条质检记录")
    print(f"  ✓ 已导入 {sum(len(d) for d in engine.dialogs.values())} 条客服对话")
    print(f"  ✓ 已导入 {sum(len(c) for c in engine.kb_changes.values())} 条知识库变更")

    print("\n【步骤2】查看单条记录详情（含证据追溯）...")
    record_detail = engine.get_record_with_evidence("INS-2026-003")
    print(f"  记录ID: {record_detail['record'].record_id}")
    print(f"  问题: {record_detail['record'].question}")
    print(f"  初始结论: {record_detail['record'].initial_conclusion}")
    print(f"  当前结论: {record_detail['record'].current_conclusion}")
    print(f"  状态: {record_detail['record'].status}")

    analysis = record_detail['change_type_analysis']
    print(f"\n  变更分析:")
    print(f"    - 仅补材料: {'是' if analysis['has_material_only'] else '否'}")
    print(f"    - 改结论: {'是' if analysis['has_conclusion_change'] else '否'}")
    print(f"    - 材料补充数: {len(analysis['material_supplements'])}")
    print(f"    - 结论变更数: {len(analysis['conclusion_changes'])}")

    print(f"\n  证据链接:")
    for ev in record_detail['evidences']:
        print(f"    ↳ [{ev.evidence_type}] {ev.evidence_title}")
        print(f"      结论点: {ev.conclusion_point} (置信度: {ev.confidence})")

    print("\n【步骤3】追溯特定结论点的依据...")
    traces = engine.trace_conclusion_evidence("INS-2026-003", "结论变更")
    for t in traces:
        print(f"  ✓ 找到依据: {t.evidence_title}")
        print(f"    摘要: {t.evidence_summary}")

    print("\n【步骤4】导出前复核检查...")
    start_date = datetime(2026, 5, 25)
    end_date = datetime(2026, 5, 31)
    review_result = analyst.review_before_export(start_date, end_date)

    print(f"  复核结果: {'通过' if review_result['can_export'] else '有警告'}")
    for warning in review_result['warnings']:
        print(f"    ⚠ {warning['type']}: {warning['message']}")
    for check in review_result['checks']:
        print(f"    ✓ {check['type']}: {check['message']}")

    print("\n【步骤5】生成质检周报...")
    report = reporter.generate_weekly_report(start_date, end_date)

    print(f"\n  周报概览:")
    s = report['summary']
    print(f"    总记录数: {s['total_records']}")
    print(f"    已确认: {s['confirmed_count']} ({s['confirmation_rate']*100:.1f}%)")
    print(f"    待补: {s['pending_count']}")
    print(f"    人工改过: {s['modified_count']} ({s['modification_rate']*100:.1f}%)")
    print(f"    通过率: {s['pass_rate']*100:.1f}%")

    print("\n【步骤6】按处理口径分类查看...")
    pc = report['processing_categories']

    print(f"\n  【已确认】({pc['confirmed']['count']}条)")
    for r in pc['confirmed']['records']:
        print(f"    • [{r['record_id']}] {r['question']} → {r['current_conclusion']}")

    print(f"\n  【待补】({pc['pending_supplement']['count']}条)")
    for r in pc['pending_supplement']['records']:
        print(f"    • [{r['record_id']}] {r['question']}")
        print(f"      ↳ {r['pending_reason']} | {r['expected_supplement']}")

    print(f"\n  【人工改过】({pc['manual_modified']['count']}条)")
    for r in pc['manual_modified']['records']:
        change_mark = " (结论变了!)" if r['conclusion_changed'] else ""
        print(f"    • [{r['record_id']}] {r['question']}{change_mark}")
        print(f"      {r['initial_conclusion']} → {r['current_conclusion']}")

    print("\n【步骤7】导出差分明细...")
    ca = report['change_analysis']
    print(f"  总变更: {ca['total_changes']}")
    print(f"    - 补材料: {ca['material_supplements']}")
    print(f"    - 改结论: {ca['conclusion_changes']}")
    print(f"    - 知识库改动: {ca['knowledge_modifications']}")
    print(f"  {ca['material_only_notes']}")
    print(f"  {ca['conclusion_change_notes']}")

    print("\n【步骤8】导出完整周报文本...")
    report_text = reporter.export_report_to_text(report)
    print(report_text)

    print("\n" + "=" * 70)
    print("  演示完成！以下是运营分析师操作指南：")
    print("=" * 70)
    analyst.print_operation_guide()

    print("\n【检查清单】导出周报前请确认：")
    for item in analyst.generate_review_checklist():
        print(f"  {item}")

    print("\n" + "=" * 70)
    print("  核心模块文件：")
    print("  • models.py          - 数据模型定义")
    print("  • inspection_engine.py - 核心质检引擎")
    print("  • weekly_report.py   - 周报生成模块")
    print("  • analyst_tools.py   - 运营分析师工具")
    print("  • demo.py            - 演示脚本（本文件）")
    print("=" * 70)


if __name__ == "__main__":
    run_demo()
