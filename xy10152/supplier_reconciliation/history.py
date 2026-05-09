import json
import pickle
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from .models import ReconciliationRun, Document, DocumentType, ReconciliationStatus


class HistoryManager:
    def __init__(self, history_dir: str = "./reconciliation_history"):
        self.history_dir = Path(history_dir)
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.history_dir / "index.json"
        self._load_index()
    
    def _load_index(self) -> None:
        if self.index_file.exists():
            with open(self.index_file, "r", encoding="utf-8") as f:
                self.index = json.load(f)
        else:
            self.index = {"runs": []}
    
    def _save_index(self) -> None:
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2, default=str)
    
    def _doc_to_dict(self, doc: Document) -> Dict[str, Any]:
        return {
            "doc_type": doc.doc_type.value,
            "doc_number": doc.doc_number,
            "supplier_id": doc.supplier_id,
            "supplier_name": doc.supplier_name,
            "amount": doc.amount,
            "doc_date": doc.doc_date.isoformat() if doc.doc_date else None,
            "due_date": doc.due_date.isoformat() if doc.due_date else None,
            "description": doc.description,
            "reference": doc.reference,
            "metadata": doc.metadata,
            "validation_errors": doc.validation_errors,
            "is_valid": doc.is_valid,
        }
    
    def _dict_to_doc(self, data: Dict[str, Any]) -> Document:
        from datetime import date as date_cls
        
        doc_date = None
        if data.get("doc_date"):
            doc_date = datetime.fromisoformat(data["doc_date"]).date()
        
        due_date = None
        if data.get("due_date"):
            due_date = datetime.fromisoformat(data["due_date"]).date()
        
        return Document(
            doc_type=DocumentType(data["doc_type"]),
            doc_number=data["doc_number"],
            supplier_id=data["supplier_id"],
            supplier_name=data["supplier_name"],
            amount=data["amount"],
            doc_date=doc_date or date_cls.today(),
            due_date=due_date,
            description=data.get("description", ""),
            reference=data.get("reference", ""),
            metadata=data.get("metadata", {}),
            validation_errors=data.get("validation_errors", []),
            is_valid=data.get("is_valid", True),
        )
    
    def save_run(self, run: ReconciliationRun) -> str:
        run_file = self.history_dir / f"{run.run_id}.json"
        
        run_data = {
            "run_id": run.run_id,
            "run_date": run.run_date.isoformat(),
            "period": run.period,
            "documents": [self._doc_to_dict(d) for d in run.documents],
            "results": [
                {
                    "document_key": r.document.key,
                    "matched_amount": r.matched_amount,
                    "matched_documents": r.matched_documents,
                    "status": r.status.value,
                    "aging_days": r.aging_days,
                    "period": r.period,
                }
                for r in run.results
            ],
            "summary": self._serialize_summary(run.summary),
            "errors": run.errors,
        }
        
        with open(run_file, "w", encoding="utf-8") as f:
            json.dump(run_data, f, ensure_ascii=False, indent=2, default=str)
        
        index_entry = {
            "run_id": run.run_id,
            "run_date": run.run_date.isoformat(),
            "period": run.period,
            "total_documents": run.summary.get("total_documents", 0),
            "match_rate": run.summary.get("match_rate", 0.0),
        }
        self.index["runs"].append(index_entry)
        self.index["runs"].sort(key=lambda x: x["run_date"], reverse=True)
        self._save_index()
        
        return run.run_id
    
    def _serialize_summary(self, summary: Dict) -> Dict:
        def default_serialize(obj):
            if isinstance(obj, (int, float, str, bool, type(None))):
                return obj
            if isinstance(obj, dict):
                return {str(k): default_serialize(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [default_serialize(item) for item in obj]
            return str(obj)
        
        return default_serialize(summary)
    
    def list_runs(self, limit: int = 10) -> List[Dict]:
        return self.index["runs"][:limit]
    
    def get_run(self, run_id: str) -> Optional[Dict]:
        run_file = self.history_dir / f"{run_id}.json"
        if not run_file.exists():
            return None
        
        with open(run_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def delete_run(self, run_id: str) -> bool:
        run_file = self.history_dir / f"{run_id}.json"
        if run_file.exists():
            run_file.unlink()
        
        self.index["runs"] = [r for r in self.index["runs"] if r["run_id"] != run_id]
        self._save_index()
        
        return True
    
    def get_document_keys(self, run_id: str) -> set:
        run_data = self.get_run(run_id)
        if not run_data:
            return set()
        
        return {f"{d['doc_type']}:{d['doc_number']}:{d['supplier_id']}" 
                for d in run_data.get("documents", [])}
    
    def get_previous_run(self, period: Optional[str] = None) -> Optional[Dict]:
        if period:
            for run in self.index["runs"]:
                if run["period"] == period:
                    return self.get_run(run["run_id"])
            return None
        
        if self.index["runs"]:
            return self.get_run(self.index["runs"][0]["run_id"])
        
        return None
