#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import sys
import textwrap
import uuid
from collections import defaultdict
from datetime import datetime

from sample_data import (
    SAMPLE_PETS,
    SAMPLE_VACCINE_PHOTOS,
    SAMPLE_MEDICATIONS,
    SAMPLE_WEIGHT_CHECKS,
    SAMPLE_INITIAL_HISTORY,
    PetRecord,
    VaccinePhoto,
    MedicationReminder,
    WeightCheckItem,
)
from review_engine import (
    detect_alias_duplicates,
    check_medication_chain,
    find_evidence_gaps,
    build_conclusions,
    AliasDuplicateBlock,
    EvidenceGap,
    MedicationCheck,
    RecordConclusion,
    ReviewReport,
)
from history_tracker import HistoryTracker, format_history_diff


SEPARATOR = "=" * 78
SUB_SEP = "-" * 78
THIN_SEP = "·" * 78


def _wrap(text: str, width: int = 70, indent: str = "  ") -> str:
    return textwrap.fill(
        text, width=width, initial_indent=indent, subsequent_indent=indent + "  "
    )


def print_header(title: str) -> None:
    print()
    print(SEPARATOR)
    print(f"  {title}")
    print(SEPARATOR)


def section_title(title: str, extra: str = "") -> None:
    print()
    print(SUB_SEP)
    if extra:
        print(f"▌ {title}    {extra}")
    else:
        print(f"▌ {title}")
    print(SUB_SEP)


def section_duplicates(blocks: list[AliasDuplicateBlock]) -> None:
    if not blocks:
        print("  未检测到宠物别名重复。")
        return
    for i, b in enumerate(blocks, 1):
        blocker_tag = "🔴 阻塞级" if b.is_blocker else "🟡 注意级"
        print()
        print(f"  [{i}] {blocker_tag} 别名「{b.alias}」出现 {len(b.record_ids)} 次")
        for rid, pid, owner, breed in zip(
            b.record_ids, b.pet_ids, b.owners, b.breeds
        ):
            pid_str = pid or "❌ 未分配pet_id"
            print(
                f"      • 档案号 {rid}  宠物ID: {pid_str}  "
                f"品种: {breed}  主人: {owner}"
            )
        print(_wrap(b.suggestion, width=68, indent="      └─ "))
    print()
    print(
        "  ※ 以上别名重复记录【不会】被复核结论吞掉，已单独列为阻塞项，"
        "在完成去重前对应档案的证据缺口均标记为「已阻塞」。"
    )


def section_medication_chain(checks: list[MedicationCheck]) -> None:
    if not checks:
        print("  未配置用药提醒记录。")
        return
    for i, c in enumerate(checks, 1):
        status = "✅ 证据完整"
        miss_count = len(c.missing_items)
        risk_count = len(c.human_remind_risks)
        if risk_count > 0 or miss_count >= 2:
            status = "🔴 高风险 靠人记容易漏"
        elif miss_count >= 1:
            status = "🟡 有缺失"
        print()
        print(
            f"  [{i}] {c.record_id} · {c.drug_name}  → {status}"
        )
        print(
            f"      处方证据: {'✅有' if c.has_prescription_evidence else '❌无'}   "
            f"体重依据: {'✅有' if c.has_weight_basis else '❌无'}   "
            f"结束复盘: {'✅有' if c.has_duration_end_plan else '❌无'}"
        )
        if c.missing_items:
            print(f"      缺失: {', '.join(c.missing_items)}")
        if c.human_remind_risks:
            print(f"      阿宁人工提醒漏讲风险链:")
            for r in c.human_remind_risks:
                print(_wrap(r, width=66, indent="        ! "))


