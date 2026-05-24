import io
import pandas as pd
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import CompensationRecord, OperationLog


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_to_excel(
        self,
        case_no: Optional[str] = None,
        user_id: Optional[str] = None,
        pile_no: Optional[str] = None,
        order_no: Optional[str] = None,
        status: Optional[str] = None,
        batch_no: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> bytes:
        records, _ = self._query_records(
            case_no=case_no,
            user_id=user_id,
            pile_no=pile_no,
            order_no=order_no,
            status=status,
            batch_no=batch_no,
            start_date=start_date,
            end_date=end_date
        )

        data = []
        for record in records:
            voucher_no = ""
            voucher_amount = ""
            voucher_status = ""
            if record.voucher:
                voucher_no = record.voucher.voucher_no
                voucher_amount = record.voucher.amount
                voucher_status = self._translate_voucher_status(record.voucher.status)

            data.append({
                "案件编号": record.case_no,
                "批次号": record.batch_no or "",
                "用户ID": record.user_id,
                "充电桩编号": record.pile_no,
                "订单编号": record.order_no,
                "故障代码": record.fault_code or "",
                "故障分类": record.fault_category or "",
                "故障描述": record.description or "",
                "状态": self._translate_status(record.status),
                "处理结论": self._translate_conclusion(record.conclusion),
                "建议补偿金额": record.compensation_amount,
                "是否重复": "是" if record.is_duplicate else "否",
                "补偿券编号": voucher_no,
                "补偿券金额": voucher_amount,
                "补偿券状态": voucher_status,
                "处理人": record.operator or "",
                "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
                "确认时间": record.confirmed_at.strftime("%Y-%m-%d %H:%M:%S") if record.confirmed_at else "",
                "结案时间": record.closed_at.strftime("%Y-%m-%d %H:%M:%S") if record.closed_at else ""
            })

        df = pd.DataFrame(data)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="补偿记录")

            worksheet = writer.sheets["补偿记录"]
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width

            summary_data = self._get_summary_data_flat(records)
            summary_df = pd.DataFrame([summary_data])
            summary_df.to_excel(writer, index=False, sheet_name="统计汇总")

        return output.getvalue()

    def export_operation_logs(self, case_no: str) -> bytes:
        record = self.db.query(CompensationRecord).filter(
            CompensationRecord.case_no == case_no
        ).first()

        if not record:
            raise ValueError("记录不存在")

        logs = self.db.query(OperationLog).filter(
            OperationLog.compensation_record_id == record.id
        ).order_by(OperationLog.created_at.asc()).all()

        data = []
        for log in logs:
            data.append({
                "操作时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "操作类型": self._translate_operation(log.operation),
                "原状态": self._translate_status(log.old_status),
                "新状态": self._translate_status(log.new_status),
                "操作人": log.operator or "",
                "备注": log.remark or ""
            })

        df = pd.DataFrame(data)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="操作日志")

        return output.getvalue()

    def get_statistics(
        self,
        case_no: Optional[str] = None,
        user_id: Optional[str] = None,
        pile_no: Optional[str] = None,
        order_no: Optional[str] = None,
        status: Optional[str] = None,
        batch_no: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> dict:
        records, total = self._query_records(
            case_no=case_no,
            user_id=user_id,
            pile_no=pile_no,
            order_no=order_no,
            status=status,
            batch_no=batch_no,
            start_date=start_date,
            end_date=end_date
        )

        return self._get_summary_data(records, total)

    def _query_records(
        self,
        case_no: Optional[str] = None,
        user_id: Optional[str] = None,
        pile_no: Optional[str] = None,
        order_no: Optional[str] = None,
        status: Optional[str] = None,
        batch_no: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ):
        from app.services import CompensationService
        service = CompensationService(self.db)
        return service.query_records(
            case_no=case_no,
            user_id=user_id,
            pile_no=pile_no,
            order_no=order_no,
            status=status,
            batch_no=batch_no,
            start_date=start_date,
            end_date=end_date,
            page=1,
            page_size=10000
        )

    def _get_summary_data_flat(self, records: List[CompensationRecord]) -> dict:
        total = len(records)
        total_amount = 0
        approved_amount = 0
        pending_count = 0
        approved_count = 0
        rejected_count = 0
        closed_count = 0
        cancelled_count = 0

        for record in records:
            if record.compensation_amount:
                total_amount += record.compensation_amount
                if record.status in ["approved", "compensated", "closed"]:
                    approved_amount += record.compensation_amount

            if record.status == "pending":
                pending_count += 1
            elif record.status == "approved":
                approved_count += 1
            elif record.status == "rejected":
                rejected_count += 1
            elif record.status == "closed":
                closed_count += 1
            elif record.status == "cancelled":
                cancelled_count += 1

        return {
            "总记录数": total,
            "总补偿金额": round(total_amount, 2),
            "已批准补偿金额": round(approved_amount, 2),
            "待处理数量": pending_count,
            "已批准数量": approved_count,
            "已拒绝数量": rejected_count,
            "已结案数量": closed_count,
            "已撤回数量": cancelled_count
        }

    def _get_summary_data(self, records: List[CompensationRecord], total: Optional[int] = None) -> dict:
        total = total or len(records)

        status_counts = {}
        category_counts = {}
        total_amount = 0
        approved_amount = 0

        for record in records:
            status = self._translate_status(record.status)
            status_counts[status] = status_counts.get(status, 0) + 1

            category = record.fault_category or "未分类"
            category_counts[category] = category_counts.get(category, 0) + 1

            if record.compensation_amount:
                total_amount += record.compensation_amount
                if record.status in ["approved", "compensated", "closed"]:
                    approved_amount += record.compensation_amount

        return {
            "总记录数": total,
            "总补偿金额": round(total_amount, 2),
            "已批准补偿金额": round(approved_amount, 2),
            "状态分布": status_counts,
            "故障分类分布": category_counts
        }

    def _translate_status(self, status: Optional[str]) -> str:
        status_map = {
            "pending": "待处理",
            "verifying": "核验中",
            "approved": "已批准",
            "rejected": "已拒绝",
            "compensated": "已补偿",
            "cancelled": "已撤回",
            "closed": "已结案"
        }
        return status_map.get(status, status or "未知")

    def _translate_conclusion(self, conclusion: Optional[str]) -> str:
        conclusion_map = {
            "pile_fault": "充电桩故障",
            "user_operation": "用户操作",
            "network_issue": "网络问题",
            "system_error": "系统错误",
            "no_fault": "无故障",
            "other": "其他"
        }
        return conclusion_map.get(conclusion, conclusion or "未判定")

    def _translate_operation(self, operation: Optional[str]) -> str:
        operation_map = {
            "create": "创建",
            "resubmit": "重新提交",
            "confirm": "确认",
            "cancel": "撤回",
            "rejudge": "改判",
            "create_voucher": "创建补偿券",
            "create_voucher_failed": "创建补偿券失败",
            "use_voucher": "核销补偿券"
        }
        return operation_map.get(operation, operation or "未知")

    def _translate_voucher_status(self, status: Optional[str]) -> str:
        status_map = {
            "unused": "未使用",
            "used": "已使用",
            "expired": "已过期"
        }
        return status_map.get(status, status or "未知")
