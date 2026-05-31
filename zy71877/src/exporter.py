import os
from typing import List
from .models import FittingRecord, EnergyDataPoint


class ResultExporter:
    def __init__(self, export_dir: str = "./exports"):
        self.export_dir = export_dir
        os.makedirs(export_dir, exist_ok=True)

    def export_record(self, record: FittingRecord, include_raw: bool = True) -> str:
        filename = f"{record.record_id}_v{record.version}_model.txt"
        filepath = os.path.join(self.export_dir, filename)
        
        content = self._format_record_content(record, include_raw)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath

    def _format_record_content(self, record: FittingRecord, include_raw: bool) -> str:
        lines = []
        
        lines.append("=" * 70)
        lines.append("能耗峰谷拟合模型说明")
        lines.append("=" * 70)
        lines.append("")
        
        lines.append("【基本信息】")
        lines.append(f"记录ID: {record.record_id}")
        lines.append(f"版本号: v{record.version}")
        lines.append(f"批次ID: {record.batch_id}")
        lines.append(f"材料ID: {record.material_id}")
        lines.append(f"操作时间: {record.timestamp}")
        lines.append(f"操作人员: {record.operator}")
        lines.append(f"状态: {record.status}")
        if record.parent_id:
            lines.append(f"基于记录: {record.parent_id}")
        lines.append("")
        
        lines.append("【队员笔记】")
        lines.append(record.notes if record.notes else "(无)")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【拟合结果】")
        lines.append("-" * 70)
        lines.append("")
        
        lines.append(f"峰值数量: {len(record.fitting_result.peaks)}")
        for i, peak in enumerate(record.fitting_result.peaks, 1):
            lines.append(f"  峰值 #{i}: 时间={peak.timestamp:.2f}, 功率={peak.power:.2f}, 突出度={peak.prominence:.3f}")
        lines.append("")
        
        lines.append(f"谷值数量: {len(record.fitting_result.valleys)}")
        for i, valley in enumerate(record.fitting_result.valleys, 1):
            lines.append(f"  谷值 #{i}: 时间={valley.timestamp:.2f}, 功率={valley.power:.2f}, 突出度={valley.prominence:.3f}")
        lines.append("")
        
        lines.append(f"拟合误差(RMSE): {record.fitting_result.fitting_error:.3f}")
        lines.append("")
        
        if record.fitting_result.polynomial_coeffs:
            lines.append("多项式系数 (从高次到低次):")
            for i, coeff in enumerate(record.fitting_result.polynomial_coeffs):
                lines.append(f"  x^{len(record.fitting_result.polynomial_coeffs) - 1 - i}: {coeff:.6f}")
            lines.append("")
        
        lines.append("-" * 70)
        lines.append(f"【约束检查结果 - 共 {len(record.constraint_violations)} 项异常】")
        lines.append("-" * 70)
        lines.append("")
        
        if record.constraint_violations:
            severity_order = {"high": 0, "medium": 1, "low": 2}
            sorted_violations = sorted(
                record.constraint_violations,
                key=lambda v: severity_order.get(v.severity, 99)
            )
            
            for v in sorted_violations:
                severity_label = {"high": "🔴 高", "medium": "🟡 中", "low": "🟢 低"}.get(v.severity, v.severity)
                lines.append(f"[{severity_label}] {v.constraint_name}")
                lines.append(f"  约束值: {v.constraint_value}")
                lines.append(f"  实际值: {v.actual_value}")
                lines.append(f"  说明: {v.explanation}")
                lines.append("")
        else:
            lines.append("✅ 所有约束检查通过")
            lines.append("")
        
        lines.append("-" * 70)
        lines.append("【下一班注意事项】")
        lines.append("-" * 70)
        lines.append("")
        
        warnings = []
        for v in record.constraint_violations:
            if v.severity == "high":
                warnings.append(f"⚠️  需优先处理: {v.constraint_name} - {v.explanation}")
        
        if len(record.fitting_result.peaks) == 0:
            warnings.append("⚠️  未检测到峰值，请检查数据或调整参数")
        
        if len(record.fitting_result.valleys) == 0:
            warnings.append("⚠️  未检测到谷值，请检查数据或调整参数")
        
        if record.fitting_result.fitting_error > 3.0:
            warnings.append("⚠️  拟合误差较大，建议检查原始数据质量")
        
        if warnings:
            for w in warnings:
                lines.append(w)
        else:
            lines.append("✅ 当前结果可正常使用")
        
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【调试追踪信息】")
        lines.append("-" * 70)
        lines.append("")
        lines.append(f"输入数据哈希: {record.input_data_hash}")
        lines.append(f"平滑后数据点数: {len(record.fitting_result.smoothed_data)}")
        if record.fitting_result.smoothed_data:
            lines.append(f"平滑数据范围: {min(record.fitting_result.smoothed_data):.2f} ~ {max(record.fitting_result.smoothed_data):.2f}")
        lines.append("")
        
        lines.append("=" * 70)
        lines.append("文档结束")
        lines.append("=" * 70)
        
        return "\n".join(lines)

    def export_summary(self, records: List[FittingRecord], filename: str = "summary.txt") -> str:
        filepath = os.path.join(self.export_dir, filename)
        
        lines = []
        lines.append("=" * 80)
        lines.append("能耗峰谷拟合记录汇总")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append(f"{'记录ID':<20} {'版本':<6} {'材料ID':<12} {'时间':<20} {'状态':<10} {'异常数':<8}")
        lines.append("-" * 80)
        
        for record in records:
            lines.append(
                f"{record.record_id:<20} "
                f"v{record.version:<5} "
                f"{record.material_id:<12} "
                f"{record.timestamp:<20} "
                f"{record.status:<10} "
                f"{len(record.constraint_violations):<8}"
            )
        
        lines.append("")
        lines.append("=" * 80)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return filepath
