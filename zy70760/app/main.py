from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
import os
import tempfile
import json

from app.database import get_db, init_db
from app.models import WheelStatus
from app.schemas import (
    WheelFileResponse, WheelFileDetail,
    StatusUpdateRequest, ManualCorrectionRequest,
    ExceptionPathRequest, ValidationReportResponse
)
from app.crud import (
    get_wheel_file, get_wheel_files, get_wheel_file_by_hash, create_wheel_file,
    update_wheel_file_status, create_metadata, create_entry_point,
    create_dependency, create_validation_report, create_exception_path,
    delete_wheel_file_metadata, delete_wheel_file_entry_points,
    delete_wheel_file_dependencies
)
from app.wheel_parser import WheelParser
from app.validator import WheelValidator

app = FastAPI(title="Wheel Metadata API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/wheels", response_model=WheelFileResponse)
async def upload_wheel(
    file: UploadFile = File(...),
    uploader: str = "system",
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.whl'):
        raise HTTPException(status_code=400, detail="File must be a .whl file")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.whl') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name

    try:
        with WheelParser(tmp_file_path, file.filename) as parser:
            extracted_data = parser.extract_all()

            existing = get_wheel_file_by_hash(db, extracted_data['file_hash'])
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Wheel file already exists with ID: {existing.id}"
                )

            from app.schemas import WheelFileCreate
            wheel_file_create = WheelFileCreate(
                filename=extracted_data['filename'],
                file_hash=extracted_data['file_hash'],
                file_size=extracted_data['file_size'],
                uploader=uploader,
                platform_tag=extracted_data['platform_tag'],
                python_version=extracted_data['python_version'],
                package_name=extracted_data['package_name'],
                package_version=extracted_data['package_version'],
                original_filename=file.filename
            )

            db_wheel = create_wheel_file(db, wheel_file_create)

            metadata = extracted_data.get('metadata', {})
            if metadata:
                from app.schemas import MetaDataCreate
                metadata_create = MetaDataCreate(
                    wheel_file_id=db_wheel.id,
                    **metadata
                )
                create_metadata(db, metadata_create)

            entry_points = extracted_data.get('entry_points', [])
            for ep in entry_points:
                from app.schemas import EntryPointCreate
                ep_create = EntryPointCreate(
                    wheel_file_id=db_wheel.id,
                    **ep
                )
                create_entry_point(db, ep_create)

            dependencies = extracted_data.get('dependencies', [])
            for dep in dependencies:
                from app.schemas import DependencyCreate
                dep_create = DependencyCreate(
                    wheel_file_id=db_wheel.id,
                    **dep
                )
                create_dependency(db, dep_create)

            return db_wheel

    finally:
        os.unlink(tmp_file_path)


