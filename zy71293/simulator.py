import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import warnings
from models import Patient, Window, PatientQueue, PatientPriority
from strategies import SchedulingStrategy, create_strategy


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def add_error(self, msg: str):
        self.errors.append(msg)
        self.is_valid = False

    def add_warning(self, msg: str):
        self.warnings.append(msg)


@dataclass
class SimulationConfig:
    num_patients: int = 100
    num_windows: int = 3
    arrival_rate: float = 2.0
    avg_service_time: float = 10.0
    std_service_time: float = 3.0
    sim_duration: float = 480.0
    random_seed: Optional[int] = None
    strategy_name: str = 'FCFS'
    strategy_params: Dict[str, Any] = field(default_factory=dict)
    window_breaks: List[List[Tuple[float, float]]] = field(default_factory=list)
    priority_ratio: Dict[PatientPriority, float] = field(default_factory=lambda: {
        PatientPriority.NORMAL: 0.7,
        PatientPriority.PRIORITY: 0.2,
        PatientPriority.EMERGENCY: 0.1,
    })
    notes: str = ''
    receipt_info: str = ''


class ParameterValidator:
    @staticmethod
    def validate(config: SimulationConfig) -> ValidationResult:
        result = ValidationResult(is_valid=True)

        if config.num_patients <= 0:
            result.add_error(f"患者数量必须 > 0，当前值: {config.num_patients}")
        elif config.num_patients > 100000:
            result.add_warning(f"患者数量过大 ({config.num_patients})，可能导致运行时间过长")

        if config.num_windows <= 0:
            result.add_error(f"窗口数量必须 > 0，当前值: {config.num_windows}")
        elif config.num_windows > 50:
            result.add_warning(f"窗口数量过多 ({config.num_windows})，请确认是否合理")

        if config.arrival_rate <= 0:
            result.add_error(f"到达率必须 > 0，当前值: {config.arrival_rate}")
        elif config.arrival_rate > 100:
            result.add_warning(f"到达率过高 ({config.arrival_rate}/分钟)，请确认是否合理")

        if config.avg_service_time <= 0:
            result.add_error(f"平均服务时间必须 > 0，当前值: {config.avg_service_time}")
        elif config.avg_service_time > 180:
            result.add_warning(f"平均服务时间过长 ({config.avg_service_time}分钟)，请确认是否合理")

        if config.std_service_time < 0:
            result.add_error(f"服务时间标准差必须 >= 0，当前值: {config.std_service_time}")

        if config.sim_duration <= 0:
            result.add_error(f"模拟时长必须 > 0，当前值: {config.sim_duration}")
        elif config.sim_duration > 1440:
            result.add_warning(f"模拟时长超过24小时 ({config.sim_duration}分钟)")

        if config.num_windows > 0 and config.avg_service_time > 0:
            traffic_intensity = config.arrival_rate * config.avg_service_time / config.num_windows
            if traffic_intensity >= 1.0:
                result.add_warning(f"交通强度 >= 1.0 ({traffic_intensity:.2f})，队列可能无限增长")
            elif traffic_intensity >= 0.95:
                result.add_warning(f"交通强度接近饱和 ({traffic_intensity:.2f})，等待时间可能很长")

        if config.random_seed is None:
            result.add_warning("未设置随机种子，结果不可复现")

        if config.window_breaks:
            if len(config.window_breaks) != config.num_windows:
                result.add_error(f"休息时间配置数量 ({len(config.window_breaks)}) 与窗口数量 ({config.num_windows}) 不匹配")
            else:
                for i, breaks in enumerate(config.window_breaks):
                    for start, end in breaks:
                        if start < 0 or end > config.sim_duration:
                            result.add_warning(f"窗口{i}的休息时间 [{start}, {end}) 超出模拟时长范围")
                        if start >= end:
                            result.add_error(f"窗口{i}的休息时间无效: [{start}, {end})")

        total_ratio = sum(config.priority_ratio.values())
        if not (0.99 <= total_ratio <= 1.01):
            result.add_error(f"优先级比例之和必须约等于1.0，当前值: {total_ratio}")

        return result


@dataclass
class SimulationResult:
    config: SimulationConfig
    patients: List[Patient]
    windows: List[Window]
    wait_times: List[float]
    total_times: List[float]
    max_queue_length: int
    avg_queue_length: float
    utilization: List[float]
    simulation_time: float
    has_extreme_wait: bool = False
    has_break_miss: bool = False
    has_random_seed_issue: bool = False

    def to_dataframe(self) -> pd.DataFrame:
        data = []
        for p in self.patients:
            data.append({
                'patient_id': p.id,
                'arrival_time': p.arrival_time,
                'service_time': p.service_time,
                'priority': p.priority.name,
                'wait_time': p.wait_time,
                'total_time': p.total_time,
                'window_id': p.window_id,
                'start_service': p.start_service_time,
                'end_service': p.end_service_time,
            })
        return pd.DataFrame(data)


