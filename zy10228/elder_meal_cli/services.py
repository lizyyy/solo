from datetime import datetime, date, timedelta
from typing import Optional, List, Tuple, Dict, Any
from dataclasses import dataclass
import hashlib
import csv
import io

from .database import Database
from .models import (
    Elder, MealPlan, SubsidyHistory, Order, CancellationRecord,
    DeliveryRecord, PaymentRecord, OrderStatus, SubsidyType,
    CancellationReason, ValidationError, ValidationResult
)


@dataclass
class ProcessResult:
    success: bool
    message: str
    warnings: List[str]
    data: Any = None


@dataclass
class ImportResult:
    total: int
    inserted: int
    skipped: int
    errors: List[Dict]
    warnings: List[Dict]


class ElderMealService:
    def __init__(self, db: Database):
        self.db = db

    def _get_deadline_datetime(self, meal_date: date) -> datetime:
        deadline_time = self.db.get_config('cancellation_deadline_time') or '20:00'
        days_before = int(self.db.get_config('cancellation_deadline_days_before') or '1')
        
        deadline_date = meal_date - timedelta(days=days_before)
        hour, minute = map(int, deadline_time.split(':'))
        return datetime(deadline_date.year, deadline_date.month, deadline_date.day, hour, minute)

    def _get_deduction_after_deadline_rate(self) -> float:
        return float(self.db.get_config('deduction_after_deadline_rate') or '0.5')

    def _get_deduction_after_delivered_rate(self) -> float:
        return float(self.db.get_config('deduction_after_delivered_rate') or '1.0')

    def add_elder(self, elder: Elder) -> ProcessResult:
        if not elder.name:
            return ProcessResult(success=False, message="老人姓名不能为空", warnings=[])
        
        if elder.id_card:
            existing = self.db.get_elder_by_id_card(elder.id_card)
            if existing:
                return ProcessResult(
                    success=False, 
                    message=f"身份证号 {elder.id_card} 已存在", 
                    warnings=[f"已存在的老人: {existing.name}"]
                )
        
        elder_id = self.db.add_elder(elder)
        return ProcessResult(
            success=True, 
            message=f"成功添加老人: {elder.name} (ID: {elder_id})",
            warnings=[],
            data=elder_id
        )

    def update_subsidy_type(self, elder_id: int, new_subsidy_type: str, 
                            effective_date: str = None, notes: str = "") -> ProcessResult:
        elder = self.db.get_elder(elder_id)
        if not elder:
            return ProcessResult(success=False, message=f"老人 ID {elder_id} 不存在", warnings=[])
        
        if elder.subsidy_type == new_subsidy_type:
            return ProcessResult(
                success=True, 
                message=f"补贴类型未变化，无需更新: {new_subsidy_type}",
                warnings=[]
            )
        
        old_type = elder.subsidy_type
        elder.subsidy_type = new_subsidy_type
        self.db.update_elder(elder)
        
        history = SubsidyHistory(
            elder_id=elder_id,
            old_subsidy_type=old_type,
            new_subsidy_type=new_subsidy_type,
            effective_date=effective_date or date.today().isoformat(),
            notes=notes
        )
        self.db.add_subsidy_history(history)
        
        return ProcessResult(
            success=True,
            message=f"成功更新补贴类型: {old_type} -> {new_subsidy_type}",
            warnings=[],
            data=elder
        )

    def create_order(self, elder_id: int, meal_date: str, meal_plan_id: int,
                     import_source: str = "", import_id: str = "") -> ProcessResult:
        elder = self.db.get_elder(elder_id)
        if not elder:
            return ProcessResult(success=False, message=f"老人 ID {elder_id} 不存在", warnings=[])
        
        meal_plan = self.db.get_meal_plan(meal_plan_id)
        if not meal_plan:
            return ProcessResult(success=False, message=f"餐标 ID {meal_plan_id} 不存在", warnings=[])
        
        if import_source and import_id:
            existing = self.db.get_order_by_import(import_source, import_id)
            if existing:
                return ProcessResult(
                    success=True,
                    message=f"订单已存在（通过导入ID去重）: 订单号 {existing.id}",
                    warnings=[f"导入源: {import_source}, 导入ID: {import_id} 已存在，跳过"],
                    data=existing
                )
        
        actual_payment = max(0, meal_plan.price - meal_plan.subsidy_amount)
        
        order = Order(
            elder_id=elder_id,
            elder_name=elder.name,
            meal_date=meal_date,
            meal_plan_id=meal_plan_id,
            meal_plan_name=meal_plan.name,
            price=meal_plan.price,
            subsidy_type=elder.subsidy_type,
            subsidy_amount=meal_plan.subsidy_amount,
            actual_payment=actual_payment,
            delivery_address=elder.address,
            district=elder.district,
            route=elder.route,
            status=OrderStatus.PLACED.value,
            import_source=import_source,
            import_id=import_id
        )
        
        order_id = self.db.add_order(order)
        if order_id is None:
            return ProcessResult(
                success=True,
                message=f"同一天同一位老人的同类型餐已存在，已自动去重",
                warnings=[f"老人 {elder.name}, 日期 {meal_date}, 餐标 {meal_plan.name} 已下单，跳过重复"],
                data=None
            )
        
        return ProcessResult(
            success=True,
            message=f"成功创建订单: 订单号 {order_id}",
            warnings=[],
            data=order_id
        )

    def cancel_order(self, order_id: int, reason: str, reason_detail: str = "",
                     cancel_time: datetime = None) -> ProcessResult:
        order = self.db.get_order(order_id)
        if not order:
            return ProcessResult(success=False, message=f"订单 ID {order_id} 不存在", warnings=[])
        
        if cancel_time is None:
            cancel_time = datetime.now()
        
        meal_date = date.fromisoformat(order.meal_date)
        deadline = self._get_deadline_datetime(meal_date)
        is_after_deadline = cancel_time > deadline
        
        delivery = self.db.get_delivery_by_order(order_id)
        is_delivered = delivery is not None and delivery.delivered
        
        if order.status in [OrderStatus.CANCELLED.value, OrderStatus.REFUNDED.value]:
            existing = self.db.get_cancellation_by_order(order_id)
            if existing:
                return ProcessResult(
                    success=True,
                    message=f"订单 {order_id} 已退餐，无需重复操作",
                    warnings=[f"退餐记录ID: {existing.id}, 退餐时间: {existing.cancel_time}"],
                    data=existing
                )
        
        errors = []
        if is_delivered:
            errors.append({
                "type": "DELIVERED_BEFORE_CANCEL",
                "message": f"【异常拦截】订单 {order_id} 已送达，禁止退餐或需全额扣款",
                "detail": f"配送员: {delivery.deliverer}, 送达时间: {delivery.delivery_time}"
            })
        
        if is_after_deadline:
            errors.append({
                "type": "AFTER_DEADLINE",
                "message": f"【异常拦截】退餐时间 {cancel_time.strftime('%Y-%m-%d %H:%M')} 晚于截止时间",
                "detail": f"用餐日期: {meal_date}, 退餐截止时间: {deadline.strftime('%Y-%m-%d %H:%M')}"
            })
        
        deduction_rate = 0.0
        deduction_amount = 0.0
        refund_amount = order.actual_payment
        
        if is_delivered:
            deduction_rate = self._get_deduction_after_delivered_rate()
        elif is_after_deadline:
            deduction_rate = self._get_deduction_after_deadline_rate()
        
        if deduction_rate > 0:
            deduction_amount = round(order.actual_payment * deduction_rate, 2)
            refund_amount = round(order.actual_payment - deduction_amount, 2)
        
        record = CancellationRecord(
            order_id=order_id,
            cancel_time=cancel_time.isoformat(),
            reason=reason,
            reason_detail=reason_detail,
            is_after_deadline=is_after_deadline,
            deadline_time=deadline.isoformat(),
            is_delivered=is_delivered,
            refund_amount=refund_amount,
            deduction_amount=deduction_amount,
            notes=" | ".join([e["message"] for e in errors])
        )
        
        self.db.add_cancellation(record)
        
        if is_delivered:
            status = OrderStatus.REFUNDED.value if deduction_rate < 1 else order.status
        else:
            status = OrderStatus.CANCELLED.value
        order.status = status
        self.db.update_order(order)
        
        warnings = []
        for e in errors:
            warnings.append(e["message"] + " - " + e["detail"])
        
        return ProcessResult(
            success=True,
            message=f"成功处理退餐: 订单 {order_id}, 退款 {refund_amount}元, 扣款 {deduction_amount}元",
            warnings=warnings,
            data={
                "refund_amount": refund_amount,
                "deduction_amount": deduction_amount,
                "is_after_deadline": is_after_deadline,
                "is_delivered": is_delivered
            }
        )

    def record_delivery(self, order_id: int, deliverer: str, receiver: str = "",
                        delivery_time: datetime = None, notes: str = "") -> ProcessResult:
        order = self.db.get_order(order_id)
        if not order:
            return ProcessResult(success=False, message=f"订单 ID {order_id} 不存在", warnings=[])
        
        if order.status in [OrderStatus.CANCELLED.value, OrderStatus.REFUNDED.value]:
            return ProcessResult(
                success=False,
                message=f"订单 {order_id} 已退餐/取消，无法登记送达",
                warnings=[f"当前状态: {order.status}"]
            )
        
        existing = self.db.get_delivery_by_order(order_id)
        if existing:
            return ProcessResult(
                success=True,
                message=f"送达已登记，无需重复操作",
                warnings=[f"已存在的送达记录ID: {existing.id}"],
                data=existing
            )
        
        if delivery_time is None:
            delivery_time = datetime.now()
        
        delivery = DeliveryRecord(
            order_id=order_id,
            deliverer=deliverer,
            delivery_time=delivery_time.isoformat(),
            delivered=True,
            receiver=receiver,
            notes=notes
        )
        
        self.db.add_delivery(delivery)
        
        order.status = OrderStatus.DELIVERED.value
        self.db.update_order(order)
        
        return ProcessResult(
            success=True,
            message=f"成功登记送达: 订单 {order_id}, 配送员: {deliverer}",
            warnings=[],
            data=delivery
        )

    def record_payment(self, order_id: int, amount: float, method: str = "现金",
                       payment_time: datetime = None, notes: str = "") -> ProcessResult:
        order = self.db.get_order(order_id)
        if not order:
            return ProcessResult(success=False, message=f"订单 ID {order_id} 不存在", warnings=[])
        
        if payment_time is None:
            payment_time = datetime.now()
        
        payment = PaymentRecord(
            order_id=order_id,
            amount=amount,
            payment_method=method,
            payment_time=payment_time.isoformat(),
            notes=notes
        )
        
        self.db.add_payment(payment)
        
        return ProcessResult(
            success=True,
            message=f"成功登记收费: 订单 {order_id}, 金额 {amount}元",
            warnings=[],
            data=payment
        )

    def import_orders_from_csv(self, csv_content: str, import_source: str = "csv") -> ImportResult:
        results = ImportResult(total=0, inserted=0, skipped=0, errors=[], warnings=[])
        
        try:
            reader = csv.DictReader(io.StringIO(csv_content))
        except Exception as e:
            results.errors.append({"row": 0, "error": f"CSV格式错误: {str(e)}"})
            return results
        
        for idx, row in enumerate(reader, start=1):
            results.total += 1
            
            try:
                name = row.get('老人姓名', '').strip()
                id_card = row.get('身份证号', '').strip()
                meal_date = row.get('用餐日期', '').strip()
                meal_plan_name = row.get('餐标', '').strip()
                
                if not name or not meal_date or not meal_plan_name:
                    results.errors.append({
                        "row": idx,
                        "error": "缺少必填字段",
                        "detail": "需要: 老人姓名、用餐日期、餐标"
                    })
                    continue
                
                elder = None
                if id_card:
                    elder = self.db.get_elder_by_id_card(id_card)
                if not elder and name:
                    elders = self.db.list_elders(search=name)
                    if len(elders) == 1:
                        elder = elders[0]
                
                if not elder:
                    results.errors.append({
                        "row": idx,
                        "error": f"未找到老人: {name}",
                        "detail": "请先在系统中添加老人信息"
                    })
                    continue
                
                meal_plan = self.db.get_meal_plan_by_name(meal_plan_name)
                if not meal_plan:
                    results.errors.append({
                        "row": idx,
                        "error": f"未找到餐标: {meal_plan_name}",
                        "detail": "请先在系统中添加餐标"
                    })
                    continue
                
                import_id = f"{id_card or name}_{meal_date}_{meal_plan_name}"
                import_id = hashlib.md5(import_id.encode()).hexdigest()
                
                result = self.create_order(
                    elder_id=elder.id,
                    meal_date=meal_date,
                    meal_plan_id=meal_plan.id,
                    import_source=import_source,
                    import_id=import_id
                )
                
                if not result.success:
                    results.errors.append({
                        "row": idx,
                        "error": result.message,
                        "detail": str(result.warnings)
                    })
                elif result.warnings:
                    results.skipped += 1
                    results.warnings.append({
                        "row": idx,
                        "warning": result.message,
                        "detail": result.warnings[0] if result.warnings else ""
                    })
                else:
                    results.inserted += 1
                    
            except Exception as e:
                results.errors.append({
                    "row": idx,
                    "error": f"处理异常: {str(e)}",
                    "detail": str(row)
                })
        
        return results

    def get_kitchen_prep_summary(self, meal_date: str) -> Dict:
        orders = self.db.list_orders(meal_date=meal_date)
        valid_orders = [o for o in orders if o.status not in [OrderStatus.CANCELLED.value]]
        
        by_meal_plan: Dict[str, Dict] = {}
        for o in valid_orders:
            if o.meal_plan_name not in by_meal_plan:
                by_meal_plan[o.meal_plan_name] = {
                    "count": 0,
                    "total_price": 0.0,
                    "total_subsidy": 0.0,
                    "orders": []
                }
            by_meal_plan[o.meal_plan_name]["count"] += 1
            by_meal_plan[o.meal_plan_name]["total_price"] += o.price
            by_meal_plan[o.meal_plan_name]["total_subsidy"] += o.subsidy_amount
            by_meal_plan[o.meal_plan_name]["orders"].append(o)
        
        total_count = sum(v["count"] for v in by_meal_plan.values())
        total_price = sum(v["total_price"] for v in by_meal_plan.values())
        total_subsidy = sum(v["total_subsidy"] for v in by_meal_plan.values())
        
        return {
            "meal_date": meal_date,
            "total_count": total_count,
            "total_price": total_price,
            "total_subsidy": total_subsidy,
            "by_meal_plan": by_meal_plan,
            "all_orders": valid_orders
        }

    def get_delivery_routes(self, meal_date: str) -> Dict:
        orders = self.db.list_orders(meal_date=meal_date)
        valid_orders = [o for o in orders if o.status not in [OrderStatus.CANCELLED.value]]
        
        by_route: Dict[str, Dict] = {}
        for o in valid_orders:
            route_key = o.route or "未分配路线"
            if route_key not in by_route:
                by_route[route_key] = {
                    "district": o.district,
                    "count": 0,
                    "orders": []
                }
            by_route[route_key]["count"] += 1
            by_route[route_key]["orders"].append(o)
        
        for route_data in by_route.values():
            route_data["orders"].sort(key=lambda x: (x.district or "", x.delivery_address or ""))
        
        return {
            "meal_date": meal_date,
            "total_routes": len(by_route),
            "total_deliveries": sum(v["count"] for v in by_route.values()),
            "routes": by_route
        }

    def get_cancellation_summary(self, start_date: str, end_date: str) -> Dict:
        cancellations = self.db.list_cancellations(start_date=start_date, end_date=end_date)
        
        summary = {
            "total_count": len(cancellations),
            "after_deadline_count": 0,
            "after_delivered_count": 0,
            "total_refund": 0.0,
            "total_deduction": 0.0,
            "by_reason": {},
            "details": []
        }
        
        for c in cancellations:
            order = self.db.get_order(c.order_id)
            if order:
                summary["total_refund"] += c.refund_amount
                summary["total_deduction"] += c.deduction_amount
                
                if c.is_after_deadline:
                    summary["after_deadline_count"] += 1
                if c.is_delivered:
                    summary["after_delivered_count"] += 1
                
                reason = c.reason or "未填写"
                if reason not in summary["by_reason"]:
                    summary["by_reason"][reason] = {"count": 0, "deduction": 0.0}
                summary["by_reason"][reason]["count"] += 1
                summary["by_reason"][reason]["deduction"] += c.deduction_amount
                
                summary["details"].append({
                    "order_id": c.order_id,
                    "elder_name": order.elder_name,
                    "meal_date": order.meal_date,
                    "meal_plan": order.meal_plan_name,
                    "cancel_time": c.cancel_time,
                    "reason": c.reason,
                    "is_after_deadline": c.is_after_deadline,
                    "is_delivered": c.is_delivered,
                    "refund": c.refund_amount,
                    "deduction": c.deduction_amount,
                    "block_reason": c.notes
                })
        
        return summary

    def get_subsidy_summary(self, start_date: str, end_date: str) -> Dict:
        orders = self.db.list_orders()
        
        filtered = []
        for o in orders:
            if start_date <= o.meal_date <= end_date:
                if o.status not in [OrderStatus.CANCELLED.value]:
                    filtered.append(o)
        
        by_type: Dict[str, Dict] = {}
        for o in filtered:
            subsidy_type = o.subsidy_type or "无补贴"
            if subsidy_type not in by_type:
                by_type[subsidy_type] = {
                    "count": 0,
                    "total_price": 0.0,
                    "total_subsidy": 0.0,
                    "total_payment": 0.0
                }
            by_type[subsidy_type]["count"] += 1
            by_type[subsidy_type]["total_price"] += o.price
            by_type[subsidy_type]["total_subsidy"] += o.subsidy_amount
            by_type[subsidy_type]["total_payment"] += o.actual_payment
        
        total_price = sum(v["total_price"] for v in by_type.values())
        total_subsidy = sum(v["total_subsidy"] for v in by_type.values())
        total_payment = sum(v["total_payment"] for v in by_type.values())
        
        return {
            "start_date": start_date,
            "end_date": end_date,
            "total_orders": len(filtered),
            "total_price": total_price,
            "total_subsidy": total_subsidy,
            "total_payment": total_payment,
            "by_subsidy_type": by_type
        }
