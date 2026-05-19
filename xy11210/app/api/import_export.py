from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from io import BytesIO
from app.core.database import get_db
from app.models.models import User, UserRole, InspectionResult
from app.schemas.schemas import ImportRecordResponse, ApiResponse
from app.services.import_export_service import ImportExportService
from app.api.deps import get_current_user, require_any_role
from app.utils.logger import logger

router = APIRouter()


@router.post("/import", response_model=ApiResponse)
def import_inspections(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(UserRole.ADMIN, UserRole.ENGINEER))
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支持Excel文件")
    
    try:
        content = file.file.read()
        import_record, errors = ImportExportService.import_inspection_records(
            db, content, file.filename, current_user.id
        )
        
        return ApiResponse(
            code=200,
            message=f"导入完成: 成功{import_record.success_count}条, 失败{import_record.failed_count}条, 重复{import_record.duplicate_count}条",
            data={
                "import": ImportRecordResponse.model_validate(import_record),
                "errors": errors
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error({"action": "import_failed", "error": str(e)})
        raise HTTPException(status_code=500, detail="导入失败")


@router.get("/export")
def export_inspections(
    pump_room_id: Optional[int] = None,
    result: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result_enum = None
    if result:
        try:
            result_enum = InspectionResult(result)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的巡检结果")
    
    try:
        excel_data = ImportExportService.export_inspection_records(
            db, pump_room_id=pump_room_id, result=result_enum,
            start_date=start_date, end_date=end_date
        )
        
        output = BytesIO(excel_data)
        output.seek(0)
        
        filename = f"inspection_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error({"action": "export_failed", "error": str(e)})
        raise HTTPException(status_code=500, detail="导出失败")


@router.get("/template")
def download_template():
    import pandas as pd
    
    data = {
        "泵房编号": ["PR-001", "PR-002"],
        "巡检时间": ["2024-01-15 10:30:00", "2024-01-15 14:00:00"],
        "水压": [0.35, 0.32],
        "水位": [2.5, 2.3],
        "水泵状态": ["正常", "正常"],
        "阀门状态": ["正常", "正常"],
        "管道状态": ["正常", "轻微漏水"],
        "电气状态": ["正常", "正常"],
        "温度": [25.5, 26.0],
        "湿度": [60, 62],
        "噪音": [55, 58],
        "巡检结果": ["normal", "abnormal"],
        "问题描述": ["", "管道需要维修"],
        "备注": ["常规巡检", "需要派工"],
        "巡检人": ["admin", "engineer"],
        "唯一标识": ["UNIQUE001", "UNIQUE002"]
    }
    
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="模板")
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=inspection_template.xlsx"}
    )
