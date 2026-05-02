from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy.exc import IntegrityError
from app import db
from app.models.models import (
    ImportBatch,
    Program,
    Contract,
    Advertisement,
    BroadcastEvent,
    BlackoutPeriod,
    IndustryConflict,
    ValidationResult,
    HumanOpinion,
    AuditLog
)

class StorageService:
    
    @staticmethod
    def create_import_batch(batch_type: str, file_name: str) -> ImportBatch:
        batch = ImportBatch(
            batch_type=batch_type,
            file_name=file_name,
            status='processing'
        )
        db.session.add(batch)
        db.session.commit()
        return batch
    
    @staticmethod
    def update_import_batch(batch_id: int, **kwargs) -> Optional[ImportBatch]:
        batch = ImportBatch.query.get(batch_id)
        if batch:
            for key, value in kwargs.items():
                setattr(batch, key, value)
            db.session.commit()
        return batch
    
    @staticmethod
    def get_import_batch(batch_id: int) -> Optional[ImportBatch]:
        return ImportBatch.query.get(batch_id)
    
    @staticmethod
    def list_import_batches(batch_type: Optional[str] = None) -> List[ImportBatch]:
        query = ImportBatch.query
        if batch_type:
            query = query.filter_by(batch_type=batch_type)
        return query.order_by(ImportBatch.import_date.desc()).all()

    @staticmethod
    def create_program(data: Dict[str, Any]) -> Program:
        program = Program(**data)
        db.session.add(program)
        try:
            db.session.commit()
            return program
        except IntegrityError:
            db.session.rollback()
            raise
    
    @staticmethod
    def get_program_by_code(program_code: str, broadcast_date: date) -> Optional[Program]:
        return Program.query.filter_by(
            program_code=program_code,
            broadcast_date=broadcast_date
        ).first()
    
    @staticmethod
    def list_programs(broadcast_date: Optional[date] = None, 
                      channel: Optional[str] = None) -> List[Program]:
        query = Program.query
        if broadcast_date:
            query = query.filter_by(broadcast_date=broadcast_date)
        if channel:
            query = query.filter_by(channel=channel)
        return query.order_by(Program.broadcast_date, Program.start_time).all()
    
    @staticmethod
    def get_children_programs(broadcast_date: Optional[date] = None) -> List[Program]:
        query = Program.query.filter_by(is_children_program=True)
        if broadcast_date:
            query = query.filter_by(broadcast_date=broadcast_date)
        return query.all()

    @staticmethod
    def create_contract(data: Dict[str, Any]) -> Contract:
        contract = Contract(**data)
        contract.remaining_duration_seconds = contract.total_duration_seconds
        db.session.add(contract)
        try:
            db.session.commit()
            return contract
        except IntegrityError:
            db.session.rollback()
            raise
    
    @staticmethod
    def get_contract_by_code(contract_code: str) -> Optional[Contract]:
        return Contract.query.filter_by(contract_code=contract_code).first()
    
    @staticmethod
    def list_contracts(status: Optional[str] = None) -> List[Contract]:
        query = Contract.query
        if status:
            query = query.filter_by(status=status)
        return query.order_by(Contract.start_date).all()
    
    @staticmethod
    def update_contract_usage(contract_id: int, used_seconds: int) -> Optional[Contract]:
        contract = Contract.query.get(contract_id)
        if contract:
            contract.used_duration_seconds += used_seconds
            contract.remaining_duration_seconds = max(0, contract.total_duration_seconds - contract.used_duration_seconds)
            if contract.remaining_duration_seconds == 0:
                contract.status = 'completed'
            db.session.commit()
        return contract

    @staticmethod
    def create_advertisement(data: Dict[str, Any]) -> Advertisement:
        ad = Advertisement(**data)
        db.session.add(ad)
        try:
            db.session.commit()
            return ad
        except IntegrityError:
            db.session.rollback()
            raise
    
    @staticmethod
    def get_ad_by_code(ad_code: str) -> Optional[Advertisement]:
        return Advertisement.query.filter_by(ad_code=ad_code).first()

    @staticmethod
    def create_broadcast_event(data: Dict[str, Any]) -> BroadcastEvent:
        event = BroadcastEvent(**data)
        db.session.add(event)
        try:
            db.session.commit()
            return event
        except IntegrityError:
            db.session.rollback()
            raise
    
    @staticmethod
    def get_event_by_code(event_code: str) -> Optional[BroadcastEvent]:
        return BroadcastEvent.query.filter_by(event_code=event_code).first()
    
    @staticmethod
    def list_events(broadcast_date: Optional[date] = None,
                    source_type: Optional[str] = None,
                    status: Optional[str] = None) -> List[BroadcastEvent]:
        query = BroadcastEvent.query
        if broadcast_date:
            query = query.filter_by(broadcast_date=broadcast_date)
        if source_type:
            query = query.filter_by(source_type=source_type)
        if status:
            query = query.filter_by(status=status)
        return query.order_by(BroadcastEvent.broadcast_date, 
                               BroadcastEvent.broadcast_time).all()
    
    @staticmethod
    def get_events_by_brand(brand_name: str, 
                            broadcast_date: Optional[date] = None) -> List[BroadcastEvent]:
        query = BroadcastEvent.query.filter_by(brand_name=brand_name)
        if broadcast_date:
            query = query.filter_by(broadcast_date=broadcast_date)
        return query.order_by(BroadcastEvent.broadcast_date, 
                               BroadcastEvent.broadcast_time).all()
    
    @staticmethod
    def get_events_by_time_range(start_dt: datetime, end_dt: datetime) -> List[BroadcastEvent]:
        return BroadcastEvent.query.filter(
            BroadcastEvent.broadcast_date.between(start_dt.date(), end_dt.date())
        ).order_by(BroadcastEvent.broadcast_date, BroadcastEvent.broadcast_time).all()

    @staticmethod
    def create_blackout_period(data: Dict[str, Any]) -> BlackoutPeriod:
        period = BlackoutPeriod(**data)
        db.session.add(period)
        db.session.commit()
        return period
    
    @staticmethod
    def list_active_blackout_periods() -> List[BlackoutPeriod]:
        return BlackoutPeriod.query.filter_by(is_active=True).all()

    @staticmethod
    def create_industry_conflict(data: Dict[str, Any]) -> IndustryConflict:
        conflict = IndustryConflict(**data)
        db.session.add(conflict)
        try:
            db.session.commit()
            return conflict
        except IntegrityError:
            db.session.rollback()
            raise
    
    @staticmethod
    def list_active_conflicts() -> List[IndustryConflict]:
        return IndustryConflict.query.filter_by(is_active=True).all()
    
    @staticmethod
    def get_conflict_between(cat_a: str, cat_b: str) -> Optional[IndustryConflict]:
        return IndustryConflict.query.filter(
            db.or_(
                db.and_(IndustryConflict.category_a == cat_a, IndustryConflict.category_b == cat_b),
                db.and_(IndustryConflict.category_a == cat_b, IndustryConflict.category_b == cat_a)
            ),
            IndustryConflict.is_active == True
        ).first()

    @staticmethod
    def create_validation_result(data: Dict[str, Any]) -> ValidationResult:
        result = ValidationResult(**data)
        db.session.add(result)
        db.session.commit()
        return result
    
    @staticmethod
    def get_validation_results(event_id: Optional[int] = None,
                                status: Optional[str] = None,
                                validation_type: Optional[str] = None) -> List[ValidationResult]:
        query = ValidationResult.query
        if event_id:
            query = query.filter_by(event_id=event_id)
        if status:
            query = query.filter_by(status=status)
        if validation_type:
            query = query.filter_by(validation_type=validation_type)
        return query.order_by(ValidationResult.created_at.desc()).all()
    
    @staticmethod
    def update_validation_result(result_id: int, **kwargs) -> Optional[ValidationResult]:
        result = ValidationResult.query.get(result_id)
        if result:
            for key, value in kwargs.items():
                setattr(result, key, value)
            db.session.commit()
        return result

    @staticmethod
    def create_human_opinion(data: Dict[str, Any]) -> HumanOpinion:
        opinion = HumanOpinion(**data)
        db.session.add(opinion)
        db.session.commit()
        return opinion
    
    @staticmethod
    def get_opinions_by_validation(validation_id: int) -> List[HumanOpinion]:
        return HumanOpinion.query.filter_by(validation_result_id=validation_id).all()

    @staticmethod
    def create_audit_log(action: str, entity_type: Optional[str] = None,
                          entity_id: Optional[int] = None, details: Optional[str] = None,
                          operator: Optional[str] = None) -> AuditLog:
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            operator=operator
        )
        db.session.add(log)
        db.session.commit()
        return log

    @staticmethod
    def bulk_create_programs(programs_data: List[Dict[str, Any]]) -> int:
        count = 0
        for data in programs_data:
            try:
                program = Program(**data)
                db.session.add(program)
                count += 1
            except:
                pass
        db.session.commit()
        return count
    
    @staticmethod
    def bulk_create_events(events_data: List[Dict[str, Any]]) -> int:
        count = 0
        for data in events_data:
            try:
                event = BroadcastEvent(**data)
                db.session.add(event)
                count += 1
            except:
                pass
        db.session.commit()
        return count
    
    @staticmethod
    def delete_events_by_date(broadcast_date: date, source_type: Optional[str] = None) -> int:
        query = BroadcastEvent.query.filter_by(broadcast_date=broadcast_date)
        if source_type:
            query = query.filter_by(source_type=source_type)
        count = query.delete()
        db.session.commit()
        return count
    
    @staticmethod
    def get_events_for_day_ordered(broadcast_date: date) -> List[BroadcastEvent]:
        return BroadcastEvent.query.filter_by(
            broadcast_date=broadcast_date
        ).order_by(BroadcastEvent.broadcast_time).all()
