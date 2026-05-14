from typing import Dict, List, Optional
from models import Experiment, ExperimentStatus
from datetime import datetime
import json
import os


class Database:
    def __init__(self):
        self.experiments: Dict[str, Experiment] = {}
        self._load_demo_data()

    def _load_demo_data(self):
        from dirty_data import generate_dirty_experiments
        for exp in generate_dirty_experiments():
            self.experiments[exp.id] = exp

    def get_experiment(self, exp_id: str) -> Optional[Experiment]:
        return self.experiments.get(exp_id)

    def get_all_experiments(self) -> List[Experiment]:
        return list(self.experiments.values())

    def create_experiment(self, experiment: Experiment) -> Experiment:
        self.experiments[experiment.id] = experiment
        return experiment

    def update_experiment(self, exp_id: str, update_data: dict) -> Optional[Experiment]:
        if exp_id not in self.experiments:
            return None
        exp = self.experiments[exp_id]
        for key, value in update_data.items():
            if value is not None:
                setattr(exp, key, value)
        exp.updated_at = datetime.now()
        return exp

    def delete_experiment(self, exp_id: str) -> bool:
        if exp_id in self.experiments:
            del self.experiments[exp_id]
            return True
        return False

    def save(self):
        pass


db = Database()
