import csv
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .executor import ExecutionJournal
from .planner import DeliveryPlan
from .utils import ensure_dir


@dataclass
class ReportOutput:
    markdown_path: Optional[Path] = None
    csv_path: Optional[Path] = None
    json_path: Optional[Path] = None


class DeliveryReporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        ensure_dir(output_dir)
    
    def generate_report(
        self,
        plan: Optional[DeliveryPlan] = None,
        journal: Optional[ExecutionJournal] = None,
        report_id: Optional[str] = None
    ) -> ReportOutput:
        import uuid
        report_id = report_id or f"RPT-{uuid.uuid4().hex[:8]}"
        
        markdown_path = self.output_dir / f"report-{report_id}.md"
        csv_path = self.output_dir / f"devices-{report_id}.csv"
        json_path = self.output_dir / f"audit-{report_id}.json"
        
        if plan or journal:
            self._write_markdown_report(markdown_path, plan, journal, report_id)
        
        if journal:
            self._write_device_csv(csv_path, journal)
        
        if plan or journal:
            self._write_audit_json(json_path, plan, journal, report_id)
        
        return ReportOutput(
            markdown_path=markdown_path,
            csv_path=csv_path,
            json_path=json_path
        )
    
    def _write_markdown_report(
        self,
        path: Path,
        plan: Optional[DeliveryPlan],
        journal: Optional[ExecutionJournal],
        report_id: str
    ):
        lines = []
        
        lines.append("# 固件校准包投递报告")
        lines.append("")
        lines.append(f"- **报告ID**: {report_id}")
        lines.append(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if plan:
            lines.append("## 投递计划概览")
            lines.append("")
            lines.append(f"- **计划ID**: {plan.plan_id}")
            lines.append(f"- **创建时间**: {plan.created_at}")
            lines.append(f"- **目标区域**: {', '.join(plan.target_regions) if plan.target_regions else '全部'}")
            lines.append(f"- **设备总数**: {plan.devices_count}")
            lines.append(f"- **包总数**: {plan.packages_count}")
            lines.append("")
            
            if plan.has_blockers():
                lines.append("## ⚠️ 阻断项")
                lines.append("")
                for issue in plan.blocking_issues:
                    lines.append(f"### {issue.code}")
                    lines.append(f"")
                    lines.append(f"- **消息**: {issue.message}")
                    if issue.device_id:
                        lines.append(f"- **设备**: {issue.device_id}")
                    if issue.package_id:
                        lines.append(f"- **包**: {issue.package_id}")
                    lines.append("")
            
            if plan.items:
                lines.append("## 投递明细")
                lines.append("")
                lines.append("| 设备号 | 型号 | 区域 | 目标版本 | 负责人 | 状态 |")
                lines.append("|--------|------|------|----------|--------|------|")
                for item in plan.items:
                    lines.append(
                        f"| {item.device_id} | {item.device_model} | {item.region} | "
                        f"{item.firmware_version} | {item.owner or '-'} | 计划中 |"
                    )
                lines.append("")
        
        if journal:
            lines.append("## 执行结果")
            lines.append("")
            lines.append(f"- **执行ID**: {journal.journal_id}")
            lines.append(f"- **执行类型**: {journal.execution_type}")
            lines.append(f"- **开始时间**: {journal.started_at}")
            lines.append(f"- **完成时间**: {journal.completed_at}")
            lines.append(f"- **成功**: {journal.success_count}")
            lines.append(f"- **失败**: {journal.failure_count}")
            lines.append("")
            
            lines.append("### 设备执行明细")
            lines.append("")
            lines.append("| 设备号 | 状态 | 复制文件 | 验证文件 | 错误 |")
            lines.append("|--------|------|----------|----------|------|")
            for result in journal.results:
                status = "✅ 成功" if result.success else "❌ 失败"
                errors = "; ".join(result.errors) if result.errors else "-"
                lines.append(
                    f"| {result.device_id} | {status} | "
                    f"{len(result.files_copied)} | {len(result.files_verified)} | {errors} |"
                )
            lines.append("")
            
            if journal.results:
                lines.append("### 详细日志")
                lines.append("")
                for result in journal.results:
                    status_emoji = "✅" if result.success else "❌"
                    lines.append(f"#### {status_emoji} 设备 {result.device_id}")
                    lines.append("")
                    lines.append(f"- **状态**: {'成功' if result.success else '失败'}")
                    lines.append(f"- **复制文件**: {', '.join(result.files_copied)}")
                    lines.append(f"- **验证文件**: {', '.join(result.files_verified)}")
                    if result.errors:
                        lines.append(f"- **错误**: {', '.join(result.errors)}")
                    lines.append("")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    
    def _write_device_csv(self, path: Path, journal: ExecutionJournal):
        fieldnames = [
            "设备号", "状态", "开始时间", "完成时间",
            "复制文件数", "验证文件数", "复制文件列表", "错误信息"
        ]
        
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for result in journal.results:
                writer.writerow({
                    "设备号": result.device_id,
                    "状态": "成功" if result.success else "失败",
                    "开始时间": result.started_at,
                    "完成时间": result.completed_at,
                    "复制文件数": len(result.files_copied),
                    "验证文件数": len(result.files_verified),
                    "复制文件列表": ", ".join(result.files_copied),
                    "错误信息": "; ".join(result.errors) if result.errors else ""
                })
    
    def _write_audit_json(
        self,
        path: Path,
        plan: Optional[DeliveryPlan],
        journal: Optional[ExecutionJournal],
        report_id: str
    ):
        audit_data = {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "plan": plan.to_dict() if plan else None,
            "journal": journal.to_dict() if journal else None
        }
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, indent=2, ensure_ascii=False)
