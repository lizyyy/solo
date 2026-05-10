import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import ReplayReport, ReplayRequest, ReplayExecution, MessageMetadata


class ReportService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def close(self):
        if self.db:
            self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def get_report_detail(self, report_id: str) -> Optional[Dict[str, Any]]:
        report = (
            self.db.query(ReplayReport)
            .filter(ReplayReport.report_id == report_id)
            .first()
        )
        if not report:
            return None

        request = (
            self.db.query(ReplayRequest)
            .filter(ReplayRequest.request_id == report.request_id)
            .first()
        )

        executions = (
            self.db.query(ReplayExecution)
            .filter(ReplayExecution.request_id == report.request_id)
            .order_by(ReplayExecution.execution_order)
            .all()
        )

        execution_details = []
        for exec_item in executions:
            message = (
                self.db.query(MessageMetadata)
                .filter(MessageMetadata.message_id == exec_item.message_id)
                .first()
            )
            execution_details.append(
                {
                    "execution_id": exec_item.execution_id,
                    "message_id": exec_item.message_id,
                    "status": exec_item.status,
                    "execution_order": exec_item.execution_order,
                    "duration_ms": exec_item.duration_ms,
                    "error_message": exec_item.error_message,
                    "start_time": exec_item.start_time.isoformat()
                    if exec_item.start_time
                    else None,
                    "end_time": exec_item.end_time.isoformat() if exec_item.end_time else None,
                    "message_detail": {
                        "topic": message.topic if message else None,
                        "partition": message.partition if message else None,
                        "offset": message.offset if message else None,
                        "business_key": message.business_key if message else None,
                        "business_type": message.business_type if message else None,
                        "business_id": message.business_id if message else None,
                        "amount": message.amount if message else None,
                        "quantity": message.quantity if message else None,
                        "quota": message.quota if message else None,
                    }
                    if message
                    else None,
                }
            )

        return {
            "report_id": report.report_id,
            "request_id": report.request_id,
            "request_detail": {
                "requester": request.requester if request else None,
                "reason": request.reason if request else None,
                "scope_type": request.scope_type if request else None,
                "scope_value": request.scope_value if request else None,
                "target_environment": request.target_environment if request else None,
                "approver": request.approver if request else None,
            }
            if request
            else None,
            "summary": {
                "total_messages": report.total_messages,
                "success_count": report.success_count,
                "failed_count": report.failed_count,
                "skipped_count": report.skipped_count,
                "total_amount": report.total_amount,
                "total_quantity": report.total_quantity,
                "total_quota": report.total_quota,
                "total_duration_ms": report.total_duration_ms,
                "executor": report.executor,
                "summary_text": report.summary,
            },
            "success_rate": (
                100.0
                * report.success_count
                / (report.success_count + report.failed_count)
                if (report.success_count + report.failed_count) > 0
                else 0.0
            ),
            "execution_details": execution_details,
            "created_at": report.created_at.isoformat(),
        }

    def list_reports(
        self,
        requester: Optional[str] = None,
        executor: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        query = self.db.query(ReplayReport)

        if executor:
            query = query.filter(ReplayReport.executor == executor)

        if start_date:
            query = query.filter(ReplayReport.created_at >= start_date)
        if end_date:
            query = query.filter(ReplayReport.created_at <= end_date)

        if requester:
            query = query.join(ReplayRequest).filter(ReplayRequest.requester == requester)

        reports = query.order_by(ReplayReport.created_at.desc()).limit(limit).all()

        result = []
        for report in reports:
            success_rate = (
                100.0
                * report.success_count
                / (report.success_count + report.failed_count)
                if (report.success_count + report.failed_count) > 0
                else 0.0
            )

            status = "全部成功" if report.failed_count == 0 and report.success_count > 0 else (
                "存在失败" if report.failed_count > 0 else "无实际执行"
            )

            result.append(
                {
                    "report_id": report.report_id,
                    "request_id": report.request_id,
                    "status": status,
                    "total_messages": report.total_messages,
                    "success_count": report.success_count,
                    "failed_count": report.failed_count,
                    "skipped_count": report.skipped_count,
                    "total_amount": report.total_amount,
                    "success_rate": round(success_rate, 2),
                    "executor": report.executor,
                    "created_at": report.created_at.isoformat(),
                }
            )

        return result

    def export_report_json(self, report_id: str, output_path: str) -> str:
        report_data = self.get_report_detail(report_id)
        if not report_data:
            raise ValueError(f"找不到报告: {report_id}")

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return str(output_file.absolute())

    def export_report_csv(self, report_id: str, output_path: str) -> str:
        report_data = self.get_report_detail(report_id)
        if not report_data:
            raise ValueError(f"找不到报告: {report_id}")

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["重放报告导出"])
            writer.writerow(["报告ID", report_data["report_id"]])
            writer.writerow(["请求ID", report_data["request_id"]])
            writer.writerow(["执行人", report_data["summary"]["executor"]])
            writer.writerow(["创建时间", report_data["created_at"]])
            writer.writerow([])

            writer.writerow(["汇总信息"])
            summary = report_data["summary"]
            writer.writerow(["总消息数", summary["total_messages"]])
            writer.writerow(["成功数", summary["success_count"]])
            writer.writerow(["失败数", summary["failed_count"]])
            writer.writerow(["跳过数", summary["skipped_count"]])
            writer.writerow(["总金额", summary["total_amount"]])
            writer.writerow(["总数量", summary["total_quantity"]])
            writer.writerow(["总名额", summary["total_quota"]])
            writer.writerow(["总耗时(ms)", summary["total_duration_ms"]])
            writer.writerow(["执行摘要", summary["summary_text"]])
            writer.writerow([])

            writer.writerow(
                [
                    "执行序号",
                    "执行ID",
                    "消息ID",
                    "业务主键",
                    "业务类型",
                    "业务ID",
                    "金额",
                    "数量",
                    "名额",
                    "状态",
                    "耗时(ms)",
                    "错误信息",
                ]
            )

            for exec_item in report_data["execution_details"]:
                msg = exec_item.get("message_detail", {}) or {}
                writer.writerow(
                    [
                        exec_item["execution_order"],
                        exec_item["execution_id"],
                        exec_item["message_id"],
                        msg.get("business_key", ""),
                        msg.get("business_type", ""),
                        msg.get("business_id", ""),
                        msg.get("amount", ""),
                        msg.get("quantity", ""),
                        msg.get("quota", ""),
                        exec_item["status"],
                        exec_item.get("duration_ms", ""),
                        exec_item.get("error_message", ""),
                    ]
                )

        return str(output_file.absolute())
