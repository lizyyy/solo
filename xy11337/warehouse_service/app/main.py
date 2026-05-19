from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import pandas as pd
import os
import uuid

from . import models, schemas, crud
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="家电售后仓管理系统", description="领件、返还、索赔三单匹配系统")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT_DIR = os.path.join(BASE_DIR, "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)


@app.post("/pickups/", response_model=schemas.Pickup, tags=["领件管理"])
def create_pickup(pickup: schemas.PickupCreate, db: Session = Depends(get_db)):
    db_pickup = crud.get_pickup_by_no(db, pickup_no=pickup.pickup_no)
    if db_pickup:
        raise HTTPException(status_code=400, detail="领件编号已存在")
    return crud.create_pickup(db=db, pickup=pickup)


@app.get("/pickups/", response_model=List[schemas.Pickup], tags=["领件管理"])
def read_pickups(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    pickups = crud.get_pickups(db, skip=skip, limit=limit)
    return pickups


@app.get("/pickups/{pickup_no}", response_model=schemas.Pickup, tags=["领件管理"])
def read_pickup(pickup_no: str, db: Session = Depends(get_db)):
    db_pickup = crud.get_pickup_by_no(db, pickup_no=pickup_no)
    if db_pickup is None:
        raise HTTPException(status_code=404, detail="领件记录不存在")
    return db_pickup


@app.post("/returns/", response_model=schemas.Return, tags=["返还管理"])
def create_return(return_item: schemas.ReturnCreate, db: Session = Depends(get_db)):
    db_return = crud.get_return_by_no(db, return_no=return_item.return_no)
    if db_return:
        raise HTTPException(status_code=400, detail="返还编号已存在")
    db_pickup = crud.get_pickup_by_no(db, pickup_no=return_item.pickup_no)
    if db_pickup is None:
        raise HTTPException(status_code=400, detail="关联的领件记录不存在")
    return crud.create_return(db=db, return_item=return_item)


@app.post("/claims/", response_model=schemas.Claim, tags=["索赔管理"])
def create_claim(claim: schemas.ClaimCreate, db: Session = Depends(get_db)):
    db_claim = crud.get_claim_by_no(db, claim_no=claim.claim_no)
    if db_claim:
        raise HTTPException(status_code=400, detail="索赔编号已存在")
    db_pickup = crud.get_pickup_by_no(db, pickup_no=claim.pickup_no)
    if db_pickup is None:
        raise HTTPException(status_code=400, detail="关联的领件记录不存在")
    return crud.create_claim(db=db, claim=claim)


@app.get("/claims/", response_model=List[schemas.Claim], tags=["索赔管理"])
def read_claims(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_claims(db, skip=skip, limit=limit)


@app.post("/anomalies/", response_model=schemas.Anomaly, tags=["异常管理"])
def create_anomaly(anomaly: schemas.AnomalyCreate, db: Session = Depends(get_db)):
    return crud.create_anomaly(db=db, anomaly=anomaly)


@app.get("/anomalies/", response_model=List[schemas.Anomaly], tags=["异常管理"])
def read_anomalies(
    anomaly_type: Optional[str] = Query(None),
    handler: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.filter_anomalies(
        db, anomaly_type=anomaly_type, handler=handler, status=status,
        start_date=start_date, end_date=end_date, skip=skip, limit=limit
    )


@app.post("/import/pickups", response_model=schemas.ImportResult, tags=["数据导入"])
def import_pickups(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    
    df = pd.read_csv(file.file)
    success = 0
    failed = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            pickup_data = schemas.PickupCreate(
                pickup_no=str(row['领件编号']),
                work_order_no=str(row['工单号']),
                engineer=str(row['工程师']),
                part_code=str(row['零件编码']),
                part_name=str(row['零件名称']),
                quantity=int(row['数量']),
                pickup_date=datetime.fromisoformat(str(row['领件日期'])),
                remark=str(row.get('备注', '')) if pd.notna(row.get('备注')) else None
            )
            if crud.get_pickup_by_no(db, pickup_no=pickup_data.pickup_no):
                failed += 1
                errors.append(f"行 {idx+2}: 领件编号 {pickup_data.pickup_no} 已存在")
                continue
            crud.create_pickup(db, pickup=pickup_data)
            success += 1
        except Exception as e:
            failed += 1
            errors.append(f"行 {idx+2}: {str(e)}")
    
    return schemas.ImportResult(success=success, failed=failed, errors=errors)


@app.post("/import/returns", response_model=schemas.ImportResult, tags=["数据导入"])
def import_returns(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    
    df = pd.read_csv(file.file)
    success = 0
    failed = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            return_data = schemas.ReturnCreate(
                return_no=str(row['返还编号']),
                pickup_no=str(row['领件编号']),
                return_date=datetime.fromisoformat(str(row['返还日期'])),
                return_quantity=int(row['返还数量']),
                is_defective=bool(row.get('是否不良', True)),
                defect_description=str(row.get('不良描述', '')) if pd.notna(row.get('不良描述')) else None,
                receiver=str(row['接收人'])
            )
            if crud.get_return_by_no(db, return_no=return_data.return_no):
                failed += 1
                errors.append(f"行 {idx+2}: 返还编号 {return_data.return_no} 已存在")
                continue
            if not crud.get_pickup_by_no(db, pickup_no=return_data.pickup_no):
                failed += 1
                errors.append(f"行 {idx+2}: 领件编号 {return_data.pickup_no} 不存在")
                continue
            crud.create_return(db, return_item=return_data)
            success += 1
        except Exception as e:
            failed += 1
            errors.append(f"行 {idx+2}: {str(e)}")
    
    return schemas.ImportResult(success=success, failed=failed, errors=errors)


@app.post("/import/claims", response_model=schemas.ImportResult, tags=["数据导入"])
def import_claims(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    
    df = pd.read_csv(file.file)
    success = 0
    failed = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            claim_data = schemas.ClaimCreate(
                claim_no=str(row['索赔编号']),
                pickup_no=str(row['领件编号']),
                vendor=str(row['厂商']),
                claim_date=datetime.fromisoformat(str(row['索赔日期'])),
                claim_amount=float(row['索赔金额']),
                status=str(row.get('状态', 'pending')),
                approver=str(row.get('审批人', '')) if pd.notna(row.get('审批人')) else None,
                remark=str(row.get('备注', '')) if pd.notna(row.get('备注')) else None
            )
            if crud.get_claim_by_no(db, claim_no=claim_data.claim_no):
                failed += 1
                errors.append(f"行 {idx+2}: 索赔编号 {claim_data.claim_no} 已存在")
                continue
            if not crud.get_pickup_by_no(db, pickup_no=claim_data.pickup_no):
                failed += 1
                errors.append(f"行 {idx+2}: 领件编号 {claim_data.pickup_no} 不存在")
                continue
            crud.create_claim(db, claim=claim_data)
            success += 1
        except Exception as e:
            failed += 1
            errors.append(f"行 {idx+2}: {str(e)}")
    
    return schemas.ImportResult(success=success, failed=failed, errors=errors)


@app.get("/match/{pickup_no}", response_model=schemas.MatchResult, tags=["匹配检查"])
def check_match(pickup_no: str, db: Session = Depends(get_db)):
    try:
        return crud.check_match_status(db, pickup_no=pickup_no)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/match/", response_model=List[schemas.MatchResult], tags=["匹配检查"])
def list_matches(
    engineer: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status: Optional[str] = Query(None, description="matched/unmatched"),
    anomaly_type: Optional[str] = Query(None),
    handler: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_match_results(
        db, engineer=engineer, start_date=start_date, end_date=end_date,
        status=status, anomaly_type=anomaly_type, handler=handler, skip=skip, limit=limit
    )


@app.post("/review/", response_model=schemas.ReviewRecord, tags=["复核管理"])
def perform_review(reviewer: str, remark: Optional[str] = None, db: Session = Depends(get_db)):
    all_pickups = crud.get_pickups(db, limit=1000)
    matched_count = 0
    unmatched_count = 0
    anomaly_count = 0
    
    for pickup in all_pickups:
        result = crud.check_match_status(db, pickup_no=pickup.pickup_no)
        if result.is_fully_matched:
            matched_count += 1
        else:
            unmatched_count += 1
        anomaly_count += len(result.anomalies)
    
    review_data = schemas.ReviewRecordCreate(
        review_no=f"REV{datetime.now().strftime('%Y%m%d%H%M%S')}",
        reviewer=reviewer,
        total_pickups=len(all_pickups),
        matched_count=matched_count,
        unmatched_count=unmatched_count,
        anomaly_count=anomaly_count,
        remark=remark
    )
    
    return crud.create_review_record(db, review=review_data)


@app.get("/reviews/", response_model=List[schemas.ReviewRecord], tags=["复核管理"])
def read_reviews(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_review_records(db, skip=skip, limit=limit)


@app.get("/export/report", tags=["导出报告"])
def export_report(
    engineer: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status: Optional[str] = Query(None, description="matched/unmatched"),
    anomaly_type: Optional[str] = Query(None),
    handler: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    results = crud.get_match_results(
        db, engineer=engineer, start_date=start_date, end_date=end_date,
        status=status, anomaly_type=anomaly_type, handler=handler, limit=1000
    )
    
    data = []
    for r in results:
        data.append({
            '领件编号': r.pickup_no,
            '工单号': r.work_order_no,
            '工程师': r.engineer,
            '零件编码': r.part_code,
            '零件名称': r.part_name,
            '领件数量': r.pickup_quantity,
            '是否有返还': '是' if r.has_return else '否',
            '返还数量': r.return_quantity,
            '是否有索赔': '是' if r.has_claim else '否',
            '索赔状态': r.claim_status,
            '是否完全匹配': '是' if r.is_fully_matched else '否',
            '异常说明': '; '.join(r.anomalies)
        })
    
    df = pd.DataFrame(data)
    filename = f"匹配报告_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='匹配结果', index=False)
        
        summary = {
            '统计项': ['总记录数', '完全匹配数', '不匹配数', '异常总数'],
            '数量': [
                len(results),
                sum(1 for r in results if r.is_fully_matched),
                sum(1 for r in results if not r.is_fully_matched),
                sum(len(r.anomalies) for r in results)
            ]
        }
        pd.DataFrame(summary).to_excel(writer, sheet_name='汇总', index=False)
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/stats", tags=["统计汇总"])
def get_stats(db: Session = Depends(get_db)):
    all_pickups = crud.get_pickups(db, limit=1000)
    matched = sum(
        1 for p in all_pickups
        if crud.check_match_status(db, p.pickup_no).is_fully_matched
    )
    
    return {
        "total_pickups": len(all_pickups),
        "matched": matched,
        "unmatched": len(all_pickups) - matched,
        "match_rate": f"{(matched/len(all_pickups)*100):.2f}%" if all_pickups else "0%"
    }
