from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models import (
    TransportRecord, EnvironmentLog, ReturnInspection,
    OutboundApproval, OperationType, ApprovalStatus
)
from app.services.base_service import BaseService
from app.services.history_service import history_service


class TransportService(BaseService[TransportRecord]):
    def __init__(self):
        super().__init__(TransportRecord)
    
    def create_transport_record(self, db: Session, data: Dict[str, Any], operator: str) -> TransportRecord:
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == data['approval_id']
        ).first()
        
        if not approval:
            raise ValueError(f"审批申请 {data['approval_id']} 不存在")
        
        if approval.status not in [ApprovalStatus.IN_TRANSIT, ApprovalStatus.AT_DESTINATION, ApprovalStatus.RETURNING]:
            raise ValueError(f"当前状态不允许添加运输记录，当前状态: {approval.status.value}")
        
        existing = db.query(TransportRecord).filter(
            TransportRecord.approval_id == data['approval_id'],
            TransportRecord.sequence == data['sequence']
        ).first()
        
        if existing:
            raise ValueError(f"序号 {data['sequence']} 的运输节点已存在")
        
        transport = super().create(db, data)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.UPDATE_TRANSPORT,
            operator=operator,
            operator_role='运输管理员',
            old_status=approval.status.value,
            new_status=approval.status.value,
            description=f'添加运输节点: {transport.node_name}',
            details={
                'sequence': transport.sequence,
                'node_name': transport.node_name,
                'location': transport.location
            }
        )
        
        return transport
    
    def update_transport_record(self, db: Session, transport_id: int, data: Dict[str, Any], operator: str) -> TransportRecord:
        transport = self.get(db, transport_id)
        if not transport:
            raise ValueError(f"运输记录 {transport_id} 不存在")
        
        updated = super().update(db, transport, data)
        
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == transport.approval_id
        ).first()
        
        if approval:
            history_service.record_operation(
                db=db,
                approval_id=approval.id,
                operation_type=OperationType.UPDATE_TRANSPORT,
                operator=operator,
                operator_role='运输管理员',
                old_status=approval.status.value,
                new_status=approval.status.value,
                description=f'更新运输节点: {updated.node_name}',
                details=data
            )
        
        return updated
    
    def get_by_approval(self, db: Session, approval_id: int) -> List[TransportRecord]:
        return (
            db.query(TransportRecord)
            .filter(TransportRecord.approval_id == approval_id)
            .order_by(TransportRecord.sequence)
            .all()
        )


class EnvironmentService(BaseService[EnvironmentLog]):
    def __init__(self):
        super().__init__(EnvironmentLog)
    
    def create_environment_log(self, db: Session, data: Dict[str, Any], operator: str) -> EnvironmentLog:
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == data['approval_id']
        ).first()
        
        if not approval:
            raise ValueError(f"审批申请 {data['approval_id']} 不存在")
        
        if approval.status not in [ApprovalStatus.IN_TRANSIT, ApprovalStatus.AT_DESTINATION, ApprovalStatus.RETURNING]:
            raise ValueError(f"当前状态不允许添加环境记录，当前状态: {approval.status.value}")
        
        if 'operator' not in data:
            data['operator'] = operator
        
        env_log = super().create(db, data)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.ENVIRONMENT_RECORD,
            operator=operator,
            operator_role='环境监测员',
            old_status=approval.status.value,
            new_status=approval.status.value,
            description='添加环境监测记录',
            details={
                'temperature': env_log.temperature,
                'humidity': env_log.humidity,
                'status': env_log.status
            }
        )
        
        return env_log
    
    def get_by_approval(self, db: Session, approval_id: int) -> List[EnvironmentLog]:
        return (
            db.query(EnvironmentLog)
            .filter(EnvironmentLog.approval_id == approval_id)
            .order_by(EnvironmentLog.record_time)
            .all()
        )
    
    def get_by_transport(self, db: Session, transport_record_id: int) -> List[EnvironmentLog]:
        return (
            db.query(EnvironmentLog)
            .filter(EnvironmentLog.transport_record_id == transport_record_id)
            .order_by(EnvironmentLog.record_time)
            .all()
        )


class InspectionService(BaseService[ReturnInspection]):
    def __init__(self):
        super().__init__(ReturnInspection)
    
    def create_inspection(self, db: Session, data: Dict[str, Any], operator: str) -> ReturnInspection:
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == data['approval_id']
        ).first()
        
        if not approval:
            raise ValueError(f"审批申请 {data['approval_id']} 不存在")
        
        if approval.status != ApprovalStatus.RETURNING:
            raise ValueError(f"只有归还中状态才能进行归还验收，当前状态: {approval.status.value}")
        
        if approval.return_inspection:
            raise ValueError("该审批申请已有归还验收记录")
        
        inspection = super().create(db, data)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.RETURN_INSPECTION,
            operator=operator,
            operator_role='库房管理员',
            old_status=approval.status.value,
            new_status=approval.status.value,
            description='完成归还验收',
            details={
                'inspector': inspection.inspector,
                'damage_found': inspection.damage_found,
                'overall_status': inspection.overall_status
            }
        )
        
        return inspection
    
    def get_by_approval(self, db: Session, approval_id: int) -> Optional[ReturnInspection]:
        return db.query(ReturnInspection).filter(
            ReturnInspection.approval_id == approval_id
        ).first()


transport_service = TransportService()
environment_service = EnvironmentService()
inspection_service = InspectionService()
