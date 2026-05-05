from __future__ import annotations
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
from .models import (
    RoomTopology, Room, Valve, FanCurve, AccessLog, ParticleCount,
    PressureCalculationResult, OptimizationResult, ProjectData
)


class Exporter:
    @staticmethod
    def to_json(obj: Any) -> str:
        if hasattr(obj, 'model_dump'):
            data = obj.model_dump()
        else:
            data = obj
        
        def default_serializer(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, 'model_dump'):
                return o.model_dump()
            raise TypeError(f"Object of type {type(o)} is not JSON serializable")
        
        return json.dumps(data, ensure_ascii=False, indent=2, default=default_serializer)

    @staticmethod
    def from_json(json_str: str, cls: type) -> Any:
        data = json.loads(json_str)
        
        def parse_datetime(d: Dict) -> Dict:
            for key, value in d.items():
                if isinstance(value, str):
                    try:
                        d[key] = datetime.fromisoformat(value)
                    except ValueError:
                        pass
                elif isinstance(value, dict):
                    d[key] = parse_datetime(value)
                elif isinstance(value, list):
                    for i, item in enumerate(value):
                        if isinstance(item, dict):
                            value[i] = parse_datetime(item)
            return d
        
        data = parse_datetime(data)
        return cls(**data)

    @staticmethod
    def generate_markdown_debug_report(
        project_data: ProjectData,
        opt_result: OptimizationResult,
        topology: RoomTopology
    ) -> str:
        lines = []
        
        lines.append("# 无尘洁净室压差风量调试报告")
        lines.append("")
        lines.append(f"**项目名称**: {project_data.project_name}")
        lines.append(f"**项目编号**: {project_data.project_id}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**版本**: {project_data.version}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、系统概览")
        lines.append("")
        lines.append(f"- **房间总数**: {len(topology.rooms)}")
        lines.append(f"- **送风阀总数**: {len(topology.supply_valves)}")
        lines.append(f"- **回风阀总数**: {len(topology.return_valves)}")
        lines.append(f"- **风机总数**: {len(topology.fan_curves)}")
        lines.append(f"- **门禁记录数**: {len(topology.access_logs)}")
        lines.append(f"- **粒子检测记录数**: {len(topology.particle_counts)}")
        lines.append("")
        
        lines.append("## 二、问题汇总")
        lines.append("")
        lines.append(f"**总问题数**: {opt_result.total_issues}")
        lines.append("")
        
        if opt_result.total_issues == 0:
            lines.append("✅ **系统状态良好，无异常**")
            lines.append("")
        else:
            if opt_result.pressure_issues:
                lines.append("### 2.1 压差问题房间")
                lines.append("")
                for room in opt_result.pressure_issues:
                    lines.append(f"- ❌ {room}")
                lines.append("")
            
            if opt_result.air_change_issues:
                lines.append("### 2.2 换气次数问题房间")
                lines.append("")
                for room in opt_result.air_change_issues:
                    lines.append(f"- ❌ {room}")
                lines.append("")
            
            if opt_result.door_disturbance_issues:
                lines.append("### 2.3 开门扰动问题房间")
                lines.append("")
                for room in opt_result.door_disturbance_issues:
                    lines.append(f"- ⚠️ {room}")
                lines.append("")
            
            if opt_result.particle_issues:
                lines.append("### 2.4 粒子浓度超标房间")
                lines.append("")
                for room in opt_result.particle_issues:
                    lines.append(f"- ❌ {room}")
                lines.append("")
        
        lines.append("## 三、各房间详细计算结果")
        lines.append("")
        
        for room_id, result in opt_result.room_results.items():
            room = topology.rooms.get(room_id)
            room_name = room.name if room else room_id
            
            lines.append(f"### 3.{list(opt_result.room_results.keys()).index(room_id) + 1} {room_name} ({room_id})")
            lines.append("")
            
            status_icon = "✅" if (result.is_pressure_ok and result.is_air_change_ok) else "❌"
            lines.append(f"**状态**: {status_icon}")
            lines.append("")
            
            lines.append("#### 压差参数")
            lines.append("")
            lines.append(f"| 参数 | 数值 | 目标 | 偏差 | 状态 |")
            lines.append(f"|------|------|------|------|------|")
            pressure_status = "✅" if result.is_pressure_ok else "❌"
            lines.append(
                f"| 压差 | {result.calculated_pressure:.1f} Pa | {result.target_pressure:.1f} Pa | "
                f"{result.pressure_deviation:+.1f} Pa | {pressure_status} |"
            )
            lines.append("")
            
            lines.append("#### 风量参数")
            lines.append("")
            lines.append(f"| 参数 | 数值 | 目标 | 状态 |")
            lines.append(f"|------|------|------|------|")
            
            supply_flow = result.supply_airflow or 0
            return_flow = result.return_airflow or 0
            exhaust_flow = result.exhaust_airflow or 0
            leakage = result.leakage_flow or 0
            
            lines.append(f"| 送风量 | {supply_flow:.1f} m³/h | - | - |")
            lines.append(f"| 回风量 | {return_flow:.1f} m³/h | - | - |")
            lines.append(f"| 排风量 | {exhaust_flow:.1f} m³/h | - | - |")
            lines.append(f"| 泄漏风量 | {leakage:.1f} m³/h | - | - |")
            lines.append("")
            
            if result.air_change_rate is not None:
                lines.append("#### 换气次数")
                lines.append("")
                ach_status = "✅" if result.is_air_change_ok else "❌"
                target_ach = result.target_air_change_rate or 0
                lines.append(
                    f"**当前换气次数**: {result.air_change_rate:.1f} 次/小时 "
                    f"(目标: {target_ach:.1f} 次/小时) {ach_status}"
                )
                lines.append("")
            
            if result.issues:
                lines.append("#### 问题详情")
                lines.append("")
                for issue in result.issues:
                    lines.append(f"- {issue}")
                lines.append("")
            
            if result.supply_valve_adjustment is not None or result.return_valve_adjustment is not None:
                lines.append("#### 调阀建议")
                lines.append("")
                if result.supply_valve_adjustment is not None:
                    direction = "增大" if result.supply_valve_adjustment > 0 else "减小"
                    lines.append(f"- **送风阀**: {direction} {abs(result.supply_valve_adjustment):.1f}%")
                if result.return_valve_adjustment is not None:
                    direction = "增大" if result.return_valve_adjustment > 0 else "减小"
                    lines.append(f"- **回风阀**: {direction} {abs(result.return_valve_adjustment):.1f}%")
                lines.append("")
            
            lines.append("---")
            lines.append("")
        
        lines.append("## 四、阀门调节汇总")
        lines.append("")
        
        if opt_result.valve_adjustments:
            lines.append("| 阀门ID | 房间 | 调节量 | 方向 |")
            lines.append("|--------|------|--------|------|")
            
            for valve_id, adjustment in opt_result.valve_adjustments.items():
                room_id = valve_id[2:] if len(valve_id) > 2 else ""
                room = topology.rooms.get(room_id)
                room_name = room.name if room else room_id
                valve_type = "送风阀" if valve_id.startswith("S_") else "回风阀"
                direction = "增大" if adjustment > 0 else "减小"
                lines.append(
                    f"| {valve_id} ({valve_type}) | {room_name} | "
                    f"{abs(adjustment):.1f}% | {direction} |"
                )
        else:
            lines.append("无需调节阀门。")
        lines.append("")
        
        lines.append("## 五、人工修正记录")
        lines.append("")
        
        if opt_result.manual_corrections:
            for room_id, correction in opt_result.manual_corrections.items():
                room = topology.rooms.get(room_id)
                room_name = room.name if room else room_id
                lines.append(f"### {room_name} ({room_id})")
                lines.append("")
                
                if correction.get("supply_valve_adjustment"):
                    adj = correction["supply_valve_adjustment"]
                    direction = "增大" if adj > 0 else "减小"
                    lines.append(f"- 送风阀: {direction} {abs(adj):.1f}%")
                
                if correction.get("return_valve_adjustment"):
                    adj = correction["return_valve_adjustment"]
                    direction = "增大" if adj > 0 else "减小"
                    lines.append(f"- 回风阀: {direction} {abs(adj):.1f}%")
                
                if correction.get("notes"):
                    lines.append(f"- 备注: {correction['notes']}")
                
                lines.append("")
        else:
            lines.append("暂无人工修正记录。")
        lines.append("")
        
        lines.append("## 六、备注与说明")
        lines.append("")
        
        if opt_result.remarks:
            for remark in opt_result.remarks:
                lines.append(f"- {remark}")
        else:
            lines.append("系统运行正常。")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告生成完毕*")
        lines.append("")
        
        return "\n".join(lines)

    @staticmethod
    def generate_calculation_details_json(
        project_data: ProjectData,
        opt_result: OptimizationResult,
        topology: RoomTopology
    ) -> str:
        details = {
            "header": {
                "project_name": project_data.project_name,
                "project_id": project_data.project_id,
                "generated_at": datetime.now().isoformat(),
                "version": project_data.version
            },
            "system_summary": {
                "total_rooms": len(topology.rooms),
                "total_supply_valves": len(topology.supply_valves),
                "total_return_valves": len(topology.return_valves),
                "total_fans": len(topology.fan_curves),
                "total_access_logs": len(topology.access_logs),
                "total_particle_counts": len(topology.particle_counts)
            },
            "issues_summary": {
                "total_issues": opt_result.total_issues,
                "pressure_issues": opt_result.pressure_issues,
                "air_change_issues": opt_result.air_change_issues,
                "door_disturbance_issues": opt_result.door_disturbance_issues,
                "particle_issues": opt_result.particle_issues
            },
            "room_results": {},
            "valve_adjustments": opt_result.valve_adjustments,
            "fan_adjustments": opt_result.fan_adjustments,
            "manual_corrections": opt_result.manual_corrections,
            "remarks": opt_result.remarks
        }
        
        for room_id, result in opt_result.room_results.items():
            room = topology.rooms.get(room_id)
            room_name = room.name if room else room_id
            
            details["room_results"][room_id] = {
                "room_name": room_name,
                "calculated_pressure": result.calculated_pressure,
                "target_pressure": result.target_pressure,
                "pressure_deviation": result.pressure_deviation,
                "supply_airflow": result.supply_airflow,
                "return_airflow": result.return_airflow,
                "exhaust_airflow": result.exhaust_airflow,
                "air_change_rate": result.air_change_rate,
                "target_air_change_rate": result.target_air_change_rate,
                "air_change_deviation": result.air_change_deviation,
                "leakage_flow": result.leakage_flow,
                "is_pressure_ok": result.is_pressure_ok,
                "is_air_change_ok": result.is_air_change_ok,
                "issues": result.issues,
                "supply_valve_adjustment": result.supply_valve_adjustment,
                "return_valve_adjustment": result.return_valve_adjustment
            }
        
        supply_valves_data = {}
        for valve_id, valve in topology.supply_valves.items():
            supply_valves_data[valve_id] = {
                "room_id": valve.room_id,
                "current_opening": valve.current_opening,
                "rated_flow": valve.rated_flow,
                "kv_value": valve.kv_value,
                "actual_flow": valve.actual_flow
            }
        
        return_valves_data = {}
        for valve_id, valve in topology.return_valves.items():
            return_valves_data[valve_id] = {
                "room_id": valve.room_id,
                "current_opening": valve.current_opening,
                "rated_flow": valve.rated_flow,
                "kv_value": valve.kv_value,
                "actual_flow": valve.actual_flow
            }
        
        details["current_valve_settings"] = {
            "supply_valves": supply_valves_data,
            "return_valves": return_valves_data
        }
        
        access_logs_data = []
        for log in topology.access_logs:
            access_logs_data.append({
                "id": log.id,
                "room_id": log.room_id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "door_id": log.door_id,
                "door_type": log.door_type,
                "duration": log.duration,
                "adjacent_room": log.adjacent_room,
                "pressure_difference_during_open": log.pressure_difference_during_open
            })
        
        particle_counts_data = []
        for pc in topology.particle_counts:
            particle_counts_data.append({
                "id": pc.id,
                "room_id": pc.room_id,
                "timestamp": pc.timestamp.isoformat() if pc.timestamp else None,
                "particle_size": pc.particle_size,
                "concentration": pc.concentration,
                "limit_value": pc.limit_value,
                "is_pass": pc.is_pass
            })
        
        details["raw_data"] = {
            "access_logs": access_logs_data,
            "particle_counts": particle_counts_data
        }
        
        return json.dumps(details, ensure_ascii=False, indent=2)
