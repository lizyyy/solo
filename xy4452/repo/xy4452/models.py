import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional


class FoundItem:
    def __init__(self, 
                 title: str = "",
                 description: str = "",
                 location: str = "",
                 found_date: str = "",
                 finder: str = "",
                 image_paths: List[str] = None,
                 tags: List[str] = None,
                 item_id: str = None,
                 created_at: str = None,
                 updated_at: str = None,
                 status: str = "unclaimed",
                 notes: str = "",
                 image_features: Dict = None):
        self.item_id = item_id or str(uuid.uuid4())
        self.title = title
        self.description = description
        self.location = location
        self.found_date = found_date
        self.finder = finder
        self.image_paths = image_paths or []
        self.tags = tags or []
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
        self.status = status  # unclaimed, claimed, returned, disposed
        self.notes = notes
        self.image_features = image_features or {}
        
    def to_dict(self) -> Dict:
        return {
            'item_id': self.item_id,
            'title': self.title,
            'description': self.description,
            'location': self.location,
            'found_date': self.found_date,
            'finder': self.finder,
            'image_paths': self.image_paths,
            'tags': self.tags,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'status': self.status,
            'notes': self.notes,
            'image_features': self.image_features
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'FoundItem':
        return cls(
            item_id=data.get('item_id'),
            title=data.get('title', ''),
            description=data.get('description', ''),
            location=data.get('location', ''),
            found_date=data.get('found_date', ''),
            finder=data.get('finder', ''),
            image_paths=data.get('image_paths', []),
            tags=data.get('tags', []),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            status=data.get('status', 'unclaimed'),
            notes=data.get('notes', ''),
            image_features=data.get('image_features', {})
        )
    
    def update_timestamp(self):
        self.updated_at = datetime.now().isoformat()


class LostReport:
    def __init__(self,
                 title: str = "",
                 description: str = "",
                 location: str = "",
                 lost_date: str = "",
                 reporter: str = "",
                 contact: str = "",
                 tags: List[str] = None,
                 report_id: str = None,
                 created_at: str = None,
                 updated_at: str = None,
                 status: str = "active",
                 notes: str = ""):
        self.report_id = report_id or str(uuid.uuid4())
        self.title = title
        self.description = description
        self.location = location
        self.lost_date = lost_date
        self.reporter = reporter
        self.contact = contact
        self.tags = tags or []
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
        self.status = status  # active, found, closed, withdrawn
        self.notes = notes
        
    def to_dict(self) -> Dict:
        return {
            'report_id': self.report_id,
            'title': self.title,
            'description': self.description,
            'location': self.location,
            'lost_date': self.lost_date,
            'reporter': self.reporter,
            'contact': self.contact,
            'tags': self.tags,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'status': self.status,
            'notes': self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'LostReport':
        return cls(
            report_id=data.get('report_id'),
            title=data.get('title', ''),
            description=data.get('description', ''),
            location=data.get('location', ''),
            lost_date=data.get('lost_date', ''),
            reporter=data.get('reporter', ''),
            contact=data.get('contact', ''),
            tags=data.get('tags', []),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            status=data.get('status', 'active'),
            notes=data.get('notes', '')
        )
    
    def update_timestamp(self):
        self.updated_at = datetime.now().isoformat()


class ClaimRecord:
    def __init__(self,
                 item_id: str = "",
                 report_id: str = "",
                 claimant: str = "",
                 claimant_contact: str = "",
                 claim_date: str = "",
                 status: str = "pending",
                 notes: str = "",
                 claim_id: str = None,
                 created_at: str = None,
                 updated_at: str = None,
                 confirmed_by: str = "",
                 return_date: str = ""):
        self.claim_id = claim_id or str(uuid.uuid4())
        self.item_id = item_id
        self.report_id = report_id
        self.claimant = claimant
        self.claimant_contact = claimant_contact
        self.claim_date = claim_date or datetime.now().isoformat()
        self.status = status  # pending, confirmed, rejected, returned
        self.notes = notes
        self.created_at = created_at or datetime.now().isoformat()
        self.updated_at = updated_at or datetime.now().isoformat()
        self.confirmed_by = confirmed_by
        self.return_date = return_date
        
    def to_dict(self) -> Dict:
        return {
            'claim_id': self.claim_id,
            'item_id': self.item_id,
            'report_id': self.report_id,
            'claimant': self.claimant,
            'claimant_contact': self.claimant_contact,
            'claim_date': self.claim_date,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'confirmed_by': self.confirmed_by,
            'return_date': self.return_date
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ClaimRecord':
        return cls(
            claim_id=data.get('claim_id'),
            item_id=data.get('item_id', ''),
            report_id=data.get('report_id', ''),
            claimant=data.get('claimant', ''),
            claimant_contact=data.get('claimant_contact', ''),
            claim_date=data.get('claim_date'),
            status=data.get('status', 'pending'),
            notes=data.get('notes', ''),
            created_at=data.get('created_at'),
            updated_at=data.get('updated_at'),
            confirmed_by=data.get('confirmed_by', ''),
            return_date=data.get('return_date', '')
        )
    
    def update_timestamp(self):
        self.updated_at = datetime.now().isoformat()


class MatchResult:
    def __init__(self,
                 found_item: FoundItem,
                 lost_report: LostReport,
                 score: float = 0.0,
                 risk_factors: List[Dict] = None,
                 match_id: str = None,
                 human_confirmed: bool = False,
                 human_notes: str = ""):
        self.match_id = match_id or str(uuid.uuid4())
        self.found_item = found_item
        self.lost_report = lost_report
        self.score = score
        self.risk_factors = risk_factors or []
        self.human_confirmed = human_confirmed
        self.human_notes = human_notes
        
    def to_dict(self) -> Dict:
        return {
            'match_id': self.match_id,
            'found_item': self.found_item.to_dict() if self.found_item else None,
            'lost_report': self.lost_report.to_dict() if self.lost_report else None,
            'score': self.score,
            'risk_factors': self.risk_factors,
            'human_confirmed': self.human_confirmed,
            'human_notes': self.human_notes
        }


class DataStore:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.found_items_file = os.path.join(data_dir, 'found_items.json')
        self.lost_reports_file = os.path.join(data_dir, 'lost_reports.json')
        self.claim_records_file = os.path.join(data_dir, 'claim_records.json')
        self.match_results_file = os.path.join(data_dir, 'match_results.json')
        
        self._ensure_files_exist()
        
    def _ensure_files_exist(self):
        for filepath in [self.found_items_file, self.lost_reports_file, 
                        self.claim_records_file, self.match_results_file]:
            if not os.path.exists(filepath):
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump([], f)
                    
    def _load_json(self, filepath: str) -> List[Dict]:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
            
    def _save_json(self, filepath: str, data: List[Dict]):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def get_all_found_items(self) -> List[FoundItem]:
        data = self._load_json(self.found_items_file)
        return [FoundItem.from_dict(item) for item in data]
        
    def get_found_item(self, item_id: str) -> Optional[FoundItem]:
        items = self.get_all_found_items()
        for item in items:
            if item.item_id == item_id:
                return item
        return None
        
    def save_found_item(self, item: FoundItem):
        items = self.get_all_found_items()
        item.update_timestamp()
        
        for i, existing in enumerate(items):
            if existing.item_id == item.item_id:
                items[i] = item
                break
        else:
            items.append(item)
            
        self._save_json(self.found_items_file, [i.to_dict() for i in items])
        
    def delete_found_item(self, item_id: str) -> bool:
        items = self.get_all_found_items()
        new_items = [i for i in items if i.item_id != item_id]
        if len(new_items) < len(items):
            self._save_json(self.found_items_file, [i.to_dict() for i in new_items])
            return True
        return False
    
    def get_all_lost_reports(self) -> List[LostReport]:
        data = self._load_json(self.lost_reports_file)
        return [LostReport.from_dict(report) for report in data]
        
    def get_lost_report(self, report_id: str) -> Optional[LostReport]:
        reports = self.get_all_lost_reports()
        for report in reports:
            if report.report_id == report_id:
                return report
        return None
        
    def save_lost_report(self, report: LostReport):
        reports = self.get_all_lost_reports()
        report.update_timestamp()
        
        for i, existing in enumerate(reports):
            if existing.report_id == report.report_id:
                reports[i] = report
                break
        else:
            reports.append(report)
            
        self._save_json(self.lost_reports_file, [r.to_dict() for r in reports])
        
    def delete_lost_report(self, report_id: str) -> bool:
        reports = self.get_all_lost_reports()
        new_reports = [r for r in reports if r.report_id != report_id]
        if len(new_reports) < len(reports):
            self._save_json(self.lost_reports_file, [r.to_dict() for r in new_reports])
            return True
        return False
    
    def get_all_claim_records(self) -> List[ClaimRecord]:
        data = self._load_json(self.claim_records_file)
        return [ClaimRecord.from_dict(record) for record in data]
        
    def get_claim_record(self, claim_id: str) -> Optional[ClaimRecord]:
        records = self.get_all_claim_records()
        for record in records:
            if record.claim_id == claim_id:
                return record
        return None
        
    def save_claim_record(self, record: ClaimRecord):
        records = self.get_all_claim_records()
        record.update_timestamp()
        
        for i, existing in enumerate(records):
            if existing.claim_id == record.claim_id:
                records[i] = record
                break
        else:
            records.append(record)
            
        self._save_json(self.claim_records_file, [r.to_dict() for r in records])
        
    def get_claim_records_by_item(self, item_id: str) -> List[ClaimRecord]:
        records = self.get_all_claim_records()
        return [r for r in records if r.item_id == item_id]
        
    def get_claim_records_by_report(self, report_id: str) -> List[ClaimRecord]:
        records = self.get_all_claim_records()
        return [r for r in records if r.report_id == report_id]
