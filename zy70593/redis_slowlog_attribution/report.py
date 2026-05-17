import json
from typing import List, Dict, Any, TextIO

from .analysis import AnalysisResult


class TerminalReporter:
    def __init__(self, result: AnalysisResult):
        self.result = result

    def print_summary(self, output=None):
        lines = []
        
        lines.append("=" * 70)
        lines.append("Redis Slowlog 归因分析报告")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append("📊 总体统计")
        lines.append("-" * 40)
        lines.append(f"  慢查询总数: {self.result.total_entries}")
        lines.append(f"  解析错误数: {self.result.total_errors}")
        lines.append(f"  总耗时: {self.result.total_duration_us / 1000000:.2f}s")
        lines.append(f"  平均耗时: {self.result.avg_duration_ms:.2f}ms")
        lines.append(f"  最大耗时: {self.result.max_duration_ms:.2f}ms")
        lines.append(f"  最小耗时: {self.result.min_duration_ms:.2f}ms")
        lines.append("")
        
        lines.append("⏱️  耗时分布")
        lines.append("-" * 40)
        for bucket in self.result.duration_distribution:
            if bucket.count > 0:
                pct = (bucket.count / self.result.total_entries) * 100 if self.result.total_entries > 0 else 0
                bar = "█" * int(pct / 5)
                lines.append(f"  {bucket.name:12} {bucket.count:5} ({pct:5.1f}%) {bar}")
        lines.append("")
        
        lines.append("🔑 最热Key模式 (Top 10)")
        lines.append("-" * 40)
        for i, pattern in enumerate(self.result.key_patterns[:10], 1):
            cmd_str = ",".join(list(pattern.commands)[:3])
            lines.append(f"  {i:2}. {pattern.pattern}")
            lines.append(f"      次数: {pattern.count}, 平均: {pattern.avg_duration_ms:.2f}ms, 命令: {cmd_str}")
            if pattern.sample_keys:
                sample_str = ", ".join(pattern.sample_keys[:3])
                lines.append(f"      示例: {sample_str}")
        lines.append("")
        
        lines.append("📞 调用方统计")
        lines.append("-" * 40)
        for i, caller in enumerate(self.result.caller_stats[:10], 1):
            top_cmds = sorted(caller.commands.items(), key=lambda x: -x[1])[:3]
            cmd_str = ",".join([f"{k}({v})" for k, v in top_cmds])
            lines.append(f"  {i:2}. {caller.label:20} 次数:{caller.count:5} 平均:{caller.avg_duration_ms:.2f}ms")
            lines.append(f"      命令: {cmd_str}")
        lines.append("")
        
        lines.append("⚡ 最慢的查询 (Top 10)")
        lines.append("-" * 40)
        for i, entry in enumerate(self.result.slowest_entries[:10], 1):
            key_str = ",".join(entry.keys[:2]) if entry.keys else "N/A"
            lines.append(f"  {i:2}. #{entry.id} [{entry.command}] {key_str}")
            lines.append(f"      耗时: {entry.duration_ms:.2f}ms")
        lines.append("")
        
        if self.result.errors:
            lines.append("❌ 解析错误")
            lines.append("-" * 40)
            for err in self.result.errors[:5]:
                lines.append(f"  行 {err.line_number}: {err.error_reason}")
                lines.append(f"      原始内容: {err.raw_content[:50]}..." if len(err.raw_content) > 50 else f"      原始内容: {err.raw_content}")
            if len(self.result.errors) > 5:
                lines.append(f"  ... 还有 {len(self.result.errors) - 5} 个错误")
            lines.append("")
        
        text = "\n".join(lines)
        
        if output:
            if isinstance(output, str):
                with open(output, 'w', encoding='utf-8') as f:
                    f.write(text)
            else:
                print(text, file=output)
        else:
            print(text)


