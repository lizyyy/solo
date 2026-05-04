from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy import and_

from .config import Config
from .database import db_session
from .models import (
    Pet, MedicationRecord, Note, CameraImage, AbnormalCall,
    Risk, RiskType, RiskStatus
)


class RiskDetector:
    def __init__(self, config: Config = None):
        self.config = config or Config()

    def _create_risk(self, session, pet_id: int, risk_type: RiskType, 
                      description: str, severity: int = 1,
                      medication_record_id: int = None, note_id: int = None,
                      camera_image_id: int = None, abnormal_call_id: int = None) -> Risk:
        
        existing = session.query(Risk).filter(
            and_(
                Risk.pet_id == pet_id,
                Risk.risk_type == risk_type,
                Risk.status.in_([RiskStatus.PENDING, RiskStatus.CONFIRMED]),
                Risk.description == description
            )
        ).first()
        
        if existing:
            return existing
        
        risk = Risk(
            pet_id=pet_id,
            risk_type=risk_type,
            status=RiskStatus.PENDING,
            severity=severity,
            description=description,
            medication_record_id=medication_record_id,
            note_id=note_id,
            camera_image_id=camera_image_id,
            abnormal_call_id=abnormal_call_id
        )
        session.add(risk)
        return risk

    def detect_missed_medications(self, session) -> List[Dict[str, Any]]:
        risks = []
        now = datetime.now()
        today = date.today()
        
        threshold_hours = 2
        
        default_times = self.config.default_medication_times
        
        pets = session.query(Pet).filter(Pet.check_out_date.is_(None)).all()
        
        for pet in pets:
            for time_str in default_times:
                hour, minute = map(int, time_str.split(':'))
                scheduled_time = datetime(today.year, today.month, today.day, hour, minute)
                
                if now < scheduled_time:
                    continue
                
                if now - scheduled_time > timedelta(hours=threshold_hours):
                    record = session.query(MedicationRecord).filter(
                        and_(
                            MedicationRecord.pet_id == pet.id,
                            MedicationRecord.scheduled_time >= scheduled_time - timedelta(minutes=30),
                            MedicationRecord.scheduled_time <= scheduled_time + timedelta(minutes=30)
                        )
                    ).first()
                    
                    if not record or not record.is_administered:
                        description = f"宠物 {pet.name} 在 {time_str} 的喂药时间已过 {threshold_hours} 小时，未确认喂药"
                        
                        risk = self._create_risk(
                            session, pet.id,
                            RiskType.MISSED_MEDICATION,
                            description,
                            severity=3,
                            medication_record_id=record.id if record else None
                        )
                        
                        risks.append({
                            'risk_id': risk.id,
                            'pet_id': pet.id,
                            'pet_name': pet.name,
                            'risk_type': RiskType.MISSED_MEDICATION.value,
                            'description': description,
                            'scheduled_time': scheduled_time.isoformat()
                        })
        
        return risks

    def detect_unconfirmed_notes(self, session) -> List[Dict[str, Any]]:
        risks = []
        now = datetime.now()
        threshold_hours = self.config.unconfirmed_note_hours
        
        notes = session.query(Note).filter(
            and_(
                Note.is_confirmed == False,
                Note.created_at <= now - timedelta(hours=threshold_hours)
            )
        ).all()
        
        for note in notes:
            pet = session.query(Pet).filter(Pet.id == note.pet_id).first()
            if not pet:
                continue
            
            description = f"宠物 {pet.name} 的备注已超过 {threshold_hours} 小时未确认"
            
            risk = self._create_risk(
                session, pet.id,
                RiskType.UNCONFIRMED_NOTE,
                description,
                severity=2,
                note_id=note.id
            )
            
            risks.append({
                'risk_id': risk.id,
                'pet_id': pet.id,
                'pet_name': pet.name,
                'risk_type': RiskType.UNCONFIRMED_NOTE.value,
                'description': description,
                'note_created_at': note.created_at.isoformat() if note.created_at else None
            })
        
        return risks

    def detect_mixed_cage(self, session) -> List[Dict[str, Any]]:
        risks = []
        today = date.today()
        threshold = self.config.mixed_cage_threshold
        
        start_time = datetime.combine(today, datetime.min.time())
        
        images = session.query(CameraImage).filter(
            and_(
                CameraImage.has_other_pets == True,
                CameraImage.capture_time >= start_time
            )
        ).all()
        
        pet_image_counts = {}
        for image in images:
            key = image.pet_id
            if key not in pet_image_counts:
                pet_image_counts[key] = {
                    'count': 0,
                    'images': []
                }
            pet_image_counts[key]['count'] += 1
            pet_image_counts[key]['images'].append(image)
        
        for pet_id, data in pet_image_counts.items():
            if data['count'] >= threshold:
                pet = session.query(Pet).filter(Pet.id == pet_id).first()
                if not pet:
                    continue
                
                latest_image = max(data['images'], key=lambda x: x.capture_time)
                
                detected_pets = []
                try:
                    import json
                    if latest_image.detected_pets:
                        detected_pets = json.loads(latest_image.detected_pets)
                except Exception:
                    pass
                
                description = f"宠物 {pet.name} 今日已在 {data['count']} 张照片中与其他宠物同时出现，可能混笼。检测到: {', '.join(detected_pets)}"
                
                risk = self._create_risk(
                    session, pet.id,
                    RiskType.MIXED_CAGE,
                    description,
                    severity=2,
                    camera_image_id=latest_image.id
                )
                
                risks.append({
                    'risk_id': risk.id,
                    'pet_id': pet.id,
                    'pet_name': pet.name,
                    'risk_type': RiskType.MIXED_CAGE.value,
                    'description': description,
                    'image_count': data['count'],
                    'detected_pets': detected_pets
                })
        
        return risks

    def detect_night_abnormal_calls(self, session) -> List[Dict[str, Any]]:
        risks = []
        today = date.today()
        threshold = self.config.night_abnormal_calls_threshold
        
        night_start = self.config.night_start_hour
        night_end = self.config.night_end_hour
        
        start_time = datetime.combine(today, datetime.min.time())
        
        calls = session.query(AbnormalCall).filter(
            and_(
                AbnormalCall.is_night_time == True,
                AbnormalCall.call_time >= start_time
            )
        ).all()
        
        pet_call_counts = {}
        for call in calls:
            key = call.pet_id
            if key not in pet_call_counts:
                pet_call_counts[key] = {
                    'count': 0,
                    'calls': [],
                    'total_duration': 0
                }
            pet_call_counts[key]['count'] += 1
            pet_call_counts[key]['calls'].append(call)
            pet_call_counts[key]['total_duration'] += call.duration_seconds
        
        for pet_id, data in pet_call_counts.items():
            if data['count'] >= threshold:
                pet = session.query(Pet).filter(Pet.id == pet_id).first()
                if not pet:
                    continue
                
                latest_call = max(data['calls'], key=lambda x: x.call_time)
                
                description = f"宠物 {pet.name} 夜间（{night_start}:00 - {night_end}:00）已发生 {data['count']} 次异常叫声，总时长 {data['total_duration']:.1f} 秒"
                
                risk = self._create_risk(
                    session, pet.id,
                    RiskType.NIGHT_ABNORMAL_CALL,
                    description,
                    severity=3,
                    abnormal_call_id=latest_call.id
                )
                
                risks.append({
                    'risk_id': risk.id,
                    'pet_id': pet.id,
                    'pet_name': pet.name,
                    'risk_type': RiskType.NIGHT_ABNORMAL_CALL.value,
                    'description': description,
                    'call_count': data['count'],
                    'total_duration': data['total_duration']
                })
        
        return risks

    def run_all_detections(self) -> Dict[str, List[Dict[str, Any]]]:
        results = {}
        
        with db_session() as session:
            results['missed_medications'] = self.detect_missed_medications(session)
            results['unconfirmed_notes'] = self.detect_unconfirmed_notes(session)
            results['mixed_cage'] = self.detect_mixed_cage(session)
            results['night_abnormal_calls'] = self.detect_night_abnormal_calls(session)
        
        return results

    def get_pending_risks(self, session) -> List[Risk]:
        return session.query(Risk).filter(
            Risk.status.in_([RiskStatus.PENDING, RiskStatus.CONFIRMED])
        ).order_by(Risk.severity.desc(), Risk.detected_at.desc()).all()

    def get_risks_by_type(self, session, risk_type: RiskType) -> List[Risk]:
        return session.query(Risk).filter(
            Risk.risk_type == risk_type
        ).order_by(Risk.detected_at.desc()).all()

    def get_risks_by_pet(self, session, pet_id: int) -> List[Risk]:
        return session.query(Risk).filter(
            Risk.pet_id == pet_id
        ).order_by(Risk.detected_at.desc()).all()

    def resolve_risk(self, session, risk_id: int, resolved_by: str, 
                       resolution_notes: str = None) -> Optional[Risk]:
        risk = session.query(Risk).filter(Risk.id == risk_id).first()
        if not risk:
            return None
        
        risk.status = RiskStatus.RESOLVED
        risk.resolved_at = datetime.now()
        risk.resolved_by = resolved_by
        risk.resolution_notes = resolution_notes
        
        return risk

    def dismiss_risk(self, session, risk_id: int, dismissed_by: str, 
                      reason: str = None) -> Optional[Risk]:
        risk = session.query(Risk).filter(Risk.id == risk_id).first()
        if not risk:
            return None
        
        risk.status = RiskStatus.DISMISSED
        risk.resolved_at = datetime.now()
        risk.resolved_by = dismissed_by
        risk.resolution_notes = reason
        
        return risk

    def confirm_risk(self, session, risk_id: int) -> Optional[Risk]:
        risk = session.query(Risk).filter(Risk.id == risk_id).first()
        if not risk:
            return None
        
        risk.status = RiskStatus.CONFIRMED
        
        return risk
