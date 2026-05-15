from typing import List, Dict, Any
from collections import defaultdict
from datetime import datetime

from models import (
    RequestSample, DownstreamSegment, TimeBucket, TimeoutType,
    TimeoutCategory, SampleStatus
)


class TimeoutProfiler:
    def __init__(self, storage):
        self.storage = storage
        self.time_buckets = [
            TimeBucket('ultra_fast', 0, 50),
            TimeBucket('fast', 50, 200),
            TimeBucket('normal', 200, 500),
            TimeBucket('slow', 500, 1000),
            TimeBucket('very_slow', 1000, 3000),
            TimeBucket('extreme', 3000, 10000),
            TimeBucket('timeout', 10000, float('inf'))
        ]
        self.timeout_thresholds = {
            TimeoutCategory.NORMAL: 200,
            TimeoutCategory.WARNING: 500,
            TimeoutCategory.SEVERE: 1000,
            TimeoutCategory.CRITICAL: 3000,
            TimeoutCategory.TIMEOUT: 10000
        }

    def analyze_sample(self, sample: RequestSample) -> Dict[str, Any]:
        total_duration = sample.total_time_ms
        
        sample.timeout_category = self._categorize_timeout(total_duration)
        
        if sample.segments:
            slowest = max(sample.segments, key=lambda s: s.duration_ms)
            sample.slowest_segment = slowest.name
            
            for segment in sample.segments:
                segment.timeout_bucket = self._get_bucket_name(segment.duration_ms)
        
        sample.status = SampleStatus.ANALYZED
        
        return {
            'timeout_category': sample.timeout_category.value,
            'slowest_segment': sample.slowest_segment,
            'segment_count': len(sample.segments),
            'total_duration_ms': total_duration
        }

    def _categorize_timeout(self, duration_ms: int) -> TimeoutCategory:
        if duration_ms >= self.timeout_thresholds[TimeoutCategory.TIMEOUT]:
            return TimeoutCategory.TIMEOUT
        elif duration_ms >= self.timeout_thresholds[TimeoutCategory.CRITICAL]:
            return TimeoutCategory.CRITICAL
        elif duration_ms >= self.timeout_thresholds[TimeoutCategory.SEVERE]:
            return TimeoutCategory.SEVERE
        elif duration_ms >= self.timeout_thresholds[TimeoutCategory.WARNING]:
            return TimeoutCategory.WARNING
        else:
            return TimeoutCategory.NORMAL

    def _get_bucket_name(self, duration_ms: int) -> str:
        for bucket in self.time_buckets:
            if bucket.min_ms <= duration_ms < bucket.max_ms:
                return bucket.bucket_name
        return 'timeout'

    def generate_profile(self, samples: List[RequestSample], api_name: str = None) -> Dict[str, Any]:
        if not samples:
            return {}

        timeout_distribution = defaultdict(int)
        segment_stats = defaultdict(lambda: {'count': 0, 'total_time': 0, 'max_time': 0})
        status_summary = defaultdict(int)
        bucket_distribution = defaultdict(int)

        for sample in samples:
            if sample.timeout_category:
                timeout_distribution[sample.timeout_category.value] += 1
            
            status_summary[sample.status.value] += 1

            for segment in sample.segments:
                stats = segment_stats[segment.name]
                stats['count'] += 1
                stats['total_time'] += segment.duration_ms
                if segment.duration_ms > stats['max_time']:
                    stats['max_time'] = segment.duration_ms
                
                if segment.timeout_bucket:
                    bucket_distribution[segment.timeout_bucket] += 1

        for seg_name, stats in segment_stats.items():
            stats['avg_time'] = round(stats['total_time'] / stats['count'], 2)

        segment_list = [
            {
                'name': name,
                **stats
            }
            for name, stats in segment_stats.items()
        ]
        segment_list.sort(key=lambda x: x['avg_time'], reverse=True)

        total_samples = len(samples)
        avg_duration = sum(s.total_time_ms for s in samples) / total_samples if total_samples > 0 else 0

        return {
            'api_name': api_name or 'all_apis',
            'generated_at': datetime.now().isoformat(),
            'total_samples': total_samples,
            'average_duration_ms': round(avg_duration, 2),
            'max_duration_ms': max(s.total_time_ms for s in samples),
            'min_duration_ms': min(s.total_time_ms for s in samples),
            'timeout_distribution': dict(timeout_distribution),
            'segment_stats': segment_list,
            'bucket_distribution': dict(bucket_distribution),
            'status_summary': dict(status_summary),
            'timeout_thresholds': {k.value: v for k, v in self.timeout_thresholds.items()}
        }
