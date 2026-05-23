from fastapi import APIRouter
from app.api.endpoints import router as grievance_router

api_router = APIRouter()

api_router.include_router(
    grievance_router,
    prefix="/grievance",
    tags=["申诉管理"]
)
