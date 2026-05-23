from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db, engine
import models
import schemas
import services

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="志愿者排班签到 API",
    description="提供志愿者排班、签到、替班、时长认证等功能的 REST API",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"message": "志愿者排班签到 API 服务已启动", "docs": "/docs", "redoc": "/redoc"}


@app.post("/volunteers/", response_model=schemas.Volunteer, tags=["志愿者管理"])
def create_volunteer(volunteer: schemas.VolunteerCreate, db: Session = Depends(get_db)):
    return services.create_volunteer(db, volunteer)


@app.get("/volunteers/", response_model=List[schemas.Volunteer], tags=["志愿者管理"])
def get_volunteers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_volunteers(db, skip, limit)


@app.get("/volunteers/{volunteer_id}", response_model=schemas.Volunteer, tags=["志愿者管理"])
def get_volunteer(volunteer_id: int, db: Session = Depends(get_db)):
    db_volunteer = services.get_volunteer(db, volunteer_id)
    if not db_volunteer:
        raise HTTPException(status_code=404, detail="志愿者不存在")
    return db_volunteer


@app.put("/volunteers/{volunteer_id}", response_model=schemas.Volunteer, tags=["志愿者管理"])
def update_volunteer(volunteer_id: int, volunteer: schemas.VolunteerUpdate, db: Session = Depends(get_db)):
    db_volunteer = services.update_volunteer(db, volunteer_id, volunteer)
    if not db_volunteer:
        raise HTTPException(status_code=404, detail="志愿者不存在")
    return db_volunteer


@app.post("/locations/", response_model=schemas.Location, tags=["签到位置管理"])
def create_location(location: schemas.LocationCreate, db: Session = Depends(get_db)):
    return services.create_location(db, location)


@app.get("/locations/", response_model=List[schemas.Location], tags=["签到位置管理"])
def get_locations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_locations(db, skip, limit)


@app.get("/locations/{location_id}", response_model=schemas.Location, tags=["签到位置管理"])
def get_location(location_id: int, db: Session = Depends(get_db)):
    db_location = services.get_location(db, location_id)
    if not db_location:
        raise HTTPException(status_code=404, detail="位置不存在")
    return db_location


@app.put("/locations/{location_id}", response_model=schemas.Location, tags=["签到位置管理"])
def update_location(location_id: int, location: schemas.LocationUpdate, db: Session = Depends(get_db)):
    db_location = services.update_location(db, location_id, location)
    if not db_location:
        raise HTTPException(status_code=404, detail="位置不存在")
    return db_location


@app.post("/shifts/", response_model=schemas.Shift, tags=["班次管理"])
def create_shift(shift: schemas.ShiftCreate, db: Session = Depends(get_db)):
    return services.create_shift(db, shift)


@app.get("/shifts/", response_model=List[schemas.Shift], tags=["班次管理"])
def get_shifts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_shifts(db, skip, limit)


@app.get("/shifts/{shift_id}", response_model=schemas.Shift, tags=["班次管理"])
def get_shift(shift_id: int, db: Session = Depends(get_db)):
    db_shift = services.get_shift(db, shift_id)
    if not db_shift:
        raise HTTPException(status_code=404, detail="班次不存在")
    return db_shift


@app.put("/shifts/{shift_id}", response_model=schemas.Shift, tags=["班次管理"])
def update_shift(shift_id: int, shift: schemas.ShiftUpdate, db: Session = Depends(get_db)):
    db_shift = services.update_shift(db, shift_id, shift)
    if not db_shift:
        raise HTTPException(status_code=404, detail="班次不存在")
    return db_shift


@app.post("/checkins/", tags=["签到管理"])
def create_checkin(checkin: schemas.CheckInCreate, db: Session = Depends(get_db)):
    result, message = services.create_checkin(db, checkin)
    if not result:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": result}


