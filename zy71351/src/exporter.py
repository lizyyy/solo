from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from tabulate import tabulate

from .models import PrintRecord, Conflict, Severity, BatchValidationResult, PrintStatus
from .storage import Storage


class ReportExporter:
    def __init__(self, storage: Storage):
        self.storage = storage

    def export_validation_report(self, batch_id: str, format: str = "json") -> Path:
        validation_result = self.storage.load_validation_result(batch_id)
        if not validation_result:
            raise ValueError(f"批次 {batch_id} 没有校验结果")

        records = self.storage.get_records_by_batch(batch_id)

        report_data = self._build_report_data(batch_id, validation_result, records)

        if format == "json":
            return self._export_json(batch_id, report_data)
        elif format == "csv":
            return self._export_csv(batch_id, report_data)
        elif format == "txt":
            return self._export_txt(batch_id, report_data)
        else:
            raise ValueError(f"不支持的导出格式: {format}")

    def _build_report_data(
        self,
        batch_id: str,
        validation_result: BatchValidationResult,
        records: List[PrintRecord]
    ) -> Dict[str, Any]:
        critical = validation_result.get_conflicts_by_severity(Severity.CRITICAL)
        warnings = validation_result.get_conflicts_by_severity(Severity.WARNING)
        info = validation_result.get_conflicts_by_severity(Severity.INFO)

        sold_records = [r for r in records if r.status == PrintStatus.SOLD]
        returned_records = [r for r in records if r.status == PrintStatus.RETURNED]
        available_records = [r for r in records if r.status == PrintStatus.AVAILABLE]

        with_cert = [r for r in sold_records if r.certificate_number]
        without_cert = [r for r in sold_records if not r.certificate_number]

        return {
            "batch_id": batch_id,
            "generated_at": datetime.now().isoformat(),
            "validation_summary": {
                "total_records": validation_result.total_records,
                "is_valid": validation_result.is_valid,
                "processed_at": validation_result.processed_at.isoformat() if isinstance(validation_result.processed_at, datetime) else validation_result.processed_at,
                "conflict_summary": {
                    "total": len(validation_result.conflicts),
                    "critical": len(critical),
                    "warning": len(warnings),
                    "info": len(info)
                }
            },
            "status_breakdown": {
                "available": len(available_records),
                "sold": len(sold_records),
                "returned": len(returned_records),
                "reserved": len([r for r in records if r.status == PrintStatus.RESERVED])
            },
            "certificate_tracking": {
                "total_sold": len(sold_records),
                "with_certificate": len(with_cert),
                "without_certificate": len(without_cert),
                "completion_rate": len(with_cert) / len(sold_records) if sold_records else 1.0
            },
            "conflicts": {
                "critical": [self._conflict_to_dict(c) for c in critical],
                "warning": [self._conflict_to_dict(c) for c in warnings],
                "info": [self._conflict_to_dict(c) for c in info]
            },
            "records": [self._record_to_dict(r) for r in records],
            "export_metadata": {
                "export_count": len(records),
                "has_critical_issues": validation_result.has_critical_conflicts()
            }
        }

    def _conflict_to_dict(self, conflict: Conflict) -> Dict[str, Any]:
        return {
            "type": conflict.conflict_type,
            "severity": conflict.severity.value,
            "description": conflict.description,
            "affected_records": conflict.affected_records,
            "details": conflict.details
        }

    def _record_to_dict(self, record: PrintRecord) -> Dict[str, Any]:
        return {
            "record_id": record.record_id,
            "series": record.series,
            "edition_number": record.edition_number,
            "is_ap": record.is_ap,
            "buyer": record.buyer,
            "certificate_number": record.certificate_number,
            "verification_report": record.verification_report,
            "remarks": record.remarks,
            "receipt": record.receipt,
            "status": record.status.value,
            "batch_id": record.batch_id,
            "created_at": record.created_at.isoformat() if isinstance(record.created_at, datetime) else record.created_at,
            "updated_at": record.updated_at.isoformat() if isinstance(record.updated_at, datetime) else record.updated_at
        }

    def _export_json(self, batch_id: str, data: Dict[str, Any]) -> Path:
        return self.storage.save_export_report(batch_id, data)

    def _export_csv(self, batch_id: str, data: Dict[str, Any]) -> Path:
        output_dir = Path(self.storage.base_dir) / self.storage.data_dirs["output"]
        csv_file = output_dir / f"{batch_id}_report.csv"

        with open(csv_file, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)

            writer.writerow(["=== 版画编号核对报告 ==="])
            writer.writerow([f"批次ID: {batch_id}"])
            writer.writerow([f"生成时间: {data['generated_at']}"])
            writer.writerow([])

            writer.writerow(["=== 校验摘要 ==="])
            writer.writerow(["总记录数", data["validation_summary"]["total_records"]])
            writer.writerow(["校验通过", data["validation_summary"]["is_valid"]])
            writer.writerow(["严重冲突", data["validation_summary"]["conflict_summary"]["critical"]])
            writer.writerow(["警告冲突", data["validation_summary"]["conflict_summary"]["warning"]])
            writer.writerow(["信息提示", data["validation_summary"]["conflict_summary"]["info"]])
            writer.writerow([])

            writer.writerow(["=== 状态分布 ==="])
            writer.writerow(["待售", data["status_breakdown"]["available"]])
            writer.writerow(["已售", data["status_breakdown"]["sold"]])
            writer.writerow(["已退货", data["status_breakdown"]["returned"]])
            writer.writerow([])

            writer.writerow(["=== 证书追踪 ==="])
            writer.writerow(["已售总数", data["certificate_tracking"]["total_sold"]])
            writer.writerow(["已有证书", data["certificate_tracking"]["with_certificate"]])
            writer.writerow(["缺少证书", data["certificate_tracking"]["without_certificate"]])
            writer.writerow(["完成率", f"{data['certificate_tracking']['completion_rate']:.1%}"])
            writer.writerow([])

            if data["conflicts"]["critical"]:
                writer.writerow(["=== 严重冲突 ==="])
                writer.writerow(["类型", "描述", "受影响记录"])
                for c in data["conflicts"]["critical"]:
                    writer.writerow([c["type"], c["description"], ", ".join(c["affected_records"])])
                writer.writerow([])

            if data["conflicts"]["warning"]:
                writer.writerow(["=== 警告冲突 ==="])
                writer.writerow(["类型", "描述", "受影响记录"])
                for c in data["conflicts"]["warning"]:
                    writer.writerow([c["type"], c["description"], ", ".join(c["affected_records"])])
                writer.writerow([])

            writer.writerow(["=== 详细记录 ==="])
            writer.writerow([
                "记录ID", "系列", "版号", "AP版", "购买人", "证书号",
                "状态", "备注", "回执", "创建时间"
            ])
            for r in data["records"]:
                writer.writerow([
                    r["record_id"], r["series"], r["edition_number"],
                    "是" if r["is_ap"] else "否", r["buyer"] or "",
                    r["certificate_number"] or "", r["status"],
                    r["remarks"] or "", r["receipt"] or "",
                    r["created_at"]
                ])

        return csv_file

    def _export_txt(self, batch_id: str, data: Dict[str, Any]) -> Path:
        output_dir = Path(self.storage.base_dir) / self.storage.data_dirs["output"]
        txt_file = output_dir / f"{batch_id}_report.txt"

        lines = []
        lines.append("=" * 80)
        lines.append("版画编号核对报告")
        lines.append("=" * 80)
        lines.append(f"批次ID: {batch_id}")
        lines.append(f"生成时间: {data['generated_at']}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("校验摘要")
        lines.append("-" * 80)
        summary = [
            ["总记录数", data["validation_summary"]["total_records"]],
            ["校验通过", "✅ 是" if data["validation_summary"]["is_valid"] else "❌ 否"],
            ["严重冲突", f"🔴 {data['validation_summary']['conflict_summary']['critical']}"],
            ["警告冲突", f"🟡 {data['validation_summary']['conflict_summary']['warning']}"],
            ["信息提示", f"🔵 {data['validation_summary']['conflict_summary']['info']}"],
        ]
        lines.append(tabulate(summary, tablefmt="plain"))
        lines.append("")

        lines.append("-" * 80)
        lines.append("状态分布")
        lines.append("-" * 80)
        status_table = [
            ["待售", data["status_breakdown"]["available"]],
            ["已售", data["status_breakdown"]["sold"]],
            ["已退货", data["status_breakdown"]["returned"]],
        ]
        lines.append(tabulate(status_table, tablefmt="plain"))
        lines.append("")

        lines.append("-" * 80)
        lines.append("证书追踪")
        lines.append("-" * 80)
        cert_table = [
            ["已售总数", data["certificate_tracking"]["total_sold"]],
            ["已有证书", data["certificate_tracking"]["with_certificate"]],
            ["缺少证书", data["certificate_tracking"]["without_certificate"]],
            ["完成率", f"{data['certificate_tracking']['completion_rate']:.1%}"],
        ]
        lines.append(tabulate(cert_table, tablefmt="plain"))
        lines.append("")

        if data["conflicts"]["critical"]:
            lines.append("-" * 80)
            lines.append("🔴 严重冲突 (必须处理)")
            lines.append("-" * 80)
            for i, c in enumerate(data["conflicts"]["critical"], 1):
                lines.append(f"{i}. [{c['type']}] {c['description']}")
                lines.append(f"   受影响: {', '.join(c['affected_records'])}")
            lines.append("")

        if data["conflicts"]["warning"]:
            lines.append("-" * 80)
            lines.append("🟡 警告冲突 (建议处理)")
            lines.append("-" * 80)
            for i, c in enumerate(data["conflicts"]["warning"], 1):
                lines.append(f"{i}. [{c['type']}] {c['description']}")
                lines.append(f"   受影响: {', '.join(c['affected_records'])}")
            lines.append("")

        if data["conflicts"]["info"]:
            lines.append("-" * 80)
            lines.append("🔵 信息提示 (关注即可)")
            lines.append("-" * 80)
            for i, c in enumerate(data["conflicts"]["info"], 1):
                lines.append(f"{i}. [{c['type']}] {c['description']}")
                lines.append(f"   受影响: {', '.join(c['affected_records'])}")
            lines.append("")

        lines.append("-" * 80)
        lines.append("详细记录")
        lines.append("-" * 80)
        records_table = []
        records_header = [
            "系列", "版号", "AP", "购买人", "证书号", "状态", "备注"
        ]
        for r in data["records"]:
            records_table.append([
                r["series"],
                r["edition_number"],
                "是" if r["is_ap"] else "否",
                r["buyer"] or "-",
                r["certificate_number"] or "-",
                r["status"],
                (r["remarks"] or "")[:30] + ("..." if len(r["remarks"] or "") > 30 else "")
            ])
        lines.append(tabulate(records_table, headers=records_header, tablefmt="grid"))
        lines.append("")

        lines.append("=" * 80)
        lines.append(f"导出记录数: {data['export_metadata']['export_count']}")
        lines.append("=" * 80)

        txt_file.write_text("\n".join(lines), encoding="utf-8")
        return txt_file

    def export_error_list(self, batch_id: str) -> Path:
        validation_result = self.storage.load_validation_result(batch_id)
        if not validation_result:
            raise ValueError(f"批次 {batch_id} 没有校验结果")

        error_dir = Path(self.storage.base_dir) / self.storage.data_dirs["errors"]
        error_file = error_dir / f"{batch_id}_error_list.txt"

        lines = []
        lines.append(f"错误清单 - 批次 {batch_id}")
        lines.append("=" * 60)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        for severity in [Severity.CRITICAL, Severity.WARNING, Severity.INFO]:
            conflicts = validation_result.get_conflicts_by_severity(severity)
            if conflicts:
                severity_label = {
                    Severity.CRITICAL: "🔴 严重",
                    Severity.WARNING: "🟡 警告",
                    Severity.INFO: "🔵 信息"
                }[severity]
                lines.append(f"{severity_label} ({len(conflicts)}项):")
                for i, c in enumerate(conflicts, 1):
                    lines.append(f"  {i}. {c.description}")
                    lines.append(f"     记录ID: {', '.join(c.affected_records)}")
                    if c.details:
                        lines.append(f"     详情: {json.dumps(c.details, ensure_ascii=False)}")
                lines.append("")

        error_file.write_text("\n".join(lines), encoding="utf-8")
        return error_file

    def format_console_output(self, validation_result: BatchValidationResult) -> str:
        from colorama import Fore, Style, init
        init()

        lines = []
        lines.append("\n" + "=" * 60)
        lines.append("校验结果汇总")
        lines.append("=" * 60)

        critical = validation_result.get_conflicts_by_severity(Severity.CRITICAL)
        warnings = validation_result.get_conflicts_by_severity(Severity.WARNING)
        info = validation_result.get_conflicts_by_severity(Severity.INFO)

        status = Fore.GREEN + "✅ 通过" + Style.RESET_ALL if validation_result.is_valid else Fore.RED + "❌ 未通过" + Style.RESET_ALL
        lines.append(f"校验状态: {status}")
        lines.append(f"总记录数: {validation_result.total_records}")
        lines.append(f"冲突总数: {len(validation_result.conflicts)}")
        lines.append("")

        lines.append(f"{Fore.RED}🔴 严重: {len(critical)}{Style.RESET_ALL}")
        for c in critical:
            lines.append(f"   - {c.description}")

        lines.append(f"{Fore.YELLOW}🟡 警告: {len(warnings)}{Style.RESET_ALL}")
        for c in warnings:
            lines.append(f"   - {c.description}")

        lines.append(f"{Fore.CYAN}🔵 信息: {len(info)}{Style.RESET_ALL}")
        for c in info:
            lines.append(f"   - {c.description}")

        lines.append("=" * 60)

        return "\n".join(lines)
