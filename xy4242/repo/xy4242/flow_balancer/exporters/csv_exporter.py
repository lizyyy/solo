"""CSV风险表导出器"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from ..core.rules import RuleEvaluationResult, RuleViolation, RuleSeverity
from ..core.fluidics import SimulationResult, TimeSegmentResult
from ..core.units import convert


class CSVExporter:
    """CSV导出器"""
    
    @classmethod
    def export_risks(
        cls,
        output_path: str,
        rule_results: List[RuleEvaluationResult],
        simulation_result: Optional[SimulationResult] = None,
    ) -> str:
        """
        导出风险表到CSV
        
        Args:
            output_path: 输出文件路径
            rule_results: 规则评估结果
            simulation_result: 仿真结果（可选）
        
        Returns:
            输出文件路径
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # 收集所有违规
        all_violations: List[RuleViolation] = []
        for rr in rule_results:
            all_violations.extend(rr.violations)
        
        # 按严重程度排序
        severity_order = {
            RuleSeverity.CRITICAL: 0,
            RuleSeverity.HIGH: 1,
            RuleSeverity.MEDIUM: 2,
            RuleSeverity.LOW: 3,
            RuleSeverity.INFO: 4,
        }
        sorted_violations = sorted(
            all_violations,
            key=lambda v: severity_order.get(v.severity, 999)
        )
        
        # 准备CSV数据
        fieldnames = [
            "严重程度",
            "严重程度代码",
            "规则ID",
            "规则名称",
            "描述",
            "数值",
            "单位",
            "阈值",
            "位置",
            "修复建议",
        ]
        
        rows = []
        for v in sorted_violations:
            severity_name = {
                RuleSeverity.CRITICAL: "严重",
                RuleSeverity.HIGH: "高",
                RuleSeverity.MEDIUM: "中",
                RuleSeverity.LOW: "低",
                RuleSeverity.INFO: "信息",
            }.get(v.severity, "未知")
            
            rows.append({
                "严重程度": severity_name,
                "严重程度代码": v.severity.value,
                "规则ID": v.rule_id,
                "规则名称": v.rule_name,
                "描述": v.message,
                "数值": f"{v.value:.6f}" if v.value is not None else "",
                "单位": v.unit or "",
                "阈值": f"{v.threshold:.6f}" if v.threshold is not None else "",
                "位置": v.location or "",
                "修复建议": v.suggestion or "",
            })
        
        # 写入CSV
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return str(path)
    
    @classmethod
    def export_time_series(
        cls,
        output_path: str,
        simulation_result: SimulationResult,
    ) -> str:
        """
        导出时间序列数据到CSV
        
        Args:
            output_path: 输出文件路径
            simulation_result: 仿真结果
        
        Returns:
            输出文件路径
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # 收集所有字段
        all_inlets: set = set()
        all_channels: set = set()
        all_reagents: set = set()
        
        for segment in simulation_result.time_segments:
            all_inlets.update(segment.inlet_flow_rates.keys())
            all_channels.update(segment.channel_pressure_drops.keys())
            for ratio in segment.mixing_ratios:
                all_reagents.add(ratio.reagent_id)
        
        # 构建字段名
        fieldnames = [
            "时间段序号",
            "开始时间(s)",
            "结束时间(s)",
            "持续时间(s)",
        ]
        
        # 入口流量字段
        for inlet_id in sorted(all_inlets):
            fieldnames.append(f"入口_{inlet_id}_流量(μL/min)")
        
        # 通道压降字段
        for ch_id in sorted(all_channels):
            fieldnames.append(f"通道_{ch_id}_压降(bar)")
        
        # 混合比例字段
        for reagent_id in sorted(all_reagents):
            fieldnames.append(f"试剂_{reagent_id}_目标比例")
            fieldnames.append(f"试剂_{reagent_id}_实际比例")
            fieldnames.append(f"试剂_{reagent_id}_相对偏差(%)")
        
        # 构建行数据
        rows = []
        for seg_idx, segment in enumerate(simulation_result.time_segments):
            row = {
                "时间段序号": seg_idx + 1,
                "开始时间(s)": f"{segment.time_start:.3f}",
                "结束时间(s)": f"{segment.time_end:.3f}",
                "持续时间(s)": f"{segment.duration:.3f}",
            }
            
            # 入口流量
            for inlet_id in sorted(all_inlets):
                flow_m3s = segment.inlet_flow_rates.get(inlet_id, 0.0)
                flow_ul_min = convert(flow_m3s, "m3/s", "μL/min", "flow_rate")
                row[f"入口_{inlet_id}_流量(μL/min)"] = f"{flow_ul_min:.6f}"
            
            # 通道压降
            for ch_id in sorted(all_channels):
                p_drop_pa = segment.channel_pressure_drops.get(ch_id, 0.0)
                p_drop_bar = convert(p_drop_pa, "Pa", "bar", "pressure")
                row[f"通道_{ch_id}_压降(bar)"] = f"{p_drop_bar:.8f}"
            
            # 混合比例
            reagent_ratios = {r.reagent_id: r for r in segment.mixing_ratios}
            for reagent_id in sorted(all_reagents):
                ratio = reagent_ratios.get(reagent_id)
                if ratio:
                    row[f"试剂_{reagent_id}_目标比例"] = f"{ratio.target_ratio:.6f}"
                    row[f"试剂_{reagent_id}_实际比例"] = f"{ratio.actual_ratio:.6f}"
                    row[f"试剂_{reagent_id}_相对偏差(%)"] = f"{ratio.relative_deviation:.4f}"
                else:
                    row[f"试剂_{reagent_id}_目标比例"] = ""
                    row[f"试剂_{reagent_id}_实际比例"] = ""
                    row[f"试剂_{reagent_id}_相对偏差(%)"] = ""
            
            rows.append(row)
        
        # 写入CSV
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return str(path)
    
    @classmethod
    def export_summary(
        cls,
        output_path: str,
        simulation_result: SimulationResult,
        rule_results: List[RuleEvaluationResult],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        导出汇总表到CSV
        
        Args:
            output_path: 输出文件路径
            simulation_result: 仿真结果
            rule_results: 规则评估结果
            metadata: 元数据
        
        Returns:
            输出文件路径
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # 统计风险
        all_violations: List[RuleViolation] = []
        for rr in rule_results:
            all_violations.extend(rr.violations)
        
        critical_count = sum(1 for v in all_violations if v.severity == RuleSeverity.CRITICAL)
        high_count = sum(1 for v in all_violations if v.severity == RuleSeverity.HIGH)
        medium_count = sum(1 for v in all_violations if v.severity == RuleSeverity.MEDIUM)
        low_count = sum(1 for v in all_violations if v.severity == RuleSeverity.LOW)
        
        # 转换单位
        total_time_min = simulation_result.total_time / 60.0
        max_p_bar = convert(simulation_result.max_pressure_drop, "Pa", "bar", "pressure")
        total_dead_ul = convert(simulation_result.total_dead_volume, "m3", "uL", "volume")
        
        # 汇总数据
        summary_data = [
            {"指标": "芯片名称", "数值": metadata.get("chip_name", "未知") if metadata else "未知"},
            {"指标": "版本", "数值": metadata.get("version", "未知") if metadata else "未知"},
            {"指标": "生成时间", "数值": datetime.now().strftime("%Y-%m-%d %H:%M:%S")},
            {"指标": "总仿真时间(秒)", "数值": f"{simulation_result.total_time:.2f}"},
            {"指标": "总仿真时间(分钟)", "数值": f"{total_time_min:.2f}"},
            {"指标": "时间段数量", "数值": str(len(simulation_result.time_segments))},
            {"指标": "最大压降(bar)", "数值": f"{max_p_bar:.6f}"},
            {"指标": "最大比例偏差(%)", "数值": f"{simulation_result.max_relative_deviation:.4f}"},
            {"指标": "系统死体积(μL)", "数值": f"{total_dead_ul:.6f}"},
            {"指标": "严重风险数量", "数值": str(critical_count)},
            {"指标": "高风险数量", "数值": str(high_count)},
            {"指标": "中风险数量", "数值": str(medium_count)},
            {"指标": "低风险数量", "数值": str(low_count)},
        ]
        
        # 总体状态
        if critical_count > 0 or high_count > 0:
            status = "有高风险，建议修复"
        elif medium_count > 0:
            status = "有中等风险，建议注意"
        else:
            status = "无明显风险"
        
        summary_data.append({"指标": "总体状态", "数值": status})
        
        # 写入CSV
        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["指标", "数值"])
            writer.writeheader()
            writer.writerows(summary_data)
        
        return str(path)
