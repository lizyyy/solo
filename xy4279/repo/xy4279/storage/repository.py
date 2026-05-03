from typing import Dict, List, Any, Optional, Type, TypeVar, Generic
from datetime import datetime
from sqlalchemy.orm import Session
from config import (
    Base, Operation, SettingVersion, SettingValue, Topology, TopologyNode,
    TopologyRelation, PlateStatus, PlateState, ApprovalTicket, ApprovalSignature,
    CheckResult, SimulationLog, AuditLog, OperationStatus
)

T = TypeVar('T', bound=Base)


class BaseRepository(Generic[T]):
    def __init__(self, db: Session, model: Type[T]):
        self.db = db
        self.model = model

    def create(self, **kwargs) -> T:
        instance = self.model(**kwargs)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def get_by_id(self, entity_id: int) -> Optional[T]:
        return self.db.query(self.model).filter(self.model.id == entity_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        return self.db.query(self.model).offset(skip).limit(limit).all()

    def update(self, entity_id: int, **kwargs) -> Optional[T]:
        instance = self.get_by_id(entity_id)
        if instance:
            for key, value in kwargs.items():
                setattr(instance, key, value)
            if hasattr(instance, 'updated_at'):
                instance.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(instance)
        return instance

    def delete(self, entity_id: int) -> bool:
        instance = self.get_by_id(entity_id)
        if instance:
            self.db.delete(instance)
            self.db.commit()
            return True
        return False


class OperationRepository(BaseRepository[Operation]):
    def __init__(self, db: Session):
        super().__init__(db, Operation)

    def get_by_bay(self, bay_id: str) -> List[Operation]:
        return self.db.query(Operation).filter(Operation.bay_id == bay_id).all()

    def get_by_status(self, status: OperationStatus) -> List[Operation]:
        return self.db.query(Operation).filter(Operation.status == status).all()

    def get_with_details(self, operation_id: int) -> Optional[Operation]:
        return self.db.query(Operation).filter(Operation.id == operation_id).first()


class SettingVersionRepository(BaseRepository[SettingVersion]):
    def __init__(self, db: Session):
        super().__init__(db, SettingVersion)

    def create_with_values(self, version_data: Dict[str, Any], values: List[Dict[str, Any]]) -> SettingVersion:
        version = SettingVersion(**version_data)
        self.db.add(version)
        self.db.flush()
        
        for value_data in values:
            value = SettingValue(version_id=version.id, **value_data)
            self.db.add(value)
        
        self.db.commit()
        self.db.refresh(version)
        return version

    def get_by_bay(self, bay_id: str) -> List[SettingVersion]:
        return self.db.query(SettingVersion).filter(SettingVersion.bay_id == bay_id).all()

    def get_by_version(self, bay_id: str, version: str) -> Optional[SettingVersion]:
        return self.db.query(SettingVersion).filter(
            SettingVersion.bay_id == bay_id,
            SettingVersion.version == version
        ).first()

    def get_values(self, version_id: int) -> List[SettingValue]:
        return self.db.query(SettingValue).filter(SettingValue.version_id == version_id).all()


class TopologyRepository(BaseRepository[Topology]):
    def __init__(self, db: Session):
        super().__init__(db, Topology)

    def create_with_relations(self, topology_data: Dict[str, Any], 
                               nodes: List[Dict[str, Any]], 
                               relations: List[Dict[str, Any]]) -> Topology:
        topology = Topology(**topology_data)
        self.db.add(topology)
        self.db.flush()
        
        for node_data in nodes:
            node = TopologyNode(topology_id=topology.id, **node_data)
            self.db.add(node)
        
        for rel_data in relations:
            rel = TopologyRelation(topology_id=topology.id, **rel_data)
            self.db.add(rel)
        
        self.db.commit()
        self.db.refresh(topology)
        return topology

    def get_nodes(self, topology_id: int) -> List[TopologyNode]:
        return self.db.query(TopologyNode).filter(TopologyNode.topology_id == topology_id).all()

    def get_relations(self, topology_id: int) -> List[TopologyRelation]:
        return self.db.query(TopologyRelation).filter(TopologyRelation.topology_id == topology_id).all()


class PlateStatusRepository(BaseRepository[PlateStatus]):
    def __init__(self, db: Session):
        super().__init__(db, PlateStatus)

    def create_with_plates(self, status_data: Dict[str, Any], plates: List[Dict[str, Any]]) -> PlateStatus:
        plate_status = PlateStatus(**status_data)
        self.db.add(plate_status)
        self.db.flush()
        
        for plate_data in plates:
            plate = PlateState(plate_status_id=plate_status.id, **plate_data)
            self.db.add(plate)
        
        self.db.commit()
        self.db.refresh(plate_status)
        return plate_status

    def get_plates(self, plate_status_id: int) -> List[PlateState]:
        return self.db.query(PlateState).filter(PlateState.plate_status_id == plate_status_id).order_by(PlateState.sequence).all()

    def get_by_bay(self, bay_id: str) -> List[PlateStatus]:
        return self.db.query(PlateStatus).filter(PlateStatus.bay_id == bay_id).all()


class ApprovalTicketRepository(BaseRepository[ApprovalTicket]):
    def __init__(self, db: Session):
        super().__init__(db, ApprovalTicket)

    def create_with_signatures(self, ticket_data: Dict[str, Any], signatures: List[Dict[str, Any]]) -> ApprovalTicket:
        ticket = ApprovalTicket(**ticket_data)
        self.db.add(ticket)
        self.db.flush()
        
        for sig_data in signatures:
            sig = ApprovalSignature(ticket_id=ticket.id, **sig_data)
            self.db.add(sig)
        
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def get_signatures(self, ticket_id: int) -> List[ApprovalSignature]:
        return self.db.query(ApprovalSignature).filter(ApprovalSignature.ticket_id == ticket_id).order_by(ApprovalSignature.sequence).all()

    def get_by_ticket_no(self, ticket_no: str) -> Optional[ApprovalTicket]:
        return self.db.query(ApprovalTicket).filter(ApprovalTicket.ticket_no == ticket_no).first()

    def is_fully_signed(self, ticket_id: int) -> bool:
        signatures = self.get_signatures(ticket_id)
        return all(sig.signed for sig in signatures)


class CheckResultRepository(BaseRepository[CheckResult]):
    def __init__(self, db: Session):
        super().__init__(db, CheckResult)

    def get_by_operation(self, operation_id: int) -> List[CheckResult]:
        return self.db.query(CheckResult).filter(CheckResult.operation_id == operation_id).all()

    def get_failed_checks(self, operation_id: int) -> List[CheckResult]:
        return self.db.query(CheckResult).filter(
            CheckResult.operation_id == operation_id,
            CheckResult.passed == False
        ).all()

    def get_high_risk_checks(self, operation_id: int) -> List[CheckResult]:
        return self.db.query(CheckResult).filter(
            CheckResult.operation_id == operation_id,
            CheckResult.risk_level.in_(["high", "critical"])
        ).all()


class SimulationLogRepository(BaseRepository[SimulationLog]):
    def __init__(self, db: Session):
        super().__init__(db, SimulationLog)

    def get_by_operation(self, operation_id: int) -> List[SimulationLog]:
        return self.db.query(SimulationLog).filter(SimulationLog.operation_id == operation_id).order_by(SimulationLog.step).all()

    def create_batch(self, operation_id: int, logs: List[Dict[str, Any]]) -> List[SimulationLog]:
        created_logs = []
        for log_data in logs:
            log = SimulationLog(operation_id=operation_id, **log_data)
            self.db.add(log)
            created_logs.append(log)
        self.db.commit()
        return created_logs


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, db: Session):
        super().__init__(db, AuditLog)

    def log_operation(self, operation: str, resource_type: str, 
                      resource_id: Optional[int] = None, 
                      details: Optional[Dict[str, Any]] = None,
                      user: Optional[str] = None) -> AuditLog:
        log = AuditLog(
            operation=operation,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            user=user,
            timestamp=datetime.utcnow()
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_by_resource(self, resource_type: str, resource_id: int) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == resource_id
        ).order_by(AuditLog.timestamp.desc()).all()

    def get_recent(self, limit: int = 100) -> List[AuditLog]:
        return self.db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()