class MachineReadableReporter:
    def __init__(self, result: AnalysisResult):
        self.result = result

    def _serialize_entry(self, entry) -> Dict[str, Any]:
        return {
            "id": entry.id,
            "timestamp": entry.timestamp,
            "duration_us": entry.duration_us,
            "duration_ms": entry.duration_ms,
            "command": entry.command,
            "args": entry.args,
            "keys": entry.keys,
            "client_ip": entry.client_ip,
            "client_name": entry.client_name,
            "line_number": entry.line_number
        }

    def _serialize_error(self, error) -> Dict[str, Any]:
        return {
            "line_number": error.line_number,
            "raw_content": error.raw_content,
            "error_reason": error.error_reason
        }

    def to_dict(self) -> Dict[str, Any]:
        return {
            "summary": {
                "total_entries": self.result.total_entries,
                "total_errors": self.result.total_errors,
                "total_duration_us": self.result.total_duration_us,
                "avg_duration_ms": self.result.avg_duration_ms,
                "max_duration_ms": self.result.max_duration_ms,
                "min_duration_ms": self.result.min_duration_ms
            },
            "duration_distribution": [
                {
                    "name": b.name,
                    "min_us": b.min_us,
                    "max_us": b.max_us,
                    "count": b.count,
                    "total_duration_us": b.total_duration_us,
                    "avg_duration_ms": b.avg_duration_ms
                }
                for b in self.result.duration_distribution
            ],
            "command_stats": [
                {
                    "command": s.command,
                    "count": s.count,
                    "total_duration_us": s.total_duration_us,
                    "avg_duration_ms": s.avg_duration_ms,
                    "max_duration_ms": s.max_duration_ms
                }
                for s in self.result.command_stats
            ],
            "key_patterns": [
                {
                    "pattern": p.pattern,
                    "count": p.count,
                    "total_duration_us": p.total_duration_us,
                    "avg_duration_ms": p.avg_duration_ms,
                    "sample_keys": p.sample_keys,
                    "commands": list(p.commands)
                }
                for p in self.result.key_patterns
            ],
            "caller_stats": [
                {
                    "label": c.label,
                    "count": c.count,
                    "total_duration_us": c.total_duration_us,
                    "avg_duration_ms": c.avg_duration_ms,
                    "commands": dict(c.commands),
                    "top_key_patterns": sorted(c.key_patterns.items(), key=lambda x: -x[1])[:10]
                }
                for c in self.result.caller_stats
            ],
            "slowest_entries": [self._serialize_entry(e) for e in self.result.slowest_entries],
            "errors": [self._serialize_error(e) for e in self.result.errors]
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def write_json(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.to_json())


class MarkdownReporter:
    def __init__(self, result: AnalysisResult):
        self.result = result

    def generate(self) -> str:
        lines = []
        
        lines.append("# Redis Slowlog 归因分析报告")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 📊 总体统计")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 慢查询总数 | {self.result.total_entries} |")
        lines.append(f"| 解析错误数 | {self.result.total_errors} |")
        lines.append(f"| 总耗时 | {self.result.total_duration_us / 1000000:.2f}s |")
        lines.append(f"| 平均耗时 | {self.result.avg_duration_ms:.2f}ms |")
        lines.append(f"| 最大耗时 | {self.result.max_duration_ms:.2f}ms |")
        lines.append(f"| 最小耗时 | {self.result.min_duration_ms:.2f}ms |")
        lines.append("")
        
        lines.append("## ⏱️  耗时分布")
        lines.append("")
        lines.append("| 耗时区间 | 数量 | 占比 |")
        lines.append("|----------|------|------|")
        for bucket in self.result.duration_distribution:
            pct = (bucket.count / self.result.total_entries) * 100 if self.result.total_entries > 0 else 0
            lines.append(f"| {bucket.name} | {bucket.count} | {pct:.1f}% |")
        lines.append("")
        
        lines.append("## 🔑 Key模式分析 (Top 10)")
        lines.append("")
        lines.append("| 排名 | 模式 | 次数 | 平均耗时 | 命令 | 示例Key |")
        lines.append("|------|------|------|----------|------|---------|")
        for i, p in enumerate(self.result.key_patterns[:10], 1):
            cmds = ",".join(list(p.commands)[:3])
            samples = ", ".join(p.sample_keys[:3])
            lines.append(f"| {i} | `{p.pattern}` | {p.count} | {p.avg_duration_ms:.2f}ms | {cmds} | {samples} |")
        lines.append("")
        
        lines.append("## 📞 调用方统计")
        lines.append("")
        lines.append("| 排名 | 调用方 | 次数 | 平均耗时 | 主要命令 |")
        lines.append("|------|--------|------|----------|----------|")
        for i, c in enumerate(self.result.caller_stats[:10], 1):
            top_cmds = sorted(c.commands.items(), key=lambda x: -x[1])[:3]
            cmd_str = ", ".join([f"{k}({v})" for k, v in top_cmds])
            lines.append(f"| {i} | `{c.label}` | {c.count} | {c.avg_duration_ms:.2f}ms | {cmd_str} |")
        lines.append("")
        
        lines.append("## ⚡ 最慢查询 (Top 10)")
        lines.append("")
        lines.append("| 排名 | 命令 | Key | 耗时 |")
        lines.append("|------|------|-----|------|")
        for i, e in enumerate(self.result.slowest_entries[:10], 1):
            key_str = ", ".join(e.keys[:2]) if e.keys else "N/A"
            lines.append(f"| {i} | `{e.command}` | `{key_str}` | {e.duration_ms:.2f}ms |")
        lines.append("")
        
        if self.result.errors:
            lines.append("## ❌ 解析错误")
            lines.append("")
            lines.append("| 行号 | 错误原因 | 原始内容片段 |")
            lines.append("|------|----------|--------------|")
            for e in self.result.errors[:10]:
                raw = e.raw_content[:50].replace('|', '\\|')
                lines.append(f"| {e.line_number} | {e.error_reason} | `{raw}` |")
            if len(self.result.errors) > 10:
                lines.append("")
                lines.append(f"还有 {len(self.result.errors) - 10} 个错误未列出")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由 redis-slowlog-attribution 工具自动生成*")
        
        return "\n".join(lines)

    def write_report(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.generate())


def generate_all_reports(result: AnalysisResult, output_prefix: str = "slowlog_report"):
    terminal = TerminalReporter(result)
    terminal.print_summary()
    
    machine = MachineReadableReporter(result)
    machine.write_json(f"{output_prefix}.json")
    print(f"机器可读报告已写入: {output_prefix}.json")
    
    md = MarkdownReporter(result)
    md.write_report(f"{output_prefix}.md")
    print(f"Markdown报告已写入: {output_prefix}.md")
