from fastapi import APIRouter

from app.routers.contract import router as contract_router
from app.routers.reduction import router as reduction_router
from app.routers.approval import router as approval_router
from app.routers.import_export import router as io_router

api_router = APIRouter()

api_router.include_router(contract_router)
api_router.include_router(reduction_router)
api_router.include_router(approval_router)
api_router.include_router(io_router)
