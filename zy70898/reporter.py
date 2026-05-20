import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from models import ReconciliationResult, TransferReconciliation, VerificationStatus


class ReportGenerator:
    def generate_explanation_report(self, result: ReconciliationResult) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("                   网点尾箱对账报告")
        lines.append("=" * 80)
        lines.append(f"对账批次: {result.reconciliation_id}")
        lines.append(f"对账日期: {result.batch_date}")
        lines.append(f"生成时间: {result.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("-" * 80)
        lines.append("汇总统计")
        lines.append("-" * 80)
        s = result.summary
        lines.append(f"总记录数: {s.total_records}")
        lines.append(f"核对通过: {s.matched_records} ({s.matched_records/s.total_records*100:.1f}%)")
        lines.append(f"存在差异: {s.discrepancy_records}")
        lines.append(f"已复核: {s.reviewed_records}")
        lines.append(f"已放行: {s.approved_records}")
        lines.append(f"已退回: {s.rejected_records}")
        lines.append(f"待补件: {s.needs_more_info}")
        lines.append(f"待复核: {s.pending_review}")
        lines.append("")
        lines.append(f"现金总额: {s.total_cash_amount:,.2f} 元")
        lines.append(f"支票总额: {s.total_check_amount:,.2f} 元")
        lines.append(f"总计金额: {s.grand_total:,.2f} 元")
        lines.append("")
        if s.discrepancy_breakdown:
            lines.append("差异类型统计:")
            for dtype, count in s.discrepancy_breakdown.items():
                lines.append(f"  - {self._discrepancy_type_to_chinese(dtype)}: {count} 条")
        lines.append("")
        lines.append("-" * 80)
        lines.append("明细记录")
        lines.append("-" * 80)
        for i, record in enumerate(result.records, 1):
            lines.append(f"\n【记录 {i}】")
            lines.append(self._format_record_detail(record))
        lines.append("\n" + "=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        return "\n".join(lines)

    def _format_record_detail(self, record: TransferReconciliation) -> str:
        lines = []
        lines.append(f"  交接编号: {record.transfer_id}")
        lines.append(f"  尾箱编号: {record.box_id}")
        lines.append(f"  交接时间: {record.original_record.transfer_date} {record.original_record.transfer_time}")
        lines.append(f"  移交人: {record.original_record.sender_name} ({record.original_record.sender_id})")
        lines.append(f"  接收人: {record.original_record.receiver_name} ({record.original_record.receiver_id})")
        lines.append(f"  状态: {self._status_to_chinese(record.verification_status)}")
        if record.is_adjusted:
            lines.append(f"  现金: {record.adjusted_cash_amount:,.2f} (原: {record.original_record.cash_amount:,.2f})")
            lines.append(f"  支票: {record.adjusted_check_amount:,.2f} (原: {record.original_record.check_amount:,.2f})")
            lines.append(f"  合计: {record.adjusted_total_amount:,.2f} (原: {record.original_record.total_amount:,.2f})")
        else:
            lines.append(f"  现金: {record.original_record.cash_amount:,.2f}")
            lines.append(f"  支票: {record.original_record.check_amount:,.2f}")
            lines.append(f"  合计: {record.original_record.total_amount:,.2f}")
        if record.discrepancies:
            lines.append("  差异说明:")
            for d in record.discrepancies:
                severity_mark = "!" if d.severity == "high" else "?"
                lines.append(f"    {severity_mark} [{d.severity}] {d.description}")
        if record.review_action:
            lines.append(f"  复核结果: {self._action_to_chinese(record.review_action)}")
            lines.append(f"  复核人: {record.reviewer_name}")
            if record.review_time:
                lines.append(f"  复核时间: {record.review_time.strftime('%Y-%m-%d %H:%M:%S')}")
        if record.review_notes:
            lines.append("  复核记录:")
            for note in record.review_notes:
                lines.append(f"    > {note}")
        return "\n".join(lines)

    def export_csv(self, result: ReconciliationResult, output_path: str) -> str:
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '交接编号', '尾箱编号', '交接日期', '交接时间',
                '移交人ID', '移交人姓名', '接收人ID', '接收人姓名',
                '现金金额', '支票金额', '总金额', '是否有金额调整',
                '调整后现金', '调整后支票', '调整后合计',
                '状态', '差异数量', '是否复核', '复核结果', '复核人'
            ])
            for record in result.records:
                cash = record.adjusted_cash_amount if record.is_adjusted else record.original_record.cash_amount
                check = record.adjusted_check_amount if record.is_adjusted else record.original_record.check_amount
                total = cash + check
                writer.writerow([
                    record.transfer_id,
                    record.box_id,
                    record.original_record.transfer_date,
                    record.original_record.transfer_time,
                    record.original_record.sender_id,
                    record.original_record.sender_name,
                    record.original_record.receiver_id,
                    record.original_record.receiver_name,
                    f"{record.original_record.cash_amount:.2f}",
                    f"{record.original_record.check_amount:.2f}",
                    f"{record.original_record.total_amount:.2f}",
                    '是' if record.is_adjusted else '否',
                    f"{cash:.2f}" if record.is_adjusted else '',
                    f"{check:.2f}" if record.is_adjusted else '',
                    f"{total:.2f}" if record.is_adjusted else '',
                    self._status_to_chinese(record.verification_status),
                    len(record.discrepancies),
                    '是' if record.review_action else '否',
                    self._action_to_chinese(record.review_action) if record.review_action else '',
                    record.reviewer_name or ''
                ])
        return output_path

    def export_json(self, result: ReconciliationResult, output_path: str) -> str:
        data = {
            "reconciliation_id": result.reconciliation_id,
            "batch_date": result.batch_date,
            "created_at": result.created_at.isoformat(),
            "summary": {
                "total_records": result.summary.total_records,
                "matched_records": result.summary.matched_records,
                "discrepancy_records": result.summary.discrepancy_records,
                "pending_review": result.summary.pending_review,
                "reviewed_records": result.summary.reviewed_records,
                "approved_records": result.summary.approved_records,
                "rejected_records": result.summary.rejected_records,
                "needs_more_info": result.summary.needs_more_info,
                "total_cash_amount": result.summary.total_cash_amount,
                "total_check_amount": result.summary.total_check_amount,
                "grand_total": result.summary.grand_total,
                "discrepancy_breakdown": result.summary.discrepancy_breakdown
            },
            "records": []
        }
        for record in result.records:
            rec_data = {
                "transfer_id": record.transfer_id,
                "box_id": record.box_id,
                "verification_status": record.verification_status.value,
                "original_record": record.original_record.model_dump(),
                "discrepancies": [d.model_dump() for d in record.discrepancies],
                "review_notes": record.review_notes,
                "is_adjusted": record.is_adjusted
            }
            if record.is_adjusted:
                rec_data.update({
                    "adjusted_cash_amount": record.adjusted_cash_amount,
                    "adjusted_check_amount": record.adjusted_check_amount,
                    "adjusted_total_amount": record.adjusted_total_amount
                })
            if record.review_action:
                rec_data.update({
                    "review_action": record.review_action.value,
                    "reviewer_id": record.reviewer_id,
                    "reviewer_name": record.reviewer_name,
                    "review_time": record.review_time.isoformat() if record.review_time else None
                })
            data["records"].append(rec_data)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return output_path

    def _status_to_chinese(self, status: VerificationStatus) -> str:
        if not status:
            return ""
        mapping = {
            VerificationStatus.PENDING: "待处理",
            VerificationStatus.MATCHED: "核对通过",
            VerificationStatus.DISCREPANCY: "存在差异",
            VerificationStatus.REVIEWED: "已复核",
            VerificationStatus.APPROVED: "已放行",
            VerificationStatus.REJECTED: "已退回",
            VerificationStatus.NEEDS_MORE_INFO: "待补件"
        }
        return mapping.get(status, status.value)

    def _action_to_chinese(self, action) -> str:
        from models import ReviewAction
        if not action:
            return ""
        mapping = {
            ReviewAction.APPROVE: "放行",
            ReviewAction.REJECT: "退回",
            ReviewAction.REQUEST_MORE_INFO: "补件",
            ReviewAction.RECALCULATE: "重新计算"
        }
        return mapping.get(action, action.value if action else "")

    def _discrepancy_type_to_chinese(self, dtype: str) -> str:
        mapping = {
            "amount_mismatch": "金额不平",
            "missing_double_sign": "缺少双签",
            "cross_day_transfer": "跨日交接",
            "missing_teller": "柜员缺失",
            "duplicate_record": "交接频繁",
            "error_mismatch": "差错未闭环"
        }
        return mapping.get(dtype, dtype)
