import hashlib
import json
from pathlib import Path
from datetime import datetime
import pandas as pd
from typing import List

from .models import ScanResult


class ReportGenerator:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.checksum_file = output_dir / ".scan_checksums.json"
        self.checksums = self._load_checksums()

    def _load_checksums(self) -> dict:
        if self.checksum_file.exists():
            with open(self.checksum_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _save_checksums(self):
        with open(self.checksum_file, 'w', encoding='utf-8') as f:
            json.dump(self.checksums, f, indent=2, ensure_ascii=False)

    def _calculate_file_checksum(self, file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            hasher.update(f.read())
        return hasher.hexdigest()

    def is_file_processed(self, file_path: Path) -> bool:
        checksum = self._calculate_file_checksum(file_path)
        return file_path.name in self.checksums and self.checksums[file_path.name] == checksum

    def mark_file_processed(self, file_path: Path):
        checksum = self._calculate_file_checksum(file_path)
        self.checksums[file_path.name] = checksum
        self._save_checksums()

    def filter_unprocessed_files(self, file_paths: List[Path]) -> List[Path]:
        return [fp for fp in file_paths if not self.is_file_processed(fp)]

    def generate_report(self, result: ScanResult, file_paths: List[Path], report_name: str = None) -> Path:
        if report_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_name = f"审批超时扫描报告_{timestamp}"
        
        base_path = self.output_dir / report_name
        
        records_df = pd.DataFrame([r.to_dict() for r in result.records])
        records_path = base_path.with_suffix(".xlsx")
        
        with pd.ExcelWriter(records_path, engine='openpyxl') as writer:
            records_df.to_excel(writer, sheet_name='审批记录', index=False)
            
            if result.bad_lines:
                bad_lines_df = pd.DataFrame(result.bad_lines)
                bad_lines_df.to_excel(writer, sheet_name='坏行记录', index=False)
            
            summary_data = {
                '统计项': [
                    '总记录数',
                    '超时节点数',
                    '离职节点数',
                    '代理审批数',
                    '时区混乱数',
                    '节点回退数',
                    '坏行数'
                ],
                '数量': [
                    result.total_records,
                    result.timeout_count,
                    result.resigned_count,
                    result.proxy_count,
                    result.timezone_issue_count,
                    result.rollback_count,
                    result.bad_line_count
                ]
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='统计汇总', index=False)
        
        for file_path in file_paths:
            self.mark_file_processed(file_path)
        
        return records_path

    def generate_text_summary(self, result: ScanResult) -> str:
        lines = [
            "=" * 60,
            "    审批导出包加签超时扫描 - 扫描结果汇总",
            "=" * 60,
            "",
            f"扫描时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "统计汇总:",
            f"  总记录数: {result.total_records}",
            f"  超时节点数: {result.timeout_count}",
            f"  离职节点数: {result.resigned_count}",
            f"  代理审批数: {result.proxy_count}",
            f"  时区混乱数: {result.timezone_issue_count}",
            f"  节点回退数: {result.rollback_count}",
            f"  坏行数: {result.bad_line_count}",
            "",
        ]
        
        if result.timeout_count > 0:
            lines.append("超时记录明细:")
            for r in result.records:
                if "超时" in r.status.value:
                    lines.append(f"  [{r.file_name}:{r.line_number}] {r.approval_id} - {r.node_name} - {r.approver}")
            lines.append("")
        
        if result.resigned_count > 0:
            lines.append("离职人员记录:")
            for r in result.records:
                if "离职" in r.status.value:
                    lines.append(f"  [{r.file_name}:{r.line_number}] {r.approval_id} - {r.node_name} - {r.approver}({r.approver_id})")
            lines.append("")
        
        if result.bad_line_count > 0:
            lines.append("坏行记录:")
            for bl in result.bad_lines:
                lines.append(f"  [{bl['原始文件名']}:{bl['行号']}] {bl['错误信息']}")
            lines.append("")
        
        lines.append("=" * 60)
        
        return "\n".join(lines)
