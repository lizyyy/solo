import asyncio
import json
import sys
from sqlmodel import Session, select
from src.database import create_db_and_tables, engine
from src.models import QARecord, OperationLog, CheckResult
from src.checker import import_qa_records, run_single_check, update_gray_batch, manual_fix, run_batch_check


def print_section(title):
    print("\n" + "=" * 100)
    print(f"  📍 {title}")
    print("=" * 100)


def print_record_card(record, show_logs=False, show_checks=False):
    status_map = {
        "pending": "⏳ 待检查",
        "passed": "✅ 通过",
        "failed": "❌ 未通过",
        "conflict": "⚠️  冲突待复核",
        "manual_fixed": "🔧 已人工修正",
    }
    next_map = {
        "pm_review": "👔 产品经理复核",
        "editor_review": "📝 知识库编辑小乔处理",
        "complete": "✅ 流程结束",
        None: "—",
    }
    url_map = {
        "valid": "✅ 正常",
        "invalid": "❌ 异常",
        "unknown": "⏳ 未检查",
        None: "（无链接）",
    }

    print(f"\n  ┌─────────────────────────────────────────────────────────────────────────────┐")
    print(f"  │ 📋 样本 #{record.id} 状态卡                                             │")
    print(f"  ├─────────────────────────────────────────────────────────────────────────────┤")
    print(f"  │ 当前状态   : {status_map.get(record.status, record.status):<50} │")
    print(f"  │ 问题摘要   : {record.question[:42]:<50} │")
    print(f"  │ 来源批次   : {(record.source_batch or '-'):<50} │")
    print(f"  │ 灰度批次   : {(record.gray_batch or '⚠️  未补录!'):<50} │")
    print(f"  ├─────────────────────────────────────────────────────────────────────────────┤")
    print(f"  │ 🔒 脱敏规则备注                                                             │")
    desens = record.desensitization_notes or "（无备注）"
    print(f"  │   → {desens:<60} │")
    print(f"  ├─────────────────────────────────────────────────────────────────────────────┤")
    print(f"  │ 📊 检查结果                                                                 │")
    print(f"  │   免责声明  : {'✅ 已包含' if record.has_disclaimer else '❌ 缺失!':<54} │")
    if record.disclaimer_text:
        kw = record.disclaimer_text[:45] + ("..." if len(record.disclaimer_text) > 45 else "")
        print(f"  │     关键词: {kw:<56} │")
    print(f"  │   引用链接  : {url_map.get(record.url_status):<54} │")
    if record.reference_url:
        u = record.reference_url[:50] + ("..." if len(record.reference_url) > 50 else "")
        print(f"  │     地址: {u:<58} │")
        if record.url_error:
            print(f"  │     错误: {record.url_error:<56} │")
    print(f"  ├─────────────────────────────────────────────────────────────────────────────┤")
    if record.conflict_reason or record.missing_materials or record.next_action:
        print(f"  │ ❓ 样本表为什么留下这一条                                                    │")
        if record.conflict_reason:
            r = record.conflict_reason[:55] + ("..." if len(record.conflict_reason) > 55 else "")
            print(f"  │   冲突原因: {r:<56} │")
        if record.missing_materials:
            m = record.missing_materials[:55] + ("..." if len(record.missing_materials) > 55 else "")
            print(f"  │   缺少材料: {m:<56} │")
        print(f"  │   下一步  : {next_map.get(record.next_action, '-'):<54} │")
        print(f"  │   复核人  : {(record.reviewer or '（尚未有人工复核）'):<54} │")
        if record.review_comment:
            c = record.review_comment[:55] + ("..." if len(record.review_comment) > 55 else "")
            print(f"  │   复核意见: {c:<56} │")
        print(f"  ├─────────────────────────────────────────────────────────────────────────────┤")

    if show_checks:
        with Session(engine) as ss:
            checks = ss.exec(
                select(CheckResult).where(CheckResult.qa_record_id == record.id).order_by(CheckResult.checked_at)
            ).all()
        if checks:
            print(f"  │ 🧪 检查明细 ({len(checks)} 次)                                                 │")
            for ck in checks:
                icon = "✅" if ck.check_passed else "❌"
                type_name = {"disclaimer_check": "免责声明", "url_check": "引用链接"}.get(ck.check_type, ck.check_type)
                run = ck.run_id or "-"
                print(f"  │   {icon} {type_name:<6} run={run:<10} : {ck.details[:44]:<46} │")
            print(f"  ├─────────────────────────────────────────────────────────────────────────────┤")

    if show_logs:
        with Session(engine) as ss:
            logs = ss.exec(
                select(OperationLog)
                .where(OperationLog.qa_record_id == record.id)
                .order_by(OperationLog.created_at)
            ).all()
        print(f"  │ 📜 操作历史 ({len(logs)} 条) — 谁改了什么 / 为什么改 / 改完影响                │")
        op_type_map = {
            "import": ("📥", "import"),
            "check_run": ("▶️", "check "),
            "field_update": ("🎯", "field "),
            "manual_fix": ("🔧", "manual"),
        }
        for log in logs:
            icon, tag = op_type_map.get(log.operation_type, ("•", log.operation_type[:5]))
            t = log.created_at.strftime("%H:%M:%S")
            print(f"  │   {icon} [{tag}] {t} {log.operator:<6}                           │")
            if log.reason:
                rr = log.reason[:54] + ("..." if len(log.reason) > 54 else "")
                print(f"  │        原因: {rr:<56} │")
            if log.field_name and (log.old_value or log.new_value):
                f_map = {"status": "状态", "gray_batch": "灰度批次", "next_action": "下一步", "review_comment": "复核意见"}
                fn = f_map.get(log.field_name, log.field_name)
                ov = (log.old_value or "空")[:20]
                nv = (log.new_value or "空")[:20]
                print(f"  │        {fn}: {ov} → {nv:<40} │")
    print(f"  └─────────────────────────────────────────────────────────────────────────────┘")


