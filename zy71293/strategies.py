from abc import ABC, abstractmethod
from typing import List, Optional
from models import Patient, PatientQueue, PatientPriority


class SchedulingStrategy(ABC):
    @abstractmethod
    def select_next_patient(self, queue: PatientQueue, current_time: float) -> Optional[Patient]:
        pass

    @abstractmethod
    def get_name(self) -> str:
        pass

    @abstractmethod
    def get_description(self) -> str:
        pass


class FCFSStrategy(SchedulingStrategy):
    def get_name(self) -> str:
        return "FCFS"

    def get_description(self) -> str:
        return "先来先服务 (First Come First Served) - 按到达顺序叫号"

    def select_next_patient(self, queue: PatientQueue, current_time: float) -> Optional[Patient]:
        patients = queue.get_all_patients()
        if not patients:
            return None
        patients.sort(key=lambda p: p.arrival_time)
        return patients[0]


class PriorityStrategy(SchedulingStrategy):
    def get_name(self) -> str:
        return "Priority"

    def get_description(self) -> str:
        return "优先级策略 - 急诊 > 优先 > 普通，同级别内按到达顺序"

    def select_next_patient(self, queue: PatientQueue, current_time: float) -> Optional[Patient]:
        patients = queue.get_all_patients()
        if not patients:
            return None
        patients.sort(key=lambda p: (-p.priority.value, p.arrival_time))
        return patients[0]


class BatchStrategy(SchedulingStrategy):
    def __init__(self, batch_size: int = 5):
        self.batch_size = batch_size
        self.current_batch: List[Patient] = []

    def get_name(self) -> str:
        return f"Batch({self.batch_size})"

    def get_description(self) -> str:
        return f"批量叫号 - 每批叫{self.batch_size}人，减少空窗时间"

    def select_next_patient(self, queue: PatientQueue, current_time: float) -> Optional[Patient]:
        if not self.current_batch:
            patients = queue.get_all_patients()
            if not patients:
                return None
            patients.sort(key=lambda p: p.arrival_time)
            self.current_batch = patients[:self.batch_size]
        
        if self.current_batch:
            return self.current_batch.pop(0)
        return None


class WaitTimePriorityStrategy(SchedulingStrategy):
    def __init__(self, threshold: float = 30.0):
        self.threshold = threshold

    def get_name(self) -> str:
        return f"WaitTimePriority({self.threshold})"

    def get_description(self) -> str:
        return f"等待时间优先 - 等待超过{self.threshold}分钟的患者优先"

    def select_next_patient(self, queue: PatientQueue, current_time: float) -> Optional[Patient]:
        patients = queue.get_all_patients()
        if not patients:
            return None
        
        def sort_key(p: Patient):
            wait_time = current_time - p.arrival_time
            if wait_time >= self.threshold:
                return (0, -wait_time, p.arrival_time)
            return (1, -p.priority.value, p.arrival_time)
        
        patients.sort(key=sort_key)
        return patients[0]


class MultiLevelFeedbackStrategy(SchedulingStrategy):
    def __init__(self, time_quantum: float = 10.0):
        self.time_quantum = time_quantum

    def get_name(self) -> str:
        return f"MLFQ({self.time_quantum})"

    def get_description(self) -> str:
        return f"多级反馈队列 - 短服务时间患者优先"

    def select_next_patient(self, queue: PatientQueue, current_time: float) -> Optional[Patient]:
        patients = queue.get_all_patients()
        if not patients:
            return None
        
        def queue_level(p: Patient):
            if p.service_time <= self.time_quantum:
                return 0
            elif p.service_time <= self.time_quantum * 2:
                return 1
            return 2
        
        patients.sort(key=lambda p: (queue_level(p), p.arrival_time))
        return patients[0]


STRATEGY_CLASSES = {
    'FCFS': FCFSStrategy,
    'Priority': PriorityStrategy,
    'Batch': BatchStrategy,
    'WaitTimePriority': WaitTimePriorityStrategy,
    'MLFQ': MultiLevelFeedbackStrategy,
}


def create_strategy(strategy_name: str, **kwargs) -> SchedulingStrategy:
    if strategy_name not in STRATEGY_CLASSES:
        raise ValueError(f"未知策略: {strategy_name}, 可用策略: {list(STRATEGY_CLASSES.keys())}")
    return STRATEGY_CLASSES[strategy_name](**kwargs)
