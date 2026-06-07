from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from .models import EvalSlice, FeatureVersion
import yaml
import json
from datetime import datetime


class SliceManager:
    def __init__(self, feature_version_manager=None):
        self.slices: Dict[str, EvalSlice] = {}
        self.data_batch_index: Dict[str, List[str]] = defaultdict(list)
        self.feature_version_manager = feature_version_manager

    def load_eval_slices(self, yaml_path: str) -> List[EvalSlice]:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        slices = []
        for item in data.get('eval_slices', []):
            slice_obj = EvalSlice(
                slice_id=item['slice_id'],
                slice_name=item['slice_name'],
                data_batch_id=item['data_batch_id'],
                eval_date=item['eval_date'],
                metrics=item['metrics'],
                feature_version=item['feature_version'],
                is_backfill=item.get('is_backfill', False),
                source=item.get('source', 'EVAL_PLATFORM'),
                notes=item.get('notes', '')
            )
            slices.append(slice_obj)
        
        return slices

    def add_slice(self, slice_obj: EvalSlice) -> Tuple[bool, List[Dict]]:
        issues = []
        is_new = True
        
        if slice_obj.slice_id in self.slices:
            is_new = False
            issues.append({
                "type": "SLICE_EXISTS",
                "severity": "INFO",
                "slice_id": slice_obj.slice_id,
                "message": f"评测切片 {slice_obj.slice_id} 已存在，将更新"
            })
        
        if slice_obj.is_backfill:
            issues.append({
                "type": "BACKFILL_SLICE",
                "severity": "WARNING",
                "slice_id": slice_obj.slice_id,
                "message": f"检测到补录切片: {slice_obj.slice_name}，数据批次 {slice_obj.data_batch_id}",
                "action_required": "请确认特征版本表是否需要同步更新"
            })
            
            if self.feature_version_manager:
                fv_updated = self.feature_version_manager.check_and_update_from_slice(slice_obj)
                if fv_updated:
                    issues.append({
                        "type": "FEATURE_VERSION_UPDATED",
                        "severity": "SUCCESS",
                        "slice_id": slice_obj.slice_id,
                        "message": f"特征版本表已根据补录切片更新: {slice_obj.feature_version}"
                    })
        
        self.slices[slice_obj.slice_id] = slice_obj
        if slice_obj.slice_id not in self.data_batch_index[slice_obj.data_batch_id]:
            self.data_batch_index[slice_obj.data_batch_id].append(slice_obj.slice_id)
        
        return is_new, issues

    def batch_import(self, slices: List[EvalSlice]) -> Dict:
        summary = {
            "total": len(slices),
            "new": 0,
            "updated": 0,
            "backfill": 0,
            "issues": []
        }
        
        for slice_obj in slices:
            is_new, issues = self.add_slice(slice_obj)
            if is_new:
                summary["new"] += 1
            else:
                summary["updated"] += 1
            if slice_obj.is_backfill:
                summary["backfill"] += 1
            summary["issues"].extend(issues)
        
        return summary

    def get_slices_for_batch(self, data_batch_id: str) -> List[EvalSlice]:
        return [self.slices[sid] for sid in self.data_batch_index.get(data_batch_id, [])]

    def get_backfill_slices(self) -> List[EvalSlice]:
        return [s for s in self.slices.values() if s.is_backfill]

    def get_all_slices(self) -> List[EvalSlice]:
        return list(self.slices.values())

    def get_slice(self, slice_id: str) -> Optional[EvalSlice]:
        return self.slices.get(slice_id)