@app.get("/checkins/", response_model=List[schemas.CheckInRecord], tags=["签到管理"])
def get_checkins(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_checkins(db, skip, limit)


@app.get("/checkins/{checkin_id}", response_model=schemas.CheckInRecord, tags=["签到管理"])
def get_checkin(checkin_id: int, db: Session = Depends(get_db)):
    db_checkin = services.get_checkin(db, checkin_id)
    if not db_checkin:
        raise HTTPException(status_code=404, detail="签到记录不存在")
    return db_checkin


@app.post("/checkins/{checkin_id}/checkout", tags=["签到管理"])
def checkout(checkin_id: int, checkout_data: schemas.CheckOut, db: Session = Depends(get_db)):
    result, message = services.checkout(db, checkin_id, checkout_data)
    if not result:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": result}


@app.post("/checkins/{checkin_id}/recalculate", tags=["签到管理"])
def recalculate_duration(checkin_id: int, db: Session = Depends(get_db)):
    result, message = services.recalculate_duration(db, checkin_id)
    if not result:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": result}


@app.post("/swaps/", response_model=schemas.ShiftSwap, tags=["替班管理"])
def create_swap(swap: schemas.ShiftSwapCreate, db: Session = Depends(get_db)):
    return services.create_swap(db, swap)


@app.get("/swaps/", response_model=List[schemas.ShiftSwap], tags=["替班管理"])
def get_swaps(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_swaps(db, skip, limit)


@app.get("/swaps/{swap_id}", response_model=schemas.ShiftSwap, tags=["替班管理"])
def get_swap(swap_id: int, db: Session = Depends(get_db)):
    db_swap = services.get_swap(db, swap_id)
    if not db_swap:
        raise HTTPException(status_code=404, detail="替班申请不存在")
    return db_swap


@app.post("/swaps/{swap_id}/approve", tags=["替班管理"])
def approve_swap(swap_id: int, approval: schemas.ShiftSwapApproval, db: Session = Depends(get_db)):
    result, message = services.approve_swap(db, swap_id, approval)
    if not result:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": result}


@app.post("/certifications/", response_model=schemas.DurationCertification, tags=["时长认证管理"])
def create_certification(cert: schemas.DurationCertificationCreate, db: Session = Depends(get_db)):
    return services.create_certification(db, cert)


@app.get("/certifications/", response_model=List[schemas.DurationCertification], tags=["时长认证管理"])
def get_certifications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_certifications(db, skip, limit)


@app.get("/certifications/{cert_id}", response_model=schemas.DurationCertification, tags=["时长认证管理"])
def get_certification(cert_id: int, db: Session = Depends(get_db)):
    db_cert = services.get_certification(db, cert_id)
    if not db_cert:
        raise HTTPException(status_code=404, detail="认证记录不存在")
    return db_cert


@app.post("/certifications/{cert_id}/verify", tags=["时长认证管理"])
def verify_certification(cert_id: int, verification: schemas.DurationCertificationVerify, db: Session = Depends(get_db)):
    result, message = services.verify_certification(db, cert_id, verification)
    if not result:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": result}


@app.post("/reports/", response_model=schemas.ServiceReport, tags=["服务报告管理"])
def create_report(report: schemas.ServiceReportCreate, db: Session = Depends(get_db)):
    return services.create_report(db, report)


@app.get("/reports/", response_model=List[schemas.ServiceReport], tags=["服务报告管理"])
def get_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.get_reports(db, skip, limit)


@app.get("/reports/{report_id}", response_model=schemas.ServiceReport, tags=["服务报告管理"])
def get_report(report_id: int, db: Session = Depends(get_db)):
    db_report = services.get_report(db, report_id)
    if not db_report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return db_report


@app.post("/reports/export", tags=["服务报告管理"])
def export_report(export_req: schemas.ExportRequest, db: Session = Depends(get_db)):
    content, format_type = services.export_report(db, export_req)
    if not content:
        raise HTTPException(status_code=400, detail=format_type)
    
    if format_type == "csv":
        return PlainTextResponse(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=report_{export_req.report_id}.csv"}
        )
    elif format_type == "json":
        return PlainTextResponse(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=report_{export_req.report_id}.json"}
        )
    return {"content": content, "format": format_type}


@app.post("/corrections/", tags=["人工修正"])
def create_correction(correction: schemas.ManualCorrectionCreate, db: Session = Depends(get_db)):
    result, message = services.create_manual_correction(db, correction)
    if not result:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message, "data": result}


@app.get("/corrections/", response_model=List[schemas.ManualCorrection], tags=["人工修正"])
def get_corrections(
    checkin_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return services.get_corrections(db, checkin_id, skip, limit)


@app.get("/exceptions/", tags=["异常日志"])
def get_exception_logs(
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return services.get_exception_logs(db, skip, limit, related_type, related_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)