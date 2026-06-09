import re
import json
import os
import csv
from datetime import datetime
from typing import Tuple, Optional, List, Dict, Any
from sqlalchemy.orm import Session

import config
from models import (
    Pet, WeightSchedule, MedicalRecord, Reconciliation,
    ExportBatch, ManualNote, FilterState
)


def normalize_pet_name(name: str) -> str:
    return re.sub(r"\s+", "", name or "").strip()


def match_pet_name(handwritten_name: str, session: Session) -> Tuple[Optional[Pet], str, List[str]]:
    """
    匹配宠物名称，返回 (匹配到的Pet, 匹配状态, 匹配过程说明)
    匹配状态：完全匹配 / 别名匹配 / 模糊匹配 / 未匹配
    """
    norm_hand = normalize_pet_name(handwritten_name)
    trace = []

    if not norm_hand:
        return None, "未匹配", ["手写名称为空"]

    all_pets = session.query(Pet).all()
    pet_map = {normalize_pet_name(p.name): p for p in all_pets}

    if norm_hand in pet_map:
        pet = pet_map[norm_hand]
        trace.append(f"精确匹配: 手写'{handwritten_name}' = 登记名'{pet.name}'")
        return pet, "完全匹配", trace

    for canon_name, aliases in config.PET_NAME_ALIASES.items():
        all_aliases = [canon_name] + aliases
        for alias in all_aliases:
            if normalize_pet_name(alias) == norm_hand:
                pet = session.query(Pet).filter(Pet.name == canon_name).first()
                if pet:
                    trace.append(f"别名匹配: 手写'{handwritten_name}' -> 别名'{alias}' -> 登记名'{canon_name}'")
                    return pet, "别名匹配", trace

    for pet in all_pets:
        norm_pet = normalize_pet_name(pet.name)
        if norm_hand and norm_pet and (norm_hand in norm_pet or norm_pet in norm_hand):
            trace.append(f"模糊匹配: 手写'{handwritten_name}' 包含于/包含 登记名'{pet.name}'")
            return pet, "模糊匹配", trace

    trace.append(f"无匹配: 手写'{handwritten_name}' 在登记名和别名库中均未找到")
    return None, "未匹配", trace


def parse_weight(raw_weight: str) -> Tuple[Optional[float], str, str, List[str]]:
    """
    解析手写体重字符串，返回 (数值, 单位, 单位状态, 解析说明)
    单位状态：标准 / 混写(已转换) / 无法识别
    """
    trace = []
    raw = (raw_weight or "").strip()

    if not raw:
        trace.append("体重字段为空")
        return None, "", "无法识别", trace

    found_units_with_pos = []
    for unit in sorted(config.WEIGHT_UNITS, key=len, reverse=True):
        start = 0
        while True:
            idx = raw.find(unit, start)
            if idx == -1:
                break
            found_units_with_pos.append((idx, idx + len(unit), unit))
            start = idx + 1

    filtered = []
    used_ranges = []
    for start, end, unit in sorted(found_units_with_pos, key=lambda x: x[0]):
        overlapped = False
        for us, ue in used_ranges:
            if not (end <= us or start >= ue):
                overlapped = True
                break
        if not overlapped:
            filtered.append(unit)
            used_ranges.append((start, end))

    found_units = []
    seen = set()
    for u in filtered:
        if u not in seen:
            found_units.append(u)
            seen.add(u)

    if len(found_units) > 1:
        trace.append(f"检测到多单位混写: {found_units}")
        main_unit = found_units[0]
        unit_status = "混写(已转换)"
    elif len(found_units) == 1:
        main_unit = found_units[0]
        unit_status = "标准"
        trace.append(f"识别单位: {main_unit}")
    else:
        trace.append("未检测到明确单位，默认按kg处理")
        main_unit = "kg"
        unit_status = "无单位(默认kg)"

    segments = re.split(r"[^0-9.\-,，]+", raw)
    numeric_parts = []
    for seg in segments:
        seg = seg.replace(",", ".").replace("，", ".")
        seg = re.sub(r"[^\d.\-]", "", seg)
        if seg and seg not in (".", "-", "-."):
            try:
                numeric_parts.append(float(seg))
            except ValueError:
                pass

    if not numeric_parts:
        trace.append(f"数值提取失败: 原始='{raw}' 无可识别数值")
        return None, main_unit if found_units else "", "无法识别", trace

    value = numeric_parts[0]
    trace.append(f"数值提取: {value} （从候选 {numeric_parts} 中取首段）")

    return value, main_unit, unit_status, trace


