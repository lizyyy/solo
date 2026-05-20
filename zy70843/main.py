from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
import pandas as pd
from datetime import date, datetime

from database import engine, get_db, Base
from models import MaterialStatus, DepositStatus
from schemas import (
    BoothCertificateCreate,
    BoothCertificateResponse,
    StatisticsResponse,
    MaterialSubmissionResponse,
    ExportQuery
)
import crud

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="商场临时摊位证照处理API",
    description="用于处理商场临时摊位证照材料的提交、分类和管理",
    version="1.0.0"
)


@app.post("/api/certificates/submit", response_model=MaterialSubmissionResponse, summary="提交证照材料")
def submit_certificate(data: BoothCertificateCreate, db: Session = Depends(get_db)):
    """
    提交摊位证照材料，系统会自动分类处理：
    - 正常：材料完整有效
    - 待补充：材料缺失或证照过期
    - 已拦截：存在严重错误（如重复编号）
    
    如果同一批材料重复提交，系统会识别并返回原有处理结果
    """
    certificate, is_duplicate, errors = crud.create_booth_certificate(db, data)
    
    return MaterialSubmissionResponse(
        success=True,
        message="重复提交，返回原有处理结果" if is_duplicate else "材料提交成功",
        certificate=certificate,
        is_duplicate=is_duplicate,
        errors=errors
    )


@app.get("/api/certificates/{certificate_id}", response_model=BoothCertificateResponse, summary="获取单条证照记录")
def get_certificate(certificate_id: int, db: Session = Depends(get_db)):
    """根据ID获取证照详情"""
    certificate = crud.get_booth_certificate(db, certificate_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="证照记录不存在")
    return certificate


@app.get("/api/certificates", response_model=List[BoothCertificateResponse], summary="查询证照列表")
def list_certificates(
    skip: int = Query(0, description="跳过记录数"),
    limit: int = Query(100, description="返回记录数限制"),
    mall_name: Optional[str] = Query(None, description="商场名称"),
    status: Optional[MaterialStatus] = Query(None, description="处理状态"),
    batch_number: Optional[str] = Query(None, description="材料批次号"),
    db: Session = Depends(get_db)
):
    """查询证照列表，支持按商场、状态、批次号筛选"""
    return crud.get_booth_certificates(db, skip, limit, mall_name, status, batch_number)


@app.get("/api/statistics", response_model=StatisticsResponse, summary="获取统计数据")
def get_statistics(db: Session = Depends(get_db)):
    """获取证照处理统计数据"""
    return crud.get_statistics(db)


@app.post("/api/certificates/export", summary="导取证照数据")
def export_certificates(query_params: ExportQuery, db: Session = Depends(get_db)):
    """
    导取证照数据为Excel文件，包含：
    - 商场临时摊位证照
    - 快闪摊位的营业执照
    - 消防材料
    - 进场时间
    - 最后处理人
    - 证照版本
    - 场地档期
    - 押金状态
    """
    certificates = crud.get_certificates_for_export(db, query_params)
    
    export_data = []
    for cert in certificates:
        export_data.append({
            "商场名称": cert.mall_name,
            "材料批次号": cert.batch_number,
            "摊位编号": cert.booth_number,
            "证照版本": cert.certificate_version,
            "场地档期开始日期": cert.schedule_start_date.isoformat() if cert.schedule_start_date else "",
            "场地档期结束日期": cert.schedule_end_date.isoformat() if cert.schedule_end_date else "",
            "进场时间": cert.entry_time.isoformat() if cert.entry_time else "",
            "营业执照": cert.business_license or "",
            "消防材料": cert.fire_safety_material or "",
            "证照过期日期": cert.certificate_expiry_date.isoformat() if cert.certificate_expiry_date else "",
            "押金状态": cert.deposit_status.value if cert.deposit_status else "",
            "处理状态": cert.status.value,
            "后续动作": cert.follow_up_action or "",
            "原因说明": cert.reject_reason or "",
            "最后处理人": cert.processor,
            "提交时间": cert.created_at.isoformat()
        })
    
    df = pd.DataFrame(export_data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='证照数据')
    
    output.seek(0)
    
    filename = f"临时摊位证照导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.put("/api/certificates/{certificate_id}/deposit", response_model=BoothCertificateResponse, summary="更新押金状态")
def update_deposit(
    certificate_id: int,
    deposit_status: DepositStatus,
    db: Session = Depends(get_db)
):
    """更新摊位押金状态"""
    certificate = crud.update_deposit_status(db, certificate_id, deposit_status)
    if not certificate:
        raise HTTPException(status_code=404, detail="证照记录不存在")
    return certificate


@app.get("/", summary="健康检查")
def root():
    return {
        "message": "商场临时摊位证照处理API服务运行正常",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
