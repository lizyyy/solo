import json
import os
from datetime import datetime
from typing import Dict, Any
from tabulate import tabulate
from .yaml_parser import ParseResult, BadLine
from .port_mapper import MappingResult, MappingGap


class Reporter:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_all(self, parse_result: ParseResult, mapping_result: MappingResult) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        terminal_summary = self._generate_terminal_summary(parse_result, mapping_result)
        json_path = self._generate_json_report(parse_result, mapping_result, timestamp)
        md_path = self._generate_markdown_report(parse_result, mapping_result, timestamp)

        return {
            "terminal": terminal_summary,
            "json": json_path,
            "markdown": md_path
        }

    def _generate_terminal_summary(self, parse_result: ParseResult, mapping_result: MappingResult) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("K8s 服务端口映射检查报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("【资源统计】")
        lines.append(f"  Service: {len(mapping_result.services)} 个")
        lines.append(f"  Ingress: {len(mapping_result.ingresses)} 个")
        lines.append(f"  工作负载: {len(mapping_result.pods)} 个")
        lines.append("")

        errors = [g for g in mapping_result.gaps if g.severity == 'ERROR']
        warnings = [g for g in mapping_result.gaps if g.severity == 'WARNING']
        lines.append("【缺口统计】")
        lines.append(f"  错误: {len(errors)} 个")
        lines.append(f"  警告: {len(warnings)} 个")
        lines.append("")

        if parse_result.bad_lines:
            lines.append(f"【坏行记录】: {len(parse_result.bad_lines)} 行")
            for bl in parse_result.bad_lines[:3]:
                lines.append(f"  - L{bl.line_number}: {bl.content[:50]}... ({bl.error[:30]})")
            if len(parse_result.bad_lines) > 3:
                lines.append(f"  ... 还有 {len(parse_result.bad_lines) - 3} 行")
            lines.append("")

        if errors:
            lines.append("【错误详情】")
            for gap in errors:
                lines.append(f"  ❌ [{gap.gap_type}] {gap.message}")
                lines.append(f"     文件: {gap.file_path}:{gap.line_start}")
            lines.append("")

        if warnings:
            lines.append("【警告详情】")
            for gap in warnings:
                lines.append(f"  ⚠️  [{gap.gap_type}] {gap.message}")
                lines.append(f"     文件: {gap.file_path}:{gap.line_start}")
            lines.append("")

        if mapping_result.services:
            lines.append("【Service 端口列表】")
            table_data = []
            for s in mapping_result.services:
                ports = ", ".join([f"{p.port}->{p.target_port}" for p in s.ports])
                table_data.append([s.name, ports, s.namespace or 'default'])
            lines.append(tabulate(table_data, headers=['服务名', '端口映射', '命名空间'], tablefmt='simple'))
            lines.append("")

        lines.append("=" * 80)
        if errors:
            lines.append(f"检查完成: 发现 {len(errors)} 个错误需要修复!")
        else:
            lines.append("检查完成: 未发现严重端口映射问题!")
        lines.append("=" * 80)

        return "\n".join(lines)

    def _generate_json_report(self, parse_result: ParseResult, mapping_result: MappingResult, timestamp: str) -> str:
        data = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "version": "0.1.0"
            },
            "summary": {
                "services_count": len(mapping_result.services),
                "ingresses_count": len(mapping_result.ingresses),
                "workloads_count": len(mapping_result.pods),
                "errors_count": len([g for g in mapping_result.gaps if g.severity == 'ERROR']),
                "warnings_count": len([g for g in mapping_result.gaps if g.severity == 'WARNING']),
                "bad_lines_count": len(parse_result.bad_lines)
            },
            "services": [
                {
                    "name": s.name,
                    "namespace": s.namespace,
                    "ports": [{"port": p.port, "name": p.name, "protocol": p.protocol, "target_port": p.target_port} for p in s.ports],
                    "selector": s.selector,
                    "file": s.file_path,
                    "line_start": s.line_start
                }
                for s in mapping_result.services
            ],
            "ingresses": [
                {
                    "name": i.name,
                    "namespace": i.namespace,
                    "paths": [{"path": p.path, "host": p.host, "service_name": p.service_name, "service_port": p.service_port} for p in i.paths],
                    "file": i.file_path,
                    "line_start": i.line_start
                }
                for i in mapping_result.ingresses
            ],
            "workloads": [
                {
                    "name": p.name,
                    "namespace": p.namespace,
                    "ports": [{"port": port.port, "name": port.name, "protocol": port.protocol} for port in p.ports],
                    "labels": p.labels,
                    "file": p.file_path,
                    "line_start": p.line_start
                }
                for p in mapping_result.pods
            ],
            "gaps": [
                {
                    "type": g.gap_type,
                    "severity": g.severity,
                    "message": g.message,
                    "details": g.details,
                    "file": g.file_path,
                    "line_start": g.line_start
                }
                for g in mapping_result.gaps
            ],
            "bad_lines": [
                {
                    "line_number": bl.line_number,
                    "content": bl.content,
                    "error": bl.error,
                    "file": bl.file_path
                }
                for bl in parse_result.bad_lines
            ],
            "errors": parse_result.errors
        }

        file_path = os.path.join(self.output_dir, f"port_mapping_{timestamp}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return file_path

    def _generate_markdown_report(self, parse_result: ParseResult, mapping_result: MappingResult, timestamp: str) -> str:
        md_content = []
        md_content.append("# K8s 服务端口映射检查报告")
        md_content.append("")
        md_content.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_content.append("")

        errors = [g for g in mapping_result.gaps if g.severity == 'ERROR']
        warnings = [g for g in mapping_result.gaps if g.severity == 'WARNING']

        md_content.append("## 概览")
        md_content.append("")
        md_content.append("| 指标 | 数值 |")
        md_content.append("|------|------|")
        md_content.append(f"| Service | {len(mapping_result.services)} |")
        md_content.append(f"| Ingress | {len(mapping_result.ingresses)} |")
        md_content.append(f"| 工作负载 | {len(mapping_result.pods)} |")
        md_content.append(f"| 错误 | {len(errors)} |")
        md_content.append(f"| 警告 | {len(warnings)} |")
        md_content.append(f"| 坏行 | {len(parse_result.bad_lines)} |")
        md_content.append("")

        if errors:
            md_content.append("## ❌ 错误详情")
            md_content.append("")
            for gap in errors:
                md_content.append(f"### {gap.message}")
                md_content.append(f"- **类型**: `{gap.gap_type}`")
                md_content.append(f"- **位置**: `{gap.file_path}:{gap.line_start}`")
                if gap.details:
                    md_content.append("- **详情**:")
                    for k, v in gap.details.items():
                        md_content.append(f"  - {k}: {v}")
                md_content.append("")

        if warnings:
            md_content.append("## ⚠️ 警告详情")
            md_content.append("")
            for gap in warnings:
                md_content.append(f"### {gap.message}")
                md_content.append(f"- **类型**: `{gap.gap_type}`")
                md_content.append(f"- **位置**: `{gap.file_path}:{gap.line_start}`")
                md_content.append("")

        if mapping_result.services:
            md_content.append("## Service 端口映射")
            md_content.append("")
            md_content.append("| 服务名 | 命名空间 | 端口映射 | Selector |")
            md_content.append("|---------|----------|----------|----------|")
            for s in mapping_result.services:
                ports = "<br>".join([f"{p.port} → {p.target_port or p.port}" for p in s.ports])
                selector_str = ", ".join([f"{k}={v}" for k, v in s.selector.items()]) or "无"
                md_content.append(f"| {s.name} | {s.namespace or 'default'} | {ports} | {selector_str} |")
            md_content.append("")

        if parse_result.bad_lines:
            md_content.append("## ⚠️ 坏行记录")
            md_content.append("")
            md_content.append("| 行号 | 内容 | 错误 | 文件 |")
            md_content.append("|------|------|------|------|")
            for bl in parse_result.bad_lines:
                content = bl.content.replace('|', '\\|')
                md_content.append(f"| {bl.line_number} | {content[:80]}... | {bl.error[:50]} | {bl.file_path} |")
            md_content.append("")

        md_content.append("---")
        md_content.append("*此报告由 k8s-port-mapper 自动生成*")

        file_path = os.path.join(self.output_dir, f"port_mapping_{timestamp}.md")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(md_content))
        return file_path
