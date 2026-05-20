from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List
from datetime import datetime, date
import pandas as pd
import json
import io
import csv
from database import get_db, init_db, Visitor, TemporaryPlate, Blacklist, VerificationRecord, ImportErrorRecord

app = FastAPI(title="园区访客核验系统", description="访客预约、临时车牌和黑名单核验管理工具")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/")
async def root():
    return {"message": "园区访客核验系统", "version": "1.0.0"}


def parse_date(date_str: str) -> Optional[datetime]:
    if not date_str or pd.isna(date_str):
        return None
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"]:
        try:
            return datetime.strptime(str(date_str).strip(), fmt)
        except ValueError:
            continue
    return None


def validate_visitor_row(row: dict, line_num: int) -> tuple[bool, str, str]:
    errors = []
    suggestions = []

    if not row.get("name") or pd.isna(row.get("name")):
        errors.append("姓名不能为空")
        suggestions.append("请填写访客姓名")
    else:
        name = str(row["name"]).strip()
        if len(name) < 2:
            errors.append("姓名长度过短")
            suggestions.append("姓名至少需要2个字符")

    if not row.get("phone") or pd.isna(row.get("phone")):
        errors.append("手机号不能为空")
        suggestions.append("请填写11位手机号码")
    else:
        phone = str(row["phone"]).strip()
        if len(phone) != 11 or not phone.isdigit():
            errors.append("手机号格式不正确")
            suggestions.append("手机号应为11位数字")

    if not row.get("id_card") or pd.isna(row.get("id_card")):
        errors.append("身份证号不能为空")
        suggestions.append("请填写18位身份证号码")
    else:
        id_card = str(row["id_card"]).strip()
        if len(id_card) not in [15, 18]:
            errors.append("身份证号长度不正确")
            suggestions.append("身份证号应为15或18位")

    arrival = parse_date(row.get("expected_arrival"))
    departure = parse_date(row.get("expected_departure"))
    if arrival and departure and arrival >= departure:
        errors.append("预计到达时间晚于离开时间")
        suggestions.append("请调整时间范围，确保到达时间早于离开时间")

    if errors:
        return False, "; ".join(errors), "; ".join(suggestions)
    return True, "", ""


@app.post("/import/visitors")
async def import_visitors(
    file: UploadFile = File(...),
    handler: str = Query(..., description="操作人姓名"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="只支持CSV格式文件")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV文件解析失败: {str(e)}")

    success_count = 0
    error_count = 0
    success_ids = []
    error_records = []

    for idx, row in df.iterrows():
        line_num = idx + 2
        row_dict = row.to_dict()

        is_valid, error_msg, suggestion = validate_visitor_row(row_dict, line_num)

        if not is_valid:
            error_record = ImportErrorRecord(
                import_type="visitor",
                source_file=file.filename,
                original_line=line_num,
                original_data=json.dumps(row_dict, ensure_ascii=False),
                error_message=error_msg,
                suggestion=suggestion
            )
            db.add(error_record)
            error_count += 1
            error_records.append({"line": line_num, "error": error_msg, "suggestion": suggestion})
            continue

        try:
            visitor = Visitor(
                name=str(row_dict.get("name", "")).strip(),
                phone=str(row_dict.get("phone", "")).strip(),
                id_card=str(row_dict.get("id_card", "")).strip(),
                company=str(row_dict.get("company", "")).strip() if row_dict.get("company") else "",
                visit_person=str(row_dict.get("visit_person", "")).strip() if row_dict.get("visit_person") else "",
                visit_reason=str(row_dict.get("visit_reason", "")).strip() if row_dict.get("visit_reason") else "",
                expected_arrival=parse_date(row_dict.get("expected_arrival")),
                expected_departure=parse_date(row_dict.get("expected_departure")),
                source_file=file.filename,
                source_line=line_num
            )
            db.add(visitor)
            db.flush()
            success_count += 1
            success_ids.append(visitor.id)
        except Exception as e:
            error_record = ImportErrorRecord(
                import_type="visitor",
                source_file=file.filename,
                original_line=line_num,
                original_data=json.dumps(row_dict, ensure_ascii=False),
                error_message=f"数据库保存失败: {str(e)}",
                suggestion="请检查数据格式后重试"
            )
            db.add(error_record)
            error_count += 1

    db.commit()
    return {
        "status": "success",
        "summary": {
            "total": len(df),
            "success": success_count,
            "failed": error_count
        },
        "success_ids": success_ids,
        "errors": error_records
    }


@app.post("/import/plates")
async def import_plates(
    file: UploadFile = File(...),
    handler: str = Query(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="只支持JSON格式文件")

    content = await file.read()
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            data = data.get("data", data.get("plates", []))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON文件解析失败: {str(e)}")

    success_count = 0
    error_count = 0

    for idx, item in enumerate(data):
        line_num = idx + 1
        try:
            plate = TemporaryPlate(
                plate_number=str(item.get("plate_number", "")).strip(),
                owner_name=str(item.get("owner_name", "")).strip(),
                owner_phone=str(item.get("owner_phone", "")).strip(),
                valid_from=parse_date(item.get("valid_from")),
                valid_to=parse_date(item.get("valid_to")),
                reason=str(item.get("reason", "")).strip(),
                source_file=file.filename
            )
            db.add(plate)
            success_count += 1
        except Exception as e:
            error_record = ImportErrorRecord(
                import_type="plate",
                source_file=file.filename,
                original_line=line_num,
                original_data=json.dumps(item, ensure_ascii=False),
                error_message=f"导入失败: {str(e)}",
                suggestion="请检查车牌、时间等字段格式"
            )
            db.add(error_record)
            error_count += 1

    db.commit()
    return {"status": "success", "total": len(data), "success": success_count, "failed": error_count}


@app.post("/import/blacklist")
async def import_blacklist(
    file: UploadFile = File(...),
    handler: str = Query(...),
    db: Session = Depends(get_db)
):
    content = await file.read()

    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content), dtype=str)
        data = df.to_dict("records")
    elif file.filename.endswith(".json"):
        data = json.loads(content)
    else:
        raise HTTPException(status_code=400, detail="只支持CSV或JSON格式")

    success_count = 0
    error_count = 0

    for idx, item in enumerate(data):
        try:
            blacklist = Blacklist(
                name=str(item.get("name", "")).strip(),
                id_card=str(item.get("id_card", "")).strip(),
                phone=str(item.get("phone", "")).strip(),
                plate_number=str(item.get("plate_number", "")).strip() if item.get("plate_number") else None,
                reason=str(item.get("reason", "")).strip(),
                level=str(item.get("level", "normal")).strip(),
                added_by=handler,
                source_file=file.filename
            )
            db.add(blacklist)
            success_count += 1
        except Exception as e:
            error_record = ImportErrorRecord(
                import_type="blacklist",
                source_file=file.filename,
                original_line=idx + 1,
                original_data=json.dumps(item, ensure_ascii=False),
                error_message=str(e),
                suggestion="请检查必填字段是否完整"
            )
            db.add(error_record)
            error_count += 1

    db.commit()
    return {"status": "success", "total": len(data), "success": success_count, "failed": error_count}


