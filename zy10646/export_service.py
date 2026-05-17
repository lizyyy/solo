from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime
from typing import List, Optional
import csv
from io import StringIO
from database import ExceptionRequest, ExceptionStatus, ExceptionType
from schemas import ExportRow


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _format_datetime(self, dt: Optional[datetime]) -> str:
        if not dt:
            return ""
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def _get_policy_breach_description(self, exception: ExceptionRequest, policy_type: str) -> str:
        if policy_type == "hotel" and exception.hotel_policy and exception.hotel_actual_rate:
            policy = exception.hotel_policy
            if policy.max_hotel_rate:
                return f"超出标准 ¥{policy.max_hotel_rate}，实际 ¥{exception.hotel_actual_rate} (超出 {(exception.hotel_actual_rate - policy.max_hotel_rate) / policy.max_hotel_rate * 100:.1f}%)"
        elif policy_type == "flight" and exception.flight_policy and exception.flight_actual_discount:
            policy = exception.flight_policy
            if policy.max_flight_discount:
                return f"折扣低于标准 {policy.max_flight_discount}%，实际 {exception.flight_actual_discount}%"
        return ""

    def export_exceptions(self, status: Optional[ExceptionStatus] = None, 
                          start_date: Optional[datetime] = None,
                          end_date: Optional[datetime] = None) -> List[ExportRow]:
        query = self.db.query(ExceptionRequest)
        
        if status:
            query = query.filter(ExceptionRequest.status == status)
        if start_date:
            query = query.filter(ExceptionRequest.created_at >= start_date)
        if end_date:
            query = query.filter(ExceptionRequest.created_at <= end_date)

        exceptions = query.order_by(ExceptionRequest.created_at.desc()).all()
        
        rows: List[ExportRow] = []
        for ex in exceptions:
            hotel_breach = self._get_policy_breach_description(ex, "hotel") if ex.exception_type in [ExceptionType.HOTEL, ExceptionType.BOTH] else None
            flight_breach = self._get_policy_breach_description(ex, "flight") if ex.exception_type in [ExceptionType.FLIGHT, ExceptionType.BOTH] else None
            
            final_decision = ""
            if ex.status == ExceptionStatus.APPROVED:
                final_decision = "已通过"
            elif ex.status == ExceptionStatus.REJECTED:
                final_decision = "已拒绝"
            
            rows.append(ExportRow(
                request_id=ex.id,
                trip_id=ex.trip_id,
                employee_id=ex.employee_id,
                employee_name=ex.employee.name if ex.employee else "",
                department=ex.employee.department if ex.employee else "",
                destination=ex.destination.city_name if ex.destination else "",
                exception_type={
                    ExceptionType.HOTEL: "住宿例外",
                    ExceptionType.FLIGHT: "机票例外",
                    ExceptionType.BOTH: "住宿+机票例外"
                }[ex.exception_type],
                status={
                    ExceptionStatus.PENDING_APPROVAL: "待审批",
                    ExceptionStatus.EXCEPTION_REVIEW: "例外审核",
                    ExceptionStatus.APPROVED: "已通过",
                    ExceptionStatus.REJECTED: "已拒绝"
                }[ex.status],
                hotel_policy_breach=hotel_breach,
                hotel_justification=ex.hotel_justification or ex.combined_justification,
                flight_policy_breach=flight_breach,
                flight_justification=ex.flight_justification or ex.combined_justification,
                submitted_at=self._format_datetime(ex.submitted_at),
                approved_at=self._format_datetime(ex.approved_at or ex.rejected_at),
                final_decision=final_decision
            ))
        
        return rows

    def export_to_csv(self, status: Optional[ExceptionStatus] = None,
                      start_date: Optional[datetime] = None,
                      end_date: Optional[datetime] = None) -> str:
        rows = self.export_exceptions(status, start_date, end_date)
        
        output = StringIO()
        writer = csv.writer(output)
        
        headers = [
            "申请ID", "出差单ID", "员工ID", "员工姓名", "部门", "目的地",
            "例外类型", "当前状态", "住宿政策违规", "住宿理由",
            "机票政策违规", "机票理由", "提交时间", "审核时间", "最终结论"
        ]
        writer.writerow(headers)
        
        for row in rows:
            writer.writerow([
                row.request_id, row.trip_id, row.employee_id, row.employee_name,
                row.department, row.destination, row.exception_type, row.status,
                row.hotel_policy_breach or "", row.hotel_justification or "",
                row.flight_policy_breach or "", row.flight_justification or "",
                row.submitted_at or "", row.approved_at or "", row.final_decision or ""
            ])
        
        return output.getvalue()