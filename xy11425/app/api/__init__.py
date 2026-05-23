from .batches import router as batches_router
from .materials import router as materials_router
from .visitors import router as visitors_router
from .tasks import router as tasks_router
from .reports import router as reports_router

__all__ = [
    "batches_router",
    "materials_router",
    "visitors_router",
    "tasks_router",
    "reports_router",
]
