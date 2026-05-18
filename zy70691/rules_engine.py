from datetime import date, datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from models import (
    Flower, Subscription, DeliverySchedule, ChangeRequest,
    PriceDifference, InventoryLog, ChangeType, AdjustmentStatus,
    SubscriptionStatus
)


class ValidationError(Exception):
    pass


class BusinessRulesEngine:
    def __init__(self):
        self.executed_requests: Dict[str, List[ChangeRequest]] = defaultdict(list)
        self.inventory_logs: List[InventoryLog] = []
        self.price_differences: List[PriceDifference] = []

    def calculate_flowers_price(self, flower_ids: List[str], flowers: Dict[str, Flower]) -> float:
        total = 0.0
        for fid in flower_ids:
            if fid in flowers:
                total += flowers[fid].price
        return round(total, 2)

    def check_duplicate_adjustment(self, request: ChangeRequest, subscription_id: str) -> Tuple[bool, Optional[str]]:
        existing = self.executed_requests.get(subscription_id, [])
        for req in existing:
            if req.status != AdjustmentStatus.EXECUTED:
                continue
            if (req.effective_date == request.effective_date and
                req.change_type == request.change_type):
                if request.change_type == ChangeType.SWAP_FLOWER:
                    if (set(req.new_flower_ids) == set(request.new_flower_ids) and
                        set(req.old_flower_ids) == set(request.old_flower_ids)):
                        return True, f"重复换花申请: 生效日期 {request.effective_date} 已有相同换花"
                elif request.change_type in [ChangeType.PAUSE, ChangeType.RESUME]:
                    return True, f"重复{request.change_type.value}申请: 生效日期 {request.effective_date} 已有相同操作"
        return False, None

    def check_stock_availability(self, new_flower_ids: List[str], flowers: Dict[str, Flower],
                                required_quantity: int = 1) -> Tuple[bool, List[str]]:
        issues = []
        for fid in new_flower_ids:
            if fid not in flowers:
                issues.append(f"花材不存在: {fid}")
                continue
            flower = flowers[fid]
            if flower.current_stock < required_quantity:
                issues.append(f"库存不足: {flower.name} (ID: {fid}) 当前库存{flower.current_stock}, 需要{required_quantity}")
        return len(issues) == 0, issues

    def check_subscription_period(self, subscription: Subscription, effective_date: date) -> Tuple[bool, str]:
        if effective_date < subscription.start_date:
            return False, f"生效日期{effective_date}早于订阅开始日期{subscription.start_date}"
        if subscription.end_date and effective_date > subscription.end_date:
            return False, f"生效日期{effective_date}晚于订阅结束日期{subscription.end_date}"
        return True, ""

    def check_pause_conflict(self, subscription: Subscription, pause_start: date, pause_end: date) -> Tuple[bool, str]:
        if pause_end < pause_start:
            return False, "暂停结束日期不能早于开始日期"
        for pause in subscription.pause_history:
            existing_start = pause["start_date"]
            existing_end = pause["end_date"]
            if not (pause_end < existing_start or pause_start > existing_end):
                return False, f"与现有暂停冲突: {existing_start} 至 {existing_end}"
        return True, ""

    def validate_change_request(self, request: ChangeRequest, subscription: Subscription,
                                flowers: Dict[str, Flower]) -> Tuple[bool, List[str]]:
        issues = []
        is_dup, dup_msg = self.check_duplicate_adjustment(request, subscription.subscription_id)
        if is_dup:
            issues.append(dup_msg)
        period_ok, period_msg = self.check_subscription_period(subscription, request.effective_date)
        if not period_ok:
            issues.append(period_msg)
        if request.change_type == ChangeType.SWAP_FLOWER:
            stock_ok, stock_issues = self.check_stock_availability(request.new_flower_ids, flowers)
            issues.extend(stock_issues)
            if not request.old_flower_ids:
                issues.append("换花申请必须指定原花材")
            if not request.new_flower_ids:
                issues.append("换花申请必须指定新花材")
        elif request.change_type == ChangeType.PAUSE:
            if request.pause_end_date:
                pause_ok, pause_msg = self.check_pause_conflict(
                    subscription, request.effective_date, request.pause_end_date
                )
                if not pause_ok:
                    issues.append(pause_msg)
        if subscription.status == SubscriptionStatus.CANCELLED:
            issues.append("订阅已取消，无法调整")
        if subscription.status == SubscriptionStatus.COMPLETED:
            issues.append("订阅已完成，无法调整")
        return len(issues) == 0, issues

    def execute_swap_flower(self, request: ChangeRequest, subscription: Subscription,
                            flowers: Dict[str, Flower], schedules: List[DeliverySchedule]) -> Dict:
        old_price = self.calculate_flowers_price(request.old_flower_ids, flowers)
        new_price = self.calculate_flowers_price(request.new_flower_ids, flowers)
        diff = round(new_price - old_price, 2)
        for fid in request.old_flower_ids:
            if fid in flowers:
                prev = flowers[fid].current_stock
                flowers[fid].current_stock += 1
                self.inventory_logs.append(InventoryLog(
                    flower_id=fid, change_type="return", quantity_change=1,
                    previous_stock=prev, new_stock=flowers[fid].current_stock,
                    reason="换花退回", related_request_id=request.request_id
                ))
        for fid in request.new_flower_ids:
            if fid in flowers:
                prev = flowers[fid].current_stock
                flowers[fid].current_stock -= 1
                self.inventory_logs.append(InventoryLog(
                    flower_id=fid, change_type="allocate", quantity_change=-1,
                    previous_stock=prev, new_stock=flowers[fid].current_stock,
                    reason="换花分配", related_request_id=request.request_id
                ))
        price_diff = PriceDifference(
            subscription_id=subscription.subscription_id,
            change_request_id=request.request_id,
            old_price=old_price, new_price=new_price, difference=diff,
            adjustment_type="upgrade" if diff > 0 else "downgrade" if diff < 0 else "none"
        )
        self.price_differences.append(price_diff)
        affected_schedules = []
        for sched in schedules:
            if (sched.subscription_id == subscription.subscription_id and
                sched.delivery_date >= request.effective_date and
                sched.status == "scheduled"):
                sched.flower_ids = [
                    fid for fid in sched.flower_ids if fid not in request.old_flower_ids
                ] + request.new_flower_ids
                affected_schedules.append(sched.schedule_id)
        subscription.current_flower_ids = [
            fid for fid in subscription.current_flower_ids if fid not in request.old_flower_ids
        ] + request.new_flower_ids
        subscription.total_price = round(subscription.total_price + diff, 2)
        request.status = AdjustmentStatus.EXECUTED
        self.executed_requests[subscription.subscription_id].append(request)
        return {
            "success": True,
            "price_diff": diff,
            "old_price": old_price,
            "new_price": new_price,
            "affected_schedules": affected_schedules,
            "inventory_changes": len(self.inventory_logs)
        }

    def execute_pause(self, request: ChangeRequest, subscription: Subscription,
                      schedules: List[DeliverySchedule]) -> Dict:
        end_date = request.pause_end_date or (request.effective_date + timedelta(days=30))
        pause_record = {
            "start_date": request.effective_date,
            "end_date": end_date,
            "request_id": request.request_id
        }
        subscription.pause_history.append(pause_record)
        subscription.status = SubscriptionStatus.PAUSED
        affected_schedules = []
        for sched in schedules:
            if (sched.subscription_id == subscription.subscription_id and
                request.effective_date <= sched.delivery_date <= end_date):
                sched.status = "paused"
                sched.notes = f"暂停: {request.request_id}"
                affected_schedules.append(sched.schedule_id)
        request.status = AdjustmentStatus.EXECUTED
        self.executed_requests[subscription.subscription_id].append(request)
        return {
            "success": True,
            "pause_days": (end_date - request.effective_date).days + 1,
            "affected_schedules": affected_schedules
        }

    def execute_resume(self, request: ChangeRequest, subscription: Subscription,
                       schedules: List[DeliverySchedule]) -> Dict:
        subscription.status = SubscriptionStatus.ACTIVE
        affected_schedules = []
        for sched in schedules:
            if (sched.subscription_id == subscription.subscription_id and
                sched.delivery_date >= request.effective_date and
                sched.status == "paused"):
                sched.status = "rescheduled"
                sched.notes = f"恢复: {request.request_id}"
                affected_schedules.append(sched.schedule_id)
        request.status = AdjustmentStatus.EXECUTED
        self.executed_requests[subscription.subscription_id].append(request)
        return {
            "success": True,
            "resume_date": request.effective_date,
            "affected_schedules": affected_schedules
        }

    def execute_change_request(self, request: ChangeRequest, subscription: Subscription,
                               flowers: Dict[str, Flower], schedules: List[DeliverySchedule]) -> Dict:
        valid, issues = self.validate_change_request(request, subscription, flowers)
        if not valid:
            return {"success": False, "errors": issues}
        if request.change_type == ChangeType.SWAP_FLOWER:
            return self.execute_swap_flower(request, subscription, flowers, schedules)
        elif request.change_type == ChangeType.PAUSE:
            return self.execute_pause(request, subscription, schedules)
        elif request.change_type == ChangeType.RESUME:
            return self.execute_resume(request, subscription, schedules)
        else:
            return {"success": False, "errors": ["不支持的调整类型"]}

    def generate_delivery_report(self, subscription: Subscription, schedules: List[DeliverySchedule],
                                 period_start: date, period_end: date) -> Dict:
        sub_schedules = [
            s for s in schedules
            if s.subscription_id == subscription.subscription_id
            and period_start <= s.delivery_date <= period_end
        ]
        completed = [s for s in sub_schedules if s.status == "delivered"]
        paused = [s for s in sub_schedules if s.status == "paused"]
        changes = [
            req for req in self.executed_requests.get(subscription.subscription_id, [])
            if period_start <= req.effective_date <= period_end
        ]
        total_diff = sum(
            pd.difference for pd in self.price_differences
            if pd.subscription_id == subscription.subscription_id
        )
        flower_changes = []
        for req in changes:
            if req.change_type == ChangeType.SWAP_FLOWER:
                flower_changes.append({
                    "date": req.effective_date.isoformat(),
                    "old": req.old_flower_ids,
                    "new": req.new_flower_ids
                })
        return {
            "subscription_id": subscription.subscription_id,
            "period": f"{period_start.isoformat()} 至 {period_end.isoformat()}",
            "total_deliveries": len(sub_schedules),
            "completed_deliveries": len(completed),
            "paused_deliveries": len(paused),
            "total_adjustments": len(changes),
            "price_adjustments_total": round(total_diff, 2),
            "flower_changes": flower_changes,
            "generated_at": datetime.now().isoformat()
        }

    def verify_consistency(self, subscription: Subscription, flowers: Dict[str, Flower],
                           schedules: List[DeliverySchedule]) -> Tuple[bool, List[str]]:
        issues = []
        sub_schedules = [s for s in schedules if s.subscription_id == subscription.subscription_id]
        pending_schedules = [s for s in sub_schedules if s.status != "delivered"]
        if pending_schedules:
            actual_flowers = set()
            for sched in pending_schedules:
                actual_flowers.update(sched.flower_ids)
            if actual_flowers and actual_flowers != set(subscription.current_flower_ids):
                issues.append(f"花材不一致: 订阅记录{set(subscription.current_flower_ids)} vs 未配送计划{actual_flowers}")
        recorded_price = sum(
            pd.difference for pd in self.price_differences
            if pd.subscription_id == subscription.subscription_id
        )
        if abs(recorded_price) > 0.01 and len(sub_schedules) > 0:
            pass
        for log in self.inventory_logs:
            if log.flower_id in flowers:
                flower = flowers[log.flower_id]
                if flower.current_stock < flower.min_stock:
                    issues.append(f"花材{flower.name}低于最低库存: 当前{flower.current_stock}, 最低{flower.min_stock}")
        return len(issues) == 0, issues
