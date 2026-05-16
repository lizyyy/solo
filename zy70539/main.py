from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from database import SessionLocal, engine
import models
import schemas
import crud
import signature_utils

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="法务证据包签章API")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/packages/", response_model=schemas.EvidencePackage, summary="创建证据包")
def create_package(package: schemas.EvidencePackageCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_evidence_package(db=db, package=package)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@app.get("/packages/", response_model=List[schemas.EvidencePackage], summary="查询证据包列表")
def list_packages(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)):
    packages = crud.get_evidence_packages(db, skip=skip, limit=limit, status=status)
    return packages


@app.get("/packages/{package_id}", response_model=schemas.EvidencePackage, summary="查询单个证据包详情")
def get_package(package_id: int, db: Session = Depends(get_db)):
    package = crud.get_evidence_package(db, package_id=package_id)
    if package is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return package


@app.get("/packages/case/{case_number}", response_model=schemas.EvidencePackage, summary="按案件编号查询")
def get_package_by_case(case_number: str, db: Session = Depends(get_db)):
    package = crud.get_evidence_package_by_case(db, case_number=case_number)
    if package is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return package


@app.put("/packages/{package_id}/status", response_model=schemas.EvidencePackage, summary="更新状态")
def update_status(package_id: int, status: models.EvidenceStatus, operator: str = None, db: Session = Depends(get_db)):
    package = crud.update_package_status(db, package_id=package_id, status=status, operator=operator)
    if package is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return package


@app.post("/packages/{package_id}/sign", response_model=schemas.Signature, summary="签章")
def sign_package(package_id: int, signed_by: str = None, db: Session = Depends(get_db)):
    signature = crud.sign_package(db, package_id=package_id, signed_by=signed_by)
    if signature is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return signature


@app.post("/packages/{package_id}/verify", response_model=schemas.VerificationResult, summary="校验签章")
def verify_package(package_id: int, db: Session = Depends(get_db)):
    result = crud.verify_package_signature(db, package_id=package_id)
    if "details" not in result:
        result["details"] = {}
    return schemas.VerificationResult(**result)


@app.post("/packages/{package_id}/supplement", response_model=schemas.EvidencePackage, summary="补充材料")
def supplement_package(package_id: int, supplement: schemas.EvidencePackageSupplement, db: Session = Depends(get_db)):
    package = crud.supplement_materials(db, package_id=package_id, supplement=supplement)
    if package is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return package


@app.post("/packages/{package_id}/correct", response_model=schemas.EvidencePackage, summary="人工修正")
def correct_package(package_id: int, correction: schemas.ManualCorrection, db: Session = Depends(get_db)):
    package = crud.manual_correction(db, package_id=package_id, correction=correction)
    if package is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return package


@app.post("/packages/{package_id}/report", summary="生成证据链报告")
def get_chain_report(package_id: int, db: Session = Depends(get_db)):
    report = crud.generate_chain_report(db, package_id=package_id)
    if report is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return report


@app.post("/packages/{package_id}/export", response_model=schemas.ExportRecordResponse, summary="导出")
def export_package(package_id: int, export_req: schemas.ExportRequest, db: Session = Depends(get_db)):
    export_record = crud.create_export_record(
        db, package_id=package_id, operator=export_req.operator,
        include_fields=export_req.include_fields
    )
    if export_record is None:
        raise HTTPException(status_code=404, detail="证据包不存在")
    return export_record


