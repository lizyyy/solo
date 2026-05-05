from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from config import settings


class RiskScoringEngine:
    """风险评分引擎
    
    综合以下因素进行风险评估：
    1. 图像缺陷检测结果
    2. SCADA告警信息
    3. 历史维修工单
    4. 缺陷位置（叶根、叶尖等不同位置风险权重不同）
    5. 缺陷类型的固有风险等级
    """
    
    def __init__(self):
        # 缺陷类型风险权重
        self.defect_type_risks = {
            "crack": {
                "name": "裂纹",
                "base_score": 0.8,
                "description": "裂纹可能导致叶片结构失效，风险极高"
            },
            "lightning_strike": {
                "name": "雷击点",
                "base_score": 0.7,
                "description": "雷击可能导致内部损伤和电气故障"
            },
            "corrosion": {
                "name": "腐蚀",
                "base_score": 0.4,
                "description": "腐蚀是渐进性损伤，需定期监控"
            },
            "oil_stain": {
                "name": "油污",
                "base_score": 0.2,
                "description": "油污通常指示泄漏，但风险相对较低"
            }
        }
        
        # 位置风险权重
        self.location_risks = {
            "tip": {
                "name": "叶尖",
                "weight": 1.2,
                "description": "叶尖速度最高，受力最大"
            },
            "mid": {
                "name": "中段",
                "weight": 1.0,
                "description": "中段受力中等"
            },
            "root": {
                "name": "叶根",
                "weight": 1.5,
                "description": "叶根连接部位，结构关键"
            },
            "LE": {
                "name": "前缘",
                "weight": 1.1,
                "description": "前缘受冲击和侵蚀"
            },
            "TE": {
                "name": "后缘",
                "weight": 1.0,
                "description": "后缘受力相对较小"
            },
            "PS": {
                "name": "压力面",
                "weight": 1.0,
                "description": "压力面受力"
            },
            "SS": {
                "name": "吸力面",
                "weight": 1.1,
                "description": "吸力面可能产生空化"
            }
        }
        
        # 告警严重度权重
        self.alarm_severity_weights = {
            "严重": 1.5,
            "高": 1.2,
            "中": 1.0,
            "低": 0.8
        }
        
        # 工单优先级权重
        self.work_order_priority_weights = {
            "紧急": 1.5,
            "高": 1.2,
            "中": 1.0,
            "低": 0.8
        }
    
    def calculate_risk(self, 
                       defect_info: Dict[str, Any],
                       location_info: Optional[Dict[str, Any]] = None,
                       related_alarms: Optional[List[Dict[str, Any]]] = None,
                       related_work_orders: Optional[List[Dict[str, Any]]] = None,
                       additional_factors: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """计算综合风险评分
        
        Args:
            defect_info: 缺陷信息，包含 type, confidence 等
            location_info: 位置信息，包含 segment, distance_from_root 等
            related_alarms: 相关SCADA告警列表
            related_work_orders: 相关维修工单列表
            additional_factors: 其他附加因素
            
        Returns:
            包含风险评分和等级的字典
        """
        # 基础风险评分
        base_score = self._calculate_base_score(defect_info)
        
        # 位置调整
        location_adjustment = self._calculate_location_adjustment(location_info)
        
        # 关联告警影响
        alarm_impact = self._calculate_alarm_impact(related_alarms)
        
        # 历史工单影响
        work_order_impact = self._calculate_work_order_impact(related_work_orders)
        
        # 计算综合风险评分
        total_score = base_score * location_adjustment * (1 + alarm_impact + work_order_impact)
        
        # 确保评分在0-1范围内
        total_score = max(0.0, min(1.0, total_score))
        
        # 确定风险等级
        risk_level = self._determine_risk_level(total_score)
        
        # 生成风险描述
        description = self._generate_risk_description(
            total_score, risk_level, defect_info, location_info, related_alarms
        )
        
        return {
            "risk_score": round(total_score, 4),
            "risk_level": risk_level,
            "base_score": round(base_score, 4),
            "location_adjustment": round(location_adjustment, 4),
            "alarm_impact": round(alarm_impact, 4),
            "work_order_impact": round(work_order_impact, 4),
            "description": description,
            "recommendation": self._generate_recommendation(risk_level)
        }
    
    def _calculate_base_score(self, defect_info: Dict[str, Any]) -> float:
        """计算基础风险评分"""
        defect_type = defect_info.get("type", "unknown")
        confidence = defect_info.get("confidence", 0.0)
        
        # 获取缺陷类型的基础风险
        type_risk = self.defect_type_risks.get(defect_type, {
            "name": "未知",
            "base_score": 0.3
        })
        
        # 基础评分 = 类型基础风险 * 检测置信度
        base_score = type_risk["base_score"] * confidence
        
        return base_score
    
    def _calculate_location_adjustment(self, location_info: Optional[Dict[str, Any]]) -> float:
        """计算位置调整因子"""
        if not location_info:
            return 1.0
        
        adjustment = 1.0
        
        # 分段位置调整
        segment = location_info.get("segment")
        if segment and segment in self.location_risks:
            adjustment *= self.location_risks[segment]["weight"]
        
        # 距离叶根的距离调整（越靠近叶尖风险越高）
        distance = location_info.get("distance_from_root")
        blade_length = location_info.get("blade_length", 50)  # 默认50米
        
        if distance is not None and blade_length > 0:
            # 计算相对位置（0=叶根，1=叶尖）
            relative_position = min(1.0, distance / blade_length)
            # 叶尖区域风险增加
            if relative_position > 0.7:
                adjustment *= 1.15
            elif relative_position > 0.4:
                adjustment *= 1.05
        
        return adjustment
    
    def _calculate_alarm_impact(self, alarms: Optional[List[Dict[str, Any]]]) -> float:
        """计算关联告警的影响"""
        if not alarms:
            return 0.0
        
        impact = 0.0
        active_alarms = [a for a in alarms if a.get("is_active", False)]
        
        for alarm in active_alarms:
            severity = alarm.get("severity", "中")
            weight = self.alarm_severity_weights.get(severity, 1.0)
            
            # 告警类型相关性
            alarm_type = alarm.get("alarm_type", "")
            type_boost = 0.0
            if "振动" in alarm_type or "叶片" in alarm_type:
                type_boost = 0.1
            
            impact += (weight - 1.0 + type_boost) * 0.2
        
        # 限制最大影响
        return min(0.5, impact)
    
    def _calculate_work_order_impact(self, work_orders: Optional[List[Dict[str, Any]]]) -> float:
        """计算历史工单的影响"""
        if not work_orders:
            return 0.0
        
        impact = 0.0
        
        for order in work_orders:
            status = order.get("status", "待处理")
            priority = order.get("priority", "中")
            
            # 未完成的工单增加风险
            if status in ["待处理", "处理中"]:
                weight = self.work_order_priority_weights.get(priority, 1.0)
                impact += (weight - 1.0) * 0.15
            
            # 相同位置的历史工单（复发风险）
            issue_type = order.get("issue_type", "")
            if issue_type in ["裂纹", "雷击", "腐蚀"]:
                impact += 0.05
        
        return min(0.3, impact)
    
    def _determine_risk_level(self, score: float) -> str:
        """根据评分确定风险等级"""
        if score >= settings.CRITICAL_RISK_THRESHOLD:
            return "严重"
        elif score >= settings.HIGH_RISK_THRESHOLD:
            return "高"
        elif score >= settings.MEDIUM_RISK_THRESHOLD:
            return "中"
        else:
            return "低"
    
    def _generate_risk_description(self, score: float, risk_level: str,
                                     defect_info: Dict[str, Any],
                                     location_info: Optional[Dict[str, Any]],
                                     alarms: Optional[List[Dict[str, Any]]]) -> str:
        """生成风险描述"""
        defect_name = defect_info.get("name", "未知缺陷")
        confidence = defect_info.get("confidence", 0.0)
        
        description_parts = [
            f"检测到{defect_name}，检测置信度{confidence:.1%}。",
            f"综合风险评分{score:.2%}，风险等级为【{risk_level}】。"
        ]
        
        # 添加位置信息
        if location_info:
            segment = location_info.get("segment")
            distance = location_info.get("distance_from_root")
            if segment:
                segment_name = self.location_risks.get(segment, {}).get("name", segment)
                description_parts.append(f"缺陷位于{segment_name}区域。")
            if distance is not None:
                description_parts.append(f"距离叶根约{distance:.1f}米。")
        
        # 添加告警信息
        if alarms:
            active_count = sum(1 for a in alarms if a.get("is_active", False))
            if active_count > 0:
                description_parts.append(f"存在{active_count}个相关活跃告警，需重点关注。")
        
        return "".join(description_parts)
    
    def _generate_recommendation(self, risk_level: str) -> str:
        """根据风险等级生成建议"""
        recommendations = {
            "严重": "建议立即停机检查。该风险等级表明存在严重的结构安全隐患，需要专业人员立即进行详细检查和评估，制定维修计划。",
            "高": "建议在下次计划停机时检查。该风险等级表明存在较高风险，应纳入近期维修计划，安排专业人员进行详细检查。",
            "中": "建议记录并监控。该风险等级表明存在一定风险，应记录在案，增加巡检频率，密切关注缺陷发展情况。",
            "低": "建议正常巡检。该风险等级表明风险较低，可按正常周期进行巡检，无需特殊处理。"
        }
        return recommendations.get(risk_level, "建议根据实际情况处理。")
    
    def batch_assess(self, assessment_requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """批量风险评估"""
        results = []
        for request in assessment_requests:
            result = self.calculate_risk(
                defect_info=request.get("defect_info", {}),
                location_info=request.get("location_info"),
                related_alarms=request.get("related_alarms"),
                related_work_orders=request.get("related_work_orders")
            )
            results.append({
                "request_id": request.get("request_id"),
                "assessment": result
            })
        return results


# 创建全局实例
risk_scoring_engine = RiskScoringEngine()
