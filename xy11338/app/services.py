from datetime import datetime
from typing import List, Tuple, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException
from app.models import (
    Issue, IssueItem, Installation, PartReturn, ReturnItem,
    Claim, ClaimItem, ClaimVerification, WriteOff, WriteOffItem,
    Part, User, PartStatus, ClaimStatus, VerificationResult, OperationLog
)
from app.schemas import (
    IssueCreate, InstallationCreate, PartReturnCreate,
    ClaimCreate, WriteOffCreate, ClaimVerificationResult, VerificationDetail,
    ClaimItemCreate, IssueItemCreate
)
from app.utils import generate_batch_no, audit_logger


class IssueService:
    @staticmethod
    def generate_issue_no() -> str:
        now = datetime.now()
        return f"ISS{now.strftime('%Y%m%d%H%M%S')}"
    
    @staticmethod
    def check_duplicate_issue(db: Session, work_order_no: str, engineer_id: int) -> Optional[Issue]:
        return db.query(Issue).filter(
            and_(
                Issue.work_order_no == work_order_no,
                Issue.engineer_id == engineer_id
            )
        ).first()
    
    @staticmethod
    def create_issue(db: Session, issue_data: IssueCreate, user_id: int) -> Issue:
        duplicate = IssueService.check_duplicate_issue(db, issue_data.work_order_no, issue_data.engineer_id)
        if duplicate:
            raise HTTPException(status_code=400, detail=f"该工单已存在领用记录: {duplicate.issue_no}")
        
        batch_no = generate_batch_no("I")
        issue_no = IssueService.generate_issue_no()
        
        db_issue = Issue(
            issue_no=issue_no,
            engineer_id=issue_data.engineer_id,
            work_order_no=issue_data.work_order_no,
            customer_name=issue_data.customer_name,
            customer_phone=issue_data.customer_phone,
            customer_address=issue_data.customer_address,
            appliance_type=issue_data.appliance_type,
            appliance_model=issue_data.appliance_model,
            fault_description=issue_data.fault_description,
            batch_no=batch_no
        )
        db.add(db_issue)
        db.flush()
        
        for item in issue_data.items:
            part = db.query(Part).filter(Part.id == item.part_id).first()
            if not part:
                raise HTTPException(status_code=404, detail=f"零件不存在: {item.part_id}")
            if part.stock_quantity < item.quantity:
                raise HTTPException(status_code=400, detail=f"零件库存不足: {part.part_name}")
            
            part.stock_quantity -= item.quantity
            
            db_item = IssueItem(
                issue_id=db_issue.id,
                part_id=item.part_id,
                quantity=item.quantity,
                unit_price=item.unit_price or part.unit_price,
                old_part_expected=item.old_part_expected,
                remarks=item.remarks
            )
            db.add(db_item)
        
        db.commit()
        db.refresh(db_issue)
        
        OperationLogService.log_operation(
            db, user_id, "CREATE", "Issue", str(db_issue.id), batch_no,
            old_value=None, new_value=f"issue_no={issue_no}"
        )
        
        return db_issue


class InstallationService:
    @staticmethod
    def generate_installation_no() -> str:
        now = datetime.now()
        return f"INS{now.strftime('%Y%m%d%H%M%S')}"
    
    @staticmethod
    def check_duplicate_installation(db: Session, issue_id: int) -> Optional[Installation]:
        return db.query(Installation).filter(Installation.issue_id == issue_id).first()
    
    @staticmethod
    def create_installation(db: Session, data: InstallationCreate, user_id: int) -> Installation:
        duplicate = InstallationService.check_duplicate_installation(db, data.issue_id)
        if duplicate:
            raise HTTPException(status_code=400, detail=f"该领用单已存在装机记录: {duplicate.installation_no}")
        
        issue = db.query(Issue).filter(Issue.id == data.issue_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="领用单不存在")
        if issue.is_installed:
            raise HTTPException(status_code=400, detail="该领用单已装机")
        
        batch_no = generate_batch_no("N")
        installation_no = InstallationService.generate_installation_no()
        
        db_installation = Installation(
            installation_no=installation_no,
            issue_id=data.issue_id,
            engineer_id=data.engineer_id,
            work_order_no=data.work_order_no,
            serial_number=data.serial_number,
            installation_date=data.installation_date,
            customer_signature=data.customer_signature,
            remarks=data.remarks,
            batch_no=batch_no
        )
        db.add(db_installation)
        
        issue.is_installed = True
        issue.installed_at = datetime.now()
        
        for item in issue.items:
            item.status = PartStatus.INSTALLED
        
        db.commit()
        db.refresh(db_installation)
        
        OperationLogService.log_operation(
            db, user_id, "CREATE", "Installation", str(db_installation.id), batch_no,
            old_value=None, new_value=f"installation_no={installation_no}"
        )
        
        return db_installation


