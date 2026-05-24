from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, date
from typing import List, Optional, Tuple, Dict
import json
import uuid

import database as models
import schemas


class OperationLogService:
    @staticmethod
    def log_operation(
        db: Session,
        operation_type: str,
        resource_type: str,
        resource_id: int,
        operator: str,
        operator_role: str = None,
        source: str = None,
        before_data: dict = None,
        after_data: dict = None,
        change_summary: str = None,
        batch_no: str = None,
        ip_address: str = None
    ):
        log = models.OperationLog(
            operation_type=operation_type,
            resource_type=resource_type,
            resource_id=resource_id,
            batch_no=batch_no,
            operator=operator,
            operator_role=operator_role,
            source=source,
            before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None,
            after_data=json.dumps(after_data, ensure_ascii=False) if after_data else None,
            change_summary=change_summary,
            ip_address=ip_address
        )
        db.add(log)
        db.commit()


class PrescriptionService:
    @staticmethod
    def create_prescription(db: Session, prescription: schemas.PrescriptionCreate) -> models.Prescription:
        max_version = db.query(func.max(models.Prescription.version)).filter(
            models.Prescription.elder_id == prescription.elder_id
        ).scalar() or 0

        db_prescription = models.Prescription(
            elder_id=prescription.elder_id,
            version=max_version + 1,
            doctor_name=prescription.doctor_name,
            diagnosis=prescription.diagnosis,
            start_date=prescription.start_date,
            end_date=prescription.end_date,
            source=prescription.source,
            created_by=prescription.created_by,
            remark=prescription.remark
        )
        db.add(db_prescription)
        db.flush()

        for item in prescription.items:
            db_item = models.PrescriptionItem(
                prescription_id=db_prescription.id,
                medicine_name=item.medicine_name,
                specification=item.specification,
                dosage=item.dosage,
                frequency=item.frequency,
                usage=item.usage,
                quantity=item.quantity,
                unit=item.unit
            )
            db.add(db_item)

        db.query(models.Prescription).filter(
            and_(
                models.Prescription.elder_id == prescription.elder_id,
                models.Prescription.id != db_prescription.id,
                models.Prescription.is_active == True
            )
        ).update({models.Prescription.is_active: False})

        db.commit()
        db.refresh(db_prescription)

        OperationLogService.log_operation(
            db=db,
            operation_type="CREATE",
            resource_type="prescription",
            resource_id=db_prescription.id,
            operator=prescription.created_by,
            source=prescription.source,
            after_data={
                "version": db_prescription.version,
                "doctor_name": prescription.doctor_name,
                "items_count": len(prescription.items)
            },
            change_summary=f"创建医嘱版本 {db_prescription.version}"
        )

        return db_prescription

    @staticmethod
    def get_active_prescription(db: Session, elder_id: int) -> Optional[models.Prescription]:
        return db.query(models.Prescription).filter(
            and_(
                models.Prescription.elder_id == elder_id,
                models.Prescription.is_active == True
            )
        ).first()

    @staticmethod
    def get_prescription_versions(db: Session, elder_id: int) -> List[models.Prescription]:
        return db.query(models.Prescription).filter(
            models.Prescription.elder_id == elder_id
        ).order_by(models.Prescription.version.desc()).all()


