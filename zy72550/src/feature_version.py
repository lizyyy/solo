from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from .models import FeatureVersion, EvalSlice
import yaml
from datetime import datetime


class FeatureVersionManager:
    def __init__(self):
        self.versions: Dict[str, FeatureVersion] = {}
        self.update_history: List[Dict] = []

    def load_versions_yaml(self, yaml_path: str) -> List[FeatureVersion]:
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        versions = []
        for item in data.get('feature_versions', []):
            fv = FeatureVersion(
                version_id=item['version_id'],
                version_name=item['version_name'],
                feature_list=item['feature_list'],
                data_source=item['data_source'],
                effective_date=item['effective_date'],
                is_active=item.get('is_active', True),
                created_by=item.get('created_by', 'system'),
                notes=item.get('notes', '')
            )
            versions.append(fv)
        
        return versions

    def add_version(self, fv: FeatureVersion) -> Tuple[bool, List[Dict]]:
        issues = []
        is_new = True
        
        if fv.version_id in self.versions:
            is_new = False
            existing = self.versions[fv.version_id]
            if existing.feature_list != fv.feature_list:
                issues.append({
                    "type": "FEATURE_LIST_CHANGED",
                    "severity": "WARNING",
                    "version_id": fv.version_id,
                    "message": f"特征版本 {fv.version_id} 特征列表已变更",
                    "action_required": "请确认变更是否影响历史实验"
                })
        
        self.versions[fv.version_id] = fv
        
        if is_new:
            self.update_history.append({
                "timestamp": datetime.now().isoformat(),
                "action": "ADD_VERSION",
                "version_id": fv.version_id,
                "source": "MANUAL"
            })
        
        return is_new, issues

    def check_and_update_from_slice(self, slice_obj: EvalSlice) -> bool:
        fv_id = slice_obj.feature_version
        
        if fv_id not in self.versions:
            new_fv = FeatureVersion(
                version_id=fv_id,
                version_name=f"补录-{fv_id}",
                feature_list=[],
                data_source=slice_obj.source,
                effective_date=slice_obj.eval_date,
                is_active=True,
                created_by="backfill_auto",
                notes=f"根据补录切片自动创建: {slice_obj.slice_id}"
            )
            self.versions[fv_id] = new_fv
            self.update_history.append({
                "timestamp": datetime.now().isoformat(),
                "action": "AUTO_ADD_FROM_BACKFILL",
                "version_id": fv_id,
                "slice_id": slice_obj.slice_id,
                "source": "BACKFILL"
            })
            return True
        
        existing = self.versions[fv_id]
        if not existing.notes or "补录" not in existing.notes:
            existing.notes += f" | 关联补录切片: {slice_obj.slice_id}"
            existing.updated_at = datetime.now().isoformat()
            self.update_history.append({
                "timestamp": datetime.now().isoformat(),
                "action": "LINK_BACKFILL",
                "version_id": fv_id,
                "slice_id": slice_obj.slice_id
            })
            return True
        
        return False

    def batch_import(self, versions: List[FeatureVersion]) -> Dict:
        summary = {
            "total": len(versions),
            "new": 0,
            "updated": 0,
            "issues": []
        }
        
        for fv in versions:
            is_new, issues = self.add_version(fv)
            if is_new:
                summary["new"] += 1
            else:
                summary["updated"] += 1
            summary["issues"].extend(issues)
        
        return summary

    def get_active_versions(self) -> List[FeatureVersion]:
        return [v for v in self.versions.values() if v.is_active]

    def get_all_versions(self) -> List[FeatureVersion]:
        return list(self.versions.values())

    def get_version(self, version_id: str) -> Optional[FeatureVersion]:
        return self.versions.get(version_id)

    def get_update_history(self) -> List[Dict]:
        return sorted(self.update_history, key=lambda x: x["timestamp"], reverse=True)
