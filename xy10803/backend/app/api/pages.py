from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from ..api.deps import get_db
from ..services.batch_service import BatchService
from ..services.template_service import TemplateService
from ..services.sandbox_service import SandboxService

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="../frontend/templates")


@router.get("/")
async def index(request: Request, db: Session = Depends(get_db)):
    batches = BatchService.list_batches(db, limit=20)
    templates_list = TemplateService.list_templates(db, is_active=True)
    sandboxes = SandboxService.list_sandboxes(db, is_active=True)
    
    stats = {
        "total_batches": len(batches),
        "completed_batches": len([b for b in batches if b.status == "completed"]),
        "pending_batches": len([b for b in batches if b.status == "pending"]),
        "failed_batches": len([b for b in batches if b.status == "failed"])
    }
    
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "batches": batches,
            "templates": templates_list,
            "sandboxes": sandboxes,
            "stats": stats
        }
    )


@router.get("/batch/{batch_id}")
async def batch_detail(request: Request, batch_id: int, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    report = BatchService.get_batch_report(db, batch_id)
    return templates.TemplateResponse(
        "batch_detail.html",
        {
            "request": request,
            "batch": batch,
            "report": report
        }
    )
