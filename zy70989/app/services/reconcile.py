import uuid
from datetime import datetime
from typing import List, Dict, Tuple
from app.models import (
    MeterReading, Order, DamageClaim, Property,
    ReconcileItem, ReconcileResult, ItemStatus, SuggestedAction
)
from app.services.electricity import calculate_electricity_cost, validate_meter_reading
from app.services.damage import validate_damage_claim
from app.services.refund import reconcile_deposit_refund

PROPERTY_CONFIG: Dict[str, Property] = {
    "PROP-BJ-001": Property(
        property_id="PROP-BJ-001",
        electricity_tiers=[
            ElectricityTier(min_kwh=0, max_kwh=240, price_per_kwh=0.48),
            ElectricityTier(min_kwh=240, max_kwh=400, price_per_kwh=0.54),
            ElectricityTier(min_kwh=400, max_kwh=None, price_per_kwh=0.79)
        ],
        water_price_per_ton=5.0,
        deposit_amount=500.0
    ),
    "PROP-BJ-002": Property(
        property_id="PROP-BJ-002",
        electricity_tiers=[
            ElectricityTier(min_kwh=0, max_kwh=240, price_per_kwh=0.48),
            ElectricityTier(min_kwh=240, max_kwh=400, price_per_kwh=0.54),
            ElectricityTier(min_kwh=400, max_kwh=None, price_per_kwh=0.79)
        ],
        water_price_per_ton=5.0,
        deposit_amount=800.0
    ),
    "PROP-SH-001": Property(
        property_id="PROP-SH-001",
        electricity_tiers=[
            ElectricityTier(min_kwh=0, max_kwh=3120, price_per_kwh=0.61),
            ElectricityTier(min_kwh=3120, max_kwh=4800, price_per_kwh=0.67),
            ElectricityTier(min_kwh=4800, max_kwh=None, price_per_kwh=0.97)
        ],
        water_price_per_ton=4.5,
        deposit_amount=600.0
    )
}


def get_property_config(property_id: str) -> Property:
    return PROPERTY_CONFIG.get(property_id, PROPERTY_CONFIG["PROP-BJ-001"])


def process_meter_reading(
    reading: MeterReading,
    order: Order,
    property_cfg: Property
) -> List[ReconcileItem]:
    items = []
    item_id = str(uuid.uuid4())[:8]
    
    elec_valid, elec_reason = validate_meter_reading(reading.electricity_start, reading.electricity_end)
    elec_usage = reading.electricity_end - reading.electricity_start
    elec_cost, elec_rule = calculate_electricity_cost(elec_usage, property_cfg.electricity_tiers)
    
    if elec_valid:
        items.append(ReconcileItem(
            item_id=f"elec-{item_id}",
            order_id=order.order_id,
            property_id=reading.property_id,
            guest_name=order.guest_name,
            status=ItemStatus.NORMAL,
            category="电费",
            description=f"入住{reading.checkin_date}至退房{reading.checkout_date}电费",
            original_amount=elec_cost,
            calculated_amount=elec_cost,
            difference=0.0,
            raw_fields=reading.raw_data,
            suggested_action=SuggestedAction.APPROVE,
            reason=elec_rule,
            evidence_status="抄表数据完整",
            rule_applied="阶梯电价规则"
        ))
    else:
        items.append(ReconcileItem(
            item_id=f"elec-{item_id}",
            order_id=order.order_id,
            property_id=reading.property_id,
            guest_name=order.guest_name,
            status=ItemStatus.FAILED,
            category="电费",
            description="电费计算异常",
            original_amount=0.0,
            calculated_amount=elec_cost,
            difference=elec_cost,
            raw_fields=reading.raw_data,
            suggested_action=SuggestedAction.MANUAL_REVIEW,
            reason=elec_reason,
            evidence_status="抄表数据异常",
            rule_applied="电表读数校验规则"
        ))
    
    water_valid, water_reason = validate_meter_reading(reading.water_start, reading.water_end)
    water_usage = reading.water_end - reading.water_start
    water_cost = round(water_usage * property_cfg.water_price_per_ton, 2)
    
    if water_valid:
        items.append(ReconcileItem(
            item_id=f"water-{item_id}",
            order_id=order.order_id,
            property_id=reading.property_id,
            guest_name=order.guest_name,
            status=ItemStatus.NORMAL,
            category="水费",
            description=f"入住{reading.checkin_date}至退房{reading.checkout_date}水费",
            original_amount=water_cost,
            calculated_amount=water_cost,
            difference=0.0,
            raw_fields=reading.raw_data,
            suggested_action=SuggestedAction.APPROVE,
            reason=f"用水{water_usage:.2f}吨 × {property_cfg.water_price_per_ton:.2f}元/吨 = {water_cost:.2f}元",
            evidence_status="抄表数据完整",
            rule_applied="水费计价规则"
        ))
    else:
        items.append(ReconcileItem(
            item_id=f"water-{item_id}",
            order_id=order.order_id,
            property_id=reading.property_id,
            guest_name=order.guest_name,
            status=ItemStatus.FAILED,
            category="水费",
            description="水费计算异常",
            original_amount=0.0,
            calculated_amount=water_cost,
            difference=water_cost,
            raw_fields=reading.raw_data,
            suggested_action=SuggestedAction.MANUAL_REVIEW,
            reason=water_reason,
            evidence_status="抄表数据异常",
            rule_applied="水表读数校验规则"
        ))
    
    return items, elec_cost + water_cost


