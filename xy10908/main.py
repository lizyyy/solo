from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import RequestValidationError
from sqlalchemy.orm import Session, sessionmaker
from typing import List, Optional
import json
import traceback

from database import engine, get_db, Base
import models
import schemas
import crud


def get_safe_db_session():
    """获取独立的数据库会话，用于异常处理等场景"""
    try:
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        return SessionLocal()
    except Exception:
        return None


def safe_log_exception(endpoint: str, raw_input: str, error_message: str, processing_result: str):
    """安全记录异常日志，不影响主流程"""
    try:
        db = get_safe_db_session()
        if db:
            try:
                crud.log_exception(db, endpoint, raw_input, error_message, processing_result)
            finally:
                db.close()
    except Exception:
        pass

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="无人货柜补货结算 API",
    description="提供货柜补货、货损记录、临期下架、结算管理等功能的 REST API 服务",
    version="1.0.0"
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        try:
            raw_input = body.decode()
        except:
            raw_input = str(body)
        
        safe_log_exception(
            endpoint=request.url.path,
            raw_input=raw_input,
            error_message=str(exc),
            processing_result="参数验证失败"
        )
    except Exception:
        pass

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "请求参数验证失败",
            "errors": exc.errors()
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    try:
        body = await request.body()
        try:
            raw_input = body.decode()
        except:
            raw_input = str(body)
        
        safe_log_exception(
            endpoint=request.url.path,
            raw_input=raw_input,
            error_message=str(exc.detail),
            processing_result=f"HTTP {exc.status_code} 错误"
        )
    except Exception:
        pass

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    try:
        body = await request.body()
        try:
            raw_input = body.decode()
        except:
            raw_input = str(body)
        
        safe_log_exception(
            endpoint=request.url.path,
            raw_input=raw_input,
            error_message=str(exc),
            processing_result="系统内部错误"
        )
    except Exception:
        pass

    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "系统内部错误"
        }
    )


@app.post("/api/cabinets/", response_model=schemas.APIResponse, tags=["货柜管理"])
def create_cabinet(cabinet: schemas.CabinetCreate, db: Session = Depends(get_db)):
    db_cabinet = crud.get_cabinet_by_no(db, cabinet_no=cabinet.cabinet_no)
    if db_cabinet:
        return schemas.APIResponse(
            success=False,
            message="货柜编号已存在",
            data={"cabinet_no": cabinet.cabinet_no}
        )
    created = crud.create_cabinet(db=db, cabinet=cabinet)
    return schemas.APIResponse(
        success=True,
        message="货柜创建成功",
        data={"cabinet": schemas.Cabinet.model_validate(created).model_dump()}
    )


@app.get("/api/cabinets/", response_model=schemas.APIResponse, tags=["货柜管理"])
def read_cabinets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cabinets = crud.get_cabinets(db, skip=skip, limit=limit)
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={
            "cabinets": [schemas.Cabinet.model_validate(c).model_dump() for c in cabinets],
            "total": len(cabinets)
        }
    )


@app.get("/api/cabinets/{cabinet_no}/skus/", response_model=schemas.APIResponse, tags=["库存管理"])
def read_sku_stocks(cabinet_no: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    cabinet = crud.get_cabinet_by_no(db, cabinet_no=cabinet_no)
    if not cabinet:
        return schemas.APIResponse(success=False, message="货柜不存在")
    skus = crud.get_sku_stocks(db, cabinet_id=cabinet.id, skip=skip, limit=limit)
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={
            "skus": [schemas.SKUStock.model_validate(s).model_dump() for s in skus],
            "total": len(skus)
        }
    )


@app.post("/api/replenishments/", response_model=schemas.APIResponse, tags=["补货管理"])
def create_replenishment(batch: schemas.ReplenishmentBatchCreate, db: Session = Depends(get_db)):
    db_batch, is_new = crud.create_replenishment_batch(db=db, batch=batch)
    if not is_new:
        return schemas.APIResponse(
            success=True,
            message="重复请求，已返回现有数据",
            data={
                "batch": schemas.ReplenishmentBatch.model_validate(db_batch).model_dump(),
                "is_idempotent": True
            }
        )
    return schemas.APIResponse(
        success=True,
        message="补货单创建成功",
        data={
            "batch": schemas.ReplenishmentBatch.model_validate(db_batch).model_dump(),
            "is_idempotent": False
        }
    )


