"""注射泵程序校验器"""

from typing import Dict, List, Any, Optional, Set

from ..parsers.pump_parser import PumpProgram, PumpProgramSegment
from ..core.units import is_valid_unit, UnitConverter
from .topology_validator import ValidationResult, ValidationIssue, ValidationSeverity


class PumpProgramValidator:
    """注射泵程序校验器"""
    
    # 常见的合理流量范围 (μL/min)
    MIN_REASONABLE_FLOW = 0.001  # 1 nL/min
    MAX_REASONABLE_FLOW = 10000.0  # 10 mL/min
    
    # 合理的时间段范围
    MIN_REASONABLE_DURATION = 0.1  # 0.1 秒
    MAX_REASONABLE_DURATION = 86400.0  # 24 小时
    
    @classmethod
    def validate(
        cls,
        program: PumpProgram,
        topology: Optional[Any] = None,
    ) -> ValidationResult:
        """校验泵程序"""
        result = ValidationResult()
        
        # 1. 校验基础结构
        cls._validate_structure(program, result)
        
        # 2. 校验各个时间段
        cls._validate_segments(program, result)
        
        # 3. 如果有拓扑数据，校验入口映射
        if topology is not None:
            cls._validate_topology_mapping(program, topology, result)
        
        return result
    
    @classmethod
    def _validate_structure(cls, program: PumpProgram, result: ValidationResult):
        """校验基础结构"""
        if not program.segments:
            result.add_error(
                "PUMP_001",
                "泵程序中没有定义任何时间段",
            )
            return
        
        # 检查是否有泵被使用
        all_pumps: Set[str] = set()
        for seg in program.segments:
            all_pumps.update(seg.pump_flows.keys())
        
        if not all_pumps:
            result.add_warning(
                "PUMP_002",
                "泵程序中没有定义任何泵的流量",
            )
        
        # 检查时间顺序
        total_duration = 0.0
        for seg in program.segments:
            try:
                from ..core.units import convert
                total_duration += convert(seg.duration, seg.duration_unit, "s", "time")
            except Exception:
                pass
        
        if total_duration > 0:
            result.add_info(
                "PUMP_003",
                f"程序总时长: {total_duration:.1f} 秒 ({total_duration/60:.1f} 分钟)",
            )
    
    @classmethod
    def _validate_segments(cls, program: PumpProgram, result: ValidationResult):
        """校验各个时间段"""
        for seg_idx, seg in enumerate(program.segments):
            location = f"segment[{seg_idx}]"
            
            # 校验持续时间
            cls._validate_duration(seg, location, result)
            
            # 校验各泵的流量
            cls._validate_flows(seg, location, result)
    
    @classmethod
    def _validate_duration(
        cls,
        segment: PumpProgramSegment,
        location: str,
        result: ValidationResult,
    ):
        """校验持续时间"""
        # 检查时间单位
        if segment.duration_unit and not is_valid_unit(segment.duration_unit, "time"):
            result.add_error(
                "PUMP_010",
                f"无效的时间单位: {segment.duration_unit}",
                location=location,
            )
        
        # 检查时间值
        if segment.duration < 0:
            result.add_error(
                "PUMP_011",
                f"持续时间不能为负数: {segment.duration}",
                location=location,
            )
        elif segment.duration == 0:
            result.add_warning(
                "PUMP_012",
                "持续时间为0，该时间段将被跳过",
                location=location,
            )
        elif segment.duration < cls.MIN_REASONABLE_DURATION:
            result.add_warning(
                "PUMP_013",
                f"持续时间过短 ({segment.duration} {segment.duration_unit})，可能难以精确控制",
                location=location,
            )
        elif segment.duration > cls.MAX_REASONABLE_DURATION:
            result.add_warning(
                "PUMP_014",
                f"持续时间过长 ({segment.duration} {segment.duration_unit})",
                location=location,
            )
    
    @classmethod
    def _validate_flows(
        cls,
        segment: PumpProgramSegment,
        location: str,
        result: ValidationResult,
    ):
        """校验流量配置"""
        for pump_id, (flow_value, flow_unit) in segment.pump_flows.items():
            pump_location = f"{location}.pump.{pump_id}"
            
            # 检查流量单位
            if flow_unit:
                try:
                    # 尝试解析流量单位
                    UnitConverter.parse_flow_rate(1.0, flow_unit)
                except ValueError:
                    result.add_error(
                        "PUMP_020",
                        f"无效的流量单位: {flow_unit}",
                        location=pump_location,
                    )
            
            # 检查流量值
            if flow_value < 0:
                result.add_error(
                    "PUMP_021",
                    f"流量不能为负数: {flow_value}",
                    location=pump_location,
                )
            elif flow_value == 0:
                result.add_info(
                    "PUMP_022",
                    f"泵流量为0，该泵在此时间段停止",
                    location=pump_location,
                )
            else:
                # 检查合理范围 (转换到 μL/min)
                try:
                    flow_ul_min = UnitConverter.convert(flow_value, flow_unit, "μL/min", "flow_rate")
                    
                    if flow_ul_min < cls.MIN_REASONABLE_FLOW:
                        result.add_warning(
                            "PUMP_023",
                            f"流量过低 ({flow_ul_min:.4f} μL/min)，可能超出泵的精度范围",
                            location=pump_location,
                        )
                    elif flow_ul_min > cls.MAX_REASONABLE_FLOW:
                        result.add_warning(
                            "PUMP_024",
                            f"流量过高 ({flow_ul_min:.2f} μL/min)，可能超出泵的范围",
                            location=pump_location,
                        )
                except Exception:
                    # 单位转换失败已经在前面检查过
                    pass
    
    @classmethod
    def _validate_topology_mapping(
        cls,
        program: PumpProgram,
        topology: Any,
        result: ValidationResult,
    ):
        """校验与拓扑的映射关系"""
        from ..parsers.topology_parser import TopologyData
        
        if not isinstance(topology, TopologyData):
            return
        
        # 获取拓扑中的入口节点
        inlet_nodes = {
            n_id for n_id, n in topology.nodes.items()
            if n.type.lower() == "inlet"
        }
        
        # 获取程序中使用的泵/入口
        program_inlets: Set[str] = set()
        for seg in program.segments:
            program_inlets.update(seg.pump_flows.keys())
        
        # 检查是否有入口没有在程序中使用
        for inlet_node in inlet_nodes:
            if inlet_node not in program_inlets:
                result.add_warning(
                    "PUMP_030",
                    f"拓扑中的入口节点 '{inlet_node}' 在泵程序中没有定义流量",
                )
        
        # 检查程序中是否有不存在的入口
        for inlet_id in program_inlets:
            if inlet_id not in topology.nodes:
                result.add_warning(
                    "PUMP_031",
                    f"泵程序中使用的入口 '{inlet_id}' 在拓扑中不存在",
                )
