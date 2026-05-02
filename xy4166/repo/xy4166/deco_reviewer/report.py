import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import print as rprint

from .models import (
    DiveAnalysis,
    DiveLog,
    CalculationResult,
    Violation,
    ViolationType,
)


class ReportGenerator:
    """报告生成器"""

    def __init__(self):
        self.console = Console()

    def generate_summary(self, analysis: DiveAnalysis) -> Dict[str, Any]:
        """生成摘要数据"""
        dive_log = analysis.dive_log
        calc_result = analysis.calculation_result
        
        max_depth = max(p.depth for p in dive_log.profile) if dive_log.profile else 0.0
        total_time = dive_log.profile[-1].time - dive_log.profile[0].time if len(dive_log.profile) >= 2 else 0
        
        critical_count = sum(1 for v in analysis.violations if v.severity == "critical")
        warning_count = sum(1 for v in analysis.violations if v.severity == "warning")
        
        summary = {
            "dive_id": dive_log.dive_id,
            "diver_name": dive_log.diver_name,
            "dive_date": dive_log.dive_date.strftime("%Y-%m-%d") if dive_log.dive_date else None,
            "max_depth": round(max_depth, 1),
            "total_time": total_time,
            "gas_type": dive_log.gas_mix.gas_type.value,
            "o2_percent": dive_log.gas_mix.o2_percent,
            "current_ndl": calc_result.current_ndl,
            "max_ndl": calc_result.max_ndl,
            "cns_percentage": round(calc_result.cns_percentage, 1),
            "otu_value": round(calc_result.otu_value, 1),
            "leading_compartment": calc_result.leading_compartment,
            "m_value_ratio": round(calc_result.m_value_ratio, 3),
            "violation_count": len(analysis.violations),
            "critical_count": critical_count,
            "warning_count": warning_count,
            "status": "safe" if critical_count == 0 else "critical",
            "generated_at": datetime.now().isoformat(),
        }
        
        analysis.summary = summary
        return summary

    def print_terminal_summary(self, analysis: DiveAnalysis):
        """打印终端摘要"""
        summary = self.generate_summary(analysis)
        
        self.console.print()
        
        status_color = "green" if summary["status"] == "safe" else "red"
        status_text = "✓ 安全潜水" if summary["status"] == "safe" else "✗ 存在违规"
        
        title = Panel(
            Text(f"减压曲线复核员 - 潜水分析报告", style="bold blue"),
            subtitle=f"状态: [{status_color}]{status_text}[/{status_color}]",
        )
        self.console.print(title)
        
        info_table = Table(title="潜水基本信息", show_header=True, header_style="bold cyan")
        info_table.add_column("项目", style="dim")
        info_table.add_column("数值")
        
        info_table.add_row("潜水ID", summary["dive_id"])
        info_table.add_row("潜水员", summary["diver_name"])
        info_table.add_row("潜水日期", summary["dive_date"] or "未知")
        info_table.add_row("最大深度", f"{summary['max_depth']} m")
        info_table.add_row("总时间", f"{summary['total_time']} 分钟")
        info_table.add_row("气体类型", f"{summary['gas_type']} (O2: {summary['o2_percent']}%)")
        
        self.console.print(info_table)
        self.console.print()
        
        calc_table = Table(title="计算结果", show_header=True, header_style="bold magenta")
        calc_table.add_column("指标", style="dim")
        calc_table.add_column("数值")
        
        ndl_status = "green" if summary["current_ndl"] and summary["current_ndl"] > 5 else "yellow"
        calc_table.add_row(
            "当前NDL",
            f"[{ndl_status}]{summary['current_ndl'] if summary['current_ndl'] else 0} 分钟[/{ndl_status}]"
        )
        calc_table.add_row("最大深度NDL", f"{summary['max_ndl']} 分钟")
        
        cns_status = "green" if summary["cns_percentage"] < 80 else "yellow" if summary["cns_percentage"] < 100 else "red"
        calc_table.add_row(
            "CNS氧中毒",
            f"[{cns_status}]{summary['cns_percentage']}%[/{cns_status}]"
        )
        
        otu_status = "green" if summary["otu_value"] < 250 else "yellow" if summary["otu_value"] < 300 else "red"
        calc_table.add_row(
            "OTU氧毒性",
            f"[{otu_status}]{summary['otu_value']}[/{otu_status}]"
        )
        
        calc_table.add_row("领先隔室", f"# {summary['leading_compartment']}")
        
        m_status = "green" if summary["m_value_ratio"] < 0.8 else "yellow" if summary["m_value_ratio"] < 1.0 else "red"
        calc_table.add_row(
            "M值比值",
            f"[{m_status}]{summary['m_value_ratio']}[/{m_status}]"
        )
        
        self.console.print(calc_table)
        self.console.print()
        
        if analysis.violations:
            violation_table = Table(title="违规记录", show_header=True, header_style="bold red")
            violation_table.add_column("#", style="dim")
            violation_table.add_column("类型", style="dim")
            violation_table.add_column("严重程度")
            violation_table.add_column("描述")
            
            for i, violation in enumerate(analysis.violations, 1):
                severity_color = "red" if violation.severity == "critical" else "yellow"
                violation_table.add_row(
                    str(i),
                    violation.violation_type.value,
                    f"[{severity_color}]{violation.severity}[/{severity_color}]",
                    violation.message,
                )
            
            self.console.print(violation_table)
        else:
            self.console.print(Panel("[green]✓ 无违规记录[/green]", title="合规检查"))
        
        self.console.print()

    def generate_markdown(self, analysis: DiveAnalysis, output_path: Path) -> Path:
        """生成Markdown报告"""
        summary = self.generate_summary(analysis)
        
        md_lines = []
        
        md_lines.append("# 减压曲线复核员 - 潜水分析报告")
        md_lines.append("")
        md_lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append("")
        
        md_lines.append("## 潜水基本信息")
        md_lines.append("")
        md_lines.append("| 项目 | 数值 |")
        md_lines.append("|------|------|")
        md_lines.append(f"| 潜水ID | {summary['dive_id']} |")
        md_lines.append(f"| 潜水员 | {summary['diver_name']} |")
        md_lines.append(f"| 潜水日期 | {summary['dive_date'] or '未知'} |")
        md_lines.append(f"| 最大深度 | {summary['max_depth']} m |")
        md_lines.append(f"| 总时间 | {summary['total_time']} 分钟 |")
        md_lines.append(f"| 气体类型 | {summary['gas_type']} |")
        md_lines.append(f"| 氧气百分比 | {summary['o2_percent']}% |")
        md_lines.append("")
        
        md_lines.append("## 计算结果")
        md_lines.append("")
        md_lines.append("| 指标 | 数值 | 状态 |")
        md_lines.append("|------|------|------|")
        
        ndl_status = "正常" if summary["current_ndl"] and summary["current_ndl"] > 5 else "警告"
        md_lines.append(f"| 当前NDL | {summary['current_ndl'] if summary['current_ndl'] else 0} 分钟 | {ndl_status} |")
        md_lines.append(f"| 最大深度NDL | {summary['max_ndl']} 分钟 | - |")
        
        cns_status = "正常" if summary["cns_percentage"] < 80 else "警告" if summary["cns_percentage"] < 100 else "危险"
        md_lines.append(f"| CNS氧中毒 | {summary['cns_percentage']}% | {cns_status} |")
        
        otu_status = "正常" if summary["otu_value"] < 250 else "警告" if summary["otu_value"] < 300 else "危险"
        md_lines.append(f"| OTU氧毒性 | {summary['otu_value']} | {otu_status} |")
        
        md_lines.append(f"| 领先隔室 | #{summary['leading_compartment']} | - |")
        
        m_status = "正常" if summary["m_value_ratio"] < 0.8 else "警告" if summary["m_value_ratio"] < 1.0 else "危险"
        md_lines.append(f"| M值比值 | {summary['m_value_ratio']} | {m_status} |")
        md_lines.append("")
        
        md_lines.append("## 组织隔室压力")
        md_lines.append("")
        md_lines.append("| 隔室 | 半衰期(分钟) | N2压力(bar) | He压力(bar) |")
        md_lines.append("|------|-------------|-------------|-------------|")
        
        for comp in analysis.calculation_result.tissue_compartments:
            md_lines.append(
                f"| #{comp.compartment_id} | {comp.n2_half_time:.1f} | {comp.current_p_n2:.3f} | {comp.current_p_he:.3f} |"
            )
        md_lines.append("")
        
        if analysis.violations:
            md_lines.append("## 违规记录")
            md_lines.append("")
            md_lines.append("| # | 类型 | 严重程度 | 描述 |")
            md_lines.append("|---|------|---------|------|")
            
            for i, v in enumerate(analysis.violations, 1):
                md_lines.append(
                    f"| {i} | {v.violation_type.value} | {v.severity} | {v.message} |"
                )
            md_lines.append("")
            
            md_lines.append("### 违规详情")
            md_lines.append("")
            for v in analysis.violations:
                md_lines.append(f"#### {v.violation_type.value} ({v.severity})")
                md_lines.append("")
                md_lines.append(f"**描述:** {v.message}")
                md_lines.append("")
                if v.details:
                    md_lines.append("**详情:**")
                    md_lines.append("")
                    md_lines.append("```json")
                    md_lines.append(json.dumps(v.details, ensure_ascii=False, indent=2))
                    md_lines.append("```")
                    md_lines.append("")
        else:
            md_lines.append("## 合规检查")
            md_lines.append("")
            md_lines.append("✅ **无违规记录**")
            md_lines.append("")
        
        md_lines.append("---")
        md_lines.append("")
        md_lines.append("*此报告由减压曲线复核员自动生成*")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))
        
        return output_path

    def generate_json(self, analysis: DiveAnalysis, output_path: Path) -> Path:
        """生成JSON审计结果"""
        from .storage import DiveStorage
        
        storage = DiveStorage()
        analysis_data = storage._analysis_to_dict(analysis)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(analysis_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path

    def export_all(self, analysis: DiveAnalysis, output_dir: Path) -> Dict[str, Path]:
        """导出所有格式的报告"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        base_name = analysis.dive_log.dive_id
        
        md_path = output_dir / f"{base_name}_report.md"
        json_path = output_dir / f"{base_name}_audit.json"
        
        self.generate_markdown(analysis, md_path)
        self.generate_json(analysis, json_path)
        
        return {
            "markdown": md_path,
            "json": json_path,
        }
