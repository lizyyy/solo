import json
import traceback
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
import models
import schemas


def generate_code(prefix: str, seq: int) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{seq:04d}"


def log_exception(
    db: Session,
    operation: str,
    input_data: dict,
    error_message: str,
    wave_id: Optional[int] = None,
    order_id: Optional[int] = None,
    pick_task_id: Optional[int] = None,
) -> models.ExceptionLog:
    seq = db.query(models.ExceptionLog).count() + 1
    exception_log = models.ExceptionLog(
        exception_code=generate_code("EXC", seq),
        wave_id=wave_id,
        order_id=order_id,
        pick_task_id=pick_task_id,
        operation=operation,
        input_data=json.dumps(input_data, ensure_ascii=False),
        error_message=error_message,
        stack_trace=traceback.format_exc(),
    )
    db.add(exception_log)
    db.commit()
    db.refresh(exception_log)
    return exception_log


def create_wave(db: Session, wave_create: schemas.WaveCreate) -> models.Wave:
    try:
        orders = db.query(models.Order).filter(
            models.Order.id.in_(wave_create.order_ids),
            models.Order.wave_id.is_(None),
            models.Order.status == "pending"
        ).all()

        if not orders:
            raise ValueError("没有找到可合并的订单")

        seq = db.query(models.Wave).count() + 1
        wave = models.Wave(
            wave_code=generate_code("WAVE", seq),
            priority=wave_create.priority,
            created_by=wave_create.created_by,
            remarks=wave_create.remarks,
            total_orders=len(orders),
        )

        db.add(wave)
        db.flush()

        total_skus = 0
        total_qty = 0
        pick_tasks = []

        for order in orders:
            order.wave_id = wave.id
            order.status = "in_wave"

            for item in order.order_items:
                location = db.query(models.Location).filter(
                    models.Location.sku == item.sku,
                    models.Location.is_active == True,
                    models.Location.stock_qty > 0
                ).first()

                location_code = location.location_code if location else "UNKNOWN"
                sort_order = location.sort_order if location else 999999

                item.location_code = location_code
                total_skus += 1
                total_qty += item.qty

                task_seq = len(pick_tasks) + 1
                pick_task = models.PickTask(
                    task_code=generate_code(f"TASK{wave.id}", task_seq),
                    wave_id=wave.id,
                    order_id=order.id,
                    sku=item.sku,
                    sku_name=item.sku_name,
                    location_code=location_code,
                    required_qty=item.qty,
                )
                pick_tasks.append((pick_task, sort_order))

        pick_tasks.sort(key=lambda x: x[1])
        for task, _ in pick_tasks:
            db.add(task)

        wave.total_skus = total_skus
        wave.total_qty = total_qty
        wave.status = "ready"

        db.commit()
        db.refresh(wave)
        return wave

    except Exception as e:
        db.rollback()
        log_exception(
            db,
            "create_wave",
            wave_create.model_dump(),
            str(e),
        )
        raise


def get_wave(db: Session, wave_id: int) -> Optional[models.Wave]:
    return db.query(models.Wave).filter(models.Wave.id == wave_id).first()


def get_wave_by_code(db: Session, wave_code: str) -> Optional[models.Wave]:
    return db.query(models.Wave).filter(models.Wave.wave_code == wave_code).first()


