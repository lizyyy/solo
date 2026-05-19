import json
import os
from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path
from core.models import Sample, RunResult, FixRecord, FreshnessReport


class StorageManager:
    def __init__(self, base_path: str = None):
        if base_path is None:
            base_path = os.path.join(os.path.dirname(__file__), '..', 'data')
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.samples_path = self.base_path / 'samples.json'
        self.run_results_path = self.base_path / 'run_results.json'
        self.fix_records_path = self.base_path / 'fix_records.json'
        self._init_files()

    def _init_files(self):
        for path in [self.samples_path, self.run_results_path, self.fix_records_path]:
            if not path.exists():
                with open(path, 'w', encoding='utf-8') as f:
                    json.dump([], f)

    def _load_json(self, path: Path) -> List[Dict]:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_json(self, path: Path, data: List[Dict]):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def save_sample(self, sample: Sample) -> None:
        samples = self._load_json(self.samples_path)
        sample_dict = sample.model_dump(mode='json')
        existing = next((i for i, s in enumerate(samples) if s['sample_id'] == sample.sample_id), None)
        if existing is not None:
            samples[existing] = sample_dict
        else:
            samples.append(sample_dict)
        self._save_json(self.samples_path, samples)

    def get_sample(self, sample_id: str) -> Optional[Sample]:
        samples = self._load_json(self.samples_path)
        for s in samples:
            if s['sample_id'] == sample_id:
                return Sample.model_validate(s)
        return None

    def list_samples(self, language: str = None, status: str = None) -> List[Sample]:
        samples = self._load_json(self.samples_path)
        result = []
        for s in samples:
            sample = Sample.model_validate(s)
            if language and sample.language != language:
                continue
            if status and sample.status != status:
                continue
            result.append(sample)
        return result

    def delete_sample(self, sample_id: str) -> bool:
        samples = self._load_json(self.samples_path)
        filtered = [s for s in samples if s['sample_id'] != sample_id]
        if len(filtered) == len(samples):
            return False
        self._save_json(self.samples_path, filtered)
        return True

    def save_run_result(self, result: RunResult) -> None:
        results = self._load_json(self.run_results_path)
        result_dict = result.model_dump(mode='json')
        results.append(result_dict)
        self._save_json(self.run_results_path, results)

    def get_run_results(self, sample_id: str = None, limit: int = None) -> List[RunResult]:
        results = self._load_json(self.run_results_path)
        filtered = []
        for r in results:
            if sample_id and r['sample_id'] != sample_id:
                continue
            filtered.append(RunResult.model_validate(r))
        filtered.sort(key=lambda x: x.ran_at, reverse=True)
        if limit:
            filtered = filtered[:limit]
        return filtered

    def get_latest_run_result(self, sample_id: str) -> Optional[RunResult]:
        results = self.get_run_results(sample_id=sample_id, limit=1)
        return results[0] if results else None

    def save_fix_record(self, record: FixRecord) -> None:
        records = self._load_json(self.fix_records_path)
        record_dict = record.model_dump(mode='json')
        records.append(record_dict)
        self._save_json(self.fix_records_path, records)

    def get_fix_records(self, sample_id: str = None) -> List[FixRecord]:
        records = self._load_json(self.fix_records_path)
        filtered = []
        for r in records:
            if sample_id and r['sample_id'] != sample_id:
                continue
            filtered.append(FixRecord.model_validate(r))
        return filtered

    def save_report(self, report: FreshnessReport, path: str = None) -> str:
        if path is None:
            reports_dir = self.base_path / '..' / 'reports'
            reports_dir = Path(reports_dir).resolve()
            reports_dir.mkdir(parents=True, exist_ok=True)
            path = str(reports_dir / f"report_{report.report_id}.json")
        report_dict = report.model_dump(mode='json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, default=str)
        return path
