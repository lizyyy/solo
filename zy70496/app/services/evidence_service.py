from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import uuid
import json

from app.models import Batch, EvidenceRecord, DownloadAuthorization, ProcessingStatus
from app.schemas import (
    BatchCreate,
    BatchUpdate,
    BatchPreviewResult,
    BatchQueryFilter,
    DownloadAuthorizationCreate,
    AuthorizationQueryFilter,
)


def generate_uuid() -> str:
    return str(uuid.uuid4())


class BatchService:
    @staticmethod
    def preview_batch(db: Session, batch_data: BatchCreate) -> BatchPreviewResult:
        existing_batch = db.query(Batch).filter(Batch.batch_no == batch_data.batch_no).first()

        total_count = len(batch_data.evidence_records)
        existing_count = 0
        new_count = 0
        conflict_count = 0
        conflict_details = []
        will_reuse_existing = False

        if existing_batch:
            existing_record_ids = {
                rec.evidence_id
                for rec in db.query(EvidenceRecord)
                .filter(EvidenceRecord.batch_id == existing_batch.id)
                .all()
            }
            new_record_ids = {rec.evidence_id for rec in batch_data.evidence_records}

            for record in batch_data.evidence_records:
                if record.evidence_id in existing_record_ids:
                    existing_count += 1
                else:
                    new_count += 1

            if existing_record_ids == new_record_ids:
                conflict_count = 1
                will_reuse_existing = True
                conflict_details.append(
                    {
                        "type": "batch_no_conflict_reuse",
                        "batch_no": batch_data.batch_no,
                        "existing_batch_id": existing_batch.id,
                        "existing_operator": existing_batch.operator,
                        "existing_created_at": existing_batch.created_at.isoformat(),
                        "existing_status": existing_batch.status,
                        "message": f"批次号 {batch_data.batch_no} 已存在且内容完全相同，将复用旧结论",
                    }
                )
            else:
                conflict_count = 1
                will_reuse_existing = False
                new_records = new_record_ids - existing_record_ids
                missing_records = existing_record_ids - new_record_ids
                conflict_details.append(
                    {
                        "type": "batch_no_conflict_variant",
                        "batch_no": batch_data.batch_no,
                        "existing_batch_id": existing_batch.id,
                        "existing_operator": existing_batch.operator,
                        "existing_created_at": existing_batch.created_at.isoformat(),
                        "existing_status": existing_batch.status,
                        "new_records": list(new_records),
                        "missing_records": list(missing_records),
                        "message": f"批次号 {batch_data.batch_no} 已存在但内容不一致（变体），将作为冲突拦截",
                    }
                )
        else:
            new_count = total_count

        return BatchPreviewResult(
            total_count=total_count,
            existing_count=existing_count,
            new_count=new_count,
            conflict_count=conflict_count,
            conflict_details=conflict_details,
            will_reuse_existing=will_reuse_existing,
        )

    @staticmethod
    def create_batch(db: Session, batch_data: BatchCreate) -> Tuple[Batch, bool]:
        existing_batch = db.query(Batch).filter(Batch.batch_no == batch_data.batch_no).first()

        if existing_batch:
            existing_records = db.query(EvidenceRecord).filter(
                EvidenceRecord.batch_id == existing_batch.id
            ).all()
            existing_record_ids = {rec.evidence_id for rec in existing_records}
            new_record_ids = {rec.evidence_id for rec in batch_data.evidence_records}

            if existing_record_ids == new_record_ids:
                return existing_batch, True

            raise ValueError(
                f"批次号 {batch_data.batch_no} 已存在，但证据记录内容不一致。"
                f"原有 {len(existing_record_ids)} 条记录，新提交 {len(new_record_ids)} 条记录。"
                f"差异：新增记录 {new_record_ids - existing_record_ids}，"
                f"缺失记录 {existing_record_ids - new_record_ids}"
            )

        batch_id = generate_uuid()
        batch = Batch(
            id=batch_id,
            batch_no=batch_data.batch_no,
            environment_name=batch_data.environment_name,
            operator=batch_data.operator,
            risk_type=batch_data.risk_type,
            description=batch_data.description,
            original_input=batch_data.original_input,
            processing_basis=batch_data.processing_basis,
            status=ProcessingStatus.PENDING,
        )
        db.add(batch)

        for record in batch_data.evidence_records:
            evidence_record = EvidenceRecord(
                id=generate_uuid(),
                batch_id=batch_id,
                **record.model_dump(),
                status=ProcessingStatus.PENDING,
            )
            db.add(evidence_record)

        db.commit()
        db.refresh(batch)
        return batch, False

    @staticmethod
    def get_batch(db: Session, batch_id: str) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.id == batch_id).first()

    @staticmethod
    def get_batch_by_no(db: Session, batch_no: str) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.batch_no == batch_no).first()

    @staticmethod
    def list_batches(
        db: Session,
        filter_params: BatchQueryFilter,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Batch]:
        query = db.query(Batch)

        if filter_params.batch_no:
            query = query.filter(Batch.batch_no.contains(filter_params.batch_no))
        if filter_params.operator:
            query = query.filter(Batch.operator == filter_params.operator)
        if filter_params.risk_type:
            query = query.filter(Batch.risk_type == filter_params.risk_type)
        if filter_params.environment_name:
            query = query.filter(Batch.environment_name.contains(filter_params.environment_name))
        if filter_params.status:
            query = query.filter(Batch.status == filter_params.status)

        return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_batch_status(db: Session, batch_id: str) -> None:
        records = db.query(EvidenceRecord).filter(EvidenceRecord.batch_id == batch_id).all()

        if not records:
            return

        statuses = [r.status for r in records]

        if all(s == ProcessingStatus.SUCCESS for s in statuses):
            overall_status = ProcessingStatus.SUCCESS
        elif all(s == ProcessingStatus.FAILED for s in statuses):
            overall_status = ProcessingStatus.FAILED
        elif any(s in [ProcessingStatus.SUCCESS, ProcessingStatus.FAILED] for s in statuses):
            overall_status = ProcessingStatus.PARTIAL_SUCCESS
        else:
            overall_status = ProcessingStatus.PROCESSING

        db.query(Batch).filter(Batch.id == batch_id).update({"status": overall_status})
        db.commit()

    @staticmethod
    def update_evidence_record(
        db: Session,
        record_id: str,
        status: ProcessingStatus,
        error_message: Optional[str] = None,
    ) -> Optional[EvidenceRecord]:
        record = db.query(EvidenceRecord).filter(EvidenceRecord.id == record_id).first()
        if not record:
            return None

        record.status = status
        if error_message:
            record.error_message = error_message

        db.commit()
        db.refresh(record)

        BatchService.update_batch_status(db, record.batch_id)
        return record

    @staticmethod
    def get_evidence_records(db: Session, batch_id: str) -> List[EvidenceRecord]:
        return db.query(EvidenceRecord).filter(EvidenceRecord.batch_id == batch_id).all()


