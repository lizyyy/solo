from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import models
import schemas
import services
import reports
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="苗圃检疫证书 API",
    description="苗木批次检疫证书管理系统 - 证书校验、禁运拦截、拆单追踪、补证管理",
    version="1.0.0"
)


def create_http_error(error_type: models.ErrorType, message: str,
                      status_code: int = 400, detail: str = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "error_type": error_type.value,
            "message": message,
            "detail": detail
        }
    )


@app.post("/api/batches/", response_model=schemas.SeedlingBatch, tags=["基础数据"])
def create_batch(batch: schemas.SeedlingBatchCreate, db: Session = Depends(get_db)):
    existing = db.query(models.SeedlingBatch).filter(
        models.SeedlingBatch.batch_no == batch.batch_no
    ).first()
    if existing:
        raise create_http_error(
            models.ErrorType.DUPLICATE_REQUEST,
            "批次号已存在",
            detail=f"批次 {batch.batch_no} 已在系统中"
        )
    
    db_batch = models.SeedlingBatch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


@app.get("/api/batches/", response_model=List[schemas.SeedlingBatch], tags=["基础数据"])
def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.SeedlingBatch).offset(skip).limit(limit).all()


@app.post("/api/certificates/", response_model=schemas.QuarantineCertificate, tags=["基础数据"])
def create_certificate(cert: schemas.QuarantineCertificateCreate, db: Session = Depends(get_db)):
    batch = db.query(models.SeedlingBatch).filter(
        models.SeedlingBatch.batch_no == cert.batch_no
    ).first()
    if not batch:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "关联批次不存在",
            detail=f"批次 {cert.batch_no} 不存在，请先创建批次"
        )
    
    existing = db.query(models.QuarantineCertificate).filter(
        models.QuarantineCertificate.cert_no == cert.cert_no
    ).first()
    if existing:
        raise create_http_error(
            models.ErrorType.DUPLICATE_REQUEST,
            "证书编号已存在",
            detail=f"证书 {cert.cert_no} 已在系统中"
        )
    
    cert_data = cert.model_dump()
    cert_data.pop("batch_no")
    cert_data["batch_id"] = batch.id
    
    db_cert = models.QuarantineCertificate(**cert_data)
    db.add(db_cert)
    db.commit()
    db.refresh(db_cert)
    return schemas.QuarantineCertificate.from_orm(db_cert)


@app.get("/api/certificates/", response_model=List[schemas.QuarantineCertificate], tags=["基础数据"])
def list_certificates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    certs = db.query(models.QuarantineCertificate).offset(skip).limit(limit).all()
    return [schemas.QuarantineCertificate.from_orm(c) for c in certs]


@app.post("/api/destinations/", response_model=schemas.Destination, tags=["基础数据"])
def create_destination(dest: schemas.DestinationCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Destination).filter(
        models.Destination.region_code == dest.region_code
    ).first()
    if existing:
        raise create_http_error(
            models.ErrorType.DUPLICATE_REQUEST,
            "目的地已存在",
            detail=f"地区代码 {dest.region_code} 已存在"
        )
    
    db_dest = models.Destination(**dest.model_dump())
    db.add(db_dest)
    db.commit()
    db.refresh(db_dest)
    return db_dest


@app.get("/api/destinations/", response_model=List[schemas.Destination], tags=["基础数据"])
def list_destinations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Destination).offset(skip).limit(limit).all()


