#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from battery_log_lab.calculator import (
    ChargeDirection,
    TrapezoidalIntegrator,
    IntegrationResult,
    InternalResistanceEstimator,
    ResistanceEstimate,
)


@dataclass
class ChargeDischargeSegment:
    segment_id: int
    direction: ChargeDirection
    start_idx: int
    end_idx: int
    start_time: float
    end_time: float
    duration_seconds: float
    integration_result: IntegrationResult
    resistance_estimates: List[ResistanceEstimate] = field(default_factory=list)
    
    @property
    def is_charge(self) -> bool:
        return self.direction == ChargeDirection.CHARGE
    
    @property
    def is_discharge(self) -> bool:
        return self.direction == ChargeDirection.DISCHARGE
    
    @property
    def is_idle(self) -> bool:
        return self.direction == ChargeDirection.IDLE
    
    @property
    def capacity_mah(self) -> float:
        return self.integration_result.capacity_mah
    
    @property
    def energy_wh(self) -> float:
        return self.integration_result.energy_wh
    
    @property
    def avg_current_ma(self) -> float:
        return self.integration_result.avg_current_ma
    
    @property
    def avg_voltage_v(self) -> float:
        return self.integration_result.avg_voltage_v
    
    @property
    def start_voltage_v(self) -> float:
        return self.integration_result.start_voltage_v
    
    @property
    def end_voltage_v(self) -> float:
        return self.integration_result.end_voltage_v
    
    @property
    def voltage_delta_v(self) -> float:
        return self.end_voltage_v - self.start_voltage_v


class Segmenter:
    def __init__(
        self,
        current_threshold_ma: float = 10.0,
        min_segment_duration_seconds: float = 5.0,
        min_segment_points: int = 5,
    ):
        self.current_threshold = current_threshold_ma
        self.min_segment_duration = min_segment_duration_seconds
        self.min_segment_points = min_segment_points
    
    def segment(
        self,
        time: List[float],
        current: List[float],
        voltage: List[float],
        resistance_estimator: Optional[InternalResistanceEstimator] = None,
    ) -> List[ChargeDischargeSegment]:
        if len(time) < 2:
            return []
        
        raw_segments = self._identify_segments(time, current)
        merged_segments = self._merge_small_segments(raw_segments, time, current)
        final_segments = self._split_idle_segments(merged_segments, time, current)
        
        segments: List[ChargeDischargeSegment] = []
        
        for seg_id, (start_idx, end_idx, direction) in enumerate(final_segments):
            if start_idx >= end_idx:
                continue
            
            integration_result = TrapezoidalIntegrator.integrate_segment(
                time, current, voltage, start_idx, end_idx
            )
            
            resistance_estimates: List[ResistanceEstimate] = []
            if resistance_estimator and direction != ChargeDirection.IDLE:
                seg_time = time[start_idx:end_idx + 1]
                seg_current = current[start_idx:end_idx + 1]
                seg_voltage = voltage[start_idx:end_idx + 1]
                
                estimates = resistance_estimator.detect_and_estimate(
                    seg_time, seg_current, seg_voltage
                )
                
                for est in estimates:
                    est.row_index += start_idx
                    est.time_seconds += time[start_idx]
                    resistance_estimates.append(est)
            
            segment = ChargeDischargeSegment(
                segment_id=seg_id,
                direction=direction,
                start_idx=start_idx,
                end_idx=end_idx,
                start_time=time[start_idx],
                end_time=time[end_idx],
                duration_seconds=time[end_idx] - time[start_idx],
                integration_result=integration_result,
                resistance_estimates=resistance_estimates,
            )
            
            segments.append(segment)
        
        return segments
    
    def _identify_segments(
        self,
        time: List[float],
        current: List[float],
    ) -> List[Tuple[int, int, ChargeDirection]]:
        segments: List[Tuple[int, int, ChargeDirection]] = []
        
        if len(time) < 1:
            return segments
        
        current_dir = self._get_direction(current[0])
        start_idx = 0
        
        for i in range(1, len(time)):
            dir_i = self._get_direction(current[i])
            if dir_i != current_dir:
                segments.append((start_idx, i - 1, current_dir))
                current_dir = dir_i
                start_idx = i
        
        segments.append((start_idx, len(time) - 1, current_dir))
        return segments
    
    def _merge_small_segments(
        self,
        segments: List[Tuple[int, int, ChargeDirection]],
        time: List[float],
        current: List[float],
    ) -> List[Tuple[int, int, ChargeDirection]]:
        if len(segments) < 2:
            return segments
        
        merged: List[Tuple[int, int, ChargeDirection]] = []
        
        i = 0
        while i < len(segments):
            start_idx, end_idx, direction = segments[i]
            duration = time[end_idx] - time[start_idx]
            point_count = end_idx - start_idx + 1
            
            if (duration < self.min_segment_duration or 
                point_count < self.min_segment_points):
                
                left_segment = merged[-1] if merged else None
                right_segment = segments[i + 1] if i + 1 < len(segments) else None
                
                if left_segment is None and right_segment is None:
                    merged.append((start_idx, end_idx, direction))
                    i += 1
                    continue
                
                if left_segment and right_segment:
                    left_dir = left_segment[2]
                    right_dir = right_segment[2]
                    
                    if left_dir == right_dir:
                        merged.pop()
                        new_start = left_segment[0]
                        new_end = right_segment[1]
                        merged.append((new_start, new_end, left_dir))
                        i += 2
                    else:
                        left_duration = left_segment[1] - left_segment[0]
                        right_duration = right_segment[1] - right_segment[0]
                        
                        if left_duration > right_duration:
                            merged.pop()
                            new_start = left_segment[0]
                            new_end = end_idx
                            merged.append((new_start, new_end, left_segment[2]))
                            i += 1
                        else:
                            new_start = start_idx
                            new_end = right_segment[1]
                            merged.append((new_start, new_end, right_segment[2]))
                            i += 2
                elif left_segment:
                    merged.pop()
                    new_start = left_segment[0]
                    new_end = end_idx
                    merged.append((new_start, new_end, left_segment[2]))
                    i += 1
                elif right_segment:
                    new_start = start_idx
                    new_end = right_segment[1]
                    merged.append((new_start, new_end, right_segment[2]))
                    i += 2
            else:
                merged.append((start_idx, end_idx, direction))
                i += 1
        
        return merged
    
    def _split_idle_segments(
        self,
        segments: List[Tuple[int, int, ChargeDirection]],
        time: List[float],
        current: List[float],
    ) -> List[Tuple[int, int, ChargeDirection]]:
        result: List[Tuple[int, int, ChargeDirection]] = []
        
        for start_idx, end_idx, direction in segments:
            if direction != ChargeDirection.IDLE:
                result.append((start_idx, end_idx, direction))
                continue
            
            idle_duration = time[end_idx] - time[start_idx]
            if idle_duration <= self.min_segment_duration * 2:
                result.append((start_idx, end_idx, direction))
                continue
            
            mid_idx = (start_idx + end_idx) // 2
            result.append((start_idx, mid_idx, direction))
            result.append((mid_idx + 1, end_idx, direction))
        
        return result
    
    def _get_direction(self, current: float) -> ChargeDirection:
        if abs(current) < self.current_threshold:
            return ChargeDirection.IDLE
        elif current > 0:
            return ChargeDirection.CHARGE
        else:
            return ChargeDirection.DISCHARGE


