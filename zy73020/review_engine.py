from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional
from collections import defaultdict

from sample_data import (
    PetRecord,
    VaccinePhoto,
    MedicationReminder,
    WeightCheckItem,
    ReviewHistory,
)


@dataclass
class AliasDuplicateBlock:
    alias: str
    record_ids: list[str]
    pet_ids: list[Optional[str]]
    owners: list[str]
    breeds: list[str]
    is_blocker: bool = True
    suggestion: str = ""


@dataclass
class EvidenceGap:
    gap_id: str
    record_id: str
    category: str
    description: str
    severity: str
    suggested_action: str
    blocked_by: Optional[str] = None


@dataclass
class MedicationCheck:
    reminder_id: str
    record_id: str
    drug_name: str
    has_prescription_evidence: bool
    has_weight_basis: bool
    has_duration_end_plan: bool
    human_remind_risks: list[str]
    missing_items: list[str] = field(default_factory=list)


@dataclass
class RecordConclusion:
    record_id: str
    pet_alias: str
    overall_status: str
    weight_progress: str
    confidence_level: str
    conclusion: str
    flags: list[str] = field(default_factory=list)
    recommendation: str = ""


@dataclass
class ReviewReport:
    run_id: str
    run_timestamp: str
    duplicate_blocks: list[AliasDuplicateBlock] = field(default_factory=list)
    evidence_gaps: list[EvidenceGap] = field(default_factory=list)
    medication_checks: list[MedicationCheck] = field(default_factory=list)
    conclusions: list[RecordConclusion] = field(default_factory=list)
    history_versions: dict[str, int] = field(default_factory=dict)
    pending_handover: list[str] = field(default_factory=list)
    exit_code: int = 0
    exit_message: str = ""


def _today_str() -> str:
    return date.today().strftime("%Y-%m-%d")


def _ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def detect_alias_duplicates(pets: list[PetRecord]) -> list[AliasDuplicateBlock]:
    alias_groups: dict[str, list[PetRecord]] = defaultdict(list)
    for p in pets:
        key = p.pet_alias.strip().lower()
        alias_groups[key].append(p)

    blocks: list[AliasDuplicateBlock] = []
    for key, group in alias_groups.items():
        if len(group) < 2:
            continue
        has_unresolved = any(p.pet_id is None or not p.pet_id for p in group)
        suggestion_parts = [
            f"别名「{group[0].pet_alias}」出现 {len(group)} 次，"
            f"涉及: {', '.join(f'[{p.record_id}] {p.breed}/{p.owner_name}' for p in group)}。"
        ]
        if has_unresolved:
            suggestion_parts.append(
                "其中存在未分配正式宠物ID的记录（pet_id为空），"
                "无法自动合并。请确认这些「" + group[0].pet_alias + "」是否为同一只宠物："
            )
            for p in group:
                if not p.pet_id:
                    suggestion_parts.append(
                        f"  - {p.record_id}: {p.breed} {p.gender}, 主人{p.owner_name}({p.owner_phone})，"
                        f"缺少正式宠物ID，请联系运营建档或录入微芯片号确认身份后再进入减重复核。"
                    )
                else:
                    suggestion_parts.append(
                        f"  - {p.record_id}({p.pet_id}): {p.breed} {p.gender}, 主人{p.owner_name}"
                    )
            suggestion_parts.append(
                "处理建议：若为不同宠物，分别录入不同别名区分（如「豆豆-柯基」「豆豆-金毛」）；"
                "若确认为同一只，请合并档案并补全缺失的出生日期、性别等关键信息。"
            )
        else:
            suggestion_parts.append(
                "所有记录均已有正式宠物ID，建议人工确认是否存在多建档案情况。"
            )

        blocks.append(
            AliasDuplicateBlock(
                alias=group[0].pet_alias,
                record_ids=[p.record_id for p in group],
                pet_ids=[p.pet_id for p in group],
                owners=[p.owner_name for p in group],
                breeds=[p.breed for p in group],
                is_blocker=has_unresolved,
                suggestion="\n".join(suggestion_parts),
            )
        )
    return blocks


