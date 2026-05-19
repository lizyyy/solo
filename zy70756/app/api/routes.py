from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os

from app.core.database import get_db
from app.schemas.schemas import (
    CsvFileResponse, CsvFileDetailResponse,
    ColumnMappingResponse, ColumnMappingUpdate,
    BadRowResponse, BadRowFixRequest,
    ConversionSummaryResponse, AuditLogResponse,
    StatusUpdateRequest, ConversionRequest,
    RebuildRequest
)
from app.services.csv_service import (
    create_csv_file, get_csv_files, get_csv_file,
    update_column_mapping, start_conversion,
    fix_bad_row, update_file_status, get_ndjson_output,
    rebuild_ndjson_with_fixed_rows
)

router = APIRouter(prefix="/api/v1", tags=["csv-converter"])

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/csv/upload", response_model=CsvFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed"
        )

    content = await file.read()
    db_file = create_csv_file(db, file.filename, content)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, f"{db_file.id}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(content)

    return db_file


@router.get("/csv", response_model=List[CsvFileResponse])
def list_csv_files(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return get_csv_files(db, skip, limit)


@router.get("/csv/{file_id}", response_model=CsvFileDetailResponse)
def get_csv_file_detail(
    file_id: int,
    db: Session = Depends(get_db)
):
    db_file = get_csv_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSV file not found"
        )
    return db_file


@router.put("/column-mapping/{mapping_id}", response_model=ColumnMappingResponse)
def update_column_mapping_endpoint(
    mapping_id: int,
    mapping_update: ColumnMappingUpdate,
    db: Session = Depends(get_db)
):
    updated = update_column_mapping(
        db, mapping_id,
        mapping_update.normalized_column,
        mapping_update.is_ignored
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Column mapping not found"
        )
    return updated


@router.post("/csv/{file_id}/convert")
def convert_csv(
    file_id: int,
    conversion_request: ConversionRequest,
    db: Session = Depends(get_db)
):
    db_file = get_csv_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSV file not found"
        )

    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{db_file.file_name}")
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file not found on disk"
        )

    with open(file_path, "rb") as f:
        file_content = f.read()

    result = start_conversion(
        db, file_id, file_content,
        conversion_request.handler,
        conversion_request.custom_encoding
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Conversion failed")
        )

    return result


@router.put("/bad-row/{bad_row_id}/fix", response_model=BadRowResponse)
def fix_bad_row_endpoint(
    bad_row_id: int,
    fix_request: BadRowFixRequest,
    db: Session = Depends(get_db)
):
    fixed_row = fix_bad_row(db, bad_row_id, fix_request.fixed_data, fix_request.handler)
    if not fixed_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bad row not found"
        )
    return fixed_row


@router.put("/csv/{file_id}/status", response_model=CsvFileResponse)
def update_status(
    file_id: int,
    status_update: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    updated_file = update_file_status(
        db, file_id, status_update.status,
        status_update.handler, status_update.conclusion
    )
    if not updated_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSV file not found"
        )
    return updated_file


@router.get("/csv/{file_id}/export")
def export_ndjson(
    file_id: int,
    db: Session = Depends(get_db)
):
    db_file = get_csv_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSV file not found"
        )

    if db_file.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File not yet converted. Please convert first."
        )

    output_path = get_ndjson_output(file_id)
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NDJSON output file not found"
        )

    return FileResponse(
        output_path,
        media_type="application/x-ndjson",
        filename=f"{db_file.file_name.replace('.csv', '.ndjson')}"
    )


@router.post("/csv/{file_id}/rebuild")
def rebuild_ndjson_endpoint(
    file_id: int,
    rebuild_request: RebuildRequest,
    db: Session = Depends(get_db)
):
    result = rebuild_ndjson_with_fixed_rows(
        db, file_id, rebuild_request.handler
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "NDJSON rebuild failed")
        )

    return result


@router.delete("/csv/{file_id}")
def delete_csv_file(
    file_id: int,
    db: Session = Depends(get_db)
):
    db_file = get_csv_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSV file not found"
        )

    db.delete(db_file)
    db.commit()

    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{db_file.file_name}")
    if os.path.exists(file_path):
        os.remove(file_path)

    output_path = f"./output/{file_id}_output.ndjson"
    if os.path.exists(output_path):
        os.remove(output_path)

    return {"message": "CSV file deleted successfully", "file_id": file_id}


@router.get("/csv/{file_id}/audit-logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    file_id: int,
    db: Session = Depends(get_db)
):
    db_file = get_csv_file(db, file_id)
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CSV file not found"
        )
    return db_file.audit_logs