def get_segments_summary(
    segments: List[ChargeDischargeSegment],
) -> Dict[str, any]:
    total_charge_capacity = 0.0
    total_charge_energy = 0.0
    total_charge_time = 0.0
    charge_count = 0
    
    total_discharge_capacity = 0.0
    total_discharge_energy = 0.0
    total_discharge_time = 0.0
    discharge_count = 0
    
    total_idle_time = 0.0
    idle_count = 0
    
    all_resistance_estimates: List[ResistanceEstimate] = []
    
    for seg in segments:
        if seg.is_charge:
            total_charge_capacity += seg.capacity_mah
            total_charge_energy += seg.energy_wh
            total_charge_time += seg.duration_seconds
            charge_count += 1
        elif seg.is_discharge:
            total_discharge_capacity += seg.capacity_mah
            total_discharge_energy += seg.energy_wh
            total_discharge_time += seg.duration_seconds
            discharge_count += 1
        else:
            total_idle_time += seg.duration_seconds
            idle_count += 1
        
        all_resistance_estimates.extend(seg.resistance_estimates)
    
    avg_resistance = None
    if all_resistance_estimates:
        high_confidence = [
            r for r in all_resistance_estimates 
            if r.confidence in ['high', 'medium']
        ]
        if high_confidence:
            avg_resistance = sum(
                r.estimated_resistance_ohm for r in high_confidence
            ) / len(high_confidence)
    
    efficiency = None
    if total_charge_capacity > 0 and total_discharge_capacity > 0:
        efficiency = (total_discharge_capacity / total_charge_capacity) * 100
    
    return {
        'charge': {
            'count': charge_count,
            'total_capacity_mah': total_charge_capacity,
            'total_energy_wh': total_charge_energy,
            'total_time_seconds': total_charge_time,
        },
        'discharge': {
            'count': discharge_count,
            'total_capacity_mah': total_discharge_capacity,
            'total_energy_wh': total_discharge_energy,
            'total_time_seconds': total_discharge_time,
        },
        'idle': {
            'count': idle_count,
            'total_time_seconds': total_idle_time,
        },
        'efficiency_percent': efficiency,
        'avg_resistance_ohm': avg_resistance,
        'resistance_estimate_count': len(all_resistance_estimates),
        'total_segments': len(segments),
    }
