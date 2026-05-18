from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import json
import pandas as pd
import os
from io import BytesIO

from models import SessionLocal, RefundFee, RefundFeeHistory
from schemas import (
    RefundFeeCreate, RefundFeeUpdate, RefundFeeResponse,
    RefundFeeHistoryResponse, BatchImportResponse, BatchImportResult
)

app = FastAPI(title="乡镇客运站客运退票手续费 API")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_refund_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"TK{today}"
    last_refund = db.query(RefundFee).filter(
        RefundFee.退票单号.like(f"{prefix}%")
    ).order_by(RefundFee.id.desc()).first()
    
    if last_refund:
        last_no = int(last_refund.退票单号[-4:])
        new_no = last_no + 1
    else:
        new_no = 1
    
    return f"{prefix}{new_no:04d}"


def record_history(
    db: Session,
    refund_no: str,
    operation_type: str,
    operator: str,
    before_data: Optional[dict] = None,
    after_data: Optional[dict] = None,
    changed_fields: str = "",
    ip_address: str = "",
    remark: str = ""
):
    history = RefundFeeHistory(
        退票单号=refund_no,
        操作类型=operation_type,
        操作人=operator,
        变更前数据=json.dumps(before_data, ensure_ascii=False, default=str) if before_data else None,
        变更后数据=json.dumps(after_data, ensure_ascii=False, default=str) if after_data else None,
        变更字段=changed_fields,
        IP地址=ip_address,
        备注=remark
    )
    db.add(history)
    db.commit()


@app.post("/api/refund-fees/", response_model=RefundFeeResponse)
def create_refund_fee(
    fee: RefundFeeCreate,
    operator: str = Query(..., description="操作人"),
    ip_address: str = Query("", description="IP地址"),
    db: Session = Depends(get_db)
):
    refund_no = generate_refund_no(db)
    
    db_fee = RefundFee(
        退票单号=refund_no,
        **fee.dict()
    )
    db.add(db_fee)
    db.commit()
    db.refresh(db_fee)
    
    record_history(
        db, refund_no, "创建", operator,
        after_data=fee.dict(),
        ip_address=ip_address,
        changed_fields="全部字段"
    )
    
    return db_fee


@app.put("/api/refund-fees/{refund_no}", response_model=RefundFeeResponse)
def update_refund_fee(
    refund_no: str,
    fee_update: RefundFeeUpdate,
    db: Session = Depends(get_db)
):
    db_fee = db.query(RefundFee).filter(RefundFee.退票单号 == refund_no).first()
    if not db_fee:
        raise HTTPException(status_code=404, detail="退票记录不存在")
    
    before_data = {
        column.name: getattr(db_fee, column.name)
        for column in RefundFee.__table__.columns
    }
    
    update_data = fee_update.dict(exclude_unset=True)
    operator = update_data.pop("操作人")
    ip_address = update_data.pop("IP地址", "")
    
    changed_fields = []
    for key, value in update_data.items():
        if value is not None and hasattr(db_fee, key):
            setattr(db_fee, key, value)
            changed_fields.append(key)
    
    db_fee.更新时间 = datetime.now()
    db.commit()
    db.refresh(db_fee)
    
    after_data = {
        column.name: getattr(db_fee, column.name)
        for column in RefundFee.__table__.columns
    }
    
    record_history(
        db, refund_no, "修改", operator,
        before_data=before_data,
        after_data=after_data,
        changed_fields=",".join(changed_fields),
        ip_address=ip_address
    )
    
    return db_fee


