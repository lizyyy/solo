import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from .pricing_engine import (
    PricingResult, PhoneInfo, InspectionResult, DeductionItem
)


class StorageManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.records_file = os.path.join(data_dir, "inspection_records.json")
        self.anomalies_file = os.path.join(data_dir, "anomaly_list.json")
        self._ensure_data_dir()
    
    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        if not os.path.exists(self.records_file):
            with open(self.records_file, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
        if not os.path.exists(self.anomalies_file):
            with open(self.anomalies_file, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
    
    def _load_records(self) -> Dict[str, Any]:
        with open(self.records_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _save_records(self, records: Dict[str, Any]):
        with open(self.records_file, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
    
    def _load_anomalies(self) -> List[Any]:
        with open(self.anomalies_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _save_anomalies(self, anomalies: List[Any]):
        with open(self.anomalies_file, "w", encoding="utf-8") as f:
            json.dump(anomalies, f, ensure_ascii=False, indent=2)
    
    def imei_exists(self, imei: str) -> bool:
        records = self._load_records()
        return imei in records
    
    def get_record(self, imei: str) -> Optional[Dict[str, Any]]:
        records = self._load_records()
        return records.get(imei)
    
    def save_pricing_result(
        self,
        result: PricingResult,
        update_existing: bool = False,
    ) -> bool:
        records = self._load_records()
        imei = result.phone_info.imei
        
        if imei in records and not update_existing:
            return False
        
        result_dict = result.to_dict()
        result_dict["created_at"] = datetime.now().isoformat()
        if result.status == "confirmed":
            result_dict["confirmed_at"] = datetime.now().isoformat()
        
        records[imei] = result_dict
        self._save_records(records)
        
        if result.anomalies or result.needs_manual_review:
            self._add_to_anomaly_list(result)
        
        return True
    
    def update_record(
        self,
        imei: str,
        result: PricingResult,
    ) -> bool:
        return self.save_pricing_result(result, update_existing=True)
    
    def _add_to_anomaly_list(self, result: PricingResult):
        anomalies = self._load_anomalies()
        
        existing_idx = None
        for idx, item in enumerate(anomalies):
            if item.get("imei") == result.phone_info.imei:
                existing_idx = idx
                break
        
        anomaly_item = {
            "imei": result.phone_info.imei,
            "model": result.phone_info.model,
            "quality_level": result.quality_level,
            "base_price": result.base_price,
            "final_price": result.final_price,
            "anomalies": result.anomalies,
            "needs_manual_review": result.needs_manual_review,
            "status": "pending_review",
            "created_at": datetime.now().isoformat(),
            "review_notes": "",
        }
        
        if existing_idx is not None:
            anomalies[existing_idx] = anomaly_item
        else:
            anomalies.append(anomaly_item)
        
        self._save_anomalies(anomalies)
    
    def get_anomaly_list(self) -> List[Dict[str, Any]]:
        return self._load_anomalies()
    
    def resolve_anomaly(
        self,
        imei: str,
        review_notes: str,
        action: str = "approve",
    ) -> bool:
        anomalies = self._load_anomalies()
        
        for idx, item in enumerate(anomalies):
            if item.get("imei") == imei:
                anomalies[idx]["status"] = "resolved"
                anomalies[idx]["resolution"] = action
                anomalies[idx]["review_notes"] = review_notes
                anomalies[idx]["resolved_at"] = datetime.now().isoformat()
                self._save_anomalies(anomalies)
                return True
        
        return False
    
    def get_all_records(self) -> Dict[str, Any]:
        return self._load_records()
    
    def get_confirmed_records(self) -> Dict[str, Any]:
        records = self._load_records()
        return {
            imei: record
            for imei, record in records.items()
            if record.get("status") == "confirmed"
        }