class StopRequestService:
    @staticmethod
    def create_stop_request(db: Session, stop_request: schemas.StopRequestCreate) -> models.StopRequest:
        batch_no = stop_request.batch_no or f"STOP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8]}"
        
        db_stop = models.StopRequest(
            prescription_id=stop_request.prescription_id,
            batch_no=batch_no,
            applicant=stop_request.applicant,
            applicant_role=stop_request.applicant_role,
            reason=stop_request.reason,
            effective_date=stop_request.effective_date,
            source=stop_request.source,
            remark=stop_request.remark,
            status="pending"
        )
        db.add(db_stop)
        db.commit()
        db.refresh(db_stop)

        OperationLogService.log_operation(
            db=db,
            operation_type="CREATE",
            resource_type="stop_request",
            resource_id=db_stop.id,
            operator=stop_request.applicant,
            operator_role=stop_request.applicant_role,
            source=stop_request.source,
            batch_no=batch_no,
            after_data={
                "prescription_id": stop_request.prescription_id,
                "effective_date": str(stop_request.effective_date),
                "reason": stop_request.reason
            },
            change_summary="创建停药申请"
        )

        return db_stop

    @staticmethod
    def approve_stop_request(db: Session, stop_id: int, update: schemas.StopRequestUpdate, operator: str) -> models.StopRequest:
        db_stop = db.query(models.StopRequest).filter(models.StopRequest.id == stop_id).first()
        if not db_stop:
            raise ValueError("停药申请不存在")

        before_data = {"status": db_stop.status}
        
        db_stop.status = update.status.value
        db_stop.approved_by = update.approved_by
        db_stop.approved_at = datetime.utcnow()
        db_stop.remark = update.remark or db_stop.remark

        if update.status == schemas.StopStatus.APPROVED:
            prescription = db.query(models.Prescription).filter(
                models.Prescription.id == db_stop.prescription_id
            ).first()
            if prescription:
                prescription.is_active = False

        db.commit()
        db.refresh(db_stop)

        OperationLogService.log_operation(
            db=db,
            operation_type="UPDATE",
            resource_type="stop_request",
            resource_id=stop_id,
            operator=operator,
            batch_no=db_stop.batch_no,
            before_data=before_data,
            after_data={"status": update.status.value},
            change_summary=f"停药申请{update.status.value}"
        )

        return db_stop

    @staticmethod
    def withdraw_stop_request(db: Session, stop_id: int, operator: str, reason: str) -> models.StopRequest:
        db_stop = db.query(models.StopRequest).filter(models.StopRequest.id == stop_id).first()
        if not db_stop:
            raise ValueError("停药申请不存在")

        before_data = {
            "status": db_stop.status,
            "is_withdrawn": db_stop.is_withdrawn
        }

        db_stop.is_withdrawn = True
        db_stop.withdrawn_at = datetime.utcnow()
        db_stop.withdrawn_by = operator
        db_stop.status = schemas.StopStatus.WITHDRAWN.value

        db.commit()
        db.refresh(db_stop)

        OperationLogService.log_operation(
            db=db,
            operation_type="WITHDRAW",
            resource_type="stop_request",
            resource_id=stop_id,
            operator=operator,
            batch_no=db_stop.batch_no,
            before_data=before_data,
            after_data={"status": "withdrawn", "is_withdrawn": True},
            change_summary=f"撤回停药申请: {reason}"
        )

        return db_stop

    @staticmethod
    def check_stop_interception(db: Session, elder_id: int, distribution_date: date, prescription_id: int = None) -> Tuple[bool, Optional[models.StopRequest]]:
        query = db.query(models.StopRequest).filter(
            and_(
                models.StopRequest.status == "approved",
                models.StopRequest.is_withdrawn == False,
                models.StopRequest.effective_date <= distribution_date
            )
        )

        if prescription_id:
            query = query.filter(models.StopRequest.prescription_id == prescription_id)
        else:
            prescription = PrescriptionService.get_active_prescription(db, elder_id)
            if prescription:
                query = query.filter(models.StopRequest.prescription_id == prescription.id)
            else:
                return True, None

        stop_request = query.first()
        return (stop_request is not None), stop_request


