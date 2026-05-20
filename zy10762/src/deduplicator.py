import json
import hashlib
from typing import List, Dict, Any, Tuple, Set
from collections import defaultdict
from difflib import SequenceMatcher
from datetime import datetime

from .config import Config


class LiveAlertDeduplicator:
    def __init__(self, config: Config):
        self.config = config
        self.stats = {
            'total_input': 0,
            'total_output': 0,
            'overlap_merged': 0,
            'model_duplicates_removed': 0,
            'false_positives_recovered': 0
        }

    def _get_field(self, alert: Dict[str, Any], field_name: str) -> Any:
        mapped_field = self.config.get_field(field_name)
        return alert.get(mapped_field)

    def _calculate_content_similarity(self, text1: str, text2: str) -> float:
        if not text1 or not text2:
            return 0.0
        return SequenceMatcher(None, text1, text2).ratio()

    def _check_time_overlap(self, alert1: Dict[str, Any], alert2: Dict[str, Any]) -> Tuple[bool, int]:
        start1 = self._get_field(alert1, 'start_time')
        end1 = self._get_field(alert1, 'end_time')
        start2 = self._get_field(alert2, 'start_time')
        end2 = self._get_field(alert2, 'end_time')

        if start1 is None or end1 is None or start2 is None or end2 is None:
            return False, 0

        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)
        overlap_duration = max(0, overlap_end - overlap_start)

        return (overlap_duration >= self.config.time_overlap_threshold, overlap_duration)

    def _check_content_similarity(self, alert1: Dict[str, Any], alert2: Dict[str, Any]) -> Tuple[bool, float]:
        content1 = self._get_field(alert1, 'content_summary') or ''
        content2 = self._get_field(alert2, 'content_summary') or ''

        similarity = self._calculate_content_similarity(content1, content2)
        return (similarity >= self.config.content_similarity_threshold, similarity)

    def _check_model_duplicate(self, alert1: Dict[str, Any], alert2: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        model1 = self._get_field(alert1, 'model_name')
        model2 = self._get_field(alert2, 'model_name')
        if model1 != model2:
            return False, {}

        stream1 = self._get_field(alert1, 'stream_id')
        stream2 = self._get_field(alert2, 'stream_id')
        if stream1 != stream2:
            return False, {}

        violation1 = self._get_field(alert1, 'violation_type')
        violation2 = self._get_field(alert2, 'violation_type')
        if violation1 != violation2:
            return False, {}

        start1 = self._get_field(alert1, 'start_time')
        start2 = self._get_field(alert2, 'start_time')
        if abs(start1 - start2) > self.config.model_time_window:
            return False, {}

        conf1 = self._get_field(alert1, 'confidence') or 0
        conf2 = self._get_field(alert2, 'confidence') or 0
        if abs(conf1 - conf2) > self.config.confidence_diff_threshold:
            return False, {}

        return True, {
            'time_diff': abs(start1 - start2),
            'confidence_diff': abs(conf1 - conf2)
        }

    def _merge_alerts(self, alerts: List[Dict[str, Any]], merge_type: str) -> Dict[str, Any]:
        if not alerts:
            return {}

        if self.config.merge_strategy == 'keep_first':
            base_alert = alerts[0]
        elif self.config.merge_strategy == 'keep_longest':
            base_alert = max(alerts, key=lambda a: (
                (self._get_field(a, 'end_time') or 0) - (self._get_field(a, 'start_time') or 0)
            ))
        else:
            base_alert = max(alerts, key=lambda a: self._get_field(a, 'confidence') or 0)

        merged = dict(base_alert)

        if self.config.preserve_evidence_chain:
            evidence_chain = []
            for alert in alerts:
                evidence = {
                    'alert_id': self._get_field(alert, 'alert_id'),
                    'model_name': self._get_field(alert, 'model_name'),
                    'start_time': self._get_field(alert, 'start_time'),
                    'end_time': self._get_field(alert, 'end_time'),
                    'confidence': self._get_field(alert, 'confidence'),
                    'evidence_url': self._get_field(alert, 'evidence_url')
                }
                evidence_chain.append(evidence)
            merged['evidence_chain'] = evidence_chain

        if self.config.include_source_info:
            merged['deduplication_info'] = {
                'merge_type': merge_type,
                'merged_count': len(alerts),
                'merged_alert_ids': [self._get_field(a, 'alert_id') for a in alerts],
                'merge_timestamp': datetime.now().isoformat()
            }

        merged['start_time'] = min(self._get_field(a, 'start_time') for a in alerts)
        merged['end_time'] = max(self._get_field(a, 'end_time') for a in alerts)

        return merged

    def _handle_false_positives(self, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not self.config.fp_recovery_enabled:
            return alerts

        result = []
        for alert in alerts:
            fp_field = self.config.fp_marker_field
            if alert.get(fp_field, False):
                if self.config.keep_fp_with_marker:
                    alert_with_marker = dict(alert)
                    alert_with_marker['deduplication_info'] = {
                        'status': 'false_positive_recovered',
                        'recovered_at': datetime.now().isoformat()
                    }
                    result.append(alert_with_marker)
                    self.stats['false_positives_recovered'] += 1
            else:
                result.append(alert)
        return result

    def deduplicate(self, alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
        self.stats = {
            'total_input': len(alerts),
            'total_output': 0,
            'overlap_merged': 0,
            'model_duplicates_removed': 0,
            'false_positives_recovered': 0
        }

        alerts = self._handle_false_positives(alerts)

        groups = defaultdict(list)
        for alert in alerts:
            stream_id = self._get_field(alert, 'stream_id')
            violation_type = self._get_field(alert, 'violation_type')
            key = (stream_id, violation_type)
            groups[key].append(alert)

        result_alerts = []

        for key, group_alerts in groups.items():
            processed = set()
            current_group = group_alerts[:]

            if self.config.model_duplicate_enabled:
                to_remove = set()
                for i, alert1 in enumerate(current_group):
                    if i in to_remove:
                        continue
                    for j, alert2 in enumerate(current_group):
                        if i >= j or j in to_remove:
                            continue
                        is_dup, info = self._check_model_duplicate(alert1, alert2)
                        if is_dup:
                            to_remove.add(j)
                            self.stats['model_duplicates_removed'] += 1

                current_group = [a for i, a in enumerate(current_group) if i not in to_remove]

            if self.config.overlap_enabled:
                overlap_groups = []
                used = set()

                for i, alert1 in enumerate(current_group):
                    if i in used:
                        continue
                    overlap_group = [alert1]
                    used.add(i)

                    for j, alert2 in enumerate(current_group):
                        if j in used:
                            continue
                        time_overlap, _ = self._check_time_overlap(alert1, alert2)
                        content_similar, _ = self._check_content_similarity(alert1, alert2)
                        if time_overlap and content_similar:
                            overlap_group.append(alert2)
                            used.add(j)

                    if len(overlap_group) > 1:
                        self.stats['overlap_merged'] += len(overlap_group) - 1
                        merged = self._merge_alerts(overlap_group, 'overlap_merge')
                        result_alerts.append(merged)
                    else:
                        result_alerts.append(alert1)
            else:
                result_alerts.extend(current_group)

        self.stats['total_output'] = len(result_alerts)

        return {
            'alerts': result_alerts,
            'statistics': self.stats,
            'deduplication_version': '1.0.0',
            'config_used': {
                'overlap_enabled': self.config.overlap_enabled,
                'model_duplicate_enabled': self.config.model_duplicate_enabled,
                'fp_recovery_enabled': self.config.fp_recovery_enabled,
                'merge_strategy': self.config.merge_strategy
            }
        }
