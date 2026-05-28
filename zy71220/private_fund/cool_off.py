"""
冷静期状态机 - 核心锁住逻辑与状态流转
"""
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from .models import (
    SubscriptionOrder, CoolOffPeriod, CoolOffStatus,
    MaterialStatus, VisitStatus, SubscriptionStatus,
    InvestorMaterial, VisitRecord
)


class CoolOffStateMachine:
    """冷静期状态机 - 确保冷静期、材料、回访三者一起锁住"""

    REQUIRED_LOCK_TOGETHER = ["materials", "cool_off", "visit"]

    @classmethod
    def lock_together(cls, order: SubscriptionOrder, operator: str = "") -> Tuple[bool, List[str]]:
        """
        核心逻辑：冷静期、回访确认、合格投资者材料必须一起锁住
        任何一个缺失或无效都不能锁住
        """
        errors: List[str] = []
        warnings: List[str] = []

        dup_errors = [e for e in order.error_details if "重复认购" in e]
        if dup_errors:
            errors.extend(dup_errors)
            order.status = SubscriptionStatus.REJECTED
            return False, errors

        if not order.materials:
            errors.append("【锁住失败】缺少合格投资者材料，无法锁住")
        else:
            mat_errors, mat_warnings = cls._validate_materials(order)
            errors.extend(mat_errors)
            warnings.extend(mat_warnings)

        if not order.cool_off:
            errors.append("【锁住失败】缺少冷静期记录，无法锁住")
        else:
            cool_errors = cls._validate_cool_off(order)
            errors.extend(cool_errors)

        if not order.visit:
            errors.append("【锁住失败】缺少回访记录，无法锁住")
        else:
            visit_errors, visit_warnings = cls._validate_visit(order)
            errors.extend(visit_errors)
            warnings.extend(visit_warnings)

        if errors:
            order.error_details = errors
            order.warnings = warnings
            order.status = SubscriptionStatus.REJECTED
            return False, errors

        order.cool_off.lock(f"操作员[{operator}]于{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}锁住：材料、冷静期、回访三者关联")
        order.status = SubscriptionStatus.LOCKED
        order.warnings = warnings
        return True, warnings

    @classmethod
    def _validate_materials(cls, order: SubscriptionOrder) -> Tuple[List[str], List[str]]:
        errors, warnings = [], []
        required_types = {"合格投资者认定", "身份证"}
        found_types = set()

        for mat in order.materials:
            status = mat.check_valid()
            found_types.add(mat.material_type.value)
            if status == MaterialStatus.EXPIRED:
                expire_date = mat.expire_date.strftime('%Y-%m-%d') if mat.expire_date else "未知"
                errors.append(f"材料[{mat.material_type.value}]已过期，过期日期：{expire_date}")
            elif status == MaterialStatus.NOT_FOUND:
                errors.append(f"材料[{mat.material_type.value}]未上传文件")
            elif status == MaterialStatus.INCOMPLETE:
                errors.append(f"材料[{mat.material_type.value}]不完整")

        missing = required_types - found_types
        if missing:
            errors.append(f"缺少必备材料：{', '.join(missing)}")

        return errors, warnings

    @classmethod
    def _validate_cool_off(cls, order: SubscriptionOrder) -> List[str]:
        errors = []
        cool = order.cool_off
        if not cool.start_time:
            errors.append("冷静期尚未开始计算")
        else:
            status = cool.check_status()
            if status == CoolOffStatus.EXPIRED:
                remaining = cool.remaining_hours()
                errors.append(f"冷静期未满，还剩余{remaining:.1f}小时（结束时间：{cool.end_time.strftime('%Y-%m-%d %H:%M:%S')}）")
        return errors

    @classmethod
    def _validate_visit(cls, order: SubscriptionOrder) -> Tuple[List[str], List[str]]:
        errors, warnings = [], []
        visit = order.visit
        if visit.status == VisitStatus.NOT_STARTED:
            errors.append("回访尚未开始，需先录入回访录音")
        elif visit.status == VisitStatus.RECORDED:
            warnings.append(f"回访已录音但未确认，录音文件：{visit.record_file_path}")
        elif visit.status == VisitStatus.REJECTED:
            errors.append("客户拒绝确认，回访不通过")
        return errors, warnings

    @classmethod
    def start_cool_off(cls, order: SubscriptionOrder, start_time: Optional[datetime] = None,
                       duration_hours: int = 24) -> CoolOffPeriod:
        """开始冷静期计算"""
        if not order.cool_off:
            order.cool_off = CoolOffPeriod(subscription_id=order.subscription_id)
        order.cool_off.duration_hours = duration_hours
        order.cool_off.start(start_time)
        return order.cool_off

    @classmethod
    def batch_start_cool_off(cls, orders: List[SubscriptionOrder],
                             start_time: Optional[datetime] = None,
                             duration_hours: int = 24) -> Tuple[List[SubscriptionOrder], List[SubscriptionOrder]]:
        """批量启动冷静期，分离正常数据和脏数据"""
        success, failed = [], []
        for order in orders:
            try:
                cls.start_cool_off(order, start_time, duration_hours)
                success.append(order)
            except Exception as e:
                order.error_details.append(f"启动冷静期失败：{str(e)}")
                failed.append(order)
        return success, failed

    @classmethod
    def batch_lock(cls, orders: List[SubscriptionOrder], operator: str = "") -> Dict[str, List[SubscriptionOrder]]:
        """
        批量锁住，按结果分组便于复查
        返回: {
            "locked": 成功锁住的订单,
            "cool_off_pending": 冷静期未开始,
            "cool_off_not_completed": 冷静期未满,
            "material_invalid": 材料无效,
            "visit_invalid": 回访无效,
            "failed": 其他错误
        }
        """
        result = {
            "locked": [],
            "cool_off_pending": [],
            "cool_off_not_completed": [],
            "material_invalid": [],
            "visit_invalid": [],
            "failed": []
        }

        for order in orders:
            success, errors = cls.lock_together(order, operator)
            if success:
                result["locked"].append(order)
                continue

            error_text = "; ".join(errors)
            if "冷静期尚未开始" in error_text:
                result["cool_off_pending"].append(order)
            elif "冷静期未满" in error_text:
                result["cool_off_not_completed"].append(order)
            elif "材料[" in error_text or "缺少必备材料" in error_text:
                result["material_invalid"].append(order)
            elif "回访" in error_text:
                result["visit_invalid"].append(order)
            else:
                result["failed"].append(order)

        return result

    @classmethod
    def get_cool_off_summary(cls, order: SubscriptionOrder) -> Dict[str, Any]:
        """获取冷静期完整信息摘要，用于复查"""
        cool = order.cool_off
        if not cool:
            return {"status": "无冷静期记录"}

        check_time = datetime.now()
        current_status = cool.check_status(check_time)

        return {
            "subscription_id": order.subscription_id,
            "order_no": order.order_no,
            "investor_name": order.investor_name,
            "cool_off_id": cool.cool_off_id,
            "status": current_status.value,
            "is_locked": cool.is_locked,
            "lock_reason": cool.lock_reason,
            "start_time": cool.start_time.strftime('%Y-%m-%d %H:%M:%S') if cool.start_time else None,
            "end_time": cool.end_time.strftime('%Y-%m-%d %H:%M:%S') if cool.end_time else None,
            "remaining_hours": round(cool.remaining_hours(check_time), 2),
            "check_time": check_time.strftime('%Y-%m-%d %H:%M:%S'),
            "material_count": len(order.materials),
            "material_valid": all(m.status == MaterialStatus.VALID for m in order.materials) if order.materials else False,
            "visit_status": order.visit.status.value if order.visit else "无回访记录",
            "errors": order.error_details,
        }