class MonteCarloSimulator:
    def __init__(self, config: SimulationConfig):
        self.config = config
        self._rng = np.random.RandomState(config.random_seed)

    def generate_patients(self) -> List[Patient]:
        patients = []
        priorities = list(self.config.priority_ratio.keys())
        probs = list(self.config.priority_ratio.values())
        
        arrival_time = 0.0
        patient_id = 1

        while len(patients) < self.config.num_patients and arrival_time < self.config.sim_duration:
            inter_arrival = self._rng.exponential(1.0 / self.config.arrival_rate)
            arrival_time += inter_arrival
            
            if arrival_time >= self.config.sim_duration:
                break

            service_time = max(1.0, self._rng.normal(
                self.config.avg_service_time, 
                self.config.std_service_time
            ))
            
            priority = self._rng.choice(priorities, p=probs)
            
            patient = Patient(
                id=patient_id,
                arrival_time=arrival_time,
                service_time=service_time,
                priority=priority
            )
            patients.append(patient)
            patient_id += 1

        return patients

    def run_single(self, strategy: SchedulingStrategy) -> SimulationResult:
        patients = self.generate_patients()
        queue = PatientQueue()
        
        windows = []
        for i in range(self.config.num_windows):
            w = Window(id=i)
            if i < len(self.config.window_breaks):
                w.break_periods = self.config.window_breaks[i]
            windows.append(w)

        event_times = sorted([p.arrival_time for p in patients])
        for w in windows:
            for start, end in w.break_periods:
                event_times.extend([start, end])
        event_times = sorted(set(event_times))

        patient_idx = 0
        max_queue_length = 0
        queue_length_sum = 0.0
        queue_length_count = 0
        current_time = 0.0

        while patient_idx < len(patients) or not queue.is_empty() or any(w.current_patient for w in windows):
            next_events = []
            
            if patient_idx < len(patients):
                next_events.append(('arrival', patients[patient_idx].arrival_time))
            
            for w in windows:
                if w.current_patient and w.current_patient.end_service_time:
                    next_events.append(('departure', w.current_patient.end_service_time))
            
            for w in windows:
                for start, end in w.break_periods:
                    if start > current_time:
                        next_events.append(('break_start', start))
                    if end > current_time:
                        next_events.append(('break_end', end))
            
            if not next_events:
                break

            next_events.sort(key=lambda x: x[1])
            event_type, next_time = next_events[0]
            current_time = next_time

            while patient_idx < len(patients) and patients[patient_idx].arrival_time <= current_time:
                queue.add_patient(patients[patient_idx])
                patient_idx += 1

            for w in windows:
                if w.current_patient and w.current_patient.end_service_time <= current_time:
                    w.release_patient()

            max_queue_length = max(max_queue_length, queue.size())
            queue_length_sum += queue.size()
            queue_length_count += 1

            for w in windows:
                if w.is_available(current_time) and not queue.is_empty():
                    patient = strategy.select_next_patient(queue, current_time)
                    if patient:
                        queue.remove_patient(patient)
                        w.assign_patient(patient, current_time)

        served_patients = [p for p in patients if p.start_service_time is not None]
        wait_times = [p.wait_time for p in served_patients]
        total_times = [p.total_time for p in served_patients]

        utilization = []
        for w in windows:
            busy_time = sum(p.service_time for p in served_patients if p.window_id == w.id)
            utilization.append(busy_time / max(current_time, 1))

        has_extreme_wait = any(wt > 120 for wt in wait_times) if wait_times else False
        has_break_miss = len(self.config.window_breaks) != self.config.num_windows if self.config.window_breaks else False
        has_random_seed_issue = self.config.random_seed is None

        result = SimulationResult(
            config=self.config,
            patients=served_patients,
            windows=windows,
            wait_times=wait_times,
            total_times=total_times,
            max_queue_length=max_queue_length,
            avg_queue_length=queue_length_sum / max(queue_length_count, 1),
            utilization=utilization,
            simulation_time=current_time,
            has_extreme_wait=has_extreme_wait,
            has_break_miss=has_break_miss,
            has_random_seed_issue=has_random_seed_issue,
        )

        return result

    def run_monte_carlo(self, num_runs: int = 100) -> List[SimulationResult]:
        results = []
        strategy = create_strategy(self.config.strategy_name, **self.config.strategy_params)
        
        for i in range(num_runs):
            if self.config.random_seed is not None:
                self._rng = np.random.RandomState(self.config.random_seed + i)
            else:
                self._rng = np.random.RandomState()
            results.append(self.run_single(strategy))
        
        return results