def check_medication_chain(
    pets: list[PetRecord],
    medications: list[MedicationReminder],
    photos: list[VaccinePhoto],
    weight_checks: list[WeightCheckItem],
) -> list[MedicationCheck]:
    pet_ids = {p.record_id for p in pets}
    results: list[MedicationCheck] = []

    for med in medications:
        if med.record_id not in pet_ids:
            continue
        related_photos = [ph for ph in photos if ph.record_id == med.record_id and ph.manual_remark or ph.photo_id.endswith(("1", "2", "4", "5", "6"))]
        related_weights = [w for w in weight_checks if w.record_id == med.record_id]

        has_prescription_evidence = any(
            ph.vet_signature or ph.hospital_stamp
            for ph in photos
            if ph.record_id == med.record_id
        )

        has_weight_basis = len(related_weights) > 0 and any(
            w.current_weight is not None for w in related_weights
        )

        start = datetime.strptime(med.start_date, "%Y-%m-%d").date()
        from datetime import timedelta
        end_date = start + timedelta(days=med.duration_days)
        latest_check = max(
            (datetime.strptime(w.check_date, "%Y-%m-%d").date() for w in related_weights),
            default=None,
        )
        has_duration_end_plan = (
            latest_check is not None
            and latest_check + timedelta(days=30) >= end_date
        ) or any(w.recheck_scheduled for w in related_weights)

        risks = []
        missing_items = []

        if med.need_human_remind:
            risks.append(
                f"【注意】{med.drug_name} 必须由阿宁口头向主人复述一遍，"
                f"单靠系统通知主人容易忽略。需复述: {med.dosage} × {med.frequency}。"
            )
            if med.note:
                risks.append(
                    f"【注意】{med.drug_name} 有特别备注「{med.note[:42]}…」，"
                    f"阿宁复述时如果漏讲会影响用药安全，必须让主人复述回确认。"
                )
            if not has_prescription_evidence:
                risks.append(
                    f"【高危】{med.drug_name} 需要人工提醒主人执行，但缺乏处方证据支撑"
                    f"（疫苗本照片未见兽医签字或医院盖章），阿宁口头复述时容易漏讲或剂量说不准。"
                )
                missing_items.append("处方/用药医嘱照片")
            if med.duration_days > 14 and not any(w.recheck_scheduled for w in related_weights):
                risks.append(
                    f"【中危】{med.drug_name} 疗程{med.duration_days}天超过2周，"
                    f"未关联后续复诊排期，阿宁人工到点提醒时容易遗漏。"
                )
                missing_items.append("疗程结束复诊计划")
            if "注射" in med.frequency:
                if not has_prescription_evidence:
                    risks.append(
                        f"【高危】{med.drug_name} 需要注射，给药方式特殊，"
                        f"没有处方照片佐证时阿宁无法确认注射部位和推注速度，只能依赖记忆复述。"
                    )
                    missing_items.append("注射操作指导凭证")
                else:
                    risks.append(
                        f"【中危】{med.drug_name} 需要注射操作，"
                        f"即使有处方，主人也必须现场演示给主人看，靠口头讲一遍，"
                        f"阿宁靠记忆复述容易漏掉「注射部位/推注速度的细节。"
                    )

        if not has_weight_basis:
            missing_items.append("用药同期体重记录")
        if not has_duration_end_plan:
            missing_items.append("停药/续方复核计划")

        results.append(
            MedicationCheck(
                reminder_id=med.reminder_id,
                record_id=med.record_id,
                drug_name=med.drug_name,
                has_prescription_evidence=has_prescription_evidence,
                has_weight_basis=has_weight_basis,
                has_duration_end_plan=has_duration_end_plan,
                human_remind_risks=risks,
                missing_items=missing_items,
            )
        )
    return results