@app.get("/api/refund-fees/", response_model=List[RefundFeeResponse])
def list_refund_fees(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    状态: Optional[str] = Query(None, description="当前状态"),
    负责人: Optional[str] = Query(None, description="负责人姓名"),
    门店: Optional[str] = Query(None, description="门店名称"),
    班次号: Optional[str] = Query(None, description="班次号"),
    退票类型: Optional[str] = Query(None, description="退票类型"),
    是否旧记录修正: Optional[bool] = Query(None, description="是否旧记录修正"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(RefundFee)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(RefundFee.退票日期 >= start_dt)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(RefundFee.退票日期 < end_dt)
        except ValueError:
            pass
    
    if 状态:
        query = query.filter(RefundFee.当前状态 == 状态)
    if 负责人:
        query = query.filter(RefundFee.负责人姓名.like(f"%{负责人}%"))
    if 门店:
        query = query.filter(RefundFee.门店名称.like(f"%{门店}%"))
    if 班次号:
        query = query.filter(RefundFee.班次号.like(f"%{班次号}%"))
    if 退票类型:
        query = query.filter(RefundFee.退票类型 == 退票类型)
    if 是否旧记录修正 is not None:
        query = query.filter(RefundFee.是否旧记录修正 == 是否旧记录修正)
    
    return query.order_by(RefundFee.退票日期.desc()).offset(skip).limit(limit).all()


@app.get("/api/refund-fees/{refund_no}", response_model=RefundFeeResponse)
def get_refund_fee(refund_no: str, db: Session = Depends(get_db)):
    db_fee = db.query(RefundFee).filter(RefundFee.退票单号 == refund_no).first()
    if not db_fee:
        raise HTTPException(status_code=404, detail="退票记录不存在")
    return db_fee


@app.get("/api/refund-fees/{refund_no}/history", response_model=List[RefundFeeHistoryResponse])
def get_refund_fee_history(
    refund_no: str,
    db: Session = Depends(get_db)
):
    history = db.query(RefundFeeHistory).filter(
        RefundFeeHistory.退票单号 == refund_no
    ).order_by(RefundFeeHistory.操作时间.desc()).all()
    return history


@app.post("/api/refund-fees/batch-import", response_model=BatchImportResponse)
def batch_import_refund_fees(
    fees: List[RefundFeeCreate],
    operator: str = Query(..., description="操作人"),
    ip_address: str = Query("", description="IP地址"),
    db: Session = Depends(get_db)
):
    results = []
    success_count = 0
    fail_count = 0
    
    for idx, fee in enumerate(fees, 1):
        try:
            refund_no = generate_refund_no(db)
            
            conflict_msg = None
            if fee.班次状态 == "停运" and fee.退票类型 == "个人原因":
                conflict_msg = "班次停运与个人退票规则冲突：停运班次应免手续费，已按规则调整"
                fee.退票手续费比例 = 0.0
                fee.退票手续费金额 = 0.0
                fee.实退金额 = fee.原票价
            
            if abs(fee.退票手续费金额 - fee.原票价 * fee.退票手续费比例 / 100) > 0.01:
                fee.退票手续费金额 = round(fee.原票价 * fee.退票手续费比例 / 100, 2)
                fee.实退金额 = round(fee.原票价 - fee.退票手续费金额, 2)
            
            db_fee = RefundFee(
                退票单号=refund_no,
                **fee.dict()
            )
            db.add(db_fee)
            db.commit()
            db.refresh(db_fee)
            
            record_history(
                db, refund_no, "批量导入", operator,
                after_data=fee.dict(),
                ip_address=ip_address,
                changed_fields="全部字段",
                remark=conflict_msg
            )
            
            success_count += 1
            results.append(BatchImportResult(
                行号=idx,
                退票单号=refund_no,
                状态="成功",
                消息=conflict_msg or "导入成功"
            ))
            
        except Exception as e:
            fail_count += 1
            db.rollback()
            results.append(BatchImportResult(
                行号=idx,
                状态="失败",
                消息=str(e),
                错误类型=type(e).__name__
            ))
    
    return BatchImportResponse(
        总行数=len(fees),
        成功行数=success_count,
        失败行数=fail_count,
        结果详情=results
    )


@app.get("/api/refund-fees/export/json")
def export_refund_fees_json(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    状态: Optional[str] = Query(None, description="当前状态"),
    负责人: Optional[str] = Query(None, description="负责人姓名"),
    门店: Optional[str] = Query(None, description="门店名称"),
    db: Session = Depends(get_db)
):
    query = db.query(RefundFee)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(RefundFee.退票日期 >= start_dt)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(RefundFee.退票日期 < end_dt)
        except ValueError:
            pass
    
    if 状态:
        query = query.filter(RefundFee.当前状态 == 状态)
    if 负责人:
        query = query.filter(RefundFee.负责人姓名.like(f"%{负责人}%"))
    if 门店:
        query = query.filter(RefundFee.门店名称.like(f"%{门店}%"))
    
    fees = query.order_by(RefundFee.退票日期.desc()).all()
    
    export_data = []
    for fee in fees:
        export_data.append({
            "退票单号": fee.退票单号,
            "原购票单号": fee.原购票单号,
            "乘车日期": fee.乘车日期.strftime("%Y-%m-%d") if fee.乘车日期 else None,
            "退票日期": fee.退票日期.strftime("%Y-%m-%d %H:%M:%S") if fee.退票日期 else None,
            "班次号": fee.班次号,
            "起点站": fee.起点站,
            "终点站": fee.终点站,
            "乘客姓名": fee.乘客姓名,
            "联系电话": fee.联系电话,
            "原票价": fee.原票价,
            "退票手续费比例(%)": fee.退票手续费比例,
            "退票手续费金额": fee.退票手续费金额,
            "实退金额": fee.实退金额,
            "退票原因": fee.退票原因,
            "退票类型": fee.退票类型,
            "班次状态": fee.班次状态,
            "门店名称": fee.门店名称,
            "负责人姓名": fee.负责人姓名,
            "当前状态": fee.当前状态,
            "是否旧记录修正": fee.是否旧记录修正,
            "修正原因": fee.修正原因,
            "备注": fee.备注
        })
    
    return JSONResponse(content={
        "导出时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "数据条数": len(export_data),
        "数据": export_data
    })


@app.get("/api/refund-fees/export/excel")
def export_refund_fees_excel(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    状态: Optional[str] = Query(None, description="当前状态"),
    负责人: Optional[str] = Query(None, description="负责人姓名"),
    门店: Optional[str] = Query(None, description="门店名称"),
    db: Session = Depends(get_db)
):
    query = db.query(RefundFee)
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(RefundFee.退票日期 >= start_dt)
        except ValueError:
            pass
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(RefundFee.退票日期 < end_dt)
        except ValueError:
            pass
    
    if 状态:
        query = query.filter(RefundFee.当前状态 == 状态)
    if 负责人:
        query = query.filter(RefundFee.负责人姓名.like(f"%{负责人}%"))
    if 门店:
        query = query.filter(RefundFee.门店名称.like(f"%{门店}%"))
    
    fees = query.order_by(RefundFee.退票日期.desc()).all()
    
    export_data = []
    for fee in fees:
        export_data.append({
            "退票单号": fee.退票单号,
            "原购票单号": fee.原购票单号,
            "乘车日期": fee.乘车日期.strftime("%Y-%m-%d") if fee.乘车日期 else None,
            "退票日期": fee.退票日期.strftime("%Y-%m-%d %H:%M:%S") if fee.退票日期 else None,
            "班次号": fee.班次号,
            "起点站": fee.起点站,
            "终点站": fee.终点站,
            "乘客姓名": fee.乘客姓名,
            "身份证号": fee.身份证号,
            "联系电话": fee.联系电话,
            "原票价": fee.原票价,
            "退票手续费比例(%)": fee.退票手续费比例,
            "退票手续费金额": fee.退票手续费金额,
            "实退金额": fee.实退金额,
            "退票原因": fee.退票原因,
            "退票类型": fee.退票类型,
            "班次状态": fee.班次状态,
            "门店名称": fee.门店名称,
            "门店编号": fee.门店编号,
            "负责人姓名": fee.负责人姓名,
            "审核人": fee.审核人,
            "审核时间": fee.审核时间.strftime("%Y-%m-%d %H:%M:%S") if fee.审核时间 else None,
            "当前状态": fee.当前状态,
            "是否旧记录修正": "是" if fee.是否旧记录修正 else "否",
            "修正原因": fee.修正原因,
            "备注": fee.备注
        })
    
    df = pd.DataFrame(export_data)
    
    filename = f"退票手续费导出_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    filepath = os.path.join("/tmp", filename)
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="退票手续费记录", index=False)
        
        worksheet = writer.sheets["退票手续费记录"]
        for idx, col in enumerate(df.columns):
            max_len = max(
                df[col].astype(str).map(len).max(),
                len(col)
            ) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 30)
    
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
