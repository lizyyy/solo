from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from database import get_db, engine, Base
from models import (
    DocumentPage, RequestExample, EnvironmentVariable,
    ValidationResult, ErrorCause, FixTrace,
    ValidationStatus, ErrorCategory
)
from schemas import (
    DocumentPageCreate, DocumentPageUpdate, DocumentPageResponse,
    RequestExampleCreate, RequestExampleUpdate, RequestExampleResponse,
    EnvironmentVariableCreate, EnvironmentVariableUpdate, EnvironmentVariableResponse,
    ValidationResultResponse, ValidationResultDetailResponse,
    FixTraceCreate, FixTraceResponse,
    ValidationRequest, ValidationBatchRequest, StatusUpdateRequest,
    APIError, PaginatedResponse
)
from services import (
    EnvironmentService, ValidationService, DuplicateGuard, FixTraceService,
    generate_hash, ExampleExtractor
)
from datetime import datetime

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API 文档示例验证服务",
    description="验证 API 文档中示例请求的有效性，支持环境变量注入、定期验证、错误归类和修复追踪",
    version="1.0.0"
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content=APIError(
            code=exc.status_code,
            message=exc.detail,
            details=getattr(exc, 'headers', None)
        ).model_dump()
    )


@app.get("/", response_class=HTMLResponse)
async def root():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>API 文档示例验证服务</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            .section { margin: 30px 0; padding: 20px; background: #f5f5f5; border-radius: 8px; }
            .endpoint { margin: 10px 0; padding: 10px; background: white; border-left: 4px solid #4CAF50; }
            .method { font-weight: bold; color: #4CAF50; margin-right: 10px; }
            .warning { border-left-color: #ff9800; }
            .danger { border-left-color: #f44336; }
            code { background: #eee; padding: 2px 6px; border-radius: 4px; }
        </style>
    </head>
    <body>
        <h1>🚀 API 文档示例验证服务</h1>
        <p>验证 API 文档中示例请求的有效性，核心规则在后端统一管理</p>
        
        <div class="section">
            <h2>📊 关键功能</h2>
            <ul>
                <li>✅ 示例提取：从 Markdown/代码块自动解析请求示例</li>
                <li>✅ 环境注入：自动替换 {{variable}} 占位符</li>
                <li>✅ 定期验证：支持定时批量验证</li>
                <li>✅ 错误归类：自动分类网络/认证/状态码等错误</li>
                <li>✅ 修复追踪：记录修复操作和处理人</li>
                <li>✅ 防重复提交：通过 content_hash 防止脏数据</li>
            </ul>
        </div>

        <div class="section">
            <h2>🔗 关键接口</h2>
            <div class="endpoint"><span class="method">GET</span> <code>/api/v1/examples</code> - 获取示例列表</div>
            <div class="endpoint"><span class="method">POST</span> <code>/api/v1/examples</code> - 创建请求示例</div>
            <div class="endpoint"><span class="method">POST</span> <code>/api/v1/validate</code> - 执行验证</div>
            <div class="endpoint"><span class="method">GET</span> <code>/api/v1/results</code> - 验证结果历史</div>
            <div class="endpoint"><span class="method">PUT</span> <code>/api/v1/results/{id}/status</code> - 状态推进</div>
            <div class="endpoint danger"><span class="method">GET</span> <code>/blocked/path</code> - 被拦截的路径示例</div>
            <div class="endpoint"><span class="method">GET</span> <code>/docs</code> - Swagger 文档</div>
        </div>

        <div class="section">
            <h2>📈 数据对象</h2>
            <ul>
                <li><strong>DocumentPage</strong>: 文档页面元信息</li>
                <li><strong>RequestExample</strong>: 请求示例（含 content_hash 防重）</li>
                <li><strong>EnvironmentVariable</strong>: 环境变量配置</li>
                <li><strong>ValidationResult</strong>: 验证结果记录</li>
                <li><strong>ErrorCause</strong>: 错误原因分类</li>
                <li><strong>FixTrace</strong>: 修复操作追踪</li>
            </ul>
        </div>
    </body>
    </html>
    """


@app.get("/blocked/path")
async def blocked_path():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="此路径已被安全规则拦截。请通过 /api/v1/ 前缀访问合法接口"
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/v1/documents", response_model=DocumentPageResponse, status_code=status.HTTP_201_CREATED)
async def create_document(document: DocumentPageCreate, db: Session = Depends(get_db)):
    existing = DuplicateGuard.check_duplicate_page(db, document.content_hash)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Document with same content already exists (ID: {existing.id})"
        )
    db_document = DocumentPage(**document.model_dump())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


@app.get("/api/v1/documents", response_model=PaginatedResponse)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(DocumentPage)
    total = query.count()
    documents = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[DocumentPageResponse.model_validate(d) for d in documents]
    )


@app.post("/api/v1/examples", response_model=RequestExampleResponse, status_code=status.HTTP_201_CREATED)
async def create_example(example: RequestExampleCreate, db: Session = Depends(get_db)):
    existing = DuplicateGuard.check_duplicate_example(db, example.content_hash)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Example with same content already exists (ID: {existing.id})"
        )
    if example.document_page_id:
        document = db.query(DocumentPage).filter(DocumentPage.id == example.document_page_id).first()
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document page not found"
            )
    db_example = RequestExample(**example.model_dump())
    db.add(db_example)
    db.commit()
    db.refresh(db_example)
    return db_example


@app.get("/api/v1/examples", response_model=PaginatedResponse)
async def list_examples(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_page_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RequestExample).filter(RequestExample.is_active == True)
    if document_page_id:
        query = query.filter(RequestExample.document_page_id == document_page_id)
    total = query.count()
    examples = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[RequestExampleResponse.model_validate(e) for e in examples]
    )


@app.get("/api/v1/examples/{example_id}", response_model=RequestExampleResponse)
async def get_example(example_id: int, db: Session = Depends(get_db)):
    example = db.query(RequestExample).filter(RequestExample.id == example_id).first()
    if not example:
        raise HTTPException(status_code=404, detail="Example not found")
    return example


@app.post("/api/v1/examples/extract")
async def extract_examples_from_content(content: str, db: Session = Depends(get_db)):
    extracted = ExampleExtractor.extract_from_markdown(content)
    results = []
    for ex in extracted:
        content_hash = generate_hash(ex['method'], ex['url'], ex['body'])
        existing = DuplicateGuard.check_duplicate_example(db, content_hash)
        if existing:
            results.append({
                'status': 'duplicate',
                'example_id': existing.id,
                'data': ex
            })
        else:
            results.append({
                'status': 'new',
                'content_hash': content_hash,
                'data': ex
            })
    return {"extracted": len(results), "results": results}


@app.post("/api/v1/environment", response_model=EnvironmentVariableResponse, status_code=status.HTTP_201_CREATED)
async def create_environment(env_var: EnvironmentVariableCreate, db: Session = Depends(get_db)):
    return EnvironmentService.create(db, env_var)


@app.get("/api/v1/environment", response_model=List[EnvironmentVariableResponse])
async def list_environment(include_secrets: bool = False, db: Session = Depends(get_db)):
    envs = EnvironmentService.get_all(db)
    response = []
    for env in envs:
        env_response = EnvironmentVariableResponse.model_validate(env)
        if not include_secrets and env.is_secret:
            env_response.value = "***"
        response.append(env_response)
    return response


@app.post("/api/v1/validate", response_model=List[ValidationResultResponse])
async def validate_requests(request: ValidationRequest, db: Session = Depends(get_db)):
    example_ids = []
    if request.example_id:
        example_ids = [request.example_id]
    elif request.example_ids:
        example_ids = request.example_ids
    elif request.document_page_id:
        examples = db.query(RequestExample).filter(
            RequestExample.document_page_id == request.document_page_id,
            RequestExample.is_active == True
        ).all()
        example_ids = [e.id for e in examples]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide example_id, example_ids, or document_page_id"
        )
    for eid in example_ids:
        pending = DuplicateGuard.check_pending_validation(db, eid)
        if pending:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Example {eid} already has a pending validation (Result ID: {pending.id})"
            )
    results = []
    for eid in example_ids:
        example = db.query(RequestExample).filter(RequestExample.id == eid).first()
        if not example:
            continue
        result = await ValidationService.validate_example(db, example, request.environment)
        results.append(result)
    return results


@app.get("/api/v1/results", response_model=PaginatedResponse)
async def list_validation_results(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    example_id: Optional[int] = None,
    status: Optional[ValidationStatus] = None,
    error_category: Optional[ErrorCategory] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ValidationResult).join(ErrorCause, isouter=True)
    if example_id:
        query = query.filter(ValidationResult.example_id == example_id)
    if status:
        query = query.filter(ValidationResult.status == status)
    if error_category:
        query = query.filter(ErrorCause.category == error_category)
    query = query.order_by(ValidationResult.created_at.desc())
    total = query.count()
    results = query.offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[ValidationResultResponse.model_validate(r) for r in results]
    )


@app.get("/api/v1/results/{result_id}", response_model=ValidationResultDetailResponse)
async def get_validation_result(result_id: int, db: Session = Depends(get_db)):
    result = db.query(ValidationResult).filter(ValidationResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Validation result not found")
    return result


@app.put("/api/v1/results/{result_id}/status", response_model=ValidationResultResponse)
async def update_validation_status(
    result_id: int,
    status_update: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    result = db.query(ValidationResult).filter(ValidationResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Validation result not found")
    if status_update.status == ValidationStatus.FIXED:
        FixTraceService.create_fix_trace(
            db,
            result_id,
            action_taken=f"Status updated to {status_update.status}",
            operator=status_update.operator,
            remark=status_update.remark
        )
    result.status = status_update.status
    db.commit()
    db.refresh(result)
    return result


@app.post("/api/v1/fix-traces", response_model=FixTraceResponse, status_code=status.HTTP_201_CREATED)
async def create_fix_trace(fix_trace: FixTraceCreate, db: Session = Depends(get_db)):
    result = db.query(ValidationResult).filter(ValidationResult.id == fix_trace.validation_result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Validation result not found")
    return FixTraceService.create_fix_trace(db, **fix_trace.model_dump())


@app.get("/api/v1/fix-traces", response_model=List[FixTraceResponse])
async def list_fix_traces(
    validation_result_id: Optional[int] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FixTrace)
    if validation_result_id:
        query = query.filter(FixTrace.validation_result_id == validation_result_id)
    if operator:
        query = query.filter(FixTrace.operator == operator)
    return query.order_by(FixTrace.created_at.desc()).all()


@app.get("/api/v1/stats")
async def get_statistics(db: Session = Depends(get_db)):
    total_examples = db.query(RequestExample).filter(RequestExample.is_active == True).count()
    total_results = db.query(ValidationResult).count()
    success_count = db.query(ValidationResult).filter(ValidationResult.status == ValidationStatus.SUCCESS).count()
    failed_count = db.query(ValidationResult).filter(ValidationResult.status == ValidationStatus.FAILED).count()
    fixed_count = db.query(ValidationResult).filter(ValidationResult.status == ValidationStatus.FIXED).count()
    error_stats = db.query(ErrorCause.category, func.count(ErrorCause.id))\
        .group_by(ErrorCause.category).all()
    return {
        "total_examples": total_examples,
        "total_validations": total_results,
        "success_rate": round(success_count / total_results * 100, 2) if total_results > 0 else 0,
        "status_breakdown": {
            "success": success_count,
            "failed": failed_count,
            "fixed": fixed_count,
            "others": total_results - success_count - failed_count - fixed_count
        },
        "error_categories": {cat.value: count for cat, count in error_stats}
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
