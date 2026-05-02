from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import ReviewDecision


class ReviewStore:
    REVIEW_FILENAME = "review_decisions.json"
    
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
        self.review_file = storage_path / self.REVIEW_FILENAME
        self._decisions: Dict[str, ReviewDecision] = {}
        self._load()
    
    def _load(self):
        if self.review_file.exists():
            try:
                with open(self.review_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                for item in data.get("decisions", []):
                    decision = ReviewDecision(
                        key=item["key"],
                        language=item["language"],
                        approved=item["approved"],
                        reviewer=item["reviewer"],
                        comment=item.get("comment", ""),
                        issue_checksum=item.get("issue_checksum", ""),
                        timestamp=datetime.fromisoformat(item["timestamp"]) if item.get("timestamp") else datetime.now(),
                    )
                    self._decisions[self._make_key(decision.key, decision.language)] = decision
            except Exception:
                self._decisions = {}
    
    def _save(self):
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        data = {
            "version": "1.0",
            "last_updated": datetime.now().isoformat(),
            "decisions": [d.to_dict() for d in self._decisions.values()],
        }
        
        with open(self.review_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _make_key(self, key: str, language: str) -> str:
        return f"{key}:{language}"
    
    def add_decision(
        self,
        key: str,
        language: str,
        approved: bool,
        reviewer: str,
        comment: str = "",
        issue_checksum: str = "",
    ) -> ReviewDecision:
        decision = ReviewDecision(
            key=key,
            language=language,
            approved=approved,
            reviewer=reviewer,
            comment=comment,
            issue_checksum=issue_checksum,
            timestamp=datetime.now(),
        )
        
        self._decisions[self._make_key(key, language)] = decision
        self._save()
        
        return decision
    
    def get_decision(self, key: str, language: str) -> Optional[ReviewDecision]:
        return self._decisions.get(self._make_key(key, language))
    
    def get_all_decisions(self) -> List[ReviewDecision]:
        return list(self._decisions.values())
    
    def get_approved_decisions(self) -> List[ReviewDecision]:
        return [d for d in self._decisions.values() if d.approved]
    
    def get_rejected_decisions(self) -> List[ReviewDecision]:
        return [d for d in self._decisions.values() if not d.approved]
    
    def remove_decision(self, key: str, language: str) -> bool:
        decision_key = self._make_key(key, language)
        if decision_key in self._decisions:
            del self._decisions[decision_key]
            self._save()
            return True
        return False
    
    def clear_all(self):
        self._decisions = {}
        self._save()
