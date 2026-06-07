from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from .models import ExperimentRecord
import yaml
import json
from datetime import datetime


class DedupEngine:
    def __init__(self):
        self.records: Dict[str, ExperimentRecord] = {}
        self.signature_index: Dict[str, List[str]] = defaultdict(list)
        self.data_batch_index: Dict[str, List[str]] = defaultdict(list)

    def load_params_yaml(self, yaml_path: str) -> List[ExperimentRecord]:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        records = []
        for item in data.get('experiments', []):
            record = ExperimentRecord(
                record_id=item['record_id'],
                experiment_name=item['experiment_name'],
                data_batch_id=item['data_batch_id'],
                feature_version=item['feature_version'],
                model_version=item['model_version'],
                params=item['params'],
                training_date=item['training_date'],
                notes=item.get('notes', '')
            )
            records.append(record)
        
        return records

    def add_record(self, record: ExperimentRecord) -> Tuple[str, List[Dict]]:
        sig = record.get_data_signature()
        
        issues = []
        
        existing_sig_records = [self.records[rid] for rid in self.signature_index.get(sig, [])
                               if self.records[rid].dedup_status != "REJECTED"]
        
        if existing_sig_records:
            original = existing_sig_records[0]
            record.dedup_status = "DUPLICATE"
            record.duplicate_of = original.record_id
            record.review_required = True
            record.status = "PENDING_REVIEW"
            
            issues.append({
                "type": "DUPLICATE_TRAINING",
                "severity": "WARNING",
                "record_id": record.record_id,
                "duplicate_of": original.record_id,
                "message": f"同一批数据重复训练: {record.experiment_name} 与 {original.experiment_name} 数据签名一致",
                "action_required": "请策略产品复核，确认是否为正常重跑"
            })
        else:
            record.dedup_status = "UNIQUE"
            record.status = "NORMAL"
        
        same_batch = [self.records[rid] for rid in self.data_batch_index.get(record.data_batch_id, [])
                     if self.records[rid].dedup_status != "REJECTED"
                     and self.records[rid].feature_version == record.feature_version]
        
        if same_batch and not existing_sig_records:
            issues.append({
                "type": "SAME_BATCH_DIFF_PARAMS",
                "severity": "INFO",
                "record_id": record.record_id,
                "related_records": [r.record_id for r in same_batch],
                "message": f"同数据批次不同参数实验: {record.data_batch_id} 已有 {len(same_batch)} 条记录",
                "action_required": "无，属正常参数调优"
            })
        
        self.records[record.record_id] = record
        self.signature_index[sig].append(record.record_id)
        self.data_batch_index[record.data_batch_id].append(record.record_id)
        
        record.updated_at = datetime.now().isoformat()
        
        return record.dedup_status, issues

    def batch_import(self, records: List[ExperimentRecord]) -> Dict:
        summary = {
            "total": len(records),
            "unique": 0,
            "duplicate": 0,
            "review_required": 0,
            "issues": []
        }
        
        for record in records:
            status, issues = self.add_record(record)
            if status == "UNIQUE":
                summary["unique"] += 1
            elif status == "DUPLICATE":
                summary["duplicate"] += 1
                summary["review_required"] += 1
            summary["issues"].extend(issues)
        
        return summary

    def review_duplicate(self, record_id: str, reviewer: str, 
                         decision: str, comment: str = "") -> Optional[ExperimentRecord]:
        if record_id not in self.records:
            return None
        
        record = self.records[record_id]
        record.reviewer = reviewer
        record.review_comment = comment
        record.review_required = False
        record.updated_at = datetime.now().isoformat()
        
        if decision == "APPROVE":
            record.dedup_status = "APPROVED_DUPLICATE"
            record.status = "NORMAL"
            record.notes += f" [复核通过] {reviewer}: {comment}"
        elif decision == "REJECT":
            record.dedup_status = "REJECTED"
            record.status = "REJECTED"
            record.notes += f" [复核拒绝] {reviewer}: {comment}"
        elif decision == "NEW_VERSION":
            record.dedup_status = "NEW_VERSION"
            record.status = "NORMAL"
            record.notes += f" [标记为新版本] {reviewer}: {comment}"
        
        return record

    def get_duplicate_groups(self) -> List[Dict]:
        groups = []
        processed = set()
        
        for sig, record_ids in self.signature_index.items():
            valid_records = [self.records[rid] for rid in record_ids 
                           if self.records[rid].dedup_status != "REJECTED"]
            if len(valid_records) > 1:
                groups.append({
                    "signature": sig,
                    "records": valid_records,
                    "count": len(valid_records)
                })
        
        return groups

    def get_pending_review(self) -> List[ExperimentRecord]:
        return [r for r in self.records.values() if r.review_required]

    def get_all_records(self) -> List[ExperimentRecord]:
        return list(self.records.values())

    def get_record(self, record_id: str) -> Optional[ExperimentRecord]:
        return self.records.get(record_id)

    def export_state(self) -> Dict:
        return {
            "records": {
                rid: {
                    "record_id": r.record_id,
                    "experiment_name": r.experiment_name,
                    "data_batch_id": r.data_batch_id,
                    "feature_version": r.feature_version,
                    "model_version": r.model_version,
                    "params": r.params,
                    "training_date": r.training_date,
                    "status": r.status,
                    "dedup_status": r.dedup_status,
                    "duplicate_of": r.duplicate_of,
                    "notes": r.notes,
                    "created_at": r.created_at,
                    "updated_at": r.updated_at,
                    "review_required": r.review_required,
                    "reviewer": r.reviewer,
                    "review_comment": r.review_comment
                }
                for rid, r in self.records.items()
            }
        }
