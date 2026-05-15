from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SampleStatus, ErrorCategory
from app.schemas import (
    SampleCreate, SampleValidate, SampleClassify, SampleReproduce, SampleFix,
    SampleResponse, SampleListResponse, ErrorResponse
)
from app.services import SampleService

router = APIRouter(prefix="/api/samples", tags=["samples"])


@router.post("", response_model=SampleResponse, responses={400: {"model": ErrorResponse}})
def create_sample(sample_data: SampleCreate, db: Session = Depends(get_db)):
    """创建异常样本，重复提交返回已存在样本"""
    service = SampleService(db)
    sample, is_new = service.create_sample(sample_data)
    return sample


@router.get("", response_model=SampleListResponse)
def list_samples(
    status: Optional[SampleStatus] = Query(None, description="按状态过滤"),
    category: Optional[ErrorCategory] = Query(None, description="按分类过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """查询样本列表"""
    service = SampleService(db)
    total, samples = service.list_samples(status, category, skip, limit)
    return SampleListResponse(total=total, items=samples)


@router.get("/{sample_id}", response_model=SampleResponse, responses={404: {"model": ErrorResponse}})
def get_sample(sample_id: int, db: Session = Depends(get_db)):
    """获取单个样本详情"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    return sample


@router.post("/{sample_id}/validate", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def validate_sample(sample_id: int, validate_data: SampleValidate, db: Session = Depends(get_db)):
    """校验样本"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.CREATED:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"当前状态 {sample.status.value} 不允许校验"
        })
    return service.validate_sample(sample_id, validate_data)


@router.post("/{sample_id}/classify", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def classify_sample(sample_id: int, classify_data: SampleClassify, db: Session = Depends(get_db)):
    """分类样本"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.VALIDATED:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"当前状态 {sample.status.value} 不允许分类"
        })
    return service.classify_sample(sample_id, classify_data)


@router.post("/{sample_id}/reproduce/start", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def start_reproduce(sample_id: int, operator: str, db: Session = Depends(get_db)):
    """开始复现"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.CLASSIFIED:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"当前状态 {sample.status.value} 不允许开始复现"
        })
    return service.start_reproduce(sample_id, operator)


@router.post("/{sample_id}/reproduce", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def reproduce_sample(sample_id: int, reproduce_data: SampleReproduce, db: Session = Depends(get_db)):
    """提交复现结果"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.REPRODUCING:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"当前状态 {sample.status.value} 不允许提交复现结果"
        })
    return service.reproduce_sample(sample_id, reproduce_data)


@router.post("/{sample_id}/fix/start", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def start_fix(sample_id: int, operator: str, db: Session = Depends(get_db)):
    """开始修复"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.REPRODUCED or not sample.reproduce_success:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": "只有复现成功的样本才能开始修复"
        })
    return service.start_fix(sample_id, operator)


@router.post("/{sample_id}/fix", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def fix_sample(sample_id: int, fix_data: SampleFix, db: Session = Depends(get_db)):
    """提交修复结果"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.FIXING:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"当前状态 {sample.status.value} 不允许提交修复结果"
        })
    return service.fix_sample(sample_id, fix_data)


@router.post("/{sample_id}/archive", response_model=SampleResponse, responses={
    404: {"model": ErrorResponse},
    400: {"model": ErrorResponse}
})
def archive_sample(sample_id: int, operator: str, db: Session = Depends(get_db)):
    """归档样本"""
    service = SampleService(db)
    sample = service.get_by_id(sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail={
            "error_code": "SAMPLE_NOT_FOUND",
            "error_message": "样本不存在"
        })
    if sample.status != SampleStatus.FIXED:
        raise HTTPException(status_code=400, detail={
            "error_code": "INVALID_STATUS",
            "error_message": f"当前状态 {sample.status.value} 不允许归档"
        })
    return service.archive_sample(sample_id, operator)


@router.post("/cleanup")
def cleanup_expired(db: Session = Depends(get_db)):
    """清理过期样本"""
    service = SampleService(db)
    count = service.cleanup_expired_samples()
    return {"expired_count": count}
