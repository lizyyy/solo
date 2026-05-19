import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import List, Dict, Any
import pandas as pd
from .models import (
    ScanResult,
    RecoveryItem,
    BadLine,
    HitRecord,
    ReportConfig,
    RecoveryStatus,
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime)):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)


class ReportGenerator:
    def __init__(self, config: ReportConfig = None):
        self.config = config or ReportConfig()
        self._ensure_output_dir()

    def _ensure_output_dir(self):
        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)

    def _get_file_prefix(self, scan_id: str) -> str:
        return os.path.join(self.config.output_dir, f"scan_result_{scan_id}")

    def generate_json_report(self, scan_result: ScanResult) -> str:
        scan_result.sort_all()

        file_path = f"{self._get_file_prefix(scan_result.scan_id)}.json"

        data = {
            "scan_id": scan_result.scan_id,
            "scan_date": scan_result.scan_date.isoformat(),
            "summary": scan_result.summary,
            "hit_records": [h.model_dump() for h in scan_result.hit_records],
            "recovery_items": [r.model_dump() for r in scan_result.recovery_items],
            "bad_lines": [b.model_dump() for b in scan_result.bad_lines],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)

        return file_path

    def generate_excel_report(self, scan_result: ScanResult) -> str:
        scan_result.sort_all()
        file_path = f"{self._get_file_prefix(scan_result.scan_id)}.xlsx"

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            self._write_summary_sheet(writer, scan_result)
            self._write_recovery_items_sheet(writer, scan_result.recovery_items)
            self._write_hit_records_sheet(writer, scan_result.hit_records)
            self._write_bad_lines_sheet(writer, scan_result.bad_lines)

        return file_path

    def _write_summary_sheet(self, writer, scan_result: ScanResult):
        summary_data = []
        summary = scan_result.summary

        summary_data.append(["扫描ID", scan_result.scan_id])
        summary_data.append(["扫描日期", scan_result.scan_date.isoformat()])
        summary_data.append(["数据契约总数", summary.get("total_contracts", 0)])
        summary_data.append(["例外规则总数", summary.get("total_exceptions", 0)])
        summary_data.append(["已过期例外数", summary.get("expired_exceptions", 0)])
        summary_data.append(["有命中记录的过期例外", summary.get("expired_with_hits", 0)])
        summary_data.append(["无命中记录的过期例外", summary.get("expired_without_hits", 0)])
        summary_data.append(["需恢复项总数", summary.get("recovery_items_count", 0)])

        df = pd.DataFrame(summary_data, columns=["项目", "数值"])
        df.to_excel(writer, sheet_name="扫描摘要", index=False)

    def _write_recovery_items_sheet(self, writer, recovery_items: List[RecoveryItem]):
        data = []
        for item in recovery_items:
            data.append({
                "规则ID": item.rule_id,
                "字段路径": item.field_path,
                "例外到期日": item.exception_date.isoformat(),
                "例外原因": item.reason,
                "空值率": f"{item.null_rate:.2%}",
                "空值数量": item.null_count,
                "总记录数": item.total_count,
                "恢复状态": item.recovery_status.value,
                "审批备注": item.approval_note or "",
                "审批人": item.approved_by or "",
                "审批时间": item.approved_at.isoformat() if item.approved_at else "",
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="恢复项列表", index=False)

    def _write_hit_records_sheet(self, writer, hit_records: List[HitRecord]):
        data = []
        for record in hit_records:
            samples = "; ".join(str(s) for s in record.sample_values)
            if self.config.max_samples and len(samples) > 500:
                samples = samples[:500] + "..."

            data.append({
                "记录ID": record.record_id,
                "契约ID": record.contract_id,
                "字段路径": record.field_path,
                "规则ID": record.rule_id,
                "空值数量": record.null_count,
                "总记录数": record.total_count,
                "空值率": f"{record.null_rate:.2%}",
                "样本值": samples if self.config.include_samples else "",
                "来源文件": record.source_file,
                "来源行号": record.source_line or 0,
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="命中记录", index=False)

    def _write_bad_lines_sheet(self, writer, bad_lines: List[BadLine]):
        data = []
        for line in bad_lines:
            raw_content = line.raw_content
            if len(raw_content) > 500:
                raw_content = raw_content[:500] + "..."

            data.append({
                "来源文件": line.source_file,
                "行号": line.line_number,
                "原始内容": raw_content,
                "错误信息": line.error_message,
                "错误类型": line.error_type,
            })

        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name="坏行记录", index=False)

    def generate_approval_workflow_report(self, scan_result: ScanResult) -> str:
        scan_result.sort_all()
        file_path = f"{self._get_file_prefix(scan_result.scan_id)}_approval.csv"

        data = []
        for idx, item in enumerate(scan_result.recovery_items):
            data.append({
                "序号": idx + 1,
                "规则ID": item.rule_id,
                "字段路径": item.field_path,
                "例外到期日": item.exception_date.isoformat(),
                "例外原因": item.reason,
                "空值数量": item.null_count,
                "空值率": f"{item.null_rate:.2%}",
                "建议操作": self._get_suggested_action(item),
                "审批状态": item.recovery_status.value,
                "审批意见": "",
                "审批人": "",
                "审批日期": "",
            })

        df = pd.DataFrame(data)
        df.to_csv(file_path, index=False, encoding="utf-8-sig")
        return file_path

    def _get_suggested_action(self, item: RecoveryItem) -> str:
        if item.null_count == 0:
            return "建议立即恢复：无空值，可直接恢复严格校验"
        elif item.null_rate < 0.01:
            return "建议评估恢复：空值率极低，建议逐个处理少量空值后恢复"
        elif item.null_rate < 0.05:
            return "建议谨慎恢复：空值率较低，建议业务评估后可恢复"
        else:
            return "建议延期恢复：空值率较高，建议进一步分析影响"

    def generate_all(self, scan_result: ScanResult) -> Dict[str, str]:
        generated_files = {}

        if "json" in self.config.formats:
            generated_files["json"] = self.generate_json_report(scan_result)

        if "excel" in self.config.formats:
            generated_files["excel"] = self.generate_excel_report(scan_result)

        if "csv" in self.config.formats:
            generated_files["approval_csv"] = self.generate_approval_workflow_report(
                scan_result
            )

        return generated_files

    def print_summary(self, scan_result: ScanResult):
        summary = scan_result.summary
        print("\n" + "=" * 60)
        print("扫描结果摘要")
        print("=" * 60)
        print(f"扫描ID: {scan_result.scan_id}")
        print(f"扫描日期: {scan_result.scan_date}")
        print(f"数据契约总数: {summary.get('total_contracts', 0)}")
        print(f"例外规则总数: {summary.get('total_exceptions', 0)}")
        print(f"已过期例外数: {summary.get('expired_exceptions', 0)}")
        print(f"  - 有命中记录: {summary.get('expired_with_hits', 0)}")
        print(f"  - 无命中记录: {summary.get('expired_without_hits', 0)}")
        print(f"需恢复项总数: {summary.get('recovery_items_count', 0)}")

        pending_count = sum(
            1
            for r in scan_result.recovery_items
            if r.recovery_status == RecoveryStatus.PENDING
        )
        print(f"待审批恢复项: {pending_count}")
        print(f"坏行记录数: {len(scan_result.bad_lines)}")
        print("=" * 60 + "\n")

    def print_recovery_items(self, scan_result: ScanResult):
        print("\n恢复项详情:")
        print("-" * 60)
        for idx, item in enumerate(scan_result.recovery_items, 1):
            print(f"\n{idx}. 规则ID: {item.rule_id}")
            print(f"   字段路径: {item.field_path}")
            print(f"   到期日期: {item.exception_date}")
            print(f"   例外原因: {item.reason}")
            print(f"   空值统计: {item.null_count}/{item.total_count} ({item.null_rate:.2%})")
            print(f"   恢复状态: {item.recovery_status.value}")
        print("-" * 60)
