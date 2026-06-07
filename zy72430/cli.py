import sys
import json
from datetime import datetime
from models import RecordStatus
from demo_data import create_demo_records, DEMO_GROUP_CHAT_SNIPPET, DEMO_CONTRACT_SNIPPET
from processor import MusicUseProcessor


def print_separator(char="=", length=70):
    print(char * length)


def print_header(title):
    print_separator()
    print(f"  {title}")
    print_separator()


def format_datetime(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def print_evidence_summary(record):
    evidence = record.get_evidence_summary()
    print(f"  📋 证据摘要:")
    print(f"     - 排练群消息数: {evidence.group_chat_count} 条")
    print(f"     - 合同页截图: {'✅ 有' if evidence.has_contract_screenshot else '❌ 无'}")
    if evidence.contract_no:
        print(f"     - 合同编号: {evidence.contract_no}")
    print(f"     - 最后更新人: {evidence.last_update_source}")


def print_royalty_detail(record):
    if not record.royalty:
        print(f"  💰 分账明细: 暂无")
        return
    r = record.royalty
    print(f"  💰 分账明细:")
    print(f"     - 曲目: {r.music_name} - {r.artist}")
    print(f"     - 使用次数: {r.use_count} 次")
    print(f"     - 单价: {r.unit_price:.2f} 元")
    print(f"     - 费率: {int(r.fee_rate * 100)}%")
    print(f"     - 合计: {r.total_amount:.2f} 元")
    print(f"     - 结算状态: {r.settlement_status}")


def print_processing_history(record):
    print(f"  📜 处理历史 (共 {len(record.processing_history)} 步):")
    for i, step in enumerate(record.processing_history, 1):
        print(f"     {i}. [{format_datetime(step.timestamp)}] {step.operator}")
        print(f"        → 步骤: {step.step_name}")
        print(f"        → 动作: {step.action}")
        if step.remark:
            print(f"        → 备注: {step.remark}")


def print_record_detail(record, index, total):
    status_colors = {
        RecordStatus.NORMAL: "✅",
        RecordStatus.PENDING_REVIEW: "⚠️",
        RecordStatus.CONTRACT_SUPPLEMENTED: "📎",
        RecordStatus.FIXED: "🔧",
        RecordStatus.NEEDS_MANUAL_FIX: "❌",
    }
    icon = status_colors.get(record.status, "❓")

    print(f"\n{icon} 记录 {index}/{total}: {record.record_id}")
    print_separator("-", 70)
    print(f"  🎬 视频: {record.video_title} ({record.video_id})")
    print(f"  🎵 音乐: {record.music_name} - {record.artist}")
    print(f"  📌 类型: {record.use_type.value}")
    print(f"  🚦 状态: {record.status.value}")
    print(f"  📝 当前口径: {record.current_caliber}")
    if record.notes:
        print(f"  💬 备注: {record.notes}")
    print()
    print_evidence_summary(record)
    print()
    print_royalty_detail(record)
    print()
    print_processing_history(record)
    print()


def print_run_result(result):
    print_header(f"运行结果: {result.run_id}")
    print(f"  运行时间: {format_datetime(result.run_time)}")
    print(f"  记录总数: {result.total_records}")
    print()
    print(f"  统计分布:")
    print(f"    ✅ 正常: {result.normal_count} 条")
    print(f"    ⚠️  待票务复核: {result.pending_count} 条")
    print(f"    🔧 已人工修正: {result.fixed_count} 条")
    print(f"    📎 合同补录: {result.contract_supplemented_count} 条")
    print()

    for i, record in enumerate(result.records, 1):
        print_record_detail(record, i, result.total_records)


def print_three_scenarios_summary(records):
    print_header("三种处理结果对比")
    print()
    print(f"  {'记录ID':<10} {'场景类型':<20} {'状态':<15} {'分账金额':<12} {'结算状态':<15}")
    print_separator("-", 70)
    for r in records:
        amount = f"{r.royalty.total_amount:.2f}元" if r.royalty else "-"
        print(f"  {r.record_id:<10} {r.notes:<20} {r.status.value:<15} {amount:<12} {r.royalty.settlement_status if r.royalty else '-':<15}")
    print()
    print("  差异说明:")
    print("  • REC-001 顺利记录: 流程完整，分账正常计算")
    print("  • REC-002 临时替补群消息: 仅1条群消息无接龙，暂缓分账待票务复核")
    print("  • REC-003 合同页截图补录: 旧口径错误，补录合同后修正分账")
    print()


def print_rerun_commands():
    print_header("可重新跑的命令")
    print()
    print("  以下命令可直接复制执行，重新跑不同场景：")
    print()
    print("  1. 跑正常材料（完整流程）:")
    print(f"     python3 {sys.argv[0]} --mode normal")
    print()
    print("  2. 跑错口径材料（演示问题发现）:")
    print(f"     python3 {sys.argv[0]} --mode wrong-caliber")
    print()
    print("  3. 跑补录材料（合同页截图补录后重跑）:")
    print(f"     python3 {sys.argv[0]} --mode supplemented")
    print()
    print("  4. 完整三步流程演示（推荐给新人讲流程）:")
    print(f"     python3 {sys.argv[0]} --mode full-workflow")
    print()
    print("  5. 查看原始证据样例:")
    print(f"     python3 {sys.argv[0]} --show-evidence")
    print()
    print("  6. 输出JSON格式（API风格）:")
    print(f"     python3 {sys.argv[0]} --json")
    print()


def print_evidence_samples():
    print_header("原始证据样例")
    print("\n  📱 排练群接龙截图样例:")
    print(DEMO_GROUP_CHAT_SNIPPET)
    print("\n  📄 合同页截图样例:")
    print(DEMO_CONTRACT_SNIPPET)


def run_normal_mode():
    processor = MusicUseProcessor()
    records = create_demo_records()
    result = processor.run_batch(records)
    print_run_result(result)
    print_three_scenarios_summary(result.records)
    return result


def run_wrong_caliber_mode():
    print_header("跑错口径材料 - 演示问题发现")
    processor = MusicUseProcessor()
    records = create_demo_records()

    rec3 = next(r for r in records if r.record_id == "REC-003")
    rec3.contract_screenshot = None
    rec3.status = RecordStatus.NEEDS_MANUAL_FIX
    rec3.current_caliber = "错误口径：误以为是免费BGM"
    rec3.royalty = None
    rec3.processing_history = rec3.processing_history[:1]

    result = processor.run_batch(records)
    print_run_result(result)

    print_header("问题发现")
    print(f"\n  ❌ REC-003 口径异常:")
    print(f"     - 当前口径: {rec3.current_caliber}")
    print(f"     - 无合同页截图匹配")
    print(f"     - 分账明细缺失，无法结算")
    print(f"\n  → 下一步: 通知巡演统筹阿梅核查，补录合同页截图")
    print()
    return result


def run_supplemented_mode():
    print_header("跑补录材料 - 合同页截图补录后重跑")
    processor = MusicUseProcessor()
    records = create_demo_records()

    rec3 = next(r for r in records if r.record_id == "REC-003")
    rec3.status = RecordStatus.NEEDS_MANUAL_FIX
    rec3.royalty = None
    rec3.processing_history = rec3.processing_history[:2]

    print("\n  补录前状态:")
    print(f"    REC-003: {rec3.status.value}, 无分账")
    print(f"\n  ▶ 执行: 巡演统筹阿梅补录合同页截图")
    rec3 = processor.supplement_contract(rec3, rec3.contract_screenshot, "巡演统筹-阿梅")
    print(f"    合同编号: {rec3.contract_screenshot.contract_no}")
    print(f"    费用口径: {int(rec3.contract_screenshot.fee_rate * 100)}%")
    print(f"\n  ▶ 执行: 重跑分账明细")
    rec3 = processor.rerun_record(rec3)

    result = processor.run_batch(records)
    print_run_result(result)

    print_header("修正前后对比")
    print(f"\n  修正前: 错误口径（误以为免费） → 分账: 0元, 状态: 需人工修正")
    print(f"  修正后: 合同口径（5%费率）   → 分账: {rec3.royalty.total_amount}元, 状态: 合同补录")
    print(f"\n  ✅ 历史记录已保留，分账明细和历史记录可对上")
    print()
    return result


def run_full_workflow():
    processor = MusicUseProcessor()
    records = create_demo_records()
    for r in records:
        r.processing_history = []
        r.royalty = None

    result, steps_log = processor.run_full_workflow_demo(records)

    for line in steps_log:
        print(line)

    print()
    print_run_result(result)
    print_three_scenarios_summary(result.records)

    print_header("关键细节说明")
    print()
    print("  ⚠️  临时替补处理规则:")
    print("     当碰到「临时替补只在群里说了一句」（REC-002）时，")
    print("     系统不会自动归为正常，而是标记【待票务复核】，")
    print("     留给票务同事确认后再处理。")
    print()
    print("  📎 合同补录追溯:")
    print("     REC-003 保留了首次错误口径的历史记录，")
    print("     补录合同后重跑，新旧口径和分账变化清晰可查。")
    print()

    return result


def output_json():
    processor = MusicUseProcessor()
    records = create_demo_records()
    result = processor.run_batch(records)

    output = {
        "run_id": result.run_id,
        "run_time": result.run_time.isoformat(),
        "summary": {
            "total": result.total_records,
            "normal": result.normal_count,
            "pending_review": result.pending_count,
            "fixed": result.fixed_count,
            "contract_supplemented": result.contract_supplemented_count
        },
        "records": []
    }

    for r in result.records:
        evidence = r.get_evidence_summary()
        record_data = {
            "record_id": r.record_id,
            "video_id": r.video_id,
            "video_title": r.video_title,
            "music_name": r.music_name,
            "artist": r.artist,
            "use_type": r.use_type.value,
            "status": r.status.value,
            "current_caliber": r.current_caliber,
            "evidence_summary": {
                "group_chat_count": evidence.group_chat_count,
                "has_contract_screenshot": evidence.has_contract_screenshot,
                "contract_no": evidence.contract_no,
                "last_update_source": evidence.last_update_source
            },
            "royalty": {
                "total_amount": r.royalty.total_amount,
                "fee_rate": r.royalty.fee_rate,
                "settlement_status": r.royalty.settlement_status
            } if r.royalty else None,
            "processing_steps": [
                {
                    "step": s.step_name,
                    "operator": s.operator,
                    "time": s.timestamp.isoformat(),
                    "action": s.action,
                    "remark": s.remark
                } for s in r.processing_history
            ]
        }
        output["records"].append(record_data)

    print(json.dumps(output, ensure_ascii=False, indent=2))


def main():
    args = sys.argv[1:]

    if not args or "--mode normal" in " ".join(args):
        run_normal_mode()
        print_rerun_commands()
        return

    if "--mode wrong-caliber" in " ".join(args):
        run_wrong_caliber_mode()
        print_rerun_commands()
        return

    if "--mode supplemented" in " ".join(args):
        run_supplemented_mode()
        print_rerun_commands()
        return

    if "--mode full-workflow" in " ".join(args):
        run_full_workflow()
        print_rerun_commands()
        return

    if "--show-evidence" in args:
        print_evidence_samples()
        return

    if "--json" in args:
        output_json()
        return

    if "--help" in args or "-h" in args:
        print_header("短视频配乐使用回看 - 使用说明")
        print_rerun_commands()
        return

    run_normal_mode()
    print_rerun_commands()


if __name__ == "__main__":
    main()
