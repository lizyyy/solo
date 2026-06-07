import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from .models import (
    FeatureSnapshot, TrainingLogCurve, TrainingLogPoint,
    AnomalySample, ExperimentRun, ReviewRecord, RecordStatus
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, RecordStatus):
            return obj.value
        return super().default(obj)


def datetime_decoder(dct):
    for key, value in dct.items():
        if isinstance(value, str) and key in ['created_at', 'data_range_start', 'data_range_end',
                                               'timestamp', 'detected_at', 'corrected_at',
                                               'start_time', 'end_time']:
            try:
                dct[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
    return dct


class DataStore:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = base_dir
        self.snapshots_dir = os.path.join(base_dir, "snapshots")
        self.logs_dir = os.path.join(base_dir, "logs")
        self.anomalies_dir = os.path.join(base_dir, "anomalies")
        self.runs_dir = os.path.join(base_dir, "runs")
        self.reviews_dir = os.path.join(base_dir, "reviews")
        
        for d in [self.snapshots_dir, self.logs_dir, self.anomalies_dir,
                  self.runs_dir, self.reviews_dir]:
            os.makedirs(d, exist_ok=True)

    def save_snapshot(self, snapshot: FeatureSnapshot):
        path = os.path.join(self.snapshots_dir, f"{snapshot.snapshot_id}.json")
        with open(path, 'w') as f:
            json.dump(snapshot.__dict__, f, cls=DateTimeEncoder, indent=2)

    def load_snapshot(self, snapshot_id: str) -> Optional[FeatureSnapshot]:
        path = os.path.join(self.snapshots_dir, f"{snapshot_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, 'r') as f:
            data = json.load(f, object_hook=datetime_decoder)
        return FeatureSnapshot(**data)

    def list_snapshots(self) -> List[str]:
        return [f.replace('.json', '') for f in os.listdir(self.snapshots_dir) if f.endswith('.json')]

    def save_log(self, log: TrainingLogCurve):
        path = os.path.join(self.logs_dir, f"{log.log_id}.json")
        data = {
            "log_id": log.log_id,
            "experiment_name": log.experiment_name,
            "data_source": log.data_source,
            "points": [p.__dict__ for p in log.points]
        }
        with open(path, 'w') as f:
            json.dump(data, f, cls=DateTimeEncoder, indent=2)

    def load_log(self, log_id: str) -> Optional[TrainingLogCurve]:
        path = os.path.join(self.logs_dir, f"{log_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, 'r') as f:
            data = json.load(f, object_hook=datetime_decoder)
        points = [TrainingLogPoint(**p) for p in data.pop("points", [])]
        log = TrainingLogCurve(**data)
        log.points = points
        return log

    def list_logs(self) -> List[str]:
        return [f.replace('.json', '') for f in os.listdir(self.logs_dir) if f.endswith('.json')]

    def save_anomaly(self, anomaly: AnomalySample):
        path = os.path.join(self.anomalies_dir, f"{anomaly.sample_id}.json")
        with open(path, 'w') as f:
            json.dump(anomaly.__dict__, f, cls=DateTimeEncoder, indent=2)

    def load_anomaly(self, sample_id: str) -> Optional[AnomalySample]:
        path = os.path.join(self.anomalies_dir, f"{sample_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, 'r') as f:
            data = json.load(f, object_hook=datetime_decoder)
        data['status'] = RecordStatus(data['status'])
        return AnomalySample(**data)

    def list_anomalies(self) -> List[str]:
        return [f.replace('.json', '') for f in os.listdir(self.anomalies_dir) if f.endswith('.json')]

    def save_run(self, run: ExperimentRun):
        path = os.path.join(self.runs_dir, f"{run.run_id}.json")
        with open(path, 'w') as f:
            json.dump(run.__dict__, f, cls=DateTimeEncoder, indent=2)

    def load_run(self, run_id: str) -> Optional[ExperimentRun]:
        path = os.path.join(self.runs_dir, f"{run_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, 'r') as f:
            data = json.load(f, object_hook=datetime_decoder)
        return ExperimentRun(**data)

    def list_runs(self) -> List[str]:
        return [f.replace('.json', '') for f in os.listdir(self.runs_dir) if f.endswith('.json')]

    def save_review(self, review: ReviewRecord):
        path = os.path.join(self.reviews_dir, f"{review.record_id}.json")
        with open(path, 'w') as f:
            json.dump(review.__dict__, f, cls=DateTimeEncoder, indent=2)

    def load_review(self, record_id: str) -> Optional[ReviewRecord]:
        path = os.path.join(self.reviews_dir, f"{record_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, 'r') as f:
            data = json.load(f, object_hook=datetime_decoder)
        return ReviewRecord(**data)
