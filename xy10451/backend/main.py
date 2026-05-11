from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func

import models
import schemas
import services
from database import engine, Base, get_db

app = FastAPI(title="共享厨房排班台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/merchants", response_model=List[schemas.Merchant])
async def get_merchants(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Merchant).order_by(models.Merchant.name))
    return result.scalars().all()


@app.post("/api/merchants", response_model=schemas.Merchant, status_code=status.HTTP_201_CREATED)
async def create_merchant(merchant: schemas.MerchantCreate, db: AsyncSession = Depends(get_db)):
    new_merchant = models.Merchant(**merchant.model_dump())
    db.add(new_merchant)
    await db.commit()
    await db.refresh(new_merchant)
    return new_merchant


@app.get("/api/merchants/{merchant_id}", response_model=schemas.Merchant)
async def get_merchant(merchant_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Merchant).where(models.Merchant.id == merchant_id))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="商户不存在")
    return merchant


@app.put("/api/merchants/{merchant_id}", response_model=schemas.Merchant)
async def update_merchant(
    merchant_id: int,
    merchant_data: schemas.MerchantUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Merchant).where(models.Merchant.id == merchant_id))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="商户不存在")

    for key, value in merchant_data.model_dump(exclude_unset=True).items():
        setattr(merchant, key, value)

    await db.commit()
    await db.refresh(merchant)
    return merchant


@app.get("/api/resources", response_model=List[schemas.Resource])
async def get_resources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Resource).order_by(models.Resource.type, models.Resource.name))
    return result.scalars().all()


@app.post("/api/resources", response_model=schemas.Resource, status_code=status.HTTP_201_CREATED)
async def create_resource(resource: schemas.ResourceCreate, db: AsyncSession = Depends(get_db)):
    new_resource = models.Resource(**resource.model_dump())
    db.add(new_resource)
    await db.commit()
    await db.refresh(new_resource)
    return new_resource


@app.get("/api/resources/{resource_id}", response_model=schemas.Resource)
async def get_resource(resource_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Resource).where(models.Resource.id == resource_id))
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")
    return resource


@app.put("/api/resources/{resource_id}", response_model=schemas.Resource)
async def update_resource(
    resource_id: int,
    resource_data: schemas.ResourceUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Resource).where(models.Resource.id == resource_id))
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    for key, value in resource_data.model_dump(exclude_unset=True).items():
        setattr(resource, key, value)

    await db.commit()
    await db.refresh(resource)
    return resource


@app.get("/api/faults", response_model=List[schemas.FaultRecord])
async def get_fault_records(
    is_resolved: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.FaultRecord).order_by(models.FaultRecord.fault_time.desc())
    if is_resolved is not None:
        stmt = stmt.where(models.FaultRecord.is_resolved == is_resolved)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/api/faults", response_model=schemas.FaultRecord, status_code=status.HTTP_201_CREATED)
async def create_fault_record(
    fault: schemas.FaultRecordCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Resource).where(models.Resource.id == fault.resource_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="资源不存在")

    new_fault = models.FaultRecord(**fault.model_dump())
    db.add(new_fault)

    result_resource = await db.execute(
        select(models.Resource).where(models.Resource.id == fault.resource_id)
    )
    resource = result_resource.scalar_one()
    resource.is_available = False

    await db.commit()
    await db.refresh(new_fault)
    return new_fault


@app.put("/api/faults/{fault_id}", response_model=schemas.FaultRecord)
async def update_fault_record(
    fault_id: int,
    fault_data: schemas.FaultRecordUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.FaultRecord).where(models.FaultRecord.id == fault_id))
    fault = result.scalar_one_or_none()
    if not fault:
        raise HTTPException(status_code=404, detail="故障记录不存在")

    for key, value in fault_data.model_dump(exclude_unset=True).items():
        setattr(fault, key, value)

    if fault.is_resolved and not fault.resolved_time:
        fault.resolved_time = datetime.utcnow()

        result_resource = await db.execute(
            select(models.Resource).where(models.Resource.id == fault.resource_id)
        )
        resource = result_resource.scalar_one()
        resource.is_available = True

    await db.commit()
    await db.refresh(fault)
    return fault


@app.get("/api/reservations", response_model=List[schemas.Reservation])
async def get_reservations(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    resource_id: Optional[int] = None,
    merchant_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.Reservation).order_by(models.Reservation.start_time)

    if date_from:
        stmt = stmt.where(models.Reservation.date >= date_from)
    if date_to:
        stmt = stmt.where(models.Reservation.date <= date_to)
    if resource_id:
        stmt = stmt.where(models.Reservation.resource_id == resource_id)
    if merchant_id:
        stmt = stmt.where(models.Reservation.merchant_id == merchant_id)

    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/api/reservations/validate", response_model=schemas.ReservationValidationResult)