def section_evidence_gaps(
    gaps: list[EvidenceGap],
    conclusions: list[RecordConclusion],
) -> None:
    if not gaps:
        print("  证据链完整，无缺口。")
        return

    by_record: dict[str, list[EvidenceGap]] = defaultdict(list)
    for g in gaps:
        by_record[g.record_id].append(g)

    summary_parts = []
    severity_order = {"阻塞级": 0, "高风险": 1, "中风险": 2, "低风险": 3}
    for rid, gs in sorted(by_record.items()):
        blocked = sum(1 for g in gs if g.blocked_by)
        blocker = sum(1 for g in gs if g.severity == "阻塞级" and not g.blocked_by)
        high = sum(1 for g in gs if g.severity == "高风险" and not g.blocked_by)
        mid = sum(1 for g in gs if g.severity == "中风险" and not g.blocked_by)
        pet_name = next(
            (c.pet_alias for c in conclusions if c.record_id == rid), rid
        )
        tokens = [f"「{pet_name}」"]
        if blocker:
            tokens.append(f"🔴阻塞{blocker}")
        if high:
            tokens.append(f"🟠高风险{high}")
        if mid:
            tokens.append(f"🟡中风险{mid}")
        if blocked:
            tokens.append(f"⛔待解{blocked}")
        summary_parts.append(" ".join(tokens))

    print("  证据缺口一览（项目经理视角）:")
    print("  " + " | ".join(summary_parts))
    print()

    for rid in sorted(by_record.keys()):
        gs = sorted(
            by_record[rid],
            key=lambda g: (severity_order.get(g.severity, 9), 0 if g.blocked_by else 1),
        )
        pet_name = next(
            (c.pet_alias for c in conclusions if c.record_id == rid), rid
        )
        print(f"  ● {rid}「{pet_name}」共 {len(gs)} 项缺口")
        for j, g in enumerate(gs, 1):
            sev_icon = {"阻塞级": "🔴", "高风险": "🟠", "中风险": "🟡", "低风险": "🔵"}.get(
                g.severity, "⚪"
            )
            block_tag = f" ⛔被{g.blocked_by}阻塞" if g.blocked_by else ""
            print(f"    {j}. {sev_icon}[{g.severity}] {g.category}{block_tag}")
            print(_wrap(g.description, indent="        "))
            print(_wrap("→ " + g.suggested_action, width=66, indent="        "))


def section_conclusions(conclusions: list[RecordConclusion]) -> None:
    for c in conclusions:
        print()
        print(f"  {c.record_id}「{c.pet_alias}」 → {c.overall_status}")
        print(f"    体重进度: {c.weight_progress}")
        print(f"    信心水平: {c.confidence_level}")
        print(_wrap("结论: " + c.conclusion, width=66, indent="      "))
        if c.flags:
            print(f"    标记:")
            for f in c.flags:
                print(f"      · {f}")
        if c.recommendation:
            print(_wrap("建议: " + c.recommendation, width=66, indent="      "))


def section_history(tracker: HistoryTracker, records: list[PetRecord]) -> None:
    any_history = False
    for pet in records:
        hs = tracker.history_for(pet.record_id)
        if not hs:
            continue
        any_history = True
        print()
        print(f"  {pet.record_id}「{pet.pet_alias}」历史版本链路 "
              f"(当前v{tracker.current_version(pet.record_id)}):")
        for h in hs:
            print(format_history_diff(h))
    if not any_history:
        print("  暂无历史变更记录。")


