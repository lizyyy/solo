import json
import hashlib
import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
import models
import schemas


class VerificationService:
    @staticmethod
    def calculate_content_hash(transactions: List[schemas.RenewalTransaction]) -> str:
        content = json.dumps([t.dict() for t in transactions], sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()

    @staticmethod
    def get_active_rule(db: Session, version: Optional[str] = None) -> Optional[models.VerificationRule]:
        if version:
            return db.query(models.VerificationRule).filter(
                models.VerificationRule.version == version
            ).first()
        return db.query(models.VerificationRule).filter(
            models.VerificationRule.is_active == True
        ).order_by(desc(models.VerificationRule.created_at)).first()

    @staticmethod
    def check_duplicate_batch(db: Session, batch_no: str, content_hash: str) -> Tuple[bool, Optional[models.Batch]]:
        existing_batch = db.query(models.Batch).filter(
            models.Batch.batch_no == batch_no
        ).first()
        if existing_batch:
            if existing_batch.content_hash == content_hash:
                return True, existing_batch
            return True, None
        return False, None

    @staticmethod
    def verify_time_order(transactions: List[schemas.RenewalTransaction]) -> List[Tuple[int, bool, str]]:
        results = []
        member_transactions = {}
        
        for tx in sorted(transactions, key=lambda x: x.transaction_time):
            if tx.member_id not in member_transactions:
                member_transactions[tx.member_id] = []
            member_transactions[tx.member_id].append(tx)
        
        for tx in transactions:
            member_txs = member_transactions.get(tx.member_id, [])
            seq_index = next((i for i, t in enumerate(member_txs) if t.transaction_no == tx.transaction_no), -1)
            
            is_error = False
            error_msg = ""
            
            if seq_index > 0:
                prev_tx = member_txs[seq_index - 1]
                if tx.transaction_time < prev_tx.transaction_time:
                    is_error = True
                    error_msg = f"时间顺序错误: 当前交易时间{tx.transaction_time}早于上一笔交易{prev_tx.transaction_no}的时间{prev_tx.transaction_time}"
            
            results.append((tx.sequence_no, is_error, error_msg))
        
        return results

    @staticmethod
    def process_batch(db: Session, request: schemas.BatchSubmitRequest) -> schemas.BatchSubmitResponse:
        content_hash = VerificationService.calculate_content_hash(request.transactions)
        
        is_duplicate, existing_batch = VerificationService.check_duplicate_batch(db, request.batch_no, content_hash)
        
        if is_duplicate:
            if existing_batch:
                return schemas.BatchSubmitResponse(
                    success=True,
                    batch_no=request.batch_no,
                    status=existing_batch.status,
                    message="批次已存在，复用旧结论",
                    is_duplicate=True,
                    total_count=existing_batch.total_count,
                    success_count=existing_batch.success_count,
                    failed_count=existing_batch.failed_count
                )
            else:
                return schemas.BatchSubmitResponse(
                    success=False,
                    batch_no=request.batch_no,
                    status=models.BatchStatus.CONFLICT,
                    message="批次号冲突，内容不一致",
                    is_duplicate=True
                )

        rule = VerificationService.get_active_rule(db, request.rule_version)
        if not rule:
            rule_config = {
                "check_time_order": True,
                "check_amount_positive": True,
                "version": "v1.0"
            }
        else:
            rule_config = json.loads(rule.rule_config)

        batch = models.Batch(
            batch_no=request.batch_no,
            caller=request.caller,
            total_count=len(request.transactions),
            status=models.BatchStatus.PROCESSING,
            rule_version=rule.version if rule else "v1.0",
            rule_snapshot=json.dumps(rule_config),
            remark=request.remark,
            content_hash=content_hash
        )
        db.add(batch)
        db.flush()

        time_order_results = VerificationService.verify_time_order(request.transactions)
        time_order_map = {seq_no: (is_error, msg) for seq_no, is_error, msg in time_order_results}

        success_count = 0
        failed_count = 0
        details = []

        for tx in request.transactions:
            is_time_error, error_msg = time_order_map.get(tx.sequence_no, (False, ""))
            status = models.DetailStatus.SUCCESS
            verification_errors = []

            if rule_config.get("check_time_order") and is_time_error:
                status = models.DetailStatus.FAILED
                verification_errors.append(error_msg)

            if rule_config.get("check_amount_positive") and tx.amount <= 0:
                status = models.DetailStatus.FAILED
                verification_errors.append(f"金额必须为正数，当前金额: {tx.amount}")

            if status == models.DetailStatus.SUCCESS:
                success_count += 1
            else:
                failed_count += 1

            detail = models.BatchDetail(
                batch_id=batch.id,
                sequence_no=tx.sequence_no,
                member_id=tx.member_id,
                transaction_no=tx.transaction_no,
                transaction_time=tx.transaction_time,
                amount=tx.amount,
                transaction_type=tx.transaction_type,
                original_data=json.dumps(tx.dict(), default=str),
                status=status,
                verification_result=json.dumps({"passed": status == models.DetailStatus.SUCCESS, "checks": rule_config}),
                error_message="; ".join(verification_errors) if verification_errors else None,
                is_time_order_error=is_time_error,
                processed_at=datetime.now()
            )
            db.add(detail)
            details.append({
                "sequence_no": tx.sequence_no,
                "member_id": tx.member_id,
                "transaction_no": tx.transaction_no,
                "status": status,
                "error_message": detail.error_message,
                "is_time_order_error": is_time_error
            })

        if failed_count == 0:
            batch.status = models.BatchStatus.SUCCESS
        elif success_count == 0:
            batch.status = models.BatchStatus.FAILED
        else:
            batch.status = models.BatchStatus.PARTIAL_SUCCESS

        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.completed_at = datetime.now()

        db.commit()

        return schemas.BatchSubmitResponse(
            success=True,
            batch_no=request.batch_no,
            status=batch.status,
            message="批次处理完成",
            total_count=batch.total_count,
            success_count=batch.success_count,
            failed_count=batch.failed_count,
            details=details
        )

    @staticmethod
    def get_batch(db: Session, batch_no: str, include_details: bool = True) -> Optional[schemas.BatchResponse]:
        batch = db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()
        if not batch:
            return None

        details = None
        if include_details:
            details = [
                schemas.BatchDetailResponse(
                    id=d.id,
                    sequence_no=d.sequence_no,
                    member_id=d.member_id,
                    transaction_no=d.transaction_no,
                    transaction_time=d.transaction_time,
                    amount=d.amount,
                    status=d.status,
                    error_message=d.error_message,
                    is_time_order_error=d.is_time_order_error,
                    verification_result=d.verification_result
                )
                for d in batch.details
            ]

        return schemas.BatchResponse(
            batch_no=batch.batch_no,
            caller=batch.caller,
            total_count=batch.total_count,
            success_count=batch.success_count,
            failed_count=batch.failed_count,
            status=batch.status,
            rule_version=batch.rule_version,
            submitted_at=batch.submitted_at,
            completed_at=batch.completed_at,
            remark=batch.remark,
            details=details
        )

    @staticmethod
    def add_manual_note(db: Session, note_data: schemas.ManualNoteCreate) -> schemas.ManualNoteResponse:
        batch = db.query(models.Batch).filter(models.Batch.batch_no == note_data.batch_no).first()
        if not batch:
            raise ValueError(f"批次不存在: {note_data.batch_no}")

        note = models.ManualNote(
            batch_id=batch.id,
            detail_id=note_data.detail_id,
            caller=note_data.caller,
            note_content=note_data.note_content,
            created_by=note_data.created_by,
            note_type=note_data.note_type
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        return schemas.ManualNoteResponse(
            id=note.id,
            batch_no=note_data.batch_no,
            detail_id=note.detail_id,
            caller=note.caller,
            note_content=note.note_content,
            created_by=note.created_by,
            created_at=note.created_at,
            note_type=note.note_type
        )

    @staticmethod
    def get_notes_by_caller(db: Session, caller: str) -> List[schemas.ManualNoteResponse]:
        notes = db.query(models.ManualNote).filter(models.ManualNote.caller == caller).all()
        return [
            schemas.ManualNoteResponse(
                id=n.id,
                batch_no=n.batch.batch_no,
                detail_id=n.detail_id,
                caller=n.caller,
                note_content=n.note_content,
                created_by=n.created_by,
                created_at=n.created_at,
                note_type=n.note_type
            )
            for n in notes
        ]

    @staticmethod
    def create_rule(db: Session, rule_data: schemas.RuleCreate) -> schemas.RuleResponse:
        existing = db.query(models.VerificationRule).filter(
            models.VerificationRule.version == rule_data.version
        ).first()
        if existing:
            raise ValueError(f"规则版本已存在: {rule_data.version}")

        rule = models.VerificationRule(
            version=rule_data.version,
            rule_name=rule_data.rule_name,
            description=rule_data.description,
            rule_config=rule_data.rule_config,
            is_active=rule_data.is_active,
            created_by=rule_data.created_by
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)

        return schemas.RuleResponse(
            version=rule.version,
            rule_name=rule.rule_name,
            description=rule.description,
            is_active=rule.is_active,
            created_at=rule.created_at
        )