def weight_to_kg(value: Optional[float], unit: str) -> Optional[float]:
    if value is None:
        return None
    factor = config.UNIT_TO_KG.get(unit)
    if factor is None:
        return value
    return round(value * factor, 4)


def generate_batch_no() -> str:
    return "RCN" + datetime.now().strftime("%Y%m%d%H%M%S")


def generate_timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def run_reconciliation(
    session: Session,
    batch_no: Optional[str] = None,
    process_round: int = 1,
) -> Tuple[str, List[Dict[str, Any]], List[str]]:
    """
    主对账流程：
    - 遍历所有病历手写单
    - 匹配宠物名
    - 解析体重（识别混写）
    - 关联减重排程
    - 生成Reconciliation对账记录
    - 标记复核原因
    """
    logs = []
    results = []

    if batch_no is None:
        batch_no = generate_batch_no()

    logs.append(f"=== 对账批次 {batch_no} (第{process_round}轮) 开始 ===")

    medical_records = session.query(MedicalRecord).all()
    logs.append(f"加载病历手写单 {len(medical_records)} 条")

    schedules = session.query(WeightSchedule).all()
    schedule_map: Dict[str, WeightSchedule] = {}
    for s in schedules:
        key = f"{s.pet_id}_{s.plan_date}"
        schedule_map[key] = s

    for mr in medical_records:
        recon = Reconciliation(
            batch_no=batch_no,
            pet_id=mr.pet_id or f"UNKNOWN_{mr.id}",
            medical_record_id=mr.id,
            handwritten_name=mr.handwritten_name,
            raw_weight=mr.raw_weight,
            record_date=mr.record_date,
            medication_reminder=mr.medication_given or "",
            medical_summary=mr.medical_summary or "",
            process_round=process_round,
        )

        review_reasons = []

        pet, name_status, name_trace = match_pet_name(mr.handwritten_name, session)
        recon.name_match_status = name_status
        logs.extend([f"[{mr.handwritten_name}] {t}" for t in name_trace])

        if pet:
            recon.pet_id = pet.pet_id
            recon.pet_name = pet.name
            mr.is_name_matched = True

            sched = schedule_map.get(f"{pet.pet_id}_{mr.record_date}") or \
                    schedule_map.get(f"{pet.pet_id}_")
            if not sched:
                candidate = session.query(WeightSchedule).filter(
                    WeightSchedule.pet_id == pet.pet_id
                ).order_by(WeightSchedule.plan_date.desc()).first()
                sched = candidate

            if sched:
                recon.schedule_id = sched.id
                recon.target_weight_kg = sched.target_weight_kg
                recon.plan_date = sched.plan_date
                recon.medication_reminder = recon.medication_reminder or sched.medication_reminder
            else:
                review_reasons.append("未找到对应减重排程")
                logs.append(f"[{pet.name}] 未找到减重排程记录")
        else:
            recon.pet_name = mr.handwritten_name
            mr.is_name_matched = False
            review_reasons.append(f"宠物名称无法匹配（手写:'{mr.handwritten_name}'）")
            recon.review_status = "需复核"

        value, unit, unit_status, w_trace = parse_weight(mr.raw_weight)
        recon.weight_unit = unit
        recon.weight_unit_status = unit_status
        logs.extend([f"[{mr.handwritten_name}] {t}" for t in w_trace])

        mr.weight_value = value
        mr.weight_unit = unit
        recon.standard_weight_kg = weight_to_kg(value, unit)
        mr.standard_weight_kg = recon.standard_weight_kg

        if unit_status == "混写(已转换)":
            mr.is_weight_unit_standard = False
            review_reasons.append(f"体重单位混写（原始:'{mr.raw_weight}'），已自动换算为kg")
        elif unit_status == "无法识别":
            mr.is_weight_unit_standard = False
            review_reasons.append("体重数值无法识别")
        elif unit_status == "无单位(默认kg)":
            review_reasons.append("体重未标注单位，已默认按kg处理")

        if recon.standard_weight_kg is not None and recon.target_weight_kg is not None:
            recon.weight_loss_diff = round(recon.standard_weight_kg - recon.target_weight_kg, 4)
            if recon.weight_loss_diff < 0:
                review_reasons.append(f"未达目标体重，差值{abs(recon.weight_loss_diff)}kg")

        if recon.name_match_status in ["模糊匹配", "未匹配"]:
            review_reasons.append(f"名称匹配方式为「{recon.name_match_status}」，需人工确认")

        if not recon.medication_reminder:
            review_reasons.append("用药提醒信息缺失")

        if review_reasons:
            recon.review_status = "需复核"
            recon.review_reason = "；".join(review_reasons)
            mr.needs_review = True
            mr.review_reason = recon.review_reason
        else:
            recon.review_status = "正常"
            mr.needs_review = False

        if process_round == 1:
            recon.process_status = "首轮处理"
        else:
            existing = session.query(Reconciliation).filter(
                Reconciliation.batch_no == batch_no,
                Reconciliation.medical_record_id == mr.id,
                Reconciliation.process_round < process_round,
            ).order_by(Reconciliation.process_round.desc()).first()
            if existing:
                recon.process_status = "重跑(后补)"
                if existing.manual_note and not recon.manual_note:
                    recon.manual_note = existing.manual_note
                    recon.note_source = existing.note_source
            else:
                recon.process_status = "新增"

        session.add(recon)
        results.append({
            "id": None,
            "batch_no": batch_no,
            "pet_name": recon.pet_name,
            "handwritten_name": recon.handwritten_name,
            "name_match_status": recon.name_match_status,
            "review_status": recon.review_status,
            "review_reason": recon.review_reason,
            "weight_unit_status": recon.weight_unit_status,
        })

    session.commit()

    for r in results:
        db_rec = session.query(Reconciliation).filter(
            Reconciliation.batch_no == batch_no,
            Reconciliation.handwritten_name == r["handwritten_name"],
            Reconciliation.process_round == process_round,
        ).first()
        if db_rec:
            r["id"] = db_rec.id

    logs.append(f"=== 对账批次 {batch_no} 完成，生成对账记录 {len(results)} 条 ===")
    return batch_no, results, logs


