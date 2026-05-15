import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from .models import InspectionSample, InspectionResult, BatchInfo


class DataStorage:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.samples_dir = data_dir / "samples"
        self.results_dir = data_dir / "results"
        self.batches_dir = data_dir / "batches"
        self.exports_dir = data_dir / "exports"

        for d in [self.samples_dir, self.results_dir, self.batches_dir, self.exports_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def _generate_sample_hash(self, ip_address: str, port: int, supplier: str) -> str:
        key = f"{ip_address}:{port}:{supplier}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def save_sample(self, sample: InspectionSample):
        sample_file = self.samples_dir / f"{sample.sample_id}.json"
        with open(sample_file, 'w', encoding='utf-8') as f:
            json.dump(sample.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def get_sample(self, sample_id: str) -> Optional[InspectionSample]:
        sample_file = self.samples_dir / f"{sample_id}.json"
        if not sample_file.exists():
            return None
        with open(sample_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return InspectionSample(**data)

    def find_existing_sample(self, ip_address: str, port: int, supplier: str) -> Optional[InspectionSample]:
        for sample_file in self.samples_dir.glob("*.json"):
            with open(sample_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if (data['ip_address'] == ip_address and
                data['port'] == port and
                data['supplier'] == supplier):
                return InspectionSample(**data)
        return None

    def save_result(self, result: InspectionResult):
        result_file = self.results_dir / f"{result.sample_id}.json"
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def get_result(self, sample_id: str) -> Optional[InspectionResult]:
        result_file = self.results_dir / f"{sample_id}.json"
        if not result_file.exists():
            return None
        with open(result_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return InspectionResult(**data)

    def get_results_by_batch(self, batch_id: str) -> List[InspectionResult]:
        results = []
        for result_file in self.results_dir.glob("*.json"):
            with open(result_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data['batch_id'] == batch_id:
                results.append(InspectionResult(**data))
        return results

    def save_batch(self, batch: BatchInfo):
        batch_file = self.batches_dir / f"{batch.batch_id}.json"
        with open(batch_file, 'w', encoding='utf-8') as f:
            json.dump(batch.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def get_batch(self, batch_id: str) -> Optional[BatchInfo]:
        batch_file = self.batches_dir / f"{batch_id}.json"
        if not batch_file.exists():
            return None
        with open(batch_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return BatchInfo(**data)

    def list_batches(self) -> List[BatchInfo]:
        batches = []
        for batch_file in sorted(self.batches_dir.glob("*.json")):
            with open(batch_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            batches.append(BatchInfo(**data))
        return batches

    def get_anomalies_by_risk(self, risk_level: str) -> List[InspectionResult]:
        anomalies = []
        for result_file in self.results_dir.glob("*.json"):
            with open(result_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data['is_anomaly'] and data['risk_level'] == risk_level:
                anomalies.append(InspectionResult(**data))
        return anomalies
