import pandas as pd
from io import BytesIO
from typing import List
from datetime import datetime

from models import Order, Deduction, Settlement, AuditLog


class ReportExporter:
    @staticmethod
    def export_orders_to_excel(orders: List[Order]) -> BytesIO:
        data = []
        for order in orders:
            data.append({
                "订单ID": order.id,
                "房间号": order.room_number,
                "房间类型": order.room_type,
                "客人姓名": order.guest_name or "",
                "客人电话": order.guest_phone or "",
                "入住日期": order.checkin_date.strftime("%Y-%m-%d") if order.checkin_date else "",
                "退房日期": order.checkout_date.strftime("%Y-%m-%d") if order.checkout_date else "",
                "状态": order.status.value if order.status else "",
                "保洁员ID": order.cleaner_id or "",
                "保洁员姓名": order.cleaner_name or "",
                "派单时间": order.assigned_at.strftime("%Y-%m-%d %H:%M:%S") if order.assigned_at else "",
                "完成时间": order.completed_at.strftime("%Y-%m-%d %H:%M:%S") if order.completed_at else "",
                "预估金额": order.estimated_amount,
                "最终金额": order.final_amount,
                "创建人": order.created_by,
                "创建时间": order.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "备注": order.remarks or ""
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="保洁订单")
        output.seek(0)
        return output

    @staticmethod
    def export_deductions_to_excel(deductions: List[Deduction]) -> BytesIO:
        data = []
        for deduction in deductions:
            data.append({
                "扣款ID": deduction.id,
                "订单ID": deduction.order_id,
                "返工ID": deduction.rework_id or "",
                "扣款类型": deduction.deduction_type.value if deduction.deduction_type else "",
                "扣款金额": deduction.amount,
                "扣款原因": deduction.reason,
                "证据链接": deduction.evidence_urls or "",
                "是否批准": "是" if deduction.approved else "否",
                "批准人": deduction.approved_by or "",
                "批准时间": deduction.approved_at.strftime("%Y-%m-%d %H:%M:%S") if deduction.approved_at else "",
                "创建人": deduction.created_by,
                "创建时间": deduction.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="扣款记录")
        output.seek(0)
        return output

    @staticmethod
    def export_settlements_to_excel(settlements: List[Settlement]) -> BytesIO:
        data = []
        for settlement in settlements:
            data.append({
                "结算ID": settlement.id,
                "订单ID": settlement.order_id,
                "保洁员ID": settlement.cleaner_id,
                "保洁员姓名": settlement.cleaner_name,
                "基础金额": settlement.base_amount,
                "总扣款": settlement.total_deductions,
                "最终结算": settlement.final_settlement,
                "结算月份": settlement.settlement_month,
                "是否支付": "是" if settlement.paid else "否",
                "支付时间": settlement.paid_at.strftime("%Y-%m-%d %H:%M:%S") if settlement.paid_at else "",
                "支付人": settlement.paid_by or "",
                "创建人": settlement.created_by,
                "创建时间": settlement.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "备注": settlement.remarks or ""
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="结算记录")
        output.seek(0)
        return output

    @staticmethod
    def export_audit_logs_to_excel(logs: List[AuditLog]) -> BytesIO:
        data = []
        for log in logs:
            data.append({
                "日志ID": log.id,
                "操作类型": log.action,
                "实体类型": log.entity_type,
                "实体ID": log.entity_id,
                "操作人ID": log.operator_id,
                "操作人姓名": log.operator_name,
                "操作人角色": log.operator_role.value if log.operator_role else "",
                "IP地址": log.ip_address or "",
                "详情": log.details or "",
                "创建时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="审计日志")
        output.seek(0)
        return output
