import os
import json
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from .models import (
    EvaluationRecord, VerificationStatus, ChangeType,
    ConfidenceLevel
)


class StratificationRule:
    def __init__(self, name: str, criteria: Dict):
        self.name = name
        self.criteria = criteria

    def matches(self, record: EvaluationRecord) -> bool:
        if 'city' in self.criteria:
            if record.city not in self.criteria['city']:
                return False
        if 'district' in self.criteria:
            if record.district not in self.criteria['district']:
                return False
        if 'change_type' in self.criteria:
            if record.change_type not in self.criteria['change_type']:
                return False
        if 'confidence' in self.criteria:
            if record.confidence not in self.criteria['confidence']:
                return False
        if 'verify_status' in self.criteria:
            if record.verify_status not in self.criteria['verify_status']:
                return False
        return True


class EvaluationEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.stratification_rules: List[StratificationRule] = self._load_stratification_rules()

    def _load_stratification_rules(self) -> List[StratificationRule]:
        rules = []
        rules_file = os.path.join(self.data_dir, "stratification_rules.json")

        if os.path.exists(rules_file):
            with open(rules_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for rule_data in data:
                    criteria = {}
                    if 'city' in rule_data:
                        criteria['city'] = rule_data['city']
                    if 'district' in rule_data:
                        criteria['district'] = rule_data['district']
                    if 'change_type' in rule_data:
                        criteria['change_type'] = [ChangeType(ct) for ct in rule_data['change_type']]
                    if 'confidence' in rule_data:
                        criteria['confidence'] = [ConfidenceLevel(c) for c in rule_data['confidence']]
                    if 'verify_status' in rule_data:
                        criteria['verify_status'] = [VerificationStatus(vs) for vs in rule_data['verify_status']]
                    rules.append(StratificationRule(rule_data['name'], criteria))
        else:
            rules = self._get_default_rules()

        return rules

    def _get_default_rules(self) -> List[StratificationRule]:
        return [
            StratificationRule("高置信度通过", {
                'confidence': [ConfidenceLevel.HIGH],
                'verify_status': [VerificationStatus.PASSED]
            }),
            StratificationRule("需人工确认", {
                'verify_status': [VerificationStatus.NEED_MANUAL_CHECK]
            }),
            StratificationRule("旧口径记录", {
                'verify_status': [VerificationStatus.OLD_CALIBER]
            }),
            StratificationRule("边界记录", {
                'verify_status': [VerificationStatus.BORDERLINE]
            }),
            StratificationRule("数据缺失", {
                'verify_status': [VerificationStatus.MISSING_DATA]
            }),
            StratificationRule("重复记录", {
                'verify_status': [VerificationStatus.DUPLICATE]
            }),
        ]

    def stratify_records(self, records: List[EvaluationRecord]) -> Dict[str, List[EvaluationRecord]]:
        stratified: Dict[str, List[EvaluationRecord]] = defaultdict(list)
        stratified['全部记录'] = records.copy()

        for record in records:
            matched = False
            for rule in self.stratification_rules:
                if rule.matches(record):
                    stratified[rule.name].append(record)
                    matched = True
            if not matched:
                stratified['其他'].append(record)

        return dict(stratified)

    def detect_duplicates(self, records: List[EvaluationRecord]) -> Tuple[List[EvaluationRecord], List[str]]:
        seen: Dict[Tuple, List[str]] = {}
        duplicate_ids = []

        for record in records:
            key = (record.city, record.district, record.grid_id, record.change_type.value)

            if key in seen:
                record.is_duplicate = True
                record.duplicate_of = seen[key][0]
                record.verify_status = VerificationStatus.DUPLICATE
                duplicate_ids.append(record.record_id)

                for other_id in seen[key]:
                    for other in records:
                        if other.record_id == other_id and not other.is_duplicate:
                            other.is_duplicate = True
                            other.duplicate_of = seen[key][0]
                            other.verify_status = VerificationStatus.DUPLICATE
                            if other_id not in duplicate_ids:
                                duplicate_ids.append(other_id)

                seen[key].append(record.record_id)
            else:
                seen[key] = [record.record_id]

        return records, duplicate_ids

    def detect_missing_data(self, records: List[EvaluationRecord]) -> Tuple[List[EvaluationRecord], List[str]]:
        missing_ids = []

        for record in records:
            if not record.city or record.city == '未知城市':
                record.verify_status = VerificationStatus.MISSING_DATA
                record.missing_reference_note = "城市信息缺失"
                missing_ids.append(record.record_id)
            elif not record.grid_id:
                record.verify_status = VerificationStatus.MISSING_DATA
                record.missing_reference_note = "网格ID缺失"
                missing_ids.append(record.record_id)
            elif record.change_type == ChangeType.UNKNOWN:
                record.verify_status = VerificationStatus.MISSING_DATA
                record.missing_reference_note = "变化类型未判定"
                missing_ids.append(record.record_id)

        return records, missing_ids

    def detect_borderline(self, records: List[EvaluationRecord], threshold: float = 0.55) -> Tuple[List[EvaluationRecord], List[str]]:
        borderline_ids = []

        for record in records:
            raw_confidence = record.raw_data.get('confidence_score', 0)
            if isinstance(raw_confidence, (int, float)):
                if 0.55 <= raw_confidence <= 0.65:
                    if record.verify_status not in [VerificationStatus.OLD_CALIBER, VerificationStatus.DUPLICATE, VerificationStatus.MISSING_DATA]:
                        record.verify_status = VerificationStatus.BORDERLINE
                        borderline_ids.append(record.record_id)

        return records, borderline_ids

    def re_evaluate(self, records: List[EvaluationRecord], model_version: str) -> List[EvaluationRecord]:
        for record in records:
            record.model_version = model_version
            record.eval_timestamp = datetime.now()

        records, _ = self.detect_missing_data(records)
        records, _ = self.detect_duplicates(records)
        records, _ = self.detect_borderline(records)

        for record in records:
            if record.verify_status == VerificationStatus.NEED_MANUAL_CHECK:
                if record.confidence == ConfidenceLevel.HIGH and not record.has_missing_reference:
                    if not record.is_duplicate:
                        record.verify_status = VerificationStatus.PASSED

        return records

    def get_stratification_summary(self, stratified: Dict[str, List[EvaluationRecord]]) -> Dict[str, Dict[str, int]]:
        summary = {}

        for stratum_name, stratum_records in stratified.items():
            status_counts: Dict[str, int] = defaultdict(int)
            type_counts: Dict[str, int] = defaultdict(int)
            confidence_counts: Dict[str, int] = defaultdict(int)

            for record in stratum_records:
                status_counts[record.verify_status.value] += 1
                type_counts[record.change_type.value] += 1
                confidence_counts[record.confidence.value] += 1

            summary[stratum_name] = {
                '总数': len(stratum_records),
                '核验状态分布': dict(status_counts),
                '变化类型分布': dict(type_counts),
                '置信度分布': dict(confidence_counts)
            }

        return summary

    def compare_evaluations(self, old_records: List[EvaluationRecord], new_records: List[EvaluationRecord]) -> Dict:
        old_map = {r.record_id: r for r in old_records}
        new_map = {r.record_id: r for r in new_records}

        all_ids = set(old_map.keys()) | set(new_map.keys())

        changes = []
        added = []
        removed = []

        for rid in all_ids:
            if rid in old_map and rid in new_map:
                old_r = old_map[rid]
                new_r = new_map[rid]
                if old_r.verify_status != new_r.verify_status:
                    changes.append({
                        'record_id': rid,
                        'old_status': old_r.verify_status.value,
                        'new_status': new_r.verify_status.value,
                        'city': new_r.city,
                        'change_type': new_r.change_type.value
                    })
            elif rid in new_map:
                added.append(rid)
            else:
                removed.append(rid)

        return {
            'changes': changes,
            'added': added,
            'removed': removed,
            'total_changes': len(changes),
            'total_added': len(added),
            'total_removed': len(removed)
        }
