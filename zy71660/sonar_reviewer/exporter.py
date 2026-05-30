"""
报告导出模块

支持导出复盘报告为JSON和可读文本格式。
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .core import SonarRecord
from .analyzer import ErrorAnalyzer, ERROR_EXPLANATIONS


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, analyzer: ErrorAnalyzer):
        self.analyzer = analyzer
    
    def _build_report_data(
        self,
        valid_records: List[SonarRecord],
        invalid_records: List[SonarRecord],
        import_stats: Dict,
        error_summary: Dict,
    ) -> Dict[str, Any]:
        """构建完整报告数据结构"""
        all_records = valid_records + invalid_records
        
        report = {
            "meta": {
                "title": "声呐测距误差复盘报告",
                "generated_at": datetime.now().isoformat(),
                "tool_version": "1.0.0",
                "formulas": {
                    "velocity": "c(T) = 1449.2 + 4.6T - 0.055T² + 0.00029T³ (m/s)",
                    "distance": "d = c * t / 2 (m)",
                    "echo_time": "t = 2d / c (s)",
                },
                "units": {
                    "temperature": "℃",
                    "echo_time": "s",
                    "velocity": "m/s",
                    "distance": "m",
                },
                "bounds": {
                    "temperature": "[-2, 40] ℃",
                    "echo_time": "[0.001, 10] s",
                    "velocity": "[1400, 1550] m/s",
                    "distance": ">= 0 m",
                },
            },
            "import_stats": import_stats,
            "summary": {
                "total": len(all_records),
                "valid": len(valid_records),
                "invalid": len(invalid_records),
                "valid_rate": f"{len(valid_records) / len(all_records) * 100:.1f}%" if all_records else "0%",
            },
            "error_summary": error_summary,
            "analysis": self.analyzer.analyze_all(all_records),
            "valid_records": [r.to_dict() for r in valid_records],
            "invalid_records": [r.to_dict() for r in invalid_records],
        }
        
        return report
    
    def export_json(
        self,
        valid_records: List[SonarRecord],
        invalid_records: List[SonarRecord],
        import_stats: Dict,
        error_summary: Dict,
        output_path: str,
    ) -> str:
        """导出JSON格式报告"""
        report = self._build_report_data(
            valid_records, invalid_records, import_stats, error_summary)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return str(path)
    
    def export_text(
        self,
        valid_records: List[SonarRecord],
        invalid_records: List[SonarRecord],
        import_stats: Dict,
        error_summary: Dict,
        output_path: str,
    ) -> str:
        """导出可读文本格式报告"""
        all_records = valid_records + invalid_records
        lines = []
        
        lines.append("=" * 72)
        lines.append("                    声呐测距误差复盘报告")
        lines.append("=" * 72)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 公式和单位说明
        lines.append("-" * 72)
        lines.append("【公式与单位说明】")
        lines.append("-" * 72)
        lines.append("  声速公式: c(T) = 1449.2 + 4.6T - 0.055T² + 0.00029T³")
        lines.append("  测距公式: d = c × t / 2")
        lines.append("  反算公式: t = 2d / c")
        lines.append("")
        lines.append("  单位约定:")
        lines.append("    水温(T)  : ℃ (摄氏度)")
        lines.append("    声速(c)  : m/s (米/秒)")
        lines.append("    回波时间(t): s (秒)")
        lines.append("    距离(d)  : m (米)")
        lines.append("")
        lines.append("  物理边界:")
        lines.append("    水温: [-2, 40] ℃")
        lines.append("    回波时间: [0.001, 10] s")
        lines.append("    声速: [1400, 1550] m/s")
        lines.append("    距离: ≥ 0 m")
        lines.append("")
        
        # 导入统计
        lines.append("-" * 72)
        lines.append("【数据导入统计】")
        lines.append("-" * 72)
        total_imported = import_stats.get('total_records', 0)
        lines.append(f"  总导入记录数: {total_imported}")
        for source, count in import_stats.get('sources', {}).items():
            lines.append(f"    - {source}: {count} 条")
        lines.append("")
        
        # 总体统计
        lines.append("-" * 72)
        lines.append("【总体统计】")
        lines.append("-" * 72)
        lines.append(f"  有效记录: {len(valid_records)} 条")
        lines.append(f"  无效记录: {len(invalid_records)} 条")
        if all_records:
            rate = len(valid_records) / len(all_records) * 100
            lines.append(f"  有效率: {rate:.1f}%")
        lines.append("")
        
        # 错误汇总
        if error_summary.get('errors') or error_summary.get('warnings'):
            lines.append("-" * 72)
            lines.append("【错误/警告汇总】")
            lines.append("-" * 72)
            
            for err in error_summary.get('errors', []):
                lines.append(f"  [{err['code']}] 影响记录数: {err['affected_count']}")
                lines.append(f"    {err['message']}")
                explanation = ERROR_EXPLANATIONS.get(err['code'], {})
                if explanation:
                    lines.append(f"    原因: {explanation.get('description', '')}")
                    lines.append(f"    影响: {explanation.get('impact', '')}")
                    lines.append(f"    建议: {explanation.get('suggestion', '')}")
                lines.append(f"    涉及记录: {', '.join(err['affected_records'][:10])}"
                           + (" ..." if len(err['affected_records']) > 10 else ""))
                lines.append("")
            
            for warn in error_summary.get('warnings', []):
                lines.append(f"  [{warn['code']}] 影响记录数: {warn['affected_count']}")
                lines.append(f"    {warn['message']}")
                lines.append(f"    涉及记录: {', '.join(warn['affected_records'][:10])}"
                           + (" ..." if len(warn['affected_records']) > 10 else ""))
                lines.append("")
        
        # 有效记录详情
        if valid_records:
            lines.append("-" * 72)
            lines.append("【有效记录详情】")
            lines.append("-" * 72)
            for r in valid_records:
                lines.append(f"  [{r.record_id}] 来源: {r.source}")
                lines.append(f"    设备: {r.device_id or 'N/A'}  小组: {r.team or 'N/A'}")
                lines.append(f"    水温: {r.temperature}℃  回波时间: {r.echo_time}s")
                lines.append(f"    测量距离: {r.measured_distance}m")
                if r.calculated_velocity:
                    lines.append(f"    计算声速: {r.calculated_velocity} m/s")
                if r.calculated_distance:
                    lines.append(f"    计算距离: {r.calculated_distance} m")
                if r.measured_distance and r.calculated_distance:
                    deviation = abs(r.measured_distance - r.calculated_distance)
                    deviation_pct = deviation / r.measured_distance * 100 if r.measured_distance > 0 else 0
                    lines.append(f"    测量-计算偏差: {deviation:.2f}m ({deviation_pct:.1f}%)")
                if r.warnings:
                    for w in r.warnings:
                        lines.append(f"    ⚠ {w}")
                lines.append("")
        
        # 无效记录详情
        if invalid_records:
            lines.append("-" * 72)
            lines.append("【无效记录详情】")
            lines.append("-" * 72)
            for r in invalid_records:
                lines.append(f"  [{r.record_id}] 来源: {r.source}")
                lines.append(f"    设备: {r.device_id or 'N/A'}  小组: {r.team or 'N/A'}")
                lines.append(f"    水温: {r.temperature}℃  回波时间: {r.echo_time}s  距离: {r.measured_distance}m")
                lines.append(f"    处理步骤:")
                for i, step in enumerate(r.processing_steps, 1):
                    lines.append(f"      {i}. {step}")
                if r.errors:
                    lines.append(f"    错误:")
                    for err in r.errors:
                        lines.append(f"      ✗ {err}")
                if r.warnings:
                    lines.append(f"    警告:")
                    for warn in r.warnings:
                        lines.append(f"      ⚠ {warn}")
                lines.append("")
        
        # 处理顺序
        processing_order = error_summary.get('processing_order', [])
        if processing_order:
            lines.append("-" * 72)
            lines.append("【处理顺序】")
            lines.append("-" * 72)
            for i, step in enumerate(processing_order, 1):
                lines.append(f"  {i}. {step}")
            lines.append("")
        
        lines.append("=" * 72)
        lines.append("报告结束")
        lines.append("=" * 72)
        
        report_text = "\n".join(lines)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(report_text)
        
        return str(path)