class AuthorizationService:
    @staticmethod
    def create_authorization(
        db: Session,
        auth_data: DownloadAuthorizationCreate,
    ) -> DownloadAuthorization:
        if not auth_data.expires_at:
            expires_at = datetime.utcnow() + timedelta(days=7)
        else:
            expires_at = auth_data.expires_at

        authorization = DownloadAuthorization(
            id=generate_uuid(),
            batch_id=auth_data.batch_id,
            authorized_by=auth_data.authorized_by,
            authorized_to=auth_data.authorized_to,
            expires_at=expires_at,
            reason=auth_data.reason,
        )
        db.add(authorization)
        db.commit()
        db.refresh(authorization)
        return authorization

    @staticmethod
    def get_authorization(db: Session, auth_id: str) -> Optional[DownloadAuthorization]:
        return db.query(DownloadAuthorization).filter(DownloadAuthorization.id == auth_id).first()

    @staticmethod
    def list_authorizations(
        db: Session,
        filter_params: AuthorizationQueryFilter,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DownloadAuthorization]:
        query = db.query(DownloadAuthorization)

        if filter_params.batch_id:
            query = query.filter(DownloadAuthorization.batch_id == filter_params.batch_id)
        if filter_params.authorized_to:
            query = query.filter(DownloadAuthorization.authorized_to == filter_params.authorized_to)
        if filter_params.authorized_by:
            query = query.filter(DownloadAuthorization.authorized_by == filter_params.authorized_by)
        if filter_params.is_used is not None:
            query = query.filter(DownloadAuthorization.is_used == filter_params.is_used)

        return query.order_by(DownloadAuthorization.authorized_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def use_authorization(
        db: Session,
        auth_id: str,
        used_by: str,
    ) -> Optional[DownloadAuthorization]:
        authorization = db.query(DownloadAuthorization).filter(DownloadAuthorization.id == auth_id).first()
        if not authorization or authorization.is_used:
            return None

        if authorization.expires_at and authorization.expires_at < datetime.utcnow():
            return None

        authorization.is_used = True
        authorization.used_at = datetime.utcnow()
        authorization.used_by = used_by
        db.commit()
        db.refresh(authorization)
        return authorization


class OutputService:
    @staticmethod
    def to_json(batch: Batch, records: List[EvidenceRecord], authorizations: List[DownloadAuthorization]) -> dict:
        return {
            "batch": {
                "id": batch.id,
                "batch_no": batch.batch_no,
                "environment_name": batch.environment_name,
                "operator": batch.operator,
                "risk_type": batch.risk_type,
                "status": batch.status,
                "description": batch.description,
                "original_input": batch.original_input,
                "processing_basis": batch.processing_basis,
                "created_at": batch.created_at.isoformat(),
                "updated_at": batch.updated_at.isoformat(),
            },
            "evidence_records": [
                {
                    "id": r.id,
                    "evidence_id": r.evidence_id,
                    "source": r.source,
                    "device_name": r.device_name,
                    "device_ip": r.device_ip,
                    "risk_level": r.risk_level,
                    "evidence_path": r.evidence_path,
                    "evidence_hash": r.evidence_hash,
                    "collected_at": r.collected_at.isoformat() if r.collected_at else None,
                    "status": r.status,
                    "error_message": r.error_message,
                    "created_at": r.created_at.isoformat(),
                }
                for r in records
            ],
            "authorizations": [
                {
                    "id": a.id,
                    "authorized_by": a.authorized_by,
                    "authorized_to": a.authorized_to,
                    "authorized_at": a.authorized_at.isoformat(),
                    "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                    "is_used": a.is_used,
                    "used_at": a.used_at.isoformat() if a.used_at else None,
                    "used_by": a.used_by,
                    "reason": a.reason,
                }
                for a in authorizations
            ],
        }

    @staticmethod
    def to_markdown(batch: Batch, records: List[EvidenceRecord], authorizations: List[DownloadAuthorization]) -> str:
        lines = []

        lines.append("# 审计取证报告")
        lines.append("")
        lines.append(f"**批次号**: {batch.batch_no}")
        lines.append(f"**环境名称**: {batch.environment_name}")
        lines.append(f"**操作人**: {batch.operator}")
        lines.append(f"**风险类型**: {batch.risk_type}")
        lines.append(f"**状态**: {batch.status}")
        lines.append(f"**创建时间**: {batch.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**更新时间**: {batch.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        if batch.description:
            lines.append("## 描述")
            lines.append(batch.description)
            lines.append("")

        if batch.original_input:
            lines.append("## 原始输入")
            lines.append("```")
            lines.append(batch.original_input)
            lines.append("```")
            lines.append("")

        if batch.processing_basis:
            lines.append("## 处理依据")
            lines.append("```")
            lines.append(batch.processing_basis)
            lines.append("```")
            lines.append("")

        lines.append("## 取证记录明细")
        lines.append("")
        lines.append("| 证据ID | 来源 | 设备名称 | 设备IP | 风险等级 | 证据路径 | 证据哈希 | 采集时间 | 状态 | 错误信息 |")
        lines.append("|--------|------|----------|--------|----------|----------|----------|----------|------|----------|")

        for r in records:
            device_name = r.device_name or "-"
            device_ip = r.device_ip or "-"
            risk_level = r.risk_level or "-"
            evidence_path = r.evidence_path or "-"
            evidence_hash = r.evidence_hash or "-"
            collected_at = r.collected_at.strftime("%Y-%m-%d %H:%M:%S") if r.collected_at else "-"
            error_msg = r.error_message or "-"
            lines.append(
                f"| {r.evidence_id} | {r.source} | {device_name} | {device_ip} | {risk_level} | {evidence_path} | {evidence_hash} | {collected_at} | {r.status} | {error_msg} |"
            )
        lines.append("")

        lines.append("## 下载授权记录")
        lines.append("")
        lines.append("| 授权人 | 被授权人 | 授权时间 | 过期时间 | 是否使用 | 使用人 | 使用时间 | 原因 |")
        lines.append("|--------|----------|----------|----------|----------|--------|----------|------|")

        for a in authorizations:
            expires_at = a.expires_at.strftime("%Y-%m-%d %H:%M:%S") if a.expires_at else "-"
            used_at = a.used_at.strftime("%Y-%m-%d %H:%M:%S") if a.used_at else "-"
            used_by = a.used_by or "-"
            reason = a.reason or "-"
            lines.append(
                f"| {a.authorized_by} | {a.authorized_to} | {a.authorized_at.strftime('%Y-%m-%d %H:%M:%S')} | {expires_at} | {a.is_used} | {used_by} | {used_at} | {reason} |"
            )
        lines.append("")

        return "\n".join(lines)