@app.post("/verify")
async def verify_visitor(
    name: Optional[str] = None,
    phone: Optional[str] = None,
    id_card: Optional[str] = None,
    plate_number: Optional[str] = None,
    handler: str = Query(...),
    db: Session = Depends(get_db)
):
    anomalies = []
    is_anomaly = False
    anomaly_type = None
    detail = ""
    status = "pass"

    visitor = None
    if id_card:
        visitor = db.query(Visitor).filter(Visitor.id_card == id_card).first()
    if not visitor and phone:
        visitor = db.query(Visitor).filter(Visitor.phone == phone).first()
    if not visitor and name:
        visitor = db.query(Visitor).filter(Visitor.name == name).first()

    blacklist_check = []
    if id_card:
        blacklist_check.append(Blacklist.id_card == id_card)
    if phone:
        blacklist_check.append(Blacklist.phone == phone)
    if plate_number:
        blacklist_check.append(Blacklist.plate_number == plate_number)

    if blacklist_check:
        blacklist = db.query(Blacklist).filter(and_(or_(*blacklist_check), Blacklist.is_active == True)).first()
        if blacklist:
            is_anomaly = True
            anomaly_type = "blacklist"
            status = "reject"
            anomalies.append(f"黑名单人员: {blacklist.name}, 原因: {blacklist.reason}, 级别: {blacklist.level}")

    if plate_number and not is_anomaly:
        now = datetime.now()
        plate = db.query(TemporaryPlate).filter(
            and_(
                TemporaryPlate.plate_number == plate_number,
                TemporaryPlate.valid_from <= now,
                TemporaryPlate.valid_to >= now
            )
        ).first()
        if not plate:
            is_anomaly = True
            anomaly_type = "invalid_plate"
            status = "warning"
            anomalies.append(f"车牌 {plate_number} 无有效临时通行权限")

    if not visitor and not is_anomaly:
        is_anomaly = True
        anomaly_type = "no_appointment"
        status = "warning"
        anomalies.append("未找到访客预约记录")

    if visitor and not is_anomaly:
        now = datetime.now()
        if visitor.expected_arrival and now < visitor.expected_arrival:
            is_anomaly = True
            anomaly_type = "early_arrival"
            status = "warning"
            anomalies.append(f"提前到达，预约时间: {visitor.expected_arrival}")
        elif visitor.expected_departure and now > visitor.expected_departure:
            is_anomaly = True
            anomaly_type = "late_arrival"
            status = "warning"
            anomalies.append(f"超过预约离开时间: {visitor.expected_departure}")

    detail = "; ".join(anomalies) if anomalies else "核验通过"

    record = VerificationRecord(
        visitor_id=visitor.id if visitor else None,
        visitor_name=visitor.name if visitor else (name or "未知"),
        visitor_phone=visitor.phone if visitor else (phone or "未知"),
        plate_number=plate_number,
        status=status,
        handler=handler,
        is_anomaly=is_anomaly,
        anomaly_type=anomaly_type,
        detail=detail
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "record_id": record.id,
        "is_anomaly": is_anomaly,
        "anomaly_type": anomaly_type,
        "status": status,
        "detail": detail,
        "visitor_info": {
            "name": visitor.name if visitor else name,
            "phone": visitor.phone if visitor else phone,
            "company": visitor.company if visitor else None,
            "visit_person": visitor.visit_person if visitor else None
        } if visitor else None
    }


