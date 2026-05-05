import os
from datetime import datetime
from typing import Dict, Any, List

from .parser import LogLevel


class MarkdownReporter:
    def __init__(self):
        self.generation_time = datetime.now().isoformat()

    def generate_report(
        self,
        stats: Dict[str, Any],
        incidents_summary: Dict[str, Any],
        bad_lines_count: int,
        archive_path: str,
    ) -> str:
        lines = []
        
        lines.append("# 工厂设备运维事件汇总报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.generation_time}")
        lines.append("")
        
        lines.append("## 概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总行数 | {stats.get('total_lines', 0)} |")
        lines.append(f"| 有效行数 | {stats.get('valid_lines', 0)} |")
        lines.append(f"| 坏行数 | {stats.get('bad_lines', 0)} |")
        lines.append(f"| 涉及设备数 | {len(stats.get('devices', []))} |")
        lines.append(f"| 发现错误码数 | {len(stats.get('error_codes', []))} |")
        lines.append(f"| 事件总数 | {incidents_summary.get('total_incidents', 0)} |")
        lines.append("")
        
        time_range = stats.get("time_range", {})
        if time_range.get("start") and time_range.get("end"):
            lines.append("### 时间范围")
            lines.append("")
            lines.append(f"- 开始时间: {time_range['start']}")
            lines.append(f"- 结束时间: {time_range['end']}")
            lines.append("")
        
        devices = stats.get("devices", [])
        if devices:
            lines.append("### 涉及设备")
            lines.append("")
            for device in sorted(devices):
                lines.append(f"- `{device}`")
            lines.append("")
        
        if incidents_summary.get("total_incidents", 0) > 0:
            lines.append("## 事件详情")
            lines.append("")
            
            by_device = incidents_summary.get("by_device", {})
            if by_device:
                lines.append("### 按设备聚合")
                lines.append("")
                
                for device, device_info in sorted(by_device.items()):
                    count = device_info.get("count", 0)
                    lines.append(f"#### {device} ({count} 条)")
                    lines.append("")
                    
                    errors = device_info.get("errors", {})
                    for error_code, error_info in sorted(errors.items()):
                        err_count = error_info.get("count", 0)
                        lines.append(f"##### {error_code} ({err_count} 次)")
                        lines.append("")
                        
                        log_lines = error_info.get("lines", [])
                        if log_lines:
                            lines.append("| 时间 | 行号 | 级别 | 消息 |")
                            lines.append("|------|------|------|------|")
                            
                            for log_line in sorted(log_lines, key=lambda x: x.get("timestamp", "")):
                                timestamp = log_line.get("timestamp", "-")
                                line_num = log_line.get("line_number", "-")
                                level = log_line.get("level", "-")
                                message = log_line.get("message", "-")
                                
                                message = message.replace("|", "\\|").replace("\n", " ")
                                if len(message) > 80:
                                    message = message[:77] + "..."
                                
                                lines.append(f"| {timestamp} | {line_num} | {level} | {message} |")
                            
                            lines.append("")
                        
                        lines.append("")
            
            by_error = incidents_summary.get("by_error_code", {})
            if by_error:
                lines.append("### 按错误码聚合")
                lines.append("")
                
                for error_code, error_info in sorted(by_error.items()):
                    count = error_info.get("count", 0)
                    devices_list = error_info.get("devices", [])
                    
                    lines.append(f"#### {error_code}")
                    lines.append("")
                    lines.append(f"- 出现次数: {count}")
                    lines.append(f"- 涉及设备: {', '.join(devices_list) if devices_list else '无'}")
                    lines.append("")
            
            timeline = incidents_summary.get("timeline", [])
            if timeline:
                lines.append("### 事件时间线")
                lines.append("")
                lines.append("| 时间 | 设备 | 错误码 | 级别 | 消息 |")
                lines.append("|------|------|--------|------|------|")
                
                for event in timeline[:50]:
                    timestamp = event.get("timestamp", "-")
                    device = event.get("device", "-")
                    error_code = event.get("error_code", "-")
                    level = event.get("level", "-")
                    message = event.get("message", "-")
                    
                    message = message.replace("|", "\\|").replace("\n", " ")
                    if len(message) > 60:
                        message = message[:57] + "..."
                    
                    lines.append(f"| {timestamp} | {device} | {error_code} | {level} | {message} |")
                
                if len(timeline) > 50:
                    lines.append(f"")
                    lines.append(f"*注: 仅显示前 50 条，共 {len(timeline)} 条事件*")
                
                lines.append("")
        
        if bad_lines_count > 0:
            lines.append("## 坏行归档")
            lines.append("")
            lines.append(f"共有 **{bad_lines_count}** 行无法处理或存在问题，已归档至:")
            lines.append("")
            lines.append(f"```")
            lines.append(f"{archive_path}")
            lines.append(f"```")
            lines.append("")
            lines.append("### 坏行原因说明")
            lines.append("")
            lines.append("| 原因类型 | 说明 |")
            lines.append("|----------|------|")
            lines.append("| no_matching_template | 无法匹配任何预定义的正则模板 |")
            lines.append("| time_out_of_order | 时间戳出现倒序 |")
            lines.append("| midnight_crossing_suspicious | 跨午夜时间间隙过大，归属可疑 |")
            lines.append("| missing_timestamp | 缺少时间戳 |")
            lines.append("| empty_line | 空行 |")
            lines.append("| invalid_timestamp_format | 时间戳格式无效 |")
            lines.append("| unknown_log_level | 未知的日志级别 |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由 PLC 日志分析工具自动生成*")
        
        return "\n".join(lines)

    def write_report(self, content: str, output_path: str):
        dir_name = os.path.dirname(output_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        
        return output_path


def generate_incident_summary(
    stats: Dict[str, Any],
    incidents_summary: Dict[str, Any],
    bad_lines_count: int,
    archive_path: str,
    output_path: str,
) -> str:
    reporter = MarkdownReporter()
    content = reporter.generate_report(
        stats=stats,
        incidents_summary=incidents_summary,
        bad_lines_count=bad_lines_count,
        archive_path=archive_path,
    )
    reporter.write_report(content, output_path)
    return output_path
