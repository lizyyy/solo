import json
from pathlib import Path
from typing import Optional

from .models import ProcessResult


class OutputFormatter:
    @staticmethod
    def to_json(result: ProcessResult, indent: int = 2) -> str:
        return json.dumps(result.model_dump(mode="json"), ensure_ascii=False, indent=indent)

    @staticmethod
    def to_markdown(result: ProcessResult) -> str:
        lines = [
            "# IoT设备回执处理报告",
            "",
            f"**批次ID**: `{result.batch_id}`",
            "",
            f"**处理时间**: {result.processed_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            f"**缓存状态**: {'使用缓存结果' if result.is_cached else '新处理结果'}",
            "",
            "## 统计概览",
            "",
            "| 指标 | 数量 |",
            "|------|------|",
            f"| 总记录数 | {result.total_count} |",
            f"| 正常记录 | {result.normal_count} |",
            f"| 异常记录 | {result.abnormal_count} |",
            f"| 失败记录 | {result.failed_count} |",
            "",
        ]

        if result.normal_count > 0:
            lines.extend([
                "## 正常记录",
                "",
                "| 设备ID | 回执ID | 类型 | 时间 | 时区偏移 |",
                "|--------|--------|------|------|----------|",
            ])
            for r in result.receipts:
                if r.status == "normal":
                    time_str = r.parsed_time.strftime('%Y-%m-%d %H:%M:%S') if r.parsed_time else "N/A"
                    lines.append(f"| {r.device_id} | {r.receipt_id} | {r.receipt_type} | {time_str} | {r.timezone_offset}分钟 |")
            lines.append("")

        if result.abnormal_count > 0:
            lines.extend([
                "## 时区异常记录",
                "",
                "| 设备ID | 回执ID | 类型 | 原始时间戳 | 错误信息 |",
                "|--------|--------|------|------------|----------|",
            ])
            for r in result.receipts:
                if r.status == "abnormal":
                    lines.append(f"| {r.device_id} | {r.receipt_id} | {r.receipt_type} | {r.timestamp} | {r.error_message} |")
            lines.append("")

        if result.failed_count > 0:
            lines.extend([
                "## 失败记录",
                "",
                "| 设备ID | 回执ID | 原始时间戳 | 错误信息 |",
                "|--------|--------|------------|----------|",
            ])
            for r in result.receipts:
                if r.status == "failed":
                    lines.append(f"| {r.device_id} | {r.receipt_id} | {r.timestamp} | {r.error_message} |")
            lines.append("")

        lines.extend([
            "## 说明",
            "",
            "- **正常记录**: 时区偏移在允许范围内（±60分钟）",
            "- **异常记录**: 时区偏移超出允许范围",
            "- **失败记录**: 解析失败或缺少必要信息",
        ])

        return "\n".join(lines)

    @staticmethod
    def save_to_file(result: ProcessResult, output_path: str, format_type: str = "json") -> Path:
        path = Path(output_path)
        
        if format_type == "json":
            content = OutputFormatter.to_json(result)
            if not path.suffix:
                path = path.with_suffix(".json")
        elif format_type == "markdown":
            content = OutputFormatter.to_markdown(result)
            if not path.suffix:
                path = path.with_suffix(".md")
        else:
            raise ValueError(f"不支持的输出格式: {format_type}")
        
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return path