def section_handover(
    report: ReviewReport,
    conclusions: list[RecordConclusion],
    gaps: list[EvidenceGap],
    meds: list[MedicationCheck],
    duplicates: list[AliasDuplicateBlock],
) -> list[str]:
    checklists: list[str] = []
    by_record_gaps: dict[str, list[EvidenceGap]] = defaultdict(list)
    for g in gaps:
        by_record_gaps[g.record_id].append(g)
    by_record_meds: dict[str, list[MedicationCheck]] = defaultdict(list)
    for m in meds:
        by_record_meds[m.record_id].append(m)

    blocker_dups = [d for d in duplicates if d.is_blocker]

    section_title(
        "兽医助理阿宁交接清单（顺着疫苗本照片/截图核对，不用懂代码）"
    )

    if blocker_dups:
        print()
        print("  📌 【第一步：先解别名冲突】——不解决就不要往下判结论")
        for i, d in enumerate(blocker_dups, 1):
            print(f"  □ {i}. 别名「{d.alias}」去重:")
            print(f"     打开档案: {', '.join(d.record_ids)}")
            print(f"     核对疫苗本照片上的品种/性别/主人电话 → 判定是同一只还是不同只")
            print(f"     不同只 → 给其中一只改别名（如「豆豆-柯基」「豆豆-金毛」）后继续")
            print(f"     同一只 → 合并档案补全 pet_id / 出生日期后继续")
            checklists.append(f"别名冲突-{d.alias}-解重")

    print()
    print("  📌 【第二步：对照疫苗本照片补证据】")

    for c in conclusions:
        gs = [g for g in by_record_gaps.get(c.record_id, []) if not g.blocked_by]
        blocked_gs = [g for g in by_record_gaps.get(c.record_id, []) if g.blocked_by]
        c_meds = by_record_meds.get(c.record_id, [])
        if not gs and not c_meds and not blocked_gs:
            continue
        print()
        print(f"  档案 {c.record_id}「{c.pet_alias}」 (当前状态: {c.overall_status})")
        if blocked_gs:
            print(f"    ⛔ {len(blocked_gs)}项缺口因别名未解决暂时搁置")
        for i, g in enumerate(gs, 1):
            print(f"    □ 照片/凭证#{i}: {g.category} - {g.description[:36]}...")
            print(f"       → {g.suggested_action}")
            checklists.append(f"{c.record_id}-{g.gap_id}")
        for m in c_meds:
            if m.human_remind_risks or m.missing_items:
                print(
                    f"    □ 用药提醒 {m.drug_name}: 需主人复述确认 + 找{' / '.join(m.missing_items) if m.missing_items else '凭证复核'}"
                )
                checklists.append(f"{c.record_id}-{m.reminder_id}")

    print()
    print("  📌 【第三步：月末封账前必须完成的HARD STOP】")
    stopper_count = 0
    for c in conclusions:
        gs = [g for g in by_record_gaps.get(c.record_id, []) if not g.blocked_by]
        stopper = [g for g in gs if g.severity in ("阻塞级", "高风险")]
        for g in stopper:
            stopper_count += 1
            print(
                f"    ⚠️  #{stopper_count}. [{g.severity}] {c.pet_alias} / {g.category}"
                f": {g.description[:40]}..."
            )
    if stopper_count == 0:
        print("    无阻塞级/高风险项，可直接封账。")

    print()
    print("  📌 【第四步：确认无误后在系统点击「完成复核并记入历史」】")
    return checklists


def simulate_end_of_month_remark(
    tracker: HistoryTracker,
    photos: list[VaccinePhoto],
    conclusions: list[RecordConclusion],
) -> tuple[VaccinePhoto, list[RecordConclusion]]:
    record_id = "PET-2025-0612-001"
    photo_id = "PH-002"
    target = next(
        (p for p in photos if p.record_id == record_id and p.photo_id == photo_id),
        None,
    )
    if target is None:
        raise RuntimeError("模拟失败：找不到PH-002")

    old_conclusion = next((c for c in conclusions if c.record_id == record_id), None)
    if old_conclusion is None:
        raise RuntimeError("模拟失败：找不到PET-2025-0612-001结论")

    target.hospital_stamp = True
    remark = (
        "【月底封账补注】2025-06-08 电话联系李建国确认，6月2日称重当日因门诊章临时"
        "更换未加盖，由刘兽医微信视频确认秤重并于6月3日在纸质登记册补签。本次体重"
        "11.5kg有效，可计入减重复核。补录操作人：阿宁，监签：王兽医。"
    )

    photo_copy_before = copy.deepcopy(target)
    old_snap = {
        "conclusion": old_conclusion.conclusion,
        "status": old_conclusion.overall_status,
        "flags": list(old_conclusion.flags),
        "recommendation": old_conclusion.recommendation,
        "hospital_stamp_before": photo_copy_before.hospital_stamp,
        "photo_remark_before": photo_copy_before.manual_remark,
    }

    target.manual_remark = remark

    old_flags = [f for f in old_conclusion.flags if "6月2日复诊缺医院章" not in f]
    old_warning_flag_count = sum(
        1 for f in old_flags if any(x in f for x in ("🟠 高风险缺口", "🟡 中风险缺口"))
    )
    new_flags = []
    for f in old_flags:
        if "🟠 高风险缺口" in f:
            new_val = 0
            for tok in f.split("🟠"):
                if "高风险缺口" in tok:
                    num = "".join(ch for ch in tok if ch.isdigit())
                    if num:
                        new_val = max(int(num) - 1, 0)
                        if new_val > 0:
                            new_flags.append(f"🟠 高风险缺口{new_val}项")
            break
        else:
            new_flags.append(f)
    else:
        new_flags = list(old_flags)

    new_status = "🟡 基本完整 跟进中"
    new_conclusion_text = (
        "补录月底备注并确认医院章效力后，减重趋势从「效果待确认」更新为"
        "「进行中、节奏正常」。最新体重11.5kg距目标11.0kg差0.5kg，建议"
        "7月1日复诊时复核是否调整剂量。"
    )
    new_confidence = "较高"
    new_recommendation = (
        "维持现有剂量和饮食方案，复诊时确认运动执行情况并决定是否进入最后减重冲刺期。"
    )

    new_snap = {
        "conclusion": new_conclusion_text,
        "status": new_status,
        "flags": list(new_flags),
        "recommendation": new_recommendation,
        "hospital_stamp_after": target.hospital_stamp,
        "photo_remark_after": target.manual_remark,
        "photo_id": photo_id,
    }

    change_reason = (
        "月底封账前临时补录疫苗本照片PH-002备注，解决「6月2日复诊缺医院章」凭证问题，"
        "体重数据从「待确认」改为「有效」，因此整体结论从「效果待确认」改判为「基本完整 跟进中」。"
    )

    tracker.add_version(
        record_id=record_id,
        action="补疫苗本照片备注并改判结论",
        operator="阿宁(兽医助理) / 监签:王兽医",
        old_snapshot=old_snap,
        new_snapshot=new_snap,
        change_reason=change_reason,
        attached_evidence=[photo_id, "微信通话记录-20250608", "纸质登记册补签扫描件-SC-20250608"],
    )

    new_conclusions = []
    for c in conclusions:
        if c.record_id == record_id:
            new_conclusions.append(
                RecordConclusion(
                    record_id=c.record_id,
                    pet_alias=c.pet_alias,
                    overall_status=new_status,
                    weight_progress=c.weight_progress,
                    confidence_level=new_confidence,
                    conclusion=new_conclusion_text,
                    flags=new_flags,
                    recommendation=new_recommendation,
                )
            )
        else:
            new_conclusions.append(c)
    return target, new_conclusions


