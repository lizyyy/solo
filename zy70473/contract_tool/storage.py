import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from .models import (
    ContractSubmission, ProcessingResult, FailureRecord,
    PaymentReceipt, ContractStatus, FailureType
)


class Storage:
    def __init__(self, base_path: str = "data"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)
        
        self.submissions_path = self.base_path / "submissions"
        self.results_path = self.base_path / "results"
        self.failures_path = self.base_path / "failures"
        self.receipts_path = self.base_path / "receipts"
        
        for path in [self.submissions_path, self.results_path, 
                     self.failures_path, self.receipts_path]:
            path.mkdir(exist_ok=True)
    
    def _save_json(self, path: Path, data: Dict[str, Any]):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def _load_json(self, path: Path) -> Optional[Dict[str, Any]]:
        if not path.exists():
            return None
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def save_submission(self, submission: ContractSubmission):
        file_path = self.submissions_path / f"{submission.batch_id}_{submission.contract_id}.json"
        self._save_json(file_path, submission.dict())
    
    def get_submission(self, batch_id: str, contract_id: str) -> Optional[Dict]:
        file_path = self.submissions_path / f"{batch_id}_{contract_id}.json"
        return self._load_json(file_path)
    
    def find_existing_contract(self, contract_id: str) -> Optional[Dict]:
        for file in self.submissions_path.glob(f"*_{contract_id}.json"):
            return self._load_json(file)
        return None
    
    def save_result(self, result: ProcessingResult):
        file_path = self.results_path / f"{result.batch_id}_{result.contract_id}.json"
        self._save_json(file_path, result.dict())
    
    def get_result(self, batch_id: str, contract_id: str) -> Optional[Dict]:
        file_path = self.results_path / f"{batch_id}_{contract_id}.json"
        return self._load_json(file_path)
    
    def find_result_by_contract(self, contract_id: str) -> Optional[Dict]:
        for file in self.results_path.glob(f"*_{contract_id}.json"):
            return self._load_json(file)
        return None
    
    def save_failure(self, failure: FailureRecord):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        file_path = self.failures_path / f"{timestamp}_{failure.contract_id}.json"
        self._save_json(file_path, failure.dict())
        return str(file_path)
    
    def get_all_failures(self) -> List[Dict]:
        failures = []
        for file in sorted(self.failures_path.glob("*.json")):
            data = self._load_json(file)
            if data:
                failures.append(data)
        return failures
    
    def save_payment_receipt(self, receipt: PaymentReceipt):
        file_path = self.receipts_path / f"{receipt.receipt_id}.json"
        self._save_json(file_path, receipt.dict())
    
    def get_receipts_by_caller(self, caller: str) -> List[Dict]:
        receipts = []
        for file in self.receipts_path.glob("*.json"):
            data = self._load_json(file)
            if data and data.get('caller') == caller:
                receipts.append(data)
        return receipts
    
    def get_receipts_by_contract(self, contract_id: str) -> List[Dict]:
        receipts = []
        for file in self.receipts_path.glob("*.json"):
            data = self._load_json(file)
            if data and data.get('contract_id') == contract_id:
                receipts.append(data)
        return receipts
    
    def get_all_results(self) -> List[Dict]:
        results = []
        for file in sorted(self.results_path.glob("*.json")):
            data = self._load_json(file)
            if data:
                results.append(data)
        return results