@app.get("/records")
async def get_records(
    handler: Optional[str] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    is_anomaly: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(VerificationRecord)

    if handler:
        query = query.filter(VerificationRecord.handler == handler)
    if status:
        query = query.filter(VerificationRecord.status == status)
    if anomaly_type:
        query = query.filter(VerificationRecord.anomaly_type == anomaly_type)
    if is_anomaly is not None:
        query = query.filter(VerificationRecord.is_anomaly == is_anomaly)
    if start_date:
        start = parse_date(start_date) or datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(VerificationRecord.verify_time >= start)
    if end_date:
        end = parse_date(end_date) or datetime.strptime(end_date, "%Y-%m-%d")
        end = end.replace(hour=23, minute=59, second=59)
        query = query.filter(VerificationRecord.verify_time <= end)

    total = query.count()
    records = query.order_by(VerificationRecord.verify_time.desc()).offset(skip).limit(limit).all()

    return {
        "total": total,
        "records": [
            {
                "id": r.id,
                "visitor_name": r.visitor_name,
                "visitor_phone": r.visitor_phone,
                "plate_number": r.plate_number,
                "verify_time": r.verify_time.isoformat(),
                "status": r.status,
                "handler": r.handler,
                "is_anomaly": r.is_anomaly,
                "anomaly_type": r.anomaly_type,
                "detail": r.detail
            }
            for r in records
        ]
    }


@app.get("/records/export")
async def export_records(
    handler: Optional[str] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    is_anomaly: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(VerificationRecord)

    if handler:
        query = query.filter(VerificationRecord.handler == handler)
    if status:
        query = query.filter(VerificationRecord.status == status)
    if anomaly_type:
        query = query.filter(VerificationRecord.anomaly_type == anomaly_type)
    if is_anomaly is not None:
        query = query.filter(VerificationRecord.is_anomaly == is_anomaly)
    if start_date:
        start = parse_date(start_date) or datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(VerificationRecord.verify_time >= start)
    if end_date:
        end = parse_date(end_date) or datetime.strptime(end_date, "%Y-%m-%d")
        end = end.replace(hour=23, minute=59, second=59)
        query = query.filter(VerificationRecord.verify_time <= end)

    records = query.order_by(VerificationRecord.verify_time.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["核验ID", "访客姓名", "手机号", "车牌号", "核验时间", "状态", "操作人", "是否异常", "异常类型", "详情"])

    for r in records:
        writer.writerow([
            r.id,
            r.visitor_name,
            r.visitor_phone,
            r.plate_number or "",
            r.verify_time.strftime("%Y-%m-%d %H:%M:%S"),
            r.status,
            r.handler,
            "是" if r.is_anomaly else "否",
            r.anomaly_type or "",
            r.detail
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=verification_records_{datetime.now().strftime('%Y%m%d')}.csv"}
    )


@app.get("/errors")
async def get_import_errors(
    import_type: Optional[str] = None,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ImportErrorRecord)
    if import_type:
        query = query.filter(ImportErrorRecord.import_type == import_type)
    if resolved is not None:
        query = query.filter(ImportErrorRecord.resolved == resolved)

    errors = query.order_by(ImportErrorRecord.created_at.desc()).all()
    return {
        "total": len(errors),
        "errors": [
            {
                "id": e.id,
                "import_type": e.import_type,
                "source_file": e.source_file,
                "original_line": e.original_line,
                "original_data": json.loads(e.original_data),
                "error_message": e.error_message,
                "suggestion": e.suggestion,
                "created_at": e.created_at.isoformat(),
                "resolved": e.resolved
            }
            for e in errors
        ]
    }


@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    total_visitors = db.query(Visitor).count()
    total_plates = db.query(TemporaryPlate).count()
    total_blacklist = db.query(Blacklist).filter(Blacklist.is_active == True).count()
    today_verifications = db.query(VerificationRecord).filter(VerificationRecord.verify_time >= today_start).count()
    today_anomalies = db.query(VerificationRecord).filter(
        and_(VerificationRecord.verify_time >= today_start, VerificationRecord.is_anomaly == True)
    ).count()

    return {
        "visitors": total_visitors,
        "temporary_plates": total_plates,
        "active_blacklist": total_blacklist,
        "today_verifications": today_verifications,
        "today_anomalies": today_anomalies
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
