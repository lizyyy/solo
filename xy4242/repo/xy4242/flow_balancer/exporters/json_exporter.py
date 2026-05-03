"""JSON审计包导出器"""

import json
from dataclasses import asdict, is_dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Any, Optional

from ..core.fluidics import SimulationResult, TimeSegmentResult, MixingRatio
from ..core.rules import (
    RuleEvaluationResult,
    RuleViolation,
    RuleSeverity,
    RuleEngine,
)
from ..core.units import convert
from ..validators.topology_validator import ValidationResult, ValidationIssue, ValidationSeverity


class JSONEncoder(json.JSONEncoder):
    """自定义JSON编码器"""
    
    def default(self, obj: Any) -> Any:
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        if is_dataclass(obj) and not isinstance(obj, type):
            return self._dataclass_to_dict(obj)
        if hasattr(obj, '__dict__'):
            return obj.__dict__
        return super().default(obj)
    
    def _dataclass_to_dict(self, obj: Any) -> Dict[str, Any]:
        """将dataclass转换为字典"""
        result = {}
        for key, value in asdict(obj).items():
            # 跳过保护字段
            if key.startswith('_'):
                continue
            # 处理特殊类型
            if isinstance(value, Enum):
                result[key] = value.value
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif is_dataclass(value) and not isinstance(value, type):
                result[key] = self._dataclass_to_dict(value)
            elif isinstance(value, list):
                result[key] = [
                    self._dataclass_to_dict(item) 
                    if is_dataclass(item) and not isinstance(item, type)
                    else item.value if isinstance(item, Enum)
                    else item
                    for item in value
                ]
            elif isinstance(value, dict):
                result[key] = {
                    k: self._dataclass_to_dict(v)
                    if is_dataclass(v) and not isinstance(type, type)
                    else v.value if isinstance(v, Enum)
                    else v
                    for k, v in value.items()
                }
            else:
                result[key] = value
        return result


