from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import uuid4
from app.models import (
    OutboundApproval, CollectionItem, 
    ApprovalStatus, OperationType,
    TransportRecord, EnvironmentLog,
    InsurancePolicy, ReturnInspection
)
from app.services.base_service import BaseService
from app.services.history_service import history_service


class ApprovalService(BaseService[OutboundApproval]):
    def __init__(self):
        super().__init__(OutboundApproval)
    
    def _generate_approval_no(self) -> str:
        return f"APPROVAL-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6].upper()}"
    
    def create_approval(self, db: Session, data: Dict[str, Any], operator: str) -> OutboundApproval:
        item = db.query(CollectionItem).filter(CollectionItem.id == data['item_id']).first()
        if not item:
            raise ValueError(f"藏品 ID {data['item_id']} 不存在")
        if not item.is_available:
            raise ValueError(f"藏品 {item.name} 当前不可出库")
        
        approval_data = {
            **data,
            'approval_no': self._generate_approval_no(),
            'status': ApprovalStatus.DRAFT
        }
        
        approval = super().create(db, approval_data)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.CREATE,
            operator=operator,
            operator_role='申请人',
            old_status=None,
            new_status=ApprovalStatus.DRAFT.value,
            description='创建出库审批申请',
            details={'item_name': item.name, 'item_code': item.item_code}
        )
        
        return approval
    
    def submit_approval(self, db: Session, approval_id: int, operator: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.DRAFT:
            raise ValueError(f"只有草稿状态的申请才能提交审批，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.PENDING_APPROVAL
        approval.current_approver = '部门主管'
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.SUBMIT,
            operator=operator,
            operator_role='申请人',
            old_status=old_status,
            new_status=approval.status.value,
            description='提交出库审批申请',
            details={'next_approver': '部门主管'}
        )
        
        return approval
    
    def approve(self, db: Session, approval_id: int, approver: str, approver_role: str, comments: Optional[str] = None) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.PENDING_APPROVAL:
            raise ValueError(f"只有待审批状态的申请才能审批，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        
        if approver_role == '部门主管':
            approval.current_approver = '馆长'
        elif approver_role == '馆长':
            approval.status = ApprovalStatus.APPROVED
            approval.current_approver = None
            
            item = db.query(CollectionItem).filter(CollectionItem.id == approval.item_id).first()
            if item:
                item.is_available = False
        else:
            raise ValueError(f"无效的审批角色: {approver_role}")
        
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.APPROVE,
            operator=approver,
            operator_role=approver_role,
            old_status=old_status,
            new_status=approval.status.value,
            description=f'{approver_role}审批通过',
            details={'comments': comments}
        )
        
        return approval
    
    def reject(self, db: Session, approval_id: int, approver: str, approver_role: str, comments: Optional[str] = None) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.PENDING_APPROVAL:
            raise ValueError(f"只有待审批状态的申请才能拒绝，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.REJECTED
        approval.current_approver = None
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.REJECT,
            operator=approver,
            operator_role=approver_role,
            old_status=old_status,
            new_status=approval.status.value,
            description=f'{approver_role}拒绝审批',
            details={'comments': comments}
        )
        
        return approval
    
    def start_transit(self, db: Session, approval_id: int, operator: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.APPROVED:
            raise ValueError(f"只有已审批状态才能开始运输，当前状态: {approval.status.value}")
        
        if not approval.insurance:
            raise ValueError("必须先办理保险单才能开始运输")
        if approval.insurance.status != 'issued':
            raise ValueError(f"保险单状态无效: {approval.insurance.status}，需要已签发状态")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.IN_TRANSIT
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.UPDATE_TRANSPORT,
            operator=operator,
            operator_role='运输管理员',
            old_status=old_status,
            new_status=approval.status.value,
            description='藏品开始运输',
            details={'transport_status': 'in_transit'}
        )
        
        return approval
    
    def mark_at_destination(self, db: Session, approval_id: int, operator: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.IN_TRANSIT:
            raise ValueError(f"只有运输中状态才能标记到达目的地，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.AT_DESTINATION
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.UPDATE_TRANSPORT,
            operator=operator,
            operator_role='运输管理员',
            old_status=old_status,
            new_status=approval.status.value,
            description='藏品到达目的地',
            details={'transport_status': 'at_destination'}
        )
        
        return approval
    
    def start_return(self, db: Session, approval_id: int, operator: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.AT_DESTINATION:
            raise ValueError(f"只有到达目的地状态才能开始归还，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.RETURNING
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.UPDATE_TRANSPORT,
            operator=operator,
            operator_role='运输管理员',
            old_status=old_status,
            new_status=approval.status.value,
            description='藏品开始归还运输',
            details={'transport_status': 'returning'}
        )
        
        return approval
    
    def complete_approval(self, db: Session, approval_id: int, operator: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != ApprovalStatus.RETURNING:
            raise ValueError(f"只有归还中状态才能完成，当前状态: {approval.status.value}")
        
        if not approval.return_inspection:
            raise ValueError("必须先完成归还验收才能结束流程")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.COMPLETED
        
        item = db.query(CollectionItem).filter(CollectionItem.id == approval.item_id).first()
        if item:
            item.is_available = True
        
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.COMPLETE,
            operator=operator,
            operator_role='库房管理员',
            old_status=old_status,
            new_status=approval.status.value,
            description='出库审批流程完成',
            details={'final_status': 'completed'}
        )
        
        return approval
    
    def cancel_approval(self, db: Session, approval_id: int, operator: str, reason: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status in [ApprovalStatus.COMPLETED, ApprovalStatus.CANCELLED]:
            raise ValueError(f"已完成或已取消的申请不能再次取消，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.CANCELLED
        approval.current_approver = None
        
        item = db.query(CollectionItem).filter(CollectionItem.id == approval.item_id).first()
        if item:
            item.is_available = True
        
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.CANCEL,
            operator=operator,
            operator_role='管理员',
            old_status=old_status,
            new_status=approval.status.value,
            description='取消出库审批申请',
            details={'reason': reason}
        )
        
        return approval
    
    def mark_failed(self, db: Session, approval_id: int, operator: str, reason: str) -> OutboundApproval:
        approval = self.get(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status in [ApprovalStatus.COMPLETED, ApprovalStatus.CANCELLED]:
            raise ValueError(f"已完成或已取消的申请不能标记失败，当前状态: {approval.status.value}")
        
        old_status = approval.status.value
        approval.status = ApprovalStatus.FAILED
        
        db.commit()
        db.refresh(approval)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.ROLLBACK,
            operator=operator,
            operator_role='系统管理员',
            old_status=old_status,
            new_status=approval.status.value,
            description='标记审批流程失败',
            details={'failure_reason': reason}
        )
        
        return approval
    
    def get_approval_detail(self, db: Session, approval_id: int) -> Optional[OutboundApproval]:
        from sqlalchemy.orm import selectinload
        
        approval = (
            db.query(OutboundApproval)
            .filter(OutboundApproval.id == approval_id)
            .options(
                selectinload(OutboundApproval.item),
                selectinload(OutboundApproval.insurance),
                selectinload(OutboundApproval.transport_records),
                selectinload(OutboundApproval.environment_logs),
                selectinload(OutboundApproval.return_inspection),
                selectinload(OutboundApproval.operation_history),
                selectinload(OutboundApproval.tasks)
            )
            .first()
        )
        return approval
    
    def get_trace_timeline(self, db: Session, approval_id: int) -> List[Dict[str, Any]]:
        approval = self.get_approval_detail(db, approval_id)
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        timeline = []
        
        if approval.insurance:
            timeline.append({
                'type': 'insurance',
                'time': approval.insurance.issued_at or approval.insurance.created_at,
                'title': f'保险单签发: {approval.insurance.policy_no}',
                'description': f'保险公司: {approval.insurance.insurance_company}, 保额: ¥{approval.insurance.insured_value:,.2f}',
                'details': {
                    'policy_no': approval.insurance.policy_no,
                    'insurance_company': approval.insurance.insurance_company,
                    'insured_value': approval.insurance.insured_value,
                    'coverage_start': approval.insurance.coverage_start.isoformat() if approval.insurance.coverage_start else None,
                    'coverage_end': approval.insurance.coverage_end.isoformat() if approval.insurance.coverage_end else None
                }
            })
        
        for transport in sorted(approval.transport_records, key=lambda x: x.sequence):
            timeline.append({
                'type': 'transport',
                'time': transport.arrival_time or transport.created_at,
                'title': f'运输节点: {transport.node_name}',
                'description': f'位置: {transport.location}, 负责人: {transport.handler or "未指定"}',
                'details': {
                    'node_name': transport.node_name,
                    'node_type': transport.node_type,
                    'location': transport.location,
                    'handler': transport.handler,
                    'arrival_time': transport.arrival_time.isoformat() if transport.arrival_time else None,
                    'departure_time': transport.departure_time.isoformat() if transport.departure_time else None,
                    'condition_check': transport.condition_check,
                    'remarks': transport.remarks
                }
            })
        
        for env in sorted(approval.environment_logs, key=lambda x: x.record_time):
            timeline.append({
                'type': 'environment',
                'time': env.record_time,
                'title': f'环境监测记录',
                'description': f'温度: {env.temperature}°C, 湿度: {env.humidity}%, 状态: {env.status}',
                'details': {
                    'temperature': env.temperature,
                    'humidity': env.humidity,
                    'light_level': env.light_level,
                    'vibration': env.vibration,
                    'status': env.status,
                    'operator': env.operator,
                    'notes': env.notes
                }
            })
        
        if approval.return_inspection:
            timeline.append({
                'type': 'inspection',
                'time': approval.return_inspection.return_date,
                'title': '归还验收',
                'description': f'验收人: {approval.return_inspection.inspector}, 总体状态: {approval.return_inspection.overall_status}',
                'details': {
                    'inspector': approval.return_inspection.inspector,
                    'damage_found': approval.return_inspection.damage_found,
                    'damage_description': approval.return_inspection.damage_description,
                    'overall_status': approval.return_inspection.overall_status,
                    'recommendations': approval.return_inspection.recommendations
                }
            })
        
        for op in sorted(approval.operation_history, key=lambda x: x.created_at):
            timeline.append({
                'type': 'operation',
                'time': op.created_at,
                'title': f'操作: {op.operation_type.value}',
                'description': f'{op.operator_role} {op.operator} - {op.description}',
                'details': op.details
            })
        
        timeline.sort(key=lambda x: x['time'])
        
        return timeline
    
    def get_by_status(self, db: Session, status: ApprovalStatus) -> List[OutboundApproval]:
        return db.query(OutboundApproval).filter(OutboundApproval.status == status).all()


approval_service = ApprovalService()