class PartReturnService:
    @staticmethod
    def generate_return_no() -> str:
        now = datetime.now()
        return f"RET{now.strftime('%Y%m%d%H%M%S')}"
    
    @staticmethod
    def check_duplicate_return(db: Session, issue_id: int) -> Optional[PartReturn]:
        return db.query(PartReturn).filter(PartReturn.issue_id == issue_id).first()
    
    @staticmethod
    def create_return(db: Session, data: PartReturnCreate, user_id: int) -> PartReturn:
        duplicate = PartReturnService.check_duplicate_return(db, data.issue_id)
        if duplicate:
            raise HTTPException(status_code=400, detail=f"该领用单已存在返还记录: {duplicate.return_no}")
        
        issue = db.query(Issue).filter(Issue.id == data.issue_id).first()
        if not issue:
            raise HTTPException(status_code=404, detail="领用单不存在")
        
        batch_no = generate_batch_no("R")
        return_no = PartReturnService.generate_return_no()
        
        db_return = PartReturn(
            return_no=return_no,
            issue_id=data.issue_id,
            received_by_id=data.received_by_id,
            return_date=data.return_date,
            tracking_number=data.tracking_number,
            warehouse_remarks=data.warehouse_remarks,
            batch_no=batch_no
        )
        db.add(db_return)
        db.flush()
        
        expected_parts = {item.part_id: item for item in issue.items if item.old_part_expected}
        
        for item in data.items:
            if item.part_id not in expected_parts:
                raise HTTPException(status_code=400, detail=f"零件{item.part_id}不在预期返还清单中")
            
            expected_item = expected_parts[item.part_id]
            if item.quantity > expected_item.quantity:
                raise HTTPException(status_code=400, detail=f"零件返还数量超出预期: {expected_item.quantity}")
            
            expected_item.old_part_returned = True
            
            part = db.query(Part).filter(Part.id == item.part_id).first()
            if part:
                part.stock_quantity += item.quantity
                part.status = PartStatus.RETURNED
            
            db_item = ReturnItem(
                part_return_id=db_return.id,
                part_id=item.part_id,
                quantity=item.quantity,
                is_defective=item.is_defective,
                defect_description=item.defect_description,
                batch_no=batch_no
            )
            db.add(db_item)
        
        db.commit()
        db.refresh(db_return)
        
        OperationLogService.log_operation(
            db, user_id, "CREATE", "PartReturn", str(db_return.id), batch_no,
            old_value=None, new_value=f"return_no={return_no}"
        )
        
        return db_return