class JSONExporter:
    """JSON审计包导出器"""
    
    @classmethod
    def _convert_simulation_result(
        cls,
        simulation_result: SimulationResult,
    ) -> Dict[str, Any]:
        """转换仿真结果为可序列化格式"""
        time_segments = []
        for seg in simulation_result.time_segments:
            # 转换混合比例
            mixing_ratios = []
            for ratio in seg.mixing_ratios:
                mixing_ratios.append({
                    "reagent_id": ratio.reagent_id,
                    "reagent_name": ratio.reagent_name,
                    "target_ratio": ratio.target_ratio,
                    "actual_ratio": ratio.actual_ratio,
                    "deviation": ratio.deviation,
                    "relative_deviation_percent": ratio.relative_deviation,
                })
            
            # 转换延迟体积
            delay_volumes = {}
            for reagent_id, vol_m3 in seg.delay_volumes.items():
                vol_ul = convert(vol_m3, "m3", "uL", "volume")
                delay_volumes[reagent_id] = {
                    "volume_m3": vol_m3,
                    "volume_ul": vol_ul,
                }
            
            # 转换通道流量
            channel_flows = {}
            for ch_id, flow_m3s in seg.channel_flow_rates.items():
                flow_ul_min = convert(flow_m3s, "m3/s", "μL/min", "flow_rate")
                channel_flows[ch_id] = {
                    "flow_rate_m3s": flow_m3s,
                    "flow_rate_ul_min": flow_ul_min,
                }
            
            # 转换通道压降
            channel_pressures = {}
            for ch_id, p_pa in seg.channel_pressure_drops.items():
                p_bar = convert(p_pa, "Pa", "bar", "pressure")
                channel_pressures[ch_id] = {
                    "pressure_drop_pa": p_pa,
                    "pressure_drop_bar": p_bar,
                }
            
            # 转换入口流量
            inlet_flows = {}
            for inlet_id, flow_m3s in seg.inlet_flow_rates.items():
                flow_ul_min = convert(flow_m3s, "m3/s", "μL/min", "flow_rate")
                inlet_flows[inlet_id] = {
                    "flow_rate_m3s": flow_m3s,
                    "flow_rate_ul_min": flow_ul_min,
                }
            
            time_segments.append({
                "segment_index": len(time_segments),
                "time_start_sec": seg.time_start,
                "time_end_sec": seg.time_end,
                "duration_sec": seg.duration,
                "inlet_flow_rates": inlet_flows,
                "channel_flow_rates": channel_flows,
                "channel_pressure_drops": channel_pressures,
                "node_pressures_pa": seg.node_pressures,
                "delay_volumes": delay_volumes,
                "mixing_ratios": mixing_ratios,
            })
        
        # 汇总统计
        total_dead_ul = convert(simulation_result.total_dead_volume, "m3", "uL", "volume")
        max_p_bar = convert(simulation_result.max_pressure_drop, "Pa", "bar", "pressure")
        
        # 转换风险
        risks = []
        for risk in simulation_result.risks:
            risks.append({
                "type": risk.get("type", "unknown"),
                "severity": risk.get("severity", "medium"),
                "message": risk.get("message", ""),
                "value": risk.get("value"),
                "unit": risk.get("unit"),
                "threshold": risk.get("threshold"),
            })
        
        return {
            "total_time_sec": simulation_result.total_time,
            "total_time_min": simulation_result.total_time / 60.0,
            "segment_count": len(time_segments),
            "summary": {
                "max_pressure_drop_pa": simulation_result.max_pressure_drop,
                "max_pressure_drop_bar": max_p_bar,
                "max_relative_deviation_percent": simulation_result.max_relative_deviation,
                "total_dead_volume_m3": simulation_result.total_dead_volume,
                "total_dead_volume_ul": total_dead_ul,
            },
            "time_segments": time_segments,
            "risks": risks,
        }
    
    @classmethod
    def _convert_rule_results(
        cls,
        rule_results: List[RuleEvaluationResult],
    ) -> Dict[str, Any]:
        """转换规则评估结果"""
        rules_data = []
        all_violations: List[Dict[str, Any]] = []
        
        # 按严重程度统计
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }
        
        for result in rule_results:
            rule_data = {
                "rule_id": result.rule_id,
                "rule_name": result.rule_name,
                "is_passed": result.is_passed,
                "violation_count": len(result.violations),
            }
            
            rules_data.append(rule_data)
            
            # 转换违规
            for violation in result.violations:
                severity = violation.severity.value if isinstance(violation.severity, Enum) else str(violation.severity)
                
                violation_data = {
                    "rule_id": violation.rule_id,
                    "rule_name": violation.rule_name,
                    "severity": severity,
                    "message": violation.message,
                    "value": violation.value,
                    "unit": violation.unit,
                    "threshold": violation.threshold,
                    "location": violation.location,
                    "suggestion": violation.suggestion,
                    "context": violation.context,
                }
                all_violations.append(violation_data)
                
                # 统计
                if severity in severity_counts:
                    severity_counts[severity] += 1
        
        # 按严重程度排序违规
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        sorted_violations = sorted(
            all_violations,
            key=lambda v: severity_order.get(v.get("severity", "info"), 999)
        )
        
        return {
            "rules": rules_data,
            "violations": sorted_violations,
            "summary": {
                "total_rules": len(rules_data),
                "passed_rules": sum(1 for r in rules_data if r["is_passed"]),
                "failed_rules": sum(1 for r in rules_data if not r["is_passed"]),
                "total_violations": len(all_violations),
                "violation_count_by_severity": severity_counts,
            }
        }
    
    @classmethod
    def _convert_validation_result(
        cls,
        validation_result: Optional[ValidationResult],
    ) -> Optional[Dict[str, Any]]:
        """转换校验结果"""
        if validation_result is None:
            return None
        
        issues = []
        for issue in validation_result.issues:
            severity = issue.severity.value if isinstance(issue.severity, Enum) else str(issue.severity)
            
            issues.append({
                "code": issue.code,
                "severity": severity,
                "message": issue.message,
                "location": issue.location,
                "details": issue.details,
            })
        
        return {
            "is_valid": validation_result.is_valid,
            "error_count": len(validation_result.errors),
            "warning_count": len(validation_result.warnings),
            "info_count": len(validation_result.infos),
            "issues": issues,
        }
    
    @classmethod
    def export(
        cls,
        output_path: str,
        simulation_result: SimulationResult,
        rule_results: List[RuleEvaluationResult],
        validation_result: Optional[ValidationResult] = None,
        topology_data: Optional[Any] = None,
        pump_program: Optional[Any] = None,
        viscosity_data: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        导出完整的JSON审计包
        
        Args:
            output_path: 输出文件路径
            simulation_result: 仿真结果
            rule_results: 规则评估结果
            validation_result: 校验结果
            topology_data: 拓扑数据
            pump_program: 泵程序
            viscosity_data: 黏度数据
            metadata: 元数据
        
        Returns:
            输出文件路径
        """
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # 构建审计包
        audit_package = {
            "audit_info": {
                "generated_at": datetime.now().isoformat(),
                "tool": "flow-balancer",
                "version": "0.1.0",
            },
            "metadata": metadata or {},
            "simulation": cls._convert_simulation_result(simulation_result),
            "rule_evaluation": cls._convert_rule_results(rule_results),
        }
        
        # 添加校验结果
        validation_data = cls._convert_validation_result(validation_result)
        if validation_data:
            audit_package["validation"] = validation_data
        
        # 添加输入数据摘要
        input_summary = {}
        
        if topology_data:
            if hasattr(topology_data, 'name'):
                input_summary["topology_name"] = topology_data.name
            if hasattr(topology_data, 'version'):
                input_summary["topology_version"] = topology_data.version
            if hasattr(topology_data, 'nodes'):
                input_summary["node_count"] = len(topology_data.nodes)
            if hasattr(topology_data, 'channels'):
                input_summary["channel_count"] = len(topology_data.channels)
        
        if pump_program and hasattr(pump_program, 'segments'):
            input_summary["pump_segment_count"] = len(pump_program.segments)
        
        if viscosity_data:
            if hasattr(viscosity_data, 'reagents'):
                input_summary["reagent_count"] = len(viscosity_data.reagents)
            if hasattr(viscosity_data, 'experiment_temperature'):
                input_summary["experiment_temperature"] = viscosity_data.experiment_temperature
        
        audit_package["input_summary"] = input_summary
        
        # 写入JSON文件
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(
                audit_package,
                f,
                cls=JSONEncoder,
                ensure_ascii=False,
                indent=2,
                default=str,
            )
        
        return str(path)
