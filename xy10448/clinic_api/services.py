from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from . import models, schemas
from .models import VisitStatus, RefundType


def generate_number(prefix: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}{timestamp}"


def get_supply(db: Session, supply_id: int) -> Optional[models.Supply]:
    return db.query(models.Supply).filter(models.Supply.id == supply_id).first()


def get_supplies(db: Session, skip: int = 0, limit: int = 100) -> List[models.Supply]:
    return db.query(models.Supply).offset(skip).limit(limit).all()


def create_supply(db: Session, supply: schemas.SupplyCreate) -> models.Supply:
    db_supply = models.Supply(**supply.model_dump())
    db.add(db_supply)
    db.commit()
    db.refresh(db_supply)
    return db_supply


def update_supply(db: Session, supply_id: int, supply_update: schemas.SupplyUpdate) -> Optional[models.Supply]:
    db_supply = get_supply(db, supply_id)
    if db_supply:
        update_data = supply_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_supply, key, value)
        db.commit()
        db.refresh(db_supply)
    return db_supply


def get_treatment_item(db: Session, item_id: int) -> Optional[models.TreatmentItem]:
    return db.query(models.TreatmentItem).filter(models.TreatmentItem.id == item_id).first()


def get_treatment_items(db: Session, skip: int = 0, limit: int = 100) -> List[models.TreatmentItem]:
    return db.query(models.TreatmentItem).offset(skip).limit(limit).all()


def create_treatment_item(db: Session, item: schemas.TreatmentItemCreate) -> models.TreatmentItem:
    db_item = models.TreatmentItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_treatment_item(db: Session, item_id: int, item_update: schemas.TreatmentItemUpdate) -> Optional[models.TreatmentItem]:
    db_item = get_treatment_item(db, item_id)
    if db_item:
        update_data = item_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)
        db.commit()
        db.refresh(db_item)
    return db_item


def create_supply_template(db: Session, template: schemas.SupplyTemplateCreate) -> models.SupplyTemplate:
    db_template = models.SupplyTemplate(**template.model_dump())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def get_supply_templates_by_treatment(db: Session, treatment_item_id: int) -> List[models.SupplyTemplate]:
    return db.query(models.SupplyTemplate).filter(models.SupplyTemplate.treatment_item_id == treatment_item_id).all()


def get_patient(db: Session, patient_id: int) -> Optional[models.Patient]:
    return db.query(models.Patient).filter(models.Patient.id == patient_id).first()


def get_patient_by_phone(db: Session, phone: str) -> Optional[models.Patient]:
    return db.query(models.Patient).filter(models.Patient.phone == phone).first()


def create_patient(db: Session, patient: schemas.PatientCreate) -> models.Patient:
    db_patient = models.Patient(**patient.model_dump())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


def check_stock_for_visit_items(db: Session, visit_items: List[schemas.VisitItemCreate]) -> Tuple[bool, List[Dict]]:
    results = []
    all_sufficient = True

    for visit_item in visit_items:
        treatment = get_treatment_item(db, visit_item.treatment_item_id)
        if not treatment:
            continue

        templates = get_supply_templates_by_treatment(db, treatment.id)
        for template in templates:
            supply = get_supply(db, template.supply_id)
            if not supply:
                continue

            required = template.quantity * visit_item.quantity
            is_sufficient = supply.stock >= required

            if not is_sufficient:
                all_sufficient = False

            results.append({
                "supply_id": supply.id,
                "supply_name": supply.name,
                "required": required,
                "available": supply.stock,
                "is_sufficient": is_sufficient
            })

    return all_sufficient, results


def check_stock_for_actual_supplies(db: Session, visit_id: int, actual_supplies: List[schemas.ActualSupplyCreate]) -> Tuple[bool, List[Dict]]:
    visit = db.query(models.Visit).filter(models.Visit.id == visit_id).first()
    if not visit:
        return False, []

    results = []
    all_sufficient = True

    existing_supplies = {}
    for s in visit.actual_supplies:
        existing_supplies[s.supply_id] = s.actual_quantity

    for supply_req in actual_supplies:
        supply = get_supply(db, supply_req.supply_id)
        if not supply:
            continue

        existing = existing_supplies.get(supply_req.supply_id, 0)
        additional_needed = supply_req.actual_quantity - existing
        required = max(0, additional_needed)

        is_sufficient = supply.stock >= required

        if not is_sufficient:
            all_sufficient = False

        results.append({
            "supply_id": supply.id,
            "supply_name": supply.name,
            "required": required,
            "available": supply.stock,
            "is_sufficient": is_sufficient,
            "current_in_visit": existing,
            "requested": supply_req.actual_quantity
        })

    return all_sufficient, results


