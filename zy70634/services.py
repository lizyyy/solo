from sqlalchemy.orm import Session
from models import Wave, Order, OrderItem, PickTask, Location, SKUStock, ReviewDiff, CompletionReport
from datetime import datetime
import uuid
from typing import List, Dict, Tuple


def generate_wave_code() -> str:
    return f"WAVE-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def generate_task_code() -> str:
    return f"TASK-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def generate_diff_code() -> str:
    return f"DIFF-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def generate_report_code() -> str:
    return f"RPT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


class WaveService:
    @staticmethod
    def create_wave(db: Session, order_codes: List[str], priority: int = 1) -> Wave:
        wave_code = generate_wave_code()
        wave = Wave(
            wave_code=wave_code,
            status="pending",
            priority=priority,
            total_orders=len(order_codes)
        )
        db.add(wave)
        db.flush()

        total_skus = 0
        for order_code in order_codes:
            order = db.query(Order).filter(Order.order_code == order_code).first()
            if order:
                order.wave_id = wave.id
                order.status = "in_wave"
                total_skus += len(order.items)

        wave.total_skus = total_skus
        db.commit()
        db.refresh(wave)
        return wave

    @staticmethod
    def generate_pick_tasks(db: Session, wave_id: int) -> List[PickTask]:
        wave = db.query(Wave).filter(Wave.id == wave_id).first()
        if not wave:
            raise ValueError(f"波次 {wave_id} 不存在")
        if wave.status != "pending":
            raise ValueError(f"波次状态不允许生成拣货任务，当前状态: {wave.status}")

        sku_location_map: Dict[str, List[Dict]] = {}

        orders = db.query(Order).filter(Order.wave_id == wave_id).all()
        for order in orders:
            for item in order.items:
                if item.sku_code not in sku_location_map:
                    sku_location_map[item.sku_code] = []
                sku_location_map[item.sku_code].append({
                    "sku_name": item.sku_name,
                    "quantity": item.ordered_quantity
                })

        pick_tasks = []
        for sku_code, sku_info_list in sku_location_map.items():
            total_quantity = sum(info["quantity"] for info in sku_info_list)
            sku_name = sku_info_list[0]["sku_name"]

            sku_stock = db.query(SKUStock).filter(
                SKUStock.sku_code == sku_code,
                SKUStock.quantity > 0
            ).join(Location).order_by(Location.sort_order).first()

            location_id = sku_stock.location_id if sku_stock else None

            task = PickTask(
                task_code=generate_task_code(),
                wave_id=wave_id,
                location_id=location_id,
                sku_code=sku_code,
                sku_name=sku_name,
                required_quantity=total_quantity,
                status="pending"
            )
            db.add(task)
            pick_tasks.append(task)

        wave.status = "picking"
        wave.started_at = datetime.utcnow()
        db.commit()

        for task in pick_tasks:
            db.refresh(task)

        return pick_tasks

    @staticmethod
    def sort_locations_by_path(db: Session, wave_id: int) -> List[PickTask]:
        tasks = db.query(PickTask).filter(
            PickTask.wave_id == wave_id
        ).join(Location).order_by(
            Location.aisle,
            Location.rack,
            Location.level,
            Location.position
        ).all()
        return tasks

    @staticmethod
    def process_shortage(db: Session, task_id: int, actual_quantity: int, picker: str) -> Tuple[PickTask, List[Order]]:
        task = db.query(PickTask).filter(PickTask.id == task_id).first()
        if not task:
            raise ValueError(f"拣货任务 {task_id} 不存在")
        if task.status != "pending":
            raise ValueError(f"拣货任务状态不允许处理，当前状态: {task.status}")

        task.picked_quantity = actual_quantity
        task.picker = picker
        task.picked_at = datetime.utcnow()

        shortage_quantity = task.required_quantity - actual_quantity
        is_shortage = shortage_quantity > 0
        task.is_shortage = is_shortage
        task.status = "completed"

        split_orders = []
        if is_shortage:
            wave = db.query(Wave).filter(Wave.id == task.wave_id).first()
            orders = db.query(Order).filter(Order.wave_id == task.wave_id).all()

            for order in orders:
                for item in order.items:
                    if item.sku_code == task.sku_code:
                        available_for_order = min(item.ordered_quantity, actual_quantity)
                        item.picked_quantity = available_for_order

                        if available_for_order < item.ordered_quantity:
                            item.is_shortage = True
                            item.shortage_quantity = item.ordered_quantity - available_for_order

                            if not order.is_split:
                                split_order = Order(
                                    order_code=f"{order.order_code}-SPLIT-{uuid.uuid4().hex[:4].upper()}",
                                    status="pending",
                                    is_split=True,
                                    parent_order_id=order.id,
                                    customer_name=order.customer_name,
                                    customer_phone=order.customer_phone,
                                    shipping_address=order.shipping_address
                                )
                                db.add(split_order)
                                db.flush()

                                split_item = OrderItem(
                                    order_id=split_order.id,
                                    sku_code=item.sku_code,
                                    sku_name=item.sku_name,
                                    ordered_quantity=item.shortage_quantity
                                )
                                db.add(split_item)

                                order.is_split = True
                                split_orders.append(split_order)

        db.commit()
        db.refresh(task)
        return task, split_orders

    @staticmethod
    def create_review_diff(db: Session, wave_id: int, order_id: int,
                           sku_code: str, expected_quantity: int,
                           actual_quantity: int, diff_type: str) -> ReviewDiff:
        wave = db.query(Wave).filter(Wave.id == wave_id).first()
        if not wave:
            raise ValueError(f"波次 {wave_id} 不存在")

        existing_diff = db.query(ReviewDiff).filter(
            ReviewDiff.wave_id == wave_id,
            ReviewDiff.order_id == order_id,
            ReviewDiff.sku_code == sku_code,
            ReviewDiff.status == "pending"
        ).first()

        if existing_diff:
            raise ValueError("该商品的复核差异已存在，正在处理中")

        diff = ReviewDiff(
            diff_code=generate_diff_code(),
            wave_id=wave_id,
            order_id=order_id,
            sku_code=sku_code,
            expected_quantity=expected_quantity,
            actual_quantity=actual_quantity,
            diff_quantity=abs(expected_quantity - actual_quantity),
            diff_type=diff_type,
            status="pending"
        )
        db.add(diff)
        db.commit()
        db.refresh(diff)
        return diff

    @staticmethod
    def resolve_review_diff(db: Session, diff_id: int, handler: str, remarks: str = None) -> ReviewDiff:
        diff = db.query(ReviewDiff).filter(ReviewDiff.id == diff_id).first()
        if not diff:
            raise ValueError(f"复核差异 {diff_id} 不存在")
        if diff.status != "pending":
            raise ValueError(f"复核差异已处理，当前状态: {diff.status}")

        diff.status = "resolved"
        diff.handler = handler
        diff.handled_at = datetime.utcnow()
        diff.remarks = remarks
        db.commit()
        db.refresh(diff)
        return diff

    @staticmethod
    def complete_wave(db: Session, wave_id: int) -> CompletionReport:
        wave = db.query(Wave).filter(Wave.id == wave_id).first()
        if not wave:
            raise ValueError(f"波次 {wave_id} 不存在")
        if wave.status != "picking":
            raise ValueError(f"波次状态不允许完成，当前状态: {wave.status}")

        pending_tasks = db.query(PickTask).filter(
            PickTask.wave_id == wave_id,
            PickTask.status == "pending"
        ).count()
        if pending_tasks > 0:
            raise ValueError(f"还有 {pending_tasks} 个拣货任务未完成")

        pending_diffs = db.query(ReviewDiff).filter(
            ReviewDiff.wave_id == wave_id,
            ReviewDiff.status == "pending"
        ).count()
        if pending_diffs > 0:
            raise ValueError(f"还有 {pending_diffs} 个复核差异待处理，需要人工复核")

        wave.status = "completed"
        wave.completed_at = datetime.utcnow()

        orders = db.query(Order).filter(Order.wave_id == wave_id).all()
        pick_tasks = db.query(PickTask).filter(PickTask.wave_id == wave_id).all()
        review_diffs = db.query(ReviewDiff).filter(ReviewDiff.wave_id == wave_id).all()

        total_orders = len(orders)
        split_orders = len([o for o in orders if o.is_split])
        total_items = sum(len(o.items) for o in orders)
        picked_items = sum(item.picked_quantity for o in orders for item in o.items)
        shortage_items = sum(1 for o in orders for item in o.items if item.is_shortage)

        report = CompletionReport(
            report_code=generate_report_code(),
            wave_id=wave_id,
            total_orders=total_orders,
            completed_orders=total_orders - split_orders,
            split_orders=split_orders,
            total_items=total_items,
            picked_items=picked_items,
            shortage_items=shortage_items,
            review_diffs=len(review_diffs),
            resolved_diffs=len([d for d in review_diffs if d.status == "resolved"]),
            report_content=f"波次{wave.wave_code}完成报告: 共{total_orders}单, {split_orders}单缺货拆单, {shortage_items}品缺货"
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_wave_report(db: Session, wave_id: int) -> Dict:
        wave = db.query(Wave).filter(Wave.id == wave_id).first()
        if not wave:
            raise ValueError(f"波次 {wave_id} 不存在")

        orders = db.query(Order).filter(Order.wave_id == wave_id).all()
        pick_tasks = db.query(PickTask).filter(PickTask.wave_id == wave_id).all()
        review_diffs = db.query(ReviewDiff).filter(ReviewDiff.wave_id == wave_id).all()
        report = wave.completion_report

        return {
            "wave": {
                "id": wave.id,
                "wave_code": wave.wave_code,
                "status": wave.status,
                "created_at": wave.created_at,
                "completed_at": wave.completed_at
            },
            "orders": [{
                "order_code": o.order_code,
                "status": o.status,
                "is_split": o.is_split,
                "items_count": len(o.items)
            } for o in orders],
            "pick_tasks": [{
                "task_code": t.task_code,
                "sku_code": t.sku_code,
                "required": t.required_quantity,
                "picked": t.picked_quantity,
                "is_shortage": t.is_shortage
            } for t in pick_tasks],
            "review_diffs": [{
                "diff_code": d.diff_code,
                "sku_code": d.sku_code,
                "diff_quantity": d.diff_quantity,
                "status": d.status
            } for d in review_diffs],
            "report": {
                "report_code": report.report_code,
                "total_orders": report.total_orders,
                "split_orders": report.split_orders,
                "shortage_items": report.shortage_items,
                "review_diffs": report.review_diffs
            } if report else None
        }