@app.post("/api/orders/", response_model=schemas.SalesOrder, tags=["销售订单"])
def create_order(order: schemas.SalesOrderCreate, db: Session = Depends(get_db)):
    existing = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order.order_no
    ).first()
    if existing:
        history = services.get_order_history(db, order.order_no)
        if history and history.order.status == models.SalesOrderStatus.NEED_REISSUE:
            raise create_http_error(
                models.ErrorType.INVALID_STATUS,
                "订单已存在且待补证",
                detail=f"订单 {order.order_no} 已存在，当前状态: 待补证"
            )
        raise create_http_error(
            models.ErrorType.DUPLICATE_REQUEST,
            "订单已存在",
            detail=f"订单 {order.order_no} 已存在，当前状态: {history.order.status if history else '未知'}"
        )
    
    batch = db.query(models.SeedlingBatch).filter(
        models.SeedlingBatch.batch_no == order.batch_no
    ).first()
    if not batch:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "批次不存在",
            detail=f"批次 {order.batch_no} 不存在"
        )
    
    dest = db.query(models.Destination).filter(
        models.Destination.region_code == order.region_code
    ).first()
    if not dest:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "目的地不存在",
            detail=f"目的地 {order.region_code} 不存在"
        )
    
    cert = None
    if order.cert_no:
        cert = db.query(models.QuarantineCertificate).filter(
            models.QuarantineCertificate.cert_no == order.cert_no
        ).first()
        if not cert:
            raise create_http_error(
                models.ErrorType.MISSING_MATERIAL,
                "证书不存在",
                detail=f"证书 {order.cert_no} 不存在"
            )
    
    order_data = order.model_dump()
    order_data.pop("batch_no")
    order_data.pop("region_code")
    order_data.pop("cert_no")
    order_data["batch_id"] = batch.id
    order_data["destination_id"] = dest.id
    order_data["cert_id"] = cert.id if cert else None
    
    db_order = models.SalesOrder(**order_data)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    services.add_trace(
        db, db_order.id,
        models.TraceAction.MATERIAL_IN,
        f"创建订单: 批次 {order.batch_no}, 目的地 {dest.region_name}",
        "材料入库成功"
    )
    
    return schemas.SalesOrder.from_orm(db_order)


@app.get("/api/orders/", response_model=List[schemas.SalesOrder], tags=["销售订单"])
def list_orders(status: Optional[models.SalesOrderStatus] = None,
                skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.SalesOrder)
    if status:
        query = query.filter(models.SalesOrder.status == status)
    orders = query.offset(skip).limit(limit).all()
    return [schemas.SalesOrder.from_orm(o) for o in orders]


@app.get("/api/orders/{order_no}/check", response_model=schemas.RuleCheckResult, tags=["销售订单"])
def check_order_rules(order_no: str, db: Session = Depends(get_db)):
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order_no
    ).first()
    if not order:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "订单不存在",
            detail=f"订单 {order_no} 不存在"
        )
    
    if order.status == models.SalesOrderStatus.SHIPPED:
        raise create_http_error(
            models.ErrorType.INVALID_STATUS,
            "订单已发货，无法重新校验",
            detail="已发货订单不能重复校验"
        )
    
    return services.check_sales_order_rules(db, order)


@app.post("/api/orders/{order_no}/split", response_model=List[schemas.SalesOrder], tags=["销售订单"])
def split_order(order_no: str, split_quantities: List[int],
                operator: str = "system", db: Session = Depends(get_db)):
    try:
        orders = services.split_sales_order(db, order_no, split_quantities, operator)
        return [schemas.SalesOrder.from_orm(o) for o in orders]
    except ValueError as e:
        raise create_http_error(
            models.ErrorType.INVALID_STATUS,
            "拆单失败",
            detail=str(e)
        )


@app.post("/api/orders/manual-override", response_model=schemas.SalesOrder, tags=["销售订单"])
def manual_override(data: schemas.ManualOverride, db: Session = Depends(get_db)):
    try:
        order = services.manual_override_order(
            db, data.order_no, data.target_status, data.operator, data.reason
        )
        return schemas.SalesOrder.from_orm(order)
    except ValueError as e:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "人工改判失败",
            detail=str(e)
        )


@app.get("/api/orders/{order_no}/history", response_model=schemas.OrderHistory, tags=["销售订单"])
def get_order_history_endpoint(order_no: str, db: Session = Depends(get_db)):
    history = services.get_order_history(db, order_no)
    if not history:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "订单不存在",
            detail=f"订单 {order_no} 不存在"
        )
    return history


@app.post("/api/reissues/", response_model=schemas.ReissueApplication, tags=["补证管理"])
def create_reissue(data: schemas.ReissueApplicationCreate, db: Session = Depends(get_db)):
    try:
        reissue = services.create_reissue_application(db, data.order_no, data.reason)
        return schemas.ReissueApplication.from_orm(reissue)
    except ValueError as e:
        if "待处理的补证申请" in str(e):
            raise create_http_error(
                models.ErrorType.DUPLICATE_REQUEST,
                "已有待处理的补证申请",
                detail=str(e)
            )
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "创建补证申请失败",
            detail=str(e)
        )


