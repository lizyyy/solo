from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from .models import SampleBatch, Shipment, Feedback, Recovery, Compensation
from .storage import DataStorage


@dataclass
class ShipmentStatus:
    shipment: Shipment
    batch: SampleBatch
    feedback: Optional[Feedback]
    recovery: Optional[Recovery]
    compensation: Optional[Compensation]
    
    @property
    def status(self) -> str:
        if self.recovery:
            if self.recovery.lost_quantity > 0:
                if self.compensation:
                    return '已赔付'
                return '丢失未赔付'
            return '已回收'
        if self.feedback:
            return '已反馈'
        return '在途'
    
    @property
    def anomalies(self) -> List[str]:
        anomalies = []
        
        if not self.feedback and self.recovery:
            anomalies.append('反馈缺失')
            
        if self.recovery:
            if self.recovery.quantity_recovered > self.shipment.quantity:
                anomalies.append('剩余量大于发出量')
                
            if self.recovery.lost_quantity > 0 and not self.compensation:
                anomalies.append('样品丢失未赔付')
                
        return anomalies


@dataclass
class ReportData:
    total_batches: int
    total_shipments: int
    shipments_in_transit: int
    shipments_with_feedback: int
    shipments_recovered: int
    shipments_lost: int
    shipments_compensated: int
    anomalies: List[Dict[str, Any]]
    fragrance_ratings: List[Dict[str, Any]]
    outstanding_samples: List[Dict[str, Any]]


