"""调度规则模块 - 核心调度逻辑。"""

from datetime import datetime, timedelta
from typing import Dict, Optional, List, Tuple
from collections import defaultdict

from zha_beng_yan_suan_qi.types import (
    SiteConfig,
    ImportedData,
    PumpState,
    SimulationState,
    SimulationResult,
    Alert,
    AlertType,
    AlertLevel,
    WaterLevelRecord,
    RainfallRecord,
)
from zha_beng_yan_suan_qi.hydraulics import HydraulicCalculator


class Scheduler:
    """调度器类。"""
    
    def __init__(self, config: SiteConfig, imported_data: ImportedData):
        self.config = config
        self.imported_data = imported_data
        self.calculator = HydraulicCalculator()
        
        self.pump_curves = {p.pump_id: p for p in imported_data.pump_curves}
        self.gate_limits = {g.gate_id: g for g in imported_data.gate_limits}
        
        self.water_levels_by_time: Dict[float, WaterLevelRecord] = {}
        self.rainfall_by_time: Dict[float, RainfallRecord] = {}
        
        for wl in imported_data.water_levels:
            time_hours = wl.timestamp.timestamp() / 3600
            self.water_levels_by_time[time_hours] = wl
        
        for rf in imported_data.rainfalls:
            time_hours = rf.timestamp.timestamp() / 3600
            self.rainfall_by_time[time_hours] = rf
    
    def _get_water_level_at(self, time_hours: float) -> Tuple[Optional[float], Optional[float]]:
        """获取指定时间的内外水位。"""
        if not self.water_levels_by_time:
            return None, None
        
        times = sorted(self.water_levels_by_time.keys())
        
        if time_hours <= times[0]:
            wl = self.water_levels_by_time[times[0]]
            return wl.inner_level, wl.outer_level
        if time_hours >= times[-1]:
            wl = self.water_levels_by_time[times[-1]]
            return wl.inner_level, wl.outer_level
        
        for i in range(len(times) - 1):
            if times[i] <= time_hours < times[i + 1]:
                wl1 = self.water_levels_by_time[times[i]]
                wl2 = self.water_levels_by_time[times[i + 1]]
                
                ratio = (time_hours - times[i]) / (times[i + 1] - times[i])
                
                inner_level = wl1.inner_level + (wl2.inner_level - wl1.inner_level) * ratio
                
                outer_level = None
                if wl1.outer_level is not None and wl2.outer_level is not None:
                    outer_level = wl1.outer_level + (wl2.outer_level - wl1.outer_level) * ratio
                
                return inner_level, outer_level
        
        wl = self.water_levels_by_time[times[-1]]
        return wl.inner_level, wl.outer_level
    
    def _get_rainfall_at(self, time_hours: float) -> float:
        """获取指定时间的降雨量。"""
        if not self.rainfall_by_time:
            return 0.0
        
        times = sorted(self.rainfall_by_time.keys())
        
        for i in range(len(times) - 1):
            if times[i] <= time_hours < times[i + 1]:
                rf = self.rainfall_by_time[times[i]]
                return rf.rainfall_mm / max(rf.duration_hours, 1.0)
        
        if times and time_hours >= times[-1]:
            rf = self.rainfall_by_time[times[-1]]
            return rf.rainfall_mm / max(rf.duration_hours, 1.0)
        
        return 0.0
    
    def _decide_pump_operations(
        self,
        inner_level: float,
        outer_level: float,
        pump_states: Dict[str, PumpState],
        last_state_changes: Dict[str, float],
        current_time_hours: float,
    ) -> Dict[str, bool]:
        """决定泵的开关操作。"""
        decisions: Dict[str, bool] = {}
        min_cycle = self.config.min_pump_cycle_hours
        
        warning_level = self.config.inner_warning_level
        critical_level = self.config.inner_critical_level
        
        start_threshold = warning_level
        stop_threshold = warning_level * 0.8
        
        for pump_id, current_state in pump_states.items():
            is_running = current_state == PumpState.ON
            
            last_change = last_state_changes.get(pump_id, 0.0)
            can_change, wait_time = self.calculator.check_pump_cycle_violation(
                last_change, current_time_hours, min_cycle
            )
            
            if can_change and wait_time > 0:
                decisions[pump_id] = is_running
                continue
            
            if inner_level > start_threshold:
                if not is_running:
                    decisions[pump_id] = True
                else:
                    decisions[pump_id] = True
            elif inner_level < stop_threshold:
                if is_running:
                    decisions[pump_id] = False
                else:
                    decisions[pump_id] = False
            else:
                decisions[pump_id] = is_running
        
        return decisions
    
    def _decide_gate_operations(
        self,
        inner_level: float,
        outer_level: float,
        current_openings: Dict[str, float],
    ) -> Dict[str, float]:
        """决定闸门开度。"""
        decisions: Dict[str, float] = {}
        
        warning_level = self.config.inner_warning_level
        critical_level = self.config.inner_critical_level
        
        for gate_id, current_opening in current_openings.items():
            gate_limit = self.gate_limits.get(gate_id)
            if not gate_limit:
                decisions[gate_id] = current_opening
                continue
            
            max_opening = gate_limit.max_opening
            min_opening = gate_limit.min_opening
            
            if outer_level > inner_level:
                decisions[gate_id] = 0.0
                continue
            
            level_diff = inner_level - outer_level
            if inner_level >= critical_level:
                target_opening = max_opening
            elif inner_level >= warning_level:
                ratio = (inner_level - warning_level) / (critical_level - warning_level + 0.01)
                target_opening = min_opening + (max_opening - min_opening) * ratio
            elif level_diff > 0.5:
                target_opening = min_opening
            else:
                target_opening = 0.0
            
            decisions[gate_id] = max(min_opening, min(target_opening, max_opening))
        
        return decisions
    
    def _check_alerts(
        self,
        state: SimulationState,
        pump_states: Dict[str, PumpState],
        total_energy: float,
        hours_elapsed: float,
    ) -> List[Alert]:
        """检查告警条件。"""
        alerts: List[Alert] = []
        
        has_risk, risk_level, exceed = self.calculator.check_overtopping_risk(
            state.inner_level,
            self.config.inner_critical_level,
            self.config.inner_warning_level,
        )
        
        if has_risk:
            if risk_level == "critical":
                alerts.append(Alert(
                    alert_type=AlertType.OVERTOPPING,
                    level=AlertLevel.CRITICAL,
                    message=f"内河水位({state.inner_level:.2f}m)超过保证水位({self.config.inner_critical_level:.2f}m)，存在漫顶风险！",
                    timestamp=state.timestamp,
                    details={
                        "inner_level": state.inner_level,
                        "critical_level": self.config.inner_critical_level,
                        "exceed_meters": exceed,
                    }
                ))
            else:
                alerts.append(Alert(
                    alert_type=AlertType.OVERTOPPING,
                    level=AlertLevel.WARNING,
                    message=f"内河水位({state.inner_level:.2f}m)超过警戒水位({self.config.inner_warning_level:.2f}m)",
                    timestamp=state.timestamp,
                    details={
                        "inner_level": state.inner_level,
                        "warning_level": self.config.inner_warning_level,
                        "exceed_meters": exceed,
                    }
                ))
        
        if state.outer_level is not None:
            total_gate_opening = sum(state.gate_openings.values())
            has_backflow, level_diff = self.calculator.check_backflow_risk(
                state.inner_level,
                state.outer_level,
                total_gate_opening,
            )
            
            if has_backflow:
                alerts.append(Alert(
                    alert_type=AlertType.BACKFLOW,
                    level=AlertLevel.CRITICAL,
                    message=f"外河水位({state.outer_level:.2f}m)高于内河({state.inner_level:.2f}m)，闸门开启可能导致倒灌！",
                    timestamp=state.timestamp,
                    details={
                        "inner_level": state.inner_level,
                        "outer_level": state.outer_level,
                        "level_diff": level_diff,
                        "total_gate_opening": total_gate_opening,
                    }
                ))
            elif state.outer_level > state.inner_level:
                alerts.append(Alert(
                    alert_type=AlertType.BACKFLOW,
                    level=AlertLevel.WARNING,
                    message=f"外河水位({state.outer_level:.2f}m)高于内河({state.inner_level:.2f}m)，请注意闸门关闭情况",
                    timestamp=state.timestamp,
                    details={
                        "inner_level": state.inner_level,
                        "outer_level": state.outer_level,
                        "level_diff": level_diff,
                    }
                ))
        
        if self.config.daily_energy_limit_kwh:
            over_limit, amount = self.calculator.check_energy_limit(
                total_energy,
                self.config.daily_energy_limit_kwh,
                hours_elapsed,
            )
            
            if over_limit:
                if total_energy > self.config.daily_energy_limit_kwh:
                    alerts.append(Alert(
                        alert_type=AlertType.ENERGY_LIMIT,
                        level=AlertLevel.CRITICAL,
                        message=f"能耗已超限！当前消耗{total_energy:.1f}kWh，超过每日限额{self.config.daily_energy_limit_kwh:.1f}kWh",
                        timestamp=state.timestamp,
                        details={
                            "current_energy": total_energy,
                            "daily_limit": self.config.daily_energy_limit_kwh,
                            "over_limit": amount,
                        }
                    ))
                else:
                    alerts.append(Alert(
                        alert_type=AlertType.ENERGY_LIMIT,
                        level=AlertLevel.WARNING,
                        message=f"按当前速率，预计日能耗将超限{amount:.1f}kWh",
                        timestamp=state.timestamp,
                        details={
                            "current_energy": total_energy,
                            "projected_over": amount,
                        }
                    ))
        
        return alerts
    
    def run_simulation(
        self,
        start_time: datetime,
        end_time: datetime,
        step_hours: float = 1.0,
        initial_inner_level: Optional[float] = None,
        initial_outer_level: Optional[float] = None,
    ) -> SimulationResult:
        """运行时序仿真。"""
        states: List[SimulationState] = []
        all_alerts: List[Alert] = []
        
        start_hours = start_time.timestamp() / 3600
        end_hours = end_time.timestamp() / 3600
        
        inner_level = initial_inner_level
        outer_level = initial_outer_level
        
        if inner_level is None:
            wl_inner, wl_outer = self._get_water_level_at(start_hours)
            if wl_inner is not None:
                inner_level = wl_inner
            else:
                inner_level = self.config.inner_warning_level * 0.7
            
            if outer_level is None and wl_outer is not None:
                outer_level = wl_outer
        
        if outer_level is None:
            outer_level = inner_level + 0.5
        
        storage = self.calculator.calculate_storage_from_level(
            inner_level,
            self.config.inner_channel_area,
            self.config.inner_channel_capacity,
        )
        
        pump_states: Dict[str, PumpState] = {}
        for pump_id in self.pump_curves.keys():
            pump_states[pump_id] = PumpState.OFF
        
        last_state_changes: Dict[str, float] = {}
        
        gate_openings: Dict[str, float] = {}
        for gate_id in self.gate_limits.keys():
            gate_openings[gate_id] = 0.0
        
        total_energy_kwh = 0.0
        pump_runtime: Dict[str, float] = defaultdict(float)
        
        max_inner_level = inner_level
        min_inner_level = inner_level
        
        current_time = start_time
        current_hours = start_hours
        
        while current_hours < end_hours:
            data_inner_level, data_outer_level = self._get_water_level_at(current_hours)
            if data_inner_level is not None:
                inner_level = data_inner_level
            if data_outer_level is not None:
                outer_level = data_outer_level
            
            rainfall_mm_per_hour = self._get_rainfall_at(current_hours)
            rainfall_mm = rainfall_mm_per_hour * step_hours
            
            catchment_area = self.config.inner_channel_area / 1_000_000
            inflow = self.calculator.calculate_rainfall_inflow(
                rainfall_mm,
                step_hours,
                max(catchment_area, 0.1),
                0.6,
            )
            
            pump_decisions = self._decide_pump_operations(
                inner_level,
                outer_level,
                pump_states,
                last_state_changes,
                current_hours,
            )
            
            total_pump_flow = 0.0
            total_pump_power = 0.0
            
            for pump_id, should_run in pump_decisions.items():
                pump_curve = self.pump_curves.get(pump_id)
                if not pump_curve:
                    continue
                
                was_running = pump_states[pump_id] == PumpState.ON
                
                if should_run != was_running:
                    last_state_changes[pump_id] = current_hours
                
                pump_states[pump_id] = PumpState.ON if should_run else PumpState.OFF
                
                flow, power = self.calculator.calculate_pump_flow(
                    pump_curve,
                    inner_level,
                    outer_level,
                    should_run,
                )
                
                total_pump_flow += flow
                total_pump_power += power
                
                if should_run:
                    pump_runtime[pump_id] += step_hours
            
            energy_this_step = total_pump_power * step_hours
            total_energy_kwh += energy_this_step
            
            gate_decisions = self._decide_gate_operations(
                inner_level,
                outer_level,
                gate_openings,
            )
            gate_openings = gate_decisions
            
            total_gate_flow = 0.0
            has_any_backflow = False
            
            for gate_id, opening in gate_openings.items():
                gate_limit = self.gate_limits.get(gate_id)
                if not gate_limit:
                    continue
                
                flow, is_backflow = self.calculator.calculate_gate_flow(
                    gate_limit,
                    inner_level,
                    outer_level,
                    opening,
                )
                
                if is_backflow:
                    has_any_backflow = True
                    total_gate_flow -= flow
                else:
                    total_gate_flow += flow
            
            storage = self.calculator.calculate_storage_change(
                storage,
                inflow,
                total_pump_flow,
                total_gate_flow,
                step_hours,
            )
            
            storage = max(0, min(storage, self.config.inner_channel_capacity))
            
            new_inner_level = self.calculator.calculate_level_from_storage(
                storage,
                self.config.inner_channel_area,
                self.config.inner_channel_capacity,
                0.0,
            )
            
            max_inner_level = max(max_inner_level, new_inner_level)
            min_inner_level = min(min_inner_level, new_inner_level)
            
            net_flow = inflow - total_pump_flow - total_gate_flow
            
            state = SimulationState(
                timestamp=current_time,
                inner_level=new_inner_level,
                outer_level=outer_level,
                storage_m3=storage,
                inflow_m3h=inflow,
                pump_total_flow_m3h=total_pump_flow,
                gate_total_flow_m3h=total_gate_flow,
                net_flow_m3h=net_flow,
                pump_states=pump_states.copy(),
                gate_openings=gate_openings.copy(),
                rainfall_mm=rainfall_mm,
            )
            
            states.append(state)
            
            hours_elapsed = (current_hours - start_hours)
            alerts = self._check_alerts(
                state,
                pump_states,
                total_energy_kwh,
                hours_elapsed,
            )
            all_alerts.extend(alerts)
            
            inner_level = new_inner_level
            current_hours += step_hours
            current_time = current_time + timedelta(hours=step_hours)
        
        return SimulationResult(
            site_name=self.config.site_name,
            simulation_start=start_time,
            simulation_end=end_time,
            step_hours=step_hours,
            states=states,
            alerts=all_alerts,
            total_pump_runtime_hours=dict(pump_runtime),
            total_energy_kwh=total_energy_kwh,
            max_inner_level=max_inner_level,
            min_inner_level=min_inner_level,
        )
