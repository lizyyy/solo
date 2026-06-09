import re
from typing import List, Optional, Tuple, Dict, Any
from models import (
    TempControlRecord, WeChatNote, DosageRecord, Flag, OverrideRecord,
    FLAG_LEVEL_INFO, FLAG_LEVEL_WARNING, FLAG_LEVEL_BLOCKER,
    FLAG_TYPE_NOTE_ALIGNMENT, FLAG_TYPE_DOSAGE_CHANGED,
    FLAG_TYPE_RETRACT_IN_NOTE, FLAG_TYPE_MANUAL_OVERRIDE,
    STATUS_PENDING, STATUS_ALIGNED, STATUS_FLAGGED, STATUS_BLOCKED, STATUS_CLOSED,
    _now_iso,
)
import storage


RETRACT_PATTERNS = [
    r"撤回了一条消息",
    r"\[撤回\]",
    r"已撤回",
    r"对方撤回",
    r"撤回：",
]

DOSAGE_PATTERNS = [
    (r"([\u4e00-\u9fa5A-Za-z0-9]+片|[\u4e00-\u9fa5A-Za-z0-9]+胶囊|[\u4e00-\u9fa5A-Za-z0-9]+药|阿莫西林|头孢|布洛芬|美洛昔康|庆大霉素|维生素[A-Za-z]?|钙片|益生菌|驱虫药)\s*[:：]?\s*(每次?|一天|每日|每\d+天)?\s*(\d+\.?\d*\s*(mg|g|ml|片|粒|滴|袋|勺|毫升|毫克|克)?)\s*(/|\s*每\s*)?\s*(天|日|次|小时|h|早晚|早中晚|bid|tid|qd)?", re.I),
    (r"用药?\s*[:：]\s*([^\n，。；]+)", re.I),
    (r"剂量\s*[:：]\s*([^\n，。；]+)", re.I),
    (r"吃\s*[:：]?\s*([^\n，。；]*?(mg|g|ml|片|粒|滴|袋|勺))", re.I),
]

TEMP_PATTERNS = [
    (r"体?温\s*[:：是为约]?\s*(\d+\.?\d*)\s*[度℃°Cc]", re.I),
    (r"(\d+\.?\d*)\s*[度℃°Cc]", re.I),
]


def parse_wechat_note(raw_text: str) -> WeChatNote:
    has_retract = False
    retract_snippet = ""
    for pat in RETRACT_PATTERNS:
        m = re.search(pat, raw_text)
        if m:
            has_retract = True
            start = max(0, m.start() - 20)
            end = min(len(raw_text), m.end() + 20)
            retract_snippet = raw_text[start:end].strip()
            break
    return WeChatNote(raw_text=raw_text, has_retract=has_retract, retract_snippet=retract_snippet)


def extract_dosages_from_text(text: str) -> List[DosageRecord]:
    found = []
    for pat, flags in DOSAGE_PATTERNS:
        for m in re.finditer(pat, text):
            groups = m.groups()
            name = ""
            dose = ""
            freq = ""
            if len(groups) >= 1:
                name = (groups[0] or "").strip()
            if len(groups) >= 3:
                dose = (groups[2] or "").strip()
            if len(groups) >= 6:
                freq = (groups[5] or "").strip()
            if not dose and len(groups) >= 1:
                dose = (groups[0] or "").strip()
                name = "口服药"
            if dose:
                found.append(DosageRecord(
                    drug_name=name or "未知药品",
                    dose=dose,
                    frequency=freq or "遵医嘱",
                    source="parsed_from_note",
                ))
    return found


def extract_temp_from_text(text: str) -> Optional[float]:
    for pat, flags in TEMP_PATTERNS:
        m = re.search(pat, text)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass
    return None


