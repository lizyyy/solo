#!/usr/bin/env python3
"""招聘简历匹配解释系统 - 功能演示脚本"""

import sys
from datetime import datetime

from models import SessionLocal, init_db, MatchStatus, ChangeType
from services import (
    PromptVersionService, MatchExplanationService,
    KnowledgeBaseService, EvaluationService,
    ChangeHistoryService, WorkflowService
)
from errors import get_user_friendly_error, PromptVersionExistsError


def print_header(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_subtitle(title):
    print(f"\n--- {title} ---")


def init_database():
    print_header("0. 初始化数据库")
    init_db()
    print("✓ 数据库初始化完成")


def demo_prompt_version():
    print_header("1. 提示词版本导入（演示：重复导入不翻倍）")
    db = SessionLocal()
    service = PromptVersionService(db)

    print_subtitle("第一次导入版本 v1.0.0")
    version1, created = service.import_version(
        version_number="v1.0.0",
        content="请根据简历内容和职位要求，给出详细的匹配解释...",
        imported_by="小乔",
        description="第一版匹配提示词"
    )
    print(f"  版本号: {version1.version_number}")
    print(f"  是否新建: {created}")

    print_subtitle("重复导入同一版本 v1.0.0")
    version2, created = service.import_version(
        version_number="v1.0.0",
        content="新的内容...",
        imported_by="小乔"
    )
    print(f"  版本号: {version2.version_number}")
    print(f"  是否新建: {created} (已存在，跳过，数量不翻倍)")

    print_subtitle("批量导入（混合新旧版本）")
    batch_result = service.batch_import([
        {"version_number": "v1.0.0", "content": "旧内容", "description": "已存在"},
        {"version_number": "v1.1.0", "content": "优化了匹配逻辑", "description": "优化版"},
        {"version_number": "v2.0.0", "content": "全新架构", "description": "重大更新"},
    ], imported_by="小乔")
    print(f"  总数: {batch_result['total']}")
    print(f"  新建: {batch_result['created']}")
    print(f"  跳过: {batch_result['skipped']}")

    vid = version1.id
    db.close()
    return vid


def demo_match_explanation_and_override(prompt_version_id):
    print_header("2. 人工改判 + 批跑覆盖 + 安全审核复核")
    db = SessionLocal()
    service = MatchExplanationService(db)

    print_subtitle("2.1 创建匹配解释记录")
    exp = service.create_explanation(
        resume_id="RES-001",
        job_id="JOB-001",
        explanation="候选人具备3年Python开发经验，匹配度85%",
        prompt_version_id=prompt_version_id,
        created_by="系统",
        match_score=85
    )
    print(f"  创建记录 ID={exp.id}, 状态={exp.status}")

    print_subtitle("2.2 人工改判")
    override = service.create_manual_override(
        explanation_id=exp.id,
        new_explanation="候选人具备5年Python开发经验，另有团队管理经验，匹配度95%",
        new_status=MatchStatus.MANUAL_OVERRIDDEN,
        overridden_by="招聘经理",
        reason="实际工作经验更长，且有管理经验"
    )
    exp = service.get_by_id(exp.id)
    print(f"  改判后状态: {exp.status}")
    print(f"  改判原因: {override.reason}")

    print_subtitle("2.3 批跑覆盖人工改判")
    batch_result = service.batch_run_update([
        {
            "id": exp.id,
            "explanation": "系统重新评估：候选人具备3年Python经验，匹配度85%",
            "match_score": 85
        }
    ], run_by="系统批跑")
    exp = service.get_by_id(exp.id)
    print(f"  批跑后状态: {exp.status}")
    print(f"  需复核: {exp.needs_review}")
    print(f"  待复核列表数量: {len(batch_result['needs_review'])}")

    print_subtitle("2.4 安全审核同事复核（驳回，回滚到人工改判）")
    reviewed = service.review_override(
        explanation_id=exp.id,
        approved=False,
        reviewed_by="安全审核同事",
        review_note="确认人工改判正确，系统评估有误"
    )
    eid = exp.id
    print(f"  复核后状态: {reviewed.status}")
    print(f"  需复核: {reviewed.needs_review}")
    print(f"  当前解释: {reviewed.explanation[:60]}...")

    db.close()
    return eid


def demo_history_tracking(explanation_id):
    print_header("3. 历史记录追踪（改前改后清晰可见）")
    db = SessionLocal()
    service = ChangeHistoryService(db)

    history = service.get_history_for_explanation(explanation_id)
    print(f"  共 {len(history)} 条历史记录:\n")

    for i, record in enumerate(history, 1):
        print(f"  [{i}] {record.changed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"      类型: {record.change_type}")
        print(f"      操作人: {record.changed_by}")
        if record.diff_summary:
            print(f"      变更: {record.diff_summary}")
        if record.old_value and record.new_value:
            old = str(record.old_value)[:40]
            new = str(record.new_value)[:40]
            print(f"      旧值: {old}")
            print(f"      新值: {new}")
        print()

    db.close()


def demo_knowledge_remark_and_evaluation(prompt_version_id):
    print_header("4. 知识库备注修改 → 评测报告指出受影响记录")
    db = SessionLocal()
    kb_service = KnowledgeBaseService(db)
    match_service = MatchExplanationService(db)
    eval_service = EvaluationService(db)

    print_subtitle("4.1 创建知识库引用")
    ref = kb_service.create_ref(
        ref_link="https://kb.example.com/match-rules/001",
        title="简历匹配评分标准",
        remark="初始版本备注",
        created_by="小乔"
    )
    print(f"  创建知识库引用 ID={ref.id}")

    print_subtitle("4.2 创建多条匹配解释并关联知识库")
    exp_ids = []
    for i in range(3):
        exp = match_service.create_explanation(
            resume_id=f"RES-00{i+2}",
            job_id=f"JOB-00{i+2}",
            explanation=f"测试匹配解释 {i+1}",
            prompt_version_id=prompt_version_id,
            created_by="系统",
            match_score=80 + i
        )
        kb_service.link_to_explanation(
            ref_id=ref.id,
            explanation_id=exp.id,
            linked_by="小乔"
        )
        exp_ids.append(exp.id)
        print(f"  创建并关联: 记录 ID={exp.id}")

    print_subtitle("4.3 小乔修改知识库备注（只改了一条备注）")
    kb_service.update_remark(
        ref_id=ref.id,
        new_remark="更新后的备注：评分标准已根据2024年调优指南更新",
        updated_by="小乔"
    )
    print("  ✓ 备注已修改")

    print_subtitle("4.4 生成当日评测报告")
    report = eval_service.generate_daily_report(generated_by="系统")
    print(f"  报告 ID={report.id}")
    print(f"  摘要: {report.summary}")
    print(f"  总变更记录: {report.total_records}")
    print(f"  备注修改影响: {report.remark_change_count} 条")
    print(f"  待安全审核复核: {report.pending_review_count} 条")

    print_subtitle("4.5 评测报告明细（受备注影响的记录）")
    items = eval_service.get_report_items(report.id)
    for item in items:
        if item.change_type == ChangeType.REMARK_CHANGE.value:
            print(f"  - 记录 ID={item.match_explanation_id}")
            print(f"    变更类型: {item.change_type}")
            print(f"    提示: {item.note}")

    db.close()


def demo_three_step_workflow():
    print_header("5. 三步标准流程串联")
    db = SessionLocal()
    service = WorkflowService(db)

    print_subtitle("执行三步流程")
    result = service.run_three_step_workflow(
        step1_data={
            "version_number": "v3.0.0",
            "content": "三步流程专用提示词",
            "description": "流程测试版本"
        },
        step2_data={
            "ref_link": "https://kb.example.com/ref/003",
            "title": "三步流程知识库",
            "remark": "初始备注"
        },
        operator="小乔"
    )

    print(f"  步骤1 - 提示词导入:")
    print(f"    版本号: {result['step1']['version_number']}")
    print(f"    新建: {result['step1']['created']}")

    print(f"  步骤2 - 知识库引用:")
    print(f"    引用ID: {result['step2']['ref_id']}")
    print(f"    链接: {result['step2']['ref_link']}")

    print(f"  步骤3 - 评测报告:")
    print(f"    报告ID: {result['step3']['report_id']}")
    print(f"    摘要: {result['step3']['summary']}")

    print(f"  当前待复核: {len(result['pending_review'])} 条")
    if result['pending_review']:
        for item in result['pending_review']:
            print(f"    - ID={item['id']}, 状态={item['status']}")

    db.close()


def demo_friendly_errors():
    print_header("6. 友好错误提示（说人话，不吐内部字段名）")
    db = SessionLocal()
    service = PromptVersionService(db)

    print_subtitle("尝试重复导入时的错误提示")
    try:
        service.import_version(
            version_number="v1.0.0",
            content="测试",
            imported_by="测试用户"
        )
    except Exception as e:
        user_msg = get_user_friendly_error(e)
        print(f"  ✓ 用户看到: {user_msg}")
        print(f"  - 技术细节: {e.detail if hasattr(e, 'detail') else str(e)}")

    print_subtitle("缺少必填项时的错误提示")
    try:
        service.import_version(
            version_number="",
            content="测试",
            imported_by="测试用户"
        )
    except Exception as e:
        user_msg = get_user_friendly_error(e)
        print(f"  ✓ 用户看到: {user_msg}")

    db.close()


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║     招聘简历匹配解释系统 - 完整功能演示                  ║")
    print("╚" + "═" * 58 + "╝")

    try:
        init_database()
        prompt_version_id = demo_prompt_version()
        explanation_id = demo_match_explanation_and_override(prompt_version_id)
        demo_history_tracking(explanation_id)
        demo_knowledge_remark_and_evaluation(prompt_version_id)
        demo_three_step_workflow()
        demo_friendly_errors()

        print("\n" + "=" * 60)
        print("  ✓ 所有演示完成！")
        print("=" * 60)
        print("\n  详细边界规则请查看 README.md")
        print()

    except Exception as e:
        print(f"\n✗ 演示出错: {get_user_friendly_error(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
