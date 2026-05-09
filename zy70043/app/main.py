from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os

from .database import init_db, get_db, db_session
from .seeds import seed_all, get_seed_summary
from .services import SubstitutionService, QCService, CostService
from .export_service import (
    export_substitution_detail,
    export_formula_history,
    export_requests_summary
)
from .schemas import (
    CreateSubstitutionRequest, SubmitApprovalRequest,
    ApprovalRequest, FreezeRequest, ExecuteRequest, UnfreezeRequest
)
from .config import API_HOST, API_PORT

app = FastAPI(
    title="原料替代审批 API",
    description="处理原料缺货临时替代的完整业务流程，包括配方版本、质检约束、成本核算和审批冻结",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/", tags=["系统信息"])
def root():
    return {
        "服务名称": "原料替代审批 API",
        "版本": "1.0.0",
        "状态": "运行中",
        "接口文档地址": [
            "http://localhost:8000/docs (Swagger UI)",
            "http://localhost:8000/redoc (ReDoc)"
        ],
        "快速开始": "1. POST /api/seed 初始化数据 → 2. POST /api/substitutions 创建申请 → 3. 按流程审批执行"
    }


@app.post("/api/seed", tags=["数据初始化"])
def initialize_data():
    """初始化种子数据，包括原料、配方、质检约束"""
    result = seed_all()
    return {
        "状态": "成功",
        "操作": "初始化种子数据",
        "结果": result,
        "数据概览": get_seed_summary()
    }


@app.get("/api/materials", tags=["基础数据"])
def list_materials(db: Session = Depends(get_db)):
    from .models import RawMaterial
    materials = db.query(RawMaterial).all()
    return {
        "原料总数": len(materials),
        "原料列表": [
            {
                "编码": m.code,
                "名称": m.name,
                "分类": m.category,
                "规格": m.specification,
                "库存": f"{m.stock_quantity} {m.unit}",
                "单价": f"{m.unit_price} 元/{m.unit}",
                "状态": "缺货" if m.stock_quantity <= 0 else "正常"
            }
            for m in materials
        ]
    }


@app.get("/api/formulas", tags=["基础数据"])
def list_formulas(db: Session = Depends(get_db)):
    from .models import Formula
    formulas = db.query(Formula).all()
    return {
        "配方总数": len(formulas),
        "配方列表": [
            {
                "编码": f.code,
                "名称": f.name,
                "产品": f"{f.product_code} - {f.product_name}",
                "当前版本": f"v{f.current_version}",
                "状态": f.status
            }
            for f in formulas
        ]
    }


@app.get("/api/qc-constraints", tags=["基础数据"])
def list_qc_constraints(db: Session = Depends(get_db)):
    from .models import QCConstraint
    constraints = db.query(QCConstraint).filter(QCConstraint.is_active == True).all()
    return {
        "质检约束数量": len(constraints),
        "约束列表": [
            {
                "原料": f"{c.raw_material_code} - {c.raw_material_name}",
                "约束类型": c.constraint_type,
                "约束值": c.constraint_value,
                "说明": c.description
            }
            for c in constraints
        ]
    }


@app.post("/api/substitutions", tags=["替代申请"])
def create_substitution(request: CreateSubstitutionRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.create_draft(
        db=db,
        original_code=request.original_code,
        substitute_code=request.substitute_code,
        reason=request.reason,
        created_by=request.created_by,
        substitute_ratio=request.substitute_ratio,
        is_temporary=request.is_temporary
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    
    return result


@app.post("/api/substitutions/submit", tags=["替代申请"])
def submit_for_approval(request: SubmitApprovalRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.submit_for_approval(
        db=db,
        request_no=request.request_no,
        submitter=request.submitter
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    
    return result


@app.post("/api/substitutions/approve", tags=["审批流程"])
def approve_substitution(request: ApprovalRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.approve(
        db=db,
        request_no=request.request_no,
        approver=request.approver,
        level=request.level,
        result=request.result,
        comment=request.comment
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    
    return result


@app.post("/api/substitutions/freeze", tags=["审批流程"])
def freeze_substitution(request: FreezeRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.freeze_request(
        db=db,
        request_no=request.request_no,
        operator=request.operator,
        reason=request.reason
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    
    return result


@app.post("/api/substitutions/unfreeze", tags=["审批流程"])
def unfreeze_substitution(request: UnfreezeRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.unfreeze_request(
        db=db,
        request_no=request.request_no,
        operator=request.operator
    )
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result
        )
    
    return result


@app.post("/api/substitutions/execute", tags=["执行流程"])
def execute_substitution(request: ExecuteRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.execute_substitution(
        db=db,
        request_no=request.request_no,
        operator=request.operator,
        simulate_failure=request.simulate_failure
    )
    
    if not result["success"] and "执行失败" in result.get("message", ""):
        return {
            **result,
            "提示": "部分或全部配方更新失败，可再次调用此接口进行重试补偿"
        }
    
    return result


@app.post("/api/substitutions/retry", tags=["执行流程"])
def retry_failed_execution(request: ExecuteRequest, db: Session = Depends(get_db)):
    result = SubstitutionService.retry_failed(
        db=db,
        request_no=request.request_no,
        operator=request.operator
    )
    
    if not result["success"] and "执行失败" in result.get("message", ""):
        return {
            **result,
            "提示": "仍有配方更新失败，可继续重试"
        }
    
    return result


@app.get("/api/substitutions", tags=["查询"])
def list_substitutions(status: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    requests = SubstitutionService.list_requests(db, status, limit)
    return {
        "查询条件": f"状态={status or '全部'}",
        "申请数量": len(requests),
        "申请列表": requests
    }


@app.get("/api/substitutions/{request_no}", tags=["查询"])
def get_substitution_detail(request_no: str, db: Session = Depends(get_db)):
    detail = SubstitutionService.get_request_detail(db, request_no)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": f"申请不存在：{request_no}"}
        )
    return detail


@app.get("/api/exports/substitution/{request_no}", tags=["导出"])
def export_substitution(request_no: str, db: Session = Depends(get_db)):
    filepath = export_substitution_detail(db, request_no)
    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": f"申请不存在：{request_no}"}
        )
    
    return FileResponse(
        path=filepath,
        filename=os.path.basename(filepath),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{os.path.basename(filepath)}"'
        }
    )


@app.get("/api/exports/formula/{formula_code}", tags=["导出"])
def export_formula(formula_code: str, db: Session = Depends(get_db)):
    filepath = export_formula_history(db, formula_code)
    if not filepath:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": f"配方不存在：{formula_code}"}
        )
    
    return FileResponse(
        path=filepath,
        filename=os.path.basename(filepath),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{os.path.basename(filepath)}"'
        }
    )


@app.get("/api/exports/summary", tags=["导出"])
def export_summary(limit: int = 100, db: Session = Depends(get_db)):
    filepath = export_requests_summary(db, limit)
    return FileResponse(
        path=filepath,
        filename=os.path.basename(filepath),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{os.path.basename(filepath)}"'
        }
    )


def run_server():
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True
    )


if __name__ == "__main__":
    run_server()