@app.post("/api/reissues/submit", response_model=schemas.ReissueApplication, tags=["补证管理"])
def submit_reissue_cert(data: schemas.ReissueApplicationSubmit, db: Session = Depends(get_db)):
    try:
        reissue = services.submit_reissue_cert(db, data.application_no, data.new_cert_no)
        return schemas.ReissueApplication.from_orm(reissue)
    except ValueError as e:
        if "状态不允许" in str(e):
            raise create_http_error(
                models.ErrorType.INVALID_STATUS,
                "状态不允许",
                detail=str(e)
            )
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "提交证书失败",
            detail=str(e)
        )


@app.post("/api/reissues/review", response_model=schemas.ReissueApplication, tags=["补证管理"])
def review_reissue(data: schemas.ReissueApplicationReview, db: Session = Depends(get_db)):
    try:
        reissue = services.review_reissue_application(
            db, data.application_no, data.status, data.review_remark, data.reviewer
        )
        return schemas.ReissueApplication.from_orm(reissue)
    except ValueError as e:
        if "无法审核" in str(e):
            raise create_http_error(
                models.ErrorType.INVALID_STATUS,
                "状态不允许审核",
                detail=str(e)
            )
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "审核失败",
            detail=str(e)
        )


@app.get("/api/reissues/", response_model=List[schemas.ReissueApplication], tags=["补证管理"])
def list_reissues(status: Optional[models.ReissueStatus] = None,
                  skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.ReissueApplication)
    if status:
        query = query.filter(models.ReissueApplication.status == status)
    reissues = query.offset(skip).limit(limit).all()
    return [schemas.ReissueApplication.from_orm(r) for r in reissues]


@app.post("/api/shipping-report/", response_model=schemas.ShippingReport, tags=["发货管理"])
def create_shipping_report(report: schemas.ShippingReportCreate, db: Session = Depends(get_db)):
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == report.order_no
    ).first()
    if not order:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "订单不存在",
            detail=f"订单 {report.order_no} 不存在"
        )
    
    if order.status != models.SalesOrderStatus.APPROVED:
        raise create_http_error(
            models.ErrorType.INVALID_STATUS,
            "订单未通过审批",
            detail=f"订单状态: {order.status}，需为 approved 才能发货"
        )
    
    if order.shipping_report:
        raise create_http_error(
            models.ErrorType.DUPLICATE_REQUEST,
            "该订单已有发货报告",
            detail=f"发货报告编号: {order.shipping_report.report_no}"
        )
    
    report_no = f"SHIP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    report_data = report.model_dump()
    report_data.pop("order_no")
    report_data["order_id"] = order.id
    report_data["report_no"] = report_no
    
    db_report = models.ShippingReport(**report_data)
    db.add(db_report)
    
    order.status = models.SalesOrderStatus.SHIPPED
    db.commit()
    db.refresh(db_report)
    
    services.add_trace(
        db, order.id,
        models.TraceAction.SHIPPED,
        f"发货报告: {report_no}, 物流: {report.logistics_info}",
        "已发货"
    )
    
    return schemas.ShippingReport.from_orm(db_report)


@app.get("/api/shipping-report/{order_no}/download", tags=["报告下载"])
def download_shipping_report(order_no: str, db: Session = Depends(get_db)):
    try:
        excel_file = reports.generate_shipping_excel(db, order_no)
        return StreamingResponse(
            excel_file,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=shipping_report_{order_no}.xlsx"}
        )
    except ValueError as e:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "生成报告失败",
            detail=str(e)
        )


@app.get("/api/reports/batch-summary/download", tags=["报告下载"])
def download_batch_summary(start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None,
                           db: Session = Depends(get_db)):
    excel_file = reports.generate_batch_report(db, start_date, end_date)
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=batch_summary.xlsx"}
    )


@app.post("/api/orders/{order_no}/writeback", tags=["销售订单"])
def writeback_result(order_no: str, result_status: models.SalesOrderStatus,
                     remark: str = None, operator: str = "system",
                     db: Session = Depends(get_db)):
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order_no
    ).first()
    if not order:
        raise create_http_error(
            models.ErrorType.MISSING_MATERIAL,
            "订单不存在",
            detail=f"订单 {order_no} 不存在"
        )
    
    old_status = order.status
    order.status = result_status
    if remark:
        order.remark = (order.remark or "") + f"\n{remark}"
    db.commit()
    db.refresh(order)
    
    services.add_trace(
        db, order.id,
        models.TraceAction.RESULT_WRITEBACK,
        f"状态回写: {old_status} -> {result_status}, 备注: {remark}",
        "结果回写成功",
        operator
    )
    
    return {"status": "success", "order_no": order_no, "new_status": result_status}
