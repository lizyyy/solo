from fastapi import APIRouter
from app.api.equipment import router as equipment_router
from app.api.energy import router as energy_router
from app.api.export import router as export_router
from app.api.tasks import router as tasks_router

api_router = APIRouter()

api_router.include_router(equipment_router)
api_router.include_router(energy_router)
api_router.include_router(export_router)
api_router.include_router(tasks_router)

__all__ = ["api_router"]
