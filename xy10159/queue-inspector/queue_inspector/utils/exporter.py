import csv
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..core.models import CompensationMessage, CleanupSuggestion, InspectionReport


class ReportExporter:
    @staticmethod
    def to_json(data: Any, file_path: str) -> None:
        def default_serializer(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if hasattr(obj, "model_dump"):
                return obj.model_dump()
            if hasattr(obj, "value"):
                return obj.value
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, default=default_serializer, ensure_ascii=False, indent=2)
    
    @staticmethod
    def messages_to_csv(messages: List[CompensationMessage], file_path: str) -> None:
        fieldnames = [
            "id", "topic", "status", "retry_count", "max_retries",
            "error_category", "last_error_message", "idempotent_key",
            "created_at", "updated_at", "first_failed_at", "last_failed_at",
        ]
        
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for msg in messages:
                writer.writerow({
                    "id": msg.id,
                    "topic": msg.topic,
                    "status": msg.status.value,
                    "retry_count": msg.retry_count,
                    "max_retries": msg.max_retries,
                    "error_category": msg.error_category.value if msg.error_category else "",
                    "last_error_message": msg.last_error_message or "",
                    "idempotent_key": msg.idempotent_key or "",
                    "created_at": msg.created_at.isoformat() if msg.created_at else "",
                    "updated_at": msg.updated_at.isoformat() if msg.updated_at else "",
                    "first_failed_at": msg.first_failed_at.isoformat() if msg.first_failed_at else "",
                    "last_failed_at": msg.last_failed_at.isoformat() if msg.last_failed_at else "",
                })
    
    @staticmethod
    def suggestions_to_csv(suggestions: List[CleanupSuggestion], file_path: str) -> None:
        fieldnames = [
            "message_id", "topic", "reason", "risk_level", 
            "suggestion", "safe_to_delete",
        ]
        
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for s in suggestions:
                writer.writerow({
                    "message_id": s.message_id,
                    "topic": s.topic,
                    "reason": s.reason,
                    "risk_level": s.risk_level,
                    "suggestion": s.suggestion,
                    "safe_to_delete": str(s.safe_to_delete),
                })
    
    @staticmethod
    def generate_markdown_report(report: InspectionReport, file_path: str) -> None:
        lines = []
        lines.append("# 队列巡检报告")
        lines.append("")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("## 概览")
        lines.append("")
        lines.append(f"- 消息总数: {report.total_messages}")
        lines.append(f"- 永久失败数: {report.permanent_failures}")
        lines.append(f"- 最老消息时长: {report.oldest_message_age_hours} 小时")
        lines.append(f"- 平均重试次数: {report.avg_retry_count}")
        lines.append("")
        
        lines.append("## 按状态分布")
        lines.append("")
        lines.append("| 状态 | 数量 |")
        lines.append("|------|------|")
        for status, count in report.by_status.items():
            lines.append(f"| {status.value} | {count} |")
        lines.append("")
        
        lines.append("## 按主题分布")
        lines.append("")
        lines.append("| 主题 | 数量 |")
        lines.append("|------|------|")
        for topic, count in report.by_topic.items():
            lines.append(f"| {topic} | {count} |")
        lines.append("")
        
        if report.by_error_category:
            lines.append("## 按错误类型分布")
            lines.append("")
            lines.append("| 错误类型 | 数量 |")
            lines.append("|----------|------|")
            for category, count in report.by_error_category.items():
                lines.append(f"| {category} | {count} |")
            lines.append("")
        
        if report.duplicate_keys:
            lines.append("## 重复幂等键")
            lines.append("")
            for key in report.duplicate_keys:
                lines.append(f"- `{key}`")
            lines.append("")
        
        if report.cleanup_suggestions:
            lines.append("## 清理建议")
            lines.append("")
            lines.append("| 消息ID | 主题 | 风险等级 | 原因 | 建议 | 可安全删除 |")
            lines.append("|--------|------|----------|------|------|------------|")
            for s in report.cleanup_suggestions:
                lines.append(
                    f"| {s.message_id} | {s.topic} | {s.risk_level} | "
                    f"{s.reason} | {s.suggestion} | {s.safe_to_delete} |"
                )
            lines.append("")
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
