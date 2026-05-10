import json
import os
from typing import List, Optional
from .models import SampleBatch, Shipment, Feedback, Recovery, Compensation


class DataStorage:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = data_dir
        self._ensure_dirs()
        
    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        
    def _get_file_path(self, name: str) -> str:
        return os.path.join(self.data_dir, f'{name}.json')
    
    def _load(self, name: str) -> List[dict]:
        file_path = self._get_file_path(name)
        if not os.path.exists(file_path):
            return []
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    def _save(self, name: str, data: List[dict]):
        with open(self._get_file_path(name), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def save_batch(self, batch: SampleBatch):
        batches = self._load('batches')
        batches.append(batch.__dict__)
        self._save('batches', batches)
        
    def get_batches(self) -> List[SampleBatch]:
        data = self._load('batches')
        return [SampleBatch(**item) for item in data]
        
    def get_batch_by_id(self, batch_id: str) -> Optional[SampleBatch]:
        for batch in self.get_batches():
            if batch.batch_id == batch_id:
                return batch
        return None
        
    def save_shipment(self, shipment: Shipment):
        shipments = self._load('shipments')
        shipments.append(shipment.__dict__)
        self._save('shipments', shipments)
        
    def get_shipments(self) -> List[Shipment]:
        data = self._load('shipments')
        return [Shipment(**item) for item in data]
        
    def get_shipment_by_id(self, shipment_id: str) -> Optional[Shipment]:
        for shipment in self.get_shipments():
            if shipment.shipment_id == shipment_id:
                return shipment
        return None
        
    def save_feedback(self, feedback: Feedback):
        feedbacks = self._load('feedbacks')
        feedbacks.append(feedback.__dict__)
        self._save('feedbacks', feedbacks)
        
    def get_feedbacks(self) -> List[Feedback]:
        data = self._load('feedbacks')
        return [Feedback(**item) for item in data]
        
    def get_feedback_by_shipment(self, shipment_id: str) -> Optional[Feedback]:
        for feedback in self.get_feedbacks():
            if feedback.shipment_id == shipment_id:
                return feedback
        return None
        
    def save_recovery(self, recovery: Recovery):
        recoveries = self._load('recoveries')
        recoveries.append(recovery.__dict__)
        self._save('recoveries', recoveries)
        
    def get_recoveries(self) -> List[Recovery]:
        data = self._load('recoveries')
        return [Recovery(**item) for item in data]
        
    def get_recovery_by_shipment(self, shipment_id: str) -> Optional[Recovery]:
        for recovery in self.get_recoveries():
            if recovery.shipment_id == shipment_id:
                return recovery
        return None
        
    def get_recovery_by_id(self, recovery_id: str) -> Optional[Recovery]:
        for recovery in self.get_recoveries():
            if recovery.recovery_id == recovery_id:
                return recovery
        return None
        
    def save_compensation(self, compensation: Compensation):
        compensations = self._load('compensations')
        compensations.append(compensation.__dict__)
        self._save('compensations', compensations)
        
    def get_compensations(self) -> List[Compensation]:
        data = self._load('compensations')
        return [Compensation(**item) for item in data]
        
    def get_compensation_by_recovery(self, recovery_id: str) -> Optional[Compensation]:
        for compensation in self.get_compensations():
            if compensation.recovery_id == recovery_id:
                return compensation
        return None