class SampleManager:
    def __init__(self, storage: DataStorage):
        self.storage = storage
        
    def create_batch(self, batch_id: str, fragrance_name: str, total_quantity: int, 
                     production_date: str, notes: Optional[str] = None) -> SampleBatch:
        if self.storage.get_batch_by_id(batch_id):
            raise ValueError(f'批次ID {batch_id} 已存在')
        if total_quantity < 0:
            raise ValueError('总数量不能为负数')
            
        batch = SampleBatch(
            batch_id=batch_id,
            fragrance_name=fragrance_name,
            total_quantity=total_quantity,
            production_date=production_date,
            notes=notes
        )
        self.storage.save_batch(batch)
        return batch
        
    def ship(self, shipment_id: str, batch_id: str, store_name: str, quantity: int,
             shipment_date: str, responsible_person: Optional[str] = None,
             notes: Optional[str] = None) -> Shipment:
        batch = self.storage.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f'批次 {batch_id} 不存在')
            
        if quantity <= 0:
            raise ValueError('发样数量必须大于0')
            
        total_shipped = sum(s.quantity for s in self.storage.get_shipments() 
                          if s.batch_id == batch_id)
        if total_shipped + quantity > batch.total_quantity:
            raise ValueError(f'发样数量超过批次总量，剩余可用: {batch.total_quantity - total_shipped}')
            
        for shipment in self.storage.get_shipments():
            if shipment.batch_id == batch_id and shipment.store_name == store_name:
                raise ValueError(
                    f'警告：同一批次 {batch_id} 已发样到门店 {store_name}，请确认是否重复发样'
                )
                
        shipment = Shipment(
            shipment_id=shipment_id,
            batch_id=batch_id,
            store_name=store_name,
            quantity=quantity,
            shipment_date=shipment_date,
            responsible_person=responsible_person,
            notes=notes
        )
        self.storage.save_shipment(shipment)
        return shipment
        
    def register_feedback(self, feedback_id: str, shipment_id: str, rating: int,
                          comments: Optional[str] = None, feedback_date: Optional[str] = None,
                          tester_name: Optional[str] = None) -> Feedback:
        shipment = self.storage.get_shipment_by_id(shipment_id)
        if not shipment:
            raise ValueError(f'发样记录 {shipment_id} 不存在')
            
        if rating < 1 or rating > 5:
            raise ValueError('评分必须在1-5之间')
            
        if self.storage.get_feedback_by_shipment(shipment_id):
            raise ValueError(f'发样记录 {shipment_id} 已有反馈')
            
        feedback = Feedback(
            feedback_id=feedback_id,
            shipment_id=shipment_id,
            rating=rating,
            comments=comments,
            feedback_date=feedback_date,
            tester_name=tester_name
        )
        self.storage.save_feedback(feedback)
        return feedback
        
    def recover(self, recovery_id: str, shipment_id: str, quantity_recovered: int,
                recovery_date: str, lost_quantity: int = 0,
                notes: Optional[str] = None) -> Recovery:
        shipment = self.storage.get_shipment_by_id(shipment_id)
        if not shipment:
            raise ValueError(f'发样记录 {shipment_id} 不存在')
            
        if self.storage.get_recovery_by_shipment(shipment_id):
            raise ValueError(f'发样记录 {shipment_id} 已有回收记录')
            
        if quantity_recovered < 0 or lost_quantity < 0:
            raise ValueError('数量不能为负数')
            
        if quantity_recovered + lost_quantity > shipment.quantity:
            raise ValueError('回收数量 + 丢失数量不能超过发出数量')
            
        if quantity_recovered > shipment.quantity:
            raise ValueError('剩余量不能大于发出量')
            
        recovery = Recovery(
            recovery_id=recovery_id,
            shipment_id=shipment_id,
            quantity_recovered=quantity_recovered,
            recovery_date=recovery_date,
            lost_quantity=lost_quantity,
            notes=notes
        )
        self.storage.save_recovery(recovery)
        return recovery
        
    def compensate(self, compensation_id: str, recovery_id: str, amount: float,
                   compensation_date: str, responsible_person: Optional[str] = None,
                   notes: Optional[str] = None) -> Compensation:
        recovery = self.storage.get_recovery_by_id(recovery_id)
        if not recovery:
            raise ValueError(f'回收记录 {recovery_id} 不存在')
            
        if recovery.lost_quantity <= 0:
            raise ValueError('该回收记录没有丢失的样品')
            
        if self.storage.get_compensation_by_recovery(recovery_id):
            raise ValueError(f'回收记录 {recovery_id} 已有赔付记录')
            
        if amount < 0:
            raise ValueError('赔付金额不能为负数')
            
        compensation = Compensation(
            compensation_id=compensation_id,
            recovery_id=recovery_id,
            amount=amount,
            compensation_date=compensation_date,
            responsible_person=responsible_person,
            notes=notes
        )
        self.storage.save_compensation(compensation)
        return compensation
        
    def calculate_remaining_quantity(self, batch_id: str) -> int:
        batch = self.storage.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f'批次 {batch_id} 不存在')
            
        total_shipped = sum(s.quantity for s in self.storage.get_shipments() 
                          if s.batch_id == batch_id)
        return batch.total_quantity - total_shipped
        
    def get_shipment_status(self, shipment_id: str) -> ShipmentStatus:
        shipment = self.storage.get_shipment_by_id(shipment_id)
        if not shipment:
            raise ValueError(f'发样记录 {shipment_id} 不存在')
            
        batch = self.storage.get_batch_by_id(shipment.batch_id)
        feedback = self.storage.get_feedback_by_shipment(shipment_id)
        recovery = self.storage.get_recovery_by_shipment(shipment_id)
        compensation = None
        if recovery:
            compensation = self.storage.get_compensation_by_recovery(recovery.recovery_id)
            
        return ShipmentStatus(
            shipment=shipment,
            batch=batch,
            feedback=feedback,
            recovery=recovery,
            compensation=compensation
        )
        
    def generate_report(self) -> ReportData:
        all_shipments = self.storage.get_shipments()
        all_batches = self.storage.get_batches()
        
        shipment_statuses = [self.get_shipment_status(s.shipment_id) for s in all_shipments]
        
        in_transit = [s for s in shipment_statuses if s.status == '在途']
        with_feedback = [s for s in shipment_statuses if s.status == '已反馈']
        recovered = [s for s in shipment_statuses if s.status == '已回收']
        lost = [s for s in shipment_statuses if s.status in ['丢失未赔付', '已赔付']]
        compensated = [s for s in shipment_statuses if s.status == '已赔付']
        
        anomalies = []
        for status in shipment_statuses:
            if status.anomalies:
                anomalies.append({
                    'shipment_id': status.shipment.shipment_id,
                    'batch_id': status.shipment.batch_id,
                    'fragrance': status.batch.fragrance_name,
                    'store': status.shipment.store_name,
                    'anomalies': status.anomalies,
                    'status': status.status
                })
                
        fragrance_ratings = {}
        for status in shipment_statuses:
            if status.feedback:
                name = status.batch.fragrance_name
                if name not in fragrance_ratings:
                    fragrance_ratings[name] = {'ratings': [], 'count': 0}
                fragrance_ratings[name]['ratings'].append(status.feedback.rating)
                fragrance_ratings[name]['count'] += 1
                
        fragrance_stats = []
        for name, data in fragrance_ratings.items():
            avg_rating = sum(data['ratings']) / len(data['ratings'])
            fragrance_stats.append({
                'fragrance': name,
                'avg_rating': round(avg_rating, 2),
                'feedback_count': data['count']
            })
        fragrance_stats.sort(key=lambda x: x['avg_rating'], reverse=True)
        
        outstanding = []
        for status in in_transit + with_feedback:
            if not status.recovery:
                outstanding.append({
                    'shipment_id': status.shipment.shipment_id,
                    'batch_id': status.shipment.batch_id,
                    'fragrance': status.batch.fragrance_name,
                    'store': status.shipment.store_name,
                    'quantity': status.shipment.quantity,
                    'shipment_date': status.shipment.shipment_date,
                    'status': status.status,
                    'responsible_person': status.shipment.responsible_person
                })
                
        return ReportData(
            total_batches=len(all_batches),
            total_shipments=len(all_shipments),
            shipments_in_transit=len(in_transit),
            shipments_with_feedback=len(with_feedback),
            shipments_recovered=len(recovered),
            shipments_lost=len(lost),
            shipments_compensated=len(compensated),
            anomalies=anomalies,
            fragrance_ratings=fragrance_stats,
            outstanding_samples=outstanding
        )
