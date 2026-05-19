from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime
import os
import shutil

from app.core.database import get_db
from app.core.config import settings
from app.models.models import MealStatus, ElderStatus
from app.schemas.schemas import (
    Elder, ElderCreate, ElderUpdate, ElderSafe,
    DeliveryRoute, DeliveryRouteCreate, DeliveryRouteUpdate,
    Menu, MenuCreate, MenuUpdate,
    MealDistribution, MealDistributionCreate, MealDistributionReview,
    MealDistributionDelivery, MealDistributionDetail,
    ImportResult, AuditLog
)
from app.services.elder_service import (
    get_elder, get_elders, create_elder, update_elder, delete_elder,
    get_elders_with_dietary_restrictions, elders_to_safe
)
from app.services.route_service import (
    get_route, get_routes, create_route, update_route, delete_route
)
from app.services.menu_service import (
    get_menu, get_menus, create_menu, update_menu, delete_menu
)
from app.services.meal_service import (
    get_meal_distribution, get_meal_distributions, get_meal_distributions_with_details,
    create_meal_distribution, review_meal_distribution, deliver_meal_distribution,
    cancel_meal_distribution, batch_create_meal_distributions, get_daily_statistics
)
from app.services.import_service import (
    import_elders_from_excel, import_routes_from_excel, import_menus_from_excel
)
from app.services.export_service import (
    export_daily_meal_list, export_dietary_report, export_delivery_route_list
)
from app.services.audit_service import get_audit_logs

router = APIRouter()


def get_client_ip(request):
    return request.client.host if request.client else None


@router.get("/elders", response_model=List[ElderSafe], summary="获取老人列表")
def list_elders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ElderStatus] = None,
    route_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    elders = get_elders(db, skip=skip, limit=limit, status=status, route_id=route_id)
    return elders_to_safe(elders)


@router.get("/elders/{elder_id}", response_model=ElderSafe, summary="获取老人详情")
def read_elder(elder_id: int, db: Session = Depends(get_db)):
    elder = get_elder(db, elder_id=elder_id)
    if elder is None:
        raise HTTPException(status_code=404, detail="老人不存在")
    return ElderSafe.model_validate(elder)


@router.post("/elders", response_model=ElderSafe, summary="创建老人")
def create_elder_api(
    elder: ElderCreate,
    db: Session = Depends(get_db)
):
    try:
        db_elder = create_elder(db, elder, operator="api")
        return ElderSafe.model_validate(db_elder)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/elders/{elder_id}", response_model=ElderSafe, summary="更新老人")