def build_report(
    conclusions: list[RecordConclusion],
    duplicates: list[AliasDuplicateBlock],
    gaps: list[EvidenceGap],
    meds: list[MedicationCheck],
    tracker: HistoryTracker,
    handover_items: list[str],
) -> ReviewReport:
    blocker_count = sum(1 for d in duplicates if d.is_blocker)
    blocker_gaps = sum(1 for g in gaps if g.severity == "阻塞级" and not g.blocked_by)
    high_gaps = sum(1 for g in gaps if g.severity == "高风险" and not g.blocked_by)
    not_pass = sum(
        1 for c in conclusions if any(x in c.overall_status for x in ("❌", "🔴", "🟠"))
    )

    if blocker_count > 0:
        exit_code = 8
        exit_message = (
            f"【{blocker_count}组宠物别名未解决】→ 复核流程中止于别名冲突阶段。"
            f"请先处理「{'、'.join(d.alias for d in duplicates if d.is_blocker)}」的去重"
            f"（卡在缺少正式pet_id的档案上，见报告第1节）。"
        )
    elif blocker_gaps > 0:
        exit_code = 4
        exit_message = (
            f"存在{blocker_gaps}项阻塞级证据缺口，月底封账前无法完成。"
        )
    elif not_pass > 0:
        exit_code = 2
        exit_message = (
            f"{not_pass}份档案仍有高风险/待补项，补齐后重新运行复核。"
        )
    else:
        exit_code = 0
        exit_message = "全部档案复核通过，可封账。"

    return ReviewReport(
        run_id=f"RUN-{uuid.uuid4().hex[:8].upper()}",
        run_timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        duplicate_blocks=duplicates,
        evidence_gaps=gaps,
        medication_checks=meds,
        conclusions=conclusions,
        history_versions=tracker.version_map(),
        pending_handover=handover_items,
        exit_code=exit_code,
        exit_message=exit_message,
    )


