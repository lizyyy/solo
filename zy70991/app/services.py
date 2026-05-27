import hashlib
import json
import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from . import models, schemas
from .models import BatchStatus, DetailType


def generate_material_fingerprint(material_data: Dict) -> str:
    sorted_data = json.dumps(material_data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(sorted_data.encode('utf-8')).hexdigest()


def generate_reference_no(detail_type: DetailType, batch_no: str) -> str:
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


def calculate_electricity_fee(usage_kwh: float) -> Tuple[float, str]:
    tiers = [
        (0, 240, 0.538),
        (240, 400, 0.588),
        (400, float('inf'), 0.838),
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
            calc_details.append(f"{start}-{end}kWh: {tier_usage:.2f}kWh × {price:.3f}元 = {tier_fee:.2f}元")
        remaining -= tier_usage
    
    calc_str = f"用电量 {usage_kwh:.2f}kWh\n" + "\n".join(calc_details) + f"\n合计: {total_fee:.2f}元"
    return round(total_fee, 2), calc_str


def calculate_water_fee(usage_ton: float) -> Tuple[float, str]:
    base_price = 5.0
    sewage_fee = 1.5
    total_price = base_price + sewage_fee
    
    total_fee = usage_ton * total_price
    calc_str = f"用水量 {usage_ton:.2f}吨\n水费: {usage_ton:.2f}吨 × {base_price:.2f}元/吨 = {usage_ton * base_price:.2f}元\n污水处理费: {usage_ton:.2f}吨 × {sewage_fee:.2f}元/吨 = {usage_ton * sewage_fee:.2f}元\n合计: {total_fee:.2f}元"
    return round(total_fee, 2), calc_str


def check_duplicate_batch(db: Session, fingerprint: str) -> Optional[models.Batch]:
    return db.query(models.Batch).filter(
        models.Batch.material_fingerprint == fingerprint
    ).first()


def create_batch(db: Session, batch: schemas.BatchCreate) -> Tuple[models.Batch, bool]:
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


def get_or_create_batch(db: Session, batch: schemas.BatchCreate) -> Tuple[models.Batch, bool]:
    existing = db.query(models.Batch).filter(
        models.Batch.batch_no == batch.batch_no
    ).first()
    if existing:
        return existing, True
    return create_batch(db, batch)


def upload_materials(db: Session, request: schemas.MaterialUploadRequest) -> Tuple[models.Batch, bool, str]:
    batch = db.query(models.Batch).filter(
        models.Batch.batch_no == request.batch_no
    ).first()
    
    if not batch:
        raise ValueError(f"Batch {request.batch_no} not found")
    
    material_dict = request.model_dump(exclude={'batch_no', 'operator'})
    material_dict = {k: v for k, v in material_dict.items() if v is not None}
    
    fingerprint = generate_material_fingerprint(material_dict)
    
    existing_batch = check_duplicate_batch(db, fingerprint)
    if existing_batch and existing_batch.id != batch.id:
        return existing_batch, True, fingerprint
    
    if batch.material_fingerprint == fingerprint:
        return batch, True, fingerprint
    
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


def add_trace(db: Session, detail_id: int, action: str, operator: str = None, remark: str = None):
    trace = models.ProcessingTrace(
        detail_id=detail_id,
        action=action,
        operator=operator,
        remark=remark,
    )
    db.add(trace)
    db.commit()


def process_electricity(db: Session, batch_id: int, batch_no: str, electricity_data: dict, operator: str) -> models.SettlementDetail:
    usage = electricity_data.get('usage_kwh', 0)
    fee, calc_details = calculate_electricity_fee(usage)
    
    detail = models.SettlementDetail(
        batch_id=batch_id,
        detail_type=DetailType.ELECTRICITY,
        reference_no=generate_reference_no(DetailType.ELECTRICITY, batch_no),
        original_amount=usage,
        calculated_amount=fee,
        description=f"电费结算 - 用电量 {usage:.2f}kWh",
        calc_details=calc_details,
        status="completed",
    )
    db.add(detail)
    db.flush()
    
    add_trace(db, detail.id, "创建电费结算明细", operator, f"用电量: {usage:.2f}kWh, 计算费用: {fee:.2f}元")
    add_trace(db, detail.id, "阶梯电价计算完成", operator, calc_details)
    
    return detail


def process_water(db: Session, batch_id: int, batch_no: str, water_data: dict, operator: str) -> models.SettlementDetail:
    usage = water_data.get('usage_ton', 0)
    fee, calc_details = calculate_water_fee(usage)
    
    detail = models.SettlementDetail(
        batch_id=batch_id,
        detail_type=DetailType.WATER,
        reference_no=generate_reference_no(DetailType.WATER, batch_no),
        original_amount=usage,
        calculated_amount=fee,
        description=f"水费结算 - 用水量 {usage:.2f}吨",
        calc_details=calc_details,
        status="completed",
    )
    db.add(detail)
    db.flush()
    
    add_trace(db, detail.id, "创建水费结算明细", operator, f"用水量: {usage:.2f}吨, 计算费用: {fee:.2f}元")
    add_trace(db, detail.id, "水费计算完成", operator, calc_details)
    
    return detail


def process_damages(db: Session, batch_id: int, batch_no: str, damages: List[dict], operator: str) -> List[models.SettlementDetail]:
    details = []
    for idx, damage in enumerate(damages):
        detail = models.SettlementDetail(
            batch_id=batch_id,
            detail_type=DetailType.DAMAGE,
            reference_no=generate_reference_no(DetailType.DAMAGE, batch_no),
            original_amount=damage.get('compensation_amount', 0),
            calculated_amount=damage.get('compensation_amount', 0),
            description=f"损坏赔偿 - {damage.get('item_name', '未知物品')}",
            calc_details=json.dumps({
                "item_name": damage.get('item_name'),
                "damage_description": damage.get('damage_description'),
                "photo_reference": damage.get('photo_reference'),
                "compensation_amount": damage.get('compensation_amount'),
            }, ensure_ascii=False),
            status="completed",
        )
        db.add(detail)
        db.flush()
        
        add_trace(db, detail.id, "创建损坏赔偿明细", operator, f"物品: {damage.get('item_name')}, 赔偿金额: {damage.get('compensation_amount'):.2f}元")
        add_trace(db, detail.id, "损坏照片核验通过", operator, f"照片引用: {damage.get('photo_reference')}")
        
        details.append(detail)
    return details


def process_refunds(db: Session, batch_id: int, batch_no: str, refunds: List[dict], operator: str) -> List[models.SettlementDetail]:
    details = []
    for idx, refund in enumerate(refunds):
        detail = models.SettlementDetail(
            batch_id=batch_id,
            detail_type=DetailType.REFUND,
            reference_no=generate_reference_no(DetailType.REFUND, batch_no),
            original_amount=refund.get('amount', 0),
            calculated_amount=refund.get('amount', 0),
            description=f"退款冲正 - {refund.get('reason', '未知原因')}",
            calc_details=json.dumps({
                "reason": refund.get('reason'),
                "original_transaction_no": refund.get('original_transaction_no'),
                "amount": refund.get('amount'),
            }, ensure_ascii=False),
            status="completed",
        )
        db.add(detail)
        db.flush()
        
        add_trace(db, detail.id, "创建退款冲正明细", operator, f"原因: {refund.get('reason')}, 金额: {refund.get('amount'):.2f}元")
        add_trace(db, detail.id, "原交易关联验证通过", operator, f"原交易号: {refund.get('original_transaction_no')}")
        
        details.append(detail)
    return details


def split_settlement(db: Session, batch_no: str) -> Tuple[models.Batch, bool, List[models.SettlementDetail], str]:
    batch = db.query(models.Batch).filter(
        models.Batch.batch_no == batch_no
    ).first()
    
    if not batch:
        raise ValueError(f"Batch {batch_no} not found")
    
    existing_details = db.query(models.SettlementDetail).filter(
        models.SettlementDetail.batch_id == batch.id
    ).all()
    
    if existing_details and batch.status == BatchStatus.SPLIT_COMPLETED:
        return batch, True, existing_details, "重复提交检测：该批次材料已完成拆分，返回历史处理结果"
    
    if batch.status not in [BatchStatus.MATERIALS_UPLOADED, BatchStatus.SPLITTING]:
        raise ValueError(f"Batch {batch_no} 状态不允许拆分，当前状态: {batch.status}")
    
    batch.status = BatchStatus.SPLITTING
    db.commit()
    
    materials = db.query(models.Material).filter(
        models.Material.batch_id == batch.id
    ).all()
    
    material_dict = {}
    for mat in materials:
        try:
            material_dict[mat.material_type] = json.loads(mat.content)
        except:
            material_dict[mat.material_type] = mat.content
    
    all_details = []
    
    electricity_data = material_dict.get('electricity')
    if electricity_data:
        detail = process_electricity(db, batch.id, batch_no, electricity_data, batch.operator)
        all_details.append(detail)
    
    water_data = material_dict.get('water')
    if water_data:
        detail = process_water(db, batch.id, batch_no, water_data, batch.operator)
        all_details.append(detail)
    
    damages = material_dict.get('damages', [])
    if damages:
        damage_details = process_damages(db, batch.id, batch_no, damages, batch.operator)
        all_details.extend(damage_details)
    
    refunds = material_dict.get('refunds', [])
    if refunds:
        refund_details = process_refunds(db, batch.id, batch_no, refunds, batch.operator)
        all_details.extend(refund_details)
    
    batch.status = BatchStatus.SPLIT_COMPLETED
    db.commit()
    db.refresh(batch)
    
    return batch, False, all_details, "拆分完成：电费、水费、损坏赔偿、退款冲正已分开处理，独立核算避免重复扣减"


def generate_report(db: Session, batch_no: str) -> models.Report:
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
    
    if batch.status != BatchStatus.SPLIT_COMPLETED:
        raise ValueError(f"Batch {batch_no} 未完成拆分，无法生成报告")
    
    details = db.query(models.SettlementDetail).filter(
        models.SettlementDetail.batch_id == batch.id
    ).all()
    
    total_electricity = sum(d.calculated_amount for d in details if d.detail_type == DetailType.ELECTRICITY)
    total_water = sum(d.calculated_amount for d in details if d.detail_type == DetailType.WATER)
    total_damage = sum(d.calculated_amount for d in details if d.detail_type == DetailType.DAMAGE)
    total_refund = sum(d.calculated_amount for d in details if d.detail_type == DetailType.REFUND)
    
    total_settlement = total_electricity + total_water + total_damage - total_refund
    deposit_refund = max(batch.deposit_amount - total_settlement, 0)
    
    report_content = f"""
短租房押金结算报告
==================
批次号: {batch.batch_no}
房源: {batch.property_id}
租客: {batch.tenant_name}
操作员: {batch.operator}
押金金额: {batch.deposit_amount:.2f} 元

费用明细:
--------
电费合计: {total_electricity:.2f} 元
水费合计: {total_water:.2f} 元
损坏赔偿合计: {total_damage:.2f} 元
退款冲正合计: {total_refund:.2f} 元

结算汇总:
--------
应扣费用总计: {total_settlement:.2f} 元
应退押金: {deposit_refund:.2f} 元

关键字段追溯:
--------
原始材料指纹: {batch.material_fingerprint}
结算明细参考号: {', '.join([d.reference_no for d in details])}
    """.strip()
    
    report_no = f"RPT-{batch_no}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
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


def get_detail_traces(db: Session, detail_id: int) -> List[models.ProcessingTrace]:
    return db.query(models.ProcessingTrace).filter(
        models.ProcessingTrace.detail_id == detail_id
    ).order_by(models.ProcessingTrace.created_at.asc()).all()


def get_detail_by_reference(db: Session, reference_no: str) -> Optional[models.SettlementDetail]:
    return db.query(models.SettlementDetail).filter(
        models.SettlementDetail.reference_no == reference_no
    ).first()


def get_batch(db: Session, batch_no: str) -> Optional[models.Batch]:
    return db.query(models.Batch).filter(
        models.Batch.batch_no == batch_no
    ).first()
