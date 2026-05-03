"""注射泵程序解析器"""

import csv
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path

from ..core.units import UnitConverter, convert


@dataclass
class PumpProgramSegment:
    """泵程序时间段"""
    segment_index: int
    duration: float  # 持续时间 (秒)
    duration_unit: str = "s"
    
    # 各泵的流量配置
    pump_flows: Dict[str, Tuple[float, str]] = field(default_factory=dict)  # pump_id -> (value, unit)


@dataclass
class PumpProgram:
    """注射泵程序"""
    name: str
    description: str
    segments: List[PumpProgramSegment] = field(default_factory=list)
    
    # 泵信息
    pump_info: Dict[str, str] = field(default_factory=dict)  # pump_id -> name/description
    
    # 入口节点映射
    pump_to_inlet: Dict[str, str] = field(default_factory=dict)  # pump_id -> node_id


class PumpProgramParser:
    """注射泵程序CSV解析器"""
    
    @classmethod
    def parse_file(cls, file_path: str) -> PumpProgram:
        """从CSV文件解析泵程序"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"泵程序文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        return cls.parse_rows(rows)
    
    @classmethod
    def parse_rows(cls, rows: List[Dict[str, str]]) -> PumpProgram:
        """从CSV行列表解析泵程序"""
        if not rows:
            raise ValueError("泵程序文件为空")
        
        # 获取表头
        headers = list(rows[0].keys())
        
        # 识别泵列
        # 格式: "PumpA_Flow", "PumpA_Unit", "PumpB_Flow", "PumpB_Unit"
        # 或者: "PumpA", "PumpA_Unit", "Duration"
        
        pump_columns: Dict[str, List[str]] = {}  # pump_id -> [flow_col, unit_col]
        duration_col = None
        
        # 首先查找持续时间列
        for h in headers:
            h_lower = h.lower()
            if "duration" in h_lower or "时间" in h_lower or "时长" in h_lower:
                duration_col = h
                break
        
        if not duration_col:
            # 尝试查找常见名称
            for h in headers:
                if h in ["time", "duration", "时长", "时间", "持续时间"]:
                    duration_col = h
                    break
        
        # 识别泵列
        # 模式1: "PumpA_Flow", "PumpA_Unit"
        for h in headers:
            if "_Flow" in h or "_flow" in h:
                pump_id = h.rsplit("_", 1)[0]
                unit_col = f"{pump_id}_Unit"
                if unit_col in headers:
                    pump_columns[pump_id] = [h, unit_col]
            elif "_flow_rate" in h:
                pump_id = h.rsplit("_", 2)[0]
                unit_col = f"{pump_id}_unit"
                if unit_col in headers:
                    pump_columns[pump_id] = [h, unit_col]
        
        # 模式2: 单独的流量列，单位列名包含 "unit"
        if not pump_columns:
            for h in headers:
                h_lower = h.lower()
                if h_lower in ["duration", "time", "时长", "时间", "持续时间", "duration_unit", "time_unit"]:
                    continue
                if "unit" not in h_lower and "单位" not in h_lower:
                    # 可能是流量列
                    pump_id = h
                    # 查找对应的单位列
                    unit_candidates = [f"{h}_unit", f"{h}_Unit", f"{h}单位", f"{h}单位"]
                    unit_col = None
                    for uc in unit_candidates:
                        if uc in headers:
                            unit_col = uc
                            break
                    # 如果没有单位列，检查是否有全局单位列
                    if not unit_col:
                        for h2 in headers:
                            h2_lower = h2.lower()
                            if "unit" in h2_lower or "单位" in h2_lower:
                                unit_col = h2
                                break
                    
                    pump_columns[pump_id] = [h, unit_col or ""]
        
        # 解析每行数据
        segments: List[PumpProgramSegment] = []
        
        for idx, row in enumerate(rows):
            # 解析持续时间
            duration = 0.0
            duration_unit = "s"
            
            if duration_col and duration_col in row:
                duration_str = row[duration_col].strip()
                if duration_str:
                    # 尝试解析带单位的值，如 "5 min" 或 "300"
                    parts = duration_str.split()
                    if len(parts) >= 2:
                        duration = float(parts[0])
                        duration_unit = parts[1]
                    else:
                        duration = float(duration_str)
            
            # 解析各泵的流量
            pump_flows: Dict[str, Tuple[float, str]] = {}
            
            for pump_id, (flow_col, unit_col) in pump_columns.items():
                flow_str = row.get(flow_col, "").strip()
                if not flow_str:
                    continue
                
                # 解析流量值
                # 可能的格式: "10" + unit="μL/min", 或 "10 μL/min"
                flow_value = 0.0
                flow_unit = ""
                
                # 先尝试解析带单位的格式
                parts = flow_str.split()
                if len(parts) >= 2:
                    flow_value = float(parts[0])
                    flow_unit = " ".join(parts[1:])
                else:
                    flow_value = float(flow_str)
                    # 从单位列获取
                    if unit_col and unit_col in row:
                        flow_unit = row[unit_col].strip()
                
                if flow_unit:
                    pump_flows[pump_id] = (flow_value, flow_unit)
                else:
                    # 默认单位
                    pump_flows[pump_id] = (flow_value, "μL/min")
            
            segment = PumpProgramSegment(
                segment_index=idx,
                duration=duration,
                duration_unit=duration_unit,
                pump_flows=pump_flows,
            )
            segments.append(segment)
        
        return PumpProgram(
            name="注射泵程序",
            description="从CSV解析的泵程序",
            segments=segments,
        )


def pump_program_to_segments(
    program: PumpProgram,
    topology: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    将泵程序转换为仿真可用的时间段格式
    
    Args:
        program: 解析的泵程序
        topology: 可选的拓扑数据，用于泵到入口节点的映射
    
    Returns:
        时间段列表，每个包含 duration(秒) 和 inlet_flows {node_id: flow_rate(m³/s)}
    """
    segments: List[Dict[str, Any]] = []
    
    # 获取泵到入口节点的映射
    pump_to_inlet: Dict[str, str] = {}
    if topology and hasattr(topology, 'inlet_reagents'):
        # 反转映射: reagent_id -> node_id
        reagent_to_node = {v: k for k, v in topology.inlet_reagents.items()}
        # 假设 pump_id 对应 reagent_id
        for pump_id in program.pump_to_inlet.keys() if program.pump_to_inlet else []:
            pump_to_inlet[pump_id] = program.pump_to_inlet[pump_id]
    
    for seg in program.segments:
        # 转换持续时间到秒
        duration_sec = convert(seg.duration, seg.duration_unit, "s", "time")
        
        # 转换流量到 m³/s
        inlet_flows: Dict[str, float] = {}
        
        for pump_id, (flow_value, flow_unit) in seg.pump_flows.items():
            # 确定入口节点ID
            # 优先级: 1. pump_to_inlet映射 2. pump_id直接作为node_id
            node_id = pump_to_inlet.get(pump_id, pump_id)
            
            # 转换流量单位
            try:
                flow_m3s = convert(flow_value, flow_unit, "m3/s", "flow_rate")
                inlet_flows[node_id] = flow_m3s
            except ValueError:
                # 如果单位不支持，尝试解析
                flow_m3s = UnitConverter.parse_flow_rate(flow_value, flow_unit)
                inlet_flows[node_id] = flow_m3s
        
        segments.append({
            "duration": duration_sec,
            "inlet_flows": inlet_flows,
        })
    
    return segments
