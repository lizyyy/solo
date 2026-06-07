#!/usr/bin/env python3
import sys
from typing import Optional
from models import RecordStatus, IntentCategory
from intent_comparator import IntentComparator
from demo_data import create_demo_records


class Color:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(title: str):
    print(f"\n{Color.BOLD}{Color.CYAN}{'=' * 60}{Color.END}")
    print(f"{Color.BOLD}{Color.CYAN}  {title}{Color.END}")
    print(f"{Color.BOLD}{Color.CYAN}{'=' * 60}{Color.END}\n")


def print_status_tag(status: str) -> str:
    color_map = {
        "待复核": Color.YELLOW,
        "已确认": Color.GREEN,
        "重复计入": Color.RED,
        "已解决": Color.BLUE
    }
    color = color_map.get(status, "")
    return f"{color}[{status}]{Color.END}"


def print_kanban(comparator: IntentComparator):
    print_header("客服意图新旧模型对照 - 小看板")

    summary = comparator.get_records_summary()
    print(f"{Color.BOLD}📊 总览{Color.END}")
    print(f"  总计: {summary['total']} 条")
    for status, count in summary['status_breakdown'].items():
        print(f"  {print_status_tag(status)}: {count} 条")
    print()

    columns = [
        ("待复核", RecordStatus.PENDING),
        ("已确认", RecordStatus.CONFIRMED),
        ("重复计入", RecordStatus.DUPLICATE),
        ("已解决", RecordStatus.RESOLVED),
    ]

    col_width = 55
    print(f"{'─' * (col_width * 4 + 5)}")
    header = "│"
    for col_name, _ in columns:
        header += f" {col_name:^{col_width}} │"
    print(header)
    print(f"{'─' * (col_width * 4 + 5)}")

    records_by_col = {}
    max_rows = 0
    for col_name, status in columns:
        records = comparator.get_records_by_status(status)
        records_by_col[col_name] = records
        max_rows = max(max_rows, len(records))

    for row_idx in range(max_rows):
        row = "│"
        for col_name, _ in columns:
            records = records_by_col[col_name]
            if row_idx < len(records):
                r = records[row_idx]
                batch_tag = f"{Color.CYAN}▣{Color.END} " if r.gray_batch else ""
                duplicate_tag = f"{Color.RED}⧉{Color.END} " if r.status == RecordStatus.DUPLICATE else ""
                note_tag = f"{Color.YELLOW}✎{Color.END} " if r.annotation_notes else ""
                tags = batch_tag + duplicate_tag + note_tag

                content = r.content[:25] + "..." if len(r.content) > 25 else r.content
                cell = f" {tags}{r.feedback_id} | {content:<25} "
            else:
                cell = " " * (col_width + 1)
            row += f"{cell[:col_width + 1]}│"
        print(row)
    print(f"{'─' * (col_width * 4 + 5)}")
    print(f"\n{Color.CYAN}▣{Color.END}=灰度批次  {Color.RED}⧉{Color.END}=重复计入  {Color.YELLOW}✎{Color.END}=有标注留言")