class RepositoryFactory:
    def __init__(self, db: Session):
        self.db = db
        self._operation_repo: Optional[OperationRepository] = None
        self._setting_repo: Optional[SettingVersionRepository] = None
        self._topology_repo: Optional[TopologyRepository] = None
        self._plate_repo: Optional[PlateStatusRepository] = None
        self._approval_repo: Optional[ApprovalTicketRepository] = None
        self._check_repo: Optional[CheckResultRepository] = None
        self._simulation_repo: Optional[SimulationLogRepository] = None
        self._audit_repo: Optional[AuditLogRepository] = None

    @property
    def operation(self) -> OperationRepository:
        if not self._operation_repo:
            self._operation_repo = OperationRepository(self.db)
        return self._operation_repo

    @property
    def setting(self) -> SettingVersionRepository:
        if not self._setting_repo:
            self._setting_repo = SettingVersionRepository(self.db)
        return self._setting_repo

    @property
    def topology(self) -> TopologyRepository:
        if not self._topology_repo:
            self._topology_repo = TopologyRepository(self.db)
        return self._topology_repo

    @property
    def plate(self) -> PlateStatusRepository:
        if not self._plate_repo:
            self._plate_repo = PlateStatusRepository(self.db)
        return self._plate_repo

    @property
    def approval(self) -> ApprovalTicketRepository:
        if not self._approval_repo:
            self._approval_repo = ApprovalTicketRepository(self.db)
        return self._approval_repo

    @property
    def check(self) -> CheckResultRepository:
        if not self._check_repo:
            self._check_repo = CheckResultRepository(self.db)
        return self._check_repo

    @property
    def simulation(self) -> SimulationLogRepository:
        if not self._simulation_repo:
            self._simulation_repo = SimulationLogRepository(self.db)
        return self._simulation_repo

    @property
    def audit(self) -> AuditLogRepository:
        if not self._audit_repo:
            self._audit_repo = AuditLogRepository(self.db)
        return self._audit_repo
