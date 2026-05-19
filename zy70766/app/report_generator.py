from io import StringIO
from datetime import datetime
from typing import List
from app.models import PreviewReport, PreviewHit
import csv


class ReportGenerator:
    @staticmethod
    def format_size(size_bytes: int) -> str:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.2f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.2f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

    @staticmethod
    def generate_csv(report: PreviewReport, hits: List[PreviewHit]) -> str:
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(["预演报告摘要"])
        writer.writerow(["报告名称", report.name])
        writer.writerow(["报告ID", report.id])
        writer.writerow(["规则ID", report.rule_id])
        writer.writerow(["状态", report.status])
        writer.writerow(["创建时间", report.created_at.isoformat() if report.created_at else ""])
        writer.writerow(["总对象数", report.total_objects])
        writer.writerow(["命中对象数", report.hit_objects])
        writer.writerow(["总大小(字节)", report.total_size])
        writer.writerow(["命中大小(字节)", report.hit_size])
        writer.writerow([])
        writer.writerow(["命中对象详情"])
        writer.writerow([
            "对象键",
            "命中原因",
            "动作",
            "预计删除时间",
            "对象大小(字节)",
            "最后修改时间"
        ])

        for hit in hits:
            writer.writerow([
                hit.object_key,
                hit.hit_reason,
                hit.action,
                hit.estimated_deletion_date.isoformat() if hit.estimated_deletion_date else "",
                hit.object_size,
                hit.last_modified.isoformat() if hit.last_modified else ""
            ])

        return output.getvalue()

    @staticmethod
    def generate_markdown(report: PreviewReport, hits: List[PreviewHit]) -> str:
        lines = []

        lines.append(f"# 生命周期删除预演报告: {report.name}")
        lines.append("")
        lines.append("## 报告摘要")
        lines.append("")
        lines.append("| 项目 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 报告ID | {report.id} |")
        lines.append(f"| 规则ID | {report.rule_id} |")
        lines.append(f"| 状态 | {report.status} |")
        lines.append(f"| 创建时间 | {report.created_at.isoformat() if report.created_at else '-'} |")
        lines.append(f"| 总对象数 | {report.total_objects} |")
        lines.append(f"| 命中对象数 | {report.hit_objects} |")
        lines.append(f"| 总大小 | {ReportGenerator.format_size(report.total_size)} |")
        lines.append(f"| 命中大小 | {ReportGenerator.format_size(report.hit_size)} |")
        lines.append("")

        if report.requires_manual_review:
            lines.append("## ⚠️ 需要人工复核")
            lines.append("")
            lines.append(f"**原因**: {report.review_reason or '未提供'}")
            lines.append("")

        lines.append("## 命中对象详情")
        lines.append("")
        lines.append("| 对象键 | 命中原因 | 动作 | 预计删除时间 | 对象大小 | 最后修改时间 |")
        lines.append("|---------|----------|------|--------------|----------|--------------|")

        for hit in hits[:100]:
            size_str = ReportGenerator.format_size(hit.object_size)
            lines.append(
                f"| {hit.object_key} | {hit.hit_reason} | {hit.action} | "
                f"{hit.estimated_deletion_date.isoformat() if hit.estimated_deletion_date else '-'} | "
                f"{size_str} | {hit.last_modified.isoformat() if hit.last_modified else '-'} |"
            )

        if len(hits) > 100:
            lines.append("")
            lines.append(f"> 注：仅显示前100条记录，共{len(hits)}条命中记录")

        lines.append("")
        lines.append("## 统计分析")
        lines.append("")
        lines.append(f"- **命中率**: {(report.hit_objects / report.total_objects * 100):.2f}% (前提是总对象数 > 0)" if report.total_objects > 0 else "- **命中率**: 无数据")
        lines.append(f"- **命中存储占比**: {(report.hit_size / report.total_size * 100):.2f}% (前提是总大小 > 0)" if report.total_size > 0 else "- **命中存储占比**: 无数据")

        return "\n".join(lines)
