from datetime import date, datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import RequestValidationError
from starlette.requests import Request

from .config import settings
from .models import (
    Animal,
    FeedFormula,
    HealthCorrectionRule,
    FeedInventory,
    DailyRation,
    VerificationResult
)
from .enums import (
    Season,
    AnimalStatus,
    AnimalHealth,
    DailyRationStatus
)
from .store import store
from .orchestrator import orchestrator
from .errors import BusinessError


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.API_VERSION,
    description="动物园饲料日配系统 API - 按季节、体重和健康状态自动化日配管理"
)


@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, exc: BusinessError):
    return JSONResponse(
        status_code=400,
        content=exc.to_dict()
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "REQUEST_VALIDATION_ERROR",
                "message": "请求参数验证失败",
                "details": exc.errors(),
                "need_manual_handling": False
            }
        }
    )


class AnimalCreate(BaseModel):
    name: str
    species: str
    age_years: float
    weight_kg: float
    health_status: AnimalHealth = AnimalHealth.HEALTHY
    status: AnimalStatus = AnimalStatus.ACTIVE
    area: str
    last_checkup_date: Optional[date] = None
    notes: Optional[str] = None


class FormulaIngredientInput(BaseModel):
    feed_name: str
    quantity_kg: float
    unit: str = "kg"


class FeedFormulaCreate(BaseModel):
    species: str
    season: Season
    name: str
    base_ratio_per_100kg: float
    ingredients: List[FormulaIngredientInput]
    is_active: bool = True
    description: Optional[str] = None
    source: str = "standard"


class HealthCorrectionCreate(BaseModel):
    health_status: AnimalHealth
    species: Optional[str] = None
    feed_name: Optional[str] = None
    ratio_multiplier: float = 1.0
    add_ingredients: List[FormulaIngredientInput] = []
    remove_feeds: List[str] = []
    priority: int = 0
    description: Optional[str] = None


class InventoryCreate(BaseModel):
    feed_name: str
    current_qty_kg: float
    min_threshold_kg: float
    unit: str = "kg"
    location: str


class RationGenerateRequest(BaseModel):
    animal_id: UUID
    ration_date: date
    created_by: Optional[str] = None


class RationActionResponse(BaseModel):
    success: bool
    ration_id: UUID
    status: DailyRationStatus
    messages: List[str]
    warnings: List[str]
    errors: List[str]


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.API_VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/animals", response_model=List[Animal])
def list_animals():
    return store.get_all_animals()


@app.post("/animals", response_model=Animal, status_code=201)
def create_animal(data: AnimalCreate):
    animal = Animal(**data.dict())
    store.save_animal(animal)
    return animal


@app.get("/animals/{animal_id}", response_model=Animal)
def get_animal(animal_id: UUID):
    animal = store.get_animal(animal_id)
    if animal is None:
        raise HTTPException(status_code=404, detail="动物档案不存在")
    return animal


@app.get("/formulas", response_model=List[FeedFormula])
def list_formulas():
    return store.get_all_formulas()


@app.post("/formulas", response_model=FeedFormula, status_code=201)
def create_formula(data: FeedFormulaCreate):
    formula = FeedFormula(**data.dict())
    store.save_formula(formula)
    return formula


@app.get("/inventories", response_model=List[FeedInventory])
def list_inventories():
    return store.get_all_inventories()


@app.post("/inventories", response_model=FeedInventory, status_code=201)
def create_inventory(data: InventoryCreate):
    inventory = FeedInventory(**data.dict())
    store.save_inventory(inventory)
    return inventory


@app.post("/correction-rules", response_model=HealthCorrectionRule, status_code=201)
def create_correction_rule(data: HealthCorrectionCreate):
    rule = HealthCorrectionRule(**data.dict())
    store.save_correction_rule(rule)
    return rule


@app.post("/rations/generate", response_model=DailyRation, status_code=201)
def generate_ration(data: RationGenerateRequest):
    return orchestrator.generate_ration(
        animal_id=data.animal_id,
        ration_date=data.ration_date,
        created_by=data.created_by
    )


