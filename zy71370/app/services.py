import math
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas
from .exceptions import (
    PaintNotFoundException,
    StudentNotFoundException,
    OutOfStockException,
    InsufficientBudgetException,
    ColorDifferenceTooLargeException,
    DuplicateInventoryException,
)


def calculate_color_difference(
    l1: float, a1: float, b1: float,
    l2: float, a2: float, b2: float
) -> float:
    return math.sqrt(
        (l2 - l1) ** 2 +
        (a2 - a1) ** 2 +
        (b2 - b1) ** 2
    )


def find_substitutes(
    db: Session,
    paint_id: int,
    max_color_difference: float = 5.0,
    min_stock: int = 1,
    exclude_ids: Optional[List[int]] = None
) -> Tuple[models.PaintInventory, List[dict], List[str]]:
    original = db.query(models.PaintInventory).filter(
        models.PaintInventory.id == paint_id
    ).first()

    if not original:
        raise PaintNotFoundException(paint_id)

    exclude_ids = exclude_ids or []
    exclude_ids.append(paint_id)

    candidates = db.query(models.PaintInventory).filter(
        models.PaintInventory.id.notin_(exclude_ids),
        models.PaintInventory.stock >= min_stock,
        models.PaintInventory.is_discontinued == False
    ).all()

    substitutes = []
    data_issues = []

    if original.data_quality == "dirty":
        data_issues.append(f"颜料 [{original.name}] 数据质量标记为脏，色差值可能不准确")

    for paint in candidates:
        delta_e = calculate_color_difference(
            original.l_value, original.a_value, original.b_value,
            paint.l_value, paint.a_value, paint.b_value
        )

        if delta_e <= max_color_difference:
            substitutes.append({
                "paint_id": paint.id,
                "paint_name": paint.name,
                "brand": paint.brand,
                "color_difference": round(delta_e, 2),
                "stock": paint.stock,
                "price": paint.price,
                "purchase_link": paint.purchase_link,
                "is_best_match": False
            })

            if paint.data_quality == "dirty":
                data_issues.append(f"替代颜料 [{paint.name}] 数据质量标记为脏")

    substitutes.sort(key=lambda x: x["color_difference"])

    if substitutes:
        substitutes[0]["is_best_match"] = True

    return original, substitutes, data_issues


def deduct_stock(
    db: Session,
    paint_id: int,
    quantity: int,
    student_id: Optional[int] = None
) -> schemas.StockDeductResponse:
    paint = db.query(models.PaintInventory).filter(
        models.PaintInventory.id == paint_id
    ).first()

    if not paint:
        raise PaintNotFoundException(paint_id)

    if paint.stock < quantity:
        raise OutOfStockException(
            paint_id=paint_id,
            paint_name=paint.name,
            requested=quantity,
            available=paint.stock
        )

    paint.stock -= quantity
    paint.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(paint)

    return schemas.StockDeductResponse(
        success=True,
        paint_id=paint.id,
        paint_name=paint.name,
        deducted_quantity=quantity,
        remaining_stock=paint.stock,
        message=f"已扣减 {quantity} 件 {paint.name}"
    )


def check_budget(
    db: Session,
    student_id: int,
    total_amount: float
) -> Tuple[bool, Optional[str], models.Student]:
    student = db.query(models.Student).filter(
        models.Student.id == student_id
    ).first()

    if not student:
        raise StudentNotFoundException(student_id)

    budget_warning = False
    budget_message = None

    if total_amount > student.remaining_budget:
        overage = total_amount - student.remaining_budget
        budget_warning = True
        budget_message = (
            f"预算不足：超出剩余预算 ¥{overage:.2f}。"
            f"学生预算 ¥{student.budget:.2f}，已用 ¥{student.budget - student.remaining_budget:.2f}，"
            f"剩余 ¥{student.remaining_budget:.2f}。本次采购 ¥{total_amount:.2f}"
        )

    if student.data_quality == "dirty":
        budget_message = (budget_message or "") + " [注意：该学生数据质量标记为脏，预算金额可能不准确]"

    return budget_warning, budget_message, student


