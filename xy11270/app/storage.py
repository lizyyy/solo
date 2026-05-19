import json
import os
from typing import Dict, List, Optional
from datetime import datetime
from .models import ScanResult, ReviewStatus
from .rules import mask_sensitive_data


SCAN_RESULTS_FILE = "data/scan_results.json"
REVIEW_RECORDS_FILE = "data/review_records.json"


class Storage:
    def __init__(self):
        self._scan_results: Dict[str, dict] = {}
        self._review_records: Dict[str, dict] = {}
        self._ensure_data_dir()
        self._load_data()
    
    def _ensure_data_dir(self):
        os.makedirs("data", exist_ok=True)
    
    def _load_data(self):
        if os.path.exists(SCAN_RESULTS_FILE):
            with open(SCAN_RESULTS_FILE, 'r', encoding='utf-8') as f:
                self._scan_results = json.load(f)
        
        if os.path.exists(REVIEW_RECORDS_FILE):
            with open(REVIEW_RECORDS_FILE, 'r', encoding='utf-8') as f:
                self._review_records = json.load(f)
    
    def _save_data(self):
        with open(SCAN_RESULTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(self._scan_results, f, ensure_ascii=False, indent=2, default=str)
        
        with open(REVIEW_RECORDS_FILE, 'w', encoding='utf-8') as f:
            json.dump(self._review_records, f, ensure_ascii=False, indent=2, default=str)
    
    def save_scan_result(self, result: ScanResult):
        result_dict = result.model_dump()
        
        if 'scanned_at' in result_dict:
            result_dict['scanned_at'] = result_dict['scanned_at'].isoformat()
        
        self._scan_results[result.transcript_id] = result_dict
        self._save_data()
    
    def get_scan_result(self, transcript_id: str) -> Optional[dict]:
        return self._scan_results.get(transcript_id)
    
    def get_all_scan_results(self) -> List[dict]:
        return list(self._scan_results.values())
    
    def save_review(self, transcript_id: str, status: ReviewStatus, reviewer: str, comment: Optional[str] = None):
        review_dict = {
            "transcript_id": transcript_id,
            "status": status,
            "reviewer": mask_sensitive_data(reviewer),
            "comment": mask_sensitive_data(comment) if comment else None,
            "reviewed_at": datetime.now().isoformat()
        }
        self._review_records[transcript_id] = review_dict
        self._save_data()
    
    def get_review(self, transcript_id: str) -> Optional[dict]:
        return self._review_records.get(transcript_id)
    
    def get_all_reviews(self) -> List[dict]:
        return list(self._review_records.values())
    
    def transcript_exists(self, transcript_id: str) -> bool:
        return transcript_id in self._scan_results


storage = Storage()
