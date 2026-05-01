#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum


class ChargeDirection(Enum):
    CHARGE = "charge"
    DISCHARGE = "discharge"
    IDLE = "idle"


@dataclass
class IntegrationResult:
    start_time: float
    end_time: float
    duration_seconds: float
    capacity_mah: float
    energy_wh: float
    avg_current_ma: float
    avg_voltage_v: float
    start_voltage_v: float
    end_voltage_v: float
    start_current_ma: float
    end_current_ma: float
    direction: ChargeDirection
    point_count: int = 0


@dataclass
class ResistanceEstimate:
    row_index: int
    time_seconds: float
    current_before_ma: float
    current_after_ma: float
    current_delta_ma: float
    voltage_before_v: float
    voltage_after_v: float
    voltage_delta_v: float
    estimated_resistance_ohm: float
    confidence: str = "medium"


class TrapezoidalIntegrator:
    @staticmethod
    def integrate_segment(
        time: List[float],
        current: List[float],
        voltage: List[float],
        start_idx: int,
        end_idx: int,
    ) -> IntegrationResult:
        if start_idx >= end_idx or start_idx < 0 or end_idx >= len(time):
            raise ValueError(f"Invalid indices: start={start_idx}, end={end_idx}")
        
        total_capacity_mah = 0.0
        total_energy_wh = 0.0
        
        current_sum = 0.0
        voltage_sum = 0.0
        point_count = end_idx - start_idx + 1
        
        for i in range(start_idx, end_idx):
            dt = time[i + 1] - time[i]
            if dt <= 0:
                continue
            
            avg_current = (current[i] + current[i + 1]) / 2.0
            avg_voltage = (voltage[i] + voltage[i + 1]) / 2.0
            
            capacity_mah = (avg_current * dt) / 3600.0
            energy_wh = (avg_voltage * avg_current * dt) / (3600.0 * 1000.0)
            
            total_capacity_mah += capacity_mah
            total_energy_wh += energy_wh
            
            current_sum += current[i]
            voltage_sum += voltage[i]
        
        current_sum += current[end_idx]
        voltage_sum += voltage[end_idx]
        
        avg_current_ma = current_sum / point_count if point_count > 0 else 0.0
        avg_voltage_v = voltage_sum / point_count if point_count > 0 else 0.0
        
        if abs(avg_current_ma) < 1.0:
            direction = ChargeDirection.IDLE
        elif avg_current_ma > 0:
            direction = ChargeDirection.CHARGE
        else:
            direction = ChargeDirection.DISCHARGE
        
        return IntegrationResult(
            start_time=time[start_idx],
            end_time=time[end_idx],
            duration_seconds=time[end_idx] - time[start_idx],
            capacity_mah=abs(total_capacity_mah),
            energy_wh=abs(total_energy_wh),
            avg_current_ma=avg_current_ma,
            avg_voltage_v=avg_voltage_v,
            start_voltage_v=voltage[start_idx],
            end_voltage_v=voltage[end_idx],
            start_current_ma=current[start_idx],
            end_current_ma=current[end_idx],
            direction=direction,
            point_count=point_count,
        )
    
    @staticmethod
    def integrate_full(
        time: List[float],
        current: List[float],
        voltage: List[float],
    ) -> IntegrationResult:
        if len(time) < 2:
            raise ValueError("Need at least 2 data points for integration")
        return TrapezoidalIntegrator.integrate_segment(
            time, current, voltage, 0, len(time) - 1
        )


