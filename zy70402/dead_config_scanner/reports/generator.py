import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from ..models.scan import ScanBatch, ScanItem, ScanItemStatus
from ..models.failure import FailureRecord


class ReportGenerator:
    def __init__(self, output_dir: str = "./output/reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_batch_report(self, batch: ScanBatch, failures: List[FailureRecord]) -> str:
        report = {
            "report_type": "batch_scan_report",
            "generated_at": datetime.now().isoformat(),
            "batch_info": {
                "batch_id": batch.batch_id,
                "name": batch.name,
                "created_at": batch.created_at.isoformat(),
                "rule_set_version": batch.rule_set_version,
                "status": batch.status
            },
            "summary": batch.get_summary(),
            "failures": [f.to_dict() for f in failures],
            "boundary_cases": self._extract_boundary_cases(batch.items),
            "items": self._format_items_for_report(batch.items)
        }
        
        report_file = self.output_dir / f"batch_{batch.batch_id}_report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return str(report_file)
    
    def _extract_boundary_cases(self, items: List[ScanItem]) -> List[Dict[str, Any]]:
        boundary_cases = []
        for item in items:
            if item.status in [ScanItemStatus.INVALID, ScanItemStatus.ERROR]:
                boundary_cases.append({
                    "item_id": item.id,
                    "content_hash": item.content_hash,
                    "source": item.source,
                    "input": item.content,
                    "failure_reason": item.error_message,
                    "status": item.status,
                    "rule_versions": item.rule_versions,
                    "metadata": item.metadata
                })
        return boundary_cases
    
    def _format_items_for_report(self, items: List[ScanItem]) -> List[Dict[str, Any]]:
        return [
            {
                "id": item.id,
                "source": item.source,
                "content": item.content,
                "content_hash": item.content_hash,
                "status": item.status,
                "error_message": item.error_message,
                "rule_versions": item.rule_versions
            }
            for item in items
        ]
    
    def generate_human_review_report(self, failures: List[Dict[str, Any]]) -> str:
        unreviewed = [f for f in failures if not f.get("human_reviewed", False)]
        reviewed = [f for f in failures if f.get("human_reviewed", False)]
        
        report = {
            "report_type": "human_review_summary",
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_failures": len(failures),
                "pending_review": len(unreviewed),
                "reviewed": len(reviewed)
            },
            "pending_review": unreviewed,
            "reviewed": reviewed
        }
        
        report_file = self.output_dir / "human_review_report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        return str(report_file)
    
    def generate_text_summary(self, batch: ScanBatch, failures: List[FailureRecord]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append(f"死配置扫描报告 - 批次: {batch.batch_id}")
        lines.append("=" * 60)
        lines.append(f"扫描时间: {batch.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"规则集版本: {batch.rule_set_version}")
        lines.append("")
        
        summary = batch.get_summary()
        lines.append("扫描统计:")
        lines.append(f"  总计: {summary['counts']['total']}")
        lines.append(f"  有效: {summary['counts']['valid']}")
        lines.append(f"  无效: {summary['counts']['invalid']}")
        lines.append(f"  错误: {summary['counts']['error']}")
        lines.append(f"  跳过: {summary['counts']['skipped']}")
        lines.append("")
        
        if failures:
            lines.append(f"失败项 ({len(failures)} 个):")
            lines.append("-" * 60)
            for i, f in enumerate(failures, 1):
                lines.append(f"{i}. 来源: {f.source}")
                lines.append(f"   内容: {f.content}")
                lines.append(f"   原因: {f.failure_reason}")
                lines.append(f"   摘要: {f.content_hash}")
                if f.status_code:
                    lines.append(f"   HTTP状态码: {f.status_code}")
                lines.append("")
        
        summary_file = self.output_dir / f"batch_{batch.batch_id}_summary.txt"
        with open(summary_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return "\n".join(lines)
