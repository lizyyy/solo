import hashlib
import json
import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from . import models, schemas
from .models import BatchStatus, DetailType

FINAL_STATUSES = [BatchStatus.SPLIT_COMPLETED, BatchStatus.REPORT_GENERATED]


def generate_material_fingerprint(material_data):
    sorted_data = json.dumps(material_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(sorted_data.encode("utf-8")).hexdigest()


def generate_reference_no(detail_type, batch_no):
    prefix_map = {
        DetailType.ELECTRICITY: "ELEC",
        DetailType.WATER: "WATR",
        DetailType.DAMAGE: "DAMG",
        DetailType.REFUND: "REFN",
    }
    prefix = prefix_map.get(detail_type, "OTHR")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique = str(uuid.uuid4())[:8].upper()
    return f"{prefix}-{batch_no}-{timestamp}-{unique}"


def calculate_electricity_fee(usage_kwh):
    tiers = [
        (0, 240, 0.538),
        (240, 400, 0.588),
        (400, float("inf"), 0.838),
    ]
    total_fee = 0.0
    calc_details = []
    remaining = usage_kwh
    for start, end, price in tiers:
        if remaining <= 0:
            break
        tier_usage = min(remaining, end - start)
        if tier_usage > 0:
            tier_fee = tier_usage * price
            total_fee += tier_fee
            calc_details.append(f"{start}-{end}kWh: {tier_usage:.2f}kWh x {price:.3f} = {tier_fee:.2f}")
        remaining -= tier_usage
    nl = chr(10)
    calc_str = f"Electricity {usage_kwh:.2f}kWh{nl}" + f"{nl}".join(calc_details) + f"{nl}Total: {total_fee:.2f}"
    return round(total_fee, 2), calc_str


def calculate_water_fee(usage_ton):
    base_price = 5.0
    sewage_fee = 1.5
    total_price = base_price + sewage_fee
    total_fee = usage_ton * total_price
    nl = chr(10)
    calc_str = (
        f"Water {usage_ton:.2f} ton{nl}"
        f"Water fee: {usage_ton:.2f} x {base_price:.2f} = {usage_ton * base_price:.2f}{nl}"
        f"Sewage fee: {usage_ton:.2f} x {sewage_fee:.2f} = {usage_ton * sewage_fee:.2f}{nl}"
        f"Total: {total_fee:.2f}"
    )
    return round(total_fee, 2), calc_str


def check_duplicate_batch(db, fingerprint):
    return db.query(models.Batch).filter(
        models.Batch.material_fingerprint == fingerprint
    ).first()


def create_batch(db, batch):
    db_batch = models.Batch(
        batch_no=batch.batch_no,
        operator=batch.operator,
        property_id=batch.property_id,
        tenant_name=batch.tenant_name,
        deposit_amount=batch.deposit_amount,
        status=BatchStatus.CREATED,
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch, False


def get_or_create_batch(db, batch):
    existing = db.query(models.Batch).filter(
        models.Batch.batch_no == batch.batch_no
    ).first()
    if existing:
        return existing, True
    return create_batch(db, batch)


def upload_materials(db, request):
    batch = db.query(models.Batch).filter(
        models.Batch.batch_no == request.batch_no
    ).first()
    if not batch:
        raise ValueError(f"Batch {request.batch_no} not found")
    material_dict = request.model_dump(exclude={"batch_no", "operator"})
    material_dict = {k: v for k, v in material_dict.items() if v is not None}
    fingerprint = generate_material_fingerprint(material_dict)
    existing_batch = check_duplicate_batch(db, fingerprint)
    if existing_batch and existing_batch.id != batch.id:
        return existing_batch, True, fingerprint
    if batch.material_fingerprint == fingerprint:
        return batch, True, fingerprint
    if batch.status in FINAL_STATUSES:
        raise ValueError(
            f"Batch {request.batch_no} already finalized, cannot modify materials"
        )
    existing_materials = db.query(models.Material).filter(
        models.Material.batch_id == batch.id
    ).all()
    for mat in existing_materials:
        db.delete(mat)
    db.commit()
    for mat_type, content in material_dict.items():
        content_str = json.dumps(content, ensure_ascii=False)
        db_material = models.Material(
            batch_id=batch.id,
            material_type=mat_type,
            content=content_str,
        )
        db.add(db_material)
    batch.material_fingerprint = fingerprint
    batch.status = BatchStatus.MATERIALS_UPLOADED
    db.commit()
    db.refresh(batch)
    return batch, False, fingerprint


def add_trace(db, detail_id, action, operator=None, remark=None):
    trace = models.ProcessingTrace(
        detail_id=detail_id,
        action=action,
        operator=operator,
        remark=remark,
    )
    db.add(trace)
    db.commit()


def process_electricity(db, batch_id, batch_no, electricity_data, operator):
    usage = electricity_data.get("usage_kwh", 0)
    fee, calc_details = calculate_electricity_fee(usage)
    detail = models.SettlementDetail(
        batch_id=batch_id,
        detail_type=DetailType.ELECTRICITY,
        reference_no=generate_reference_no(DetailType.ELECTRICITY, batch_no),
        original_amount=usage,
        calculated_amount=fee,
        description=f"Electricity - {usage:.2f}kWh",
        calc_details=calc_details,
        status="completed",
    )
    db.add(detail)
    db.flush()
    add_trace(db, detail.id, "create_electricity", operator, f"usage: {usage:.2f}kWh, fee: {fee:.2f}")
    add_trace(db, detail.id, "tiered_calc_done", operator, calc_details)
    return detail


def process_water(db, batch_id, batch_no, water_data, operator):
    usage = water_data.get("usage_ton", 0)
    fee, calc_details = calculate_water_fee(usage)
    detail = models.SettlementDetail(
        batch_id=batch_id,
        detail_type=DetailType.WATER,
        reference_no=generate_reference_no(DetailType.WATER, batch_no),
        original_amount=usage,
        calculated_amount=fee,
        description=f"Water - {usage:.2f} ton",
        calc_details=calc_details,
        status="completed",
    )
    db.add(detail)
    db.flush()
    add_trace(db, detail.id, "create_water", operator, f"usage: {usage:.2f} ton, fee: {fee:.2f}")
    add_trace(db, detail.id, "water_calc_done", operator, calc_details)
    return detail


def process_damages(db, batch_id, batch_no, damages, operator):
    details = []
    for damage in damages:
        detail = models.SettlementDetail(
            batch_id=batch_id,
            detail_type=DetailType.DAMAGE,
            reference_no=generate_reference_no(DetailType.DAMAGE, batch_no),
            original_amount=damage.get("compensation_amount", 0),
            calculated_amount=damage.get("compensation_amount", 0),
            description=f"Damage - {damage.get('item_name', 'unknown')}",
            calc_details=json.dumps({
                "item_name": damage.get("item_name"),
                "damage_description": damage.get("damage_description"),
                "photo_reference": damage.get("photo_reference"),
                "compensation_amount": damage.get("compensation_amount"),
            }, ensure_ascii=False),
            status="completed",
        )
        db.add(detail)
        db.flush()
        add_trace(db, detail.id, "create_damage", operator, f"item: {damage.get('item_name')}, amount: {damage.get('compensation_amount')}")
        add_trace(db, detail.id, "photo_verified", operator, f"photo: {damage.get('photo_reference')}")
        details.append(detail)
    return details


def process_refunds(db, batch_id, batch_no, refunds, operator):
    details = []
    for refund in refunds:
        detail = models.SettlementDetail(
            batch_id=batch_id,
            detail_type=DetailType.REFUND,
            reference_no=generate_reference_no(DetailType.REFUND, batch_no),
            original_amount=refund.get("amount", 0),
            calculated_amount=refund.get("amount", 0),
            description=f"Refund - {refund.get('reason', 'unknown')}",
            calc_details=json.dumps({
                "reason": refund.get("reason"),
                "original_transaction_no": refund.get("original_transaction_no"),
                "amount": refund.get("amount"),
            }, ensure_ascii=False),
            status="completed",
        )
        db.add(detail)
        db.flush()
        add_trace(db, detail.id, "create_refund", operator, f"reason: {refund.get('reason')}, amount: {refund.get('amount')}")
        add_trace(db, detail.id, "transaction_verified", operator, f"tx: {refund.get('original_transaction_no')}")
        details.append(detail)
    return details


def split_settlement(db, batch_no):
    batch = db.query(models.Batch).filter(
        models.Batch.batch_no == batch_no
    ).first()
    if not batch:
        raise ValueError(f"Batch {batch_no} not found")
    existing_details = db.query(models.SettlementDetail).filter(
        models.SettlementDetail.batch_id == batch.id
    ).all()
    if existing_details and batch.status in [BatchStatus.SPLIT_COMPLETED, BatchStatus.REPORT_GENERATED]:
        return batch, True, existing_details, f"Duplicate detected: batch already {batch.status.value}, returning history"
    if batch.status not in [BatchStatus.MATERIALS_UPLOADED, BatchStatus.SPLITTING]:
        raise ValueError(f"Batch {batch_no} status not allowed for split: {batch.status}")
    batch.status = BatchStatus.SPLITTING
    db.commit()
    materials = db.query(models.Material).filter(
        models.Material.batch_id == batch.id
    ).all()
    material_dict = {}
    for mat in materials:
        try:
            material_dict[mat.material_type] = json.loads(mat.content)
        except Exception:
            material_dict[mat.material_type] = mat.content
    all_details = []
    electricity_data = material_dict.get("electricity")
    if electricity_data:
        detail = process_electricity(db, batch.id, batch_no, electricity_data, batch.operator)
        all_details.append(detail)
    water_data = material_dict.get("water")
    if water_data:
        detail = process_water(db, batch.id, batch_no, water_data, batch.operator)
        all_details.append(detail)
    damages = material_dict.get("damages", [])
    if damages:
        damage_details = process_damages(db, batch.id, batch_no, damages, batch.operator)
        all_details.extend(damage_details)
    refunds = material_dict.get("refunds", [])
    if refunds:
        refund_details = process_refunds(db, batch.id, batch_no, refunds, batch.operator)
        all_details.extend(refund_details)
    batch.status = BatchStatus.SPLIT_COMPLETED
    db.commit()
    db.refresh(batch)
    return batch, False, all_details, "Split done: electricity, water, damages, refunds processed separately"


def generate_report(db, batch_no):
    batch = db.query(models.Batch).filter(
        models.Batch.batch_no == batch_no
    ).first()
    if not batch:
        raise ValueError(f"Batch {batch_no} not found")
    existing_report = db.query(models.Report).filter(
        models.Report.batch_id == batch.id
    ).first()
    if existing_report:
        return existing_report
    if batch.status not in [BatchStatus.SPLIT_COMPLETED, BatchStatus.REPORT_GENERATED]:
        raise ValueError(f"Batch {batch_no} not split yet, cannot generate report")
    details = db.query(models.SettlementDetail).filter(
        models.SettlementDetail.batch_id == batch.id
    ).all()
    total_electricity = sum(d.calculated_amount for d in details if d.detail_type == DetailType.ELECTRICITY)
    total_water = sum(d.calculated_amount for d in details if d.detail_type == DetailType.WATER)
    total_damage = sum(d.calculated_amount for d in details if d.detail_type == DetailType.DAMAGE)
    total_refund = sum(d.calculated_amount for d in details if d.detail_type == DetailType.REFUND)
    total_settlement = total_electricity + total_water + total_damage - total_refund
    deposit_refund = max(batch.deposit_amount - total_settlement, 0)
    nl = chr(10)
    comma = chr(44) + chr(32)
    report_content = (
        f"Deposit Settlement Report{nl}"
        f"=================={nl}"
        f"Batch: {batch.batch_no}{nl}"
        f"Property: {batch.property_id}{nl}"
        f"Tenant: {batch.tenant_name}{nl}"
        f"Operator: {batch.operator}{nl}"
        f"Deposit: {batch.deposit_amount:.2f}{nl}{nl}"
        f"Fees:{nl}"
        f"--------{nl}"
        f"Electricity: {total_electricity:.2f}{nl}"
        f"Water: {total_water:.2f}{nl}"
        f"Damages: {total_damage:.2f}{nl}"
        f"Refunds: {total_refund:.2f}{nl}{nl}"
        f"Summary:{nl}"
        f"--------{nl}"
        f"Total settlement: {total_settlement:.2f}{nl}"
        f"Deposit refund: {deposit_refund:.2f}{nl}{nl}"
        f"Traceability:{nl}"
        f"--------{nl}"
        f"Material fingerprint: {batch.material_fingerprint}{nl}"
        f"Detail refs: {comma.join([d.reference_no for d in details])}"
    )
    fmt = chr(37) + "Y" + chr(37) + "m" + chr(37) + "d" + chr(37) + "H" + chr(37) + "M" + chr(37) + "S"
    report_no = f"RPT-{batch_no}-{datetime.now().strftime(fmt)}"
    report = models.Report(
        batch_id=batch.id,
        report_no=report_no,
        total_electricity_fee=total_electricity,
        total_water_fee=total_water,
        total_damage_compensation=total_damage,
        total_refund=total_refund,
        total_settlement=total_settlement,
        deposit_refund=deposit_refund,
        report_content=report_content,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    batch.status = BatchStatus.REPORT_GENERATED
    db.commit()
    return report


def get_detail_traces(db, detail_id):
    return db.query(models.ProcessingTrace).filter(
        models.ProcessingTrace.detail_id == detail_id
    ).order_by(models.ProcessingTrace.created_at.asc()).all()


def get_detail_by_reference(db, reference_no):
    return db.query(models.SettlementDetail).filter(
        models.SettlementDetail.reference_no == reference_no
    ).first()


def get_batch(db, batch_no):
    return db.query(models.Batch).filter(
        models.Batch.batch_no == batch_no
    ).first()
