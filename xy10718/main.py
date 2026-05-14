from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import json
import pandas as pd
import os
from io import BytesIO

from database import get_db, init_db, SlowQuery, OptimizationHistory, ErrorLog
from schema import SlowQueryCreate, SlowQueryResponse, StatusUpdate, BatchImportResult, ExportFilter
from analyzer import ExecutionPlanAnalyzer, log_error

app = FastAPI(title="SQL慢查询归因板")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = ExecutionPlanAnalyzer()

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/", response_class=HTMLResponse)
async def root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/api/queries/", response_model=SlowQueryResponse)
async def create_query(query: SlowQueryCreate, db: Session = Depends(get_db)):
    try:
        execution_plan = analyzer.generate_execution_plan(query.sql_content, query.database)
        index_suggestion = analyzer.generate_index_suggestion(query.sql_content, execution_plan)
        is_valid, validation_error = analyzer.validate_query(query.sql_content, query.affected_endpoints)
        
        db_query = SlowQuery(
            fingerprint=query.fingerprint,
            sql_content=query.sql_content,
            execution_time=query.execution_time,
            rows_examined=query.rows_examined,
            rows_sent=query.rows_sent,
            database=query.database,
            affected_endpoints=query.affected_endpoints,
            execution_plan=json.dumps(execution_plan, ensure_ascii=False),
            index_suggestion=index_suggestion,
            owner=query.owner,
            priority=query.priority,
            is_valid=is_valid,
            validation_error=validation_error if not is_valid else None
        )
        
        db.add(db_query)
        db.commit()
        db.refresh(db_query)
        return db_query
    except Exception as e:
        log_error("CREATE_QUERY_ERROR", str(e), str(query.dict()))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/queries/batch", response_model=BatchImportResult)
async def batch_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    success_count = 0
    failed_count = 0
    errors = []
    
    try:
        content = await file.read()
        if file.filename.endswith('.json'):
            data = json.loads(content.decode('utf-8'))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
            data = df.to_dict('records')
        else:
            raise HTTPException(status_code=400, detail="只支持JSON或CSV格式")
        
        for idx, item in enumerate(data):
            try:
                query = SlowQueryCreate(**item)
                execution_plan = analyzer.generate_execution_plan(query.sql_content, query.database)
                index_suggestion = analyzer.generate_index_suggestion(query.sql_content, execution_plan)
                is_valid, validation_error = analyzer.validate_query(query.sql_content, query.affected_endpoints)
                
                db_query = SlowQuery(
                    fingerprint=query.fingerprint,
                    sql_content=query.sql_content,
                    execution_time=query.execution_time,
                    rows_examined=query.rows_examined,
                    rows_sent=query.rows_sent,
                    database=query.database,
                    affected_endpoints=query.affected_endpoints,
                    execution_plan=json.dumps(execution_plan, ensure_ascii=False),
                    index_suggestion=index_suggestion,
                    owner=query.owner,
                    priority=query.priority,
                    is_valid=is_valid,
                    validation_error=validation_error if not is_valid else None
                )
                db.add(db_query)
                success_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"第{idx+1}条: {str(e)}")
                log_error("BATCH_IMPORT_ERROR", str(e), json.dumps(item, ensure_ascii=False))
        
        db.commit()
        return BatchImportResult(success=success_count, failed=failed_count, errors=errors)
    except Exception as e:
        log_error("BATCH_IMPORT_ERROR", str(e), "")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/queries/", response_model=List[SlowQueryResponse])