class ClaimVerificationService:
    @staticmethod
    def verify_old_part_returned(db: Session, claim_items: List[ClaimItemCreate]) -> Tuple[VerificationResult, str, List[int]]:
        affected = []
        for idx, item in enumerate(claim_items):
            if item.return_item_id is None:
                affected.append(idx)
                continue
            
            return_item = db.query(ReturnItem).filter(ReturnItem.id == item.return_item_id).first()
            if not return_item:
                affected.append(idx)
        
        if affected:
            return VerificationResult.BLOCKED, f"存在{len(affected)}项旧件未返还记录", affected
        return VerificationResult.PASSED, "所有旧件均已返还", []
    
    @staticmethod
    def verify_duplicate_claim(db: Session, claim_items: List[ClaimItemCreate], exclude_claim_id: int = None) -> Tuple[VerificationResult, str, List[int]]:
        affected = []
        for idx, item in enumerate(claim_items):
            query = db.query(ClaimItem).filter(
                and_(
                    ClaimItem.part_code == item.part_code,
                    ClaimItem.work_order_no == item.work_order_no,
                    ClaimItem.is_duplicate == False
                )
            )
            if exclude_claim_id:
                query = query.filter(ClaimItem.claim_id != exclude_claim_id)
            
            existing = query.first()
            if existing:
                affected.append(idx)
        
        if affected:
            return VerificationResult.BLOCKED, f"存在{len(affected)}项重复索赔记录", affected
        return VerificationResult.PASSED, "无重复索赔记录", []
    
    @staticmethod
    def verify_batch_tracking(db: Session, claim_items: List[ClaimItemCreate]) -> Tuple[VerificationResult, str, List[int]]:
        affected = []
        for idx, item in enumerate(claim_items):
            if item.return_item_id:
                return_item = db.query(ReturnItem).filter(ReturnItem.id == item.return_item_id).first()
                if return_item and not return_item.batch_no:
                    affected.append(idx)
        
        if affected:
            return VerificationResult.WARNING, f"存在{len(affected)}项缺少批次追踪信息", affected
        return VerificationResult.PASSED, "所有项目均有批次追踪信息", []
    
    @staticmethod
    def run_all_verifications(db: Session, claim: ClaimCreate, claim_id: int = None) -> ClaimVerificationResult:
        details = []
        has_blocked = False
        
        result, reason, affected = ClaimVerificationService.verify_old_part_returned(db, claim.items)
        details.append(VerificationDetail(
            rule_name="旧件返还校验",
            result=result,
            reason=reason,
            affected_items=affected
        ))
        if result == VerificationResult.BLOCKED:
            has_blocked = True
        
        result, reason, affected = ClaimVerificationService.verify_duplicate_claim(db, claim.items, claim_id)
        details.append(VerificationDetail(
            rule_name="重复索赔校验",
            result=result,
            reason=reason,
            affected_items=affected
        ))
        if result == VerificationResult.BLOCKED:
            has_blocked = True
        
        result, reason, affected = ClaimVerificationService.verify_batch_tracking(db, claim.items)
        details.append(VerificationDetail(
            rule_name="批次追踪校验",
            result=result,
            reason=reason,
            affected_items=affected
        ))
        
        overall = VerificationResult.BLOCKED if has_blocked else VerificationResult.PASSED
        
        return ClaimVerificationResult(
            overall_result=overall,
            details=details,
            can_submit=not has_blocked
        )


