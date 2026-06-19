from datetime import datetime
from typing import List, Dict, Tuple, Optional
from .models import SamplingRecord, RecordStatus, SensorStatus
import hashlib
import json


class SelfChecker:
    def __init__(self):
        self.check_results: Dict[str, List[dict]] = {
            "duplicate_import": [],
            "sensor_id_change": [],
            "supplementary_recalc": [],
            "export_consistency": []
        }
        self.imported_record_ids: set = set()
        self.sensor_history: Dict[str, List[Tuple[str, datetime]]] = {}
        self.export_signatures: Dict[str, str] = {}

    def check_duplicate_import(self, record: SamplingRecord) -> Tuple[bool, str]:
        if record.record_id in self.imported_record_ids:
            result = {
                "record_id": record.record_id,
                "check_time": datetime.now().isoformat(),
                "issue": "重复导入",
                "details": f"记录ID [{record.record_id}] 已存在于系统中"
            }
            self.check_results["duplicate_import"].append(result)
            return True, result["details"]
        
        self.imported_record_ids.add(record.record_id)
        return False, ""

    def check_sensor_id_change(self, record: SamplingRecord) -> Tuple[bool, str]:
        ship_key = record.ship_id
        
        if ship_key not in self.sensor_history:
            self.sensor_history[ship_key] = []
        
        history = self.sensor_history[ship_key]
        
        if history:
            last_sensor_id, last_time = history[-1]
            if (last_sensor_id != record.sensor_id 
                and record.sampling_start_time > last_time):
                record.sensor_status = SensorStatus.RESTARTED
                record.previous_sensor_id = last_sensor_id
                record.status = RecordStatus.PENDING_REVIEW
                
                result = {
                    "record_id": record.record_id,
                    "check_time": datetime.now().isoformat(),
                    "issue": "传感器编号变更",
                    "details": f"船舶[{record.ship_id}]传感器编号从[{last_sensor_id}]变为[{record.sensor_id}]，疑似重启",
                    "previous_id": last_sensor_id,
                    "current_id": record.sensor_id
                }
                self.check_results["sensor_id_change"].append(result)
                return True, result["details"]
        
        history.append((record.sensor_id, record.sampling_start_time))
        return False, ""

    def check_supplementary_recalc(
        self,
        supplementary_record: SamplingRecord,
        original_record: Optional[SamplingRecord],
        estimate_before: float,
        estimate_after: float
    ) -> Tuple[bool, str]:
        if not supplementary_record.is_supplementary:
            return False, ""
        
        diff = abs(estimate_after - estimate_before)
        has_change = diff > 0.001
        
        result = {
            "record_id": supplementary_record.record_id,
            "original_id": supplementary_record.original_record_id,
            "check_time": datetime.now().isoformat(),
            "issue": "补录重算验证",
            "estimate_before": estimate_before,
            "estimate_after": estimate_after,
            "difference": diff,
            "has_significant_change": has_change,
            "details": f"补录后估算值从 {estimate_before:.4f} 变为 {estimate_after:.4f}"
        }
        self.check_results["supplementary_recalc"].append(result)
        
        if has_change:
            return True, result["details"] + "（有显著变化）"
        return False, result["details"] + "（无显著变化）"

    def check_export_consistency(
        self,
        record: SamplingRecord,
        export_data: dict,
        export_id: str
    ) -> Tuple[bool, str]:
        record_dict = record.to_dict()
        record_signature = self._calculate_signature(record_dict)
        
        export_signature = self._calculate_signature(export_data)
        
        is_consistent = record_signature == export_signature
        
        result = {
            "record_id": record.record_id,
            "export_id": export_id,
            "check_time": datetime.now().isoformat(),
            "issue": "导出一致性",
            "record_signature": record_signature,
            "export_signature": export_signature,
            "is_consistent": is_consistent,
            "details": "导出数据与原始记录一致" if is_consistent else "导出数据与原始记录不一致"
        }
        self.check_results["export_consistency"].append(result)
        
        if not is_consistent:
            return True, result["details"]
        return False, result["details"]

    def _calculate_signature(self, data: dict) -> str:
        sorted_data = json.dumps(data, sort_keys=True)
        return hashlib.md5(sorted_data.encode('utf-8')).hexdigest()

    def run_all_checks(self, record: SamplingRecord) -> List[str]:
        issues = []
        
        is_dup, msg = self.check_duplicate_import(record)
        if is_dup:
            issues.append(msg)
        
        is_sensor_change, msg = self.check_sensor_id_change(record)
        if is_sensor_change:
            issues.append(msg)
        
        return issues

    def get_check_summary(self) -> dict:
        summary = {}
        for check_type, results in self.check_results.items():
            if check_type == "export_consistency":
                has_issues = any(r.get("is_consistent", True) is False for r in results)
            elif check_type == "supplementary_recalc":
                has_issues = any(r.get("has_significant_change", False) for r in results)
            else:
                has_issues = len(results) > 0
            summary[check_type] = {
                "count": len(results),
                "has_issues": has_issues
            }
        return summary

    def get_all_results(self) -> Dict[str, List[dict]]:
        return self.check_results.copy()