def find_evidence_gaps(
    pets: list[PetRecord],
    photos: list[VaccinePhoto],
    weight_checks: list[WeightCheckItem],
    medications: list[MedicationReminder],
    duplicate_blocks: list[AliasDuplicateBlock],
) -> list[EvidenceGap]:
    gaps: list[EvidenceGap] = []
    blocked_duplicates = {b.alias: b for b in duplicate_blocks if b.is_blocker}

    for pet in pets:
        alias_key = pet.pet_alias.strip().lower()

        pet_photos = [p for p in photos if p.record_id == pet.record_id]
        pet_weights = [w for w in weight_checks if w.record_id == pet.record_id]
        pet_meds = [m for m in medications if m.record_id == pet.record_id]

        blocked_by = None
        if alias_key in blocked_duplicates:
            blocked_by = f"别名重复(「{pet.pet_alias}」)"

        if not pet.pet_id:
            gaps.append(
                EvidenceGap(
                    gap_id=f"G-{pet.record_id}-ID",
                    record_id=pet.record_id,
                    category="身份档案",
                    description=f"宠物「{pet.pet_alias}」缺少正式宠物ID，无法关联历史诊疗档案",
                    severity="阻塞级",
                    suggested_action="联系运营录入微芯片号或分配正式pet_id，确认非重复建档后继续。",
                    blocked_by=blocked_by,
                )
            )

        weight_with_stamp = [
            p for p in pet_photos
            if p.weight is not None and (p.hospital_stamp or p.vet_signature)
        ]
        if len(weight_with_stamp) < 2 and pet_weights:
            gaps.append(
                EvidenceGap(
                    gap_id=f"G-{pet.record_id}-WEIGHT",
                    record_id=pet.record_id,
                    category="减重证据链",
                    description=f"「{pet.pet_alias}」的疫苗本照片中，带医院章/兽医签字的体重数据只有{len(weight_with_stamp)}次，不足2次形成有效减重趋势",
                    severity="中风险",
                    suggested_action="补拍后续复诊时带章的体重页，或让兽医在减重记录卡上签字盖章后上传。",
                    blocked_by=blocked_by,
                )
            )

        latest_wc = max(pet_weights, key=lambda w: w.check_date) if pet_weights else None
        if latest_wc and not latest_wc.vet_confirmation:
            gaps.append(
                EvidenceGap(
                    gap_id=f"G-{pet.record_id}-VETCFM",
                    record_id=pet.record_id,
                    category="兽医确认",
                    description=f"「{pet.pet_alias}」最近一次体重记录({latest_wc.check_date})缺少兽医确认签字",
                    severity="高风险",
                    suggested_action="由接诊兽医在系统内补确认，或上传带兽医签字的纸质记录截图。",
                    blocked_by=blocked_by,
                )
            )

        for p in pet_photos:
            if p.weight is not None and not p.vet_signature and not p.hospital_stamp:
                gaps.append(
                    EvidenceGap(
                        gap_id=f"G-{pet.record_id}-{p.photo_id}-STAMP",
                        record_id=pet.record_id,
                        category="凭证效力",
                        description=f"照片{p.photo_id}({p.upload_time})记录了体重{p.weight}{p.weight_unit}，但无兽医签字也无医院章，不能作为封账凭证",
                        severity="高风险",
                        suggested_action="月底封账前：①让兽医补签字后重拍；②或在备注中说明该次仅作内部跟踪不做账。",
                        blocked_by=blocked_by,
                    )
                )
                break

        if latest_wc and latest_wc.recheck_scheduled:
            recheck = datetime.strptime(latest_wc.recheck_scheduled, "%Y-%m-%d").date()
            if recheck < datetime.strptime(_today_str(), "%Y-%m-%d").date():
                gaps.append(
                    EvidenceGap(
                        gap_id=f"G-{pet.record_id}-RECHECK",
                        record_id=pet.record_id,
                        category="复诊跟进",
                        description=f"「{pet.pet_alias}」计划复诊日{latest_wc.recheck_scheduled}已过，未见复诊记录上传",
                        severity="中风险",
                        suggested_action="联系主人确认是否已复诊，已完成则补充上传记录，未完成则重新排期。",
                        blocked_by=blocked_by,
                    )
                )

        if not any(p.birth_date for p in pets if p.record_id == pet.record_id) and not pet.birth_date:
            pass

    for med in medications:
        med_gaps_made = False
        pet = next((p for p in pets if p.record_id == med.record_id), None)
        if not pet:
            continue
        related = [p for p in photos if p.record_id == med.record_id]
        if not any(p.vet_signature or p.hospital_stamp for p in related):
            gaps.append(
                EvidenceGap(
                    gap_id=f"G-{med.reminder_id}-RX",
                    record_id=med.record_id,
                    category="用药证据",
                    description=f"{pet.pet_alias}的{med.drug_name}缺少兽医签字或医院盖章的处方/医嘱凭证",
                    severity="高风险",
                    suggested_action="上传处方笺照片或在疫苗本用药记录页补兽医签字后重拍。月底封账前必须补齐，否则该用药提醒不得计入已完成工作量。",
                    blocked_by=blocked_by,
                )
            )
            med_gaps_made = True

    return gaps