@app.get("/api/wheels", response_model=List[WheelFileResponse])
def list_wheels(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_wheel_files(db, skip=skip, limit=limit)


@app.get("/api/wheels/{wheel_id}", response_model=WheelFileDetail)
def get_wheel(wheel_id: int, db: Session = Depends(get_db)):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")
    return db_wheel


@app.post("/api/wheels/{wheel_id}/validate", response_model=ValidationReportResponse)
async def validate_wheel(
    wheel_id: int,
    validator: str = "system",
    db: Session = Depends(get_db)
):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    extracted_data = {
        'platform_tag': db_wheel.platform_tag,
        'platform_tags': db_wheel.platform_tag.split('.') if db_wheel.platform_tag else [],
        'metadata': {
            'name': db_wheel.wheel_metadata.name if db_wheel.wheel_metadata else '',
            'version': db_wheel.wheel_metadata.version if db_wheel.wheel_metadata else ''
        } if db_wheel.wheel_metadata else {},
        'entry_points': [
            {
                'group': ep.group,
                'name': ep.name,
                'module': ep.module,
                'attr': ep.attr
            }
            for ep in db_wheel.entry_points
        ],
        'dependencies': [
            {
                'name': dep.name,
                'specifier': dep.specifier
            }
            for dep in db_wheel.dependencies
        ]
    }

    validator_obj = WheelValidator(extracted_data)
    report_data = validator_obj.validate_all()

    from app.schemas import ValidationReportCreate
    report_create = ValidationReportCreate(
        wheel_file_id=wheel_id,
        report_type="full_validation",
        generated_by=validator,
        **report_data
    )
    db_report = create_validation_report(db, report_create)

    new_status = WheelStatus.PASSED.value if report_data['overall_status'] == 'passed' else WheelStatus.FAILED.value
    update_wheel_file_status(
        db, wheel_id, new_status,
        actor=validator,
        reason=f"Validation completed with status: {report_data['overall_status']}"
    )

    return db_report


@app.put("/api/wheels/{wheel_id}/status", response_model=WheelFileResponse)
def update_status(
    wheel_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    valid_statuses = [status.value for status in WheelStatus]
    if request.new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    db_wheel = update_wheel_file_status(
        db, wheel_id, request.new_status,
        actor=request.actor,
        reason=request.reason
    )
    return db_wheel


@app.post("/api/wheels/{wheel_id}/manual-correction", response_model=WheelFileDetail)
def apply_manual_correction(
    wheel_id: int,
    request: ManualCorrectionRequest,
    db: Session = Depends(get_db)
):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    if request.corrected_platform_tag:
        db_wheel.platform_tag = request.corrected_platform_tag

    if request.corrected_metadata:
        delete_wheel_file_metadata(db, wheel_id)
        from app.schemas import MetaDataCreate
        metadata_create = MetaDataCreate(
            wheel_file_id=wheel_id,
            **request.corrected_metadata
        )
        create_metadata(db, metadata_create)

    if request.corrected_entry_points:
        delete_wheel_file_entry_points(db, wheel_id)
        for ep in request.corrected_entry_points:
            from app.schemas import EntryPointCreate
            ep_create = EntryPointCreate(
                wheel_file_id=wheel_id,
                **ep
            )
            create_entry_point(db, ep_create)

    if request.corrected_dependencies:
        delete_wheel_file_dependencies(db, wheel_id)
        for dep in request.corrected_dependencies:
            from app.schemas import DependencyCreate
            dep_create = DependencyCreate(
                wheel_file_id=wheel_id,
                **dep
            )
            create_dependency(db, dep_create)

    exception_data = {
        'wheel_file_id': wheel_id,
        'original_input': request.model_dump_json(),
        'handler': request.handler,
        'conclusion': 'Manual correction applied',
        'notes': request.notes
    }
    from app.schemas import ExceptionPathCreate
    create_exception_path(db, ExceptionPathCreate(**exception_data))

    update_wheel_file_status(
        db, wheel_id, WheelStatus.MANUAL_REVIEW.value,
        actor=request.handler,
        reason="Manual correction applied"
    )

    db.refresh(db_wheel)
    return db_wheel


@app.post("/api/wheels/{wheel_id}/exception-path", response_model=WheelFileDetail)
def record_exception_path(
    wheel_id: int,
    request: ExceptionPathRequest,
    db: Session = Depends(get_db)
):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    from app.schemas import ExceptionPathCreate
    exception_create = ExceptionPathCreate(
        wheel_file_id=wheel_id,
        original_input=request.original_input,
        handler=request.handler,
        conclusion=request.conclusion,
        notes=request.notes
    )
    create_exception_path(db, exception_create)

    update_wheel_file_status(
        db, wheel_id, WheelStatus.MANUAL_REVIEW.value,
        actor=request.handler,
        reason=f"Exception path recorded: {request.conclusion}"
    )

    db.refresh(db_wheel)
    return db_wheel


@app.post("/api/wheels/{wheel_id}/withdraw", response_model=WheelFileResponse)
def withdraw_wheel(
    wheel_id: int,
    actor: str = "system",
    reason: str = "Withdrawn by request",
    db: Session = Depends(get_db)
):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    db_wheel = update_wheel_file_status(
        db, wheel_id, WheelStatus.WITHDRAWN.value,
        actor=actor,
        reason=reason
    )
    return db_wheel


@app.post("/api/wheels/{wheel_id}/close", response_model=WheelFileResponse)
def close_wheel(
    wheel_id: int,
    actor: str = "system",
    reason: str = "Closed",
    db: Session = Depends(get_db)
):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    db_wheel = update_wheel_file_status(
        db, wheel_id, WheelStatus.CLOSED.value,
        actor=actor,
        reason=reason
    )
    return db_wheel


@app.get("/api/wheels/{wheel_id}/export")
def export_wheel_report(wheel_id: int, format: str = "json", db: Session = Depends(get_db)):
    db_wheel = get_wheel_file(db, wheel_id)
    if not db_wheel:
        raise HTTPException(status_code=404, detail="Wheel file not found")

    report = {
        "wheel_file": {
            "id": db_wheel.id,
            "filename": db_wheel.filename,
            "package_name": db_wheel.package_name,
            "package_version": db_wheel.package_version,
            "platform_tag": db_wheel.platform_tag,
            "python_version": db_wheel.python_version,
            "status": db_wheel.status,
            "upload_time": db_wheel.upload_time.isoformat(),
            "uploader": db_wheel.uploader
        },
        "metadata": None,
        "entry_points": [],
        "dependencies": [],
        "validation_reports": [],
        "exception_paths": []
    }

    if db_wheel.wheel_metadata:
        report["metadata"] = {
            "name": db_wheel.wheel_metadata.name,
            "version": db_wheel.wheel_metadata.version,
            "summary": db_wheel.wheel_metadata.summary,
            "author": db_wheel.wheel_metadata.author,
            "license": db_wheel.wheel_metadata.license,
            "requires_python": db_wheel.wheel_metadata.requires_python
        }

    for ep in db_wheel.entry_points:
        report["entry_points"].append({
            "group": ep.group,
            "name": ep.name,
            "module": ep.module,
            "attr": ep.attr,
            "is_valid": ep.is_valid
        })

    for dep in db_wheel.dependencies:
        report["dependencies"].append({
            "name": dep.name,
            "specifier": dep.specifier,
            "extras": dep.extras,
            "is_valid": dep.is_valid
        })

    for vr in db_wheel.validation_reports:
        report["validation_reports"].append({
            "generated_at": vr.generated_at.isoformat(),
            "overall_status": vr.overall_status,
            "platform_tag_check": vr.platform_tag_check,
            "entry_points_check": vr.entry_points_check,
            "dependencies_check": vr.dependencies_check,
            "metadata_check": vr.metadata_check
        })

    for ep in db_wheel.exception_paths:
        report["exception_paths"].append({
            "handler": ep.handler,
            "conclusion": ep.conclusion,
            "notes": ep.notes,
            "handled_at": ep.handled_at.isoformat()
        })

    if format == "json":
        json_str = json.dumps(report, indent=2)
        return Response(
            content=json_str,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=wheel_report_{wheel_id}.json"
            }
        )
    elif format == "txt":
        txt_lines = [f"Wheel Report - {db_wheel.filename}", "=" * 50, ""]
        txt_lines.extend([f"{k}: {v}" for k, v in report["wheel_file"].items()])
        txt_lines.extend(["", "Metadata:", "-" * 30])
        if report["metadata"]:
            txt_lines.extend([f"{k}: {v}" for k, v in report["metadata"].items()])
        txt_lines.extend(["", "Entry Points:", "-" * 30])
        for ep in report["entry_points"]:
            txt_lines.append(f"[{ep['group']}] {ep['name']} = {ep['module']}")
        txt_lines.extend(["", "Dependencies:", "-" * 30])
        for dep in report["dependencies"]:
            txt_lines.append(f"{dep['name']}{dep['specifier']}")
        return Response(
            content="\n".join(txt_lines),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename=wheel_report_{wheel_id}.txt"
            }
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'json' or 'txt'")


@app.get("/api/statuses")
def get_statuses():
    return {"statuses": [status.value for status in WheelStatus]}
