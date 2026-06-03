import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CustomerState:
    customer_id: str
    state: str
    timestamp: datetime
    student_id: Optional[str] = None
    answer_version: Optional[int] = None
    annotations: Dict = field(default_factory=dict)
    error_notes: str = ""
    source_file: Optional[str] = None


class MarkovChurnModel:
    def __init__(self, states: List[str], smoothing_factor: float = 0.01):
        self.states = states
        self.state_to_idx = {s: i for i, s in enumerate(states)}
        self.n_states = len(states)
        self.smoothing_factor = smoothing_factor
        self.transition_matrix = np.ones((self.n_states, self.n_states)) / self.n_states
        self.transition_counts = np.zeros((self.n_states, self.n_states))
        self.customers: Dict[str, List[CustomerState]] = {}
        self.student_answers: Dict[str, List[CustomerState]] = {}

    def add_customer_state(self, state: CustomerState) -> None:
        if state.customer_id not in self.customers:
            self.customers[state.customer_id] = []
        self.customers[state.customer_id].append(state)
        self.customers[state.customer_id].sort(key=lambda x: x.timestamp)

        if state.student_id:
            if state.student_id not in self.student_answers:
                self.student_answers[state.student_id] = []
            self.student_answers[state.student_id].append(state)

    def check_multiple_answers(self, student_id: str) -> Tuple[bool, List[CustomerState]]:
        if student_id not in self.student_answers:
            return False, []
        versions = {}
        for ans in self.student_answers[student_id]:
            key = (ans.customer_id, ans.answer_version)
            if key not in versions:
                versions[key] = []
            versions[key].append(ans)
        has_multiple = any(len(v) > 1 for v in versions.values())
        return has_multiple, self.student_answers[student_id]

    def get_student_versions(self, student_id: str) -> Dict[str, List[CustomerState]]:
        result = {}
        if student_id in self.student_answers:
            for ans in self.student_answers[student_id]:
                key = f"{ans.customer_id}_v{ans.answer_version}"
                if key not in result:
                    result[key] = []
                result[key].append(ans)
        return result

    def estimate_transition_matrix(self) -> np.ndarray:
        counts = np.zeros((self.n_states, self.n_states))
        
        for customer_id, states in self.customers.items():
            for i in range(len(states) - 1):
                from_state = states[i]
                to_state = states[i + 1]
                from_idx = self.state_to_idx.get(from_state.state, 0)
                to_idx = self.state_to_idx.get(to_state.state, 0)
                counts[from_idx, to_idx] += 1

        self.transition_counts = counts.copy()
        counts += self.smoothing_factor
        row_sums = counts.sum(axis=1, keepdims=True)
        self.transition_matrix = counts / row_sums
        return self.transition_matrix

    def predict_next_state(self, current_state: str, steps: int = 1) -> np.ndarray:
        if current_state not in self.state_to_idx:
            raise ValueError(f"Unknown state: {current_state}")
        
        current_idx = self.state_to_idx[current_state]
        current_vector = np.zeros(self.n_states)
        current_vector[current_idx] = 1
        
        result = current_vector @ np.linalg.matrix_power(self.transition_matrix, steps)
        return result

    def get_state_distribution(self, time_step: int = 0) -> np.ndarray:
        if time_step == 0:
            counts = np.zeros(self.n_states)
            for states in self.customers.values():
                if states:
                    latest = states[-1]
                    idx = self.state_to_idx.get(latest.state, 0)
                    counts[idx] += 1
            return counts / counts.sum() if counts.sum() > 0 else counts
        else:
            initial_dist = self.get_state_distribution(0)
            return initial_dist @ np.linalg.matrix_power(self.transition_matrix, time_step)

    def to_dataframe(self) -> pd.DataFrame:
        records = []
        for customer_id, states in self.customers.items():
            for state in states:
                records.append({
                    "customer_id": state.customer_id,
                    "state": state.state,
                    "timestamp": state.timestamp,
                    "student_id": state.student_id,
                    "answer_version": state.answer_version,
                    "error_notes": state.error_notes,
                    "source_file": state.source_file,
                    "annotations": state.annotations
                })
        return pd.DataFrame(records)
