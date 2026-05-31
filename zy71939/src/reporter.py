from datetime import datetime
from typing import List, Dict, Any
import json
import os

from .models import (
    ProofRecord,
    MaterialPackage,
    DeliverySummary,
    RecordStatus,
    AbnormalType,
)
from .tracer import TraceableReporter


class DeliveryReporter:
    def __init__(self, material_package: MaterialPackage):
        self.package = material_package
        self.records = material_package.records
        self.tracer = TraceableReporter(self.records)

    def generate_summary(self) -> DeliverySummary:
        normal_records = []
        pending_records = []
        abnormal_records = []

        for record in self.records:
            if record.status == RecordStatus.NORMAL:
                normal_records.append(record)
            elif record.status == RecordStatus.PENDING:
                pending_records.append(record)
            else:
                abnormal_records.append(record)

        pending_reasons = self._group_by_reason(pending_records)
        abnormal_details = self._group_by_reason(abnormal_records)

        return DeliverySummary(
            generated_at=datetime.now(),
            total_records=len(self.records),
            normal_count=len(normal_records),
            pending_count=len(pending_records),
            abnormal_count=len(abnormal_records),
            normal_records=normal_records,
            pending_records=pending_records,
            abnormal_records=abnormal_records,
            pending_reasons=pending_reasons,
            abnormal_details=abnormal_details,
        )

    def _group_by_reason(
        self, records: List[ProofRecord]
    ) -> Dict[str, List[str]]:
        groups: Dict[str, List[str]] = {}
        for record in records:
            for abnormal_type in record.abnormal_types:
                key = str(abnormal_type)
                if key not in groups:
                    groups[key] = []
                desc = f"{record.record_id}: {record.material_name}"
                if record.verification:
                    desc += f" - {record.verification.reason}"
                groups[key].append(desc)
        return groups

    def export_delivery_note(self, output_dir: str) -> None:
        os.makedirs(output_dir, exist_ok=True)

        summary = self.generate_summary()

        summary_file = os.path.join(output_dir, "交付说明_总览.txt")
        with open(summary_file, "w", encoding="utf-8") as f:
            f.write("=" * 60 + "\n")
            f.write("印刷打样异常检测交付说明\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"生成时间: {summary.generated_at.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"素材包: {self.package.package_name}\n")
            f.write(f"接收时间: {self.package.received_at.strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("-" * 60 + "\n")
            f.write("统计概览\n")
            f.write("-" * 60 + "\n")
            f.write(f"总记录数: {summary.total_records}\n")
            f.write(f"正常记录: {summary.normal_count}\n")
            f.write(f"待确认记录: {summary.pending_count} ⚠️\n")
            f.write(f"异常记录: {summary.abnormal_count} ❌\n\n")

            if summary.pending_reasons:
                f.write("-" * 60 + "\n")
                f.write("待确认记录分类 (请品牌设计师复核)\n")
                f.write("-" * 60 + "\n\n")

                reason_names = {
                    "authorization_expired": "授权过期",
                    "color_version_mixed": "颜色版本混用",
                    "export_spec_missed": "导出规格漏改",
                    "late_attachment": "晚到附件",
                    "duplicate": "重复记录",
                    "manual_correction": "人工更正",
                }

                for reason_type, items in summary.pending_reasons.items():
                    display_name = reason_names.get(reason_type, reason_type)
                    f.write(f"【{display_name}】 ({len(items)} 条)\n")
                    for item in items[:5]:
                        f.write(f"  - {item}\n")
                    if len(items) > 5:
                        f.write(f"  ... 还有 {len(items) - 5} 条\n")
                    f.write("\n")

            f.write("-" * 60 + "\n")
            f.write("正常记录列表\n")
            f.write("-" * 60 + "\n")
            for record in summary.normal_records:
                f.write(
                    f"  {record.record_id}: {record.material_name} "
                    f"[颜色:{record.color_version}, 规格:{record.spec}]\n"
                )

            f.write("\n" + "=" * 60 + "\n")
            f.write("注意: 待确认记录已单独列出，请优先处理\n")
            f.write("详细追溯信息请查看 trace_report.json 文件\n")
            f.write("=" * 60 + "\n")

        trace_file = os.path.join(output_dir, "追溯报告_可复核.json")
        self.tracer.export_trace_links(trace_file)

        detail_file = os.path.join(output_dir, "待确认记录_详情.json")
        self._export_pending_details(detail_file)

        print(f"交付说明已导出到: {output_dir}")
        print(f"  - {summary_file}")
        print(f"  - {trace_file}")
        print(f"  - {detail_file}")

    def _export_pending_details(self, output_path: str) -> None:
        details = []
        for record in self.records:
            if record.status != RecordStatus.NORMAL:
                trace = self.tracer.get_trace_for_record(record.record_id)
                if trace:
                    details.append(trace)

        output = {
            "generated_at": datetime.now().isoformat(),
            "total_pending": len(details),
            "records": details,
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