def create_purchase(
    db: Session,
    purchase_data: schemas.PurchaseCreate
) -> schemas.PurchaseResponse:
    budget_warning, budget_message, student = check_budget(
        db, purchase_data.student_id, 0
    )

    purchase = models.Purchase(
        student_id=purchase_data.student_id,
        notes=purchase_data.notes,
        status="pending"
    )
    db.add(purchase)
    db.flush()

    purchase_items = []
    total_amount = 0.0
    substitution_records = []

    for item_request in purchase_data.items:
        original_paint = db.query(models.PaintInventory).filter(
            models.PaintInventory.id == item_request.paint_id
        ).first()

        if not original_paint:
            raise PaintNotFoundException(item_request.paint_id)

        selected_paint = original_paint
        is_substitute = False
        color_difference = None
        substitute_reason = None
        original_paint_id = None

        if original_paint.stock < item_request.quantity:
            if not item_request.use_substitute_if_out_of_stock:
                raise OutOfStockException(
                    paint_id=original_paint.id,
                    paint_name=original_paint.name,
                    requested=item_request.quantity,
                    available=original_paint.stock
                )

            _, substitutes, _ = find_substitutes(
                db,
                original_paint.id,
                max_color_difference=item_request.max_color_difference,
                min_stock=item_request.quantity
            )

            if not substitutes:
                raise OutOfStockException(
                    paint_id=original_paint.id,
                    paint_name=original_paint.name,
                    requested=item_request.quantity,
                    available=original_paint.stock,
                    no_substitutes=True
                )

            best_sub = substitutes[0]
            if best_sub["color_difference"] > item_request.max_color_difference:
                raise ColorDifferenceTooLargeException(
                    original_name=original_paint.name,
                    substitute_name=best_sub["paint_name"],
                    difference=best_sub["color_difference"],
                    max_allowed=item_request.max_color_difference
                )

            selected_paint = db.query(models.PaintInventory).filter(
                models.PaintInventory.id == best_sub["paint_id"]
            ).first()

            is_substitute = True
            color_difference = best_sub["color_difference"]
            substitute_reason = f"原颜料 {original_paint.name} 库存不足（仅剩 {original_paint.stock} 件）"
            original_paint_id = original_paint.id

            substitution_records.append({
                "original_paint_id": original_paint.id,
                "original_paint_name": original_paint.name,
                "substitute_paint_id": selected_paint.id,
                "substitute_paint_name": selected_paint.name,
                "color_difference": color_difference,
                "student_id": purchase_data.student_id
            })

        deduct_stock(db, selected_paint.id, item_request.quantity)

        unit_price = selected_paint.price
        subtotal = unit_price * item_request.quantity
        total_amount += subtotal

        purchase_item = models.PurchaseItem(
            purchase_id=purchase.id,
            paint_id=selected_paint.id,
            original_paint_id=original_paint_id,
            quantity=item_request.quantity,
            unit_price=unit_price,
            is_substitute=is_substitute,
            color_difference=color_difference,
            substitute_reason=substitute_reason
        )
        db.add(purchase_item)
        purchase_items.append(purchase_item)

    budget_warning, budget_message, student = check_budget(
        db, purchase_data.student_id, total_amount
    )

    purchase.total_amount = total_amount
    purchase.budget_warning = budget_warning
    purchase.status = "completed" if not budget_warning else "pending_review"
    purchase.completed_at = datetime.utcnow() if not budget_warning else None

    if not budget_warning:
        student.remaining_budget -= total_amount

    for sub_record in substitution_records:
        db.add(models.SubstitutionRecord(**sub_record))

    db.commit()
    db.refresh(purchase)
    db.refresh(student)

    item_responses = []
    for item in purchase.items:
        paint = db.query(models.PaintInventory).filter(
            models.PaintInventory.id == item.paint_id
        ).first()
        item_responses.append(schemas.PurchaseItemResponse(
            id=item.id,
            paint_id=item.paint_id,
            paint_name=paint.name if paint else "未知颜料",
            brand=paint.brand if paint else "未知品牌",
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.unit_price * item.quantity,
            is_substitute=item.is_substitute,
            original_paint_id=item.original_paint_id,
            color_difference=item.color_difference,
            substitute_reason=item.substitute_reason
        ))

    return schemas.PurchaseResponse(
        id=purchase.id,
        student_id=student.id,
        student_name=student.name,
        status=purchase.status,
        total_amount=purchase.total_amount,
        budget_warning=purchase.budget_warning,
        budget_message=budget_message,
        items=item_responses,
        notes=purchase.notes,
        created_at=purchase.created_at
    )


