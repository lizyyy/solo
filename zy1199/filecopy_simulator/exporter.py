"""报告导出模块"""

import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List

from .models import SimulationResult, BottleneckType, TransferMethod


class ReportExporter:
    """报告导出器"""
    
    def export_json(self, results: List[SimulationResult], output_path: Path):
        """导出 JSON 格式报告"""
        data = []
        for result in results:
            data.append({
                'id': result.id,
                'case_name': result.case_name,
                'file_size_mb': result.file_size_mb,
                'method': result.method.value,
                'metrics': {
                    'user_space_copies': result.user_space_copies,
                    'kernel_space_copies': result.kernel_space_copies,
                    'total_copies': result.total_copies,
                    'context_switches': result.context_switches,
                    'system_calls': result.system_calls,
                    'estimated_cpu_usage_pct': result.estimated_cpu_usage_pct,
                    'estimated_time_ms': result.estimated_time_ms,
                    'estimated_throughput_mbps': result.estimated_throughput_mbps
                },
                'bottleneck': {
                    'type': result.bottleneck.value,
                    'reason': result.bottleneck_reason
                },
                'copy_details': result.copy_details,
                'created_at': result.created_at.isoformat()
            })
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'total_results': len(results),
                'results': data
            }, f, ensure_ascii=False, indent=2)
    
    def export_markdown(self, results: List[SimulationResult], output_path: Path, detailed: bool = True):
        """导出 Markdown 格式报告"""
        lines = []
        
        lines.append("# 文件传输拷贝链路模拟报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 共 {len(results)} 个模拟结果")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 摘要对比")
        lines.append("")
        lines.append(self._build_comparison_table(results))
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        for i, result in enumerate(results, 1):
            lines.append(f"## {i}. {result.case_name}")
            lines.append("")
            lines.append(f"**传输方式**: {self._method_to_display(result.method)}")
            lines.append(f"**文件大小**: {result.file_size_mb} MB")
            lines.append(f"**模拟时间**: {result.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")
            
            lines.append("### 性能指标")
            lines.append("")
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 用户态拷贝次数 | {result.user_space_copies} 次 |")
            lines.append(f"| 内核态拷贝次数 | {result.kernel_space_copies} 次 |")
            lines.append(f"| **总拷贝次数** | **{result.total_copies} 次** |")
            lines.append(f"| 上下文切换 | {result.context_switches} 次 |")
            lines.append(f"| 系统调用 | {result.system_calls} 次 |")
            lines.append(f"| 预估 CPU 占用 | {result.estimated_cpu_usage_pct:.1f}% |")
            lines.append(f"| 预估耗时 | {result.estimated_time_ms:.1f} ms |")
            lines.append(f"| **预估吞吐量** | **{result.estimated_throughput_mbps:.2f} MB/s** |")
            lines.append("")
            
            lines.append("### 瓶颈分析")
            lines.append("")
            bottleneck_icon = {
                BottleneckType.NONE: "✅",
                BottleneckType.CPU: "⚠️",
                BottleneckType.IO: "⚠️",
                BottleneckType.NETWORK: "⚠️",
                BottleneckType.MEMORY: "⚠️"
            }.get(result.bottleneck, "❓")
            
            bottleneck_display = {
                BottleneckType.NONE: "无明显瓶颈",
                BottleneckType.CPU: "CPU 瓶颈",
                BottleneckType.IO: "磁盘 I/O 瓶颈",
                BottleneckType.NETWORK: "网络瓶颈",
                BottleneckType.MEMORY: "内存拷贝瓶颈"
            }.get(result.bottleneck, "未知")
            
            lines.append(f"{bottleneck_icon} **{bottleneck_display}**")
            lines.append("")
            lines.append(f"> {result.bottleneck_reason}")
            lines.append("")
            
            if detailed and result.copy_details:
                lines.append("### 拷贝链路详情")
                lines.append("")
                details = result.copy_details
                lines.append(f"**方式**: {details.get('method', 'N/A')}")
                lines.append("")
                lines.append(f"> {details.get('description', 'N/A')}")
                lines.append("")
                
                steps = details.get('steps', [])
                if steps:
                    lines.append("#### 传输步骤")
                    lines.append("")
                    for step in steps:
                        step_num = step.get('step', '?')
                        desc = step.get('description', 'N/A')
                        from_loc = step.get('from', 'N/A')
                        to_loc = step.get('to', 'N/A')
                        copy_type = step.get('type', 'N/A')
                        opt = step.get('optimization')
                        
                        lines.append(f"**步骤 {step_num}**: {desc}")
                        lines.append(f"- 数据流向: `{from_loc}` → `{to_loc}`")
                        lines.append(f"- 操作类型: {copy_type}")
                        if opt:
                            lines.append(f"- 优化: ✅ {opt}")
                        lines.append("")
                
                key_points = details.get('key_points', [])
                if key_points:
                    lines.append("#### 关键要点")
                    lines.append("")
                    for kp in key_points:
                        lines.append(f"- {kp}")
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        lines.append("## 术语说明")
        lines.append("")
        lines.append("| 术语 | 说明 |")
        lines.append("|------|------|")
        lines.append("| **用户态拷贝** | 数据在用户态和内核态之间的拷贝，涉及上下文切换，开销较大 |")
        lines.append("| **内核态拷贝** | 数据仅在内核态内部的拷贝，开销相对较小 |")
        lines.append("| **DMA 拷贝** | 直接内存访问，由 DMA 控制器完成，不占用 CPU |")
        lines.append("| **零拷贝** | 避免用户态和内核态之间的数据拷贝，如 sendfile + DMA SG |")
        lines.append("| **页缓存** | 内核缓存磁盘数据的机制，命中时可避免磁盘 I/O |")
        lines.append("| **DMA Scatter-Gather** | DMA 分散收集，支持非连续内存块的直接传输 |")
        lines.append("")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
    
    def _build_comparison_table(self, results: List[SimulationResult]) -> str:
        """构建对比表格"""
        lines = []
        
        headers = ["用例", "方式", "文件大小", "总拷贝", "上下文切换", "CPU", "耗时", "吞吐量", "瓶颈"]
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("|" + "|".join(["-" * len(h) for h in headers]) + "|")
        
        for result in results:
            method_short = {
                TransferMethod.READ_WRITE: "read+write",
                TransferMethod.MMAP_WRITE: "mmap+write",
                TransferMethod.SENDFILE: "sendfile"
            }.get(result.method, result.method.value)
            
            bottleneck_short = {
                BottleneckType.NONE: "✅ 无",
                BottleneckType.CPU: "⚠️ CPU",
                BottleneckType.IO: "⚠️ I/O",
                BottleneckType.NETWORK: "⚠️ 网络",
                BottleneckType.MEMORY: "⚠️ 内存"
            }.get(result.bottleneck, "?")
            
            row = [
                result.case_name,
                method_short,
                f"{result.file_size_mb}MB",
                f"{result.total_copies}次",
                f"{result.context_switches}次",
                f"{result.estimated_cpu_usage_pct:.0f}%",
                f"{result.estimated_time_ms:.0f}ms",
                f"{result.estimated_throughput_mbps:.1f}MB/s",
                bottleneck_short
            ]
            lines.append("| " + " | ".join(row) + " |")
        
        return '\n'.join(lines)
    
    def _method_to_display(self, method: TransferMethod) -> str:
        """传输方式转显示名称"""
        return {
            TransferMethod.READ_WRITE: "read + write (传统方式)",
            TransferMethod.MMAP_WRITE: "mmap + write (内存映射)",
            TransferMethod.SENDFILE: "sendfile (零拷贝)"
        }.get(method, method.value)