def export_csv(
    session: Session,
    batch_no: str,
    filters: Optional[Dict[str, Any]] = None,
    output_dir: Optional[str] = None,
) -> Tuple[str, int]:
    """
    按批次+筛选条件导出CSV，并将筛选条件、备注、导出批次绑定
    同一批筛选再看时可恢复
    """
    output_dir = output_dir or config.EXPORT_DIR
    os.makedirs(output_dir, exist_ok=True)

    query = session.query(Reconciliation).filter(Reconciliation.batch_no == batch_no)

    applied_filters = filters or {}
    if applied_filters.get("review_status"):
        query = query.filter(Reconciliation.review_status == applied_filters["review_status"])
    if applied_filters.get("name_match_status"):
        query = query.filter(Reconciliation.name_match_status == applied_filters["name_match_status"])
    if applied_filters.get("weight_unit_status"):
        query = query.filter(Reconciliation.weight_unit_status == applied_filters["weight_unit_status"])
    if applied_filters.get("pet_name"):
        kw = f"%{applied_filters['pet_name']}%"
        query = query.filter((Reconciliation.pet_name.like(kw)) | (Reconciliation.handwritten_name.like(kw)))
    if applied_filters.get("process_round"):
        query = query.filter(Reconciliation.process_round == int(applied_filters["process_round"]))

    records = query.order_by(Reconciliation.process_round.desc(), Reconciliation.id.asc()).all()

    timestamp = generate_timestamp()
    file_name = f"宠物减重排程对账_{batch_no}_{timestamp}.csv"
    file_path = os.path.join(output_dir, file_name)

    with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=config.EXPORT_FIELDS)
        writer.writeheader()
        for rec in records:
            writer.writerow({
                "对账批次号": rec.batch_no,
                "宠物ID": rec.pet_id,
                "宠物名称": rec.pet_name or "",
                "手写单名称": rec.handwritten_name or "",
                "名称匹配状态": rec.name_match_status,
                "原始体重": rec.raw_weight or "",
                "体重单位": rec.weight_unit or "",
                "标准体重(kg)": f"{rec.standard_weight_kg:.4f}" if rec.standard_weight_kg is not None else "",
                "体重单位状态": rec.weight_unit_status,
                "目标体重(kg)": f"{rec.target_weight_kg:.4f}" if rec.target_weight_kg is not None else "",
                "减重差(kg)": f"{rec.weight_loss_diff:.4f}" if rec.weight_loss_diff is not None else "",
                "计划日期": rec.plan_date or "",
                "手写单日期": rec.record_date or "",
                "用药提醒": rec.medication_reminder or "",
                "病历摘要": rec.medical_summary or "",
                "复核状态": rec.review_status,
                "复核原因": rec.review_reason or "",
                "人工备注": rec.manual_note or "",
                "备注来源": rec.note_source,
                "处理状态": rec.process_status,
                "导出时间戳": timestamp,
            })
            rec.export_timestamp = timestamp

    session.commit()

    batch = session.query(ExportBatch).filter(ExportBatch.batch_no == batch_no).first()
    if batch is None:
        batch = ExportBatch(batch_no=batch_no)
        session.add(batch)
    batch.export_timestamp = timestamp
    batch.filter_criteria = json.dumps(applied_filters, ensure_ascii=False)
    batch.record_count = len(records)
    batch.file_name = file_name
    batch.file_path = file_path
    session.commit()

    state_key = f"export_{batch_no}_{timestamp}"
    filter_state = session.query(FilterState).filter(FilterState.state_key == state_key).first()
    if filter_state is None:
        filter_state = FilterState(state_key=state_key)
        session.add(filter_state)
    filter_state.filter_json = json.dumps(applied_filters, ensure_ascii=False)
    session.commit()

    return file_path, len(records)


