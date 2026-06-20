import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from ..models.ticket import Ticket, TicketField
from ..models.export import ExportRecord, ExportField, ExportStatus
from ..models.rule import RuleStatus
from ..storage.store import DataStore
from ..utils.mask import mask_phone, mask_id_card, mask_bank_card, mask_email, mask_text


@dataclass
class ExportOutput:
    export_id: str
    ticket_id: str
    json_path: str
    report_path: str
    summary_path: str
    generated_at: str
    has_leaks: bool
    leak_count: int


class ExportManager:
    def __init__(self, store: DataStore, output_dir: str = "output"):
        self.store = store
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_export(self, ticket_id: str, generated_by: str = "system") -> ExportOutput:
        ticket = self.store.load_ticket(ticket_id)
        if not ticket:
            raise ValueError(f"工单 {ticket_id} 不存在")

        export_id = f"EXPORT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

        export_fields = self._build_export_fields(ticket)

        export = ExportRecord(
            export_id=export_id,
            ticket_id=ticket_id,
            generated_at=datetime.now(),
            generated_by=generated_by,
            fields=export_fields,
            status=ExportStatus.GENERATED,
        )

        leak_fields = export.get_leaking_fields()
        export.summary = {
            "total_fields": len(export_fields),
            "masked_fields": sum(1 for f in export_fields if f.is_masked),
            "leak_fields": len(leak_fields),
            "needs_algorithm": len(export.get_fields_needing_algorithm()),
            "needs_operation": len(export.get_fields_needing_operation()),
            "ticket_status": ticket.status.value,
        }

        self.store.save_export(export)

        json_path = self._write_json(export, ticket)
        report_path = self._write_report(export, ticket)
        summary_path = self._write_summary(export, ticket)

        export.output_paths = {
            "json": json_path,
            "report": report_path,
            "summary": summary_path,
        }
        self.store.save_export(export)

        ticket.export_history.append(export_id)
        self.store.save_ticket(ticket)

        return ExportOutput(
            export_id=export_id,
            ticket_id=ticket_id,
            json_path=json_path,
            report_path=report_path,
            summary_path=summary_path,
            generated_at=export.generated_at.isoformat(),
            has_leaks=export.has_leaks(),
            leak_count=len(leak_fields),
        )

    def _build_export_fields(self, ticket: Ticket) -> List[ExportField]:
        active_rules = self.store.list_rules(status=RuleStatus.ACTIVE)
        export_fields = []

        for field in ticket.fields:
            masked_value = self._apply_mask(field, active_rules, ticket)
            value_changed = masked_value != field.field_value
            is_masked = field.is_masked or value_changed

            has_human_note = self._has_human_review_note(field.field_name, ticket)
            has_algo_note = self._has_algorithm_review_note(field.field_name, ticket)
            is_low_confidence = (
                field.ocr_confidence is not None and field.ocr_confidence < 0.7
            )

            explanation, next_step, responsible = self._build_field_explanation(
                field, is_masked, masked_value, has_human_note, has_algo_note, is_low_confidence
            )

            leak_risk = "none"
            if field.leak_detected:
                if is_low_confidence and not has_algo_note:
                    leak_risk = "high"
                elif not has_human_note:
                    leak_risk = "high"
                else:
                    leak_risk = "none"
            elif not is_masked and field.field_value and self._has_sensitive(field.field_value):
                leak_risk = "medium"

            export_field = ExportField(
                field_name=field.field_name,
                original_value=field.field_value,
                masked_value=masked_value,
                is_masked=is_masked,
                mask_rule_applied=self._find_applicable_rule(field, active_rules),
                leak_risk=leak_risk,
                explanation=explanation,
                next_step=next_step,
                responsible_role=responsible,
            )
            export_fields.append(export_field)

        return export_fields

    def _has_human_review_note(self, field_name: str, ticket: Ticket) -> bool:
        for note in ticket.rule_notes:
            if note.get("field_name") == field_name:
                return True
        for note in ticket.algorithm_notes:
            if note.get("field_name") == field_name:
                return True
        return False

    def _has_algorithm_review_note(self, field_name: str, ticket: Ticket) -> bool:
        for note in ticket.algorithm_notes:
            if note.get("field_name") == field_name:
                return True
        return False

    def _apply_mask(self, field: TicketField, rules: List, ticket: Ticket) -> str:
        value = field.field_value
        if not value:
            return value

        if field.is_masked and field.mask_pattern:
            return field.mask_pattern

        if field.leak_detected:
            return mask_text(value)

        for rule in rules:
            if rule.field_restriction and field.field_name in rule.field_restriction:
                return mask_text(value)

        return value

    def _has_sensitive(self, text: str) -> bool:
        from ..utils.mask import has_sensitive_data
        has, _ = has_sensitive_data(text)
        return has

    def _find_applicable_rule(self, field: TicketField, rules: List) -> Optional[str]:
        for rule in rules:
            if rule.field_restriction and field.field_name in rule.field_restriction:
                return rule.rule_name
        return None

    def _determine_missing_materials(self, field: TicketField, has_human_note: bool, has_algo_note: bool, is_low_confidence: bool) -> List[str]:
        if not field.leak_detected:
            return []
        if is_low_confidence and has_algo_note and has_human_note:
            return []
        if not is_low_confidence and has_human_note:
            return []
        missing = []
        if is_low_confidence and not has_algo_note:
            missing.append("算法同事OCR识别结果二次校验")
            missing.append("OCR模型参数调整建议或确认")
        if not has_human_note:
            if not field.mask_pattern:
                missing.append("脱敏规则配置（字段级pattern）")
            missing.append("运营/算法补充的复核备注")
        if field.missing_materials:
            for m in field.missing_materials:
                if m not in missing:
                    missing.append(m)
        return missing

    def _build_field_explanation(self, field: TicketField, is_masked: bool, masked_value: str, has_human_note: bool, has_algo_note: bool, is_low_confidence: bool):
        missing = self._determine_missing_materials(field, has_human_note, has_algo_note, is_low_confidence)

        if field.leak_detected:
            if is_low_confidence:
                if has_algo_note and has_human_note:
                    explanation = (
                        f"该字段OCR置信度较低({field.ocr_confidence:.2f})，"
                        f"已由算法同事复核确认，运营也已补充脱敏规则，脱敏已生效"
                    )
                    next_step = "已完成算法+运营双重复核，可确认导出"
                    responsible = ""
                elif has_algo_note and not has_human_note:
                    explanation = (
                        f"该字段OCR置信度较低({field.ocr_confidence:.2f})，算法同事已复核，"
                        f"但运营尚未补充脱敏规则备注"
                    )
                    if missing:
                        explanation += f" 还缺: {', '.join(missing)}"
                    next_step = "请运营老唐补充脱敏规则备注，确认后再导出"
                    responsible = "operation"
                else:
                    explanation = (
                        f"该字段检测到敏感数据且OCR置信度较低({field.ocr_confidence:.2f})，"
                        f"识别结果可能存在偏差。{field.leak_note or '需确认识别准确性。'}"
                    )
                    if missing:
                        explanation += f" 还缺: {', '.join(missing)}"
                    next_step = "留给算法同事复核OCR识别准确性，确认后再进行脱敏处理"
                    responsible = "algorithm"
            else:
                if has_human_note:
                    explanation = "该字段检测到敏感数据泄露风险，已由人工复核并标记处理"
                    if is_masked:
                        explanation += "，脱敏已生效"
                    next_step = "已完成复核处理，可确认导出"
                    responsible = ""
                else:
                    explanation = (
                        f"该字段检测到敏感数据但未完成复核。{field.leak_note or '检测到手机号等敏感信息。'}"
                    )
                    if missing:
                        explanation += f" 还缺: {', '.join(missing)}"
                    next_step = "请运营老唐补充脱敏规则备注，确认后再导出"
                    responsible = "operation"
        else:
            if is_masked:
                explanation = "该字段按脱敏规则配置已自动遮蔽"
                next_step = "无需额外操作"
                responsible = ""
            else:
                if self._has_sensitive(field.field_value):
                    explanation = "该字段可能包含敏感数据但未配置脱敏规则"
                    next_step = "建议运营同事检查是否需要补充脱敏规则"
                    responsible = "operation"
                else:
                    explanation = "该字段未检测到敏感数据，无需脱敏"
                    next_step = "可直接导出"
                    responsible = ""

        return explanation, next_step, responsible

    def _write_json(self, export: ExportRecord, ticket: Ticket) -> str:
        path = self.output_dir / f"{export.export_id}_data.json"

        def sanitize_value(value: str) -> str:
            return mask_text(value)

        field_map = {f.field_name: f for f in ticket.fields}

        fields_data = []
        for f in export.fields:
            tf = field_map.get(f.field_name)
            field_entry = {
                "field_name": f.field_name,
                "value": sanitize_value(f.masked_value) if f.is_masked else sanitize_value(f.original_value),
                "is_masked": f.is_masked,
                "leak_risk": f.leak_risk,
                "explanation": f.explanation,
                "next_step": f.next_step,
                "responsible_role": f.responsible_role,
            }
            if tf and tf.missing_materials:
                field_entry["missing_materials"] = list(tf.missing_materials)
            if tf and tf.last_reviewed_by:
                field_entry["last_reviewed_by"] = tf.last_reviewed_by
                field_entry["last_reviewed_at"] = tf.last_reviewed_at
            relevant_changes = [
                {
                    "change_id": log.change_id,
                    "change_type": log.change_type,
                    "timestamp": log.timestamp,
                    "author": log.author,
                }
                for log in ticket.change_logs
                if log.field_name == f.field_name
            ]
            if relevant_changes:
                field_entry["change_history"] = relevant_changes
            fields_data.append(field_entry)

        change_logs_data = []
        for log in ticket.change_logs:
            change_logs_data.append({
                "change_id": log.change_id,
                "change_type": log.change_type,
                "author": log.author,
                "field_name": log.field_name,
                "timestamp": log.timestamp,
                "old_value_summary": log.old_value_summary,
                "new_value_summary": log.new_value_summary,
                "affected_exports": list(log.affected_exports),
                "note": log.note,
            })

        data = {
            "export_id": export.export_id,
            "ticket_id": export.ticket_id,
            "generated_at": export.generated_at.isoformat(),
            "generated_by": export.generated_by,
            "status": export.status.value,
            "summary": export.summary,
            "fields": fields_data,
            "export_history": list(ticket.export_history),
            "change_logs": change_logs_data,
            "traceability": {
                "report_file": f"output/{export.export_id}_report.txt",
                "summary_file": f"output/{export.export_id}_summary.txt",
                "data_file": f"output/{export.export_id}_data.json",
                "storage_file": f"data/exports/{export.export_id}.json",
                "ticket_file": f"data/tickets/{ticket.ticket_id}.json",
            },
            "audit_notes": export.audit_notes,
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(path)

    def _write_report(self, export: ExportRecord, ticket: Ticket) -> str:
        path = self.output_dir / f"{export.export_id}_report.txt"

        lines = []
        lines.append("=" * 70)
        lines.append("发票 OCR 置信度复核 - 脱敏导出报告")
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"导出编号: {export.export_id}")
        lines.append(f"关联工单: {ticket.ticket_id}")
        lines.append(f"工单标题: {ticket.title}")
        lines.append(f"工单来源: {ticket.source}")
        lines.append(f"工单状态: {ticket.status.value}")
        lines.append(f"生成时间: {export.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"生成人员: {export.generated_by}")
        lines.append("")
        lines.append("-" * 70)
        lines.append("概览统计")
        lines.append("-" * 70)
        lines.append(f"总字段数: {export.summary.get('total_fields', 0)}")
        lines.append(f"已脱敏字段: {export.summary.get('masked_fields', 0)}")
        lines.append(f"泄露风险字段: {export.summary.get('leak_fields', 0)}")
        lines.append(f"需算法处理: {export.summary.get('needs_algorithm', 0)} 个字段")
        lines.append(f"需运营处理: {export.summary.get('needs_operation', 0)} 个字段")
        lines.append("")
        lines.append("-" * 70)
        lines.append("字段明细")
        lines.append("-" * 70)
        lines.append("")

        for idx, field in enumerate(export.fields, 1):
            risk_icon = "🔴" if field.leak_risk == "high" else "🟡" if field.leak_risk == "medium" else "🟢"
            lines.append(f"[{idx}] {risk_icon} 字段: {field.field_name}")
            lines.append(f"    脱敏状态: {'已脱敏' if field.is_masked else '未脱敏'}")
            if field.leak_risk != "none":
                lines.append(f"    泄露风险: {field.leak_risk}")
            lines.append(f"    导出值: {field.original_value if not field.is_masked else field.masked_value}")
            lines.append(f"    说明: {field.explanation}")
            if field.next_step:
                lines.append(f"    下一步: {field.next_step}")
            if field.responsible_role:
                role_name = "算法同事" if field.responsible_role == "algorithm" else "运营老唐"
                lines.append(f"    负责人: {role_name}")
            lines.append("")

        if ticket.rule_notes:
            lines.append("-" * 70)
            lines.append("运营备注记录")
            lines.append("-" * 70)
            for note in ticket.rule_notes:
                field_info = f" (字段: {note['field_name']})" if note.get('field_name') else ""
                lines.append(f"  [{note['timestamp']}] {note['author']}{field_info}: {note['note']}")
            lines.append("")

        if ticket.algorithm_notes:
            lines.append("-" * 70)
            lines.append("算法备注记录")
            lines.append("-" * 70)
            for note in ticket.algorithm_notes:
                field_info = f" (字段: {note['field_name']})" if note.get('field_name') else ""
                lines.append(f"  [{note['timestamp']}] {note['author']}{field_info}: {note['note']}")
            lines.append("")

        if ticket.change_logs:
            lines.append("-" * 70)
            lines.append("变更历史（谁改了什么、影响了哪条导出）")
            lines.append("-" * 70)
            for log in ticket.change_logs:
                type_map = {
                    "status_changed": "状态变更",
                    "rule_note_added": "运营备注",
                    "algorithm_note_added": "算法备注",
                    "missing_materials_updated": "缺材料更新",
                    "leak_detected": "泄露检测",
                }
                type_display = type_map.get(log.change_type, log.change_type)
                field_info = f" → 字段 {log.field_name}" if log.field_name else " → 工单级别"
                affected = f"（影响导出: {', '.join(log.affected_exports)}）" if log.affected_exports else ""
                lines.append(f"  [{log.change_id}] {type_display}{field_info}")
                lines.append(f"      时间: {log.timestamp}")
                lines.append(f"      操作人: {log.author}")
                lines.append(f"      变化: {log.old_value_summary} → {log.new_value_summary}")
                if log.note:
                    lines.append(f"      备注: {log.note}")
                if affected:
                    lines.append(f"      追溯 {affected}")
                lines.append("")

        if ticket.export_history:
            lines.append("-" * 70)
            lines.append("导出历史（与报告中导出ID一一对应）")
            lines.append("-" * 70)
            for eid in ticket.export_history:
                marker = " ← 本报告" if eid == export.export_id else ""
                lines.append(f"  • {eid}{marker}")
            lines.append("")

        lines.append("-" * 70)
        lines.append("导出追溯链接（导出文件 ↔ 报告 ↔ 看板 使用同一ID）")
        lines.append("-" * 70)
        lines.append(f"  数据文件: output/{export.export_id}_data.json")
        lines.append(f"  详细报告: output/{export.export_id}_report.txt")
        lines.append(f"  快速摘要: output/{export.export_id}_summary.txt")
        lines.append(f"  看板数据: data/exports/{export.export_id}.json")
        lines.append(f"  工单记录: data/tickets/{ticket.ticket_id}.json")
        lines.append("")

        lines.append("=" * 70)
        lines.append("报告结束")
        lines.append("=" * 70)

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return str(path)

    def _write_summary(self, export: ExportRecord, ticket: Ticket) -> str:
        path = self.output_dir / f"{export.export_id}_summary.txt"

        leak_fields = [f for f in export.fields if f.leak_risk != "none"]
        needs_algo = [f for f in export.fields if f.responsible_role == "algorithm"]
        needs_op = [f for f in export.fields if f.responsible_role == "operation"]

        lines = []
        lines.append("📋 发票 OCR 置信度复核 - 快速摘要")
        lines.append("=" * 50)
        lines.append(f"工单: {ticket.ticket_id} - {ticket.title}")
        lines.append(f"状态: {ticket.status.value}")
        lines.append("")

        if leak_fields:
            lines.append(f"⚠️  发现 {len(leak_fields)} 个字段存在泄露风险:")
            for f in leak_fields:
                lines.append(f"   - {f.field_name}: {f.explanation[:50]}...")
            lines.append("")
        else:
            lines.append("✅ 所有字段脱敏检查通过")
            lines.append("")

        if needs_algo:
            lines.append("🔬 需算法同事处理:")
            for f in needs_algo:
                lines.append(f"   - {f.field_name}: {f.next_step}")
            lines.append("")

        if needs_op:
            lines.append("📝 需运营老唐处理:")
            for f in needs_op:
                lines.append(f"   - {f.field_name}: {f.next_step}")
            lines.append("")

        lines.append(f"📊 OCR整体置信度: {ticket.ocr_confidence_score:.2f}" if ticket.ocr_confidence_score else "📊 OCR置信度: 未记录")
        lines.append("")
        lines.append(f"🔗 详情报告: {export.export_id}_report.txt")
        lines.append(f"🔗 数据文件: {export.export_id}_data.json")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return str(path)
