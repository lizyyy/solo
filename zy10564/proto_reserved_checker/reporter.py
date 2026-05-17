import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from dataclasses import dataclass, field

from .detector import RiskItem, RiskLevel, RiskType
from .parser import ProtoFile


@dataclass
class ReportStats:
    total_risks: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    by_type: Dict[str, int] = field(default_factory=dict)
    by_file: Dict[str, int] = field(default_factory=dict)


@dataclass
class CheckResult:
    proto_file: ProtoFile
    historical_file: Optional[ProtoFile]
    risks: List[RiskItem]
    checked_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def calculate_stats(self) -> ReportStats:
        stats = ReportStats()
        stats.total_risks = len(self.risks)

        for risk in self.risks:
            if risk.level == RiskLevel.CRITICAL:
                stats.critical_count += 1
            elif risk.level == RiskLevel.HIGH:
                stats.high_count += 1
            elif risk.level == RiskLevel.MEDIUM:
                stats.medium_count += 1
            elif risk.level == RiskLevel.LOW:
                stats.low_count += 1

            risk_type_str = risk.risk_type.value
            stats.by_type[risk_type_str] = stats.by_type.get(risk_type_str, 0) + 1

            file_key = os.path.basename(risk.file_path)
            stats.by_file[file_key] = stats.by_file.get(file_key, 0) + 1

        return stats

    def to_dict(self) -> Dict:
        stats = self.calculate_stats()
        return {
            "checked_at": self.checked_at,
            "proto_file": os.path.basename(self.proto_file.path),
            "proto_file_path": self.proto_file.path,
            "has_historical": self.historical_file is not None,
            "stats": {
                "total_risks": stats.total_risks,
                "by_level": {
                    "critical": stats.critical_count,
                    "high": stats.high_count,
                    "medium": stats.medium_count,
                    "low": stats.low_count
                },
                "by_type": stats.by_type,
                "by_file": stats.by_file
            },
            "risks": [r.to_dict() for r in self.risks]
        }


