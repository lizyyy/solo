from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import uuid

from cold_chain.models import (
    TemperatureReading, VehicleRoute, Node, SignoffRecord,
    Batch, ThresholdRule, TimeDrift, TemperatureAnomaly,
    DataGap, TraceResult, TemperatureSeverity
)


class ColdChainAnalyzer:
    def __init__(self):
        self.anomaly_counter = 0
        self.gap_counter = 0

    def detect_time_drifts(
        self,
        temperatures: List[TemperatureReading],
        routes: List[VehicleRoute],
        signoffs: List[SignoffRecord]
    ) -> List[TimeDrift]:
        drifts = []
        
        vehicle_temps = defaultdict(list)
        for temp in temperatures:
            vehicle_temps[temp.vehicle_id].append(temp)
        
        for vehicle_id, temps in vehicle_temps.items():
            if not temps:
                continue
            
            sorted_temps = sorted(temps, key=lambda x: x.time)
            intervals = []
            for i in range(1, len(sorted_temps)):
                intervals.append(
                    (sorted_temps[i].time - sorted_temps[i-1].time).total_seconds()
                )
            
            if len(intervals) < 3:
                continue
            
            avg_interval = sum(intervals) / len(intervals)
            if avg_interval <= 0:
                continue
            
            expected_next = sorted_temps[0].time
            max_deviation = 0
            last_index = 0
            
            for i, temp in enumerate(sorted_temps):
                expected_next += timedelta(seconds=avg_interval)
                deviation = abs((temp.time - expected_next).total_seconds())
                if deviation > max_deviation:
                    max_deviation = deviation
                    last_index = i
            
            if max_deviation > avg_interval * 3:
                drifts.append(
                    TimeDrift(
                        sensor_id=sorted_temps[0].sensor_id,
                        vehicle_id=vehicle_id,
                        estimated_drift_seconds=max_deviation,
                        confidence=min(0.9, max_deviation / (avg_interval * 5)),
                        drift_type="时间间隔异常",
                        reference_event=f"第{last_index}个温度点",
                        detected_at=datetime.now()
                    )
                )
        
        for signoff in signoffs:
            vehicle_routes = [r for r in routes if r.vehicle_id == signoff.vehicle_id]
            for route in vehicle_routes:
                if (route.start_time <= signoff.signoff_time <= route.end_time and
                    route.end_node == signoff.node_id):
                    for temp in temperatures:
                        if (temp.vehicle_id == signoff.vehicle_id and
                            abs((temp.time - signoff.signoff_time).total_seconds()) < 600):
                            if temp.time < signoff.signoff_time:
                                drifts.append(
                                    TimeDrift(
                                        sensor_id=temp.sensor_id,
                                        vehicle_id=temp.vehicle_id,
                                        estimated_drift_seconds=abs(
                                            (temp.time - signoff.signoff_time).total_seconds()
                                        ),
                                        confidence=0.7,
                                        drift_type="签收时间不符",
                                        reference_event=f"签收时间{signoff.signoff_time}",
                                        detected_at=datetime.now()
                                    )
                                )
        
        return drifts

    def find_responsibility(
        self,
        start_time: datetime,
        end_time: datetime,
        routes: List[VehicleRoute],
        nodes: List[Node],
        signoffs: List[SignoffRecord]
    ) -> List[Dict[str, Any]]:
        segments = []
        node_map = {n.node_id: n for n in nodes}
        
        for route in routes:
            if route.start_time > end_time or route.end_time < start_time:
                continue
            
            overlap_start = max(start_time, route.start_time)
            overlap_end = min(end_time, route.end_time)
            duration_minutes = (overlap_end - overlap_start).total_seconds() / 60.0
            
            segment = {
                'responsibility_type': 'driver',
                'responsible_party': route.driver_id,
                'driver_id': route.driver_id,
                'driver_name': route.driver_name or route.driver_id,
                'vehicle_id': route.vehicle_id,
                'start_node': route.start_node,
                'end_node': route.end_node,
                'start_node_name': node_map.get(route.start_node, Node(
                    node_id=route.start_node,
                    node_name=route.start_node,
                    node_type="起点",
                    address=""
                )).node_name,
                'end_node_name': node_map.get(route.end_node, Node(
                    node_id=route.end_node,
                    node_name=route.end_node,
                    node_type="终点",
                    address=""
                )).node_name,
                'time_range': (overlap_start, overlap_end),
                'duration_minutes': duration_minutes,
                'overlap_ratio': duration_minutes / ((end_time - start_time).total_seconds() / 60.0)
            }
            segments.append(segment)
        
        for signoff in signoffs:
            if start_time <= signoff.signoff_time <= end_time:
                node = node_map.get(signoff.node_id)
                segments.append({
                    'responsibility_type': 'node',
                    'responsible_party': node.responsible_party if node else signoff.node_id,
                    'node_id': signoff.node_id,
                    'node_name': node.node_name if node else signoff.node_id,
                    'operator': signoff.operator,
                    'signoff_time': signoff.signoff_time,
                    'time_range': (signoff.signoff_time, signoff.signoff_time + timedelta(minutes=5)),
                    'duration_minutes': 5
                })
        
        segments.sort(key=lambda x: x['time_range'][0])
        return segments

    def detect_anomalies(
        self,
        batch: Batch,
        temperatures: List[TemperatureReading],
        routes: List[VehicleRoute],
        nodes: List[Node],
        signoffs: List[SignoffRecord],
        thresholds: List[ThresholdRule],
        time_drifts: List[TimeDrift]
    ) -> List[TemperatureAnomaly]:
        anomalies = []
        
        batch_thresholds = [
            t for t in thresholds if t.product_type == batch.product_type
        ]
        if not batch_thresholds:
            return anomalies
        
        threshold = batch_thresholds[0]
        
        vehicle_ids = batch.vehicle_ids
        if not vehicle_ids:
            vehicle_ids = list(set(r.vehicle_id for r in routes))
        
        for vehicle_id in vehicle_ids:
            vehicle_temps = [
                t for t in temperatures if t.vehicle_id == vehicle_id
            ]
            if not vehicle_temps:
                continue
            
            vehicle_temps.sort(key=lambda x: x.time)
            vehicle_routes = [r for r in routes if r.vehicle_id == vehicle_id]
            
            if not vehicle_routes:
                continue
            
            all_start = min(r.start_time for r in vehicle_routes)
            all_end = max(r.end_time for r in vehicle_routes)
            
            relevant_temps = [
                t for t in vehicle_temps
                if all_start <= t.time <= all_end
            ]
            
            if not relevant_temps:
                continue
            
            in_anomaly = False
            current_anomaly_temps = []
            anomaly_start = None
            
            for temp in relevant_temps:
                is_critical = (
                    temp.temperature < threshold.critical_min or
                    temp.temperature > threshold.critical_max
                )
                is_warning = (
                    threshold.warning_min <= temp.temperature < batch.temperature_min or
                    batch.temperature_max < temp.temperature <= threshold.warning_max
                )
                
                if is_critical or is_warning:
                    if not in_anomaly:
                        in_anomaly = True
                        anomaly_start = temp.time
                        current_anomaly_temps = []
                    current_anomaly_temps.append(temp)
                else:
                    if in_anomaly and current_anomaly_temps:
                        duration_minutes = (
                            temp.time - anomaly_start
                        ).total_seconds() / 60.0
                        
                        if duration_minutes > threshold.allowed_duration:
                            anomaly = self._create_anomaly(
                                batch, vehicle_id,
                                anomaly_start, temp.time,
                                current_anomaly_temps,
                                vehicle_routes, nodes, signoffs,
                                threshold, time_drifts
                            )
                            anomalies.append(anomaly)
                        in_anomaly = False
                        current_anomaly_temps = []
                        anomaly_start = None
            
            if in_anomaly and current_anomaly_temps:
                last_temp = current_anomaly_temps[-1]
                duration_minutes = (
                    last_temp.time - anomaly_start
                ).total_seconds() / 60.0
                
                if duration_minutes > threshold.allowed_duration:
                    anomaly = self._create_anomaly(
                        batch, vehicle_id,
                        anomaly_start, last_temp.time,
                        current_anomaly_temps,
                        vehicle_routes, nodes, signoffs,
                        threshold, time_drifts
                    )
                    anomalies.append(anomaly)
        
        return anomalies

    def _create_anomaly(
        self,
        batch: Batch,
        vehicle_id: str,
        start_time: datetime,
        end_time: datetime,
        temps: List[TemperatureReading],
        routes: List[VehicleRoute],
        nodes: List[Node],
        signoffs: List[SignoffRecord],
        threshold: ThresholdRule,
        time_drifts: List[TimeDrift]
    ) -> TemperatureAnomaly:
        self.anomaly_counter += 1
        
        temps_list = [t.temperature for t in temps]
        max_temp = max(temps_list)
        min_temp = min(temps_list)
        avg_temp = sum(temps_list) / len(temps_list)
        
        severity = TemperatureSeverity.WARNING
        if (max_temp > threshold.critical_max or min_temp < threshold.critical_min):
            severity = TemperatureSeverity.CRITICAL
        
        responsible_segments = self.find_responsibility(
            start_time, end_time, routes, nodes, signoffs
        )
        
        notes = []
        requires_manual = False
        data_gaps = []
        drift_info = None
        
        if len(responsible_segments) > 1:
            notes.append("超温跨越多个责任区间，请结合实际运输情况确认")
            requires_manual = True
        
        relevant_drifts = [
            d for d in time_drifts
            if d.vehicle_id == vehicle_id and
            start_time <= d.detected_at <= end_time
        ]
        if relevant_drifts:
            drift_info = relevant_drifts[0]
            notes.append(
                f"检测到传感器时间漂移，估计偏差约{round(drift_info.estimated_drift_seconds/60, 1)}分钟"
            )
            requires_manual = True
        
        expected_count = int((end_time - start_time).total_seconds() / 60)
        actual_count = len(temps)
        if actual_count < expected_count * 0.5:
            gap_id = f"GAP{self.gap_counter:04d}"
            self.gap_counter += 1
            data_gaps.append({
                'gap_id': gap_id,
                'gap_type': 'missing_temperature_data',
                'description': '温度数据点缺失超过50%',
                'start_time': start_time,
                'end_time': end_time
            })
            notes.append("温度数据不完整，需要人工确认数据采集情况")
            requires_manual = True
        
        node_ids = set()
        for r in routes:
            node_ids.add(r.start_node)
            node_ids.add(r.end_node)
        
        available_nodes = {n.node_id for n in nodes}
        missing_nodes = node_ids - available_nodes
        if missing_nodes:
            notes.append(f"缺少节点信息：{', '.join(missing_nodes)}")
            requires_manual = True
        
        return TemperatureAnomaly(
            anomaly_id=f"ANOM{self.anomaly_counter:04d}",
            batch_id=batch.batch_id,
            vehicle_id=vehicle_id,
            sensor_id=temps[0].sensor_id if temps else "",
            start_time=start_time,
            end_time=end_time,
            max_temperature=max_temp,
            min_temperature=min_temp,
            avg_temperature=avg_temp,
            severity=severity,
            duration_minutes=(end_time - start_time).total_seconds() / 60.0,
            temperature_points=temps,
            responsible_segments=responsible_segments,
            time_drift_info=drift_info,
            data_gaps=data_gaps,
            notes=notes,
            requires_manual_confirmation=requires_manual
        )

    def detect_data_gaps(
        self,
        batches: List[Batch],
        temperatures: List[TemperatureReading],
        routes: List[VehicleRoute],
        nodes: List[Node],
        signoffs: List[SignoffRecord]
    ) -> List[DataGap]:
        gaps = []
        node_ids = {n.node_id for n in nodes}
        
        vehicle_temp_map = defaultdict(list)
        for t in temperatures:
            vehicle_temp_map[t.vehicle_id].append(t)
        
        for vehicle_id, temps in vehicle_temp_map.items():
            temps_sorted = sorted(temps, key=lambda x: x.time)
            for i in range(1, len(temps_sorted)):
                gap_seconds = (
                    temps_sorted[i].time - temps_sorted[i-1].time
                ).total_seconds()
                if gap_seconds > 1800:
                    self.gap_counter += 1
                    gaps.append(
                        DataGap(
                            gap_id=f"GAP{self.gap_counter:04d}",
                            vehicle_id=vehicle_id,
                            batch_id="",
                            gap_type="time_gap",
                            start_time=temps_sorted[i-1].time,
                            end_time=temps_sorted[i].time,
                            description=f"温度数据间隔{round(gap_seconds/60, 1)}分钟",
                            severity="medium"
                        )
                    )
        
        for route in routes:
            if route.start_node not in node_ids:
                self.gap_counter += 1
                gaps.append(
                    DataGap(
                        gap_id=f"GAP{self.gap_counter:04d}",
                        vehicle_id=route.vehicle_id,
                        batch_id="",
                        gap_type="missing_node",
                        start_time=route.start_time,
                        end_time=route.start_time,
                        description=f"缺少起点节点信息：{route.start_node}",
                        severity="high"
                    )
                )
            if route.end_node not in node_ids:
                self.gap_counter += 1
                gaps.append(
                    DataGap(
                        gap_id=f"GAP{self.gap_counter:04d}",
                        vehicle_id=route.vehicle_id,
                        batch_id="",
                        gap_type="missing_node",
                        start_time=route.end_time,
                        end_time=route.end_time,
                        description=f"缺少终点节点信息：{route.end_node}",
                        severity="high"
                    )
                )
        
        for batch in batches:
            batch_vehicles = batch.vehicle_ids
            if not batch_vehicles:
                continue
            
            for vehicle_id in batch_vehicles:
                route_for_vehicle = [r for r in routes if r.vehicle_id == vehicle_id]
                if not route_for_vehicle:
                    self.gap_counter += 1
                    gaps.append(
                        DataGap(
                            gap_id=f"GAP{self.gap_counter:04d}",
                            vehicle_id=vehicle_id,
                            batch_id=batch.batch_id,
                            gap_type="missing_route",
                            start_time=None,
                            end_time=None,
                            description=f"批次{batch.batch_id}缺少车辆{vehicle_id}的路线信息",
                            severity="high"
                        )
                    )
        
        return gaps

    def analyze(
        self,
        data: Dict[str, List[Any]]
    ) -> TraceResult:
        temperatures = data.get('temperature', [])
        routes = data.get('routes', [])
        nodes = data.get('nodes', [])
        signoffs = data.get('signoffs', [])
        batches = data.get('batches', [])
        thresholds = data.get('thresholds', [])
        
        time_drifts = self.detect_time_drifts(temperatures, routes, signoffs)
        
        all_anomalies = []
        batch_summary = {}
        
        for batch in batches:
            anomalies = self.detect_anomalies(
                batch, temperatures, routes, nodes, signoffs,
                thresholds, time_drifts
            )
            all_anomalies.extend(anomalies)
            
            batch_summary[batch.batch_id] = {
                'product_name': batch.product_name,
                'product_type': batch.product_type,
                'quantity': batch.quantity,
                'anomaly_count': len(anomalies),
                'anomalies': [a.anomaly_id for a in anomalies],
                'vehicles': batch.vehicle_ids
            }
        
        data_gaps = self.detect_data_gaps(
            batches, temperatures, routes, nodes, signoffs
        )
        
        batches_with_anomalies = len([
            b for b in batch_summary.values()
            if b['anomaly_count'] > 0
        ])
        
        recommendations = []
        if time_drifts:
            recommendations.append(
                f"检测到{len(time_drifts)}个传感器时间漂移问题，建议校准传感器时钟"
            )
        
        if data_gaps:
            high_severity = [g for g in data_gaps if g.severity == 'high']
            if high_severity:
                recommendations.append(
                    f"发现{len(high_severity)}个高优先级数据缺口，需优先补全"
                )
        
        manual_anomalies = [
            a for a in all_anomalies if a.requires_manual_confirmation
        ]
        if manual_anomalies:
            recommendations.append(
                f"有{len(manual_anomalies)}个异常需要人工确认责任归属"
            )
        
        return TraceResult(
            execution_time=datetime.now(),
            total_batches=len(batches),
            batches_with_anomalies=batches_with_anomalies,
            total_anomalies=len(all_anomalies),
            anomalies=all_anomalies,
            data_gaps=data_gaps,
            time_drifts=time_drifts,
            batch_summary=batch_summary,
            recommendations=recommendations
        )
