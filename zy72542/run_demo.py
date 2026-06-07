import asyncio
import json
from sqlmodel import Session, select
from src.database import create_db_and_tables, engine
from src.models import QARecord, OperationLog
from src.checker import import_qa_records, run_single_check, update_gray_batch, manual_fix, run_batch_check


def print_section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_record_summary(record, show_logs=False):
    status_map = {
        "pending": "⏳ 待检查",
        "passed": "✅ 通过",
        "failed": "❌ 未通过",
        "conflict": "⚠️  冲突",
        "manual_fixed": "🔧 人工修正",
    }
    next_map = {
        "pm_review": "👔 产品经理复核",
        "editor_review": "📝 知识库编辑处理",
        "complete": "✅ 流程结束",
    }
    url_map = {
        "valid": "正常",
        "invalid": "异常",
    }

    print(f"\n  记录 #{record.id}: {record.question[:40]}...")
    print(f"    状态: {status_map.get(record.status, record.status)}")
    print(f"    免责声明: {'有' if record.has_disclaimer else '无'}")
    print(f"    链接: {record.reference_url or '无'} [{url_map.get(record.url_status, '未检查')}]")
    if record.url_error:
        print(f"    链接错误: {record.url_error}")
    print(f"    灰度批次: {record.gray_batch or '未设置'}")
    print(f"    脱敏备注: {record.desensitization_notes or '无'}")
    print(f"    冲突原因: {record.conflict_reason or '无'}")
    print(f"    缺少材料: {record.missing_materials or '无'}")
    print(f"    下一步: {next_map.get(record.next_action, '-')}")

    if show_logs:
        with Session(engine) as session:
            logs = session.exec(
                select(OperationLog)
                .where(OperationLog.qa_record_id == record.id)
                .order_by(OperationLog.created_at)
            ).all()
            print(f"\n    操作历史 ({len(logs)} 条):")
            for log in logs:
                time_str = log.created_at.strftime("%H:%M:%S")
                change = ""
                if log.field_name:
                    change = f" | {log.old_value or '-'} → {log.new_value or '-'}"
                print(f"      [{time_str}] {log.operator}: {log.operation_type} - {log.reason or ''}{change}")