class CapacityCalculator:
    def __init__(self, current_threshold_ma: float = 10.0):
        self.current_threshold = current_threshold_ma
    
    def calculate_by_direction(
        self,
        time: List[float],
        current: List[float],
        voltage: List[float],
    ) -> Dict[ChargeDirection, IntegrationResult]:
        results = {
            ChargeDirection.CHARGE: None,
            ChargeDirection.DISCHARGE: None,
            ChargeDirection.IDLE: None,
        }
        
        segments = self._split_by_direction(time, current, voltage)
        
        for seg_start, seg_end, direction in segments:
            if seg_start == seg_end:
                continue
            
            seg_result = TrapezoidalIntegrator.integrate_segment(
                time, current, voltage, seg_start, seg_end
            )
            
            if results[direction] is None:
                results[direction] = seg_result
            else:
                existing = results[direction]
                existing.capacity_mah += seg_result.capacity_mah
                existing.energy_wh += seg_result.energy_wh
                existing.duration_seconds += seg_result.duration_seconds
                existing.point_count += seg_result.point_count
                existing.end_time = seg_result.end_time
                existing.end_voltage_v = seg_result.end_voltage_v
                existing.end_current_ma = seg_result.end_current_ma
        
        return results
    
    def _split_by_direction(
        self,
        time: List[float],
        current: List[float],
        voltage: List[float],
    ) -> List[Tuple[int, int, ChargeDirection]]:
        if len(time) < 1:
            return []
        
        segments = []
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
    
    def _get_direction(self, current: float) -> ChargeDirection:
        if abs(current) < self.current_threshold:
            return ChargeDirection.IDLE
        elif current > 0:
            return ChargeDirection.CHARGE
        else:
            return ChargeDirection.DISCHARGE


class InternalResistanceEstimator:
    def __init__(
        self,
        current_jump_threshold_ma: float = 500.0,
        min_samples_before: int = 3,
        min_samples_after: int = 3,
    ):
        self.current_jump_threshold = current_jump_threshold_ma
        self.min_samples_before = min_samples_before
        self.min_samples_after = min_samples_after
    
    def detect_and_estimate(
        self,
        time: List[float],
        current: List[float],
        voltage: List[float],
    ) -> List[ResistanceEstimate]:
        estimates = []
        
        if len(time) < self.min_samples_before + self.min_samples_after + 1:
            return estimates
        
        for i in range(self.min_samples_before, len(time) - self.min_samples_after):
            current_before = self._avg(
                current[i - self.min_samples_before : i]
            )
            current_after = self._avg(
                current[i : i + self.min_samples_after]
            )
            
            current_delta = current_after - current_before
            
            if abs(current_delta) >= self.current_jump_threshold:
                voltage_before = self._avg(
                    voltage[i - self.min_samples_before : i]
                )
                voltage_after = self._avg(
                    voltage[i : i + self.min_samples_after]
                )
                
                voltage_delta = voltage_after - voltage_before
                
                if abs(current_delta) > 0.1:
                    resistance_ohm = abs(voltage_delta / (current_delta / 1000.0))
                    
                    if resistance_ohm > 0 and resistance_ohm < 10.0:
                        confidence = self._calculate_confidence(
                            voltage, i, voltage_before, voltage_after
                        )
                        
                        estimates.append(ResistanceEstimate(
                            row_index=i,
                            time_seconds=time[i],
                            current_before_ma=current_before,
                            current_after_ma=current_after,
                            current_delta_ma=current_delta,
                            voltage_before_v=voltage_before,
                            voltage_after_v=voltage_after,
                            voltage_delta_v=voltage_delta,
                            estimated_resistance_ohm=resistance_ohm,
                            confidence=confidence,
                        ))
        
        return estimates
    
    def _avg(self, values: List[float]) -> float:
        if not values:
            return 0.0
        return sum(values) / len(values)
    
    def _calculate_confidence(
        self,
        voltage: List[float],
        idx: int,
        v_before: float,
        v_after: float,
    ) -> str:
        window = 2
        variance_before = 0.0
        variance_after = 0.0
        
        start_before = max(0, idx - window - self.min_samples_before)
        end_before = idx
        for i in range(start_before, end_before):
            variance_before += (voltage[i] - v_before) ** 2
        variance_before /= max(1, end_before - start_before)
        
        start_after = idx
        end_after = min(len(voltage), idx + self.min_samples_after + window)
        for i in range(start_after, end_after):
            variance_after += (voltage[i] - v_after) ** 2
        variance_after /= max(1, end_after - start_after)
        
        total_variance = variance_before + variance_after
        
        if total_variance < 0.001:
            return "high"
        elif total_variance < 0.01:
            return "medium"
        else:
            return "low"
