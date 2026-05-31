import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import asdict

from models import (
    AuditReport,
    AuditConclusion,
    ChangeType,
    RecordStatus,
)


class ReportGenerator:
    def __init__(self, conclusions: List[AuditConclusion], data_sources: List[str]):
        self.conclusions = conclusions
        self.data_sources = data_sources
        self.report_id = f"AUDIT-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

    def generate(self, output_dir: str = ".") -> Dict[str, str]:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        audit_period = self._determine_audit_period()
        total = len(self.conclusions)
        material_only = sum(1 for c in self.conclusions if c.change_type == ChangeType.MATERIAL_ONLY)
        conclusion_changed = sum(1 for c in self.conclusions if c.change_type == ChangeType.CONCLUSION_CHANGED)
        disputed = sum(1 for c in self.conclusions if c.status == RecordStatus.DISPUTED)

        report = AuditReport(
            report_id=self.report_id,
            generated_at=datetime.now(),
            audit_period=audit_period,
            total_records=total,
            material_only_count=material_only,
            conclusion_changed_count=conclusion_changed,
            disputed_count=disputed,
            conclusions=self.conclusions,
            data_sources=self.data_sources
        )

        outputs = {}
        outputs['json'] = self._generate_json_report(report, output_dir)
        outputs['txt'] = self._generate_text_report(report, output_dir)
        outputs['csv'] = self._generate_csv_summary(report, output_dir)
        outputs['trace'] = self._generate_traceable_report(report, output_dir)

        return outputs

    def _determine_audit_period(self) -> str:
        all_times = []
        for conclusion in self.conclusions:
            all_times.append(conclusion.created_at)

        if not all_times:
            return f"{datetime.now().date()}"

        min_time = min(all_times)
        max_time = max(all_times)
        return f"{min_time.date()} ~ {max_time.date()}"

    def _generate_json_report(self, report: AuditReport, output_dir: str) -> str:
        file_path = Path(output_dir) / f"{self.report_id}_full.json"

        report_dict = asdict(report)
        for i, conclusion in enumerate(report_dict['conclusions']):
            conclusion['change_type'] = report.conclusions[i].change_type.value
            conclusion['status'] = report.conclusions[i].status.value
            if conclusion.get('dispute'):
                conclusion['dispute']['dispute_type'] = report.conclusions[i].dispute.dispute_type.value

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, default=str)

        return str(file_path)

    def _generate_text_report(self, report: AuditReport, output_dir: str) -> str:
        file_path = Path(output_dir) / f"{self.report_id}_report.txt"

        lines = []
        lines.append("=" * 80)
        lines.append(f"文件上传审计报告 - {report.report_id}")
        lines.append("=" * 80)
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"审计周期: {report.audit_period}")
        lines.append(f"数据来源: {', '.join(report.data_sources)}")
        lines.append("")
        lines.append("-" * 80)
        lines.append("汇总统计")
        lines.append("-" * 80)
        lines.append(f"总记录数: {report.total_records}")
        lines.append(f"  - 仅补材料: {report.material_only_count}")
        lines.append(f"  - 改结论: {report.conclusion_changed_count}")
        lines.append(f"  - 有争议: {report.disputed_count}")
        lines.append("")
        lines.append("=" * 80)
        lines.append("明细记录")
        lines.append("=" * 80)
        lines.append("")

        for idx, conclusion in enumerate(report.conclusions, 1):
            lines.append(f"[{idx}] {conclusion.id} - {conclusion.interface_name}")
            lines.append(f"    状态: [{conclusion.status.value}] | 类型: {conclusion.change_type.value}")
            lines.append(f"    摘要: {conclusion.summary}")
            lines.append(f"    说明: {conclusion.notes}")

            if conclusion.migration_refs:
                lines.append(f"    迁移清单:")
                for ref in conclusion.migration_refs:
                    lines.append(f"      -> {ref}")

            if conclusion.alarm_refs:
                lines.append(f"    报警记录:")
                for ref in conclusion.alarm_refs:
                    lines.append(f"      -> {ref}")

            if conclusion.doc_refs:
                lines.append(f"    接口文档:")
                for ref in conclusion.doc_refs:
                    lines.append(f"      -> {ref}")

            if conclusion.audit_log_refs:
                lines.append(f"    审计日志:")
                for ref in conclusion.audit_log_refs:
                    lines.append(f"      -> {ref}")

            if conclusion.dispute:
                lines.append(f"    !争议: {conclusion.dispute.dispute_type.value}")
                lines.append(f"      描述: {conclusion.dispute.description}")
                lines.append(f"      复核原因: {conclusion.dispute.verifiable_reason}")
                if conclusion.dispute.evidence_refs:
                    lines.append(f"      证据链:")
                    for ev in conclusion.dispute.evidence_refs:
                        lines.append(f"        * {ev}")

            lines.append("")

        lines.append("=" * 80)
        lines.append("使用说明:")
        lines.append("  - 带 -> 的引用可直接定位到源文件行号")
        lines.append("  - 有争议的记录(!)需要重点复核")
        lines.append("  - 下一班请先查看 [DISPUTED] 状态的记录")
        lines.append("=" * 80)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return str(file_path)

    def _generate_csv_summary(self, report: AuditReport, output_dir: str) -> str:
        file_path = Path(output_dir) / f"{self.report_id}_summary.csv"

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '结论ID', '接口名称', '状态', '变更类型',
                '迁移项数', '报警数', '文档版数',
                '是否有争议', '争议类型', '摘要'
            ])

            for conclusion in report.conclusions:
                writer.writerow([
                    conclusion.id,
                    conclusion.interface_name,
                    conclusion.status.value,
                    conclusion.change_type.value,
                    len(conclusion.migration_refs),
                    len(conclusion.alarm_refs),
                    len(conclusion.doc_refs),
                    '是' if conclusion.dispute else '否',
                    conclusion.dispute.dispute_type.value if conclusion.dispute else '',
                    conclusion.summary
                ])

        return str(file_path)

    def _generate_traceable_report(self, report: AuditReport, output_dir: str) -> str:
        file_path = Path(output_dir) / f"{self.report_id}_traceable.txt"

        lines = []
        lines.append("=" * 80)
        lines.append("可追溯审计清单 - 供下一班继续")
        lines.append("=" * 80)
        lines.append("")
        lines.append("快速索引:")
        lines.append("  [D] = 有争议，需要先看")
        lines.append("  [C] = 改结论，需要确认")
        lines.append("  [M] = 仅补材料，可以跳过")
        lines.append("")

        disputed_conclusions = [c for c in report.conclusions if c.status == RecordStatus.DISPUTED]
        changed_conclusions = [c for c in report.conclusions if c.change_type == ChangeType.CONCLUSION_CHANGED and c.status != RecordStatus.DISPUTED]
        other_conclusions = [c for c in report.conclusions if c not in disputed_conclusions and c not in changed_conclusions]

        lines.append("-" * 80)
        lines.append(f"[D] 有争议记录 ({len(disputed_conclusions)}条) - 优先处理")
        lines.append("-" * 80)
        for c in disputed_conclusions:
            self._append_trace_line(lines, c, 'D')

        lines.append("")
        lines.append("-" * 80)
        lines.append(f"[C] 改结论记录 ({len(changed_conclusions)}条) - 其次处理")
        lines.append("-" * 80)
        for c in changed_conclusions:
            self._append_trace_line(lines, c, 'C')

        lines.append("")
        lines.append("-" * 80)
        lines.append(f"[M] 其他记录 ({len(other_conclusions)}条)")
        lines.append("-" * 80)
        for c in other_conclusions:
            self._append_trace_line(lines, c, 'M')

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return str(file_path)

    def _append_trace_line(self, lines: List[str], conclusion: AuditConclusion, prefix: str):
        lines.append("")
        lines.append(f"{prefix} {conclusion.id} | {conclusion.interface_name}")
        lines.append(f"    摘要: {conclusion.summary}")

        if conclusion.dispute:
            lines.append(f"    !争议原因: {conclusion.dispute.verifiable_reason}")
            lines.append(f"    !证据点:")
            for ev in conclusion.dispute.evidence_refs:
                lines.append(f"        {ev}")

        all_refs = []
        all_refs.extend([('迁移', r) for r in conclusion.migration_refs])
        all_refs.extend([('报警', r) for r in conclusion.alarm_refs])
        all_refs.extend([('文档', r) for r in conclusion.doc_refs])

        if all_refs:
            lines.append(f"    依据:")
            for typ, ref in all_refs:
                lines.append(f"        [{typ}] {ref}")
