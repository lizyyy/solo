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
        request_id = sample.request_id
        
        if request_id in self.samples:
            self._remove_from_all_indexes(request_id)

        self.samples[request_id] = sample
        self.api_index[sample.api_name].append(request_id)
        self.status_index[sample.status].append(request_id)
        if sample.timeout_category:
            self.timeout_index[sample.timeout_category].append(request_id)
    
    def _remove_from_all_indexes(self, request_id: str) -> None:
        for key in list(self.api_index.keys()):
            self._safe_remove_from_index(self.api_index, key, request_id)
        
        for key in list(self.status_index.keys()):
            self._safe_remove_from_index(self.status_index, key, request_id)
        
        for key in list(self.timeout_index.keys()):
            self._safe_remove_from_index(self.timeout_index, key, request_id)
    
    def _safe_remove_from_index(self, index: dict, key, value: str) -> None:
        if key in index and value in index[key]:
            index[key].remove(value)
            if len(index[key]) == 0:
                del index[key]

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
