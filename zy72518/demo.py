#!/usr/bin/env python3
"""
会议纪要待办抽取系统 - 完整演示脚本
演示三步核心流程、冲突检测、人工改判、安全审核等功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models import (
    TodoExtract, GrayBatch, DesensitizationRule,
    ManualJudgment, ImportBatch
)
from services.workflow_service import (
    step1_import_desensitization_rules,
    step2_xiaomeng_review_gray_batch,
    step3_update_evaluation_report,
    get_workflow_status
)
from services.conflict_service import detect_desensitization_conflicts, resolve_conflict
from services.audit_service import create_manual_judgment, mark_judgment_overridden, get_review_traces
from services.self_check_service import run_all_self_checks
from services.security_review_service import (
    get_pending_security_reviews,
    review_security_item,
    get_security_review_statistics,
    get_overridden_items_for_review
)
from services.unified_data_service import UnifiedDataService


def init_db():
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def demo():
    db = init_db()
    print("会议纪要待办抽取系统 - 完整功能演示")
    print("=" * 80)

    try:
        print_separator("第一步：导入脱敏规则（业务同事导入）")
        rules_data = [
            {
                "rule_name": "用户手机号脱敏",
                "rule_type": "phone",
                "match_pattern": r"1[3-9]\d{9}",
                "desensitization_level": "high",
                "note": "用户手机号必须严格脱敏，涉及用户隐私",
                "version": "v1.0",
                "created_by": "业务同事-小王"
            },
            {
                "rule_name": "会议内部备注脱敏",
                "rule_type": "internal_note",
                "match_pattern": r"【内部.*?】",
                "desensitization_level": "medium",
                "note": "会议内部备注需中等脱敏，可例外处理",
                "version": "v1.0",
                "created_by": "业务同事-小王"
            },
            {
                "rule_name": "财务数据脱敏",
                "rule_type": "finance",
                "match_pattern": r"\d+(\.\d{2})?元",
                "desensitization_level": "high",
                "note": "财务数据必须脱敏，无例外",
                "version": "v1.0",
                "created_by": "业务同事-小王"
            }
        ]
        rules, import_batch = step1_import_desensitization_rules(
            db, rules_data, "业务同事-小王", "脱敏规则表_v1.0.xlsx"
        )
        print(f"✓ 导入批次: {import_batch.batch_id}")
        print(f"✓ 成功导入: {len(rules)} 条规则")
        print(f"✓ 重复跳过: {import_batch.duplicate_count} 条")
        for rule in rules:
            print(f"  - {rule.rule_name}: {rule.desensitization_level} ({rule.note[:30]}...)")

        print_separator("创建灰度批次和示例待办数据")
        gray_batch = GrayBatch(
            batch_name="灰度批次-2024-06-第一晚",
            batch_code="GRAY_20240601_NIGHT",
            model_version="GPT-4-0613",
            gray_ratio=0.3,
            expected_desensitization_level="low",
            note="灰度批次一晚到，期望降低脱敏级别提高可用性",
            status="draft",
            created_by="模型团队"
        )
        db.add(gray_batch)
        db.flush()
        print(f"✓ 创建灰度批次: {gray_batch.batch_name} (ID: {gray_batch.id})")
        print(f"  期望脱敏级别: {gray_batch.expected_desensitization_level}")
        print(f"  备注: {gray_batch.note}")

        todos_data = [
            {
                "meeting_id": "M20240601001",
                "meeting_title": "Q2产品规划讨论会",
                "todo_content": "请张总在6月15日前完成用户手机号138****1234的回访工作，【内部备注：张总关系户可特殊处理】",
                "assignee": "张总",
                "deadline": "2024-06-15",
                "priority": "high",
                "desensitization_level": "medium",
                "desensitization_note": "按规则需high脱敏，但此条为例外，可medium脱敏",
                "import_batch_id": import_batch.batch_id,
                "source_version": "v1.0"
            },
            {
                "meeting_id": "M20240601001",
                "meeting_title": "Q2产品规划讨论会",
                "todo_content": "财务部需在6月10日前提交100000.00元预算审批表",
                "assignee": "李财务",
                "deadline": "2024-06-10",
                "priority": "high",
                "desensitization_level": "high",
                "desensitization_note": "财务数据严格脱敏，必须high级别",
                "import_batch_id": import_batch.batch_id,
                "source_version": "v1.0"
            },
            {
                "meeting_id": "M20240601002",
                "meeting_title": "技术周会",
                "todo_content": "技术团队在6月20日前完成系统升级，涉及用户159****8888的反馈",
                "assignee": "王工",
                "deadline": "2024-06-20",
                "priority": "medium",
                "desensitization_level": "high",
                "desensitization_note": "用户手机号按规则high脱敏",
                "import_batch_id": import_batch.batch_id,
                "source_version": "v1.0"
            }
        ]
        for todo_data in todos_data:
            todo = TodoExtract(**todo_data)
            todo.gray_batch_id = gray_batch.id
            db.add(todo)
        db.commit()
        print(f"✓ 创建 {len(todos_data)} 条待办抽取记录，关联灰度批次")

        print_separator("第二步：模型评测同事小孟补看灰度批次")
        print("（自动检测脱敏规则备注与灰度批次的冲突）")
        batch, conflicts, self_check_summary = step2_xiaomeng_review_gray_batch(
            db, gray_batch.id, "模型评测-小孟", "审阅完成，发现冲突需确认"
        )
        print(f"✓ 审阅人: {batch.reviewed_by}")
        print(f"✓ 审阅时间: {batch.reviewed_at}")
        print(f"✓ 发现冲突: {len(conflicts)} 个")
        for i, conflict in enumerate(conflicts, 1):
            print(f"\n  冲突 #{i}:")
            print(f"    类型: {conflict.conflict_type}")
            print(f"    待办ID: {conflict.todo_id}")
            print(f"    规则值: {conflict.rule_value}")
            print(f"    批次值: {conflict.batch_value}")
            print(f"    描述: {conflict.description[:60]}...")
            print(f"    证据摘要: {conflict.evidence.get('contradiction_point', '')}")

        print(f"\n✓ 自检结果:")
        print(f"  通过: {self_check_summary['passed']}/{self_check_summary['total_checks']}")
        print(f"  警告: {self_check_summary['warnings']} 项")
        print(f"  总问题: {self_check_summary['total_issues']} 个")

        print_separator("小孟处理冲突：不自动拍板，人工确认或驳回")
        if conflicts:
            print("处理第一个冲突：确认按脱敏规则备注执行（需安全审核）")
            resolved = resolve_conflict(
                db, conflicts[0].id, "confirm",
                "确认按业务备注的例外处理，提交安全审核",
                "模型评测-小孟"
            )
            print(f"✓ 冲突 #{conflicts[0].id} 已确认")
            print(f"  处理方式: {resolved.resolution}")
            print(f"  处理人: {resolved.resolved_by}")
            print(f"  备注: {resolved.resolution_note}")

            if len(conflicts) > 1:
                print("\n处理第二个冲突：驳回，按灰度批次期望执行")
                resolved2 = resolve_conflict(
                    db, conflicts[1].id, "reject",
                    "按灰度批次降低脱敏级别，此条无需例外",
                    "模型评测-小孟"
                )
                print(f"✓ 冲突 #{conflicts[1].id} 已驳回")
                print(f"  处理方式: {resolved2.resolution}")
                print(f"  处理人: {resolved2.resolved_by}")

        print_separator("人工改判场景演示")
        todo_for_judgment = db.query(TodoExtract).filter(
            TodoExtract.meeting_id == "M20240601002"
        ).first()
        if todo_for_judgment:
            print(f"待办 #{todo_for_judgment.id}: 人工改判脱敏级别")
            print(f"  原脱敏级别: {todo_for_judgment.desensitization_level}")
            todo, judgment = create_manual_judgment(
                db, todo_for_judgment.id, "安全审核-老陈",
                {"desensitization_level": "medium", "status": "confirmed"},
                "经核查，此条待办不涉及敏感信息，可降低脱敏级别"
            )
            print(f"✓ 人工改判完成")
            print(f"  改判人: {judgment.judge_by}")
            print(f"  改判原因: {judgment.reason}")
            print(f"  变更字段: {judgment.changed_fields}")
            print(f"  影响分析: {judgment.impact_analysis.get('downstream_impact', [])}")

        print_separator("模拟：下一批次批跑覆盖人工改判")
        print("（重点：人工改判被覆盖时，别急着归正常，留给安全审核）")
        new_gray_batch = GrayBatch(
            batch_name="灰度批次-2024-06-第二晚",
            batch_code="GRAY_20240602_NIGHT",
            model_version="GPT-4-0613",
            gray_ratio=0.5,
            expected_desensitization_level="high",
            note="第二批灰度，统一调整为high脱敏",
            status="draft",
            created_by="模型团队"
        )
        db.add(new_gray_batch)
        db.flush()
        print(f"✓ 创建新灰度批次: {new_gray_batch.batch_name}")

        if todo_for_judgment:
            mark_judgment_overridden(
                db, todo_for_judgment.id, new_gray_batch.id,
                {"desensitization_level": "high", "gray_batch_id": new_gray_batch.id}
            )
            db.refresh(todo_for_judgment)
            print(f"✓ 待办 #{todo_for_judgment.id} 已被批次覆盖")
            print(f"  被覆盖: {todo_for_judgment.is_overridden_by_batch}")
            print(f"  覆盖批次: {todo_for_judgment.overridden_by_batch_id}")
            print(f"  需要安全审核: {todo_for_judgment.needs_security_review}")
            print(f"  安全审核状态: {todo_for_judgment.security_review_status}")

        print_separator("安全审核：复核被覆盖的人工改判")
        stats = get_security_review_statistics(db)
        print(f"安全审核统计:")
        print(f"  待审核: {stats['total_pending']} 条")
        print(f"  已通过: {stats['total_approved']} 条")
        print(f"  已驳回: {stats['total_rejected']} 条")
        print(f"  被覆盖待审核: {stats['overridden_pending']} 条")
        print(f"  提示: {stats['note']}")

        overridden_items = get_overridden_items_for_review(db)
        print(f"\n被覆盖的待审核项 ({len(overridden_items)} 条):")
        for item in overridden_items:
            print(f"\n  待办 #{item['todo_id']}:")
            print(f"    会议: {item['meeting_title']}")
            print(f"    原人工判脱敏级别: {item['original_desensitization_level']}")
            print(f"    当前批次级别: {item['current_desensitization_level']}")
            print(f"    人工改判人: {item['manual_judged_by']}")
            print(f"    改判原因: {item['judgment_reason']}")
            print(f"    审核状态: {item['security_review_status']}")

        if overridden_items:
            print("\n安全审核同事复核第一条：审核通过")
            reviewed = review_security_item(
                db, overridden_items[0]["todo_id"], "安全审核-老陈",
                "approved", "经复核，批次覆盖合理，确认执行"
            )
            print(f"✓ 待办 #{reviewed.id} 安全审核通过")
            print(f"  审核人: {reviewed.security_review_by}")
            print(f"  审核状态: {reviewed.security_review_status}")
            print(f"  是否仍需审核: {reviewed.needs_security_review}")

        print_separator("复核追踪：查看完整变更历史")
        if todo_for_judgment:
            traces = get_review_traces(db, todo_for_judgment.id)
            print(f"待办 #{traces['todo_id']} 的完整复核追踪:")
            print(f"  当前状态: {traces['current_status']}")
            print(f"  当前脱敏级别: {traces['current_desensitization_level']}")
            print(f"  是否人工改判: {traces['is_manual_judgment']}")
            print(f"  是否被批次覆盖: {traces['is_overridden_by_batch']}")
            print(f"  需要安全审核: {traces['needs_security_review']}")

            print(f"\n  人工改判历史 ({len(traces['manual_judgments'])} 条):")
            for j in traces['manual_judgments']:
                print(f"    - {j['judge_at']} {j['judge_by']}:")
                print(f"      变更: {j['changed_fields']}")
                print(f"      原因: {j['reason']}")
                print(f"      是否被覆盖: {j['is_overridden']}")

            print(f"\n  审计日志 ({len(traces['audit_logs'])} 条):")
            for a in traces['audit_logs'][:3]:
                print(f"    - {a['created_at']} {a['actor']} 执行 {a['action']}:")
                print(f"      变更字段: {a['changed_fields']}")
                print(f"      原因: {a['reason']}")

        print_separator("统一数据源验证：导出、页面、接口一致性")
        page_data = UnifiedDataService.get_page_data(db, page=1, page_size=10, gray_batch_id=gray_batch.id)
        api_data = UnifiedDataService.get_api_response(db, gray_batch_id=gray_batch.id)
        export_content, export_record = UnifiedDataService.export_todos(
            db, export_format="json", gray_batch_id=gray_batch.id, exported_by="演示"
        )

        print(f"页面数据哈希: {page_data['data_hash'][:32]}...")
        print(f"API数据哈希:  {api_data['data_hash'][:32]}...")
        print(f"导出数据哈希: {export_record.data_hash[:32]}...")
        print(f"\n✓ 三者哈希一致: {page_data['data_hash'] == api_data['data_hash'] == export_record.data_hash}")
        print(f"  数据条数: {page_data['total']} 条")
        print(f"  导出记录ID: {export_record.id}")

        print_separator("运行全部自检")
        check_results = run_all_self_checks(db, "演示系统")
        print(f"自检完成:")
        for r in check_results:
            icon = "✓" if r.status == "passed" else "⚠"
            print(f"  {icon} {r.check_name}: {r.status} ({r.issues_found} 个问题)")

        print_separator("第三步：更新评测报告")
        report = step3_update_evaluation_report(db, gray_batch.id, "模型评测-小孟")
        print(f"✓ 评测报告生成完成 (ID: {report.id})")
        print(f"  准确率: {report.accuracy_rate:.2%}")
        print(f"  召回率: {report.recall_rate:.2%}")
        print(f"  F1分数: {report.f1_score:.4f}")
        print(f"  冲突数: {report.conflict_count}")
        print(f"  人工改判数: {report.manual_judgment_count}")
        print(f"  待安全审核数: {len(report.report_content.get('pending_review_items', []))}")

        print_separator("查看完整工作流状态")
        status = get_workflow_status(db, gray_batch.id)
        print(f"批次: {status['batch_name']}")
        print(f"当前阶段: {status['current_step']}")
        for step_name, step_info in status['steps'].items():
            icon = "✓" if step_info['status'] == 'completed' else "○"
            print(f"  {icon} {step_name}: {step_info['description']}")

        print_separator("演示完成！总结")
        print("""
已实现的核心功能：
1. ✓ 脱敏规则备注与灰度批次冲突检测
   - 自动检测矛盾点，列出完整证据
   - 由小孟确认或驳回，不自动拍板

2. ✓ 四大自检能力
   - 重复导入检测
   - 人工改判被下一次批跑覆盖检测
   - 补录后重算一致性检测
   - 导出一致性校验

3. ✓ 统一数据源
   - 导出明细、页面展示、API接口读取同一份数据
   - 通过数据哈希确保一致性

4. ✓ 完整复核追踪
   - 谁改了什么、为什么改
   - 改完影响哪些结果（影响分析）
   - 完整审计日志

5. ✓ 三步核心流程
   - 第一步：脱敏规则第一次导入
   - 第二步：小孟补看灰度批次（含冲突检测）
   - 第三步：评测报告更新

6. ✓ 安全审核机制
   - 人工改判被下一次批跑覆盖时，不自动归正常
   - 留给安全审核同事复核
        """)

    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    demo()
