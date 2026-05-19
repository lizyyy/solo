from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from datetime import datetime, timedelta
from typing import Optional
import os
import uuid

from database import SessionLocal, init_db, HazardStatus, OperationType
from services import HazardManagementService
from exporter import DataExporter
from utils import logger

app = FastAPI(title="隐患闭环管理系统", version="1.0.0")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_service(db=Depends(get_db)):
    return HazardManagementService(db)


def get_exporter(db=Depends(get_db)):
    return DataExporter(db)


@app.on_event("startup")
async def startup_event():
    init_db()
    logger.info("系统启动完成，数据库已初始化")


@app.get("/")
async def root():
    return {
        "message": "隐患闭环管理系统API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/hazards/register", summary="登记隐患")
async def register_hazard(
    hazard_no: str,
    title: str,
    description: str,
    location: str,
    level: str,
    operator_id: str,
    photo_path: Optional[str] = None,
    request_id: Optional[str] = None,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.register_hazard(
            hazard_no=hazard_no,
            title=title,
            description=description,
            location=location,
            level=level,
            operator_id=operator_id,
            photo_path=photo_path,
            request_id=request_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"登记隐患失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.post("/hazards/assign", summary="派发隐患")
async def assign_hazard(
    hazard_no: str,
    rectifier_id: str,
    deadline: datetime,
    operator_id: str,
    remark: Optional[str] = None,
    request_id: Optional[str] = None,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.assign_hazard(
            hazard_no=hazard_no,
            rectifier_id=rectifier_id,
            deadline=deadline,
            operator_id=operator_id,
            remark=remark,
            request_id=request_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"派发隐患失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.post("/hazards/rectify", summary="整改隐患")
async def rectify_hazard(
    hazard_no: str,
    rectification_desc: str,
    operator_id: str,
    photo_path: Optional[str] = None,
    request_id: Optional[str] = None,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.rectify_hazard(
            hazard_no=hazard_no,
            rectification_desc=rectification_desc,
            operator_id=operator_id,
            photo_path=photo_path,
            request_id=request_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"整改隐患失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.post("/hazards/recheck", summary="复查隐患")
async def recheck_hazard(
    hazard_no: str,
    recheck_result: bool,
    recheck_opinion: str,
    operator_id: str,
    photo_path: Optional[str] = None,
    request_id: Optional[str] = None,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.recheck_hazard(
            hazard_no=hazard_no,
            recheck_result=recheck_result,
            recheck_opinion=recheck_opinion,
            operator_id=operator_id,
            photo_path=photo_path,
            request_id=request_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"复查隐患失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.post("/hazards/archive", summary="归档隐患")
async def archive_hazard(
    hazard_no: str,
    operator_id: str,
    remark: Optional[str] = None,
    request_id: Optional[str] = None,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.archive_hazard(
            hazard_no=hazard_no,
            operator_id=operator_id,
            remark=remark,
            request_id=request_id
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"归档隐患失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.get("/hazards/{hazard_no}", summary="获取隐患详情")
async def get_hazard(
    hazard_no: str,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.get_hazard(hazard_no)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取隐患详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.get("/hazards", summary="获取隐患列表")
async def list_hazards(
    status: Optional[HazardStatus] = None,
    level: Optional[str] = None,
    rectifier_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.list_hazards(
            status=status,
            level=level,
            rectifier_id=rectifier_id,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size
        )
        return result
    except Exception as e:
        logger.error(f"获取隐患列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.get("/logs", summary="获取操作日志")
async def get_operation_logs(
    hazard_no: Optional[str] = None,
    operation_type: Optional[OperationType] = None,
    operator_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.get_operation_logs(
            hazard_no=hazard_no,
            operation_type=operation_type,
            operator_id=operator_id,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size
        )
        return result
    except Exception as e:
        logger.error(f"获取操作日志失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.get("/statistics", summary="获取统计数据")
async def get_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    service: HazardManagementService = Depends(get_service)
):
    try:
        result = service.get_statistics(start_date=start_date, end_date=end_date)
        return result
    except Exception as e:
        logger.error(f"获取统计数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@app.get("/export/excel", summary="导出隐患数据到Excel")
async def export_to_excel(
    status: Optional[HazardStatus] = None,
    level: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    exporter: DataExporter = Depends(get_exporter)
):
    try:
        os.makedirs("exports", exist_ok=True)
        file_name = f"hazards_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.xlsx"
        file_path = os.path.join("exports", file_name)

        result = exporter.export_hazards_to_excel(
            file_path=file_path,
            status=status,
            level=level,
            start_date=start_date,
            end_date=end_date
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return FileResponse(
            path=file_path,
            filename=file_name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出Excel失败: {str(e)}")
        raise HTTPException(status_code=500, detail="导出失败")


@app.get("/export/json", summary="导出隐患数据到JSON")
async def export_to_json(
    status: Optional[HazardStatus] = None,
    level: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    exporter: DataExporter = Depends(get_exporter)
):
    try:
        os.makedirs("exports", exist_ok=True)
        file_name = f"hazards_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.json"
        file_path = os.path.join("exports", file_name)

        result = exporter.export_hazards_to_json(
            file_path=file_path,
            status=status,
            level=level,
            start_date=start_date,
            end_date=end_date
        )

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        return FileResponse(
            path=file_path,
            filename=file_name,
            media_type="application/json"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出JSON失败: {str(e)}")
        raise HTTPException(status_code=500, detail="导出失败")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
