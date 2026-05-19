from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from pathlib import Path

from app.core.database import get_db, init_db
from app.core.config import settings
from app.core.logging import app_logger

from app.services.elderly import ElderlyService
from app.services.menu import MenuService
from app.services.meal import MealService
from app.services.delivery import DeliveryService
from app.services.followup import FollowUpService
from app.services.report import ReportService

from app.models import MealType, SatisfactionLevel


app = FastAPI(title=settings.PROJECT_NAME)


@app.on_event("startup")
def startup_event():
    init_db()
    app_logger.info("应用启动，数据库初始化完成")


@app.get("/")
def root():
    return {"message": "社区食堂配餐管理系统", "version": "1.0.0"}


@app.post("/api/v1/elderly", tags=["老人管理"])
def create_elderly(
    name: str,
    gender: Optional[str] = None,
    age: Optional[int] = None,
    phone: Optional[str] = None,
    id_card: Optional[str] = None,
    address: Optional[str] = None,
    room_number: Optional[str] = None,
    dietary_restrictions: Optional[List[str]] = Query(None),
    chronic_diseases: Optional[List[str]] = Query(None),
    emergency_contact: Optional[str] = None,
    emergency_phone: Optional[str] = None,
    delivery_route: Optional[str] = None,
    delivery_sequence: Optional[int] = None,
    notes: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = ElderlyService.create_elderly(
        db=db,
        name=name,
        gender=gender,
        age=age,
        phone=phone,
        id_card=id_card,
        address=address,
        room_number=room_number,
        dietary_restrictions=dietary_restrictions,
        chronic_diseases=chronic_diseases,
        emergency_contact=emergency_contact,
        emergency_phone=emergency_phone,
        delivery_route=delivery_route,
        delivery_sequence=delivery_sequence,
        notes=notes,
        operator=operator
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.put("/api/v1/elderly/{elderly_id}", tags=["老人管理"])
def update_elderly(
    elderly_id: int,
    name: Optional[str] = None,
    gender: Optional[str] = None,
    age: Optional[int] = None,
    phone: Optional[str] = None,
    id_card: Optional[str] = None,
    address: Optional[str] = None,
    room_number: Optional[str] = None,
    delivery_route: Optional[str] = None,
    delivery_sequence: Optional[int] = None,
    notes: Optional[str] = None,
    is_active: Optional[bool] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if gender is not None:
        update_data["gender"] = gender
    if age is not None:
        update_data["age"] = age
    if phone is not None:
        update_data["phone"] = phone
    if id_card is not None:
        update_data["id_card"] = id_card
    if address is not None:
        update_data["address"] = address
    if room_number is not None:
        update_data["room_number"] = room_number
    if delivery_route is not None:
        update_data["delivery_route"] = delivery_route
    if delivery_sequence is not None:
        update_data["delivery_sequence"] = delivery_sequence
    if notes is not None:
        update_data["notes"] = notes
    if is_active is not None:
        update_data["is_active"] = is_active
    
    result = ElderlyService.update_elderly(db, elderly_id, update_data, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/v1/elderly/{elderly_id}", tags=["老人管理"])
def get_elderly(elderly_id: int, mask: bool = True, db: Session = Depends(get_db)):
    result = ElderlyService.get_elderly(db, elderly_id, mask)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@app.get("/api/v1/elderly", tags=["老人管理"])
def list_elderly(
    route: Optional[str] = None,
    is_active: Optional[bool] = None,
    mask: bool = True,
    db: Session = Depends(get_db)
):
    return ElderlyService.list_elderly(db, route, is_active, mask)


@app.post("/api/v1/menus", tags=["菜单管理"])
def create_menu(
    menu_date: date,
    breakfast: Optional[List[str]] = Query(None),
    lunch: Optional[List[str]] = Query(None),
    dinner: Optional[List[str]] = Query(None),
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = MenuService.create_menu(
        db=db,
        menu_date=menu_date,
        breakfast=breakfast,
        lunch=lunch,
        dinner=dinner,
        operator=operator
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/v1/menus/{menu_date}", tags=["菜单管理"])
def get_menu(menu_date: date, db: Session = Depends(get_db)):
    result = MenuService.get_menu(db, menu_date)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result


@app.post("/api/v1/meals/allocate", tags=["配餐管理"])
def allocate_meal(
    elderly_id: int,
    menu_date: date,
    meal_type: MealType,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = MealService.allocate_meal(db, elderly_id, menu_date, meal_type, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/v1/meals/allocate/batch", tags=["配餐管理"])
def batch_allocate_meals(
    menu_date: date,
    meal_type: MealType,
    elderly_ids: Optional[List[int]] = Query(None),
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return MealService.batch_allocate_meals(db, menu_date, meal_type, elderly_ids, operator)


@app.put("/api/v1/meals/{allocation_id}/modify", tags=["配餐管理"])
def modify_meal(
    allocation_id: int,
    new_items: List[str] = Query(...),
    reason: str = ...,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = MealService.modify_meal(db, allocation_id, list(new_items), reason, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.put("/api/v1/meals/{allocation_id}/confirm", tags=["配餐管理"])
def confirm_meal(
    allocation_id: int,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = MealService.confirm_meal(db, allocation_id, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/v1/meals/conflicts/{menu_date}", tags=["配餐管理"])
def get_conflicts(menu_date: date, db: Session = Depends(get_db)):
    return MealService.get_conflicts_by_date(db, menu_date)


@app.post("/api/v1/deliveries/create", tags=["配送管理"])
def create_delivery_records(
    delivery_date: date,
    meal_type: str,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = DeliveryService.create_delivery_records(db, delivery_date, meal_type, None, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/v1/deliveries/batch/{batch_id}", tags=["配送管理"])
def get_deliveries_by_batch(batch_id: str, db: Session = Depends(get_db)):
    return DeliveryService.get_deliveries_by_batch(db, batch_id)


@app.put("/api/v1/deliveries/{delivery_id}/deliver", tags=["配送管理"])
def mark_as_delivered(
    delivery_id: int,
    delivered_by: str,
    received_by: Optional[str] = None,
    temperature: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = DeliveryService.mark_as_delivered(
        db=db,
        delivery_id=delivery_id,
        delivered_by=delivered_by,
        received_by=received_by,
        temperature=temperature,
        operator=operator
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.put("/api/v1/deliveries/{delivery_id}/fail", tags=["配送管理"])
def mark_as_failed(
    delivery_id: int,
    failure_reason: str,
    delivered_by: str,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = DeliveryService.mark_as_failed(db, delivery_id, failure_reason, delivered_by, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/v1/followups", tags=["回访管理"])
def create_followup(
    elderly_id: int,
    follow_up_date: date,
    delivery_id: Optional[int] = None,
    overall_satisfaction: Optional[SatisfactionLevel] = None,
    complaints: Optional[str] = None,
    suggestions: Optional[str] = None,
    dietary_feedback: Optional[str] = None,
    followed_by: Optional[str] = None,
    needs_further_action: bool = False,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = FollowUpService.create_follow_up(
        db=db,
        elderly_id=elderly_id,
        follow_up_date=follow_up_date,
        delivery_id=delivery_id,
        overall_satisfaction=overall_satisfaction,
        complaints=complaints,
        suggestions=suggestions,
        dietary_feedback=dietary_feedback,
        followed_by=followed_by,
        needs_further_action=needs_further_action,
        operator=operator
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/v1/followups/{follow_up_date}", tags=["回访管理"])
def get_followups(follow_up_date: date, db: Session = Depends(get_db)):
    return FollowUpService.get_follow_ups_by_date(db, follow_up_date)


@app.put("/api/v1/followups/{follow_up_id}/action", tags=["回访管理"])
def update_followup_action(
    follow_up_id: int,
    action_taken: str,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = FollowUpService.update_follow_up_action(db, follow_up_id, action_taken, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/v1/reports/daily/{report_date}", tags=["报告管理"])
def get_daily_report(report_date: date, db: Session = Depends(get_db)):
    return ReportService.generate_daily_report(db, report_date)


@app.get("/api/v1/reports/delivery-route/{delivery_date}", tags=["报告管理"])
def get_delivery_route_report(
    delivery_date: date,
    meal_type: str = "lunch",
    db: Session = Depends(get_db)
):
    return ReportService.generate_delivery_route_sheet(db, delivery_date, meal_type)


@app.get("/api/v1/reports/conflicts/{report_date}", tags=["报告管理"])
def get_conflict_report(report_date: date, db: Session = Depends(get_db)):
    return ReportService.generate_conflict_report(db, report_date)


@app.get("/api/v1/reports/export/{report_type}/{report_date}", tags=["报告管理"])
def export_report(
    report_type: str,
    report_date: date,
    format: str = "json",
    db: Session = Depends(get_db)
):
    try:
        filepath = ReportService.generate_export_file(db, report_type, report_date, format)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    path = Path(filepath)
    return FileResponse(
        path=path,
        filename=path.name,
        media_type="application/json"
    )


@app.get("/api/v1/history", tags=["操作历史"])
def get_operation_history(
    entity_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return ReportService.get_operation_history(db, entity_type, start_date, end_date, limit)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
