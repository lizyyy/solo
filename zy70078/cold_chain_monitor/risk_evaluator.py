from typing import List, Dict, Optional
from datetime import datetime
from .models import (
    Route, Order, RiskResult, SimulationConfig
)


class RiskEvaluator:
    def __init__(self, config: Optional[SimulationConfig] = None):
        self.config = config or SimulationConfig()

    def evaluate(
        self,
        route: Route,
        segment_results: Dict[str, Dict],
        compartment_profiles: Dict[str, Dict]
    ) -> List[RiskResult]:
        results = []
        simulation_timestamp = datetime.now()

        for order in route.orders:
            order_segments = [
                seg for seg in route.segments 
                if order.order_id in seg.orders
            ]

            total_overtime_min = 0
            max_temp_violation = 0.0
            min_temp_violation = 0.0
            triggers = []
            recommendations = []
            missing_data_count = 0
            missing_data_duration_min = 0
            segment_details = []

            for segment in order_segments:
                seg_result = segment_results.get(segment.segment_id, {})
                if not seg_result:
                    continue

                detail, overtime, max_viol, min_viol = self._evaluate_segment(
                    order, seg_result
                )
                segment_details.append(detail)

                total_overtime_min += overtime
                if max_viol > max_temp_violation:
                    max_temp_violation = max_viol
                if min_viol < min_temp_violation:
                    min_temp_violation = min_viol

                missing_periods = seg_result.get('missing_periods', [])
                missing_data_count += len(missing_periods)
                missing_data_duration_min += sum(
                    p['duration_min'] for p in missing_periods
                )

            triggers = self._identify_triggers(
                segment_details, max_temp_violation, min_temp_violation,
                missing_data_count, missing_data_duration_min
            )

            risk_level = self._calculate_risk_level(
                total_overtime_min, max_temp_violation, min_temp_violation,
                missing_data_count, missing_data_duration_min
            )

            recommendations = self._generate_recommendations(
                risk_level, triggers, total_overtime_min,
                missing_data_count, missing_data_duration_min
            )

            results.append(RiskResult(
                order_id=order.order_id,
                route_id=route.route_id,
                risk_level=risk_level,
                total_overtime_min=total_overtime_min,
                max_temp_violation=max_temp_violation,
                min_temp_violation=min_temp_violation,
                triggers=triggers,
                missing_data_count=missing_data_count,
                missing_data_duration_min=missing_data_duration_min,
                recommendations=recommendations,
                simulation_timestamp=simulation_timestamp,
                segment_details=segment_details
            ))

        return results

    def _evaluate_segment(
        self,
        order: Order,
        seg_result: Dict
    ) -> tuple:
        temps = seg_result.get('simulated_temps', [])
        overtime_min = 0
        max_violation = 0.0
        min_violation = 0.0
        violations = []

        for i, temp_data in enumerate(temps):
            temp = temp_data['temperature']
            
            if temp > order.max_temp:
                overtime_min += 1
                violation = temp - order.max_temp
                if violation > max_violation:
                    max_violation = violation
                violations.append({
                    'timestamp': temp_data['timestamp'],
                    'type': 'high',
                    'temp': temp,
                    'limit': order.max_temp
                })
            elif temp < order.min_temp:
                overtime_min += 1
                violation = temp - order.min_temp
                if violation < min_violation:
                    min_violation = violation
                violations.append({
                    'timestamp': temp_data['timestamp'],
                    'type': 'low',
                    'temp': temp,
                    'limit': order.min_temp
                })

        detail = {
            'segment_id': seg_result.get('segment_id'),
            'compartment': seg_result.get('compartment'),
            'from_stop': seg_result.get('from_stop'),
            'to_stop': seg_result.get('to_stop'),
            'start_time': seg_result.get('start_time'),
            'end_time': seg_result.get('end_time'),
            'duration_min': seg_result.get('duration_min', 0),
            'max_temp': seg_result.get('max_temp', 0),
            'min_temp': seg_result.get('min_temp', 0),
            'base_temp': seg_result.get('base_temp', 0),
            'events': seg_result.get('events', []),
            'violations': violations,
            'overtime_min': overtime_min,
            'missing_periods': seg_result.get('missing_periods', [])
        }

        return detail, overtime_min, max_violation, min_violation

    def _identify_triggers(
        self,
        segment_details: List[Dict],
        max_temp_violation: float,
        min_temp_violation: float,
        missing_data_count: int,
        missing_data_duration_min: int
    ) -> List[str]:
        triggers = []

        for detail in segment_details:
            for event in detail.get('events', []):
                if event['type'] == 'door_open_warming':
                    if '车门开启导致升温' not in triggers:
                        triggers.append('车门开启导致升温')
                elif event['type'] == 'drift_warming':
                    if '冷链设备漂移升温' not in triggers:
                        triggers.append('冷链设备漂移升温')

            for violation in detail.get('violations', []):
                if violation['type'] == 'high':
                    if '温度超限（过高）' not in triggers:
                        triggers.append('温度超限（过高）')
                else:
                    if '温度超限（过低）' not in triggers:
                        triggers.append('温度超限（过低）')

        if missing_data_count > 0:
            if missing_data_duration_min >= self.config.max_missing_duration_min:
                triggers.append('传感器连续缺测')
            else:
                triggers.append('传感器偶发缺测')

        if max_temp_violation > 5.0:
            triggers.append('严重高温超限')
        elif max_temp_violation > 2.0:
            triggers.append('中度高温超限')

        if min_temp_violation < -5.0:
            triggers.append('严重低温超限')
        elif min_temp_violation < -2.0:
            triggers.append('中度低温超限')

        return triggers

    def _calculate_risk_level(
        self,
        total_overtime_min: int,
        max_temp_violation: float,
        min_temp_violation: float,
        missing_data_count: int,
        missing_data_duration_min: int
    ) -> str:
        score = 0

        if total_overtime_min > 60:
            score += 40
        elif total_overtime_min > 30:
            score += 25
        elif total_overtime_min > 10:
            score += 15
        elif total_overtime_min > 0:
            score += 5

        if max_temp_violation > 8.0 or min_temp_violation < -8.0:
            score += 35
        elif max_temp_violation > 5.0 or min_temp_violation < -5.0:
            score += 25
        elif max_temp_violation > 2.0 or min_temp_violation < -2.0:
            score += 15

        if missing_data_duration_min >= self.config.max_missing_duration_min:
            score += 25
        elif missing_data_duration_min > 15:
            score += 15
        elif missing_data_duration_min > 5:
            score += 5

        if score >= 80:
            return 'CRITICAL'
        elif score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        elif score > 0:
            return 'LOW'
        else:
            return 'NONE'

    def _generate_recommendations(
        self,
        risk_level: str,
        triggers: List[str],
        total_overtime_min: int,
        missing_data_count: int,
        missing_data_duration_min: int
    ) -> List[str]:
        recommendations = []

        if risk_level == 'CRITICAL':
            recommendations.append('立即隔离并评估货物质量，通知质量部门')
        elif risk_level == 'HIGH':
            recommendations.append('优先检查冷链设备性能，加强温度监控')

        if '车门开启导致升温' in triggers:
            recommendations.append('优化装卸货流程，减少车门开启时间')
            recommendations.append('加强司机操作培训，规范车门操作')

        if '冷链设备漂移升温' in triggers:
            recommendations.append('检修制冷系统，检查制冷剂压力')
            recommendations.append('校准温控传感器，确保精度')

        if '温度超限（过高）' in triggers:
            recommendations.append('提前预冷车厢，降低初始温度')
            recommendations.append('检查车厢密封性能，防止冷量泄漏')

        if '温度超限（过低）' in triggers:
            recommendations.append('调整温控设定，避免过度制冷')
            recommendations.append('检查货物堆放，确保通风均匀')

        if '传感器连续缺测' in triggers:
            recommendations.append('立即检修或更换传感器设备')
            recommendations.append('备份冗余监控系统，避免单点故障')

        if '传感器偶发缺测' in triggers:
            recommendations.append('检查传感器连接，排除干扰因素')
            recommendations.append('定期维护传感器，确保可靠性')

        if total_overtime_min > 30:
            recommendations.append('优化运输路线，减少运输时长')
            recommendations.append('考虑使用冷链运输专用路线')

        if not recommendations:
            recommendations.append('继续保持良好的冷链管理水平')
            recommendations.append('定期巡检设备，预防潜在问题')

        return recommendations