def create_stock_transaction(db: Session, supply_id: int, transaction_type: str, quantity: float, balance_after: float,
                             reference_type: Optional[str] = None, reference_id: Optional[int] = None,
                             notes: Optional[str] = None) -> models.StockTransaction:
    transaction = models.StockTransaction(
        supply_id=supply_id,
        transaction_type=transaction_type,
        quantity=quantity,
        balance_after=balance_after,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes
    )
    db.add(transaction)
    return transaction


def deduct_stock(db: Session, supply_id: int, quantity: float, reference_type: str, reference_id: int, notes: str) -> bool:
    supply = get_supply(db, supply_id)
    if not supply or supply.stock < quantity:
        return False

    supply.stock -= quantity
    create_stock_transaction(
        db, supply_id,
        "deduct", -quantity, supply.stock,
        reference_type, reference_id, notes
    )
    return True


def add_stock(db: Session, supply_id: int, quantity: float, reference_type: str, reference_id: int, notes: str) -> bool:
    supply = get_supply(db, supply_id)
    if not supply:
        return False

    supply.stock += quantity
    create_stock_transaction(
        db, supply_id,
        "add", quantity, supply.stock,
        reference_type, reference_id, notes
    )
    return True


def create_visit(db: Session, visit_data: schemas.VisitCreate) -> models.Visit:
    db_visit = models.Visit(
        patient_id=visit_data.patient_id,
        visit_number=generate_number("V"),
        status=VisitStatus.CREATED,
        notes=visit_data.notes
    )
    db.add(db_visit)
    db.commit()
    db.refresh(db_visit)

    total_amount = 0.0

    for item_data in visit_data.visit_items:
        treatment = get_treatment_item(db, item_data.treatment_item_id)
        if not treatment:
            continue

        subtotal = treatment.price * item_data.quantity
        total_amount += subtotal

        visit_item = models.VisitItem(
            visit_id=db_visit.id,
            treatment_item_id=item_data.treatment_item_id,
            quantity=item_data.quantity,
            unit_price=treatment.price,
            subtotal=subtotal
        )
        db.add(visit_item)

        templates = get_supply_templates_by_treatment(db, treatment.id)
        for template in templates:
            template_qty = template.quantity * item_data.quantity

            actual_supply = models.ActualSupply(
                visit_id=db_visit.id,
                supply_id=template.supply_id,
                template_quantity=template_qty,
                actual_quantity=template_qty,
                unit_cost=template.supply.cost_price if template.supply else 0,
                total_cost=(template.supply.cost_price * template_qty) if template.supply else 0,
                is_additional=False
            )
            db.add(actual_supply)

    db_visit.total_amount = total_amount
    db.commit()
    db.refresh(db_visit)

    return db_visit


def get_visit(db: Session, visit_id: int) -> Optional[models.Visit]:
    return db.query(models.Visit).filter(models.Visit.id == visit_id).first()


def get_visits(db: Session, skip: int = 0, limit: int = 100) -> List[models.Visit]:
    return db.query(models.Visit).offset(skip).limit(limit).all()


def update_visit_actual_supplies(db: Session, visit_id: int, supplies_data: List[schemas.ActualSupplyCreate]) -> models.Visit:
    visit = get_visit(db, visit_id)
    if not visit:
        raise ValueError(f"Visit {visit_id} not found")

    if visit.status == VisitStatus.CHARGED:
        raise ValueError("Cannot modify supplies after charge is confirmed")

    existing_supplies = {s.supply_id: s for s in visit.actual_supplies}
    supply_cost = 0.0

    for supply_req in supplies_data:
        supply = get_supply(db, supply_req.supply_id)
        if not supply:
            continue

        existing = existing_supplies.get(supply_req.supply_id)
        if existing:
            if existing.actual_quantity != supply_req.actual_quantity:
                existing.actual_quantity = supply_req.actual_quantity
                existing.total_cost = supply.cost_price * supply_req.actual_quantity
                existing.unit_cost = supply.cost_price
        else:
            actual_supply = models.ActualSupply(
                visit_id=visit.id,
                supply_id=supply_req.supply_id,
                template_quantity=0,
                actual_quantity=supply_req.actual_quantity,
                unit_cost=supply.cost_price,
                total_cost=supply.cost_price * supply_req.actual_quantity,
                is_additional=supply_req.is_additional or True
            )
            db.add(actual_supply)

    db.commit()
    db.refresh(visit)

    for s in visit.actual_supplies:
        supply_cost += s.total_cost
    visit.supply_cost = supply_cost
    db.commit()
    db.refresh(visit)

    return visit


def check_duplicate_charge(db: Session, visit_id: int) -> bool:
    charges = db.query(models.Charge).filter(models.Charge.visit_id == visit_id).all()
    return len(charges) > 0


