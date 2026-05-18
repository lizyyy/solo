from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import (
    Farmer, Plot, Project, GPSRecord, Confirmation,
    Settlement, SettlementItem, ExceptionRecord, SettlementStatus
)
from schemas import (
    SettlementCreate, ManualCorrectionRequest, ExceptionHandleRequest
)
from datetime import datetime
import uuid
import json


class SettlementValidationError(Exception):
    def __init__(self, settlement_id: int, message: str, exception_type: str):
        self.settlement_id = settlement_id
        self.message = message
        self.exception_type = exception_type
        super().__init__(message)


def generate_settlement_no():
    return f"STL{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:6].upper()}"


def detect_duplicate_plots(gps_records, threshold=0.95):
    duplicates = []
    n = len(gps_records)
    for i in range(n):
        for j in range(i + 1, n):
            gps1 = gps_records[i]
            gps2 = gps_records[j]
            if gps1.plot_id == gps2.plot_id and gps1.project_id == gps2.project_id:
                area1 = gps1.gps_area
                area2 = gps2.gps_area
                min_area = min(area1, area2)
                max_area = max(area1, area2)
                if min_area / max_area >= threshold:
                    duplicates.append((gps1.id, gps2.id))
    return duplicates


def calculate_area_diff(gps_area, confirmed_area):
    diff = confirmed_area - gps_area if confirmed_area else 0
    ratio = abs(diff / gps_area) if gps_area > 0 else 0
    return diff, ratio


def get_final_area(gps_area, confirmed_area, standard_area=None, area_diff_threshold=0.1):
    if confirmed_area is None:
        return gps_area
    
    diff, ratio = calculate_area_diff(gps_area, confirmed_area)
    
    if ratio <= area_diff_threshold:
        return confirmed_area
    else:
        return None


