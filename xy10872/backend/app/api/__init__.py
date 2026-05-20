from .reset_requests import router as reset_requests_router
from .lab_spaces import router as lab_spaces_router
from .snapshots import router as snapshots_router
from .logs import router as logs_router

router = reset_requests_router
lab_spaces = lab_spaces_router
snapshots = snapshots_router
logs = logs_router

__all__ = ["router", "lab_spaces", "snapshots", "logs"]