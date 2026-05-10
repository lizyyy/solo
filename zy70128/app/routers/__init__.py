from app.routers.race import router as race_router
from app.routers.result import router as result_router
from app.routers.chip import router as chip_router
from app.routers.appeal import router as appeal_router
from app.routers.review import router as review_router
from app.routers.exception import router as exception_router
from app.routers.recalculation import router as recalculation_router
from app.routers.export import router as export_router
from app.routers.task import router as task_router

__all__ = [
    "race_router",
    "result_router",
    "chip_router",
    "appeal_router",
    "review_router",
    "exception_router",
    "recalculation_router",
    "export_router",
    "task_router",
]