class ClaimService:
    @staticmethod
    def generate_claim_no() -> str:
        now = datetime.now()
        return f"CLM{now.strftime('%Y%m%d%H%M%S')}"
    
    @staticmethod
    def create_claim(db: Session, data: ClaimCreate, user_id: int) -> Claim:
        verification = ClaimVerificationService.run_all_verifications(db, data)
        
        batch_no = generate_batch_no("C")
        claim_no = ClaimService.generate_claim_no()
        
        db_claim = Claim(
            claim_no=claim_no,
            vendor=data.vendor,
            vendor_contact=data.vendor_contact,
            vendor_phone=data.vendor_phone,
            total_amount=data.total_amount,
            remarks=data.remarks,
            batch_no=batch_no,
            created_by=user_id
        )
        db.add(db_claim)
        db.flush()
        
        blocked_indices = set()
        for detail in verification.details:
            if detail.result == VerificationResult.BLOCKED:
                blocked_indices.update(detail.affected_items)
            
            db_verification = ClaimVerification(
                claim_id=db_claim.id,
                rule_name=detail.rule_name,
                result=detail.result,
                reason=detail.reason,
                affected_item_ids=",".join(map(str, detail.affected_items)) if detail.affected_items else None,
                verified_by=user_id
            )
            db.add(db_verification)
        
        for idx, item in enumerate(data.items):
            is_duplicate = idx in blocked_indices
            db_item = ClaimItem(
                claim_id=db_claim.id,
                return_item_id=item.return_item_id,
                part_id=item.part_id,
                part_code=item.part_code,
                part_name=item.part_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                amount=item.amount,
                defect_code=item.defect_code,
                defect_description=item.defect_description,
                work_order_no=item.work_order_no,
                is_duplicate=is_duplicate
            )
            db.add(db_item)
        
        if verification.can_submit:
            db_claim.status = ClaimStatus.SUBMITTED
            db_claim.submitted_at = datetime.now()
        else:
            db_claim.status = ClaimStatus.DRAFT
        
        db.commit()
        db.refresh(db_claim)
        
        OperationLogService.log_operation(
            db, user_id, "CREATE", "Claim", str(db_claim.id), batch_no,
            old_value=None, new_value=f"claim_no={claim_no}, status={db_claim.status}"
        )
        
        return db_claim
    
    @staticmethod
    def approve_claim(db: Session, claim_id: int, user_id: int) -> Claim:
        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise HTTPException(status_code=404, detail="索赔单不存在")
        if claim.status not in [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW]:
            raise HTTPException(status_code=400, detail="索赔单状态不允许审批")
        
        old_status = claim.status
        claim.status = ClaimStatus.APPROVED
        claim.approved_at = datetime.now()
        
        for item in claim.items:
            if not item.is_duplicate:
                part = db.query(Part).filter(Part.id == item.part_id).first()
                if part:
                    part.status = PartStatus.CLAIMED
        
        db.commit()
        db.refresh(claim)
        
        OperationLogService.log_operation(
            db, user_id, "APPROVE", "Claim", str(claim.id), claim.batch_no,
            old_value=f"status={old_status}", new_value=f"status={ClaimStatus.APPROVED}"
        )
        
        return claim
    
    @staticmethod
    def reject_claim(db: Session, claim_id: int, reason: str, user_id: int) -> Claim:
        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise HTTPException(status_code=404, detail="索赔单不存在")
        
        old_status = claim.status
        claim.status = ClaimStatus.REJECTED
        claim.remarks = (claim.remarks or "") + f"\n驳回原因: {reason}"
        
        db.commit()
        db.refresh(claim)
        
        OperationLogService.log_operation(
            db, user_id, "REJECT", "Claim", str(claim.id), claim.batch_no,
            old_value=f"status={old_status}", new_value=f"status={ClaimStatus.REJECTED}"
        )
        
        return claim


class WriteOffService:
    @staticmethod
    def generate_write_off_no() -> str:
        now = datetime.now()
        return f"WOF{now.strftime('%Y%m%d%H%M%S')}"
    
    @staticmethod
    def create_write_off(db: Session, data: WriteOffCreate, user_id: int) -> WriteOff:
        batch_no = generate_batch_no("W")
        write_off_no = WriteOffService.generate_write_off_no()
        
        db_write_off = WriteOff(
            write_off_no=write_off_no,
            claim_id=data.claim_id,
            total_amount=data.total_amount,
            reason=data.reason,
            batch_no=batch_no
        )
        db.add(db_write_off)
        db.flush()
        
        for item in data.items:
            db_item = WriteOffItem(
                write_off_id=db_write_off.id,
                part_id=item.part_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                amount=item.amount,
                reason=item.reason
            )
            db.add(db_item)
            
            part = db.query(Part).filter(Part.id == item.part_id).first()
            if part:
                part.status = PartStatus.WRITTEN_OFF
        
        db.commit()
        db.refresh(db_write_off)
        
        OperationLogService.log_operation(
            db, user_id, "CREATE", "WriteOff", str(db_write_off.id), batch_no,
            old_value=None, new_value=f"write_off_no={write_off_no}"
        )
        
        return db_write_off


class OperationLogService:
    @staticmethod
    def log_operation(db: Session, user_id: int, action: str, entity_type: str, entity_id: str,
                      batch_no: str = None, old_value: str = None, new_value: str = None,
                      ip_address: str = None, user_agent: str = None):
        log = OperationLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            batch_no=batch_no,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(log)
        db.commit()
