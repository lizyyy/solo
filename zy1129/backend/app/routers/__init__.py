from app.routers.members import router as members
from app.routers.policies import router as policies
from app.routers.coverages import router as coverages
from app.routers.incidents import router as incidents
from app.routers.claims import router as claims
from app.routers.analysis import router as analysis
from app.routers.import_router import router as import_router
from app.routers.export_router import router as export_router
from app.routers.dashboard import router as dashboard

__all__ = [
    "members",
    "policies",
    "coverages",
    "incidents",
    "claims",
    "analysis",
    "import_router",
    "export_router",
    "dashboard",
]