@app.post("/rations/{ration_id}/validate")
def validate_ration(ration_id: UUID):
    ration, verifications = orchestrator.validate_ration(ration_id)
    return {
        "success": ration.status == DailyRationStatus.PENDING,
        "ration_id": ration.id,
        "status": ration.status.value,
        "animal_name": ration.animal_name,
        "ration_date": ration.ration_date.isoformat(),
        "messages": ration.verification_messages,
        "warnings": ration.warnings,
        "errors": ration.errors,
        "verifications": [v.dict() for v in verifications]
    }


@app.post("/rations/{ration_id}/confirm")
def confirm_ration(ration_id: UUID):
    ration = orchestrator.confirm_ration(ration_id)
    return {
        "success": True,
        "ration_id": ration.id,
        "status": ration.status.value,
        "message": f"日配计划已确认，状态: {ration.status.value}"
    }


@app.post("/rations/{ration_id}/execute")
def execute_ration(ration_id: UUID):
    ration = orchestrator.execute_ration(ration_id)
    return {
        "success": True,
        "ration_id": ration.id,
        "status": ration.status.value,
        "executed_at": ration.executed_at.isoformat() if ration.executed_at else None,
        "items": [
            {
                "feed_name": item.feed_name,
                "actual_quantity_kg": item.actual_quantity_kg
            }
            for item in ration.items
        ]
    }


@app.post("/rations/{ration_id}/retry")
def retry_ration(ration_id: UUID):
    ration = orchestrator.retry_failed_ration(ration_id)
    return {
        "success": True,
        "ration_id": ration.id,
        "status": ration.status.value,
        "message": "已重新生成日配计划",
        "messages": ration.verification_messages,
        "warnings": ration.warnings,
        "errors": ration.errors
    }


@app.get("/rations/{ration_id}", response_model=DailyRation)
def get_ration(ration_id: UUID):
    ration = store.get_ration(ration_id)
    if ration is None:
        raise HTTPException(status_code=404, detail="日配计划不存在")
    return ration


@app.get("/rations/date/{ration_date}", response_model=List[DailyRation])
def list_ratons_by_date(ration_date: date):
    return store.get_ratons_by_date(ration_date)


@app.get("/rations/{ration_id}/verifications")
def get_ration_verifications(ration_id: UUID):
    verifications = orchestrator.get_all_verifications(ration_id)
    return {
        "ration_id": ration_id,
        "verifications": [v.dict() for v in verifications],
        "summary": {
            "total": len(verifications),
            "passed": sum(1 for v in verifications if v.success),
            "failed": sum(1 for v in verifications if not v.success)
        }
    }