def print_evidence_playback(comparator: IntentComparator, feedback_id: str):
    evidence = comparator.get_evidence_playback(feedback_id)
    if not evidence:
        print(f"{Color.RED}未找到记录: {feedback_id}{Color.END}")
        return

    print_header(f"证据回放 - {feedback_id}")

    print(f"{Color.BOLD}📋 基本信息{Color.END}")
    print(f"  反馈ID: {evidence['feedback_id']}")
    print(f"  用户ID: {evidence['user_id']}")
    print(f"  灰度批次: {Color.CYAN}{evidence['gray_batch']}{Color.END}")
    print(f"  状态: {print_status_tag(evidence['status'])}")
    print(f"  时间: {evidence['timestamp']}")

    if evidence['is_duplicate']:
        print(f"  {Color.RED}⚠ 重复记录，对应主记录: {evidence['duplicate_of']}{Color.END}")

    print(f"\n{Color.BOLD}💬 用户反馈原文{Color.END}")
    print(f"  {evidence['original_content']}")

    print(f"\n{Color.BOLD}🎯 意图识别对照{Color.END}")
    print(f"  旧模型: {evidence['old_model_intent']}")
    print(f"  新模型: {evidence['new_model_intent']}")
    if evidence['manual_correction']:
        print(f"  {Color.YELLOW}人工修正: {evidence['manual_correction']}{Color.END}")
    print(f"  {Color.BOLD}最终判定: {evidence['current_intent']}{Color.END}")

    if evidence['annotation_notes']:
        print(f"\n{Color.BOLD}📝 标注员留言{Color.END}")
        for i, note in enumerate(evidence['annotation_notes'], 1):
            official_tag = f"{Color.GREEN}[官方口径]{Color.END}" if note['is_official_caliber'] else ""
            print(f"  {i}. [{note['timestamp']}] {note['annotator']} {official_tag}")
            print(f"     {note['note']}")

    print(f"\n{Color.BOLD}📌 证据摘要{Color.END}")
    if evidence['has_official_caliber']:
        print(f"  {Color.GREEN}✓ 已有官方口径确认{Color.END}")
    else:
        print(f"  {Color.YELLOW}⚠ 暂无官方口径，需标注负责人复核{Color.END}")
    if evidence['intent_changed']:
        print(f"  {Color.YELLOW}⚠ 新旧模型判断有差异{Color.END}")
    if evidence['is_duplicate']:
        print(f"  {Color.RED}⚠ 存在重复计入，需去重{Color.END}")


def step_1_import_gray_batch(comparator: IntentComparator):
    print_header("第一步：灰度批次导入")
    print(f"{Color.BOLD}正在导入灰度批次数据...{Color.END}")
    records = create_demo_records()
    for r in records:
        r.status = RecordStatus.PENDING
        r.annotation_notes = []
        r.manual_correction = None
        r.duplicate_of = None
    comparator.load_records(records)
    print(f"{Color.GREEN}✓ 成功导入 {len(records)} 条记录{Color.END}")
    print(f"  灰度批次: {records[0].gray_batch}")

    print(f"\n{Color.BOLD}检测重复记录...{Color.END}")
    duplicates = comparator.detect_duplicates()
    if duplicates:
        print(f"{Color.YELLOW}⚠ 发现 {len(duplicates)} 组潜在重复记录：{Color.END}")
        for r1, r2, sim in duplicates:
            print(f"  - {r1.feedback_id} ↔ {r2.feedback_id} (相似度: {sim:.2%})")
            print(f"    {r1.content[:40]}...")
    else:
        print(f"{Color.GREEN}✓ 未发现重复记录{Color.END}")

    print(f"\n{Color.CYAN}提示: 重复记录已标记为【重复计入】，暂不归为正常，留给标注负责人复核{Color.END}")


def step_2_review_annotation_notes(comparator: IntentComparator):
    print_header("第二步：AI产品经理补看标注员留言")

    notes_to_add = [
        ("FB001", "标注员小王", "用户明确说'退掉'，结合上下文是退款不是换货，新模型判断正确", True),
        ("FB002", "标注员小李", "用户明确说'我要投诉'，新模型识别正确，旧模型漏了", True),
        ("FB003", "标注员小李", "和FB002是同一个用户同一通电话的重复录入，内容一致", False),
        ("FB005", "标注员小张", "一开始以为是咨询，细看用户说'用了过敏，帮我处理'，实际是售后诉求，按旧口径应该归为退货换货类", False),
    ]

    for fid, annotator, note, is_official in notes_to_add:
        comparator.add_annotation_note(fid, annotator, note, is_official)
        tag = f"{Color.GREEN}[官方口径]{Color.END}" if is_official else ""
        print(f"  {Color.GREEN}✓{Color.END} {fid}: {annotator} 留言 {tag}")
        print(f"    {note}")

    print(f"\n{Color.BOLD}补录旧口径官方修正...{Color.END}")
    comparator.add_annotation_note(
        "FB005",
        "标注负责人阿强",
        "按2024Q2旧口径，涉及商品质量问题的售后诉求统一归为退货换货，已补录",
        True
    )
    comparator.apply_manual_correction("FB005", IntentCategory.RETURN)
    print(f"  {Color.YELLOW}✎{Color.END} FB005: 标注负责人阿强 [官方口径]")
    print(f"    按2024Q2旧口径，涉及商品质量问题的售后诉求统一归为退货换货，已补录")
    print(f"    人工修正: {IntentCategory.CONSULT.value} → {Color.YELLOW}{IntentCategory.RETURN.value}{Color.END}")

    print(f"\n{Color.CYAN}提示: 标注员留言补录完成，官方口径已生效{Color.END}")