async def get_queries(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    queries = db.query(SlowQuery).order_by(SlowQuery.created_at.desc()).offset(skip).limit(limit).all()
    return queries

@app.get("/api/queries/{query_id}", response_model=SlowQueryResponse)
async def get_query(query_id: int, db: Session = Depends(get_db)):
    query = db.query(SlowQuery).filter(SlowQuery.id == query_id).first()
    if query is None:
        raise HTTPException(status_code=404, detail="查询不存在")
    return query

@app.put("/api/queries/{query_id}/status", response_model=SlowQueryResponse)
async def update_status(query_id: int, status_update: StatusUpdate, db: Session = Depends(get_db)):
    query = db.query(SlowQuery).filter(SlowQuery.id == query_id).first()
    if query is None:
        raise HTTPException(status_code=404, detail="查询不存在")
    
    old_status = query.status
    query.status = status_update.status
    
    if status_update.status == "optimized":
        query.optimized_at = datetime.utcnow()
    
    if status_update.notes:
        query.optimization_notes = status_update.notes
    
    history = OptimizationHistory(
        query_id=query_id,
        old_status=old_status,
        new_status=status_update.status,
        notes=status_update.notes,
        changed_by=status_update.changed_by
    )
    db.add(history)
    db.commit()
    db.refresh(query)
    return query

@app.get("/api/errors/")
async def get_errors(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    errors = db.query(ErrorLog).order_by(ErrorLog.created_at.desc()).offset(skip).limit(limit).all()
    return [{"id": e.id, "type": e.error_type, "message": e.error_message, "context": e.context, "created_at": e.created_at} for e in errors]

@app.post("/api/export/")
async def export_queries(filter: ExportFilter, db: Session = Depends(get_db)):
    query = db.query(SlowQuery)
    
    if filter.owner:
        query = query.filter(SlowQuery.owner == filter.owner)
    if filter.status:
        query = query.filter(SlowQuery.status == filter.status)
    if filter.start_date:
        query = query.filter(SlowQuery.created_at >= filter.start_date)
    if filter.end_date:
        query = query.filter(SlowQuery.created_at <= filter.end_date)
    
    queries = query.order_by(SlowQuery.owner, SlowQuery.created_at.desc()).all()
    
    data = []
    for q in queries:
        data.append({
            "ID": q.id,
            "负责人": q.owner or "未分配",
            "创建时间": q.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "数据库": q.database,
            "执行时间(秒)": q.execution_time,
            "扫描行数": q.rows_examined,
            "返回行数": q.rows_sent,
            "影响接口": q.affected_endpoints or "无",
            "状态": q.status,
            "优先级": q.priority,
            "索引建议": q.index_suggestion or "无",
            "是否有效": "是" if q.is_valid else "否",
            "校验错误": q.validation_error or "无",
            "优化时间": q.optimized_at.strftime("%Y-%m-%d %H:%M:%S") if q.optimized_at else "未优化",
            "优化备注": q.optimization_notes or "无"
        })
    
    df = pd.DataFrame(data)
    
    os.makedirs("exports", exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"exports/slow_queries_export_{timestamp}.xlsx"
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="全部数据", index=False)
        
        if not df.empty:
            owner_group = df.groupby("负责人").agg({
                "ID": "count",
                "执行时间(秒)": ["mean", "sum"],
                "是否有效": lambda x: (x == "是").sum()
            }).round(2)
            owner_group.columns = ["查询数量", "平均执行时间", "总执行时间", "有效查询数"]
            owner_group.to_excel(writer, sheet_name="按负责人分组")
            
            index_group = df.groupby("索引建议").agg({
                "ID": "count",
                "执行时间(秒)": "mean"
            }).round(2)
            index_group.columns = ["查询数量", "平均执行时间"]
            index_group.to_excel(writer, sheet_name="按索引建议分组")
            
            df["日期"] = pd.to_datetime(df["创建时间"]).dt.date
            time_group = df.groupby("日期").agg({
                "ID": "count",
                "执行时间(秒)": "sum"
            })
            time_group.columns = ["当日查询数", "当日总执行时间"]
            time_group.to_excel(writer, sheet_name="按时间分组")
    
    return FileResponse(filename, filename=f"slow_queries_export_{timestamp}.xlsx")

@app.get("/api/stats/")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(SlowQuery).count()
    pending = db.query(SlowQuery).filter(SlowQuery.status == "pending").count()
    optimized = db.query(SlowQuery).filter(SlowQuery.status == "optimized").count()
    invalid = db.query(SlowQuery).filter(SlowQuery.is_valid == False).count()
    
    avg_time = db.query(SlowQuery.execution_time).filter(SlowQuery.is_valid == True).all()
    avg_execution_time = sum(t[0] for t in avg_time) / len(avg_time) if avg_time else 0
    
    return {
        "total_queries": total,
        "pending_queries": pending,
        "optimized_queries": optimized,
        "invalid_queries": invalid,
        "avg_execution_time": round(avg_execution_time, 2)
    }

if __name__ == "__main__":
    import uvicorn
    os.makedirs("static", exist_ok=True)
    os.makedirs("exports", exist_ok=True)
    uvicorn.run(app, host="0.0.0.0", port=8000)
