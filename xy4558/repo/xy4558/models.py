#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站数据模型
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
import uuid


class Deceased:
    def __init__(self, deceased_id: str, name: str, gender: str, age: int,
                 id_card: str, date_of_death: str, cause_of_death: str,
                 contact_person: str, contact_phone: str, cabinet_id: Optional[str] = None):
        self.deceased_id = deceased_id
        self.name = name
        self.gender = gender
        self.age = age
        self.id_card = id_card
        self.date_of_death = date_of_death
        self.cause_of_death = cause_of_death
        self.contact_person = contact_person
        self.contact_phone = contact_phone
        self.cabinet_id = cabinet_id
        self.created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'deceased_id': self.deceased_id,
            'name': self.name,
            'gender': self.gender,
            'age': self.age,
            'id_card': self.id_card,
            'date_of_death': self.date_of_death,
            'cause_of_death': self.cause_of_death,
            'contact_person': self.contact_person,
            'contact_phone': self.contact_phone,
            'cabinet_id': self.cabinet_id,
            'created_at': self.created_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Deceased':
        obj = cls(
            deceased_id=data['deceased_id'],
            name=data['name'],
            gender=data['gender'],
            age=data['age'],
            id_card=data['id_card'],
            date_of_death=data['date_of_death'],
            cause_of_death=data['cause_of_death'],
            contact_person=data['contact_person'],
            contact_phone=data['contact_phone'],
            cabinet_id=data.get('cabinet_id')
        )
        obj.created_at = data.get('created_at', obj.created_at)
        return obj


class Cabinet:
    def __init__(self, cabinet_id: str, location: str, status: str,
                 current_deceased_id: Optional[str] = None,
                 min_temp: float = -18.0, max_temp: float = -15.0,
                 current_temp: Optional[float] = None,
                 last_temp_check: Optional[str] = None):
        self.cabinet_id = cabinet_id
        self.location = location
        self.status = status
        self.current_deceased_id = current_deceased_id
        self.min_temp = min_temp
        self.max_temp = max_temp
        self.current_temp = current_temp
        self.last_temp_check = last_temp_check
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'cabinet_id': self.cabinet_id,
            'location': self.location,
            'status': self.status,
            'current_deceased_id': self.current_deceased_id,
            'min_temp': self.min_temp,
            'max_temp': self.max_temp,
            'current_temp': self.current_temp,
            'last_temp_check': self.last_temp_check
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Cabinet':
        return cls(
            cabinet_id=data['cabinet_id'],
            location=data['location'],
            status=data['status'],
            current_deceased_id=data.get('current_deceased_id'),
            min_temp=data.get('min_temp', -18.0),
            max_temp=data.get('max_temp', -15.0),
            current_temp=data.get('current_temp'),
            last_temp_check=data.get('last_temp_check')
        )


class TransportOrder:
    def __init__(self, order_id: str, deceased_id: str, deceased_name: str,
                 pickup_location: str, pickup_time: str, transport_person: str,
                 transport_phone: str, received_by: Optional[str] = None,
                 received_time: Optional[str] = None, signature_status: str = "未签收",
                 notes: Optional[str] = None):
        self.order_id = order_id
        self.deceased_id = deceased_id
        self.deceased_name = deceased_name
        self.pickup_location = pickup_location
        self.pickup_time = pickup_time
        self.transport_person = transport_person
        self.transport_phone = transport_phone
        self.received_by = received_by
        self.received_time = received_time
        self.signature_status = signature_status
        self.notes = notes
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'order_id': self.order_id,
            'deceased_id': self.deceased_id,
            'deceased_name': self.deceased_name,
            'pickup_location': self.pickup_location,
            'pickup_time': self.pickup_time,
            'transport_person': self.transport_person,
            'transport_phone': self.transport_phone,
            'received_by': self.received_by,
            'received_time': self.received_time,
            'signature_status': self.signature_status,
            'notes': self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TransportOrder':
        return cls(
            order_id=data['order_id'],
            deceased_id=data['deceased_id'],
            deceased_name=data['deceased_name'],
            pickup_location=data['pickup_location'],
            pickup_time=data['pickup_time'],
            transport_person=data['transport_person'],
            transport_phone=data['transport_phone'],
            received_by=data.get('received_by'),
            received_time=data.get('received_time'),
            signature_status=data.get('signature_status', "未签收"),
            notes=data.get('notes')
        )