def update_elder_api(
    elder_id: int,
    elder: ElderUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_elder = update_elder(db, elder_id, elder, operator="api")
        return ElderSafe.model_validate(db_elder)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/elders/{elder_id}", response_model=ElderSafe, summary="删除老人")
def delete_elder_api(
    elder_id: int,
    db: Session = Depends(get_db)
):
    try:
        db_elder = delete_elder(db, elder_id, operator="api")
        return ElderSafe.model_validate(db_elder)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/elders/dietary/special", response_model=List[ElderSafe], summary="获取有特殊饮食需求的老人")
def list_special_diet_elders(db: Session = Depends(get_db)):
    elders = get_elders_with_dietary_restrictions(db)
    return elders_to_safe(elders)


@router.get("/routes", response_model=List[DeliveryRoute], summary="获取配送路线列表")
def list_routes(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    return get_routes(db, skip=skip, limit=limit, is_active=is_active)


@router.get("/routes/{route_id}", response_model=DeliveryRoute, summary="获取配送路线详情")
def read_route(route_id: int, db: Session = Depends(get_db)):
    route = get_route(db, route_id=route_id)
    if route is None:
        raise HTTPException(status_code=404, detail="路线不存在")
    return route


@router.post("/routes", response_model=DeliveryRoute, summary="创建配送路线")
def create_route_api(
    route: DeliveryRouteCreate,
    db: Session = Depends(get_db)
):
    try:
        return create_route(db, route, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/routes/{route_id}", response_model=DeliveryRoute, summary="更新配送路线")
def update_route_api(
    route_id: int,
    route: DeliveryRouteUpdate,
    db: Session = Depends(get_db)
):
    try:
        return update_route(db, route_id, route, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/routes/{route_id}", response_model=DeliveryRoute, summary="删除配送路线")
def delete_route_api(
    route_id: int,
    db: Session = Depends(get_db)
):
    try:
        return delete_route(db, route_id, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/menus", response_model=List[Menu], summary="获取菜单列表")
def list_menus(
    skip: int = 0,
    limit: int = 100,
    menu_date: Optional[date] = None,
    meal_type: Optional[str] = None,
    route_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return get_menus(db, skip=skip, limit=limit, menu_date=menu_date, meal_type=meal_type, route_id=route_id)


@router.get("/menus/{menu_id}", response_model=Menu, summary="获取菜单详情")
def read_menu(menu_id: int, db: Session = Depends(get_db)):
    menu = get_menu(db, menu_id=menu_id)
    if menu is None:
        raise HTTPException(status_code=404, detail="菜单不存在")
    return menu


@router.post("/menus", response_model=Menu, summary="创建菜单")
def create_menu_api(
    menu: MenuCreate,
    db: Session = Depends(get_db)
):
    try:
        return create_menu(db, menu, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/menus/{menu_id}", response_model=Menu, summary="更新菜单")
def update_menu_api(
    menu_id: int,
    menu: MenuUpdate,
    db: Session = Depends(get_db)
):
    try:
        return update_menu(db, menu_id, menu, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/menus/{menu_id}", summary="删除菜单")
def delete_menu_api(
    menu_id: int,
    db: Session = Depends(get_db)
):
    try:
        delete_menu(db, menu_id, operator="api")
        return {"message": "删除成功"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/meals", response_model=List[MealDistributionDetail], summary="获取配餐列表")
def list_meals(
    skip: int = 0,
    limit: int = 100,
    status: Optional[MealStatus] = None,
    menu_date: Optional[date] = None,
    route_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    meals = get_meal_distributions_with_details(
        db, skip=skip, limit=limit, status=status, menu_date=menu_date, route_id=route_id
    )
    result = []
    for meal in meals:
        detail = MealDistributionDetail.model_validate(meal)
        detail.elder = ElderSafe.model_validate(meal.elder)
        detail.menu = Menu.model_validate(meal.menu)
        result.append(detail)
    return result


@router.get("/meals/{meal_id}", response_model=MealDistribution, summary="获取配餐详情")
def read_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = get_meal_distribution(db, distribution_id=meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="配餐记录不存在")
    return meal


@router.post("/meals", summary="创建配餐记录")
def create_meal_api(
    meal: MealDistributionCreate,
    db: Session = Depends(get_db)
):
    try:
        db_meal, warnings = create_meal_distribution(db, meal, operator="api")
        return {
            "data": MealDistribution.model_validate(db_meal),
            "warnings": warnings
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/meals/batch", summary="批量创建配餐记录")
def batch_create_meals_api(
    menu_id: int,
    route_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    try:
        results = batch_create_meal_distributions(
            db, menu_id=menu_id, route_id=route_id, operator="api"
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/meals/{meal_id}/review", response_model=MealDistribution, summary="复核配餐")
def review_meal_api(
    meal_id: int,
    review: MealDistributionReview,
    db: Session = Depends(get_db)
):
    try:
        return review_meal_distribution(db, meal_id, review, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/meals/{meal_id}/deliver", response_model=MealDistribution, summary="配送配餐")
def deliver_meal_api(
    meal_id: int,
    delivery: MealDistributionDelivery,
    db: Session = Depends(get_db)
):
    try:
        return deliver_meal_distribution(db, meal_id, delivery, operator="api")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/meals/{meal_id}/cancel", response_model=MealDistribution, summary="取消配餐")
def cancel_meal_api(
    meal_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return cancel_meal_distribution(db, meal_id, operator="api", reason=reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/statistics/daily", summary="获取每日统计")
def daily_statistics(
    report_date: date,
    db: Session = Depends(get_db)
):
    return get_daily_statistics(db, report_date)


@router.post("/import/elders", response_model=ImportResult, summary="导入老人数据")
async def import_elders_api(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    upload_dir = os.path.join(settings.DATA_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"elders_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = import_elders_from_excel(db, file_path, operator="api")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/import/routes", response_model=ImportResult, summary="导入配送路线数据")
async def import_routes_api(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    upload_dir = os.path.join(settings.DATA_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"routes_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = import_routes_from_excel(db, file_path, operator="api")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.post("/import/menus", response_model=ImportResult, summary="导入菜单数据")
async def import_menus_api(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    upload_dir = os.path.join(settings.DATA_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, f"menus_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = import_menus_from_excel(db, file_path, operator="api")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@router.get("/export/meals", summary="导出每日配餐清单")
def export_meals_api(
    report_date: date,
    route_id: Optional[int] = None,
    format: str = "xlsx",
    db: Session = Depends(get_db)
):
    try:
        file_path = export_daily_meal_list(db, report_date, route_id=route_id, file_format=format)
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/dietary", summary="导出特殊饮食报告")
def export_dietary_api(
    format: str = "xlsx",
    db: Session = Depends(get_db)
):
    try:
        file_path = export_dietary_report(db, file_format=format)
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/routes", summary="导出配送路线清单")
def export_routes_api(
    format: str = "xlsx",
    db: Session = Depends(get_db)
):
    try:
        file_path = export_delivery_route_list(db, file_format=format)
        filename = os.path.basename(file_path)
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/audit-logs", response_model=List[AuditLog], summary="获取审计日志")
def list_audit_logs(
    skip: int = 0,
    limit: int = 100,
    entity_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return get_audit_logs(db, skip=skip, limit=limit, entity_type=entity_type)