def create_settlement_service(db: Session, settlement_data: SettlementCreate):
    farmer = db.query(Farmer).filter(Farmer.id == settlement_data.farmer_id).first()
    if not farmer:
        raise ValueError(f"Farmer {settlement_data.farmer_id} not found")

    settlement_no = generate_settlement_no()
    
    settlement = Settlement(
        settlement_no=settlement_no,
        farmer_id=settlement_data.farmer_id,
        status=SettlementStatus.DRAFT,
        notes=settlement_data.notes
    )
    db.add(settlement)
    db.flush()

    gps_query = db.query(GPSRecord).filter(
        Plot.farmer_id == settlement_data.farmer_id,
        GPSRecord.plot_id == Plot.id
    )
    
    if settlement_data.gps_batch_no:
        gps_query = gps_query.filter(GPSRecord.batch_no == settlement_data.gps_batch_no)
    
    gps_records = gps_query.all()

    if not gps_records:
        settlement.status = SettlementStatus.CONFLICT
        exception = ExceptionRecord(
            settlement_id=settlement.id,
            exception_type="NO_GPS_DATA",
            original_input=json.dumps(settlement_data.dict(), ensure_ascii=False),
            handling_notes="No GPS records found for this farmer",
            status="pending"
        )
        db.add(exception)
        db.commit()
        db.refresh(settlement)
        return settlement

    confirmation_query = db.query(Confirmation).filter(
        Confirmation.farmer_id == settlement_data.farmer_id
    )
    
    if settlement_data.confirmation_batch_no:
        confirmation_query = confirmation_query.filter(
            Confirmation.batch_no == settlement_data.confirmation_batch_no
        )
    
    confirmations = confirmation_query.all()
    confirmation_map = {(c.plot_id, c.project_id): c for c in confirmations}

    duplicates = detect_duplicate_plots(gps_records)
    duplicate_set = set()
    for dup1, dup2 in duplicates:
        duplicate_set.add(dup2)

    has_duplicates = len(duplicates) > 0
    has_no_confirmations = len(confirmations) == 0

    total_gps_area = 0
    total_confirmed_area = 0
    total_final_area = 0
    total_amount = 0
    has_area_conflict = False

    for gps_record in gps_records:
        if gps_record.id in duplicate_set:
            continue

        project = db.query(Project).filter(Project.id == gps_record.project_id).first()
        if not project:
            continue

        key = (gps_record.plot_id, gps_record.project_id)
        confirmation = confirmation_map.get(key)
        confirmed_area = confirmation.confirmed_area if confirmation else None

        final_area = get_final_area(gps_record.gps_area, confirmed_area)
        
        if final_area is None:
            has_area_conflict = True
            final_area = gps_record.gps_area

        area_diff, area_diff_ratio = calculate_area_diff(gps_record.gps_area, confirmed_area)
        unit_price = project.unit_price
        amount = final_area * unit_price

        is_duplicate = False
        duplicate_with = None
        for dup1, dup2 in duplicates:
            if gps_record.id == dup1:
                is_duplicate = True
                duplicate_with = dup2
                break
            elif gps_record.id == dup2:
                continue

        settlement_item = SettlementItem(
            settlement_id=settlement.id,
            plot_id=gps_record.plot_id,
            project_id=gps_record.project_id,
            gps_record_id=gps_record.id,
            gps_area=gps_record.gps_area,
            confirmed_area=confirmed_area,
            final_area=final_area,
            unit_price=unit_price,
            amount=amount,
            is_duplicate=is_duplicate,
            duplicate_with=duplicate_with,
            area_diff=area_diff,
            area_diff_ratio=area_diff_ratio
        )
        db.add(settlement_item)

        total_gps_area += gps_record.gps_area
        if confirmed_area:
            total_confirmed_area += confirmed_area
        total_final_area += final_area
        total_amount += amount

    settlement.total_gps_area = total_gps_area
    settlement.total_confirmed_area = total_confirmed_area
    settlement.total_final_area = total_final_area
    settlement.total_amount = total_amount

    if has_area_conflict:
        settlement.status = SettlementStatus.CONFLICT
        exception = ExceptionRecord(
            settlement_id=settlement.id,
            exception_type="AREA_CONFLICT",
            original_input=json.dumps(settlement_data.dict(), ensure_ascii=False),
            status="pending"
        )
        db.add(exception)

    if has_duplicates:
        settlement.status = SettlementStatus.CONFLICT
        exception = ExceptionRecord(
            settlement_id=settlement.id,
            exception_type="DUPLICATE_PLOT",
            original_input=json.dumps(settlement_data.dict(), ensure_ascii=False),
            handling_notes=f"Found {len(duplicates)} duplicate plot records",
            status="pending"
        )
        db.add(exception)

    if has_no_confirmations:
        settlement.status = SettlementStatus.CONFLICT
        exception = ExceptionRecord(
            settlement_id=settlement.id,
            exception_type="NO_CONFIRMATION",
            original_input=json.dumps(settlement_data.dict(), ensure_ascii=False),
            handling_notes="No confirmation records found for this farmer",
            status="pending"
        )
        db.add(exception)

    db.commit()
    db.refresh(settlement)
    return settlement


def get_settlement_service(db: Session, settlement_id: int):
    return db.query(Settlement).filter(Settlement.id == settlement_id).first()


def list_settlements_service(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(Settlement)
    if status:
        query = query.filter(Settlement.status == status)
    total = query.count()
    settlements = query.offset(skip).limit(limit).all()
    return {"total": total, "items": settlements}


def update_settlement_status_service(db: Session, settlement_id: int, status: SettlementStatus, processed_by: str = None, notes: str = None):
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not settlement:
        return None
    
    if settlement.status == SettlementStatus.CANCELLED or settlement.status == SettlementStatus.SETTLED:
        raise ValueError("Cannot update status of a cancelled or settled settlement")

    settlement.status = status
    if processed_by:
        settlement.processed_by = processed_by
    if notes:
        settlement.notes = (settlement.notes or "") + f"\n[{datetime.now()}] {notes}"
    
    if status in [SettlementStatus.PROCESSING, SettlementStatus.CONFIRMED, SettlementStatus.SETTLED]:
        settlement.processed_at = datetime.now()
    
    db.commit()
    db.refresh(settlement)
    return settlement


def manual_correction_service(db: Session, request: ManualCorrectionRequest):
    settlement = db.query(Settlement).filter(Settlement.id == request.settlement_id).first()
    if not settlement:
        return None

    if settlement.status not in [SettlementStatus.CONFLICT, SettlementStatus.DRAFT, SettlementStatus.PROCESSING]:
        raise ValueError("Only draft, processing, or conflict settlements can be manually corrected")

    correction_map = {c.settlement_item_id: c for c in request.corrections}

    total_final_area = 0
    total_amount = 0
    total_gps_area = 0
    total_confirmed_area = 0

    for item in settlement.items:
        if item.id in correction_map:
            correction = correction_map[item.id]
            item.final_area = correction.final_area
            item.amount = correction.final_area * item.unit_price
            if correction.notes:
                item.notes = correction.notes

        total_final_area += item.final_area
        total_amount += item.amount
        total_gps_area += item.gps_area
        if item.confirmed_area:
            total_confirmed_area += item.confirmed_area

    settlement.total_final_area = total_final_area
    settlement.total_amount = total_amount
    settlement.total_gps_area = total_gps_area
    settlement.total_confirmed_area = total_confirmed_area
    settlement.processed_by = request.processed_by
    settlement.processed_at = datetime.now()
    settlement.status = SettlementStatus.CONFIRMED
    
    if request.notes:
        settlement.notes = (settlement.notes or "") + f"\n[{datetime.now()}] Manual correction: {request.notes}"

    exception = db.query(ExceptionRecord).filter(
        ExceptionRecord.settlement_id == settlement.id,
        ExceptionRecord.status == "pending"
    ).first()
    
    if exception:
        exception.status = "resolved"
        exception.handled_by = request.processed_by
        exception.handling_result = "Manual correction applied"
        exception.handled_at = datetime.now()

    db.commit()
    db.refresh(settlement)
    return settlement


def cancel_settlement_service(db: Session, settlement_id: int, processed_by: str, reason: str):
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not settlement:
        return None

    if settlement.status == SettlementStatus.SETTLED:
        raise ValueError("Cannot cancel a settled settlement")

    settlement.status = SettlementStatus.CANCELLED
    settlement.processed_by = processed_by
    settlement.processed_at = datetime.now()
    settlement.notes = (settlement.notes or "") + f"\n[{datetime.now()}] Cancelled: {reason}"

    for exception in settlement.exception_records:
        if exception.status == "pending":
            exception.status = "cancelled"
            exception.handled_by = processed_by
            exception.handling_result = "Settlement cancelled"
            exception.handled_at = datetime.now()

    db.commit()
    db.refresh(settlement)
    return settlement


def handle_exception_service(db: Session, request: ExceptionHandleRequest):
    exception = db.query(ExceptionRecord).filter(ExceptionRecord.id == request.exception_record_id).first()
    if not exception:
        return None

    exception.handled_by = request.handled_by
    exception.handling_result = request.handling_result
    exception.handling_notes = request.handling_notes
    exception.handled_at = datetime.now()
    exception.status = "resolved"

    db.commit()
    db.refresh(exception)
    return exception


def export_settlement_service(db: Session, settlement_id: int):
    settlement = db.query(Settlement).filter(Settlement.id == settlement_id).first()
    if not settlement:
        return None

    result = {
        "settlement_no": settlement.settlement_no,
        "farmer": {
            "id": settlement.farmer.id,
            "name": settlement.farmer.name,
            "phone": settlement.farmer.phone,
            "village": settlement.farmer.village
        },
        "status": settlement.status,
        "total_gps_area": settlement.total_gps_area,
        "total_confirmed_area": settlement.total_confirmed_area,
        "total_final_area": settlement.total_final_area,
        "total_amount": settlement.total_amount,
        "items": [],
        "exceptions": []
    }

    for item in settlement.items:
        result["items"].append({
            "plot_code": item.plot.plot_code,
            "plot_name": item.plot.plot_name,
            "project_name": item.project.project_name,
            "gps_area": item.gps_area,
            "confirmed_area": item.confirmed_area,
            "final_area": item.final_area,
            "unit_price": item.unit_price,
            "amount": item.amount,
            "is_duplicate": item.is_duplicate,
            "area_diff": item.area_diff,
            "area_diff_ratio": item.area_diff_ratio,
            "notes": item.notes
        })

    for exc in settlement.exception_records:
        result["exceptions"].append({
            "exception_type": exc.exception_type,
            "original_input": exc.original_input,
            "handled_by": exc.handled_by,
            "handling_result": exc.handling_result,
            "handling_notes": exc.handling_notes,
            "status": exc.status,
            "created_at": exc.created_at,
            "handled_at": exc.handled_at
        })

    return result