def check_data_issues(db: Session) -> List[models.DataIssue]:
    issues = []

    paints = db.query(models.PaintInventory).all()
    seen = {}
    for paint in paints:
        key = (paint.name.strip().lower(), paint.brand.strip().lower())
        if key in seen:
            existing = seen[key]
            issue = models.DataIssue(
                issue_type="duplicate_inventory",
                severity="warning",
                table_name="paint_inventory",
                record_id=paint.id,
                description=f"颜料 [{paint.name} ({paint.brand})] 与 ID={existing.id} 的记录重复",
                fix_suggestion="合并库存数量，删除重复记录或标记为停产"
            )
            issues.append(issue)
        else:
            seen[key] = paint

        if paint.l_value < 0 or paint.l_value > 100 or \
           paint.a_value < -128 or paint.a_value > 127 or \
           paint.b_value < -128 or paint.b_value > 127:
            issue = models.DataIssue(
                issue_type="invalid_color_value",
                severity="error",
                table_name="paint_inventory",
                record_id=paint.id,
                description=f"颜料 [{paint.name}] LAB色值超出有效范围: L={paint.l_value}, a={paint.a_value}, b={paint.b_value}",
                fix_suggestion="使用取色器重新测量该颜料的LAB色值"
            )
            issues.append(issue)

        if paint.stock < 0:
            issue = models.DataIssue(
                issue_type="negative_stock",
                severity="error",
                table_name="paint_inventory",
                record_id=paint.id,
                description=f"颜料 [{paint.name}] 库存为负数: {paint.stock}",
                fix_suggestion="盘点实际库存，修正库存数量"
            )
            issues.append(issue)

    students = db.query(models.Student).all()
    for student in students:
        if student.remaining_budget < 0:
            issue = models.DataIssue(
                issue_type="negative_budget",
                severity="error",
                table_name="students",
                record_id=student.id,
                description=f"学生 [{student.name}] 剩余预算为负数: ¥{student.remaining_budget}",
                fix_suggestion="检查该学生的采购记录，确认是否有超额消费未处理"
            )
            issues.append(issue)

        if student.remaining_budget > student.budget:
            issue = models.DataIssue(
                issue_type="budget_mismatch",
                severity="warning",
                table_name="students",
                record_id=student.id,
                description=f"学生 [{student.name}] 剩余预算 (¥{student.remaining_budget}) 大于总预算 (¥{student.budget})",
                fix_suggestion="重新计算该学生的已消费金额，修正剩余预算"
            )
            issues.append(issue)

    for issue in issues:
        existing = db.query(models.DataIssue).filter(
            models.DataIssue.issue_type == issue.issue_type,
            models.DataIssue.table_name == issue.table_name,
            models.DataIssue.record_id == issue.record_id,
            models.DataIssue.is_resolved == False
        ).first()
        if not existing:
            db.add(issue)

    db.commit()

    return db.query(models.DataIssue).filter(
        models.DataIssue.is_resolved == False
    ).all()