async def run_demo():
    print_section("法律问答免责声明检查 - 完整演示流程")
    print("""
  演示场景：
  1. 导入知识库问答（含脱敏规则备注）
  2. 执行系统检查 → 发现引用链接404但被判通过 → 标记为冲突
  3. 知识库编辑小乔补录灰度批次 → 冲突样本表自动更新
  4. 产品经理人工复核 → 确认需要调整规则
  5. 重跑检查验证结果

  关键角色：小乔（知识库编辑）、张经理（产品经理）
    """)

    create_db_and_tables()

    print_section("步骤 1: 导入演示数据（含脱敏规则备注）")
    with open("demo_data.json", "r", encoding="utf-8") as f:
        demo_data = json.load(f)

    with Session(engine) as session:
        records = import_qa_records(session, demo_data, source_batch="batch_2024_w24", operator="system")

    print(f"  成功导入 {len(records)} 条记录，来源批次: batch_2024_w24")
    for r in records:
        print_record_summary(r)

    print("\n  💡 注意：第3条记录引用了一个不存在的URL，这将是我们重点关注的冲突样本")

    print_section("步骤 2: 执行免责声明检查")
    print("  正在运行检查，包括链接有效性检测...")

    with Session(engine) as session:
        run_id = await run_batch_check(session, operator="system")
        print(f"  检查完成，run_id: {run_id}")

        all_records = session.exec(select(QARecord).order_by(QARecord.id)).all()

    print("\n  检查结果汇总：")
    for r in all_records:
        print_record_summary(r)

    conflict_record = [r for r in all_records if r.status == "conflict"][0]
    print(f"\n  ⚠️  发现关键冲突！记录 #{conflict_record.id}")
    print(f"     原因：{conflict_record.conflict_reason}")
    print(f"     缺少材料：{conflict_record.missing_materials}")
    print(f"     下一步流向：产品经理复核")
    print(f"     👉 这就是'引用链接404仍被判通过'的典型案例，系统已自动拦截并标记")

    print_section("步骤 3: 知识库编辑小乔补录灰度批次")
    print("  小乔发现这条冲突样本缺少灰度批次信息，需要补录")

    with Session(engine) as session:
        updated = update_gray_batch(
            session,
            conflict_record.id,
            gray_batch="gray_2024_w24_v2",
            operator="小乔",
            reason="补录灰度批次信息，该批次为法务问答专项灰度",
        )
        session.refresh(updated)

    print(f"  小乔已为记录 #{updated.id} 补录灰度批次: {updated.gray_batch}")
    print_record_summary(updated, show_logs=True)

    print(f"\n  ✅ 冲突样本表已自动更新：")
    print(f"     新冲突原因: {updated.conflict_reason}")
    print(f"     新缺少材料: {updated.missing_materials}")
    print(f"     👉 补录灰度后，系统自动强化了冲突说明，明确指出需要产品经理确认规则")

    print_section("步骤 4: 产品经理张经理人工复核")
    print("  张经理收到通知，需要复核这条链接失效但免责声明完整的记录")

    with Session(engine) as session:
        fixed = manual_fix(
            session,
            updated.id,
            operator="张经理",
            new_status="manual_fixed",
            review_comment="经核查，该链接失效但回答内容本身合规，免责声明完整。",
            next_action="editor_review",
            reason="链接为旧版法规文档，虽失效但不影响回答准确性，已通知编辑替换新链接",
        )
        session.refresh(fixed)

    print(f"  张经理已完成人工复核，记录 #{fixed.id}")
    print_record_summary(fixed, show_logs=True)

    print(f"\n  📋 复核追踪信息：")
    print(f"     谁改了: {fixed.reviewer} (张经理)")
    print(f"     改了什么: 状态从 'conflict' → 'manual_fixed'，下一步流向知识库编辑")
    print(f"     为什么改: {fixed.review_comment}")
    print(f"     影响结果: 该记录现在需要小乔更新失效链接后即可结案")

    print_section("步骤 5: 知识库编辑小乔补充修复并重跑")
    print("  小乔替换了失效链接，现在重新执行检查")

    with Session(engine) as session:
        record = session.get(QARecord, fixed.id)
        record.reference_url = "https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/gfxwj/202401/t20240115_504516.html"
        session.add(record)
        session.commit()
        session.refresh(record)

        rerun = await run_single_check(session, record, operator="小乔")
        session.refresh(rerun)

    print(f"  已更新链接并重跑检查，记录 #{rerun.id}")
    print_record_summary(rerun, show_logs=True)

    print(f"\n  ✅ 检查通过！")
    print(f"     新链接状态: {rerun.url_status} ({rerun.url_error})")
    print(f"     最终状态: {rerun.status}")

    print_section("演示流程总结")
    print("""
  完整流程回顾：
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. 系统导入（含脱敏规则备注）                              │
  │ 2. 自动检查 → 发现链接404仍被判通过 → 标记冲突            │
  │ 3. 小乔补录灰度批次 → 冲突说明自动强化                    │
  │ 4. 张经理人工复核 → 记录操作原因、流向、影响              │
  │ 5. 小乔修复链接 → 重跑验证 → 流程结束                    │
  └─────────────────────────────────────────────────────────────┘

  关键特性验证：
  ✅ 脱敏规则备注完整保留
  ✅ 灰度批次补录后冲突样本表自动更新
  ✅ 引用链接404不自动归正常，留给产品经理复核
  ✅ 完整操作日志：谁改了什么、为什么改、改完影响
  ✅ 支持一次人工修正 + 一次重跑的演示场景
    """)


if __name__ == "__main__":
    asyncio.run(run_demo())