@app.get("/export/{token}", summary="下载导出文件")
def download_export(token: str, db: Session = Depends(get_db)):
    token_result = signature_utils.verify_download_token(token)
    if not token_result["is_valid"]:
        raise HTTPException(status_code=401, detail=token_result["message"])
    export_record = crud.get_export_record(db, token=token)
    if export_record is None:
        raise HTTPException(status_code=404, detail="导出记录不存在")
    package = crud.get_evidence_package(db, package_id=export_record.package_id)
    export_data = {
        "export_info": {
            "export_at": export_record.export_at.isoformat(),
            "exported_by": export_record.exported_by,
            "export_version": export_record.export_version,
            "export_signature": export_record.export_signature
        },
        "package": {}
    }
    for field in export_record.export_fields:
        if field == "materials":
            export_data["package"]["materials"] = [
                {"name": m.material_name, "type": m.material_type, "hash": m.file_hash, "version": m.version}
                for m in package.materials
            ]
        elif field == "signatures":
            export_data["package"]["signatures"] = [
                {"version": s.version, "signed_at": s.signed_at.isoformat(), "signed_by": s.signed_by}
                for s in package.signatures
            ]
        elif field == "operation_logs":
            export_data["package"]["operation_logs"] = [
                {"type": l.operation_type, "status": l.operation_status, "at": l.operation_at.isoformat()}
                for l in package.operation_logs
            ]
        elif field == "supplement_notes":
            export_data["package"]["supplement_notes"] = [
                {"version": n.version, "content": n.note_content}
                for n in package.supplement_notes
            ]
        else:
            export_data["package"][field] = getattr(package, field, None)
    export_record.is_downloaded = True
    db.commit()
    return export_data


@app.get("/packages/{package_id}/logs", response_model=List[schemas.OperationLog], summary="操作日志")
def get_logs(package_id: int, db: Session = Depends(get_db)):
    return crud.get_operation_logs(db, package_id=package_id)


@app.get("/health", summary="健康检查")
def health_check():
    return {"status": "ok"}


@app.post("/self-test", summary="自检功能")
def self_test(db: Session = Depends(get_db)):
    test_results = []
    try:
        test_case = "CASE-TEST-001"
        test_materials = [
            schemas.MaterialCreate(material_name="test1.pdf", material_type="pdf", file_hash="abc123"),
            schemas.MaterialCreate(material_name="test2.docx", material_type="docx", file_hash="def456")
        ]
        pkg = crud.create_evidence_package(db, schemas.EvidencePackageCreate(
            case_number=test_case, created_by="tester", materials=test_materials))
        test_results.append({"test": "create_package", "status": "pass", "case": test_case})
        sig = crud.sign_package(db, package_id=pkg.id, signed_by="tester")
        test_results.append({"test": "sign_package", "status": "pass", "version": sig.version})
        verify_result = crud.verify_package_signature(db, package_id=pkg.id)
        test_results.append({"test": "verify_signature", "status": "pass" if verify_result["is_valid"] else "fail",
                             "details": verify_result["message"]})
        supplement = schemas.EvidencePackageSupplement(
            materials=[schemas.MaterialCreate(material_name="supplement.pdf", material_type="pdf",
                                              file_hash="ghi789", is_supplement=True,
                                              supplement_reason="补充证据")],
            note_content="补充说明",
            operator="tester"
        )
        pkg2 = crud.supplement_materials(db, package_id=pkg.id, supplement=supplement)
        test_results.append({"test": "supplement_materials", "status": "pass", "new_version": pkg2.current_version})
        sig2 = crud.sign_package(db, package_id=pkg.id, signed_by="tester")
        test_results.append({"test": "sign_again", "status": "pass", "version": sig2.version})
        report = crud.generate_chain_report(db, package_id=pkg.id)
        test_results.append({"test": "chain_report", "status": "pass", "versions_count": len(report["version_chain"])})
        export = crud.create_export_record(db, package_id=pkg.id, operator="tester")
        test_results.append({"test": "export", "status": "pass", "token": export.download_token[:20] + "..."})
        return {
            "status": "success",
            "tests": test_results,
            "summary": f"通过 {len([t for t in test_results if t['status'] == 'pass'])}/{len(test_results)} 项测试",
            "note": "测试数据已保留，重启后可验证持久化"
        }
    except Exception as e:
        return {"status": "failed", "error": str(e), "tests": test_results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
