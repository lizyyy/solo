from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import models, schemas
import signature_utils
import json


def create_evidence_package(db: Session, package: schemas.EvidencePackageCreate) -> models.EvidencePackage:
    db_package = models.EvidencePackage(
        case_number=package.case_number,
        created_by=package.created_by,
        status=models.EvidenceStatus.DRAFT
    )
    db.add(db_package)
    db.flush()
    for mat in package.materials:
        db_material = models.Material(
            **mat.model_dump(),
            package_id=db_package.id,
            version=1
        )
        db.add(db_material)
    log_operation(db, db_package.id, "create", "success", package.created_by,
                  original_input=json.dumps(package.model_dump(), ensure_ascii=False),
                  final_conclusion="证据包创建成功")
    db.commit()
    db.refresh(db_package)
    return db_package


def get_evidence_package(db: Session, package_id: int) -> models.EvidencePackage:
    return db.query(models.EvidencePackage).filter(models.EvidencePackage.id == package_id).first()


def get_evidence_package_by_case(db: Session, case_number: str) -> models.EvidencePackage:
    return db.query(models.EvidencePackage).filter(models.EvidencePackage.case_number == case_number).first()


def get_evidence_packages(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(models.EvidencePackage)
    if status:
        query = query.filter(models.EvidencePackage.status == status)
    return query.order_by(models.EvidencePackage.created_at.desc()).offset(skip).limit(limit).all()


def update_package_status(db: Session, package_id: int, status: models.EvidenceStatus, operator: str = None) -> models.EvidencePackage:
    package = get_evidence_package(db, package_id)
    if not package:
        return None
    old_status = package.status
    package.status = status
    log_operation(db, package_id, "status_change", "success", operator,
                  original_input=f"from {old_status} to {status}",
                  final_conclusion=f"状态从 {old_status} 变更为 {status}")
    db.commit()
    db.refresh(package)
    return package


def sign_package(db: Session, package_id: int, signed_by: str = None) -> models.Signature:
    package = get_evidence_package(db, package_id)
    if not package:
        log_operation(db, package_id, "sign", "failed", signed_by,
                      error_message="证据包不存在",
                      final_conclusion="签章失败：证据包不存在")
        db.commit()
        return None
    materials = [{"material_name": m.material_name, "file_hash": m.file_hash, "version": m.version}
                 for m in package.materials]
    materials_hash = signature_utils.generate_materials_hash(materials)
    new_version = package.current_version
    prev_sig = db.query(models.Signature).filter(
        models.Signature.package_id == package_id,
        models.Signature.version == new_version
    ).first()
    if prev_sig:
        new_version = new_version + 1
        package.current_version = new_version
    signature_value = signature_utils.generate_signature(
        package.case_number, new_version, materials_hash
    )
    prev_signature = db.query(models.Signature).filter(
        models.Signature.package_id == package_id
    ).order_by(models.Signature.version.desc()).first()
    db_signature = models.Signature(
        package_id=package_id,
        version=new_version,
        signature_value=signature_value,
        signed_by=signed_by,
        materials_hash=materials_hash,
        previous_signature_id=prev_signature.id if prev_signature else None
    )
    db.add(db_signature)
    package.latest_signature = signature_value
    package.status = models.EvidenceStatus.SUBMITTED
    log_operation(db, package_id, "sign", "success", signed_by,
                  processing_basis=f"材料清单HASH: {materials_hash}",
                  final_conclusion=f"签章成功，版本 {new_version}")
    db.commit()
    db.refresh(db_signature)
    return db_signature


def verify_package_signature(db: Session, package_id: int) -> dict:
    package = get_evidence_package(db, package_id)
    if not package:
        return {"is_valid": False, "message": "证据包不存在", "details": {}}
    signatures = db.query(models.Signature).filter(models.Signature.package_id == package_id).all()
    chain_result = signature_utils.verify_version_chain(signatures)
    materials = [{"material_name": m.material_name, "file_hash": m.file_hash, "version": m.version}
                 for m in package.materials]
    current_materials_hash = signature_utils.generate_materials_hash(materials)
    latest_sig = max(signatures, key=lambda x: x.version) if signatures else None
    materials_match = latest_sig and latest_sig.materials_hash == current_materials_hash
    result = {
        "is_valid": chain_result["is_complete"] and materials_match,
        "chain_valid": chain_result["is_complete"],
        "materials_match": materials_match,
        "current_materials_hash": current_materials_hash,
        "latest_signature_hash": latest_sig.materials_hash if latest_sig else None,
        "version_chain": chain_result["chain"],
        "message": ""
    }
    if result["is_valid"]:
        result["message"] = "签章校验通过，版本链完整，材料一致"
        package.status = models.EvidenceStatus.VERIFIED
    else:
        issues = []
        if not chain_result["is_complete"]:
            issues.append(chain_result["message"])
        if not materials_match:
            issues.append("材料与最新签章不一致")
        result["message"] = "；".join(issues)
        package.status = models.EvidenceStatus.EXCEPTION
    package.verification_result = json.dumps(result, ensure_ascii=False)
    log_operation(db, package_id, "verify", "success" if result["is_valid"] else "failed", None,
                  processing_basis=chain_result["message"],
                  final_conclusion=result["message"])
    db.commit()
    return result


def supplement_materials(db: Session, package_id: int, supplement: schemas.EvidencePackageSupplement) -> models.EvidencePackage:
    package = get_evidence_package(db, package_id)
    if not package:
        return None
    new_version = package.current_version + 1
    package.current_version = new_version
    related_material_ids = []
    for mat in supplement.materials:
        mat_dict = mat.model_dump()
        mat_dict["is_supplement"] = True
        db_material = models.Material(
            **mat_dict,
            package_id=package_id,
            version=new_version
        )
        db.add(db_material)
        db.flush()
        related_material_ids.append(db_material.id)
    note = models.SupplementNote(
        package_id=package_id,
        version=new_version,
        note_content=supplement.note_content,
        created_by=supplement.operator,
        related_material_ids=related_material_ids
    )
    db.add(note)
    package.status = models.EvidenceStatus.SUPPLEMENT_REQUIRED
    log_operation(db, package_id, "supplement", "success", supplement.operator,
                  original_input=json.dumps(supplement.model_dump(), ensure_ascii=False),
                  final_conclusion=f"补充材料成功，版本 {new_version}")
    db.commit()
    db.refresh(package)
    return package


def manual_correction(db: Session, package_id: int, correction: schemas.ManualCorrection) -> models.EvidencePackage:
    package = get_evidence_package(db, package_id)
    if not package:
        return None
    for field, value in correction.corrected_fields.items():
        if hasattr(package, field):
            setattr(package, field, value)
    package.status = models.EvidenceStatus.MANUALLY_CORRECTED
    log_operation(db, package_id, "manual_correction", "success", correction.operator,
                  original_input=correction.correction_reason,
                  processing_basis=json.dumps(correction.corrected_fields, ensure_ascii=False),
                  final_conclusion="人工修正成功")
    db.commit()
    db.refresh(package)
    return package


def generate_chain_report(db: Session, package_id: int) -> dict:
    package = get_evidence_package(db, package_id)
    if not package:
        return None
    signatures = db.query(models.Signature).filter(models.Signature.package_id == package_id).all()
    chain_result = signature_utils.verify_version_chain(signatures)
    materials_by_version = {}
    for mat in package.materials:
        v = mat.version
        if v not in materials_by_version:
            materials_by_version[v] = []
        materials_by_version[v].append({
            "id": mat.id,
            "name": mat.material_name,
            "hash": mat.file_hash,
            "is_supplement": mat.is_supplement,
            "created_at": mat.created_at.isoformat()
        })
    supplements = db.query(models.SupplementNote).filter(
        models.SupplementNote.package_id == package_id
    ).order_by(models.SupplementNote.version).all()
    report = {
        "package_id": package_id,
        "case_number": package.case_number,
        "current_version": package.current_version,
        "status": package.status,
        "version_chain": chain_result["chain"],
        "materials_by_version": materials_by_version,
        "supplement_notes": [
            {"version": s.version, "content": s.note_content, "created_by": s.created_by}
            for s in supplements
        ],
        "is_complete": chain_result["is_complete"],
        "generated_at": datetime.now().isoformat()
    }
    package.chain_report = json.dumps(report, ensure_ascii=False)
    db.commit()
    return report


def create_export_record(db: Session, package_id: int, operator: str, include_fields: list = None) -> models.ExportRecord:
    package = get_evidence_package(db, package_id)
    if not package:
        return None
    all_fields = [
        "case_number", "current_version", "status", "materials",
        "signatures", "supplement_notes", "operation_logs",
        "verification_result", "chain_report"
    ]
    export_fields = include_fields if include_fields else all_fields
    download_token = signature_utils.generate_download_token(
        package_id, package.case_number, package.current_version
    )
    export_sig = signature_utils.generate_signature(
        package.case_number + "_export", package.current_version,
        signature_utils.generate_materials_hash([{"fields": f} for f in export_fields])
    )
    export_record = models.ExportRecord(
        package_id=package_id,
        case_number=package.case_number,
        export_version=package.current_version,
        exported_by=operator,
        export_fields=export_fields,
        export_signature=export_sig,
        download_token=download_token,
        download_expires_at=datetime.utcnow() + timedelta(hours=24),
        is_downloaded=False
    )
    db.add(export_record)
    package.status = models.EvidenceStatus.EXPORTED
    log_operation(db, package_id, "export", "success", operator,
                  processing_basis=f"导出字段: {','.join(export_fields)}",
                  final_conclusion="导出记录创建成功")
    db.commit()
    db.refresh(export_record)
    return export_record


def get_export_record(db: Session, token: str) -> models.ExportRecord:
    return db.query(models.ExportRecord).filter(models.ExportRecord.download_token == token).first()


def log_operation(db: Session, package_id: int, operation_type: str, operation_status: str,
                  operator: str = None, original_input: str = None, processing_basis: str = None,
                  final_conclusion: str = None, error_message: str = None, details: dict = None):
    log = models.OperationLog(
        package_id=package_id,
        operation_type=operation_type,
        operation_status=operation_status,
        operator=operator,
        original_input=original_input,
        processing_basis=processing_basis,
        final_conclusion=final_conclusion,
        error_message=error_message,
        details=details
    )
    db.add(log)
    return log


def get_operation_logs(db: Session, package_id: int):
    return db.query(models.OperationLog).filter(
        models.OperationLog.package_id == package_id
    ).order_by(models.OperationLog.operation_at.desc()).all()