async def validate_new_reservation(
    reservation: schemas.ReservationCreate,
    db: AsyncSession = Depends(get_db)
):
    return await services.validate_reservation(db, reservation)


@app.post("/api/reservations", response_model=schemas.Reservation, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation: schemas.ReservationCreate,
    db: AsyncSession = Depends(get_db)
):
    result_merchant = await db.execute(
        select(models.Merchant).where(models.Merchant.id == reservation.merchant_id)
    )
    if not result_merchant.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="商户不存在")

    result_resource = await db.execute(
        select(models.Resource).where(models.Resource.id == reservation.resource_id)
    )
    if not result_resource.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="资源不存在")

    validation = await services.validate_reservation(db, reservation)

    new_reservation = models.Reservation(
        **reservation.model_dump(),
        date=reservation.start_time.date(),
        has_conflict=not validation.valid,
        conflict_note="; ".join([c.message for c in validation.conflicts]) if validation.conflicts else None
    )
    db.add(new_reservation)
    await db.commit()
    await db.refresh(new_reservation)
    return new_reservation


@app.get("/api/reservations/{reservation_id}", response_model=schemas.Reservation)
async def get_reservation(reservation_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Reservation).where(models.Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")
    return reservation


@app.put("/api/reservations/{reservation_id}", response_model=schemas.Reservation)
async def update_reservation(
    reservation_id: int,
    reservation_data: schemas.ReservationUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Reservation).where(models.Reservation.id == reservation_id))
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="预约不存在")

    for key, value in reservation_data.model_dump(exclude_unset=True).items():
        setattr(reservation, key, value)

    await db.commit()
    await db.refresh(reservation)
    return reservation


@app.post("/api/reservations/{reservation_id}/reassign")
async def reassign_reservation(
    reservation_id: int,
    new_resource_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Reservation).where(models.Reservation.id == reservation_id))
    old_reservation = result.scalar_one_or_none()
    if not old_reservation:
        raise HTTPException(status_code=404, detail="预约不存在")

    result_resource = await db.execute(
        select(models.Resource).where(models.Resource.id == new_resource_id)
    )
    if not result_resource.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="新资源不存在")

    new_reservation_data = schemas.ReservationCreate(
        merchant_id=old_reservation.merchant_id,
        resource_id=new_resource_id,
        start_time=old_reservation.start_time,
        end_time=old_reservation.end_time,
        purpose=old_reservation.purpose
    )

    validation = await services.validate_reservation(db, new_reservation_data)

    new_reservation = models.Reservation(
        merchant_id=old_reservation.merchant_id,
        resource_id=new_resource_id,
        date=old_reservation.date,
        start_time=old_reservation.start_time,
        end_time=old_reservation.end_time,
        purpose=old_reservation.purpose,
        status="confirmed",
        original_reservation_id=reservation_id,
        has_conflict=not validation.valid,
        conflict_note="; ".join([c.message for c in validation.conflicts]) if validation.conflicts else None
    )
    db.add(new_reservation)

    old_reservation.status = "reassigned"

    await db.commit()
    await db.refresh(new_reservation)
    return new_reservation


@app.get("/api/cleaning-windows", response_model=List[schemas.CleaningWindow])
async def get_cleaning_windows(
    target_date: Optional[date] = None,
    resource_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.CleaningWindow).order_by(models.CleaningWindow.start_time)
    if target_date:
        stmt = stmt.where(models.CleaningWindow.date == target_date)
    if resource_id:
        stmt = stmt.where(models.CleaningWindow.resource_id == resource_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/api/cleaning-windows", response_model=schemas.CleaningWindow, status_code=status.HTTP_201_CREATED)
async def create_cleaning_window(
    cleaning: schemas.CleaningWindowCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Resource).where(models.Resource.id == cleaning.resource_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="资源不存在")

    new_cleaning = models.CleaningWindow(
        **cleaning.model_dump(),
        date=cleaning.start_time.date()
    )
    db.add(new_cleaning)
    await db.commit()
    await db.refresh(new_cleaning)
    return new_cleaning


@app.put("/api/cleaning-windows/{window_id}", response_model=schemas.CleaningWindow)
async def update_cleaning_window(
    window_id: int,
    data: schemas.CleaningWindowUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.CleaningWindow).where(models.CleaningWindow.id == window_id)
    )
    window = result.scalar_one_or_none()
    if not window:
        raise HTTPException(status_code=404, detail="清洁窗口不存在")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(window, key, value)

    await db.commit()
    await db.refresh(window)
    return window