def check_stock_for_charge(db: Session, visit: models.Visit) -> Tuple[bool, List[Dict]]:
    results = []
    all_sufficient = True

    for actual_supply in visit.actual_supplies:
        supply = get_supply(db, actual_supply.supply_id)
        if not supply:
            continue

        required = actual_supply.actual_quantity
        is_sufficient = supply.stock >= required

        if not is_sufficient:
            all_sufficient = False

        results.append({
            "supply_id": supply.id,
            "supply_name": supply.name,
            "required": required,
            "available": supply.stock,
            "is_sufficient": is_sufficient
        })

    return all_sufficient, results


def charge_visit(db: Session, visit_id: int, charge_data: schemas.ChargeCreate) -> models.Charge:
    visit = get_visit(db, visit_id)
    if not visit:
        raise ValueError(f"Visit {visit_id} not found")

    if visit.status != VisitStatus.CREATED:
        raise ValueError(f"Cannot charge visit in status {visit.status}")

    if check_duplicate_charge(db, visit_id):
        raise ValueError("This visit has already been charged. Duplicate charging is not allowed.")

    stock_ok, stock_results = check_stock_for_charge(db, visit)

    if not stock_ok:
        insufficient = [r for r in stock_results if not r["is_sufficient"]]
        msg = ", ".join([f"{r['supply_name']}(需要{r['required']}, 现有{r['available']})" for r in insufficient])
        raise ValueError(f"Insufficient stock: {msg}")

    for actual_supply in visit.actual_supplies:
        deduct_stock(
            db, actual_supply.supply_id, actual_supply.actual_quantity,
            "charge", visit_id,
            f"Deducted for visit {visit.visit_number}"
        )

    charge = models.Charge(
        visit_id=visit_id,
        charge_number=generate_number("C"),
        amount=visit.total_amount,
        operator=charge_data.operator,
        notes=charge_data.notes
    )
    db.add(charge)

    visit.status = VisitStatus.CHARGED
    db.commit()
    db.refresh(charge)
    db.refresh(visit)

    return charge


def get_charge(db: Session, charge_id: int) -> Optional[models.Charge]:
    return db.query(models.Charge).filter(models.Charge.id == charge_id).first()


def refund_visit(db: Session, refund_data: schemas.RefundCreate) -> models.Refund:
    charge = get_charge(db, refund_data.charge_id)
    if not charge:
        raise ValueError(f"Charge {refund_data.charge_id} not found")

    visit = get_visit(db, charge.visit_id)
    if not visit:
        raise ValueError(f"Visit not found for charge {refund_data.charge_id}")

    if visit.status not in [VisitStatus.CHARGED, VisitStatus.PARTIAL_REFUNDED]:
        raise ValueError(f"Cannot refund visit in status {visit.status}")

    if refund_data.refund_type == RefundType.FULL and refund_data.amount != charge.amount:
        raise ValueError(f"Full refund amount must equal charge amount: {charge.amount}")

    rollback_reasons = []
    has_rollback = False

    if refund_data.stock_rollback:
        if refund_data.refund_type == RefundType.FULL:
            for actual_supply in visit.actual_supplies:
                rollback_qty = actual_supply.actual_quantity
                add_stock(
                    db, actual_supply.supply_id, rollback_qty,
                    "refund", charge.id,
                    f"Rollback for refund of visit {visit.visit_number}"
                )
                has_rollback = True
                rollback_reasons.append(f"{actual_supply.supply.name if actual_supply.supply else actual_supply.supply_id}: 回滚 {rollback_qty} 单位 (全额退款)")
        elif refund_data.refund_type == RefundType.PARTIAL and refund_data.refund_items:
            for item in refund_data.refund_items:
                supply = get_supply(db, item.supply_id)
                actual_supply = db.query(models.ActualSupply).filter(
                    models.ActualSupply.visit_id == visit.id,
                    models.ActualSupply.supply_id == item.supply_id
                ).first()

                if not actual_supply:
                    raise ValueError(f"Supply {item.supply_id} not found in visit")

                if item.quantity > actual_supply.actual_quantity:
                    raise ValueError(f"Refund quantity exceeds actual usage for supply {supply.name if supply else item.supply_id}")

                rollback_qty = item.quantity
                add_stock(
                    db, item.supply_id, rollback_qty,
                    "refund", charge.id,
                    f"Partial rollback for visit {visit.visit_number}"
                )
                has_rollback = True
                rollback_reasons.append(f"{supply.name if supply else item.supply_id}: 回滚 {rollback_qty} 单位 (部分退款)")
    else:
        rollback_reasons.append("未选择库存回滚选项")
        if refund_data.refund_type == RefundType.FULL:
            rollback_reasons.append("耗材已使用完毕或已退回患者，不回滚")
        else:
            rollback_reasons.append("部分退款但未申请库存回滚")

    refund = models.Refund(
        visit_id=visit.id,
        charge_id=charge.id,
        refund_number=generate_number("R"),
        refund_type=refund_data.refund_type,
        amount=refund_data.amount,
        stock_rollback=has_rollback,
        rollback_reason="; ".join(rollback_reasons),
        operator=refund_data.operator,
        reason=refund_data.reason
    )
    db.add(refund)
    db.commit()
    db.refresh(refund)

    if refund_data.stock_rollback:
        if refund_data.refund_type == RefundType.FULL:
            for actual_supply in visit.actual_supplies:
                refund_item = models.RefundItem(
                    refund_id=refund.id,
                    actual_supply_id=actual_supply.id,
                    supply_id=actual_supply.supply_id,
                    quantity=actual_supply.actual_quantity,
                    rollback_quantity=actual_supply.actual_quantity,
                    unit_cost=actual_supply.unit_cost,
                    rollback_reason="全额退款，库存回滚"
                )
                db.add(refund_item)
        elif refund_data.refund_items:
            for item in refund_data.refund_items:
                actual_supply = db.query(models.ActualSupply).filter(
                    models.ActualSupply.visit_id == visit.id,
                    models.ActualSupply.supply_id == item.supply_id
                ).first()

                refund_item = models.RefundItem(
                    refund_id=refund.id,
                    actual_supply_id=actual_supply.id if actual_supply else None,
                    supply_id=item.supply_id,
                    quantity=item.quantity,
                    rollback_quantity=item.quantity if has_rollback else 0,
                    unit_cost=actual_supply.unit_cost if actual_supply else 0,
                    rollback_reason="部分退款，库存回滚" if has_rollback else "部分退款，未回滚"
                )
                db.add(refund_item)

    if refund_data.refund_type == RefundType.FULL:
        visit.status = VisitStatus.REFUNDED
    else:
        visit.status = VisitStatus.PARTIAL_REFUNDED

    db.commit()
    db.refresh(refund)
    db.refresh(visit)

    return refund