async def run_three_step_demo():
    print("""
╔══════════════════════════════════════════════════════════════════════════════════╗
║   法律问答免责声明检查 · 三步核心流程验证                                        ║
║                                                                                  ║
║   第1步 → 脱敏规则备注第一次导入                                                 ║
║   第2步 → 系统自动检查（链接404不自动归正常，留给产品经理）                       ║
║   第3步 → 知识库编辑小乔补录灰度批次 → 冲突样本表自动更新                        ║
║                                                                                  ║
║   ✋  此处 STOP：停在「查看状态、历史留痕和结果说明」，不再走下一步               ║
╚══════════════════════════════════════════════════════════════════════════════════╝
    """)

    create_db_and_tables()

    print_section("▶ 第 1 步：第一次导入（带脱敏规则备注）")
    with open("demo_data.json", "r", encoding="utf-8") as f:
        demo_data = json.load(f)

    with Session(engine) as session:
        records = import_qa_records(session, demo_data, source_batch="batch_2024_w24_v1", operator="import_robot")

    print(f"  ✅ 成功导入 {len(records)} 条问答记录")
    print(f"     来源批次 : batch_2024_w24_v1")
    print(f"     导入时间 : {records[0].created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    for r in records:
        has_d = "✅ 有脱敏备注" if r.desensitization_notes else "⚠️  无脱敏备注"
        print(f"     #{r.id} {r.question[:28]}... {has_d}")

    print("\n  导入完成后的状态快照（所有记录均为待检查）：")
    for r in records:
        print_record_card(r)

    print_section("▶ 第 2 步：系统自动检查（免责声明 + 引用链接有效性）")
    print("  🔍 正在执行检查...")

    with Session(engine) as session:
        run_id = await run_batch_check(session, operator="check_engine_v1")

    print(f"  ✅ 批量检查完成，run_id = {run_id}")
    print(f"""
  检查规则说明：
    ├─ 免责声明检查：扫描关键词（免责声明、仅供参考、不构成法律意见...）
    ├─ 链接有效性检查：HEAD 请求检测 HTTP 状态码
    └─ 组合判定逻辑：
        ├─ 免责声明缺失            → failed，下一步 = 知识库编辑
        ├─ 免责声明有 + 链接正常    → passed，下一步 = complete
        └─ 免责声明有 + 链接 404    → ⚠️  conflict，下一步 = 产品经理复核
                                       （不自动归正常！必须人工介入）
    """)

    with Session(engine) as session:
        all_records = session.exec(select(QARecord).order_by(QARecord.id)).all()

    for r in all_records:
        print_record_card(r, show_checks=True)

    conflicts = [r for r in all_records if r.status == "conflict"]
    if conflicts:
        print(f"\n  ⚠️  共发现 {len(conflicts)} 条「引用链接404仍被判通过」的冲突样本，已全部标记为 conflict！")
        print(f"     👉 留给产品经理复核，未被误判为正常通过")

    print_section("▶ 第 3 步：知识库编辑小乔补录灰度批次 → 冲突样本表自动更新")
    print("""
  📝 场景：
    知识库编辑小乔每日复核时，发现刚才导入的 3 条样本都缺少灰度批次标记。
    她依次为所有冲突样本补录「gray_2024_w24_law_v2」，并记录补录原因。
    
    系统行为：补录灰度后，冲突样本表的「冲突原因」「缺少材料」会自动强化，
    明确写出"灰度批次[xxx]补录后确认：..."，并把缺少材料细化为"产品经理需确认..."。
    🔴 关键：即使补了灰度批次，链接 404 的冲突也不会自动消失！
    """)

    target_ids = [r.id for r in all_records if r.status == "conflict"]
    print(f"  小乔准备为以下冲突样本补录灰度批次：ID = {target_ids}")

    with Session(engine) as session:
        for rid in target_ids:
            updated = update_gray_batch(
                session,
                rid,
                gray_batch="gray_2024_w24_law_v2",
                operator="小乔",
                reason="例行灰度批次补录，对应知识库 v2.4.1 法务问答专项",
            )
            print(f"     ✅ 样本 #{rid} 补录成功，灰度批次 = {updated.gray_batch}")
            session.refresh(updated)

        all_updated = session.exec(select(QARecord).order_by(QARecord.id)).all()

    print("\n  补录后的冲突样本表更新结果（重点看冲突原因变化）：")
    for r in all_updated:
        if r.status == "conflict":
            print_record_card(r, show_logs=True)
        else:
            print_record_card(r)

    print_section("🛑 三步流程完成，停在此处查看——状态变化、历史留痕、结果说明")

    print("""
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ✅  状态变化核对                                                          │
  │     样本1（拖欠工资）: pending → conflict → conflict（仍在冲突，未放行）  │
  │     样本2（合同到期）: pending → failed（缺失免责声明）                    │
  │     样本3（试用期）  : pending → conflict → conflict（仍在冲突，未放行）  │
  │                                                                            │
  │  ✅  历史留痕核对（操作日志）                                              │
  │     每条样本至少包含:                                                      │
  │       [import] 从批次 batch_2024_w24_v1 导入                              │
  │       [check_run] 执行检查，run_id=xxxx                                    │
  │       [field_update] 小乔补录灰度批次 gray_2024_w24_law_v2                │
  │                                                                            │
  │  ✅  结果说明核对（冲突样本表字段）                                        │
  │     · 冲突原因  : 已强化为「灰度批次[xxx]补录后确认：引用链接异常...」      │
  │     · 缺少材料  : 已细化为「产品经理需确认：失效链接是否影响合规性」        │
  │     · 下一步    : 统一指向「产品经理复核」                                 │
  │     · 脱敏备注  : 完整保留导入时的原始内容                                 │
  │                                                                            │
  │  🔴 关键确认：引用链接 404 的样本没有被自动归为正常通过！                  │
  │     它们仍然停留在 conflict 状态，等待产品经理决策                         │
  └──────────────────────────────────────────────────────────────────────────┘
    """)

    print("""
  💡 业务人员可以通过以下入口查看：
    ├─ 小看板 UI  :  http://localhost:8080/       ← 浏览器打开查看
    ├─ API 接口   :  GET /api/records             ← 列表数据
    │               GET /api/records/{id}         ← 详情+日志
    └─ 命令行     :  python3 -m src.cli list      ← 冲突样本表
                    python3 -m src.cli detail 1  ← 样本1完整详情
    """)

    return all_updated


if __name__ == "__main__":
    asyncio.run(run_three_step_demo())