def process_damage_claim(
    claim: DamageClaim,
    order: Order,
    property_cfg: Property
) -> Tuple[ReconcileItem, float]:
    item_id = str(uuid.uuid4())[:8]
    status, action, reason = validate_damage_claim(claim, deposit_amount=property_cfg.deposit_amount)
    
    item = ReconcileItem(
        item_id=f"damage-{item_id}",
        order_id=order.order_id,
        property_id=claim.property_id,
        guest_name=order.guest_name,
        status=status,
        category="损坏扣款",
        description=claim.description,
        original_amount=claim.claimed_amount,
        calculated_amount=claim.claimed_amount if status == ItemStatus.NORMAL else 0.0,
        difference=0.0 if status == ItemStatus.NORMAL else claim.claimed_amount,
        raw_fields=claim.raw_data,
        suggested_action=action,
        reason=reason,
        evidence_status="已提供照片" if claim.has_photo else "缺少照片",
        rule_applied="损坏扣款校验规则"
    )
    
    actual_cost = claim.claimed_amount if status == ItemStatus.NORMAL else 0.0
    return item, actual_cost


def process_deposit_refund(
    order: Order,
    total_utility_cost: float,
    total_damage_cost: float,
    raw_data: Dict
) -> ReconcileItem:
    item_id = str(uuid.uuid4())[:8]
    status, action, reason, expected_refund, actual_refund = reconcile_deposit_refund(
        order, total_utility_cost, total_damage_cost
    )
    
    return ReconcileItem(
        item_id=f"refund-{item_id}",
        order_id=order.order_id,
        property_id=order.property_id,
        guest_name=order.guest_name,
        status=status,
        category="押金退款",
        description=f"订单{order.order_id}押金退款核对",
        original_amount=actual_refund,
        calculated_amount=expected_refund,
        difference=round(actual_refund - expected_refund, 2),
        raw_fields=raw_data,
        suggested_action=action,
        reason=reason,
        evidence_status="数据完整" if status == ItemStatus.NORMAL else "需补充核对",
        rule_applied="退款冲正规则"
    )


def reconcile_batch(
    batch_id: str,
    meter_readings: List[MeterReading],
    orders: List[Order],
    damage_claims: List[DamageClaim]
) -> ReconcileResult:
    all_items: List[ReconcileItem] = []
    order_map = {o.order_id: o for o in orders}
    
    for reading in meter_readings:
        order = order_map.get(reading.order_id)
        if not order:
            all_items.append(ReconcileItem(
                item_id=f"missing-{str(uuid.uuid4())[:8]}",
                order_id=reading.order_id,
                property_id=reading.property_id,
                guest_name="未知",
                status=ItemStatus.FAILED,
                category="系统",
                description="找不到对应订单",
                original_amount=0.0,
                calculated_amount=0.0,
                difference=0.0,
                raw_fields=reading.raw_data,
                suggested_action=SuggestedAction.MANUAL_REVIEW,
                reason=f"抄表记录关联的订单{reading.order_id}不存在",
                evidence_status="缺失订单数据",
                rule_applied="数据关联校验"
            ))
            continue
        
        property_cfg = get_property_config(reading.property_id)
        utility_items, total_utility = process_meter_reading(reading, order, property_cfg)
        all_items.extend(utility_items)
        
        claim_total = 0.0
        for claim in damage_claims:
            if claim.order_id == order.order_id:
                claim_item, actual_claim = process_damage_claim(claim, order, property_cfg)
                all_items.append(claim_item)
                claim_total += actual_claim
        
        refund_item = process_deposit_refund(order, total_utility, claim_total, {
            "order": order.model_dump(),
            "utility_cost": total_utility,
            "damage_cost": claim_total
        })
        all_items.append(refund_item)
    
    for claim in damage_claims:
        if claim.order_id not in order_map:
            all_items.append(ReconcileItem(
                item_id=f"missing-{str(uuid.uuid4())[:8]}",
                order_id=claim.order_id,
                property_id=claim.property_id,
                guest_name="未知",
                status=ItemStatus.FAILED,
                category="系统",
                description="找不到对应订单",
                original_amount=claim.claimed_amount,
                calculated_amount=0.0,
                difference=claim.claimed_amount,
                raw_fields=claim.raw_data,
                suggested_action=SuggestedAction.MANUAL_REVIEW,
                reason=f"损坏扣款关联的订单{claim.order_id}不存在",
                evidence_status="缺失订单数据",
                rule_applied="数据关联校验"
            ))
        elif not any(r.order_id == claim.order_id for r in meter_readings):
            all_items.append(ReconcileItem(
                item_id=f"missing-{str(uuid.uuid4())[:8]}",
                order_id=claim.order_id,
                property_id=claim.property_id,
                guest_name=order_map[claim.order_id].guest_name,
                status=ItemStatus.PENDING,
                category="系统",
                description="缺少水电抄表数据",
                original_amount=claim.claimed_amount,
                calculated_amount=claim.claimed_amount,
                difference=0.0,
                raw_fields=claim.raw_data,
                suggested_action=SuggestedAction.REQUEST_EVIDENCE,
                reason=f"订单{claim.order_id}已有扣款但未上传水电抄表",
                evidence_status="缺失抄表数据",
                rule_applied="完整性校验"
            ))
    
    normal_items = [i for i in all_items if i.status == ItemStatus.NORMAL]
    pending_items = [i for i in all_items if i.status == ItemStatus.PENDING]
    failed_items = [i for i in all_items if i.status == ItemStatus.FAILED]
    
    return ReconcileResult(
        batch_id=batch_id,
        processed_at=datetime.now(),
        total_items=len(all_items),
        normal_count=len(normal_items),
        pending_count=len(pending_items),
        failed_count=len(failed_items),
        normal_items=normal_items,
        pending_items=pending_items,
        failed_items=failed_items
    )
