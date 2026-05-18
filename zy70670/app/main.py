from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from app.database import engine, get_db, Base
from app.models import ProductStatus, ReferenceStatus, FailureReason, Product, Article, HealthReport
from app import schemas, services, exporter

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="知识库失效产品状态引用统计后端API",
    description="用于检测和统计客服知识库中引用已下线产品的文章链接",
    version="1.0.0"
)


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    if "已存在" in str(exc) or "不存在" in str(exc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_FIELD",
                "message": str(exc),
                "details": {}
            }
        )
    if "已经处理过" in str(exc):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": "ALREADY_PROCESSED",
                "message": str(exc),
                "details": {}
            }
        )
    if "无效的产品状态" in str(exc):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "STATUS_NOT_ALLOWED",
                "message": str(exc),
                "details": {}
            }
        )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={
            "error_code": "VALIDATION_ERROR",
            "message": str(exc),
            "details": {}
        }
    )


@app.get("/")
async def root():
    return {"message": "知识库失效产品状态引用统计API服务运行中"}


@app.post("/products/", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    product_service = services.ProductService(db)
    try:
        return product_service.create_product(product)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "VALIDATION_ERROR",
                "message": str(e),
                "details": {}
            }
        )


@app.get("/products/", response_model=List[schemas.Product])
def list_products(
    status_filter: Optional[ProductStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    if status_filter:
        query = query.filter(Product.status == status_filter)
    return query.offset(skip).limit(limit).all()


@app.get("/products/{product_id}", response_model=schemas.Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NOT_FOUND",
                "message": "产品不存在",
                "details": {"product_id": product_id}
            }
        )
    return product


@app.patch("/products/{product_id}/status", response_model=schemas.Product)
def update_product_status(
    product_id: int,
    status_update: schemas.ProductUpdate,
    db: Session = Depends(get_db)
):
    if not status_update.status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_FIELD",
                "message": "缺少状态字段",
                "details": {"required_field": "status"}
            }
        )
    
    product_service = services.ProductService(db)
    try:
        return product_service.update_product_status(product_id, status_update.status)
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "NOT_FOUND",
                    "message": str(e),
                    "details": {}
                }
            )
        raise


@app.post("/articles/import", response_model=schemas.Article)
def import_article(
    file_path: str,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_FIELD",
                "message": "缺少文件路径",
                "details": {"required_field": "file_path"}
            }
        )
    
    article_service = services.ArticleService(db)
    try:
        return article_service.import_article_from_file(file_path, product_id)
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "FILE_NOT_FOUND",
                "message": str(e),
                "details": {}
            }
        )


@app.post("/articles/scan", response_model=schemas.ScanResult)
def scan_articles(scan_request: schemas.ScanRequest, db: Session = Depends(get_db)):
    article_service = services.ArticleService(db)
    
    article_ids = None
    if scan_request.scan_all:
        pass
    elif scan_request.article_ids:
        article_ids = scan_request.article_ids
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "MISSING_FIELD",
                "message": "请指定scan_all或article_ids",
                "details": {}
            }
        )
    
    scanned_count, new_references, updated_references = article_service.scan_articles(
        article_ids,
        validate_links=scan_request.validate_links
    )
    
    return schemas.ScanResult(
        scanned_count=scanned_count,
        new_references=new_references,
        updated_references=updated_references
    )


@app.get("/articles/", response_model=List[schemas.Article])
def list_articles(
    product_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Article)
    if product_id:
        query = query.filter(Article.product_id == product_id)
    return query.offset(skip).limit(limit).all()


@app.get("/references/invalid", response_model=List[schemas.ArticleReference])
def get_invalid_references(
    status_filter: Optional[ReferenceStatus] = None,
    failure_reason: Optional[FailureReason] = None,
    product_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    article_service = services.ArticleService(db)
    references = article_service.get_invalid_references(
        status=status_filter,
        failure_reason=failure_reason,
        product_id=product_id
    )
    return references[skip:skip + limit]


@app.patch("/references/{reference_id}/processed", response_model=schemas.ArticleReference)
def mark_reference_processed(reference_id: int, db: Session = Depends(get_db)):
    article_service = services.ArticleService(db)
    try:
        return article_service.mark_as_processed(reference_id)
    except ValueError as e:
        if "不存在" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": "NOT_FOUND",
                    "message": str(e),
                    "details": {"reference_id": reference_id}
                }
            )
        if "已经处理过" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error_code": "ALREADY_PROCESSED",
                    "message": str(e),
                    "details": {"reference_id": reference_id}
                }
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error_code": "NEEDS_MANUAL_REVIEW",
                "message": str(e),
                "details": {"reference_id": reference_id}
            }
        )


@app.post("/reports/health", response_model=schemas.HealthReport, status_code=status.HTTP_201_CREATED)
def generate_health_report(
    report_type: str = "full",
    generated_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    article_service = services.ArticleService(db)
    report = article_service.generate_health_report(report_type)
    if generated_by:
        report.generated_by = generated_by
        db.commit()
        db.refresh(report)
    return report


@app.get("/reports/health/{report_id}/json")
def get_health_report_json(report_id: int, db: Session = Depends(get_db)):
    report = db.query(HealthReport).filter(
        HealthReport.id == report_id
    ).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NOT_FOUND",
                "message": "报告不存在",
                "details": {"report_id": report_id}
            }
        )
    return exporter.ReportExporter.export_health_report_to_json(report)


@app.get("/reports/references/excel")
def export_references_excel(
    status_filter: Optional[ReferenceStatus] = None,
    failure_reason: Optional[FailureReason] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    article_service = services.ArticleService(db)
    references = article_service.get_invalid_references(
        status=status_filter,
        failure_reason=failure_reason,
        product_id=product_id
    )
    
    excel_data = exporter.ReportExporter.export_references_to_excel(references)
    
    return StreamingResponse(
        iter([excel_data.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=invalid_references.xlsx"}
    )


@app.get("/reports/statistics/excel")
def export_statistics_excel(db: Session = Depends(get_db)):
    excel_data = exporter.ReportExporter.export_statistics_to_excel(db)
    
    return StreamingResponse(
        iter([excel_data.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=statistics.xlsx"}
    )


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "knowledge-base-reference-checker"}
