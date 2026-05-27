from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import os
from app.models import Order, DepositRecord, ReconciliationReport, ReviewRecord
from app.schemas import DepositRecordResponse
from app.services.reconciliation_service import ReconciliationService
from app.config import settings


class DepositHistoryService:
    def __init__(self, db: Session):
        self.db = db

    def get_deposit_history(self, order_id: str) -> Dict[str, Any]:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return {"success": False, "message": f"订单 {order_id} 不存在"}

        deposit_records = self.db.query(DepositRecord).filter(
            DepositRecord.order_id == order_id
        ).order_by(DepositRecord.created_at.asc()).all()

        history = []
        current_balance = 0

        for record in deposit_records:
            entry = {
                "id": record.id,
                "transaction_type": record.transaction_type,
                "amount": record.amount,
                "balance": record.balance,
                "reference_type": record.reference_type,
                "reference_id": record.reference_id,
                "operator": record.operator,
                "remark": record.remark,
                "created_at": record.created_at.isoformat() if record.created_at else None,
                "source": self._get_transaction_source(record)
            }
            history.append(entry)
            current_balance = record.balance

        reconciliation = ReconciliationService(self.db)
        recon_result = reconciliation.reconcile_order(order_id)

        return {
            "success": True,
            "order_id": order.id,
            "order_no": order.order_no,
            "initial_deposit": order.deposit_amount,
            "current_balance": current_balance,
            "deposit_status": order.deposit_status,
            "history": history,
            "reconciliation_summary": recon_result.cost_summary.model_dump() if recon_result else None
        }

    def _get_transaction_source(self, record: DepositRecord) -> str:
        if record.transaction_type == "charge":
            return "押金收取"
        elif record.transaction_type == "deduct":
            if record.reference_type == "utility":
                return "水电费扣除"
            elif record.reference_type == "deduction":
                return "损坏扣款"
            return "扣款"
        elif record.transaction_type == "refund":
            return "押金退还"
        elif record.transaction_type == "correction":
            return "退款冲正"
        return "其他"

    def get_deposit_trace(self, order_id: str) -> Dict[str, Any]:
        history = self.get_deposit_history(order_id)
        if not history.get("success"):
            return history

        deposit_records = self.db.query(DepositRecord).filter(
            DepositRecord.order_id == order_id
        ).order_by(DepositRecord.created_at.asc()).all()

        trace = {
            "order_id": order_id,
            "order_no": history.get("order_no"),
            "initial_deposit": history.get("initial_deposit"),
            "current_balance": history.get("current_balance"),
            "status": history.get("deposit_status"),
            "transactions": [],
            "audit_trail": []
        }

        for record in deposit_records:
            transaction = {
                "timestamp": record.created_at.isoformat() if record.created_at else None,
                "type": record.transaction_type,
                "amount": record.amount,
                "balance_after": record.balance,
                "operator": record.operator,
                "remark": record.remark
            }

            if record.reference_type and record.reference_id:
                ref_info = self._get_reference_info(record.reference_type, record.reference_id)
                transaction["reference"] = ref_info

            trace["transactions"].append(transaction)

        review_records = self.db.query(ReviewRecord).filter(
            ReviewRecord.order_id == order_id
        ).order_by(ReviewRecord.created_at.asc()).all()

        for review in review_records:
            audit_entry = {
                "timestamp": review.created_at.isoformat() if review.created_at else None,
                "review_type": review.review_type,
                "action": review.action,
                "reviewer": review.reviewer,
                "reason": review.reason,
                "changes": {
                    "before": review.before_value,
                    "after": review.after_value
                }
            }
            trace["audit_trail"].append(audit_entry)

        return trace

    def _get_reference_info(self, ref_type: str, ref_id: str) -> Dict[str, Any]:
        if ref_type == "deduction":
            from app.models import Deduction
            deduction = self.db.query(Deduction).filter(Deduction.id == int(ref_id)).first()
            if deduction:
                return {
                    "type": "deduction",
                    "id": deduction.id,
                    "deduction_type": deduction.deduction_type,
                    "amount": deduction.amount,
                    "description": deduction.description,
                    "is_verified": deduction.is_verified
                }
        elif ref_type == "utility":
            return {
                "type": "utility",
                "description": "水电费计算"
            }
        return {"type": ref_type, "id": ref_id}


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_report(self, order_id: str, reviewer: str = "system") -> Dict[str, Any]:
        reconciliation = ReconciliationService(self.db)
        recon_result = reconciliation.reconcile_order(order_id)

        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return {"success": False, "message": f"订单 {order_id} 不存在"}

        report_data = {
            "order_info": {
                "order_no": order.order_no,
                "tenant_name": order.tenant_name,
                "tenant_phone": order.tenant_phone,
                "room_no": order.room_no,
                "check_in_date": order.check_in_date.isoformat() if order.check_in_date else None,
                "check_out_date": order.check_out_date.isoformat() if order.check_out_date else None,
                "rental_amount": order.rental_amount,
                "deposit_amount": order.deposit_amount
            },
            "cost_breakdown": {
                "electricity": recon_result.cost_summary.electricity_cost,
                "water": recon_result.cost_summary.water_cost,
                "utility_total": recon_result.cost_summary.utility_total,
                "deductions": recon_result.cost_summary.deduction_total,
                "deposit_refund": recon_result.cost_summary.deposit_refund,
                "final_balance": recon_result.cost_summary.final_deposit_balance
            },
            "electricity_details": [detail.model_dump() for detail in recon_result.electricity_details],
            "water_details": [detail.model_dump() for detail in recon_result.water_details],
            "deductions": [d.model_dump() for d in recon_result.deductions],
            "deposit_records": [r.model_dump() for r in recon_result.deposit_records],
            "differences": [d.model_dump() for d in recon_result.differences],
            "is_balanced": recon_result.is_balanced,
            "needs_review": recon_result.needs_review
        }

        summary = {
            "order_no": order.order_no,
            "tenant_name": order.tenant_name,
            "total_cost": recon_result.cost_summary.utility_total + recon_result.cost_summary.deduction_total,
            "deposit_refund": recon_result.cost_summary.deposit_refund,
            "status": "balanced" if recon_result.is_balanced else "needs_review",
            "generated_at": datetime.now().isoformat()
        }

        # 序列化 datetime 对象以确保 JSON 兼容
        report_data = json.loads(json.dumps(report_data, default=str))
        summary = json.loads(json.dumps(summary, default=str))

        report_no = f"RPT-{order.order_no}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        report = ReconciliationReport(
            report_no=report_no,
            order_id=order_id,
            report_data=report_data,
            summary=summary,
            status="final" if recon_result.is_balanced else "draft",
            generated_by=reviewer
        )
        self.db.add(report)
        self.db.commit()

        return {
            "success": True,
            "report_no": report_no,
            "report_data": report_data,
            "summary": summary,
            "status": report.status
        }

    def get_report(self, report_no: str) -> Optional[Dict[str, Any]]:
        report = self.db.query(ReconciliationReport).filter(
            ReconciliationReport.report_no == report_no
        ).first()

        if not report:
            return None

        return {
            "report_no": report.report_no,
            "order_id": report.order_id,
            "report_data": report.report_data,
            "summary": report.summary,
            "status": report.status,
            "generated_by": report.generated_by,
            "created_at": report.created_at.isoformat() if report.created_at else None
        }

    def export_report(self, report_no: str, export_format: str = "json") -> Dict[str, Any]:
        report = self.get_report(report_no)
        if not report:
            return {"success": False, "message": f"报告 {report_no} 不存在"}

        if export_format == "json":
            os.makedirs(settings.EXPORT_DIR, exist_ok=True)
            file_path = os.path.join(settings.EXPORT_DIR, f"{report_no}.json")

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)

            return {
                "success": True,
                "format": "json",
                "file_path": file_path,
                "content": report
            }
        elif export_format == "text":
            text_content = self._format_report_text(report)
            os.makedirs(settings.EXPORT_DIR, exist_ok=True)
            file_path = os.path.join(settings.EXPORT_DIR, f"{report_no}.txt")

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(text_content)

            return {
                "success": True,
                "format": "text",
                "file_path": file_path,
                "content": text_content
            }
        else:
            return {"success": False, "message": f"不支持的导出格式: {export_format}"}

    def _format_report_text(self, report: Dict[str, Any]) -> str:
        data = report.get("report_data", {})
        order_info = data.get("order_info", {})
        cost_breakdown = data.get("cost_breakdown", {})

        lines = []
        lines.append("=" * 60)
        lines.append("短租对账报告")
        lines.append(f"报告编号: {report.get('report_no')}")
        lines.append("=" * 60)
        lines.append("")

        lines.append("【订单信息】")
        lines.append(f"订单号: {order_info.get('order_no', '')}")
        lines.append(f"租客姓名: {order_info.get('tenant_name', '')}")
        lines.append(f"联系电话: {order_info.get('tenant_phone', '')}")
        lines.append(f"房间号: {order_info.get('room_no', '')}")
        lines.append(f"入住日期: {order_info.get('check_in_date', '')}")
        lines.append(f"退房日期: {order_info.get('check_out_date', '')}")
        lines.append(f"租金金额: ¥{order_info.get('rental_amount', 0):.2f}")
        lines.append(f"押金金额: ¥{order_info.get('deposit_amount', 0):.2f}")
        lines.append("")

        lines.append("【费用明细】")
        lines.append(f"电费: ¥{cost_breakdown.get('electricity', 0):.2f}")
        lines.append(f"水费: ¥{cost_breakdown.get('water', 0):.2f}")
        lines.append(f"水电合计: ¥{cost_breakdown.get('utility_total', 0):.2f}")
        lines.append(f"损坏扣款: ¥{cost_breakdown.get('deductions', 0):.2f}")
        lines.append(f"费用总计: ¥{cost_breakdown.get('utility_total', 0) + cost_breakdown.get('deductions', 0):.2f}")
        lines.append("")

        lines.append("【押金结算】")
        lines.append(f"押金金额: ¥{order_info.get('deposit_amount', 0):.2f}")
        lines.append(f"费用扣除: ¥{cost_breakdown.get('utility_total', 0) + cost_breakdown.get('deductions', 0):.2f}")
        lines.append(f"应退押金: ¥{cost_breakdown.get('deposit_refund', 0):.2f}")
        lines.append(f"最终余额: ¥{cost_breakdown.get('final_balance', 0):.2f}")
        lines.append("")

        deductions = data.get("deductions", [])
        if deductions:
            lines.append("【扣款明细】")
            for ded in deductions:
                lines.append(f"  - {ded.get('deduction_type', '')}: ¥{ded.get('amount', 0):.2f}")
                if ded.get('description'):
                    lines.append(f"    说明: {ded['description']}")
                lines.append(f"    状态: {'已验证' if ded.get('is_verified') else '待审核'}")
            lines.append("")

        differences = data.get("differences", [])
        if differences:
            lines.append("【差异说明】")
            for diff in differences:
                lines.append(f"  - {diff.get('field', '')}:")
                lines.append(f"    期望值: ¥{diff.get('expected', 0):.2f}")
                lines.append(f"    实际值: ¥{diff.get('actual', 0):.2f}")
                lines.append(f"    差异: ¥{diff.get('difference', 0):.2f}")
                lines.append(f"    原因: {diff.get('reason', '')}")
            lines.append("")

        lines.append("【对账状态】")
        lines.append(f"对账状态: {'已平衡' if data.get('is_balanced') else '待复核'}")
        lines.append(f"是否需要人工审核: {'是' if data.get('needs_review') else '否'}")
        lines.append("")
        lines.append(f"报告生成时间: {report.get('created_at', '')}")
        lines.append("=" * 60)

        return "\n".join(lines)