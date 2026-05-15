from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import (
    FaultEvent, ImpactedInterface, CustomerScope, DeclarationVersion,
    UpdateRecord, ResolutionNotification, IdempotencyKey, FaultStatus, ImpactLevel
)
from app.schemas import (
    FaultEventCreate, FaultEventUpdate, InterfaceCreate, CustomerCreate,
    VersionCreate, UpdateRecordCreate, NotificationCreate, ImpactCalculationResult,
    PublishRequest, StatusUpdateRequest, ResolutionConfirmRequest
)
import hashlib
import json

class IdempotencyService:
    @staticmethod
    def _json_serializer(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif hasattr(obj, 'value'):
            return obj.value
        raise TypeError(f"Type {type(obj)} not serializable")
    
    @staticmethod
    def generate_request_hash(data: dict) -> str:
        sorted_data = json.dumps(data, sort_keys=True, default=IdempotencyService._json_serializer)
        return hashlib.sha256(sorted_data.encode()).hexdigest()
    
    @staticmethod
    def check_idempotency(db: Session, key: str, request_hash: str) -> Optional[dict]:
        record = db.query(IdempotencyKey).filter(
            IdempotencyKey.key == key,
            IdempotencyKey.expires_at > datetime.now()
        ).first()
        
        if record:
            if record.request_hash == request_hash:
                return json.loads(record.response_data) if record.response_data else None
            else:
                raise ValueError("Idempotency key used with different request data")
        return None
    
    @staticmethod
    def store_idempotency(db: Session, key: str, request_hash: str, response_data: dict, hours: int = 24):
        record = IdempotencyKey(
            key=key,
            request_hash=request_hash,
            response_data=json.dumps(response_data, default=IdempotencyService._json_serializer),
            expires_at=datetime.now() + timedelta(hours=hours)
        )
        db.add(record)
        db.commit()

class FaultEventService:
    @staticmethod
    def get_event_by_event_id(db: Session, event_id: str) -> Optional[FaultEvent]:
        return db.query(FaultEvent).filter(FaultEvent.event_id == event_id).first()
    
    @staticmethod
    def create_event(db: Session, event_data: FaultEventCreate) -> FaultEvent:
        existing_event = FaultEventService.get_event_by_event_id(db, event_data.event_id)
        if existing_event:
            raise ValueError(f"Event with id {event_data.event_id} already exists")
        
        db_event = FaultEvent(
            event_id=event_data.event_id,
            title=event_data.title,
            description=event_data.description,
            impact_level=event_data.impact_level,
            created_by=event_data.created_by,
            status=FaultStatus.DRAFT
        )
        db.add(db_event)
        db.flush()
        
        for interface_data in event_data.interfaces:
            db_interface = ImpactedInterface(
                event_id=db_event.id,
                **interface_data.model_dump()
            )
            db.add(db_interface)
        
        for customer_data in event_data.customers:
            db_customer = CustomerScope(
                event_id=db_event.id,
                **customer_data.model_dump()
            )
            db.add(db_customer)
        
        db.commit()
        db.refresh(db_event)
        return db_event
    
    @staticmethod
    def calculate_impact(db: Session, event_id: str) -> ImpactCalculationResult:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        total_interfaces = len(event.interfaces)
        total_customers = len(event.customers)
        
        impact_weights = {
            ImpactLevel.LOW: 1,
            ImpactLevel.MEDIUM: 2,
            ImpactLevel.HIGH: 3,
            ImpactLevel.CRITICAL: 4
        }
        
        severity_score = (
            impact_weights[event.impact_level] * 
            (1 + total_interfaces * 0.1 + total_customers * 0.05)
        )
        
        return ImpactCalculationResult(
            total_interfaces=total_interfaces,
            total_customers=total_customers,
            impact_level=event.impact_level,
            severity_score=round(severity_score, 2)
        )
    
    @staticmethod
    def publish_event(db: Session, event_id: str, publish_data: PublishRequest) -> FaultEvent:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        if event.status != FaultStatus.DRAFT:
            raise ValueError(f"Only draft events can be published, current status: {event.status}")
        
        current_version = len(event.versions) + 1
        db_version = DeclarationVersion(
            event_id=event.id,
            version=current_version,
            title=event.title,
            description=event.description,
            impact_level=event.impact_level,
            created_by=publish_data.published_by,
            change_log=publish_data.change_log or "Initial publication"
        )
        db.add(db_version)
        
        event.status = FaultStatus.PUBLISHED
        db.commit()
        
        db_update = UpdateRecord(
            event_id=event.id,
            update_type="publish",
            content=f"Event published as version {current_version}",
            created_by=publish_data.published_by
        )
        db.add(db_update)
        db.commit()
        
        db.refresh(event)
        return event
    
    @staticmethod
    def update_status(db: Session, event_id: str, status_data: StatusUpdateRequest) -> FaultEvent:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        valid_transitions = {
            FaultStatus.DRAFT: [FaultStatus.PUBLISHED, FaultStatus.CANCELLED],
            FaultStatus.PUBLISHED: [FaultStatus.IN_PROGRESS, FaultStatus.CANCELLED],
            FaultStatus.IN_PROGRESS: [FaultStatus.RESOLVING, FaultStatus.CANCELLED],
            FaultStatus.RESOLVING: [FaultStatus.RESOLVED, FaultStatus.IN_PROGRESS],
            FaultStatus.RESOLVED: [],
            FaultStatus.CANCELLED: []
        }
        
        if status_data.status not in valid_transitions[event.status]:
            raise ValueError(
                f"Invalid status transition from {event.status} to {status_data.status}"
            )
        
        event.status = status_data.status
        db.commit()
        
        db_update = UpdateRecord(
            event_id=event.id,
            update_type="status_change",
            content=status_data.comment or f"Status changed to {status_data.status}",
            created_by=status_data.updated_by
        )
        db.add(db_update)
        db.commit()
        
        db.refresh(event)
        return event
    
    @staticmethod
    def create_new_version(db: Session, event_id: str, version_data: VersionCreate) -> DeclarationVersion:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        if event.status in [FaultStatus.RESOLVED, FaultStatus.CANCELLED]:
            raise ValueError(f"Cannot create version for {event.status} events")
        
        existing_versions = [v.version for v in event.versions]
        if version_data.version in existing_versions:
            raise ValueError(f"Version {version_data.version} already exists")
        
        db_version = DeclarationVersion(
            event_id=event.id,
            **version_data.model_dump()
        )
        db.add(db_version)
        db.commit()
        db.refresh(db_version)
        
        event.title = version_data.title
        event.description = version_data.description
        event.impact_level = version_data.impact_level
        db.commit()
        
        return db_version
    
    @staticmethod
    def confirm_resolution(db: Session, event_id: str, confirm_data: ResolutionConfirmRequest) -> FaultEvent:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        if event.status != FaultStatus.RESOLVING:
            raise ValueError(f"Only resolving events can be confirmed, current status: {event.status}")
        
        event.status = FaultStatus.RESOLVED
        db.commit()
        
        for customer in event.customers:
            notification = ResolutionNotification(
                event_id=event.id,
                customer_id=customer.customer_id,
                notification_content=confirm_data.resolution_note or "Issue has been resolved",
                confirmed=False
            )
            db.add(notification)
        
        db_update = UpdateRecord(
            event_id=event.id,
            update_type="resolution",
            content=confirm_data.resolution_note or "Event resolved and notifications sent",
            created_by=confirm_data.confirmed_by
        )
        db.add(db_update)
        db.commit()
        
        db.refresh(event)
        return event
    
    @staticmethod
    def get_event_history(db: Session, event_id: str) -> dict:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        return {
            "event_id": event.event_id,
            "versions": sorted(event.versions, key=lambda v: v.version, reverse=True),
            "updates": sorted(event.updates, key=lambda u: u.created_at, reverse=True),
            "notifications": event.notifications
        }
    
    @staticmethod
    def list_events(db: Session, status: Optional[FaultStatus] = None, 
                    customer_id: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[FaultEvent]:
        query = db.query(FaultEvent)
        
        if status:
            query = query.filter(FaultEvent.status == status)
        
        if customer_id:
            query = query.join(CustomerScope).filter(CustomerScope.customer_id == customer_id)
        
        return query.order_by(FaultEvent.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def add_interfaces(db: Session, event_id: str, interfaces: List[InterfaceCreate]) -> List[ImpactedInterface]:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        if event.status in [FaultStatus.RESOLVED, FaultStatus.CANCELLED]:
            raise ValueError(f"Cannot modify {event.status} events")
        
        created = []
        for interface_data in interfaces:
            existing = db.query(ImpactedInterface).filter(
                ImpactedInterface.event_id == event.id,
                ImpactedInterface.api_path == interface_data.api_path,
                ImpactedInterface.api_method == interface_data.api_method
            ).first()
            
            if not existing:
                db_interface = ImpactedInterface(
                    event_id=event.id,
                    **interface_data.model_dump()
                )
                db.add(db_interface)
                created.append(db_interface)
        
        db.commit()
        for interface in created:
            db.refresh(interface)
        return created
    
    @staticmethod
    def add_customers(db: Session, event_id: str, customers: List[CustomerCreate]) -> List[CustomerScope]:
        event = FaultEventService.get_event_by_event_id(db, event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        if event.status in [FaultStatus.RESOLVED, FaultStatus.CANCELLED]:
            raise ValueError(f"Cannot modify {event.status} events")
        
        created = []
        for customer_data in customers:
            existing = db.query(CustomerScope).filter(
                CustomerScope.event_id == event.id,
                CustomerScope.customer_id == customer_data.customer_id
            ).first()
            
            if not existing:
                db_customer = CustomerScope(
                    event_id=event.id,
                    **customer_data.model_dump()
                )
                db.add(db_customer)
                created.append(db_customer)
        
        db.commit()
        for customer in created:
            db.refresh(customer)
        return created
