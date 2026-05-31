from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import json

from models import InspectionRecord, RecordStatus, ConclusionType
from inspection_engine import RAGInspectionEngine


class WeeklyReportGenerator:
    def __init__(self, engine: RAGInspectionEngine):
        self.engine = engine

    def generate_weekly_report(self, start_date: datetime, end_date: datetime) -> Dict:
        records_in_period = self._get_records_in_period(start_date, end_date)

        confirmed_records = [r for r in records_in_period if r.status == RecordStatus.CONFIRMED]
        pending_records = [r for r in records_in_period if r.status == RecordStatus.PENDING_SUPPLEMENT]
        modified_records = [r for r in records_in_period if r.status == RecordStatus.MANUAL_MODIFIED]

        report = {
            "report_period": {
                "start_date": start_date,
                "end_date": end_date,
                "generated_at": datetime.now()
            },
            "summary": self._generate_summary(records_in_period, confirmed_records, pending_records, modified_records),
            "processing_categories": {
                "confirmed": self._process_confirmed_records(confirmed_records),
                "pending_supplement": self._process_pending_records(pending_records),
                "manual_modified": self._process_modified_records(modified_records)
            },
            "change_analysis": self._analyze_changes_in_period(start_date, end_date),
            "quality_metrics": self._calculate_quality_metrics(records_in_period)
        }
        return report

    def _get_records_in_period(self, start_date: datetime, end_date: datetime) -> List[InspectionRecord]:
        return [
            r for r in self.engine.records.values()
            if start_date <= r.received_at <= end_date
        ]

    def _generate_summary(self, all_records: List, confirmed: List, pending: List, modified: List) -> Dict:
        total = len(all_records)
        pass_rate = self._calculate_pass_rate(all_records)

        return {
            "total_records": total,
            "confirmed_count": len(confirmed),
            "pending_count": len(pending),
            "modified_count": len(modified),
            "pass_rate": pass_rate,
            "confirmation_rate": len(confirmed) / total if total > 0 else 0,
            "modification_rate": len(modified) / total if total > 0 else 0
        }

    def _calculate_pass_rate(self, records: List[InspectionRecord]) -> float:
        if not records:
            return 0.0
        passed = sum(1 for r in records if r.current_conclusion == ConclusionType.PASS)
        return passed / len(records)

    def _process_confirmed_records(self, records: List[InspectionRecord]) -> Dict:
        return {
            "count": len(records),
            "description": "已确认：质检完成，材料齐全，结论无需修改",
            "records": [
                self._format_record_for_report(r, include_evidence=True)
                for r in records
            ]
        }

    def _process_pending_records(self, records: List[InspectionRecord]) -> Dict:
        pending_details = []
        for r in records:
            record_data = self._format_record_for_report(r)
            dialogs = self.engine.dialogs.get(r.record_id, [])
            delayed_dialogs = [d for d in dialogs if d.is_delayed]
            record_data["pending_reason"] = "等待客服对话补录" if delayed_dialogs else "材料不全"
            record_data["expected_supplement"] = f"需补录 {len(delayed_dialogs)} 条对话" if delayed_dialogs else "待补充材料"
            pending_details.append(record_data)

        return {
            "count": len(records),
            "description": "待补：质检表已到，客服对话或其他材料未齐，暂无法确认结论",
            "records": pending_details
        }

    def _process_modified_records(self, records: List[InspectionRecord]) -> Dict:
        modified_details = []
        for r in records:
            record_data = self._format_record_for_report(r, include_evidence=True)
            changes = self.engine.kb_changes.get(r.record_id, [])
            manual_changes = [c for c in changes if c.is_manual]

            record_data["modification_details"] = [
                {
                    "change_type": c.change_type,
                    "field": c.field_name,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "operator": c.operator,
                    "changed_at": c.changed_at,
                    "reason": c.reason
                }
                for c in manual_changes
            ]
            record_data["initial_conclusion"] = r.initial_conclusion
            record_data["current_conclusion"] = r.current_conclusion
            record_data["conclusion_changed"] = r.initial_conclusion != r.current_conclusion

            modified_details.append(record_data)

        return {
            "count": len(records),
            "description": "人工改过：知识库导出后有手工修改，包括材料补充和结论变更",
            "records": modified_details
        }

    def _format_record_for_report(self, record: InspectionRecord, include_evidence: bool = False) -> Dict:
        data = {
            "record_id": record.record_id,
            "received_at": record.received_at,
            "question": record.question,
            "current_conclusion": record.current_conclusion,
            "inspector": record.inspector,
            "remarks": record.remarks
        }

        if include_evidence:
            evidences = self.engine.evidence_links.get(record.record_id, [])
            data["evidence_links"] = [
                {
                    "evidence_type": e.evidence_type,
                    "evidence_id": e.evidence_id,
                    "evidence_title": e.evidence_title,
                    "conclusion_point": e.conclusion_point,
                    "confidence": e.confidence
                }
                for e in evidences
            ]

        return data

    def _analyze_changes_in_period(self, start_date: datetime, end_date: datetime) -> Dict:
        all_changes = []
        for record_id, changes in self.engine.kb_changes.items():
            for c in changes:
                if start_date <= c.changed_at <= end_date:
                    all_changes.append((record_id, c))

        material_changes = [c for _, c in all_changes if c.change_type.value == "补材料"]
        conclusion_changes = [c for _, c in all_changes if c.change_type.value == "改结论"]
        knowledge_changes = [c for _, c in all_changes if c.change_type.value == "知识库改动"]

        return {
            "total_changes": len(all_changes),
            "material_supplements": len(material_changes),
            "conclusion_changes": len(conclusion_changes),
            "knowledge_modifications": len(knowledge_changes),
            "material_only_notes": "以下记录仅补充材料，未改结论：" + ", ".join([
                rid for rid, c in all_changes
                if c.change_type.value == "补材料"
            ]) if material_changes else "无",
            "conclusion_change_notes": "以下记录修改了结论，需重点关注：" + ", ".join([
                rid for rid, c in all_changes
                if c.change_type.value == "改结论"
            ]) if conclusion_changes else "无"
        }

    def _calculate_quality_metrics(self, records: List[InspectionRecord]) -> Dict:
        total = len(records)
        if total == 0:
            return {}

        pass_count = sum(1 for r in records if r.current_conclusion == ConclusionType.PASS)
        fail_count = sum(1 for r in records if r.current_conclusion == ConclusionType.FAIL)
        review_count = sum(1 for r in records if r.current_conclusion == ConclusionType.NEEDS_REVIEW)

        return {
            "pass_count": pass_count,
            "fail_count": fail_count,
            "review_count": review_count,
            "pass_rate": pass_count / total,
            "fail_rate": fail_count / total,
            "review_rate": review_count / total
        }

    def export_report_to_text(self, report: Dict) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("RAG素材体检质检周报")
        lines.append("=" * 60)
        lines.append(f"报告周期: {report['report_period']['start_date'].strftime('%Y-%m-%d')} 至 {report['report_period']['end_date'].strftime('%Y-%m-%d')}")
        lines.append(f"生成时间: {report['report_period']['generated_at'].strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("一、总体概览")
        lines.append("-" * 40)
        s = report['summary']
        lines.append(f"总记录数: {s['total_records']}")
        lines.append(f"已确认: {s['confirmed_count']} ({s['confirmation_rate']*100:.1f}%)")
        lines.append(f"待补材料: {s['pending_count']}")
        lines.append(f"人工修改: {s['modified_count']} ({s['modification_rate']*100:.1f}%)")
        lines.append(f"通过率: {s['pass_rate']*100:.1f}%")
        lines.append("")

        lines.append("二、处理口径分类")
        lines.append("-" * 40)

        lines.append(f"\n【已确认】({report['processing_categories']['confirmed']['count']}条)")
        lines.append(f"说明: {report['processing_categories']['confirmed']['description']}")
        for r in report['processing_categories']['confirmed']['records']:
            lines.append(f"  • [{r['record_id']}] {r['question']} → {r['current_conclusion']}")
            if r.get('evidence_links'):
                for e in r['evidence_links']:
                    lines.append(f"    ↳ 依据[{e['evidence_type']}]: {e['evidence_title']} (结论点: {e['conclusion_point']})")

        lines.append(f"\n【待补】({report['processing_categories']['pending_supplement']['count']}条)")
        lines.append(f"说明: {report['processing_categories']['pending_supplement']['description']}")
        for r in report['processing_categories']['pending_supplement']['records']:
            lines.append(f"  • [{r['record_id']}] {r['question']}")
            lines.append(f"    ↳ 原因: {r['pending_reason']} | {r['expected_supplement']}")

        lines.append(f"\n【人工改过】({report['processing_categories']['manual_modified']['count']}条)")
        lines.append(f"说明: {report['processing_categories']['manual_modified']['description']}")
        for r in report['processing_categories']['manual_modified']['records']:
            change_note = " (结论已变更)" if r['conclusion_changed'] else ""
            lines.append(f"  • [{r['record_id']}] {r['question']}{change_note}")
            lines.append(f"    初始结论: {r['initial_conclusion']} → 当前结论: {r['current_conclusion']}")
            for mod in r['modification_details']:
                lines.append(f"    ↳ {mod['change_type']}: {mod['field']} | 操作人: {mod['operator']}")
                if mod['reason']:
                    lines.append(f"      原因: {mod['reason']}")

        lines.append("\n三、变更分析")
        lines.append("-" * 40)
        ca = report['change_analysis']
        lines.append(f"总变更数: {ca['total_changes']}")
        lines.append(f"  - 补材料: {ca['material_supplements']}")
        lines.append(f"  - 改结论: {ca['conclusion_changes']}")
        lines.append(f"  - 知识库改动: {ca['knowledge_modifications']}")
        lines.append(f"备注: {ca['material_only_notes']}")
        lines.append(f"备注: {ca['conclusion_change_notes']}")

        lines.append("\n" + "=" * 60)
        return "\n".join(lines)

    def export_report_to_json(self, report: Dict, filepath: str) -> None:
        def default_converter(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, 'value'):
                return o.value
            raise TypeError(f"Object of type {type(o)} is not JSON serializable")

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=default_converter)
