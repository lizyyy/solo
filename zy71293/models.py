from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
import numpy as np


class PatientPriority(Enum):
    NORMAL = 1
    PRIORITY = 2
    EMERGENCY = 3


@dataclass
class Patient:
    id: int
    arrival_time: float
    service_time: float
    priority: PatientPriority = PatientPriority.NORMAL
    start_service_time: Optional[float] = None
    end_service_time: Optional[float] = None
    window_id: Optional[int] = None
    notes: Dict[str, Any] = field(default_factory=dict)

    @property
    def wait_time(self) -> float:
        if self.start_service_time is None:
            return float('inf')
        return self.start_service_time - self.arrival_time

    @property
    def total_time(self) -> float:
        if self.end_service_time is None:
            return float('inf')
        return self.end_service_time - self.arrival_time


@dataclass
class Window:
    id: int
    is_open: bool = True
    break_periods: List[tuple] = field(default_factory=list)
    current_patient: Optional[Patient] = None
    available_time: float = 0.0
    patients_served: int = 0

    def is_available(self, current_time: float) -> bool:
        if not self.is_open:
            return False
        for start, end in self.break_periods:
            if start <= current_time < end:
                return False
        return self.current_patient is None and current_time >= self.available_time

    def assign_patient(self, patient: Patient, current_time: float):
        self.current_patient = patient
        patient.start_service_time = current_time
        patient.end_service_time = current_time + patient.service_time
        patient.window_id = self.id
        self.available_time = patient.end_service_time
        self.patients_served += 1

    def release_patient(self) -> Optional[Patient]:
        patient = self.current_patient
        self.current_patient = None
        return patient


class PatientQueue:
    def __init__(self):
        self._queue: List[Patient] = []

    def add_patient(self, patient: Patient):
        self._queue.append(patient)

    def size(self) -> int:
        return len(self._queue)

    def is_empty(self) -> bool:
        return len(self._queue) == 0

    def get_all_patients(self) -> List[Patient]:
        return self._queue.copy()

    def remove_patient(self, patient: Patient):
        if patient in self._queue:
            self._queue.remove(patient)
