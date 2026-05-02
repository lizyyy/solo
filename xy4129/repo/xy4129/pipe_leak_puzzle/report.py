# -*- coding: utf-8 -*-
"""
报告导出模块 - 导出Markdown、CSV、JSON格式报告
"""

import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


class ReportExporter:
    """报告导出器"""
    
    def __init__(self,
                 metadata: Dict[str, Any] = None,
                 analysis_result: Any = None,
                 isolation_result: Any = None,
                 review_record: Any = None):
        self.metadata = metadata or {}
        self.analysis_result = analysis_result
        self.isolation_result = isolation_result
        self.review_record = review_record
    
    def export_json(self) -> str:
        """导出JSON格式报告"""
        report_data = {
            "report_info": {
                "generated_at": datetime.now().isoformat(),
                "report_type": "管网漏点分析报告"
            },
            "project_metadata": self.metadata,
            "analysis_summary": self._get_analysis_summary(),
            "isolation_plan": self._get_isolation_plan(),
            "review_status": self._get_review_status()
        }
        
        return json.dumps(report_data, ensure_ascii=False, indent=2, default=str)
    
    def export_markdown(self) -> str:
        """导出Markdown格式报告"""
        lines = []
        
        # 标题
        lines.append("# 管网漏点夜巡分析报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 项目信息
        lines.append("## 一、项目信息")
        lines.append("")
        lines.append("| 项目 | 内容 |")
        lines.append("|------|------|")
        lines.append(f"| 项目名称 | {self.metadata.get('project_name', '未命名项目')} |")
        lines.append(f"| 创建时间 | {self.metadata.get('created_at', '未知')} |")
        lines.append(f"| 模板类型 | {self.metadata.get('template', 'default')} |")
        lines.append(f"| 节点数量 | {self.metadata.get('nodes_count', 0)} |")
        lines.append(f"| 阀门数量 | {self.metadata.get('valves_count', 0)} |")
        lines.append(f"| 传感器数量 | {self.metadata.get('sensors_count', 0)} |")
        lines.append("")
        
        # 分析摘要
        lines.append("## 二、分析摘要")
        lines.append("")
        
        analysis_summary = self._get_analysis_summary()
        
        if analysis_summary.get("has_analysis"):
            lines.append("### 2.1 压力异常检测")
            lines.append("")
            lines.append(f"- 检测到压力异常事件: **{analysis_summary.get('pressure_anomalies', 0)}** 个")
            lines.append(f"- 过滤后可疑事件: **{analysis_summary.get('filtered_anomalies', 0)}** 个")
            lines.append("")
            
            lines.append("### 2.2 声纹异常检测")
            lines.append("")
            lines.append(f"- 检测到声纹异常事件: **{analysis_summary.get('acoustic_anomalies', 0)}** 个")
            lines.append("")
            
            # 压力异常详情
            if analysis_summary.get("pressure_anomalies_list"):
                lines.append("### 2.3 压力异常详情")
                lines.append("")
                lines.append("| 序号 | 时间戳 | 传感器 | 压力变化 | 降幅 | 置信度 |")
                lines.append("|------|--------|--------|----------|------|--------|")
                
                for i, anomaly in enumerate(analysis_summary["pressure_anomalies_list"][:10], 1):
                    timestamp = anomaly.get("timestamp", "N/A")[:19] if anomaly.get("timestamp") else "N/A"
                    sensor_id = anomaly.get("sensor_id", "N/A")
                    drop_percent = f"{anomaly.get('drop_percent', 0)*100:.1f}%"
                    confidence = f"{anomaly.get('confidence', 0)*100:.1f}%"
                    pressure_change = f"{anomaly.get('previous_pressure', 0):.3f} → {anomaly.get('current_pressure', 0):.3f} MPa"
                    
                    lines.append(f"| {i} | {timestamp} | {sensor_id} | {pressure_change} | {drop_percent} | {confidence} |")
                
                if len(analysis_summary["pressure_anomalies_list"]) > 10:
                    lines.append(f"| ... | ... | ... | ... | ... | ... |")
                    lines.append(f"| 共 {len(analysis_summary['pressure_anomalies_list'])} 条记录 |")
                lines.append("")
        else:
            lines.append("*暂无分析数据*")
            lines.append("")
        
        # 漏点定位与关阀计划
        lines.append("## 三、漏点定位与关阀计划")
        lines.append("")
        
        isolation_plan = self._get_isolation_plan()
        
        if isolation_plan.get("has_isolation"):
            lines.append("### 3.1 疑似漏点")
            lines.append("")
            
            suspected_leaks = isolation_plan.get("suspected_leaks", [])
            if suspected_leaks:
                lines.append("| 序号 | 漏点ID | 管段ID | 置信度 | 检测类型 |")
                lines.append("|------|--------|--------|--------|----------|")
                
                for i, leak in enumerate(suspected_leaks, 1):
                    leak_id = leak.get("leak_id", "N/A")
                    section_id = leak.get("section_id", "N/A")
                    confidence = f"{leak.get('confidence', 0)*100:.1f}%"
                    
                    types = []
                    if leak.get("has_pressure_anomaly"):
                        types.append("压力")
                    if leak.get("has_acoustic_anomaly"):
                        types.append("声纹")
                    detect_type = "+".join(types) if types else "未知"
                    
                    lines.append(f"| {i} | {leak_id} | {section_id} | {confidence} | {detect_type} |")
            else:
                lines.append("*未发现明确的疑似漏点*")
            lines.append("")
            
            # 关阀计划
            lines.append("### 3.2 关阀计划")
            lines.append("")
            lines.append(f"- 隔离策略: **{isolation_plan.get('strategy', 'minimal')}**")
            lines.append(f"- 需要关闭的阀门: **{isolation_plan.get('valves_count', 0)}** 个")
            lines.append("")
            
            valves = isolation_plan.get("valves_to_close", [])
            if valves:
                lines.append("| 序号 | 阀门ID | 名称 | 位置 | 管径 | 优先级 |")
                lines.append("|------|--------|------|------|------|--------|")
                
                for i, valve in enumerate(valves, 1):
                    valve_id = valve.get("valve_id", "N/A")
                    name = valve.get("name", "N/A")
                    location = valve.get("location", "N/A")
                    diameter = f"{valve.get('diameter', 0)}mm"
                    priority = valve.get("priority", 999)
                    
                    lines.append(f"| {i} | {valve_id} | {name} | {location} | {diameter} | {priority} |")
            lines.append("")
            
            # 受影响用户
            lines.append("### 3.3 受影响用户")
            lines.append("")
            lines.append(f"- 预计受影响用户: **{isolation_plan.get('users_count', 0)}** 户")
            lines.append("")
            
            users = isolation_plan.get("affected_users", [])
            if users:
                lines.append("| 序号 | 用户ID | 名称 | 地址 | 用户类型 | 平均需水量 |")
                lines.append("|------|--------|------|------|----------|------------|")
                
                for i, user in enumerate(users[:20], 1):
                    user_id = user.get("user_id", "N/A")
                    name = user.get("name", "N/A")
                    address = user.get("address", "N/A")
                    user_type = user.get("user_type", "居民")
                    avg_demand = f"{user.get('avg_demand', 0):.1f} m³/h"
                    
                    lines.append(f"| {i} | {user_id} | {name} | {address} | {user_type} | {avg_demand} |")
                
                if len(users) > 20:
                    lines.append(f"| ... | ... | ... | ... | ... | ... |")
                    lines.append(f"| 共 {len(users)} 位用户 |")
            lines.append("")
        else:
            lines.append("*暂无隔离计划数据*")
            lines.append("")
        
        # 复核状态
        lines.append("## 四、复核状态")
        lines.append("")
        
        review_status = self._get_review_status()
        
        if review_status.get("has_review"):
            lines.append(f"- 复核状态: **{review_status.get('status', 'unknown')}**")
            lines.append(f"- 复核时间: {review_status.get('reviewed_at', 'N/A')}")
            
            if review_status.get("notes"):
                lines.append(f"- 复核备注: {review_status.get('notes')}")
            
            if review_status.get("adjusted_location"):
                lines.append(f"- 调整后漏点位置: {review_status.get('adjusted_location')}")
        else:
            lines.append("*尚未进行人工复核*")
        lines.append("")
        
        # 统计摘要
        lines.append("## 五、统计摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 压力异常事件 | {analysis_summary.get('pressure_anomalies', 0)} |")
        lines.append(f"| 声纹异常事件 | {analysis_summary.get('acoustic_anomalies', 0)} |")
        lines.append(f"| 过滤后可疑事件 | {analysis_summary.get('filtered_anomalies', 0)} |")
        lines.append(f"| 疑似漏点数量 | {isolation_plan.get('leaks_count', 0)} |")
        lines.append(f"| 需关阀门数量 | {isolation_plan.get('valves_count', 0)} |")
        lines.append(f"| 受影响用户数量 | {isolation_plan.get('users_count', 0)} |")
        lines.append("")
        
        # 附注
        lines.append("---")
        lines.append("")
        lines.append("*报告由管网漏点夜巡拼图器自动生成*")
        lines.append("")
        
        return "\n".join(lines)
    
    def export_csv(self) -> Dict[str, str]:
        """导出CSV格式报告（返回多个CSV文件内容）"""
        csv_files = {}
        
        # 1. 压力异常CSV
        pressure_lines = ["时间戳,传感器ID,压力变化前(MPa),压力变化后(MPa),降幅(%),置信度(%)"]
        if self.analysis_result and hasattr(self.analysis_result, "pressure_anomalies"):
            for anomaly in self.analysis_result.pressure_anomalies:
                timestamp = anomaly.get("timestamp", "")[:19] if anomaly.get("timestamp") else ""
                sensor_id = anomaly.get("sensor_id", "")
                prev_p = anomaly.get("previous_pressure", 0)
                curr_p = anomaly.get("current_pressure", 0)
                drop_pct = anomaly.get("drop_percent", 0) * 100
                confidence = anomaly.get("confidence", 0) * 100
                
                pressure_lines.append(f"{timestamp},{sensor_id},{prev_p:.3f},{curr_p:.3f},{drop_pct:.1f},{confidence:.1f}")
        csv_files["pressure_anomalies"] = "\n".join(pressure_lines)
        
        # 2. 声纹异常CSV
        acoustic_lines = ["时间戳,位置,声强(dB),基线声强(dB),异常分数,置信度(%)"]
        if self.analysis_result and hasattr(self.analysis_result, "acoustic_anomalies"):
            for anomaly in self.analysis_result.acoustic_anomalies:
                timestamp = anomaly.get("timestamp", "")[:19] if anomaly.get("timestamp") else ""
                location = anomaly.get("location", "")
                level = anomaly.get("level", 0)
                baseline = anomaly.get("baseline_level", 0)
                score = anomaly.get("anomaly_score", 0)
                confidence = anomaly.get("confidence", 0) * 100
                
                acoustic_lines.append(f"{timestamp},{location},{level:.1f},{baseline:.1f},{score:.3f},{confidence:.1f}")
        csv_files["acoustic_anomalies"] = "\n".join(acoustic_lines)
        
        # 3. 疑似漏点CSV
        leak_lines = ["漏点ID,管段ID,置信度(%),压力异常,声纹异常,检测时间"]
        if self.isolation_result and hasattr(self.isolation_result, "suspected_leaks"):
            for leak in self.isolation_result.suspected_leaks:
                leak_id = leak.get("leak_id", "")
                section_id = leak.get("section_id", "")
                confidence = leak.get("confidence", 0) * 100
                has_pressure = "是" if leak.get("has_pressure_anomaly") else "否"
                has_acoustic = "是" if leak.get("has_acoustic_anomaly") else "否"
                timestamp = leak.get("timestamp", "")[:19] if leak.get("timestamp") else ""
                
                leak_lines.append(f"{leak_id},{section_id},{confidence:.1f},{has_pressure},{has_acoustic},{timestamp}")
        csv_files["suspected_leaks"] = "\n".join(leak_lines)
        
        # 4. 关阀计划CSV
        valve_lines = ["序号,阀门ID,阀门名称,位置,管径(mm),优先级,状态"]
        if self.isolation_result and hasattr(self.isolation_result, "valves_to_close"):
            for i, valve in enumerate(self.isolation_result.valves_to_close, 1):
                valve_id = valve.get("valve_id", "")
                name = valve.get("name", "")
                location = valve.get("location", "")
                diameter = valve.get("diameter", 0)
                priority = valve.get("priority", 999)
                status = valve.get("status", "")
                
                valve_lines.append(f"{i},{valve_id},{name},{location},{diameter},{priority},{status}")
        csv_files["valve_closure_plan"] = "\n".join(valve_lines)
        
        # 5. 受影响用户CSV
        user_lines = ["序号,用户ID,用户名称,地址,用户类型,平均需水量(m³/h),峰值需水量(m³/h)"]
        if self.isolation_result and hasattr(self.isolation_result, "affected_users"):
            for i, user in enumerate(self.isolation_result.affected_users, 1):
                user_id = user.get("user_id", "")
                name = user.get("name", "")
                address = user.get("address", "")
                user_type = user.get("user_type", "")
                avg_demand = user.get("avg_demand", 0)
                peak_demand = user.get("peak_demand", 0)
                
                user_lines.append(f"{i},{user_id},{name},{address},{user_type},{avg_demand:.1f},{peak_demand:.1f}")
        csv_files["affected_users"] = "\n".join(user_lines)
        
        return csv_files
    
    def _get_analysis_summary(self) -> Dict:
        """获取分析摘要"""
        summary = {
            "has_analysis": False,
            "pressure_anomalies": 0,
            "acoustic_anomalies": 0,
            "filtered_anomalies": 0,
            "propagation_delays": 0,
            "pressure_anomalies_list": [],
            "acoustic_anomalies_list": []
        }
        
        if self.analysis_result:
            summary["has_analysis"] = True
            
            if hasattr(self.analysis_result, "pressure_anomalies"):
                summary["pressure_anomalies"] = len(self.analysis_result.pressure_anomalies)
                summary["pressure_anomalies_list"] = self.analysis_result.pressure_anomalies
            
            if hasattr(self.analysis_result, "acoustic_anomalies"):
                summary["acoustic_anomalies"] = len(self.analysis_result.acoustic_anomalies)
                summary["acoustic_anomalies_list"] = self.analysis_result.acoustic_anomalies
            
            if hasattr(self.analysis_result, "filtered_anomalies"):
                summary["filtered_anomalies"] = len(self.analysis_result.filtered_anomalies)
            
            if hasattr(self.analysis_result, "propagation_delays"):
                summary["propagation_delays"] = len(self.analysis_result.propagation_delays)
        
        return summary
    
    def _get_isolation_plan(self) -> Dict:
        """获取隔离计划"""
        plan = {
            "has_isolation": False,
            "leaks_count": 0,
            "valves_count": 0,
            "users_count": 0,
            "strategy": "unknown",
            "suspected_leaks": [],
            "valves_to_close": [],
            "affected_users": []
        }
        
        if self.isolation_result:
            plan["has_isolation"] = True
            
            if hasattr(self.isolation_result, "suspected_leaks"):
                plan["suspected_leaks"] = self.isolation_result.suspected_leaks
                plan["leaks_count"] = len(self.isolation_result.suspected_leaks)
            
            if hasattr(self.isolation_result, "valves_to_close"):
                plan["valves_to_close"] = self.isolation_result.valves_to_close
                plan["valves_count"] = len(self.isolation_result.valves_to_close)
            
            if hasattr(self.isolation_result, "affected_users"):
                plan["affected_users"] = self.isolation_result.affected_users
                plan["users_count"] = len(self.isolation_result.affected_users)
            
            if hasattr(self.isolation_result, "strategy"):
                plan["strategy"] = self.isolation_result.strategy
        
        return plan
    
    def _get_review_status(self) -> Dict:
        """获取复核状态"""
        status = {
            "has_review": False,
            "status": "unknown",
            "reviewed_at": None,
            "notes": None,
            "reviewer": None,
            "adjusted_location": None
        }
        
        if self.review_record:
            status["has_review"] = True
            
            if hasattr(self.review_record, "status"):
                status["status"] = self.review_record.status
            
            if hasattr(self.review_record, "reviewed_at"):
                status["reviewed_at"] = self.review_record.reviewed_at
            
            if hasattr(self.review_record, "notes"):
                status["notes"] = self.review_record.notes
            
            if hasattr(self.review_record, "reviewer"):
                status["reviewer"] = self.review_record.reviewer
            
            if hasattr(self.review_record, "adjusted_leak_location"):
                status["adjusted_location"] = self.review_record.adjusted_leak_location
        
        return status