@app.post("/api/overtime/record", response_model=schemas.OvertimeRecord, status_code=status.HTTP_201_CREATED)
async def record_overtime(
    data: schemas.OvertimeRecordCreate,
    db: AsyncSession = Depends(get_db)
):
    result_reservation = await db.execute(
        select(models.Reservation).where(models.Reservation.id == data.reservation_id)
    )
    if not result_reservation.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="预约不存在")

    overtime_calc = await services.calculate_overtime_fee(
        db, data.reservation_id, data.actual_end_time, data.hourly_rate
    )

    if "error" in overtime_calc:
        raise HTTPException(status_code=400, detail=overtime_calc["error"])

    new_overtime = models.OvertimeRecord(
        reservation_id=data.reservation_id,
        actual_end_time=data.actual_end_time,
        overtime_minutes=overtime_calc["overtime_minutes"],
        hourly_rate=data.hourly_rate,
        overtime_fee=overtime_calc["overtime_fee"],
        affected_next_reservation_id=overtime_calc["affected_next_reservation_id"],
        note=data.note
    )
    db.add(new_overtime)
    await db.commit()
    await db.refresh(new_overtime)
    return new_overtime


@app.get("/api/overtime", response_model=List[schemas.OvertimeRecord])
async def get_overtime_records(
    reservation_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.OvertimeRecord).order_by(models.OvertimeRecord.created_at.desc())
    if reservation_id:
        stmt = stmt.where(models.OvertimeRecord.reservation_id == reservation_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.get("/api/merchant-fees", response_model=List[schemas.MerchantFee])
async def get_merchant_fees(
    target_date: Optional[date] = None,
    merchant_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models.MerchantFee).order_by(models.MerchantFee.date.desc())
    if target_date:
        stmt = stmt.where(models.MerchantFee.date == target_date)
    if merchant_id:
        stmt = stmt.where(models.MerchantFee.merchant_id == merchant_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/api/merchant-fees", response_model=schemas.MerchantFee, status_code=status.HTTP_201_CREATED)
async def create_merchant_fee(
    data: schemas.MerchantFeeCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Merchant).where(models.Merchant.id == data.merchant_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="商户不存在")

    new_fee = models.MerchantFee(**data.model_dump())
    db.add(new_fee)
    await db.commit()
    await db.refresh(new_fee)
    return new_fee


@app.get("/api/kanban")
async def get_kanban(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    if target_date is None:
        target_date = date.today()
    return await services.get_daily_kanban_data(db, target_date)


@app.get("/api/export/schedule", response_class=PlainTextResponse)
async def export_schedule(
    target_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db)
):
    if target_date is None:
        target_date = date.today()

    content = await services.export_daily_schedule(db, target_date)
    return content


@app.post("/api/seed/sample-data", status_code=status.HTTP_201_CREATED)
async def load_sample_data(db: AsyncSession = Depends(get_db)):
    today = date.today()

    existing_merchants = await db.execute(select(models.Merchant))
    if existing_merchants.scalars().first():
        return {"message": "已存在数据，跳过初始化"}

    merchants = [
        models.Merchant(name="早来点早餐", phone="13800138001", contact="张师傅", type="早餐档"),
        models.Merchant(name="甜蜜烘焙坊", phone="13800138002", contact="李女士", type="烘焙档"),
        models.Merchant(name="夜猫子烧烤", phone="13800138003", contact="王老板", type="夜宵档"),
        models.Merchant(name="川味小厨", phone="13800138004", contact="刘师傅", type="正餐档"),
    ]
    for m in merchants:
        db.add(m)

    resources = [
        models.Resource(name="灶台A", type="灶台", location="烹饪区1", description="大功率商用灶台"),
        models.Resource(name="灶台B", type="灶台", location="烹饪区1", description="大功率商用灶台"),
        models.Resource(name="烤箱A", type="烤箱", location="烘焙区", description="380V商用烤箱，容量600L"),
        models.Resource(name="烤箱B", type="烤箱", location="烘焙区", description="380V商用烤箱，容量400L"),
        models.Resource(name="冷库A", type="冷库", location="仓储区", description="-18°C冷冻库"),
        models.Resource(name="冷库B", type="冷库", location="仓储区", description="0-4°C冷藏库"),
    ]
    for r in resources:
        db.add(r)

    await db.commit()

    result_merchants = await db.execute(select(models.Merchant))
    merchants_list = result_merchants.scalars().all()

    result_resources = await db.execute(select(models.Resource))
    resources_list = result_resources.scalars().all()

    merchant_map = {m.name: m for m in merchants_list}
    resource_map = {r.name: r for r in resources_list}

    start_datetime = datetime.combine(today, datetime.min.time())

    reservations = [
        models.Reservation(
            merchant_id=merchant_map["早来点早餐"].id,
            resource_id=resource_map["灶台A"].id,
            date=today,
            start_time=start_datetime.replace(hour=5, minute=0),
            end_time=start_datetime.replace(hour=9, minute=0),
            purpose="早餐时段",
            status="completed"
        ),
        models.Reservation(
            merchant_id=merchant_map["早来点早餐"].id,
            resource_id=resource_map["冷库B"].id,
            date=today,
            start_time=start_datetime.replace(hour=6, minute=0),
            end_time=start_datetime.replace(hour=7, minute=0),
            purpose="食材冷藏",
            status="completed"
        ),
        models.Reservation(
            merchant_id=merchant_map["甜蜜烘焙坊"].id,
            resource_id=resource_map["烤箱A"].id,
            date=today,
            start_time=start_datetime.replace(hour=8, minute=0),
            end_time=start_datetime.replace(hour=12, minute=0),
            purpose="面包烘焙",
            status="confirmed"
        ),
        models.Reservation(
            merchant_id=merchant_map["甜蜜烘焙坊"].id,
            resource_id=resource_map["冷库A"].id,
            date=today,
            start_time=start_datetime.replace(hour=7, minute=0),
            end_time=start_datetime.replace(hour=8, minute=0),
            purpose="面团冷冻",
            status="completed"
        ),
        models.Reservation(
            merchant_id=merchant_map["川味小厨"].id,
            resource_id=resource_map["灶台B"].id,
            date=today,
            start_time=start_datetime.replace(hour=11, minute=0),
            end_time=start_datetime.replace(hour=14, minute=0),
            purpose="午餐时段",
            status="confirmed"
        ),
        models.Reservation(
            merchant_id=merchant_map["夜猫子烧烤"].id,
            resource_id=resource_map["灶台B"].id,
            date=today,
            start_time=start_datetime.replace(hour=17, minute=0),
            end_time=start_datetime.replace(hour=20, minute=0),
            purpose="晚餐时段",
            status="confirmed"
        ),
        models.Reservation(
            merchant_id=merchant_map["夜猫子烧烤"].id,
            resource_id=resource_map["灶台A"].id,
            date=today,
            start_time=start_datetime.replace(hour=21, minute=0),
            end_time=start_datetime.replace(hour=23, minute=30),
            purpose="夜宵时段",
            status="confirmed"
        ),
    ]

    for r in reservations:
        db.add(r)

    cleaning_windows = [
        models.CleaningWindow(
            resource_id=resource_map["灶台A"].id,
            date=today,
            start_time=start_datetime.replace(hour=9, minute=0),
            end_time=start_datetime.replace(hour=9, minute=30),
            minimum_cleaning_minutes=30
        ),
        models.CleaningWindow(
            resource_id=resource_map["烤箱A"].id,
            date=today,
            start_time=start_datetime.replace(hour=12, minute=0),
            end_time=start_datetime.replace(hour=12, minute=30),
            minimum_cleaning_minutes=30
        ),
        models.CleaningWindow(
            resource_id=resource_map["灶台B"].id,
            date=today,
            start_time=start_datetime.replace(hour=14, minute=0),
            end_time=start_datetime.replace(hour=14, minute=30),
            minimum_cleaning_minutes=30
        ),
    ]

    for cw in cleaning_windows:
        db.add(cw)

    await db.commit()

    result_reservations = await db.execute(
        select(models.Reservation).where(
            models.Reservation.date == today,
            models.Reservation.status == "completed"
        )
    )
    completed_reservations = result_reservations.scalars().all()

    if completed_reservations:
        first_completed = completed_reservations[0]
        actual_end = first_completed.end_time + timedelta(minutes=45)
        overtime_calc = await services.calculate_overtime_fee(
            db, first_completed.id, actual_end, 60.0
        )

        overtime = models.OvertimeRecord(
            reservation_id=first_completed.id,
            actual_end_time=actual_end,
            overtime_minutes=overtime_calc["overtime_minutes"],
            hourly_rate=60.0,
            overtime_fee=overtime_calc["overtime_fee"],
            affected_next_reservation_id=overtime_calc["affected_next_reservation_id"],
            note="早餐档超时，导致后续清洁推迟",
            status="pending"
        )
        db.add(overtime)

        await db.commit()

    await db.commit()

    result_fees = await db.execute(
        select(models.MerchantFee).where(
            models.MerchantFee.date == today,
            models.MerchantFee.merchant_id == merchant_map["早来点早餐"].id
        )
    )
    if not result_fees.scalar_one_or_none():
        result_overtime = await db.execute(
            select(models.OvertimeRecord).where(
                func.date(models.OvertimeRecord.created_at) == today
            )
        )
        overtime_list = result_overtime.scalars().all()
        overtime_total = sum(o.overtime_fee for o in overtime_list if o.reservation.merchant_id == merchant_map["早来点早餐"].id)

        fee = models.MerchantFee(
            merchant_id=merchant_map["早来点早餐"].id,
            date=today,
            reservation_fee=200.0,
            overtime_fee=overtime_total,
            total_fee=200.0 + overtime_total,
            note="早餐档费用"
        )
        db.add(fee)
        await db.commit()

    return {"message": "样例数据加载成功"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
