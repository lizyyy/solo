from app.routers.letters_of_credit import router as lc_router
from app.routers.documents import router as doc_router
from app.routers.discrepancies import router as disc_router
from app.routers.clauses import router as clause_router
from app.routers.reports import router as report_router

__all__ = [
    "lc_router",
    "doc_router",
    "disc_router",
    "clause_router",
    "report_router",
]