def add_wechat_note(record_id: str, raw_text: str) -> Tuple[TempControlRecord, List[Flag]]:
    rec = storage.get_record(record_id)
    if not rec:
        raise ValueError(f"记录 {record_id} 不存在")

    note = parse_wechat_note(raw_text)
    rec.wechat_notes.append(note)

    new_flags: List[Flag] = []

    if note.has_retract:
        f = Flag(
            flag_type=FLAG_TYPE_RETRACT_IN_NOTE,
            level=FLAG_LEVEL_WARNING,
            title="微信备注含撤回记录",
            detail=f"主人备注中检测到撤回消息片段：「{note.retract_snippet}」。请人工确认撤回内容是否影响已有结论。",
            blocked_fields=[],
        )
        rec.flags.append(f)
        new_flags.append(f)
        rec.append_timeline("flag", f"⚠ 检测到撤回记录：{note.retract_snippet[:40]}",
                            extra={"flag_id": f.flag_id})

    new_dosages = extract_dosages_from_text(raw_text)
    for nd in new_dosages:
        dup = False
        for od in rec.dosages:
            if (od.drug_name == nd.drug_name
                and _dose_canonical(od.dose) == _dose_canonical(nd.dose)
                and _freq_canonical(od.frequency) == _freq_canonical(nd.frequency)):
                dup = True
                break
        if dup:
            continue

        conflict = None
        for od in rec.dosages:
            if od.drug_name == nd.drug_name:
                if (_dose_canonical(od.dose) != _dose_canonical(nd.dose)
                    or _freq_canonical(od.frequency) != _freq_canonical(nd.frequency)):
                    conflict = od
                    break

        if conflict:
            f = Flag(
                flag_type=FLAG_TYPE_DOSAGE_CHANGED,
                level=FLAG_LEVEL_BLOCKER,
                title=f"用药剂量变更：{nd.drug_name}",
                detail=(
                    f"原记录：{conflict.drug_name} {conflict.dose} {conflict.frequency}（来源：{conflict.source}）\n"
                    f"新备注：{nd.drug_name} {nd.dose} {nd.frequency}（来源：微信备注）\n"
                    f"⚠ 卡点：剂量/频次不一致，用药结论暂不能放行，需训练师确认后再归档。"
                ),
                blocked_fields=["dosages", "status", "conclusion"],
            )
            rec.flags.append(f)
            new_flags.append(f)
            rec.append_timeline(
                "blocker",
                f"🛑 用药剂量冲突：{nd.drug_name} {conflict.dose} → {nd.dose}，结论暂不放行",
                extra={"flag_id": f.flag_id, "drug": nd.drug_name,
                       "old": f"{conflict.dose} {conflict.frequency}",
                       "new": f"{nd.dose} {nd.frequency}"},
            )
            rec.status = STATUS_BLOCKED
        else:
            rec.dosages.append(nd)
            rec.append_timeline("dosage", f"新增用药：{nd.drug_name} {nd.dose} {nd.frequency}",
                                extra={"source": nd.source})

    note_temp = extract_temp_from_text(raw_text)
    if note_temp is not None and rec.current_temp != 0.0:
        diff = abs(note_temp - rec.current_temp)
        if diff > 0.3:
            f = Flag(
                flag_type=FLAG_TYPE_NOTE_ALIGNMENT,
                level=FLAG_LEVEL_WARNING,
                title="体温记录对不上",
                detail=f"系统记录当前体温 {rec.current_temp}℃，备注中提到 {note_temp}℃，差值 {diff:.1f}℃。请确认以哪次测量为准。",
                blocked_fields=["current_temp"],
            )
            rec.flags.append(f)
            new_flags.append(f)
            rec.append_timeline(
                "flag",
                f"⚠ 体温不一致：系统 {rec.current_temp}℃ vs 备注 {note_temp}℃",
                extra={"flag_id": f.flag_id, "sys_temp": rec.current_temp, "note_temp": note_temp},
            )

    unresolved_blockers = [f for f in rec.flags if f.level == FLAG_LEVEL_BLOCKER and not f.resolved]
    if unresolved_blockers:
        rec.status = STATUS_BLOCKED
    elif any(not f.resolved for f in rec.flags):
        rec.status = STATUS_FLAGGED
    else:
        if rec.status == STATUS_PENDING:
            rec.status = STATUS_ALIGNED

    storage.update_record(rec)
    return rec, new_flags


def _dose_canonical(d: str) -> str:
    return re.sub(r"\s+", "", d or "").lower()


def _freq_canonical(f: str) -> str:
    return re.sub(r"\s+", "", f or "").lower()