def run_full_sample(apply_remark: bool = True) -> ReviewReport:
    pets = copy.deepcopy(SAMPLE_PETS)
    photos = copy.deepcopy(SAMPLE_VACCINE_PHOTOS)
    meds = copy.deepcopy(SAMPLE_MEDICATIONS)
    weights = copy.deepcopy(SAMPLE_WEIGHT_CHECKS)

    tracker = HistoryTracker(initial_history=copy.deepcopy(SAMPLE_INITIAL_HISTORY))

    print_header("宠物减重记录复核 · 整包样例运行报告")
    print(
        f"  批次号: RUN-{uuid.uuid4().hex[:8].upper()}    "
        f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )
    print(
        f"  档案数: {len(pets)}   疫苗本照片: {len(photos)}   "
        f"用药提醒: {len(meds)}   体重记录: {len(weights)}"
    )

    section_title("第1节 · 宠物别名重复检测（单独显示，不被复核吞掉）")
    duplicates = detect_alias_duplicates(pets)
    section_duplicates(duplicates)

    section_title("第2节 · 用药提醒漏讲风险链（阿宁靠人记容易漏的部分）")
    med_checks = check_medication_chain(pets, meds, photos, weights)
    section_medication_chain(med_checks)

    section_title("第3节 · 证据缺口扫描（含被别名阻塞的项）")
    gaps = find_evidence_gaps(pets, photos, weights, meds, duplicates)
    conclusions = build_conclusions(pets, photos, weights, gaps, duplicates)
    section_evidence_gaps(gaps, conclusions)

    section_title("第4节 · 复核结论（含因别名冲突而暂停的档案）")
    section_conclusions(conclusions)

    section_title("第5节 · 历史版本链路（变更前快照 / 新备注 / 改判原因）")
    section_history(tracker, pets)

    if apply_remark:
        section_title(
            "第6节 · 模拟月底封账前补录疫苗本照片备注（并改判结论）",
            "→ 对 PET-2025-0612-001 照片 PH-002 生效",
        )
        _, conclusions = simulate_end_of_month_remark(tracker, photos, conclusions)

        print()
        print("  补录后，PET-2025-0612-001「豆豆」结论已更新:")
        c_new = next(c for c in conclusions if c.record_id == "PET-2025-0612-001")
        print(f"    新状态: {c_new.overall_status}")
        print(_wrap("新结论: " + c_new.conclusion, indent="      ", width=66))
        print(_wrap("新建议: " + c_new.recommendation, indent="      ", width=66))

        section_title("第7节 · 补录后的完整历史链路（旧材料 / 新备注 / 改判原因）")
        section_history(tracker, [p for p in pets if p.record_id == "PET-2025-0612-001"])

        gaps2 = find_evidence_gaps(pets, photos, weights, meds, duplicates)
        med_checks2 = check_medication_chain(pets, meds, photos, weights)
    else:
        gaps2 = gaps
        med_checks2 = med_checks

    handover = section_handover(
        ReviewReport(
            run_id="",
            run_timestamp="",
        ),
        conclusions,
        gaps2,
        med_checks2,
        duplicates,
    )

    report = build_report(conclusions, duplicates, gaps2, med_checks2, tracker, handover)

    print_header("运行结束 · 退出说明")
    print()
    print(f"  退出码: {report.exit_code}")
    print(_wrap("退出原因: " + report.exit_message, indent="    "))
    if report.pending_handover:
        print(f"  待办交接项数: {len(report.pending_handover)}")
    print()
    print(
        "  再次运行样例:    python3 run_review.py"
    )
    print(
        "  跳过月底补录:    python3 run_review.py --no-remark"
    )
    print(
        "  仅显示退出码:    python3 run_review.py -q ; echo $?"
    )
    print()

    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="宠物减重记录复核 · 整包样例",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            用法示例:
              python3 run_review.py                 # 一条命令跑完整包样例（含月底补录）
              python3 run_review.py --no-remark     # 不执行月底补录，只跑初始数据复核
              python3 run_review.py -q              # 静默模式，只返回退出码
            """
        ),
    )
    parser.add_argument(
        "--no-remark",
        action="store_true",
        help="跳过月底封账前补录疫苗本照片备注的模拟步骤",
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="静默模式，只打印退出说明和返回退出码",
    )
    args = parser.parse_args(argv)

    if args.quiet:
        import io
        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            report = run_full_sample(apply_remark=not args.no_remark)
        finally:
            sys.stdout = old_stdout
        print(f"exit_code={report.exit_code}")
        print(report.exit_message)
        return report.exit_code

    report = run_full_sample(apply_remark=not args.no_remark)
    return report.exit_code


if __name__ == "__main__":
    sys.exit(main())
