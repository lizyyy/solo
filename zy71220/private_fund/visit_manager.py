"""
回访留痕模块 - 录音关联、回访确认状态管理
"""
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from .models import VisitRecord, VisitStatus, SubscriptionOrder


class VisitManager:
    """回访管理器"""

    @classmethod
    def create_visit(cls, order: SubscriptionOrder, investor_id: str = "") -> VisitRecord:
        """创建回访记录"""
        visit = VisitRecord(
            subscription_id=order.subscription_id,
            investor_id=investor_id or order.investor_id,
        )
        order.visit = visit
        return visit

    @classmethod
    def record_audio(cls, order: SubscriptionOrder, record_file: str,
                     operator: str, visit_time: Optional[datetime] = None) -> Tuple[bool, List[str]]:
        """录入回访录音"""
        errors: List[str] = []

        if not order.visit:
            order.visit = cls.create_visit(order)

        if not record_file:
            errors.append("录音文件路径不能为空")
            return False, errors

        order.visit.record(record_file, operator, visit_time)
        return True, [f"回访录音已录入，文件：{record_file}，操作人：{operator}"]

    @classmethod
    def confirm_visit(cls, order: SubscriptionOrder, confirm_result: bool,
                      confirm_time: Optional[datetime] = None,
                      notes: str = "") -> Tuple[bool, List[str]]:
        """确认回访结果"""
        errors: List[str] = []

        if not order.visit:
            errors.append("回访记录不存在，请先录入回访录音")
            return False, errors

        if order.visit.status == VisitStatus.NOT_STARTED:
            errors.append("回访尚未录音，请先录入回访录音")
            return False, errors

        order.visit.confirm(confirm_result, confirm_time)
        order.visit.notes = notes

        if confirm_result:
            return True, [f"回访已确认通过，确认时间：{order.visit.confirm_time.strftime('%Y-%m-%d %H:%M:%S')}"]
        else:
            return False, [f"客户拒绝确认，备注：{notes or '无'}"]

    @classmethod
    def get_visit_summary(cls, order: SubscriptionOrder) -> Dict[str, Any]:
        """获取回访完整摘要"""
        if not order.visit:
            return {
                "subscription_id": order.subscription_id,
                "order_no": order.order_no,
                "investor_name": order.investor_name,
                "has_visit": False,
                "status": "无回访记录",
                "details": None
            }

        visit = order.visit
        return {
            "subscription_id": order.subscription_id,
            "order_no": order.order_no,
            "investor_name": order.investor_name,
            "has_visit": True,
            "visit_id": visit.visit_id,
            "status": visit.status.value,
            "record_file": visit.record_file_path,
            "visit_time": visit.visit_time.strftime('%Y-%m-%d %H:%M:%S') if visit.visit_time else None,
            "operator": visit.operator,
            "confirm_result": visit.confirm_result,
            "confirm_time": visit.confirm_time.strftime('%Y-%m-%d %H:%M:%S') if visit.confirm_time else None,
            "notes": visit.notes,
        }