class TemperatureRecord:
    def __init__(self, record_id: str, cabinet_id: str, temperature: float,
                 record_time: str, recorded_by: str, status: str = "正常"):
        self.record_id = record_id
        self.cabinet_id = cabinet_id
        self.temperature = temperature
        self.record_time = record_time
        self.recorded_by = recorded_by
        self.status = status
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'record_id': self.record_id,
            'cabinet_id': self.cabinet_id,
            'temperature': self.temperature,
            'record_time': self.record_time,
            'recorded_by': self.recorded_by,
            'status': self.status
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TemperatureRecord':
        return cls(
            record_id=data['record_id'],
            cabinet_id=data['cabinet_id'],
            temperature=data['temperature'],
            record_time=data['record_time'],
            recorded_by=data['recorded_by'],
            status=data.get('status', "正常")
        )


class FarewellBooking:
    def __init__(self, booking_id: str, deceased_id: str, deceased_name: str,
                 hall_id: str, date: str, start_time: str, end_time: str,
                 booked_by: str, contact_phone: str, status: str = "已预约",
                 notes: Optional[str] = None):
        self.booking_id = booking_id
        self.deceased_id = deceased_id
        self.deceased_name = deceased_name
        self.hall_id = hall_id
        self.date = date
        self.start_time = start_time
        self.end_time = end_time
        self.booked_by = booked_by
        self.contact_phone = contact_phone
        self.status = status
        self.notes = notes
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'booking_id': self.booking_id,
            'deceased_id': self.deceased_id,
            'deceased_name': self.deceased_name,
            'hall_id': self.hall_id,
            'date': self.date,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'booked_by': self.booked_by,
            'contact_phone': self.contact_phone,
            'status': self.status,
            'notes': self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FarewellBooking':
        return cls(
            booking_id=data['booking_id'],
            deceased_id=data['deceased_id'],
            deceased_name=data['deceased_name'],
            hall_id=data['hall_id'],
            date=data['date'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            booked_by=data['booked_by'],
            contact_phone=data['contact_phone'],
            status=data.get('status', "已预约"),
            notes=data.get('notes')
        )


class CremationSchedule:
    def __init__(self, schedule_id: str, deceased_id: str, deceased_name: str,
                 furnace_id: str, date: str, start_time: str, end_time: str,
                 scheduled_by: str, status: str = "已排期",
                 notes: Optional[str] = None):
        self.schedule_id = schedule_id
        self.deceased_id = deceased_id
        self.deceased_name = deceased_name
        self.furnace_id = furnace_id
        self.date = date
        self.start_time = start_time
        self.end_time = end_time
        self.scheduled_by = scheduled_by
        self.status = status
        self.notes = notes
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'schedule_id': self.schedule_id,
            'deceased_id': self.deceased_id,
            'deceased_name': self.deceased_name,
            'furnace_id': self.furnace_id,
            'date': self.date,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'scheduled_by': self.scheduled_by,
            'status': self.status,
            'notes': self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CremationSchedule':
        return cls(
            schedule_id=data['schedule_id'],
            deceased_id=data['deceased_id'],
            deceased_name=data['deceased_name'],
            furnace_id=data['furnace_id'],
            date=data['date'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            scheduled_by=data['scheduled_by'],
            status=data.get('status', "已排期"),
            notes=data.get('notes')
        )


class Document:
    def __init__(self, doc_id: str, deceased_id: str, deceased_name: str,
                 doc_type: str, doc_name: str, status: str,
                 submitted_date: Optional[str] = None, notes: Optional[str] = None):
        self.doc_id = doc_id
        self.deceased_id = deceased_id
        self.deceased_name = deceased_name
        self.doc_type = doc_type
        self.doc_name = doc_name
        self.status = status
        self.submitted_date = submitted_date
        self.notes = notes
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'doc_id': self.doc_id,
            'deceased_id': self.deceased_id,
            'deceased_name': self.deceased_name,
            'doc_type': self.doc_type,
            'doc_name': self.doc_name,
            'status': self.status,
            'submitted_date': self.submitted_date,
            'notes': self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Document':
        return cls(
            doc_id=data['doc_id'],
            deceased_id=data['deceased_id'],
            deceased_name=data['deceased_name'],
            doc_type=data['doc_type'],
            doc_name=data['doc_name'],
            status=data['status'],
            submitted_date=data.get('submitted_date'),
            notes=data.get('notes')
        )


class ReviewRecord:
    def __init__(self, review_id: str, time: str, operator: str,
                 risk_type: str, risk_id: str, deceased_name: str,
                 note: str, status: str):
        self.review_id = review_id
        self.time = time
        self.operator = operator
        self.risk_type = risk_type
        self.risk_id = risk_id
        self.deceased_name = deceased_name
        self.note = note
        self.status = status
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'review_id': self.review_id,
            'time': self.time,
            'operator': self.operator,
            'risk_type': self.risk_type,
            'risk_id': self.risk_id,
            'deceased_name': self.deceased_name,
            'note': self.note,
            'status': self.status
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReviewRecord':
        return cls(
            review_id=data['review_id'],
            time=data['time'],
            operator=data['operator'],
            risk_type=data['risk_type'],
            risk_id=data['risk_id'],
            deceased_name=data['deceased_name'],
            note=data['note'],
            status=data['status']
        )


class DataStore:
    def __init__(self):
        self.deceased: Dict[str, Deceased] = {}
        self.cabinets: Dict[str, Cabinet] = {}
        self.transport_orders: Dict[str, TransportOrder] = {}
        self.temperature_records: Dict[str, TemperatureRecord] = {}
        self.farewell_bookings: Dict[str, FarewellBooking] = {}
        self.cremation_schedules: Dict[str, CremationSchedule] = {}
        self.documents: Dict[str, Document] = {}
        self.reviews: List[ReviewRecord] = []
    
    def add_deceased(self, deceased: Deceased) -> None:
        self.deceased[deceased.deceased_id] = deceased
    
    def add_cabinet(self, cabinet: Cabinet) -> None:
        self.cabinets[cabinet.cabinet_id] = cabinet
    
    def add_transport_order(self, order: TransportOrder) -> None:
        self.transport_orders[order.order_id] = order
    
    def add_temperature_record(self, record: TemperatureRecord) -> None:
        self.temperature_records[record.record_id] = record
        cabinet = self.cabinets.get(record.cabinet_id)
        if cabinet:
            cabinet.current_temp = record.temperature
            cabinet.last_temp_check = record.record_time
    
    def add_farewell_booking(self, booking: FarewellBooking) -> None:
        self.farewell_bookings[booking.booking_id] = booking
    
    def add_cremation_schedule(self, schedule: CremationSchedule) -> None:
        self.cremation_schedules[schedule.schedule_id] = schedule
    
    def add_document(self, doc: Document) -> None:
        self.documents[doc.doc_id] = doc
    
    def add_review(self, review_data: Dict[str, Any]) -> None:
        review = ReviewRecord(
            review_id=str(uuid.uuid4()),
            time=review_data.get('time', datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            operator=review_data.get('operator', '系统'),
            risk_type=review_data.get('risk_type', ''),
            risk_id=review_data.get('risk_id', ''),
            deceased_name=review_data.get('deceased_name', ''),
            note=review_data.get('note', ''),
            status=review_data.get('status', '待处理')
        )
        self.reviews.append(review)
    
    def get_deceased_by_id(self, deceased_id: str) -> Optional[Deceased]:
        return self.deceased.get(deceased_id)
    
    def get_deceased_by_cabinet(self, cabinet_id: str) -> Optional[Deceased]:
        for deceased in self.deceased.values():
            if deceased.cabinet_id == cabinet_id:
                return deceased
        return None
    
    def get_cabinet_by_deceased(self, deceased_id: str) -> Optional[Cabinet]:
        deceased = self.get_deceased_by_id(deceased_id)
        if deceased and deceased.cabinet_id:
            return self.cabinets.get(deceased.cabinet_id)
        return None
    
    def get_transport_order_by_deceased(self, deceased_id: str) -> Optional[TransportOrder]:
        for order in self.transport_orders.values():
            if order.deceased_id == deceased_id:
                return order
        return None
    
    def get_temperature_records_by_cabinet(self, cabinet_id: str) -> List[TemperatureRecord]:
        return [r for r in self.temperature_records.values() if r.cabinet_id == cabinet_id]
    
    def get_latest_temperature(self, cabinet_id: str) -> Optional[TemperatureRecord]:
        records = self.get_temperature_records_by_cabinet(cabinet_id)
        if not records:
            return None
        return sorted(records, key=lambda x: x.record_time, reverse=True)[0]
    
    def get_farewell_bookings_by_deceased(self, deceased_id: str) -> List[FarewellBooking]:
        return [b for b in self.farewell_bookings.values() if b.deceased_id == deceased_id]
    
    def get_cremation_schedules_by_deceased(self, deceased_id: str) -> List[CremationSchedule]:
        return [s for s in self.cremation_schedules.values() if s.deceased_id == deceased_id]
    
    def get_documents_by_deceased(self, deceased_id: str) -> List[Document]:
        return [d for d in self.documents.values() if d.deceased_id == deceased_id]
    
    def get_missing_documents(self, deceased_id: str) -> List[str]:
        required_docs = ['死亡证明', '身份证复印件', '火化申请表', '委托书']
        submitted = [d.doc_type for d in self.get_documents_by_deceased(deceased_id) if d.status == '已提交']
        return [doc for doc in required_docs if doc not in submitted]
    
    def get_cabinet_data(self) -> List[Dict[str, Any]]:
        result = []
        for cabinet in self.cabinets.values():
            deceased = self.get_deceased_by_cabinet(cabinet.cabinet_id)
            latest_temp = self.get_latest_temperature(cabinet.cabinet_id)
            
            temp_status = "正常"
            if latest_temp:
                if latest_temp.temperature > cabinet.max_temp or latest_temp.temperature < cabinet.min_temp:
                    temp_status = "异常"
            
            doc_status = "完整"
            if deceased:
                missing = self.get_missing_documents(deceased.deceased_id)
                if missing:
                    doc_status = f"缺失{len(missing)}项"
            
            result.append({
                'cabinet_id': cabinet.cabinet_id,
                'deceased_name': deceased.name if deceased else '空柜',
                'start_time': latest_temp.record_time if latest_temp else '无记录',
                'expected_end_time': '待定',
                'temp_status': temp_status,
                'document_status': doc_status
            })
        return result
    
    def get_schedule_data(self) -> List[Dict[str, Any]]:
        result = []
        
        for booking in self.farewell_bookings.values():
            result.append({
                'date': booking.date,
                'time_slot': f"{booking.start_time}-{booking.end_time}",
                'deceased_name': booking.deceased_name,
                'service_type': '告别厅',
                'location': booking.hall_id,
                'status': booking.status
            })
        
        for schedule in self.cremation_schedules.values():
            result.append({
                'date': schedule.date,
                'time_slot': f"{schedule.start_time}-{schedule.end_time}",
                'deceased_name': schedule.deceased_name,
                'service_type': '火化炉',
                'location': schedule.furnace_id,
                'status': schedule.status
            })
        
        result.sort(key=lambda x: (x['date'], x['time_slot']))
        return result
    
    def get_reviews(self) -> List[Dict[str, Any]]:
        return [
            {
                'review_id': r.review_id,
                'time': r.time,
                'operator': r.operator,
                'risk_type': r.risk_type,
                'risk_id': r.risk_id,
                'deceased_name': r.deceased_name,
                'note': r.note,
                'status': r.status
            }
            for r in self.reviews
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'deceased': {k: v.to_dict() for k, v in self.deceased.items()},
            'cabinets': {k: v.to_dict() for k, v in self.cabinets.items()},
            'transport_orders': {k: v.to_dict() for k, v in self.transport_orders.items()},
            'temperature_records': {k: v.to_dict() for k, v in self.temperature_records.items()},
            'farewell_bookings': {k: v.to_dict() for k, v in self.farewell_bookings.items()},
            'cremation_schedules': {k: v.to_dict() for k, v in self.cremation_schedules.items()},
            'documents': {k: v.to_dict() for k, v in self.documents.items()},
            'reviews': [r.to_dict() for r in self.reviews]
        }
    
    def from_dict(self, data: Dict[str, Any]) -> None:
        for k, v in data.get('deceased', {}).items():
            self.deceased[k] = Deceased.from_dict(v)
        for k, v in data.get('cabinets', {}).items():
            self.cabinets[k] = Cabinet.from_dict(v)
        for k, v in data.get('transport_orders', {}).items():
            self.transport_orders[k] = TransportOrder.from_dict(v)
        for k, v in data.get('temperature_records', {}).items():
            self.temperature_records[k] = TemperatureRecord.from_dict(v)
        for k, v in data.get('farewell_bookings', {}).items():
            self.farewell_bookings[k] = FarewellBooking.from_dict(v)
        for k, v in data.get('cremation_schedules', {}).items():
            self.cremation_schedules[k] = CremationSchedule.from_dict(v)
        for k, v in data.get('documents', {}).items():
            self.documents[k] = Document.from_dict(v)
        for v in data.get('reviews', []):
            self.reviews.append(ReviewRecord.from_dict(v))