def initial_align(record_id: str) -> TempControlRecord:
    rec = storage.get_record(record_id)
    if not rec:
        raise ValueError(f"记录 {record_id} 不存在")

    all_notes_text = "\n".join(n.raw_text for n in rec.wechat_notes)
    for d in extract_dosages_from_text(all_notes_text):
        dup = any(x.drug_name == d.drug_name and _dose_canonical(x.dose) == _dose_canonical(d.dose)
                  for x in rec.dosages)
        if not dup:
            rec.dosages.append(d)
            rec.append_timeline("dosage", f"初始化对齐用药：{d.drug_name} {d.dose} {d.frequency}")

    if rec.status == STATUS_PENDING and not rec.flags:
        rec.status = STATUS_ALIGNED
        rec.append_timeline("status", f"状态变更：{STATUS_PENDING} → {STATUS_ALIGNED}，初始信息对齐")

    storage.update_record(rec)
    return rec


def manual_override(record_id: str, operator: str, new_status: str,
                    reason: str, resolve_flag_ids: Optional[List[str]] = None) -> TempControlRecord:
    rec = storage.get_record(record_id)
    if not rec:
        raise ValueError(f"记录 {record_id} 不存在")

    old_status = rec.status
    ov = OverrideRecord(
        operator=operator,
        old_status=old_status,
        new_status=new_status,
        reason=reason,
    )
    rec.overrides.append(ov)

    if resolve_flag_ids:
        for fid in resolve_flag_ids:
            for f in rec.flags:
                if f.flag_id == fid and not f.resolved:
                    f.resolved = True
                    f.resolved_by = operator
                    f.resolved_at = _now_iso()
                    f.resolution_note = f"人工改判放行：{reason}"

    f_ov = Flag(
        flag_type=FLAG_TYPE_MANUAL_OVERRIDE,
        level=FLAG_LEVEL_INFO,
        title=f"{operator} 人工改判",
        detail=f"状态：{old_status} → {new_status}\n原因：{reason}\n（此为人工改判记录，算法结论请结合上下文审阅）",
        blocked_fields=[],
    )
    f_ov.resolved = True
    f_ov.resolved_by = operator
    f_ov.resolved_at = _now_iso()
    f_ov.resolution_note = reason
    rec.flags.append(f_ov)

    rec.status = new_status
    rec.append_timeline(
        "override",
        f"✏️ {operator} 改判：{old_status} → {new_status} | 原因：{reason}",
        operator=operator,
        extra={"override_id": ov.override_id, "old_status": old_status, "new_status": new_status,
               "reason": reason, "resolve_flag_ids": resolve_flag_ids or []},
    )

    storage.update_record(rec)
    return rec


def resolve_flag(record_id: str, flag_id: str, resolver: str, resolution_note: str) -> TempControlRecord:
    rec = storage.get_record(record_id)
    if not rec:
        raise ValueError(f"记录 {record_id} 不存在")
    for f in rec.flags:
        if f.flag_id == flag_id:
            f.resolved = True
            f.resolved_by = resolver
            f.resolved_at = _now_iso()
            f.resolution_note = resolution_note
            rec.append_timeline(
                "resolve",
                f"✔ {resolver} 处理疑点[{f.title}]：{resolution_note}",
                operator=resolver,
                extra={"flag_id": flag_id},
            )
            break

    unresolved_blockers = [f for f in rec.flags if f.level == FLAG_LEVEL_BLOCKER and not f.resolved]
    if rec.status == STATUS_BLOCKED and not unresolved_blockers:
        if any(not f.resolved for f in rec.flags):
            rec.status = STATUS_FLAGGED
        else:
            rec.status = STATUS_ALIGNED
        rec.append_timeline("status", f"状态变更：blocked → {rec.status}，blocker 已清除")

    storage.update_record(rec)
    return rec


def close_record(record_id: str, operator: str, close_note: str) -> TempControlRecord:
    rec = storage.get_record(record_id)
    if not rec:
        raise ValueError(f"记录 {record_id} 不存在")
    unresolved = [f for f in rec.flags if not f.resolved and f.level != FLAG_LEVEL_INFO]
    if unresolved:
        raise ValueError(f"还有 {len(unresolved)} 个未处理疑点，无法关闭")
    old = rec.status
    rec.status = STATUS_CLOSED
    rec.append_timeline("close", f"归档关闭：{old} → closed | {close_note}", operator=operator)
    storage.update_record(rec)
    return rec
