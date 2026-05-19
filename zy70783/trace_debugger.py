#!/usr/bin/env python3
import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict


@dataclass
class LogEntry:
    timestamp: datetime
    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    service_name: str
    log_level: str
    message: str
    raw_log: str
    source_file: str

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


class LogParser:
    TIMESTAMP_PATTERNS = [
        (r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)', '%Y-%m-%dT%H:%M:%S.%fZ'),
        (r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{3})?)', '%Y-%m-%d %H:%M:%S.%f'),
        (r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', '%Y-%m-%d %H:%M:%S'),
    ]
    
    TRACE_ID_PATTERN = r'[0-9a-fA-F]{16,32}'
    SPAN_ID_PATTERN = r'[0-9a-fA-F]{8,16}'

    @classmethod
    def parse_line(cls, line: str, source_file: str) -> Optional[LogEntry]:
        line = line.strip()
        if not line:
            return None

        timestamp = cls._extract_timestamp(line)
        if not timestamp:
            return None

        trace_id = cls._extract_trace_id(line)
        if not trace_id:
            return None

        span_id = cls._extract_span_id(line)
        if not span_id:
            return None

        parent_span_id = cls._extract_parent_span_id(line)
        service_name = cls._extract_service_name(line)
        log_level = cls._extract_log_level(line)
        message = cls._extract_message(line)

        return LogEntry(
            timestamp=timestamp,
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=parent_span_id,
            service_name=service_name,
            log_level=log_level,
            message=message,
            raw_log=line,
            source_file=source_file
        )

    @classmethod
    def _extract_timestamp(cls, line: str) -> Optional[datetime]:
        for pattern, fmt in cls.TIMESTAMP_PATTERNS:
            match = re.search(pattern, line)
            if match:
                ts_str = match.group(1)
                try:
                    if '.' not in ts_str and '%f' in fmt:
                        fmt = fmt.replace('.%f', '')
                    return datetime.strptime(ts_str, fmt)
                except ValueError:
                    continue
        return None

    @classmethod
    def _extract_trace_id(cls, line: str) -> Optional[str]:
        patterns = [
            r'traceId[=:]\s*([0-9a-zA-Z]{16,32})',
            r'trace_id[=:]\s*([0-9a-zA-Z]{16,32})',
            r'"traceId"\s*:\s*"([0-9a-zA-Z]{16,32})"',
            r'"trace_id"\s*:\s*"([0-9a-zA-Z]{16,32})"',
        ]
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        return None

    @classmethod
    def _extract_span_id(cls, line: str) -> Optional[str]:
        patterns = [
            r'spanId[=:]\s*([0-9a-zA-Z]{1,16})',
            r'span_id[=:]\s*([0-9a-zA-Z]{1,16})',
            r'"spanId"\s*:\s*"([0-9a-zA-Z]{1,16})"',
            r'"span_id"\s*:\s*"([0-9a-zA-Z]{1,16})"',
        ]
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        return None

    @classmethod
    def _extract_parent_span_id(cls, line: str) -> Optional[str]:
        patterns = [
            r'parentSpanId[=:]\s*([0-9a-zA-Z]{1,16})',
            r'parent_span_id[=:]\s*([0-9a-zA-Z]{1,16})',
            r'"parentSpanId"\s*:\s*"([0-9a-zA-Z]{1,16})"',
            r'"parent_span_id"\s*:\s*"([0-9a-zA-Z]{1,16})"',
        ]
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        return None

    @classmethod
    def _extract_service_name(cls, line: str) -> str:
        patterns = [
            r'serviceName[=:]\s*([^\s,]+)',
            r'service_name[=:]\s*([^\s,]+)',
            r'"serviceName"\s*:\s*"([^"]+)"',
            r'"service_name"\s*:\s*"([^"]+)"',
            r'\[([^\]]+)\]',
        ]
        for pattern in patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1)
        return 'unknown'

    @classmethod
    def _extract_log_level(cls, line: str) -> str:
        levels = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'TRACE']
        for level in levels:
            if re.search(rf'\b{level}\b', line, re.IGNORECASE):
                return level.upper()
        return 'INFO'

    @classmethod
    def _extract_message(cls, line: str) -> str:
        match = re.search(r'message[=:]\s*(.+)$', line, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        match = re.search(r'"message"\s*:\s*"([^"]+)"', line)
        if match:
            return match.group(1)
        return line[:200]


class TraceAggregator:
    def __init__(self):
        self.traces: Dict[str, List[LogEntry]] = defaultdict(list)

    def add_entry(self, entry: LogEntry):
        self.traces[entry.trace_id].append(entry)

    def get_trace(self, trace_id: str) -> Optional[List[LogEntry]]:
        trace_id_lower = trace_id.lower()
        if trace_id_lower in self.traces:
            return sorted(self.traces[trace_id_lower], key=lambda x: x.timestamp)
        return None

    def get_all_traces(self) -> Dict[str, List[LogEntry]]:
        result = {}
        for trace_id, entries in self.traces.items():
            result[trace_id] = sorted(entries, key=lambda x: x.timestamp)
        return result


class GapAnalyzer:
    @staticmethod
    def find_gaps(entries: List[LogEntry], max_gap_ms: int = 5000) -> List[Tuple[LogEntry, LogEntry, float]]:
        gaps = []
        for i in range(len(entries) - 1):
            current = entries[i]
            next_entry = entries[i + 1]
            gap_ms = (next_entry.timestamp - current.timestamp).total_seconds() * 1000
            if gap_ms > max_gap_ms:
                gaps.append((current, next_entry, gap_ms))
        return gaps

    @staticmethod
    def find_missing_spans(entries: List[LogEntry]) -> List[Dict[str, str]]:
        span_ids = {e.span_id for e in entries}
        null_values = {'null', 'none', '-', ''}
        missing = []
        for entry in entries:
            parent_id = entry.parent_span_id
            if parent_id and parent_id.lower() not in null_values and parent_id not in span_ids:
                missing.append({
                    'missing_span_id': parent_id,
                    'child_span_id': entry.span_id,
                    'service_name': entry.service_name,
                    'message': entry.message
                })
        return missing

    @staticmethod
    def find_duplicate_spans(entries: List[LogEntry]) -> List[Dict[str, Any]]:
        span_counts = defaultdict(list)
        for entry in entries:
            span_counts[entry.span_id].append(entry)
        
        duplicates = []
        for span_id, dup_entries in span_counts.items():
            if len(dup_entries) > 1:
                duplicates.append({
                    'span_id': span_id,
                    'count': len(dup_entries),
                    'services': [e.service_name for e in dup_entries],
                    'timestamps': [e.timestamp.isoformat() for e in dup_entries]
                })
        return duplicates


class MarkdownReporter:
    @staticmethod
    def generate_report(trace_id: str, entries: List[LogEntry], 
                        gaps: List, missing_spans: List, 
                        duplicate_spans: List, output_file: str):
        content = []
        content.append(f"# Trace 链路排查报告: {trace_id}")
        content.append("")
        content.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        content.append(f"**日志条目总数**: {len(entries)}")
        content.append(f"**涉及服务数**: {len(set(e.service_name for e in entries))}")
        content.append("")

        content.append("## 一、链路概览")
        content.append("")
        content.append("| 序号 | 时间戳 | 服务名 | 级别 | Span ID | 父 Span ID | 消息摘要 | 来源文件 |")
        content.append("|------|--------|--------|------|---------|------------|----------|----------|")
        for idx, entry in enumerate(entries, 1):
            parent = entry.parent_span_id or '-'
            msg = entry.message[:50] + '...' if len(entry.message) > 50 else entry.message
            source = Path(entry.source_file).name
            content.append(f"| {idx} | {entry.timestamp.strftime('%H:%M:%S.%f')[:-3]} | {entry.service_name} | {entry.log_level} | {entry.span_id} | {parent} | {msg} | {source} |")
        content.append("")

        content.append("## 二、时序分析")
        content.append("")
        if entries:
            start_time = entries[0].timestamp
            end_time = entries[-1].timestamp
            total_duration = (end_time - start_time).total_seconds() * 1000
            content.append(f"- **开始时间**: {start_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
            content.append(f"- **结束时间**: {end_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
            content.append(f"- **总耗时**: {total_duration:.2f} ms")
            content.append("")

        content.append("## 三、问题检测")
        content.append("")
        
        content.append("### 3.1 时间缺口检测")
        if gaps:
            content.append(f"⚠️  **发现 {len(gaps)} 个时间缺口（超过 5000ms）:**")
            content.append("")
            content.append("| 序号 | 前一 Span | 后一 Span | 缺口时长(ms) | 服务跳转 |")
            content.append("|------|-----------|-----------|--------------|----------|")
            for idx, (prev, curr, gap_ms) in enumerate(gaps, 1):
                content.append(f"| {idx} | {prev.span_id} | {curr.span_id} | {gap_ms:.2f} | {prev.service_name} → {curr.service_name} |")
        else:
            content.append("✅ 未检测到异常时间缺口")
        content.append("")

        content.append("### 3.2 缺失 Span 检测")
        if missing_spans:
            content.append(f"⚠️  **发现 {len(missing_spans)} 个缺失的父 Span:**")
            content.append("")
            content.append("| 序号 | 缺失 Span ID | 子 Span ID | 服务名 | 消息 |")
            content.append("|------|--------------|------------|--------|------|")
            for idx, m in enumerate(missing_spans, 1):
                content.append(f"| {idx} | {m['missing_span_id']} | {m['child_span_id']} | {m['service_name']} | {m['message'][:40]} |")
        else:
            content.append("✅ 所有父 Span 均可找到")
        content.append("")

        content.append("### 3.3 重复 Span 检测")
        if duplicate_spans:
            content.append(f"⚠️  **发现 {len(duplicate_spans)} 个重复 Span:**")
            content.append("")
            for dup in duplicate_spans:
                content.append(f"- **Span ID**: {dup['span_id']}, **出现次数**: {dup['count']}")
                content.append(f"  - 涉及服务: {', '.join(dup['services'])}")
        else:
            content.append("✅ 未检测到重复 Span")
        content.append("")

        content.append("## 四、服务调用关系")
        content.append("")
        services = defaultdict(set)
        for entry in entries:
            if entry.parent_span_id:
                parent_entry = next((e for e in entries if e.span_id == entry.parent_span_id), None)
                if parent_entry:
                    services[parent_entry.service_name].add(entry.service_name)
        
        if services:
            content.append("```mermaid")
            content.append("graph TD")
            for src, targets in services.items():
                for tgt in targets:
                    content.append(f"    {src} --> {tgt}")
            content.append("```")
        else:
            content.append("(未找到明确的调用关系)")
        content.append("")

        content.append("## 五、原始日志")
        content.append("")
        for entry in entries:
            content.append(f"### {entry.timestamp.strftime('%H:%M:%S.%f')[:-3]} - {entry.service_name}")
            content.append("```")
            content.append(entry.raw_log)
            content.append("```")
            content.append("")

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))
        
        return output_file


def main():
    parser = argparse.ArgumentParser(
        description='TraceID 多源拼接排查 CLI - 聚合多源日志进行链路分析',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  %(prog)s -f gateway.log app.log task.log -t abc123def456
  %(prog)s -f logs/*.log -t abc123def456 -o report.md
  %(prog)s -f app.log --list-traces
  %(prog)s -f app.log --json-output trace.json
        """
    )
    
    parser.add_argument('-f', '--files', nargs='+', required=True,
                        help='日志文件路径（支持多个文件和通配符）')
    parser.add_argument('-t', '--trace-id', 
                        help='要排查的 Trace ID（如果不指定则列出所有 Trace）')
    parser.add_argument('-o', '--output', default='trace_report.md',
                        help='Markdown 报告输出路径（默认: trace_report.md）')
    parser.add_argument('--json-output',
                        help='JSON 格式机器可读输出路径')
    parser.add_argument('--list-traces', action='store_true',
                        help='列出所有找到的 Trace ID')
    parser.add_argument('--max-gap', type=int, default=5000,
                        help='最大允许时间缺口（毫秒，默认: 5000）')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🔍 TraceID 多源拼接排查 CLI")
    print("=" * 60)
    
    log_files = []
    for pattern in args.files:
        if '*' in pattern or '?' in pattern:
            log_files.extend(Path('.').glob(pattern))
        else:
            path = Path(pattern)
            if path.exists():
                log_files.append(path)
    
    if not log_files:
        print("❌ 未找到任何日志文件")
        return
    
    print(f"📁 加载 {len(log_files)} 个日志文件...")
    
    aggregator = TraceAggregator()
    total_parsed = 0
    total_skipped = 0
    
    for log_file in log_files:
        print(f"  解析: {log_file}")
        try:
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                for line in f:
                    entry = LogParser.parse_line(line, str(log_file))
                    if entry:
                        aggregator.add_entry(entry)
                        total_parsed += 1
                    else:
                        total_skipped += 1
        except Exception as e:
            print(f"  ⚠️  读取文件失败 {log_file}: {e}")
    
    print(f"✅ 解析完成: {total_parsed} 条有效日志, {total_skipped} 条跳过")
    print()
    
    all_traces = aggregator.get_all_traces()
    
    if args.list_traces:
        print("📋 找到的 Trace ID 列表:")
        print()
        print(f"{'Trace ID':<34} {'条目数':>6} {'服务数':>6}")
        print("-" * 50)
        for trace_id, entries in sorted(all_traces.items(), key=lambda x: -len(x[1])):
            service_count = len(set(e.service_name for e in entries))
            print(f"{trace_id:<34} {len(entries):>6} {service_count:>6}")
        return
    
    if not args.trace_id:
        print("❌ 请指定 -t/--trace-id 或使用 --list-traces")
        return
    
    entries = aggregator.get_trace(args.trace_id)
    
    if not entries:
        print(f"❌ 未找到 Trace ID: {args.trace_id}")
        print()
        print("提示: 使用 --list-traces 查看所有可用的 Trace ID")
        return
    
    print(f"📍 找到 Trace: {args.trace_id}")
    print(f"   日志条目: {len(entries)}")
    print(f"   涉及服务: {len(set(e.service_name for e in entries))}")
    print()
    
    gaps = GapAnalyzer.find_gaps(entries, args.max_gap)
    missing_spans = GapAnalyzer.find_missing_spans(entries)
    duplicate_spans = GapAnalyzer.find_duplicate_spans(entries)
    
    print("🔍 问题检测结果:")
    print(f"   时间缺口: {len(gaps)}")
    print(f"   缺失 Span: {len(missing_spans)}")
    print(f"   重复 Span: {len(duplicate_spans)}")
    print()
    
    report_file = MarkdownReporter.generate_report(
        args.trace_id, entries, gaps, missing_spans, duplicate_spans, args.output
    )
    print(f"📄 Markdown 报告已生成: {report_file}")
    
    if args.json_output:
        json_data = {
            'trace_id': args.trace_id,
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_entries': len(entries),
                'services': list(set(e.service_name for e in entries)),
                'gaps_count': len(gaps),
                'missing_spans_count': len(missing_spans),
                'duplicate_spans_count': len(duplicate_spans)
            },
            'entries': [e.to_dict() for e in entries],
            'gaps': [
                {
                    'prev_span_id': g[0].span_id,
                    'next_span_id': g[1].span_id,
                    'gap_ms': g[2],
                    'prev_service': g[0].service_name,
                    'next_service': g[1].service_name
                } for g in gaps
            ],
            'missing_spans': missing_spans,
            'duplicate_spans': duplicate_spans
        }
        with open(args.json_output, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"📄 JSON 输出已生成: {args.json_output}")
    
    print()
    print("🎉 分析完成!")


if __name__ == '__main__':
    main()