def save_manual_note(
    session: Session,
    reconciliation_id: int,
    note_content: str,
    created_by: str = "阿岑",
    note_source: str = "人工",
) -> Optional[ManualNote]:
    recon = session.get(Reconciliation, reconciliation_id)
    if recon is None:
        return None

    session.query(ManualNote).filter(
        ManualNote.reconciliation_id == reconciliation_id,
        ManualNote.is_latest == True,
    ).update({"is_latest": False})

    note = ManualNote(
        reconciliation_id=reconciliation_id,
        note_content=note_content,
        note_source=note_source,
        created_by=created_by,
    )
    session.add(note)
    recon.manual_note = note_content
    recon.note_source = note_source
    session.commit()
    return note


def save_filter_state(
    session: Session,
    state_key: str,
    filter_data: Dict[str, Any],
    page: int = 1,
    per_page: int = 20,
):
    state = session.query(FilterState).filter(FilterState.state_key == state_key).first()
    if state is None:
        state = FilterState(state_key=state_key)
        session.add(state)
    state.filter_json = json.dumps(filter_data, ensure_ascii=False)
    state.page = page
    state.per_page = per_page
    session.commit()
    return state


def load_filter_state(session: Session, state_key: str) -> Optional[Dict[str, Any]]:
    state = session.query(FilterState).filter(FilterState.state_key == state_key).first()
    if state is None:
        return None
    return {
        "filters": json.loads(state.filter_json),
        "page": state.page,
        "per_page": state.per_page,
    }
