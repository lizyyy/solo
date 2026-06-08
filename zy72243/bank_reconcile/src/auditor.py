from datetime import datetime
import json
from .database import load_config, get_session
from .models import ClearingBatch, TransactionRecord, AuditTrail, HolidayAdjustment


class AuditManager:
    def __init__(self):
        self.session = get_session()
        config = load_config()
        self.roles = config["roles"]
        self.audit_reasons = config["audit_reasons"]

    def generate_audit_report(self, batch_no, format="text"):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if not batch:
            return None

        transactions = self.session.query(TransactionRecord).filter_by(batch_id=batch.id).all()
        audits = self.session.query(AuditTrail).filter_by(batch_id=batch.id).all()
        holiday_notes = self.session.query(HolidayAdjustment).filter_by(batch_id=batch.id).all()

        report_data = {
            "batch_no": batch_no,
            "import_date": batch.import_date.strftime("%Y-%m-%d %H:%M:%S") if batch.import_date else "",
            "source_file": batch.source_file,
            "status": batch.status,
            "total_records": batch.total_records,
            "mixed_currency_count": batch.mixed_currency_count,
            "holiday_notes": [self._format_holiday(h) for h in holiday_notes],
            "transactions": [],
            "summary": self._generate_summary(transactions, audits)
        }

        for txn in transactions:
            txn_audits = [a for a in audits if a.transaction_id == txn.id]
            batch_level_audits = [a for a in audits if a.transaction_id is None]
            report_data["transactions"].append(self._format_transaction(txn, txn_audits, batch_level_audits))

        if format == "json":
            return json.dumps(report_data, ensure_ascii=False, indent=2)
        elif format == "html":
            return self._format_html_report(report_data)
        else:
            return self._format_text_report(report_data)

    def _format_transaction(self, txn, audits, batch_level_audits=None):
        has_mixed = txn.has_mixed_currency
        mixed_audits = [a for a in audits if a.audit_type == "mixed_currency"]
        holiday_audits = [a for a in (batch_level_audits or []) if a.audit_type == "missing_holiday_note"]
        all_audits = list(audits) + list(batch_level_audits or [])

        return {
            "transaction_no": txn.transaction_no,
            "transaction_date": txn.transaction_date.strftime("%Y-%m-%d") if txn.transaction_date else "",
            "summary": txn.summary,
            "amount_column_raw": txn.amount_column_raw,
            "amount": txn.amount,
            "currency": txn.currency,
            "has_mixed_currency": has_mixed,
            "detected_currencies": txn.detected_currencies,
            "counterparty": txn.counterparty,
            "is_reviewed": txn.is_reviewed,
            "reviewed_by": txn.reviewed_by,
            "review_note": txn.review_note,
            "audit_details": {
                "mixed_currency": self._format_audit_detail(mixed_audits[0]) if mixed_audits else None,
                "holiday_note": self._format_audit_detail(holiday_audits[0]) if holiday_audits else None
            },
            "why_kept": self._explain_why_kept(txn, all_audits),
            "missing_materials": self._get_missing_materials(txn, all_audits),
            "next_action": self._get_next_action(txn, all_audits),
            "responsible_party": self._get_responsible_party(txn, all_audits)
        }

    def _format_audit_detail(self, audit):
        return {
            "status": audit.status,
            "reason": audit.reason,
            "missing_materials": audit.missing_materials,
            "next_action": audit.next_action,
            "responsible_party": audit.responsible_party,
            "is_resolved": audit.is_resolved,
            "resolved_note": audit.resolved_note
        }

    def _explain_why_kept(self, txn, audits):
        reasons = []

        if txn.has_mixed_currency:
            mixed_audit = next((a for a in audits if a.audit_type == "mixed_currency"), None)
            if mixed_audit and not mixed_audit.is_resolved:
                reasons.append(
                    f"金额列包含港币和人民币符号（{txn.detected_currencies}），"
                    f"需要{self.roles['custodian']}复核确认后才能归并"
                )

        if txn.has_mixed_currency and not txn.is_reviewed:
            reasons.append("此笔交易尚未完成复核流程")

        pending_audits = [a for a in audits if not a.is_resolved]
        if pending_audits:
            for audit in pending_audits:
                if audit.audit_type == "missing_holiday_note":
                    reasons.append("缺少节假日顺延说明")

        if not reasons:
            reasons.append("已完成全部复核，可正常归并")

        return "；".join(reasons)

    def _get_missing_materials(self, txn, audits):
        missing = []
        for audit in audits:
            if not audit.is_resolved and audit.missing_materials:
                missing.append(audit.missing_materials)
        return "；".join(missing) if missing else "无"

    def _get_next_action(self, txn, audits):
        actions = []
        for audit in audits:
            if not audit.is_resolved and audit.next_action:
                actions.append(audit.next_action)
        return "；".join(actions) if actions else "已完成全部流程"

    def _get_responsible_party(self, txn, audits):
        parties = set()
        for audit in audits:
            if not audit.is_resolved and audit.responsible_party:
                parties.add(audit.responsible_party)
        return "、".join(parties) if parties else "无"

    def _generate_summary(self, transactions, audits):
        total = len(transactions)
        mixed_count = sum(1 for t in transactions if t.has_mixed_currency)
        reviewed_count = sum(1 for t in transactions if t.is_reviewed)
        pending_audits = sum(1 for a in audits if not a.is_resolved)
        resolved_audits = sum(1 for a in audits if a.is_resolved)

        return {
            "total_transactions": total,
            "mixed_currency_count": mixed_count,
            "reviewed_count": reviewed_count,
            "pending_review_count": total - reviewed_count,
            "pending_audits": pending_audits,
            "resolved_audits": resolved_audits,
            "can_finalize": pending_audits == 0 and mixed_count == 0
        }

    def _format_holiday(self, holiday):
        return {
            "original_date": holiday.original_date.strftime("%Y-%m-%d") if holiday.original_date else "",
            "adjusted_date": holiday.adjusted_date.strftime("%Y-%m-%d") if holiday.adjusted_date else "",
            "reason": holiday.reason,
            "operator_note": holiday.operator_note,
            "applied_by": holiday.applied_by
        }

    def _format_text_report(self, data):
        lines = []
        lines.append("=" * 80)
        lines.append("银行流水摘要归并审计报告")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"清算批次号: {data['batch_no']}")
        lines.append(f"导入时间: {data['import_date']}")
        lines.append(f"来源文件: {data['source_file']}")
        lines.append(f"当前状态: {data['status']}")
        lines.append(f"总记录数: {data['total_records']}")
        lines.append(f"港币人民币同列数: {data['mixed_currency_count']}")
        lines.append("")

        if data["holiday_notes"]:
            lines.append("-" * 80)
            lines.append("节假日顺延说明")
            lines.append("-" * 80)
            for h in data["holiday_notes"]:
                lines.append(f"  原日期: {h['original_date']} → 调整后: {h['adjusted_date']}")
                lines.append(f"  原因: {h['reason']}")
                lines.append(f"  操作人: {h['applied_by']}")
                if h["operator_note"]:
                    lines.append(f"  备注: {h['operator_note']}")
                lines.append("")

        lines.append("-" * 80)
        lines.append("交易明细与审计说明")
        lines.append("-" * 80)
        lines.append("")

        for idx, txn in enumerate(data["transactions"], 1):
            flag = "⚠️ " if txn["has_mixed_currency"] else "✓ "
            lines.append(f"{flag}【{idx}】流水号: {txn['transaction_no']}")
            lines.append(f"    日期: {txn['transaction_date']}")
            lines.append(f"    摘要: {txn['summary']}")
            lines.append(f"    金额列原始内容: {txn['amount_column_raw']}")

            if txn["has_mixed_currency"]:
                lines.append(f"    🔴 检测到币种混合: {txn['detected_currencies']}")

            lines.append(f"    为什么被留下: {txn['why_kept']}")
            lines.append(f"    还缺什么材料: {txn['missing_materials']}")
            lines.append(f"    下一步该找谁: {txn['next_action']}")
            lines.append(f"    责任人: {txn['responsible_party']}")

            if txn["is_reviewed"]:
                lines.append(f"    复核人: {txn['reviewed_by']}")
                if txn["review_note"]:
                    lines.append(f"    复核意见: {txn['review_note']}")

            lines.append("")

        lines.append("-" * 80)
        lines.append("汇总统计")
        lines.append("-" * 80)
        s = data["summary"]
        lines.append(f"  总交易数: {s['total_transactions']}")
        lines.append(f"  币种混合数: {s['mixed_currency_count']}")
        lines.append(f"  已复核数: {s['reviewed_count']}")
        lines.append(f"  待复核数: {s['pending_review_count']}")
        lines.append(f"  待处理审计项: {s['pending_audits']}")
        lines.append(f"  已完成审计项: {s['resolved_audits']}")
        lines.append(f"  是否可完成归并: {'是' if s['can_finalize'] else '否'}")
        lines.append("")
        lines.append("=" * 80)

        return "\n".join(lines)

    def _format_html_report(self, data):
        html = []
        html.append("<!DOCTYPE html>")
        html.append("<html><head><meta charset='utf-8'>")
        html.append("<title>银行流水摘要归并审计报告</title>")
        html.append("<style>")
        html.append("body { font-family: 'Microsoft YaHei', sans-serif; margin: 20px; }")
        html.append("h1 { color: #333; }")
        html.append(".header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }")
        html.append(".transaction { border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; }")
        html.append(".mixed { border-left: 4px solid #e74c3c; background: #fff5f5; }")
        html.append(".normal { border-left: 4px solid #27ae60; background: #f5fff5; }")
        html.append(".pending { background: #fff9e6; }")
        html.append(".label { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; margin-right: 5px; }")
        html.append(".label-danger { background: #e74c3c; color: white; }")
        html.append(".label-warning { background: #f39c12; color: white; }")
        html.append(".label-success { background: #27ae60; color: white; }")
        html.append("table { width: 100%; border-collapse: collapse; margin-top: 15px; }")
        html.append("td, th { padding: 8px; border: 1px solid #ddd; text-align: left; }")
        html.append("th { background: #f5f5f5; }")
        html.append("</style></head><body>")
        html.append("<h1>银行流水摘要归并审计报告</h1>")

        html.append("<div class='header'>")
        html.append(f"<p><strong>清算批次号:</strong> {data['batch_no']}</p>")
        html.append(f"<p><strong>导入时间:</strong> {data['import_date']}</p>")
        html.append(f"<p><strong>来源文件:</strong> {data['source_file']}</p>")
        html.append("</div>")

        if data["holiday_notes"]:
            html.append("<h2>节假日顺延说明</h2>")
            html.append("<table><tr><th>原日期</th><th>调整后</th><th>原因</th><th>操作人</th><th>备注</th></tr>")
            for h in data["holiday_notes"]:
                html.append(f"<tr><td>{h['original_date']}</td><td>{h['adjusted_date']}</td>")
                html.append(f"<td>{h['reason']}</td><td>{h['applied_by']}</td><td>{h['operator_note']}</td></tr>")
            html.append("</table>")

        html.append("<h2>交易明细与审计说明</h2>")

        for idx, txn in enumerate(data["transactions"], 1):
            txn_class = "mixed" if txn["has_mixed_currency"] else "normal"
            html.append(f"<div class='transaction {txn_class}'>")
            html.append(f"<h3>【{idx}】流水号: {txn['transaction_no']}")
            if txn["has_mixed_currency"]:
                html.append(" <span class='label label-danger'>币种混合</span>")
            if not txn["is_reviewed"]:
                html.append(" <span class='label label-warning'>待复核</span>")
            html.append("</h3>")
            html.append(f"<p><strong>日期:</strong> {txn['transaction_date']}</p>")
            html.append(f"<p><strong>摘要:</strong> {txn['summary']}</p>")
            html.append(f"<p><strong>金额列原始内容:</strong> <code>{txn['amount_column_raw']}</code></p>")

            html.append("<table>")
            html.append(f"<tr><td style='width:120px'>为什么被留下</td><td>{txn['why_kept']}</td></tr>")
            html.append(f"<tr><td>还缺什么材料</td><td>{txn['missing_materials']}</td></tr>")
            html.append(f"<tr><td>下一步该找谁</td><td>{txn['next_action']}</td></tr>")
            html.append(f"<tr><td>责任人</td><td>{txn['responsible_party']}</td></tr>")
            if txn["is_reviewed"]:
                html.append(f"<tr><td>复核人</td><td>{txn['reviewed_by']}</td></tr>")
                if txn["review_note"]:
                    html.append(f"<tr><td>复核意见</td><td>{txn['review_note']}</td></tr>")
            html.append("</table>")
            html.append("</div>")

        html.append("<h2>汇总统计</h2>")
        s = data["summary"]
        html.append("<table>")
        html.append(f"<tr><td>总交易数</td><td>{s['total_transactions']}</td></tr>")
        html.append(f"<tr><td>币种混合数</td><td>{s['mixed_currency_count']}</td></tr>")
        html.append(f"<tr><td>已复核数</td><td>{s['reviewed_count']}</td></tr>")
        html.append(f"<tr><td>待复核数</td><td>{s['pending_review_count']}</td></tr>")
        html.append(f"<tr><td>待处理审计项</td><td>{s['pending_audits']}</td></tr>")
        html.append(f"<tr><td>已完成审计项</td><td>{s['resolved_audits']}</td></tr>")
        finalize = "是" if s['can_finalize'] else "否"
        html.append(f"<tr><td><strong>是否可完成归并</strong></td><td><strong>{finalize}</strong></td></tr>")
        html.append("</table>")

        html.append("</body></html>")
        return "\n".join(html)

    def get_audit_trails(self, batch_no=None, transaction_id=None, is_resolved=None):
        query = self.session.query(AuditTrail)

        if batch_no:
            batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
            if batch:
                query = query.filter(AuditTrail.batch_id == batch.id)

        if transaction_id:
            query = query.filter(AuditTrail.transaction_id == transaction_id)

        if is_resolved is not None:
            query = query.filter(AuditTrail.is_resolved == is_resolved)

        audits = query.order_by(AuditTrail.created_at.desc()).all()
        return [self._audit_to_dict(a) for a in audits]

    def _audit_to_dict(self, audit):
        return {
            "id": audit.id,
            "batch_id": audit.batch_id,
            "transaction_id": audit.transaction_id,
            "audit_type": audit.audit_type,
            "status": audit.status,
            "reason": audit.reason,
            "missing_materials": audit.missing_materials,
            "next_action": audit.next_action,
            "responsible_party": audit.responsible_party,
            "is_resolved": audit.is_resolved,
            "created_at": audit.created_at.strftime("%Y-%m-%d %H:%M:%S") if audit.created_at else None
        }

    def refresh_audits(self, batch_no):
        batch = self.session.query(ClearingBatch).filter_by(batch_no=batch_no).first()
        if not batch:
            return None

        holiday_notes = self.session.query(HolidayAdjustment).filter_by(batch_id=batch.id).all()
        has_holiday = len(holiday_notes) > 0

        if has_holiday:
            audits = self.session.query(AuditTrail).filter(
                AuditTrail.batch_id == batch.id,
                AuditTrail.audit_type == "missing_holiday_note",
                AuditTrail.is_resolved == False
            ).all()

            for audit in audits:
                audit.status = "reviewed"
                audit.is_resolved = True
                audit.resolved_at = datetime.now()
                audit.resolved_note = f"已补录节假日顺延说明，共{len(holiday_notes)}条"
                audit.next_action = "已完成"
                audit.reason = "节假日顺延说明已补录"
                audit.missing_materials = ""

        self.session.commit()
        return {"updated": len(holiday_notes) > 0}