class MedicineBoxService:
    @staticmethod
    def create_medicine_box(db: Session, box: schemas.MedicineBoxCreate) -> models.MedicineBox:
        intercepted, stop_req = StopRequestService.check_stop_interception(
            db, box.elder_id, box.distribution_date, box.prescription_id
        )
        
        status = schemas.DistributionStatus.STOPPED.value if intercepted else schemas.DistributionStatus.PENDING.value

        db_box = models.MedicineBox(
            elder_id=box.elder_id,
            prescription_id=box.prescription_id,
            batch_no=box.batch_no,
            box_no=box.box_no,
            distribution_date=box.distribution_date,
            time_slot=box.time_slot,
            medicines=box.medicines,
            source=box.source,
            remark=box.remark,
            status=status,
            prepared_by=box.prepared_by,
            prepared_at=datetime.utcnow() if box.prepared_by else None
        )
        db.add(db_box)
        db.commit()
        db.refresh(db_box)

        OperationLogService.log_operation(
            db=db,
            operation_type="CREATE",
            resource_type="medicine_box",
            resource_id=db_box.id,
            operator=box.prepared_by or "system",
            source=box.source,
            batch_no=box.batch_no,
            after_data={
                "elder_id": box.elder_id,
                "distribution_date": str(box.distribution_date),
                "status": status,
                "intercepted": intercepted
            },
            change_summary=f"创建药盒, 状态: {status}" + (" (已拦截停药)" if intercepted else "")
        )

        return db_box

    @staticmethod
    def transition_status(db: Session, box_id: int, new_status: schemas.DistributionStatus, operator: str, remark: str = None) -> models.MedicineBox:
        db_box = db.query(models.MedicineBox).filter(models.MedicineBox.id == box_id).first()
        if not db_box:
            raise ValueError("药盒不存在")

        valid_transitions = {
            schemas.DistributionStatus.PENDING: [schemas.DistributionStatus.PREPARED, schemas.DistributionStatus.CANCELLED],
            schemas.DistributionStatus.PREPARED: [schemas.DistributionStatus.DISTRIBUTED, schemas.DistributionStatus.CANCELLED, schemas.DistributionStatus.STOPPED],
            schemas.DistributionStatus.DISTRIBUTED: [schemas.DistributionStatus.SIGNED, schemas.DistributionStatus.STOPPED],
            schemas.DistributionStatus.SIGNED: [],
            schemas.DistributionStatus.STOPPED: [],
            schemas.DistributionStatus.CANCELLED: []
        }

        current_status = schemas.DistributionStatus(db_box.status)
        if new_status not in valid_transitions.get(current_status, []):
            raise ValueError(f"无法从 {current_status.value} 转换到 {new_status.value}")

        before_data = {"status": db_box.status}
        db_box.status = new_status.value

        if new_status == schemas.DistributionStatus.SIGNED:
            db_box.signed_by = operator
            db_box.signed_at = datetime.utcnow()

        if remark:
            db_box.remark = remark

        db.commit()
        db.refresh(db_box)

        OperationLogService.log_operation(
            db=db,
            operation_type="STATUS_TRANSITION",
            resource_type="medicine_box",
            resource_id=box_id,
            operator=operator,
            batch_no=db_box.batch_no,
            before_data=before_data,
            after_data={"status": new_status.value},
            change_summary=f"状态变更: {current_status.value} -> {new_status.value}"
        )

        return db_box

    @staticmethod
    def sign_box(db: Session, box_id: int, signature: schemas.SignatureCreate) -> models.MedicineBox:
        db_box = db.query(models.MedicineBox).filter(models.MedicineBox.id == box_id).first()
        if not db_box:
            raise ValueError("药盒不存在")

        db_sig = models.Signature(
            medicine_box_id=box_id,
            nurse_name=signature.nurse_name,
            is_backfilled=signature.is_backfilled,
            backfill_reason=signature.backfill_reason,
            backfilled_by=signature.backfilled_by,
            backfilled_at=datetime.utcnow() if signature.is_backfilled else None,
            receiver_name=signature.receiver_name,
            receiver_relation=signature.receiver_relation,
            sign_time=datetime.utcnow()
        )
        db.add(db_sig)

        before_data = {"status": db_box.status, "signed_by": db_box.signed_by}
        
        db_box.status = schemas.DistributionStatus.SIGNED.value
        db_box.signed_by = signature.nurse_name
        db_box.signed_at = datetime.utcnow()

        db.commit()
        db.refresh(db_box)

        OperationLogService.log_operation(
            db=db,
            operation_type="SIGN",
            resource_type="medicine_box",
            resource_id=box_id,
            operator=signature.nurse_name,
            batch_no=db_box.batch_no,
            before_data=before_data,
            after_data={
                "status": "signed",
                "nurse_name": signature.nurse_name,
                "is_backfilled": signature.is_backfilled
            },
            change_summary=f"护士签收" + (" (补录)" if signature.is_backfilled else "")
        )

        return db_box

    @staticmethod
    def manual_override(db: Session, box_id: int, new_status: schemas.DistributionStatus, operator: str, reason: str, before_data: dict, after_data: dict) -> models.MedicineBox:
        db_box = db.query(models.MedicineBox).filter(models.MedicineBox.id == box_id).first()
        if not db_box:
            raise ValueError("药盒不存在")

        old_status = db_box.status
        db_box.status = new_status.value

        db.commit()
        db.refresh(db_box)

        OperationLogService.log_operation(
            db=db,
            operation_type="MANUAL_OVERRIDE",
            resource_type="medicine_box",
            resource_id=box_id,
            operator=operator,
            batch_no=db_box.batch_no,
            before_data=before_data,
            after_data=after_data,
            change_summary=f"人工改判: {old_status} -> {new_status.value}, 原因: {reason}"
        )

        return db_box