def get_refund(db: Session, refund_id: int) -> Optional[models.Refund]:
    return db.query(models.Refund).filter(models.Refund.id == refund_id).first()


def get_statistics(db: Session) -> schemas.StatisticsResponse:
    from sqlalchemy import func

    total_charged = db.query(func.sum(models.Charge.amount)).filter(
        models.Charge.id.notin_(
            db.query(models.Refund.charge_id)
        )
    ).scalar() or 0.0

    total_refunded = db.query(func.sum(models.Refund.amount)).scalar() or 0.0

    actual_income = total_charged - total_refunded

    charged_visits = db.query(models.Visit).filter(
        models.Visit.status.in_([VisitStatus.CHARGED, VisitStatus.PARTIAL_REFUNDED])
    ).all()

    total_supply_cost = sum(v.supply_cost for v in charged_visits)

    low_stock = db.query(models.Supply).filter(
        models.Supply.stock <= models.Supply.safety_stock
    ).all()

    low_stock_alerts = [{
        "supply_id": s.id,
        "supply_name": s.name,
        "current_stock": s.stock,
        "safety_stock": s.safety_stock,
        "unit": s.unit
    } for s in low_stock]

    template_supplies = db.query(models.SupplyTemplate).all()
    template_supply_map = {}
    for ts in template_supplies:
        if ts.treatment_item_id not in template_supply_map:
            template_supply_map[ts.treatment_item_id] = []
        template_supply_map[ts.treatment_item_id].append(ts)

    abnormal_visits = []
    for visit in charged_visits:
        template_supply_ids = set()
        for vi in visit.visit_items:
            templates = template_supply_map.get(vi.treatment_item_id, [])
            for t in templates:
                template_supply_ids.add(t.supply_id)

        actual_supply_ids = {s.supply_id for s in visit.actual_supplies}

        extra_supplies = actual_supply_ids - template_supply_ids
        missing_supplies = template_supply_ids - actual_supply_ids

        quantity_differences = []
        for actual in visit.actual_supplies:
            if actual.supply_id in template_supply_ids and actual.actual_quantity != actual.template_quantity:
                quantity_differences.append({
                    "supply_id": actual.supply_id,
                    "supply_name": actual.supply.name if actual.supply else str(actual.supply_id),
                    "template_qty": actual.template_quantity,
                    "actual_qty": actual.actual_quantity,
                    "is_additional": actual.is_additional
                })

        if extra_supplies or missing_supplies or quantity_differences:
            abnormal_visits.append({
                "visit_id": visit.id,
                "visit_number": visit.visit_number,
                "status": visit.status,
                "extra_supplies": list(extra_supplies),
                "missing_supplies": list(missing_supplies),
                "quantity_differences": quantity_differences
            })

    return schemas.StatisticsResponse(
        total_income=actual_income,
        total_supply_cost=total_supply_cost,
        net_profit=actual_income - total_supply_cost,
        low_stock_alerts=low_stock_alerts,
        abnormal_visits=abnormal_visits
    )