def build_conclusions(
    pets: list[PetRecord],
    photos: list[VaccinePhoto],
    weight_checks: list[WeightCheckItem],
    gaps: list[EvidenceGap],
    duplicates: list[AliasDuplicateBlock],
) -> list[RecordConclusion]:
    conclusions: list[RecordConclusion] = []

    blocked_aliases = {alias for d in duplicates for alias in d.record_ids if d.is_blocker}
    dup_alias_map: dict[str, AliasDuplicateBlock] = {}
    for d in duplicates:
        for rid in d.record_ids:
            dup_alias_map[rid] = d

    for pet in pets:
        record_gaps = [g for g in gaps if g.record_id == pet.record_id and not g.blocked_by]
        blocked_gaps = [g for g in gaps if g.record_id == pet.record_id and g.blocked_by]
        pet_photos = [p for p in photos if p.record_id == pet.record_id]
        pet_weights = sorted(
            [w for w in weight_checks if w.record_id == pet.record_id],
            key=lambda w: w.check_date,
        )

        flags = []
        if pet.record_id in dup_alias_map:
            d = dup_alias_map[pet.record_id]
            flags.append(f"⚠️ 别名「{pet.pet_alias}」重复: 涉及{d.record_ids}")

        blocker_count = sum(1 for g in record_gaps if g.severity == "阻塞级")
        high_count = sum(1 for g in record_gaps if g.severity == "高风险")
        mid_count = sum(1 for g in record_gaps if g.severity == "中风险")
        if blocker_count:
            flags.append(f"🔴 阻塞级缺口{blocker_count}项")
        if high_count:
            flags.append(f"🟠 高风险缺口{high_count}项")
        if mid_count:
            flags.append(f"🟡 中风险缺口{mid_count}项")
        if blocked_gaps:
            flags.append(f"⛔ {len(blocked_gaps)}项缺口被「{pet.pet_alias}」别名重复阻塞，需先解别名再判")

        progress = "无体重趋势数据"
        if len(pet_weights) >= 2:
            first_w = pet_weights[0]
            last_w = pet_weights[-1]
            diff = last_w.current_weight - first_w.current_weight
            target_delta = last_w.target_weight - first_w.current_weight
            pct = (abs(diff) / abs(first_w.current_weight - last_w.target_weight) * 100) if first_w.current_weight != last_w.target_weight else 0
            direction = "下降" if diff < 0 else ("上升" if diff > 0 else "持平")
            progress = (
                f"{first_w.check_date}→{last_w.check_date}: {first_w.current_weight}→{last_w.current_weight}"
                f"kg ({direction}{abs(diff):.1f}kg，目标达成{pct:.0f}%)"
            )
        elif len(pet_weights) == 1:
            w = pet_weights[0]
            progress = f"仅一次记录: {w.check_date} {w.current_weight}kg(目标{w.target_weight}kg)"

        if pet.record_id in dup_alias_map and dup_alias_map[pet.record_id].is_blocker:
            status = "❌ 别名阻塞 暂停复核"
            confidence = "0%"
            conclusion = (
                f"宠物别名「{pet.pet_alias}」存在未解决的重复建档，本记录减重复核已暂停。"
                f"请先完成别名去重/合并后再进入结论判定。"
            )
            recommendation = (
                f"处理「{pet.pet_alias}」别名冲突 → 补身份档案 → 再走完整复核链。"
            )
        elif blocker_count > 0:
            status = "🔴 资料不齐 无法通过"
            confidence = "低"
            conclusion = f"存在{blocker_count}项阻塞级证据缺口，月底封账前无法完成复核。"
            recommendation = "优先处理阻塞级缺口，再复核高风险项。"
        elif high_count > 0:
            status = "🟠 高风险 待补充"
            confidence = "中"
            conclusion = f"减重趋势可识别，但有{high_count}项高风险凭证缺失，月底封账前必须补齐。"
            recommendation = "重点补：处方签字、体重页盖章、兽医确认。"
        elif mid_count > 0:
            status = "🟡 基本完整 跟进中"
            confidence = "较高"
            conclusion = f"核心证据齐备，{mid_count}项中风险项可在7天内补齐。"
            recommendation = "安排复诊跟进，更新未完成的排期。"
        else:
            status = "🟢 复核通过 可封账"
            confidence = "高"
            conclusion = "减重记录证据链完整，结论稳定，可计入本月封账。"
            recommendation = "通知主人下月复诊，持续跟踪体重趋势。"

        conclusions.append(
            RecordConclusion(
                record_id=pet.record_id,
                pet_alias=pet.pet_alias,
                overall_status=status,
                weight_progress=progress,
                confidence_level=confidence,
                conclusion=conclusion,
                flags=flags,
                recommendation=recommendation,
            )
        )

    return conclusions