def initialize_sample_data():
    from uuid import uuid4

    panda_formula_spring = FeedFormula(
        id=uuid4(),
        species="大熊猫",
        season=Season.SPRING,
        name="大熊猫春季配方",
        base_ratio_per_100kg=0.05,
        ingredients=[
            FormulaIngredientInput(feed_name="新鲜竹笋", quantity_kg=40).dict(),
            FormulaIngredientInput(feed_name="竹子", quantity_kg=15).dict(),
            FormulaIngredientInput(feed_name="苹果", quantity_kg=2).dict(),
        ],
        is_active=True,
        description="春季竹笋丰富期配方",
        source="动物营养学标准"
    )

    panda_formula_summer = FeedFormula(
        id=uuid4(),
        species="大熊猫",
        season=Season.SUMMER,
        name="大熊猫夏季配方",
        base_ratio_per_100kg=0.05,
        ingredients=[
            FormulaIngredientInput(feed_name="竹子", quantity_kg=35).dict(),
            FormulaIngredientInput(feed_name="胡萝卜", quantity_kg=5).dict(),
            FormulaIngredientInput(feed_name="窝头", quantity_kg=3).dict(),
        ],
        is_active=True,
        description="夏季高温配方",
        source="动物营养学标准"
    )

    lion_formula = FeedFormula(
        id=uuid4(),
        species="狮子",
        season=Season.SPRING,
        name="狮子春季配方",
        base_ratio_per_100kg=0.04,
        ingredients=[
            FormulaIngredientInput(feed_name="牛肉", quantity_kg=8).dict(),
            FormulaIngredientInput(feed_name="鸡肉", quantity_kg=4).dict(),
            FormulaIngredientInput(feed_name="钙片", quantity_kg=0.2).dict(),
        ],
        is_active=True,
        description="狮子基础配方",
        source="动物营养学标准"
    )

    store.save_formula(panda_formula_spring)
    store.save_formula(panda_formula_summer)
    store.save_formula(lion_formula)

    bamboo_inventory = FeedInventory(
        id=uuid4(),
        feed_name="竹子",
        current_qty_kg=200.0,
        min_threshold_kg=50.0,
        location="储藏室A"
    )
    bamboo_shoot_inventory = FeedInventory(
        id=uuid4(),
        feed_name="新鲜竹笋",
        current_qty_kg=100.0,
        min_threshold_kg=20.0,
        location="保鲜室"
    )
    apple_inventory = FeedInventory(
        id=uuid4(),
        feed_name="苹果",
        current_qty_kg=50.0,
        min_threshold_kg=10.0,
        location="果蔬冷藏"
    )
    carrot_inventory = FeedInventory(
        id=uuid4(),
        feed_name="胡萝卜",
        current_qty_kg=30.0,
        min_threshold_kg=10.0,
        location="果蔬冷藏"
    )
    beef_inventory = FeedInventory(
        id=uuid4(),
        feed_name="牛肉",
        current_qty_kg=80.0,
        min_threshold_kg=20.0,
        location="肉类冷藏"
    )
    chicken_inventory = FeedInventory(
        id=uuid4(),
        feed_name="鸡肉",
        current_qty_kg=40.0,
        min_threshold_kg=10.0,
        location="肉类冷藏"
    )
    calcium_inventory = FeedInventory(
        id=uuid4(),
        feed_name="钙片",
        current_qty_kg=10.0,
        min_threshold_kg=5.0,
        location="药品柜"
    )

    store.save_inventory(bamboo_inventory)
    store.save_inventory(bamboo_shoot_inventory)
    store.save_inventory(apple_inventory)
    store.save_inventory(carrot_inventory)
    store.save_inventory(beef_inventory)
    store.save_inventory(chicken_inventory)
    store.save_inventory(calcium_inventory)

    mild_correction = HealthCorrectionRule(
        id=uuid4(),
        health_status=AnimalHealth.MILD,
        ratio_multiplier=0.9,
        description="轻度不适：减少饲料10%"
    )
    moderate_correction = HealthCorrectionRule(
        id=uuid4(),
        health_status=AnimalHealth.MODERATE,
        ratio_multiplier=0.75,
        add_ingredients=[
            FormulaIngredientInput(feed_name="营养补充剂", quantity_kg=0.5).dict()
        ],
        description="中度不适：减少饲料25%，添加营养补充剂",
        priority=1
    )

    store.save_correction_rule(mild_correction)
    store.save_correction_rule(moderate_correction)

    panda1 = Animal(
        id=uuid4(),
        name="团团",
        species="大熊猫",
        age_years=8,
        weight_kg=120,
        health_status=AnimalHealth.HEALTHY,
        status=AnimalStatus.ACTIVE,
        area="熊猫馆A区",
        last_checkup_date=date(2026, 3, 1),
        notes="健康状态良好"
    )

    lion1 = Animal(
        id=uuid4(),
        name="辛巴",
        species="狮子",
        age_years=5,
        weight_kg=180,
        health_status=AnimalHealth.HEALTHY,
        status=AnimalStatus.ACTIVE,
        area="猛兽区",
        last_checkup_date=date(2026, 4, 15),
        notes="状态良好"
    )

    store.save_animal(panda1)
    store.save_animal(lion1)
