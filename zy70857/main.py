from datetime import datetime
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, get_db, Base
from app.import_service import (
    import_cases,
    import_persons,
    process_borrow_records,
)
from app.report_service import (
    get_batch_list,
    get_batch_report,
    get_record_trace,
    search_records,
    get_statistics,
)
from app.schemas import (
    ImportResponse,
    BatchReportResponse,
    RecordTraceResponse,
    BatchListResponse,
    HealthResponse,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="法院卷宗借阅管理API",
    description="用于卷宗借阅数据导入、规则校验和追溯管理的API系统",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse, summary="健康检查")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now()}


@app.post(
    "/api/import/cases",
    summary="导入案件信息",
    description="上传JSON格式的案件信息文件，支持批量导入和更新",
)
async def upload_cases(
    file: UploadFile = File(..., description="案件JSON文件"),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="仅支持JSON格式文件")

    content = await file.read()
    try:
        added, updated = import_cases(db, content)
        return {
            "status": "success",
            "message": f"案件导入完成，新增{added}条，更新{updated}条",
            "added": added,
            "updated": updated,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post(
    "/api/import/persons",
    summary="导入人员权限表",
    description="上传JSON格式的人员权限信息文件",
)
async def upload_persons(
    file: UploadFile = File(..., description="人员权限JSON文件"),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="仅支持JSON格式文件")

    content = await file.read()
    try:
        added, updated = import_persons(db, content)
        return {
            "status": "success",
            "message": f"人员权限导入完成，新增{added}条，更新{updated}条",
            "added": added,
            "updated": updated,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post(
    "/api/import/borrow",
    response_model=ImportResponse,
    summary="导入借阅记录",
    description="上传CSV或JSON格式的借阅记录，系统自动进行规则校验并分类返回",
)
async def upload_borrow_records(
    file: UploadFile = File(..., description="借阅记录文件（CSV/JSON格式）"),
    check_duplicate: bool = Query(True, description="是否检查重复记录"),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith((".csv", ".json")):
        raise HTTPException(status_code=400, detail="仅支持CSV或JSON格式文件")

    content = await file.read()
    try:
        result = process_borrow_records(db, content, file.filename, check_duplicate)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(
    "/api/batches",
    response_model=BatchListResponse,
    summary="获取批次列表",
    description="分页获取所有导入批次的列表",
)
async def list_batches(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    db: Session = Depends(get_db),
):
    return get_batch_list(db, skip, limit)


@app.get(
    "/api/batches/{batch_id}",
    response_model=BatchReportResponse,
    summary="获取批次详情报告",
    description="根据批次ID获取该批次的完整导入报告和所有记录",
)
async def get_batch(batch_id: str, db: Session = Depends(get_db)):
    report = get_batch_report(db, batch_id)
    if not report:
        raise HTTPException(status_code=404, detail="批次不存在")
    return report


@app.get(
    "/api/records/{record_no}/trace",
    response_model=RecordTraceResponse,
    summary="单条记录追溯",
    description="根据记录编号追溯完整的借阅记录、案件信息、人员信息和校验结果",
)
async def trace_record(record_no: str, db: Session = Depends(get_db)):
    trace = get_record_trace(db, record_no)
    if not trace:
        raise HTTPException(status_code=404, detail="记录不存在")
    return trace


@app.get(
    "/api/records/search",
    summary="搜索借阅记录",
    description="根据案号、人员编号、姓名等条件搜索借阅记录",
)
async def search(
    case_no: str = Query(None, description="案号"),
    person_id: str = Query(None, description="人员编号"),
    person_name: str = Query(None, description="人员姓名"),
    status: str = Query(None, description="状态"),
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数"),
    db: Session = Depends(get_db),
):
    return search_records(db, case_no, person_id, person_name, status, skip, limit)


@app.get(
    "/api/statistics",
    summary="获取统计信息",
    description="获取系统整体统计数据",
)
async def get_stats(db: Session = Depends(get_db)):
    return get_statistics(db)


@app.get("/", summary="首页")
async def root():
    return {
        "name": "法院卷宗借阅管理API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }