import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from .models import (
    Commission,
    CommissionStatus,
    ConfirmationRecord,
    PaymentNode,
    RevisionRecord,
    SketchVersion,
)
from .storage import StorageManager


def create_commission(
    storage: StorageManager,
    title: str,
    client_name: str,
    description: str = "",
    max_revisions: int = 3,
) -> Commission:
    commission_id = str(uuid.uuid4())[:8]
    commission = Commission(
        id=commission_id,
        title=title,
        client_name=client_name,
        created_at=datetime.now(),
        description=description,
        max_revisions=max_revisions,
    )
    storage.save_commission(commission)
    return commission


def list_commissions(
    storage: StorageManager,
    status_filter: Optional[str] = None,
    client_filter: Optional[str] = None,
) -> List[Commission]:
    commissions = storage.load_all_commissions()
    
    if status_filter:
        commissions = [
            c for c in commissions
            if c.status.value.lower() == status_filter.lower()
        ]
    
    if client_filter:
        commissions = [
            c for c in commissions
            if client_filter.lower() in c.client_name.lower()
        ]
    
    return commissions


def add_sketch(
    storage: StorageManager,
    commission_id: str,
    file_path: str,
    description: str = "",
) -> Commission:
    commission = storage.load_commission(commission_id)
    if not commission:
        raise ValueError(f"委托单不存在: {commission_id}")
    
    version = len(commission.sketches) + 1
    sketch = SketchVersion(
        version=version,
        file_path=file_path,
        created_at=datetime.now(),
        description=description,
    )
    commission.sketches.append(sketch)
    
    if commission.status == CommissionStatus.DRAFT:
        commission.status = CommissionStatus.SKETCH
    
    storage.save_commission(commission)
    return commission


def add_revision(
    storage: StorageManager,
    commission_id: str,
    feedback: str,
    sketch_version: Optional[int] = None,
) -> Tuple[RevisionRecord, Commission]:
    commission = storage.load_commission(commission_id)
    if not commission:
        raise ValueError(f"委托单不存在: {commission_id}")
    
    if sketch_version is None:
        if not commission.sketches:
            raise ValueError("请先添加草图版本")
        sketch_version = commission.current_sketch_version.version
    
    sketch = next((s for s in commission.sketches if s.version == sketch_version), None)
    if not sketch:
        raise ValueError(f"草图版本 v{sketch_version} 不存在")
    
    revision = RevisionRecord(
        version=len(sketch.revisions) + 1,
        feedback=feedback,
        date=datetime.now(),
    )
    sketch.revisions.append(revision)
    commission.status = CommissionStatus.REVISING
    
    storage.save_commission(commission)
    return revision, commission


def add_payment(
    storage: StorageManager,
    commission_id: str,
    node_type: str,
    amount: float,
    paid: bool = False,
    due_date: Optional[datetime] = None,
) -> PaymentNode:
    commission = storage.load_commission(commission_id)
    if not commission:
        raise ValueError(f"委托单不存在: {commission_id}")
    
    payment = PaymentNode(
        node_type=node_type,
        amount=amount,
        due_date=due_date,
        paid=paid,
        paid_at=datetime.now() if paid else None,
    )
    commission.payments.append(payment)
    storage.save_commission(commission)
    return payment


def add_confirmation(
    storage: StorageManager,
    commission_id: str,
    stage: str,
    screenshot_path: Optional[Path] = None,
) -> ConfirmationRecord:
    commission = storage.load_commission(commission_id)
    if not commission:
        raise ValueError(f"委托单不存在: {commission_id}")
    
    stored_screenshot_path = None
    if screenshot_path and screenshot_path.exists():
        ext = screenshot_path.suffix
        dest_path = storage.get_screenshot_path(commission_id, stage, ext)
        shutil.copy2(screenshot_path, dest_path)
        stored_screenshot_path = str(dest_path)
    
    confirmation = ConfirmationRecord(
        stage=stage,
        confirmed=True,
        confirmed_at=datetime.now(),
        screenshot_path=stored_screenshot_path,
    )
    commission.confirmations.append(confirmation)
    
    if commission.status != CommissionStatus.COMPLETED:
        commission.status = CommissionStatus.WAITING_CONFIRM
    
    storage.save_commission(commission)
    return confirmation


def update_status(
    storage: StorageManager,
    commission_id: str,
    new_status: str,
) -> Commission:
    commission = storage.load_commission(commission_id)
    if not commission:
        raise ValueError(f"委托单不存在: {commission_id}")
    
    try:
        status_enum = CommissionStatus(new_status.lower())
    except ValueError:
        valid_statuses = [s.value for s in CommissionStatus]
        raise ValueError(f"无效状态: {new_status}。有效状态: {', '.join(valid_statuses)}")
    
    commission.status = status_enum
    storage.save_commission(commission)
    return commission


def get_alerts(storage: StorageManager) -> dict:
    commissions = storage.load_all_commissions()
    
    over_revision = []
    final_unpaid = []
    missing_screenshots = []
    
    for c in commissions:
        if c.is_over_revision_limit:
            over_revision.append({
                "id": c.id,
                "title": c.title,
                "client": c.client_name,
                "total_revisions": c.total_revisions,
                "max_revisions": c.max_revisions,
                "over_by": c.total_revisions - c.max_revisions,
            })
        
        if c.status == CommissionStatus.COMPLETED and not c.has_final_paid:
            final_unpaid.append({
                "id": c.id,
                "title": c.title,
                "client": c.client_name,
                "final_amount": next(
                    (p.amount for p in c.payments if p.node_type == "final"),
                    sum(p.amount for p in c.payments if not p.paid) or "未知"
                ),
            })
        
        if c.has_missing_screenshots:
            missing_screenshots.append({
                "id": c.id,
                "title": c.title,
                "client": c.client_name,
                "missing_stages": c.has_missing_screenshots,
            })
    
    return {
        "over_revision": over_revision,
        "final_unpaid": final_unpaid,
        "missing_screenshots": missing_screenshots,
    }


def export_report(
    storage: StorageManager,
    commission_id: Optional[str] = None,
    format: str = "markdown",
) -> Path:
    from .exporter import Exporter
    
    if commission_id:
        commission = storage.load_commission(commission_id)
        if not commission:
            raise ValueError(f"委托单不存在: {commission_id}")
        commissions = [commission]
    else:
        commissions = storage.load_all_commissions()
    
    exporter = Exporter(storage)
    
    if format == "json":
        return exporter.export_json(commissions, commission_id)
    elif format == "markdown":
        return exporter.export_markdown(commissions, commission_id)
    elif format == "html":
        return exporter.export_html(commissions, commission_id)
    else:
        raise ValueError(f"不支持的导出格式: {format}")