class Reporter:
    def __init__(self):
        self._level_emojis = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢"
        }

        self._type_descriptions = {
            RiskType.FIELD_NUMBER_REUSE: "字段编号复用（兼容性破坏）",
            RiskType.RESERVED_MISSING_FOR_DELETED: "删除字段未添加 reserved",
            RiskType.FIELD_IN_RESERVED_RANGE: "字段使用了 reserved 编号",
            RiskType.DUPLICATE_FIELD_NUMBER: "字段编号重复定义",
            RiskType.RESERVED_NAME_CONFLICT: "字段名与 reserved 名称冲突"
        }

    def generate_terminal_summary(self, result: CheckResult, detailed: bool = False) -> str:
        lines = []
        stats = result.calculate_stats()

        lines.append("=" * 60)
        lines.append("  Protobuf 字段保留检查报告")
        lines.append("=" * 60)
        lines.append(f"  检查时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  文件: {os.path.basename(result.proto_file.path)}")
        if result.historical_file:
            lines.append(f"  历史版本: {os.path.basename(result.historical_file.path)}")
        lines.append("")

        lines.append("  📊 风险统计:")
        lines.append(f"    总计: {stats.total_risks} 个风险项")
        lines.append(f"    🔴 严重: {stats.critical_count}")
        lines.append(f"    🟠 高:   {stats.high_count}")
        lines.append(f"    🟡 中:   {stats.medium_count}")
        lines.append(f"    🟢 低:   {stats.low_count}")
        lines.append("")

        if stats.by_type:
            lines.append("  📋 按风险类型分布:")
            for risk_type, count in stats.by_type.items():
                desc = self._type_descriptions.get(RiskType(risk_type), risk_type)
                lines.append(f"    - {desc}: {count}")
            lines.append("")

        if result.risks:
            lines.append("  ⚠️  风险详情:")
            lines.append("")

            sorted_risks = sorted(
                result.risks,
                key=lambda r: ["critical", "high", "medium", "low"].index(r.level.value)
            )

            for i, risk in enumerate(sorted_risks, 1):
                emoji = self._level_emojis.get(risk.level, "❓")
                lines.append(f"  {emoji} [{i}] {risk.message}")
                lines.append(f"      文件: {os.path.basename(risk.file_path)}:{risk.line}")
                if risk.message_name:
                    lines.append(f"      消息: {risk.message_name}")
                if risk.raw_line:
                    lines.append(f"      代码: {risk.raw_line.strip()}")

                if detailed and risk.details:
                    for key, value in risk.details.items():
                        lines.append(f"      {key}: {value}")
                lines.append("")

        else:
            lines.append("  ✅ 未发现任何风险!")
            lines.append("")

        if stats.total_risks > 0:
            lines.append("  💡 建议:")
            if stats.critical_count > 0:
                lines.append("    - 请立即修复严重风险，防止兼容性问题")
            if stats.high_count > 0:
                lines.append("    - 建议尽快修复高优先级风险")
            lines.append("    - 删除字段后务必添加 reserved 声明")
            lines.append("")

        lines.append("=" * 60)

        return "\n".join(lines)

    def generate_json_report(self, result: CheckResult, output_path: Optional[str] = None) -> str:
        data = result.to_dict()
        json_str = json.dumps(data, ensure_ascii=False, indent=2)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(json_str)

        return json_str

    def generate_markdown_report(self, result: CheckResult, output_path: Optional[str] = None) -> str:
        lines = []
        stats = result.calculate_stats()

        lines.append("# Protobuf 字段保留检查报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 基本信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 检查文件 | `{os.path.basename(result.proto_file.path)}` |")
        lines.append(f"| 文件路径 | `{result.proto_file.path}` |")
        if result.historical_file:
            lines.append(f"| 历史对比文件 | `{os.path.basename(result.historical_file.path)}` |")
        else:
            lines.append("| 历史对比 | 未提供 |")
        lines.append(f"| 消息数量 | {len(result.proto_file.get_all_messages())} |")
        lines.append("")

        lines.append("## 风险统计")
        lines.append("")
        lines.append("| 风险等级 | 数量 | 标记 |")
        lines.append("|----------|------|------|")
        lines.append(f"| 严重 (Critical) | {stats.critical_count} | 🔴 |")
        lines.append(f"| 高 (High) | {stats.high_count} | 🟠 |")
        lines.append(f"| 中 (Medium) | {stats.medium_count} | 🟡 |")
        lines.append(f"| 低 (Low) | {stats.low_count} | 🟢 |")
        lines.append(f"| **总计** | **{stats.total_risks}** | |")
        lines.append("")

        if stats.by_type:
            lines.append("## 按风险类型统计")
            lines.append("")
            lines.append("| 风险类型 | 数量 | 说明 |")
            lines.append("|----------|------|------|")
            for risk_type_str, count in stats.by_type.items():
                risk_type = RiskType(risk_type_str)
                desc = self._type_descriptions.get(risk_type, risk_type_str)
                lines.append(f"| {risk_type_str} | {count} | {desc} |")
            lines.append("")

        if result.risks:
            lines.append("## 风险详情")
            lines.append("")

            sorted_risks = sorted(
                result.risks,
                key=lambda r: ["critical", "high", "medium", "low"].index(r.level.value)
            )

            for i, risk in enumerate(sorted_risks, 1):
                emoji = self._level_emojis.get(risk.level, "❓")
                level_display = {
                    RiskLevel.CRITICAL: "严重",
                    RiskLevel.HIGH: "高",
                    RiskLevel.MEDIUM: "中",
                    RiskLevel.LOW: "低"
                }.get(risk.level, risk.level.value)

                lines.append(f"### {emoji} [{i}] {level_display} - {risk.message}")
                lines.append("")
                lines.append("| 项 | 值 |")
                lines.append("|----|----|")
                lines.append(f"| 风险类型 | `{risk.risk_type.value}` |")
                lines.append(f"| 文件 | `{os.path.basename(risk.file_path)}:{risk.line}` |")
                if risk.message_name:
                    lines.append(f"| 消息 | `{risk.message_name}` |")
                if risk.field_name:
                    lines.append(f"| 字段 | `{risk.field_name}` |")
                if risk.field_number is not None:
                    lines.append(f"| 字段编号 | `{risk.field_number}` |")
                lines.append("")

                if risk.raw_line:
                    lines.append("**问题代码:**")
                    lines.append("")
                    lines.append("```protobuf")
                    lines.append(risk.raw_line.rstrip())
                    lines.append("```")
                    lines.append("")

                if risk.details:
                    lines.append("**详细信息:**")
                    lines.append("")
                    for key, value in risk.details.items():
                        lines.append(f"- **{key}**: {value}")
                    lines.append("")

                lines.append("---")
                lines.append("")

        lines.append("## 总结与建议")
        lines.append("")

        if stats.total_risks == 0:
            lines.append("✅ **通过检查** - 未发现任何 Protobuf 字段保留相关问题!")
            lines.append("")
        else:
            lines.append("⚠️ **发现风险，建议修复**")
            lines.append("")

            if stats.critical_count > 0:
                lines.append("### 🔴 立即处理")
                lines.append("- 严重问题可能导致线上数据解析错误")
                lines.append("- 字段编号复用会破坏新旧版本兼容性")
                lines.append("")

            if stats.high_count > 0:
                lines.append("### 🟠 尽快处理")
                lines.append("- 删除字段后务必添加 reserved 声明")
                lines.append("- 防止未来字段编号复用导致的问题")
                lines.append("")

            lines.append("### 📝 最佳实践")
            lines.append("1. 删除字段后，立即添加 `reserved` 声明编号")
            lines.append('2. 同时也可以 `reserved "field_name";` 保留字段名')
            lines.append("3. 对于范围删除，可以使用 `reserved start to end;`")
            lines.append("4. 定期运行本工具检查 proto 文件完整性")
            lines.append("")

        lines.append("## 附录: 什么是 reserved?")
        lines.append("")
        lines.append("在 Protobuf 中，当你删除一个字段后，应该使用 `reserved` 关键字来保留该字段的编号（和/或名称）。")
        lines.append("这样可以防止未来有人复用这个编号，从而避免版本兼容性问题。")
        lines.append("")
        lines.append("```protobuf")
        lines.append("message Foo {")
        lines.append("  reserved 2, 15, 9 to 11;")
        lines.append('  reserved "foo", "bar";')
        lines.append("}")
        lines.append("```")
        lines.append("")

        markdown_content = "\n".join(lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)

        return markdown_content