def list_waves(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    query = db.query(models.Wave)
    if status:
        query = query.filter(models.Wave.status == status)
    return query.order_by(models.Wave.created_at.desc()).offset(skip).limit(limit).all()


def update_wave_status(db: Session, wave_id: int, status: str) -> models.Wave:
    wave = get_wave(db, wave_id)
    if not wave:
        raise ValueError(f"波次 {wave_id} 不存在")

    valid_transitions = {
        "pending": ["ready"],
        "ready": ["picking"],
        "picking": ["reviewing", "exception"],
        "reviewing": ["completed", "exception"],
        "exception": ["picking", "reviewing", "completed"],
        "completed": [],
    }

    if status not in valid_transitions.get(wave.status, []):
        raise ValueError(f"无法从状态 {wave.status} 转换到 {status}")

    wave.status = status

    if status == "completed":
        wave.completed_at = datetime.now()
        generate_completion_report(db, wave_id)

    db.commit()
    db.refresh(wave)
    return wave


def process_stock_split(db: Session, split_request: schemas.StockSplitRequest) -> models.PickTask:
    try:
        original_task = db.query(models.PickTask).filter(
            models.PickTask.id == split_request.pick_task_id
        ).first()

        if not original_task:
            raise ValueError(f"拣货任务 {split_request.pick_task_id} 不存在")

        if original_task.status != "pending":
            raise ValueError(f"只有待处理的任务才能拆单")

        original_required_qty = original_task.required_qty

        if split_request.available_qty >= original_required_qty:
            raise ValueError(f"库存充足，无需拆单")

        original_task.is_split = True
        original_task.split_reason = split_request.reason
        original_task.required_qty = split_request.available_qty

        order_item = db.query(models.OrderItem).filter(
            models.OrderItem.order_id == original_task.order_id,
            models.OrderItem.sku == original_task.sku
        ).first()

        if order_item:
            order_item.is_out_of_stock = True
            order_item.qty = split_request.available_qty

        remaining_qty = original_required_qty - split_request.available_qty

        seq = db.query(models.PickTask).count() + 1
        new_task = models.PickTask(
            task_code=generate_code("TASKSPLIT", seq),
            wave_id=original_task.wave_id,
            order_id=original_task.order_id,
            sku=original_task.sku,
            sku_name=original_task.sku_name,
            location_code=original_task.location_code,
            required_qty=remaining_qty,
            is_split=True,
            split_from_task_id=original_task.id,
            split_reason=split_request.reason,
            status="out_of_stock",
        )
        db.add(new_task)

        order = db.query(models.Order).filter(models.Order.id == original_task.order_id).first()
        if order:
            order.is_split = True
            order.split_reason = f"缺货拆单: {split_request.reason}"

        db.commit()
        db.refresh(original_task)
        return original_task

    except Exception as e:
        db.rollback()
        log_exception(
            db,
            "stock_split",
            split_request.model_dump(),
            str(e),
            pick_task_id=split_request.pick_task_id,
        )
        raise


def update_pick_task(db: Session, task_id: int, update: schemas.PickTaskUpdate) -> models.PickTask:
    task = db.query(models.PickTask).filter(models.PickTask.id == task_id).first()
    if not task:
        raise ValueError(f"拣货任务 {task_id} 不存在")

    if update.picked_qty is not None:
        task.picked_qty = update.picked_qty
        if task.picked_qty >= task.required_qty:
            task.status = "picked"
            task.picked_at = datetime.now()

    if update.status:
        task.status = update.status
        if update.status == "picked":
            task.picked_at = datetime.now()

    if update.picker:
        task.picker = update.picker

    wave = db.query(models.Wave).filter(models.Wave.id == task.wave_id).first()
    if wave:
        wave.picked_qty = sum(t.picked_qty for t in wave.pick_tasks)

    db.commit()
    db.refresh(task)
    return task


def create_review_diff(db: Session, diff_create: schemas.ReviewDiffCreate) -> models.ReviewDiff:
    try:
        seq = db.query(models.ReviewDiff).count() + 1
        diff = models.ReviewDiff(
            diff_code=generate_code("DIFF", seq),
            wave_id=diff_create.wave_id,
            order_id=diff_create.order_id,
            pick_task_id=diff_create.pick_task_id,
            sku=diff_create.sku,
            expected_qty=diff_create.expected_qty,
            actual_qty=diff_create.actual_qty,
            diff_qty=diff_create.actual_qty - diff_create.expected_qty,
            diff_type=diff_create.diff_type,
            reviewer=diff_create.reviewer,
            remarks=diff_create.remarks,
        )
        db.add(diff)

        wave = db.query(models.Wave).filter(models.Wave.id == diff_create.wave_id).first()
        if wave:
            wave.reviewed_qty += diff_create.actual_qty

        db.commit()
        db.refresh(diff)
        return diff

    except Exception as e:
        db.rollback()
        log_exception(
            db,
            "create_review_diff",
            diff_create.model_dump(),
            str(e),
            wave_id=diff_create.wave_id,
            order_id=diff_create.order_id,
            pick_task_id=diff_create.pick_task_id,
        )
        raise


def resolve_review_diff(db: Session, diff_id: int, resolve: schemas.ReviewDiffResolve) -> models.ReviewDiff:
    diff = db.query(models.ReviewDiff).filter(models.ReviewDiff.id == diff_id).first()
    if not diff:
        raise ValueError(f"差异记录 {diff_id} 不存在")

    diff.status = "resolved"
    diff.resolution = resolve.resolution
    diff.resolver = resolve.resolver
    diff.resolved_at = datetime.now()

    db.commit()
    db.refresh(diff)
    return diff


def list_review_diffs(db: Session, wave_id: Optional[int] = None, status: Optional[str] = None):
    query = db.query(models.ReviewDiff)
    if wave_id:
        query = query.filter(models.ReviewDiff.wave_id == wave_id)
    if status:
        query = query.filter(models.ReviewDiff.status == status)
    return query.order_by(models.ReviewDiff.reviewed_at.desc()).all()


def generate_completion_report(db: Session, wave_id: int) -> models.CompletionReport:
    wave = get_wave(db, wave_id)
    if not wave:
        raise ValueError(f"波次 {wave_id} 不存在")

    total_tasks = len(wave.pick_tasks)
    completed_tasks = sum(1 for t in wave.pick_tasks if t.status in ["picked", "completed"])
    total_orders = len(wave.orders)
    completed_orders = sum(1 for o in wave.orders if all(t.status in ["picked", "completed"] for t in o.pick_tasks))

    diffs = db.query(models.ReviewDiff).filter(models.ReviewDiff.wave_id == wave_id).all()
    diff_count = len(diffs)
    resolved_diff_count = sum(1 for d in diffs if d.status == "resolved")

    seq = db.query(models.CompletionReport).count() + 1
    report = models.CompletionReport(
        report_code=generate_code("RPT", seq),
        wave_id=wave_id,
        total_orders=total_orders,
        completed_orders=completed_orders,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        total_qty=wave.total_qty,
        picked_qty=wave.picked_qty,
        reviewed_qty=wave.reviewed_qty,
        diff_count=diff_count,
        resolved_diff_count=resolved_diff_count,
        start_time=wave.created_at,
        end_time=wave.completed_at,
        duration_seconds=int((wave.completed_at - wave.created_at).total_seconds()) if wave.completed_at else 0,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_completion_report(db: Session, wave_id: int) -> Optional[models.CompletionReport]:
    return db.query(models.CompletionReport).filter(models.CompletionReport.wave_id == wave_id).first()


def handle_exception_log(db: Session, exception_id: int, handle: schemas.ExceptionLogHandle) -> models.ExceptionLog:
    exc = db.query(models.ExceptionLog).filter(models.ExceptionLog.id == exception_id).first()
    if not exc:
        raise ValueError(f"异常记录 {exception_id} 不存在")

    exc.is_handled = True
    exc.conclusion = handle.conclusion
    exc.handled_by = handle.handled_by
    exc.handled_at = datetime.now()
    exc.remarks = handle.remarks

    db.commit()
    db.refresh(exc)
    return exc


def list_exception_logs(db: Session, wave_id: Optional[int] = None, is_handled: Optional[bool] = None):
    query = db.query(models.ExceptionLog)
    if wave_id:
        query = query.filter(models.ExceptionLog.wave_id == wave_id)
    if is_handled is not None:
        query = query.filter(models.ExceptionLog.is_handled == is_handled)
    return query.order_by(models.ExceptionLog.created_at.desc()).all()


def create_order(db: Session, order_create: schemas.OrderCreate) -> models.Order:
    seq = db.query(models.Order).count() + 1
    order = models.Order(
        order_no=order_create.order_no or generate_code("ORD", seq),
        customer=order_create.customer,
        address=order_create.address,
        total_amount=order_create.total_amount,
        total_qty=sum(item.qty for item in order_create.items),
    )
    db.add(order)
    db.flush()

    for item in order_create.items:
        order_item = models.OrderItem(
            order_id=order.id,
            sku=item.sku,
            sku_name=item.sku_name,
            qty=item.qty,
            price=item.price,
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return order


def get_order(db: Session, order_id: int) -> Optional[models.Order]:
    return db.query(models.Order).filter(models.Order.id == order_id).first()


def list_orders(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None):
    query = db.query(models.Order)
    if status:
        query = query.filter(models.Order.status == status)
    return query.order_by(models.Order.created_at.desc()).offset(skip).limit(limit).all()


def create_location(db: Session, location_create: schemas.LocationCreate) -> models.Location:
    location = models.Location(**location_create.model_dump())
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def get_location(db: Session, location_id: int) -> Optional[models.Location]:
    return db.query(models.Location).filter(models.Location.id == location_id).first()


def list_locations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Location).order_by(models.Location.sort_order).offset(skip).limit(limit).all()


def get_pick_task(db: Session, task_id: int) -> Optional[models.PickTask]:
    return db.query(models.PickTask).filter(models.PickTask.id == task_id).first()


def list_pick_tasks(db: Session, wave_id: Optional[int] = None, status: Optional[str] = None):
    query = db.query(models.PickTask)
    if wave_id:
        query = query.filter(models.PickTask.wave_id == wave_id)
    if status:
        query = query.filter(models.PickTask.status == status)
    return query.order_by(models.PickTask.id).all()


def manual_correction(db: Session, correction: schemas.ManualCorrectionRequest) -> models.PickTask:
    try:
        task = get_pick_task(db, correction.pick_task_id)
        if not task:
            raise ValueError(f"拣货任务 {correction.pick_task_id} 不存在")

        old_qty = task.required_qty
        task.required_qty = correction.new_qty
        task.remarks = f"人工修正: 从 {old_qty} 改为 {correction.new_qty}, 原因: {correction.reason}"

        db.commit()
        db.refresh(task)
        return task

    except Exception as e:
        db.rollback()
        log_exception(
            db,
            "manual_correction",
            correction.model_dump(),
            str(e),
            pick_task_id=correction.pick_task_id,
        )
        raise


def export_wave_data(db: Session, wave_id: int) -> dict:
    wave = get_wave(db, wave_id)
    if not wave:
        raise ValueError(f"波次 {wave_id} 不存在")

    orders_data = []
    for order in wave.orders:
        items_data = []
        for item in order.order_items:
            items_data.append({
                "sku": item.sku,
                "sku_name": item.sku_name,
                "qty": item.qty,
                "picked_qty": item.picked_qty,
                "location_code": item.location_code,
            })
        orders_data.append({
            "order_no": order.order_no,
            "customer": order.customer,
            "status": order.status,
            "items": items_data,
        })

    tasks_data = []
    for task in wave.pick_tasks:
        tasks_data.append({
            "task_code": task.task_code,
            "sku": task.sku,
            "sku_name": task.sku_name,
            "location_code": task.location_code,
            "required_qty": task.required_qty,
            "picked_qty": task.picked_qty,
            "status": task.status,
            "picker": task.picker,
        })

    diffs_data = []
    for diff in wave.review_diffs:
        diffs_data.append({
            "diff_code": diff.diff_code,
            "sku": diff.sku,
            "expected_qty": diff.expected_qty,
            "actual_qty": diff.actual_qty,
            "diff_qty": diff.diff_qty,
            "diff_type": diff.diff_type,
            "status": diff.status,
            "resolution": diff.resolution,
        })

    return {
        "wave_code": wave.wave_code,
        "status": wave.status,
        "total_orders": wave.total_orders,
        "total_skus": wave.total_skus,
        "total_qty": wave.total_qty,
        "picked_qty": wave.picked_qty,
        "reviewed_qty": wave.reviewed_qty,
        "created_at": wave.created_at.isoformat() if wave.created_at else None,
        "completed_at": wave.completed_at.isoformat() if wave.completed_at else None,
        "orders": orders_data,
        "pick_tasks": tasks_data,
        "review_diffs": diffs_data,
    }