class DisputeService:
    @staticmethod
    def create_dispute(db: Session, dispute: schemas.DisputeCreate) -> models.Dispute:
        db_box = db.query(models.MedicineBox).filter(
            models.MedicineBox.id == dispute.medicine_box_id
        ).first()
        
        before_data = {
            "status": db_box.status if db_box else None,
            "signed_by": db_box.signed_by if db_box else None
        } if db_box else None

        db_dispute = models.Dispute(
            medicine_box_id=dispute.medicine_box_id,
            reporter=dispute.reporter,
            reporter_role=dispute.reporter_role,
            dispute_type=dispute.dispute_type,
            description=dispute.description,
            status=schemas.DisputeStatus.PENDING.value,
            before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None
        )
        db.add(db_dispute)
        db.commit()
        db.refresh(db_dispute)

        OperationLogService.log_operation(
            db=db,
            operation_type="DISPUTE_CREATE",
            resource_type="dispute",
            resource_id=db_dispute.id,
            operator=dispute.reporter,
            operator_role=dispute.reporter_role,
            after_data={
                "medicine_box_id": dispute.medicine_box_id,
                "dispute_type": dispute.dispute_type,
                "description": dispute.description
            },
            change_summary=f"创建争议: {dispute.dispute_type}"
        )

        return db_dispute

    @staticmethod
    def handle_dispute(db: Session, dispute_id: int, handle: schemas.DisputeHandle) -> models.Dispute:
        db_dispute = db.query(models.Dispute).filter(models.Dispute.id == dispute_id).first()
        if not db_dispute:
            raise ValueError("争议不存在")

        db_dispute.status = handle.status.value
        db_dispute.handler = handle.handler
        db_dispute.handle_result = handle.handle_result
        db_dispute.handled_at = datetime.utcnow()
        db_dispute.after_data = json.dumps({"result": handle.handle_result}, ensure_ascii=False)

        db.commit()
        db.refresh(db_dispute)

        OperationLogService.log_operation(
            db=db,
            operation_type="DISPUTE_HANDLE",
            resource_type="dispute",
            resource_id=dispute_id,
            operator=handle.handler,
            before_data={"status": "pending"},
            after_data={"status": handle.status.value, "result": handle.handle_result},
            change_summary=f"处理争议: {handle.status.value}"
        )

        return db_dispute


class BatchUploadService:
    @staticmethod
    def create_batch_upload(db: Session, upload: schemas.BatchUploadCreate) -> models.BatchUpload:
        db_upload = models.BatchUpload(
            batch_no=upload.batch_no,
            upload_type=upload.upload_type,
            uploader=upload.uploader,
            remark=upload.remark,
            resubmitted_from=upload.resubmitted_from
        )
        db.add(db_upload)
        db.commit()
        db.refresh(db_upload)

        OperationLogService.log_operation(
            db=db,
            operation_type="BATCH_UPLOAD",
            resource_type="batch_upload",
            resource_id=db_upload.id,
            operator=upload.uploader,
            batch_no=upload.batch_no,
            after_data={
                "upload_type": upload.upload_type,
                "resubmitted_from": upload.resubmitted_from
            },
            change_summary="创建批量上传" + (f" (重提自 {upload.resubmitted_from})" if upload.resubmitted_from else "")
        )

        return db_upload

    @staticmethod
    def withdraw_batch(db: Session, batch_no: str, withdraw: schemas.BatchUploadWithdraw) -> models.BatchUpload:
        db_upload = db.query(models.BatchUpload).filter(
            models.BatchUpload.batch_no == batch_no
        ).first()
        if not db_upload:
            raise ValueError("批次不存在")

        before_data = {
            "is_withdrawn": db_upload.is_withdrawn,
            "status": db_upload.status
        }

        db_upload.is_withdrawn = True
        db_upload.withdrawn_at = datetime.utcnow()
        db_upload.withdrawn_by = withdraw.withdrawn_by
        db_upload.withdraw_reason = withdraw.withdraw_reason
        db_upload.status = "withdrawn"

        db.query(models.MedicineBox).filter(
            models.MedicineBox.batch_no == batch_no
        ).update({
            models.MedicineBox.status: schemas.DistributionStatus.CANCELLED.value,
            models.MedicineBox.remark: models.MedicineBox.remark + f" | 批次撤回: {withdraw.withdraw_reason}"
        })

        db.commit()
        db.refresh(db_upload)

        OperationLogService.log_operation(
            db=db,
            operation_type="BATCH_WITHDRAW",
            resource_type="batch_upload",
            resource_id=db_upload.id,
            operator=withdraw.withdrawn_by,
            batch_no=batch_no,
            before_data=before_data,
            after_data={"is_withdrawn": True, "status": "withdrawn"},
            change_summary=f"撤回批次: {withdraw.withdraw_reason}"
        )

        return db_upload

    @staticmethod
    def resubmit_batch(db: Session, old_batch_no: str, new_batch_no: str, operator: str, remark: str = None) -> models.BatchUpload:
        old_upload = db.query(models.BatchUpload).filter(
            models.BatchUpload.batch_no == old_batch_no
        ).first()
        if not old_upload:
            raise ValueError("原批次不存在")

        new_upload = models.BatchUpload(
            batch_no=new_batch_no,
            upload_type=old_upload.upload_type,
            uploader=operator,
            remark=remark or f"重提自 {old_batch_no}",
            resubmitted_from=old_batch_no
        )
        db.add(new_upload)
        db.commit()
        db.refresh(new_upload)

        old_boxes = db.query(models.MedicineBox).filter(
            models.MedicineBox.batch_no == old_batch_no
        ).all()

        for old_box in old_boxes:
            new_box = models.MedicineBox(
                elder_id=old_box.elder_id,
                prescription_id=old_box.prescription_id,
                batch_no=new_batch_no,
                box_no=old_box.box_no,
                distribution_date=old_box.distribution_date,
                time_slot=old_box.time_slot,
                medicines=old_box.medicines,
                source=old_box.source,
                remark=f"重提自 {old_batch_no}",
                status=schemas.DistributionStatus.PENDING.value
            )
            db.add(new_box)

        db.commit()

        OperationLogService.log_operation(
            db=db,
            operation_type="BATCH_RESUBMIT",
            resource_type="batch_upload",
            resource_id=new_upload.id,
            operator=operator,
            batch_no=new_batch_no,
            after_data={
                "old_batch_no": old_batch_no,
                "new_batch_no": new_batch_no
            },
            change_summary=f"重提批次: {old_batch_no} -> {new_batch_no}"
        )

        return new_upload


