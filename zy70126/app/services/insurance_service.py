from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import uuid4
from app.models import InsurancePolicy, OutboundApproval, OperationType, ApprovalStatus
from app.services.base_service import BaseService
from app.services.history_service import history_service


class InsuranceService(BaseService[InsurancePolicy]):
    def __init__(self):
        super().__init__(InsurancePolicy)
    
    def _generate_policy_no(self) -> str:
        return f"INS-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:6].upper()}"
    
    def create_insurance(self, db: Session, data: Dict[str, Any], operator: str) -> InsurancePolicy:
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == data['approval_id']
        ).first()
        
        if not approval:
            raise ValueError(f"审批申请 {data['approval_id']} 不存在")
        
        if approval.status != ApprovalStatus.APPROVED:
            raise ValueError(f"只有已审批状态才能办理保险，当前状态: {approval.status.value}")
        
        if approval.insurance:
            raise ValueError("该审批申请已有保险单")
        
        if data['coverage_start'] >= data['coverage_end']:
            raise ValueError("保险生效日期必须早于失效日期")
        
        insurance_data = {
            **data,
            'policy_no': self._generate_policy_no(),
            'status': 'draft'
        }
        
        insurance = super().create(db, insurance_data)
        
        history_service.record_operation(
            db=db,
            approval_id=approval.id,
            operation_type=OperationType.ISSUE_INSURANCE,
            operator=operator,
            operator_role='保险管理员',
            old_status=approval.status.value,
            new_status=approval.status.value,
            description='创建保险单草稿',
            details={
                'policy_no': insurance.policy_no,
                'insurance_company': insurance.insurance_company,
                'insured_value': insurance.insured_value
            }
        )
        
        return insurance
    
    def issue_insurance(self, db: Session, insurance_id: int, operator: str, policy_document_url: Optional[str] = None) -> InsurancePolicy:
        insurance = self.get(db, insurance_id)
        if not insurance:
            raise ValueError(f"保险单 {insurance_id} 不存在")
        
        if insurance.status != 'draft':
            raise ValueError(f"只有草稿状态的保险单才能签发，当前状态: {insurance.status}")
        
        insurance.status = 'issued'
        insurance.issued_at = datetime.now()
        if policy_document_url:
            insurance.policy_document_url = policy_document_url
        
        db.commit()
        db.refresh(insurance)
        
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == insurance.approval_id
        ).first()
        
        if approval:
            history_service.record_operation(
                db=db,
                approval_id=approval.id,
                operation_type=OperationType.ISSUE_INSURANCE,
                operator=operator,
                operator_role='保险管理员',
                old_status=approval.status.value,
                new_status=approval.status.value,
                description='保险单正式签发',
                details={
                    'policy_no': insurance.policy_no,
                    'issued_at': insurance.issued_at.isoformat() if insurance.issued_at else None,
                    'policy_document_url': insurance.policy_document_url
                }
            )
        
        return insurance
    
    def cancel_insurance(self, db: Session, insurance_id: int, operator: str, reason: str) -> InsurancePolicy:
        insurance = self.get(db, insurance_id)
        if not insurance:
            raise ValueError(f"保险单 {insurance_id} 不存在")
        
        if insurance.status == 'cancelled':
            raise ValueError("保险单已取消")
        
        insurance.status = 'cancelled'
        db.commit()
        db.refresh(insurance)
        
        approval = db.query(OutboundApproval).filter(
            OutboundApproval.id == insurance.approval_id
        ).first()
        
        if approval:
            history_service.record_operation(
                db=db,
                approval_id=approval.id,
                operation_type=OperationType.CANCEL,
                operator=operator,
                operator_role='保险管理员',
                old_status=approval.status.value,
                new_status=approval.status.value,
                description='取消保险单',
                details={
                    'policy_no': insurance.policy_no,
                    'cancel_reason': reason
                }
            )
        
        return insurance
    
    def get_by_approval(self, db: Session, approval_id: int) -> Optional[InsurancePolicy]:
        return db.query(InsurancePolicy).filter(
            InsurancePolicy.approval_id == approval_id
        ).first()


insurance_service = InsuranceService()
