from typing import List, Optional, Dict, Any
from collections import defaultdict

from models import RequestSample, SampleStatus, TimeoutCategory


class InMemoryStorage:
    def __init__(self):
        self.samples: Dict[str, RequestSample] = {}
        self.api_index: Dict[str, List[str]] = defaultdict(list)
        self.status_index: Dict[SampleStatus, List[str]] = defaultdict(list)
        self.timeout_index: Dict[TimeoutCategory, List[str]] = defaultdict(list)

    def save_sample(self, sample: RequestSample) -> None:
        old_sample = self.samples.get(sample.request_id)
        
        if old_sample:
            if old_sample.api_name in self.api_index:
                self.api_index[old_sample.api_name].remove(sample.request_id)
            if old_sample.status in self.status_index:
                self.status_index[old_sample.status].remove(sample.request_id)
            if old_sample.timeout_category and old_sample.timeout_category in self.timeout_index:
                self.timeout_index[old_sample.timeout_category].remove(sample.request_id)

        self.samples[sample.request_id] = sample
        self.api_index[sample.api_name].append(sample.request_id)
        self.status_index[sample.status].append(sample.request_id)
        if sample.timeout_category:
            self.timeout_index[sample.timeout_category].append(sample.request_id)

    def get_sample(self, request_id: str) -> Optional[RequestSample]:
        return self.samples.get(request_id)

    def list_samples(
        self,
        api_name: str = None,
        status: SampleStatus = None,
        timeout_type: TimeoutCategory = None
    ) -> List[RequestSample]:
        sample_ids = set(self.samples.keys())

        if api_name:
            sample_ids.intersection_update(self.api_index.get(api_name, []))
        
        if status:
            sample_ids.intersection_update(self.status_index.get(status, []))
        
        if timeout_type:
            sample_ids.intersection_update(self.timeout_index.get(timeout_type, []))

        return [self.samples[sid] for sid in sample_ids]

    def get_stats(self) -> Dict[str, Any]:
        return {
            'total_samples': len(self.samples),
            'api_count': len(self.api_index),
            'by_status': {k.value: len(v) for k, v in self.status_index.items()},
            'by_timeout_category': {k.value: len(v) for k, v in self.timeout_index.items()},
            'apis': list(self.api_index.keys())
        }
