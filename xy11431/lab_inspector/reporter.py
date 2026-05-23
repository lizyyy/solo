from collections import defaultdict
from datetime import datetime
from .database import get_session, ConsumableRecord, ImportBatch


def generate_summary_report(start_date=None, end_date=None, department=None):
    session = get_session()

    try:
        query = session.query(ConsumableRecord).filter(ConsumableRecord.is_valid == True)

        if start_date:
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(ConsumableRecord.record_date >= start_date)

        if end_date:
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(ConsumableRecord.record_date <= end_date)

        if department:
            query = query.filter(ConsumableRecord.department.like(f"%{department}%"))

        records = query.all()

        total_quantity = sum(r.quantity for r in records)
        total_amount = sum(r.total_price or (r.unit_price or 0) * r.quantity for r in records)

        by_source = defaultdict(lambda: {"count": 0, "quantity": 0, "amount": 0})
        by_department = defaultdict(lambda: {"count": 0, "quantity": 0, "amount": 0})
        by_material = defaultdict(lambda: {"count": 0, "quantity": 0, "amount": 0, "name": ""})
        by_research_group = defaultdict(lambda: {"count": 0, "quantity": 0, "amount": 0})

        for r in records:
            amount = r.total_price or (r.unit_price or 0) * r.quantity

            by_source[r.source_type]["count"] += 1
            by_source[r.source_type]["quantity"] += r.quantity
            by_source[r.source_type]["amount"] += amount

            if r.department:
                by_department[r.department]["count"] += 1
                by_department[r.department]["quantity"] += r.quantity
                by_department[r.department]["amount"] += amount

            if r.research_group:
                by_research_group[r.research_group]["count"] += 1
                by_research_group[r.research_group]["quantity"] += r.quantity
                by_research_group[r.research_group]["amount"] += amount

            key = r.material_code or r.material_name
            by_material[key]["count"] += 1
            by_material[key]["quantity"] += r.quantity
            by_material[key]["amount"] += amount
            by_material[key]["name"] = r.material_name

        top_materials = sorted(
            by_material.items(), key=lambda x: x[1]["amount"], reverse=True
        )[:10]

        report = {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "filters": {
                "start_date": start_date.strftime("%Y-%m-%d") if start_date else None,
                "end_date": end_date.strftime("%Y-%m-%d") if end_date else None,
                "department": department,
            },
            "summary": {
                "total_records": len(records),
                "total_quantity": total_quantity,
                "total_amount": round(total_amount, 2),
            },
            "by_source": dict(by_source),
            "by_department": dict(by_department),
            "by_research_group": dict(by_research_group),
            "top_materials": [
                {
                    "code": code,
                    "name": data["name"],
                    "count": data["count"],
                    "quantity": data["quantity"],
                    "amount": round(data["amount"], 2),
                }
                for code, data in top_materials
            ],
            "records": [
                {
                    "id": r.id,
                    "source_type": r.source_type,
                    "original_row": r.original_row,
                    "batch_id": r.batch_id,
                    "record_date": r.record_date.strftime("%Y-%m-%d") if r.record_date else None,
                    "material_code": r.material_code,
                    "material_name": r.material_name,
                    "specification": r.specification,
                    "unit": r.unit,
                    "quantity": r.quantity,
                    "unit_price": r.unit_price,
                    "total_price": r.total_price,
                    "department": r.department,
                    "research_group": r.research_group,
                    "applicant": r.applicant,
                    "purpose": r.purpose,
                    "remark": r.remark,
                }
                for r in records
            ],
        }

        return report

    finally:
        session.close()


def get_record_detail(record_id):
    session = get_session()

    try:
        record = session.query(ConsumableRecord).filter(ConsumableRecord.id == record_id).first()
        if not record:
            return None

        corrections = [
            {
                "field": c.field_name,
                "old_value": c.old_value,
                "new_value": c.new_value,
                "reason": c.reason,
                "corrected_by": c.corrected_by,
                "corrected_at": c.corrected_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
            for c in record.corrections
        ]

        audit_logs = [
            {
                "action": a.action,
                "field": a.field_name,
                "old_value": a.old_value,
                "new_value": a.new_value,
                "operator": a.operator,
                "operated_at": a.operated_at.strftime("%Y-%m-%d %H:%M:%S"),
                "note": a.note,
            }
            for a in record.audit_logs
        ]

        return {
            "id": record.id,
            "batch_id": record.batch_id,
            "source_type": record.source_type,
            "original_row": record.original_row,
            "record_date": record.record_date.strftime("%Y-%m-%d") if record.record_date else None,
            "material_code": record.material_code,
            "material_name": record.material_name,
            "specification": record.specification,
            "unit": record.unit,
            "quantity": record.quantity,
            "unit_price": record.unit_price,
            "total_price": record.total_price,
            "department": record.department,
            "research_group": record.research_group,
            "applicant": record.applicant,
            "receiver": record.receiver,
            "handler": record.handler,
            "purpose": record.purpose,
            "location": record.location,
            "status": record.status,
            "supplier": record.supplier,
            "order_no": record.order_no,
            "receipt_no": record.receipt_no,
            "remark": record.remark,
            "is_valid": record.is_valid,
            "created_at": record.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "updated_at": record.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
            "corrections": corrections,
            "audit_logs": audit_logs,
        }

    finally:
        session.close()
