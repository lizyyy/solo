from datetime import datetime
from typing import Dict, Any, Optional, List
import json
import os
from config import settings


class ExportService:
    @staticmethod
    def generate_markdown_handover(
        flight_release: Dict,
        flight_plan: Dict,
        deice_records: List[Dict],
        weather_data: Dict,
        gate_log: Dict,
        review_comments: Optional[str] = None
    ) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        flight_number = flight_release.get("flight_number", "N/A")
        
        hold_status_icon = {
            "good": "✅",
            "warning": "⚠️",
            "critical": "❌"
        }.get(flight_release.get("hold_time_status"), "❓")
        
        conc_status_icon = {
            "good": "✅",
            "warning": "⚠️",
            "critical": "❌"
        }.get(flight_release.get("concentration_status"), "❓")
        
        gate_risk_icon = {
            "low": "✅",
            "medium": "⚠️",
            "high": "❌"
        }.get(flight_release.get("gate_conflict_risk"), "❓")
        
        second_deice_icon = "⚠️" if flight_release.get("is_second_deicing_required") else "✅"
        
        overall_status = "允许放行"
        if (flight_release.get("hold_time_status") == "critical" or
            flight_release.get("concentration_status") == "critical" or
            flight_release.get("gate_conflict_risk") == "high" or
            flight_release.get("is_second_deicing_required")):
            overall_status = "需复核后放行"
        
        if flight_release.get("override_decision"):
            overall_status = f"人工改判: {flight_release.get('override_decision')}"
        
        markdown = f"""# 航班放行交接单

**航班号**: {flight_number}  
**生成时间**: {now}  
**放行状态**: **{overall_status}**

---

## 一、航班基本信息

| 项目 | 内容 |
|------|------|
| 航班号 | {flight_number} |
| 机型 | {flight_plan.get('aircraft_type', 'N/A')} |
| 注册号 | {flight_plan.get('aircraft_registration', 'N/A')} |
| 起飞机场 | {flight_plan.get('departure_airport', 'N/A')} |
| 目的机场 | {flight_plan.get('arrival_airport', 'N/A')} |
| 计划起飞 | {flight_plan.get('scheduled_departure', 'N/A')} |
| 预计起飞 | {flight_plan.get('estimated_departure', 'N/A')} |
| 机位 | {flight_plan.get('gate_number', 'N/A')} |
| 停机位 | {flight_plan.get('stand_number', 'N/A')} |

---

## 二、除冰液信息

### 浓度检查

{conc_status_icon} **浓度状态**: {flight_release.get('concentration_status', 'unknown').upper()}

| 项目 | 数值 |
|------|------|
| 测量浓度 | {flight_release.get('measured_concentration', 0):.2f} |
| 目标浓度 | {flight_release.get('target_concentration', 0):.2f} |
| 浓度偏差 | {flight_release.get('concentration_deviation', 0):+.2f} |

### 除冰记录

"""
        
        if deice_records:
            for i, record in enumerate(deice_records, 1):
                deice_type = "二次除冰" if record.get('is_second_deicing') else "除冰"
                markdown += f"""**第 {i} 次{deice_type}**

| 项目 | 内容 |
|------|------|
| 批次号 | {record.get('batch_number', 'N/A')} |
| 流体类型 | {record.get('fluid_type', 'N/A')} |
| 测量浓度 | {record.get('measured_concentration', 0):.2f} |
| 施加工况温度 | {record.get('temperature_applied', 'N/A')}°C |
| 开始时间 | {record.get('application_start_time', 'N/A')} |
| 结束时间 | {record.get('application_end_time', 'N/A')} |
| 总用量 | {record.get('total_volume_used', 'N/A')} L |
| 操作员 | {record.get('technician_name', 'N/A')} |

"""
        else:
            markdown += "> ⚠️ 暂无除冰记录\n\n"
        
        markdown += """---

## 三、保持时间计算

"""
        
        hold_time = flight_release.get('hold_time_minutes', 0)
        hold_expiry = flight_release.get('hold_time_expiry', 'N/A')
        
        markdown += f"""{hold_status_icon} **保持时间状态**: {flight_release.get('hold_time_status', 'unknown').upper()}

| 项目 | 数值 |
|------|------|
| 保持时间 | {hold_time} 分钟 |
| 过期时间 | {hold_expiry} |

"""
        
        markdown += """---

## 四、二次除冰判断

"""
        
        second_deice_required = flight_release.get('is_second_deicing_required', False)
        markdown += f"""{second_deice_icon} **是否需要二次除冰**: {'是' if second_deice_required else '否'}

"""
        
        if flight_release.get('second_deicing_reason'):
            markdown += f"> 原因: {flight_release.get('second_deicing_reason')}\n\n"
        
        markdown += f"""除冰轮次: {flight_release.get('deice_rounds', 0)} 次

---

## 五、机位冲突检查

"""
        
        markdown += f"""{gate_risk_icon} **机位冲突风险**: {flight_release.get('gate_conflict_risk', 'unknown').upper()}

"""
        
        if flight_release.get('overlapping_flights'):
            markdown += f"> 冲突航班: {flight_release.get('overlapping_flights')}\n\n"
        
        markdown += """---

## 六、实时气象

"""
        
        markdown += f"""| 项目 | 数值 |
|------|------|
| 观测时间 | {weather_data.get('observation_time', 'N/A')} |
| 温度 | {weather_data.get('temperature', 'N/A')}°C |
| 露点 | {weather_data.get('dew_point', 'N/A')}°C |
| 风速 | {weather_data.get('wind_speed', 'N/A')} 节 |
| 风向 | {weather_data.get('wind_direction', 'N/A')}° |
| 能见度 | {weather_data.get('visibility', 'N/A')} m |
| 云高 | {weather_data.get('ceiling', 'N/A')} ft |
| 降水类型 | {weather_data.get('precipitation_type', 'N/A')} |
| 降水强度 | {weather_data.get('precipitation_intensity', 'N/A')} |
| 冻雨 | {'是' if weather_data.get('is_freezing_rain') else '否'} |
| 降雪 | {'是' if weather_data.get('is_snow') else '否'} |

"""
        
        markdown += """---

## 七、机位作业日志

"""
        
        markdown += f"""| 项目 | 内容 |
|------|------|
| 到达时间 | {gate_log.get('arrival_time', 'N/A')} |
| 机位可用时间 | {gate_log.get('gate_available_time', 'N/A')} |
| 除冰可用时间 | {gate_log.get('deice_available_time', 'N/A')} |
| 除冰完成时间 | {gate_log.get('deice_completed_time', 'N/A')} |
| 机组准备时间 | {gate_log.get('crew_ready_time', 'N/A')} |
| 登机完成时间 | {gate_log.get('boarding_completed_time', 'N/A')} |
| 行李装载完成 | {gate_log.get('baggage_loaded_time', 'N/A')} |
| 加油完成 | {gate_log.get('fuel_loaded_time', 'N/A')} |

"""
        
        markdown += """---

## 八、复核意见

"""
        
        if review_comments or flight_release.get('review_comments'):
            comments = review_comments or flight_release.get('review_comments', '')
            markdown += f"""**复核人**: {flight_release.get('reviewed_by', 'N/A')}  
**复核时间**: {flight_release.get('reviewed_at', 'N/A')}  

### 复核意见:

{comments}

"""
        else:
            markdown += "> ⚠️ 暂无复核意见\n\n"
        
        if flight_release.get('override_decision'):
            markdown += """---

## 九、人工改判

"""
            markdown += f"""**改判决定**: {flight_release.get('override_decision')}  
**改判原因**: {flight_release.get('override_reason', 'N/A')}  
**改判人**: {flight_release.get('overridden_by', 'N/A')}  
**改判时间**: {flight_release.get('overridden_at', 'N/A')}  

"""
        
        markdown += f"""---

*此交接单由系统自动生成于 {now}*  
*航班号: {flight_number}*
"""
        
        return markdown
    
    @staticmethod
    def generate_audit_package(
        flight_release: Dict,
        flight_plan: Dict,
        deice_records: List[Dict],
        weather_data: Dict,
        gate_log: Dict,
        audit_logs: List[Dict]
    ) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        
        package = {
            "audit_package_version": "1.0",
            "generated_at": now,
            "flight_number": flight_release.get("flight_number"),
            
            "flight_release": flight_release,
            "flight_plan": flight_plan,
            "deice_records": deice_records,
            "weather_data": weather_data,
            "gate_log": gate_log,
            "audit_logs": audit_logs,
            
            "summary": {
                "total_deice_records": len(deice_records),
                "total_audit_logs": len(audit_logs),
                "hold_time_status": flight_release.get("hold_time_status"),
                "concentration_status": flight_release.get("concentration_status"),
                "gate_conflict_risk": flight_release.get("gate_conflict_risk"),
                "is_second_deicing_required": flight_release.get("is_second_deicing_required"),
                "release_status": flight_release.get("release_status"),
                "has_override": flight_release.get("override_decision") is not None
            }
        }
        
        return package
    
    @staticmethod
    def save_to_file(content: str, filename: str, subdir: str = "") -> str:
        directory = settings.EXPORT_DIR
        if subdir:
            directory = os.path.join(directory, subdir)
        os.makedirs(directory, exist_ok=True)
        
        filepath = os.path.join(directory, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return filepath
    
    @staticmethod
    def save_json_to_file(data: Dict, filename: str, subdir: str = "") -> str:
        directory = settings.EXPORT_DIR
        if subdir:
            directory = os.path.join(directory, subdir)
        os.makedirs(directory, exist_ok=True)
        
        filepath = os.path.join(directory, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        
        return filepath