def step_3_update_evidence_playback(comparator: IntentComparator):
    print_header("第三步：证据回放更新 & 重跑")

    print(f"{Color.BOLD}重新运行对照逻辑...{Color.END}")
    comparator.rerun_comparison()
    print(f"{Color.GREEN}✓ 重跑完成{Color.END}")

    summary = comparator.get_records_summary()
    print(f"\n{Color.BOLD}📊 处理结果统计{Color.END}")
    for status, count in summary['status_breakdown'].items():
        print(f"  {print_status_tag(status)}: {count} 条")

    print(f"\n{Color.BOLD}🎯 三种典型处理结果:{Color.END}")
    print(f"\n{Color.GREEN}【顺利记录】FB001{Color.END}")
    print("  - 新旧模型有差异，有官方口径确认")
    print("  - 结果: 已确认，新模型正确")

    print(f"\n{Color.RED}【重复计入待复核】FB003{Color.END}")
    print("  - 与FB002是同一用户重复录入")
    print("  - 结果: 标记为重复计入，留待标注负责人确认去重")

    print(f"\n{Color.BLUE}【旧口径补录】FB005{Color.END}")
    print("  - 初始新模型判为咨询，后从标注员留言补来旧口径")
    print("  - 结果: 人工修正为退货换货，已解决")


def demo_full_flow():
    comparator = IntentComparator()

    step_1_import_gray_batch(comparator)
    input(f"\n{Color.CYAN}按回车继续第二步...{Color.END}")

    step_2_review_annotation_notes(comparator)
    input(f"\n{Color.CYAN}按回车继续第三步...{Color.END}")

    step_3_update_evidence_playback(comparator)

    print(f"\n{Color.BOLD}📋 生成小看板...{Color.END}\n")
    print_kanban(comparator)

    while True:
        print(f"\n{Color.CYAN}输入反馈ID查看证据回放（输入 q 退出）:{Color.END}")
        choice = input("> ").strip()
        if choice.lower() == 'q':
            break
        if choice:
            print_evidence_playback(comparator, choice.upper())


def quick_board_view():
    comparator = IntentComparator()
    comparator.load_records(create_demo_records())
    comparator.detect_duplicates()
    print_kanban(comparator)

    while True:
        print(f"\n{Color.CYAN}输入反馈ID查看证据回放（输入 q 退出）:{Color.END}")
        choice = input("> ").strip()
        if choice.lower() == 'q':
            break
        if choice:
            print_evidence_playback(comparator, choice.upper())


def main():
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "demo":
            demo_full_flow()
        elif cmd == "board":
            quick_board_view()
        elif cmd == "playback" and len(sys.argv) > 2:
            comparator = IntentComparator()
            comparator.load_records(create_demo_records())
            print_evidence_playback(comparator, sys.argv[2].upper())
        else:
            print_help()
    else:
        print_help()


def print_help():
    print(f"\n{Color.BOLD}客服意图新旧模型对照{Color.END}")
    print(f"\n用法:")
    print(f"  python cli.py demo      - 运行完整三步流程演示")
    print(f"  python cli.py board     - 快速查看小看板（临时会前场景）")
    print(f"  python cli.py playback <ID> - 查看指定记录的证据回放")
    print(f"\n示例:")
    print(f"  python cli.py demo")
    print(f"  python cli.py board")
    print(f"  python cli.py playback FB001")
    print()


if __name__ == "__main__":
    main()