class ReportService:
    @staticmethod
    def get_distribution_report(db: Session, query: schemas.DistributionReportQuery) -> List[models.MedicineBox]:
        q = db.query(models.MedicineBox).filter(
            and_(
                models.MedicineBox.distribution_date >= query.start_date,
                models.MedicineBox.distribution_date <= query.end_date
            )
        )

        if query.elder_id:
            q = q.filter(models.MedicineBox.elder_id == query.elder_id)
        if query.status:
            q = q.filter(models.MedicineBox.status == query.status.value)
        if query.batch_no:
            q = q.filter(models.MedicineBox.batch_no == query.batch_no)

        return q.order_by(models.MedicineBox.distribution_date.desc()).all()

    @staticmethod
    def get_distribution_stats(db: Session, query: schemas.DistributionReportQuery) -> schemas.DistributionStats:
        q = db.query(models.MedicineBox).filter(
            and_(
                models.MedicineBox.distribution_date >= query.start_date,
                models.MedicineBox.distribution_date <= query.end_date
            )
        )

        if query.elder_id:
            q = q.filter(models.MedicineBox.elder_id == query.elder_id)
        if query.batch_no:
            q = q.filter(models.MedicineBox.batch_no == query.batch_no)

        total = q.count()
        signed = q.filter(models.MedicineBox.status == "signed").count()
        pending = q.filter(models.MedicineBox.status == "pending").count()
        stopped = q.filter(models.MedicineBox.status == "stopped").count()
        cancelled = q.filter(models.MedicineBox.status == "cancelled").count()

        dispute_count = db.query(models.Dispute).join(models.MedicineBox).filter(
            and_(
                models.MedicineBox.distribution_date >= query.start_date,
                models.MedicineBox.distribution_date <= query.end_date
            )
        ).count()

        backfill_count = db.query(models.Signature).join(models.MedicineBox).filter(
            and_(
                models.MedicineBox.distribution_date >= query.start_date,
                models.MedicineBox.distribution_date <= query.end_date,
                models.Signature.is_backfilled == True
            )
        ).count()

        sign_rate = (signed / total * 100) if total > 0 else 0.0

        return schemas.DistributionStats(
            total_boxes=total,
            signed_count=signed,
            pending_count=pending,
            stopped_count=stopped,
            cancelled_count=cancelled,
            dispute_count=dispute_count,
            backfill_count=backfill_count,
            sign_rate=round(sign_rate, 2)
        )

    @staticmethod
    def get_operation_logs(
        db: Session,
        start_date: date = None,
        end_date: date = None,
        resource_type: str = None,
        batch_no: str = None,
        operator: str = None,
        limit: int = 100
    ) -> List[models.OperationLog]:
        q = db.query(models.OperationLog)

        if start_date:
            q = q.filter(func.date(models.OperationLog.created_at) >= start_date)
        if end_date:
            q = q.filter(func.date(models.OperationLog.created_at) <= end_date)
        if resource_type:
            q = q.filter(models.OperationLog.resource_type == resource_type)
        if batch_no:
            q = q.filter(models.OperationLog.batch_no == batch_no)
        if operator:
            q = q.filter(models.OperationLog.operator == operator)

        return q.order_by(models.OperationLog.created_at.desc()).limit(limit).all()
