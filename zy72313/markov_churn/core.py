import copy
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
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

    def _make_duplicate_key(self, state: CustomerState) -> Tuple:
        return (
            state.student_id or "",
            state.customer_id,
            state.answer_version or 0,
            state.state,
            state.timestamp.isoformat() if isinstance(state.timestamp, datetime) else str(state.timestamp)
        )

    def check_duplicate_state(self, state: CustomerState) -> Tuple[bool, Optional[CustomerState]]:
        if not state.student_id:
            return False, None
        key = self._make_duplicate_key(state)
        for existing in self.student_answers.get(state.student_id, []):
            if self._make_duplicate_key(existing) == key:
                return True, existing
        return False, None

    def add_customer_state(self, state: CustomerState, check_duplicate: bool = True) -> Tuple[bool, Optional[str]]:
        if check_duplicate and state.student_id:
            is_dup, existing = self.check_duplicate_state(state)
            if is_dup:
                reason = (f"同版本重复：学生{state.student_id}，"
                         f"客户{state.customer_id}，"
                         f"答案v{state.answer_version}，"
                         f"状态{state.state}，"
                         f"时间{state.timestamp} "
                         f"已存在于 {existing.source_file}")
                return False, reason

        if state.customer_id not in self.customers:
            self.customers[state.customer_id] = []
        self.customers[state.customer_id].append(state)
        self.customers[state.customer_id].sort(key=lambda x: x.timestamp)

        if state.student_id:
            if state.student_id not in self.student_answers:
                self.student_answers[state.student_id] = []
            self.student_answers[state.student_id].append(state)

        return True, None

    def check_multiple_answers(self, student_id: str) -> Tuple[bool, Dict[int, List[CustomerState]]]:
        if student_id not in self.student_answers:
            return False, {}

        version_groups: Dict[int, List[CustomerState]] = {}
        for ans in self.student_answers[student_id]:
            v = ans.answer_version or 1
            if v not in version_groups:
                version_groups[v] = []
            version_groups[v].append(ans)

        has_multiple_distinct_versions = len(version_groups) >= 2
        return has_multiple_distinct_versions, version_groups

    def get_student_versions(self, student_id: str) -> Dict[str, List[CustomerState]]:
        _, version_groups = self.check_multiple_answers(student_id)
        result: Dict[str, List[CustomerState]] = {}
        for v, states in version_groups.items():
            customer_ids = sorted(set(s.customer_id for s in states))
            for cid in customer_ids:
                key = f"{cid}_v{v}"
                result[key] = [s for s in states if s.customer_id == cid]
        return result

    def get_student_version_summary(self, student_id: str) -> Dict:
        has_multiple, version_groups = self.check_multiple_answers(student_id)
        summary = {
            "student_id": student_id,
            "has_multiple_versions": has_multiple,
            "versions": []
        }
        for v in sorted(version_groups.keys()):
            states = version_groups[v]
            summary["versions"].append({
                "answer_version": v,
                "state_count": len(states),
                "customer_ids": sorted(set(s.customer_id for s in states)),
                "source_files": sorted(set(s.source_file for s in states if s.source_file))
            })
        return summary

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

    def find_state_record(self, customer_id: str, timestamp: datetime) -> Optional[CustomerState]:
        if customer_id not in self.customers:
            return None
        for s in self.customers[customer_id]:
            if s.timestamp == timestamp:
                return s
        return None

    def update_error_notes(self, customer_id: str, timestamp: datetime,
                            new_error_notes: str, modifier: str,
                            reason: str = "") -> Dict:
        record = self.find_state_record(customer_id, timestamp)
        if not record:
            return {"status": "error", "message": f"未找到客户{customer_id}在{timestamp}的记录"}

        old_value = record.error_notes
        if old_value == new_error_notes:
            return {"status": "skipped", "message": "误差说明未发生变化",
                    "old_value": old_value, "new_value": new_error_notes}

        record.error_notes = new_error_notes
        return {
            "status": "success",
            "field": "error_notes",
            "customer_id": customer_id,
            "timestamp": timestamp.isoformat(),
            "student_id": record.student_id,
            "answer_version": record.answer_version,
            "old_value": old_value,
            "new_value": new_error_notes,
            "modifier": modifier,
            "reason": reason,
            "changed_at": datetime.now().isoformat()
        }

    def update_annotations(self, customer_id: str, timestamp: datetime,
                            new_annotations: Dict, modifier: str,
                            reason: str = "") -> Dict:
        record = self.find_state_record(customer_id, timestamp)
        if not record:
            return {"status": "error", "message": f"未找到客户{customer_id}在{timestamp}的记录"}

        old_value = copy.deepcopy(record.annotations)
        if old_value == new_annotations:
            return {"status": "skipped", "message": "备注未发生变化",
                    "old_value": old_value, "new_value": new_annotations}

        record.annotations = new_annotations
        return {
            "status": "success",
            "field": "annotations",
            "customer_id": customer_id,
            "timestamp": timestamp.isoformat(),
            "student_id": record.student_id,
            "answer_version": record.answer_version,
            "old_value": old_value,
            "new_value": new_annotations,
            "modifier": modifier,
            "reason": reason,
            "changed_at": datetime.now().isoformat()
        }

    def rollback_field_update(self, customer_id: str, timestamp: datetime,
                               field: str, old_value: Any, modifier: str,
                               reason: str = "回滚到上一版") -> Dict:
        if field == "error_notes":
            return self.update_error_notes(customer_id, timestamp, str(old_value), modifier, reason)
        elif field == "annotations":
            if isinstance(old_value, dict):
                return self.update_annotations(customer_id, timestamp, old_value, modifier, reason)
            return {"status": "error", "message": "annotations旧值类型必须是dict"}
        else:
            return {"status": "error", "message": f"不支持回滚字段: {field}"}

    def to_dict(self) -> Dict:
        return {
            "states": self.states,
            "smoothing_factor": self.smoothing_factor,
            "customers": [
                {
                    "customer_id": s.customer_id,
                    "state": s.state,
                    "timestamp": s.timestamp.isoformat(),
                    "student_id": s.student_id,
                    "answer_version": s.answer_version,
                    "error_notes": s.error_notes,
                    "source_file": s.source_file,
                    "annotations": s.annotations
                }
                for states in self.customers.values() for s in states
            ]
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "MarkovChurnModel":
        obj = cls(
            states=data["states"],
            smoothing_factor=data.get("smoothing_factor", 0.01)
        )
        for rec in data.get("customers", []):
            s = CustomerState(
                customer_id=rec["customer_id"],
                state=rec["state"],
                timestamp=pd.to_datetime(rec["timestamp"]).to_pydatetime(),
                student_id=rec.get("student_id"),
                answer_version=rec.get("answer_version"),
                error_notes=rec.get("error_notes", ""),
                source_file=rec.get("source_file"),
                annotations=rec.get("annotations", {}) or {}
            )
            obj.add_customer_state(s, check_duplicate=False)
        return obj

    def save(self, file_path: str) -> None:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, file_path: str) -> "MarkovChurnModel":
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)

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