@app.get("/api/replenishments/", response_model=schemas.APIResponse, tags=["补货管理"])
def read_replenishments(cabinet_no: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = crud.get_replenishment_batches(db, cabinet_no=cabinet_no, skip=skip, limit=limit)
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={
            "batches": [schemas.ReplenishmentBatch.model_validate(b).model_dump() for b in batches],
            "total": len(batches)
        }
    )


@app.get("/api/replenishments/{batch_no}/", response_model=schemas.APIResponse, tags=["补货管理"])
def read_replenishment(batch_no: str, db: Session = Depends(get_db)):
    batch = crud.get_replenishment_by_batch_no(db, batch_no=batch_no)
    if not batch:
        return schemas.APIResponse(success=False, message="补货单不存在")
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={"batch": schemas.ReplenishmentBatch.model_validate(batch).model_dump()}
    )


@app.patch("/api/replenishments/{batch_no}/status/", response_model=schemas.APIResponse, tags=["补货管理"])
def update_replenishment_status(batch_no: str, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    try:
        batch = crud.update_replenishment_status(db, batch_no=batch_no, status_update=status_update)
    except ValueError as e:
        return schemas.APIResponse(success=False, message=str(e))
    if not batch:
        return schemas.APIResponse(success=False, message="补货单不存在")
    return schemas.APIResponse(
        success=True,
        message="状态更新成功",
        data={"batch": schemas.ReplenishmentBatch.model_validate(batch).model_dump()}
    )


@app.post("/api/settlements/", response_model=schemas.APIResponse, tags=["结算管理"])
def create_settlement(settlement: schemas.SettlementSummaryCreate, db: Session = Depends(get_db)):
    db_settlement = crud.create_settlement(db=db, settlement=settlement)
    if not db_settlement:
        return schemas.APIResponse(success=False, message="创建结算失败，货柜或补货单不存在")
    return schemas.APIResponse(
        success=True,
        message="结算创建成功",
        data={"settlement": schemas.SettlementSummary.model_validate(db_settlement).model_dump()}
    )


@app.get("/api/settlements/", response_model=schemas.APIResponse, tags=["结算管理"])
def read_settlements(cabinet_no: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    settlements = crud.get_settlements(db, cabinet_no=cabinet_no, skip=skip, limit=limit)
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={
            "settlements": [schemas.SettlementSummary.model_validate(s).model_dump() for s in settlements],
            "total": len(settlements)
        }
    )


@app.get("/api/settlements/{settlement_no}/export/", response_model=schemas.APIResponse, tags=["结算管理"])
def export_settlement(settlement_no: str, db: Session = Depends(get_db)):
    data = crud.export_settlement_data(db, settlement_no=settlement_no)
    if not data:
        return schemas.APIResponse(success=False, message="结算单不存在")
    return schemas.APIResponse(
        success=True,
        message="导出成功",
        data=data
    )


@app.post("/api/manual-corrections/", response_model=schemas.APIResponse, tags=["人工修正"])
def create_manual_correction(correction: schemas.ManualCorrectionCreate, db: Session = Depends(get_db)):
    try:
        db_correction = crud.create_manual_correction(db=db, correction=correction)
    except ValueError as e:
        return schemas.APIResponse(success=False, message=str(e))
    if not db_correction:
        return schemas.APIResponse(success=False, message="修正目标不存在")
    return schemas.APIResponse(
        success=True,
        message="人工修正成功",
        data={"correction": schemas.ManualCorrection.model_validate(db_correction).model_dump()}
    )


@app.get("/api/manual-corrections/", response_model=schemas.APIResponse, tags=["人工修正"])
def read_manual_corrections(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    corrections = crud.get_manual_corrections(db, skip=skip, limit=limit)
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={
            "corrections": [schemas.ManualCorrection.model_validate(c).model_dump() for c in corrections],
            "total": len(corrections)
        }
    )


@app.get("/api/exception-logs/", response_model=schemas.APIResponse, tags=["异常日志"])
def read_exception_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = crud.get_exception_logs(db, skip=skip, limit=limit)
    return schemas.APIResponse(
        success=True,
        message="查询成功",
        data={
            "logs": [schemas.ExceptionLog.model_validate(l).model_dump() for l in logs],
            "total": len(logs)
        }
    )


@app.get("/", tags=["系统"])
def root():
    return {
        "name": "无人货柜补货结算 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy"}
