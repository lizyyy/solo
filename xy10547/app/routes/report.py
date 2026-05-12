from flask import Blueprint, request, jsonify
from app import db
from app.models import (
    MedicationPlan, Prescription, Resident, Nurse, ShiftHandover,
    MedicationInventory, InventoryDeduction, ExceptionRecord,
    ExceptionType, ExceptionStatus, DoseStatus, ShiftStatus,
    HandoverChecklist, MedicationConfirmation, MissedDose
)
from app.utils import success_response, error_response, parse_date
from datetime import datetime, timedelta
from collections import defaultdict

bp = Blueprint('report', __name__)


@bp.route('/calendar', methods=['GET'])
def get_medication_calendar():
    resident_id = request.args.get('resident_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    today = datetime.utcnow().date()
    if not start_date:
        start = today - timedelta(days=3)
    else:
        start = parse_date(start_date) or today
    
    if not end_date:
        end = today + timedelta(days=3)
    else:
        end = parse_date(end_date) or today
    
    query = MedicationPlan.query.filter(
        MedicationPlan.dose_date >= start,
        MedicationPlan.dose_date <= end
    )
    
    if resident_id:
        query = query.filter_by(resident_id=resident_id)
    
    plans = query.order_by(
        MedicationPlan.dose_date,
        MedicationPlan.dose_time
    ).all()
    
    calendar = defaultdict(lambda: defaultdict(list))
    residents = {}
    medications = {}
    
    for plan in plans:
        if plan.resident_id not in residents:
            resident = Resident.query.get(plan.resident_id)
            residents[plan.resident_id] = resident.name if resident else plan.resident_id
        
        if plan.prescription_id not in medications:
            prescription = Prescription.query.get(plan.prescription_id)
            medications[plan.prescription_id] = prescription.medication_name if prescription else plan.prescription_id
        
        day_key = plan.dose_date.isoformat()
        time_key = plan.dose_time.strftime('%H:%M')
        
        calendar[day_key][time_key].append({
            'plan_id': plan.id,
            'resident_id': plan.resident_id,
            'resident_name': residents[plan.resident_id],
            'medication_name': medications[plan.prescription_id],
            'dosage': plan.dosage,
            'status': plan.status.value
        })
    
    result = {
        'date_range': {
            'start': start.isoformat(),
            'end': end.isoformat()
        },
        'resident_id': resident_id,
        'calendar': {
            day: {
                time: sorted(events, key=lambda x: x['resident_name'])
                for time, events in times.items()
            }
            for day, times in calendar.items()
        },
        'summary': {
            'total_plans': len(plans),
            'by_status': _count_by_status(plans),
            'days_covered': len(calendar)
        }
    }
    
    return success_response(result)


def _count_by_status(plans):
    counts = defaultdict(int)
    for p in plans:
        counts[p.status.value] += 1
    return dict(counts)


@bp.route('/exceptions', methods=['GET'])
def get_exception_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    today = datetime.utcnow().date()
    if not start_date:
        start = today - timedelta(days=7)
    else:
        start = parse_date(start_date) or today
    
    if not end_date:
        end = today
    else:
        end = parse_date(end_date) or today
    
    start_dt = datetime.combine(start, datetime.min.time())
    end_dt = datetime.combine(end, datetime.max.time())
    
    exceptions = ExceptionRecord.query.filter(
        ExceptionRecord.created_at >= start_dt,
        ExceptionRecord.created_at <= end_dt
    ).order_by(ExceptionRecord.created_at.desc()).all()
    
    summary = {
        'total': len(exceptions),
        'by_type': defaultdict(int),
        'by_status': defaultdict(int),
        'by_resident': defaultdict(int),
        'open_exceptions': [],
        'recent_resolved': []
    }
    
    for e in exceptions:
        summary['by_type'][e.exception_type.value] += 1
        summary['by_status'][e.status.value] += 1
        if e.resident_name:
            summary['by_resident'][e.resident_name] += 1
        
        if e.status == ExceptionStatus.OPEN:
            summary['open_exceptions'].append(e.to_dict())
        elif e.status == ExceptionStatus.RESOLVED:
            summary['recent_resolved'].append(e.to_dict())
    
    summary['by_type'] = dict(summary['by_type'])
    summary['by_status'] = dict(summary['by_status'])
    summary['by_resident'] = dict(summary['by_resident'])
    
    return success_response({
        'date_range': {
            'start': start.isoformat(),
            'end': end.isoformat()
        },
        'summary': summary,
        'all_exceptions': [e.to_dict() for e in exceptions]
    })


@bp.route('/inventory', methods=['GET'])
def get_inventory_report():
    inventories = MedicationInventory.query.all()
    
    inventory_details = []
    total_value = 0
    low_stock = []
    
    for inv in inventories:
        deductions = InventoryDeduction.query.filter_by(
            inventory_id=inv.id
        ).order_by(InventoryDeduction.created_at.desc()).all()
        
        recent_deductions = [d.to_dict() for d in deductions[:5]]
        
        detail = inv.to_dict()
        detail['recent_deductions'] = recent_deductions
        detail['deduction_count'] = len(deductions)
        
        inventory_details.append(detail)
        
        if inv.quantity <= 5:
            low_stock.append({
                'id': inv.id,
                'medication_name': inv.medication_name,
                'quantity': inv.quantity,
                'unit': inv.unit
            })
    
    return success_response({
        'total_items': len(inventories),
        'low_stock_threshold': 5,
        'low_stock_count': len(low_stock),
        'low_stock_items': low_stock,
        'inventory_details': inventory_details
    })


@bp.route('/handover', methods=['GET'])
def get_handover_report():
    handover_id = request.args.get('handover_id')
    date = request.args.get('date')
    
    if handover_id:
        handover = ShiftHandover.query.get(handover_id)
        if not handover:
            return error_response('交接班记录不存在', 404, 'NOT_FOUND')
        
        return success_response(_build_handover_detail(handover))
    
    today = datetime.utcnow().date()
    if date:
        target_date = parse_date(date) or today
    else:
        target_date = today
    
    handovers = ShiftHandover.query.filter_by(
        shift_date=target_date
    ).order_by(ShiftHandover.shift_type).all()
    
    if not handovers:
        return success_response({
            'date': target_date.isoformat(),
            'message': '当日无交接班记录'
        })
    
    report = {
        'date': target_date.isoformat(),
        'handovers': [],
        'summary': {
            'total': len(handovers),
            'confirmed': 0,
            'pending': 0,
            'abnormal': 0,
            'total_checked': 0,
            'total_unchecked': 0
        }
    }
    
    for handover in handovers:
        detail = _build_handover_detail(handover)
        report['handovers'].append(detail)
        
        if handover.status == ShiftStatus.CONFIRMED:
            report['summary']['confirmed'] += 1
        elif handover.status == ShiftStatus.PENDING:
            report['summary']['pending'] += 1
        elif handover.status == ShiftStatus.ABNORMAL:
            report['summary']['abnormal'] += 1
        
        report['summary']['total_checked'] += detail['checklist_summary']['checked']
        report['summary']['total_unchecked'] += detail['checklist_summary']['unchecked']
    
    return success_response(report)


def _build_handover_detail(handover):
    checklist = HandoverChecklist.query.filter_by(handover_id=handover.id).all()
    
    checked_count = sum(1 for c in checklist if c.checked)
    unchecked_count = len(checklist) - checked_count
    
    abnormal_items = []
    for item in checklist:
        if item.planned_status != item.actual_status or not item.checked:
            abnormal_items.append({
                'id': item.id,
                'resident_name': item.resident_name,
                'medication_name': item.medication_name,
                'dose_time': item.dose_time,
                'planned_status': item.planned_status,
                'actual_status': item.actual_status,
                'checked': item.checked,
                'notes': item.notes
            })
    
    return {
        'handover': handover.to_dict(),
        'checklist_summary': {
            'total': len(checklist),
            'checked': checked_count,
            'unchecked': unchecked_count,
            'completion_rate': f"{(checked_count/len(checklist)*100):.1f}%" if checklist else "N/A"
        },
        'abnormal_count': len(abnormal_items),
        'abnormal_items': abnormal_items,
        'checklist': [c.to_dict() for c in checklist]
    }


@bp.route('/nurse-performance', methods=['GET'])
def get_nurse_performance():
    nurses = Nurse.query.all()
    
    performance = []
    
    for nurse in nurses:
        confirmations = MedicationConfirmation.query.filter_by(
            nurse_id=nurse.id
        ).all()
        
        handovers = ShiftHandover.query.filter(
            (ShiftHandover.outgoing_nurse_id == nurse.id) |
            (ShiftHandover.incoming_nurse_id == nurse.id)
        ).all()
        
        missed_doses = MissedDose.query.filter_by(
            registered_by=nurse.id
        ).count()
        
        performance.append({
            'nurse': nurse.to_dict(),
            'confirmations_count': len(confirmations),
            'handovers_count': len(handovers),
            'missed_doses_registered': missed_doses
        })
    
    return success_response({
        'nurses': performance,
        'total_nurses': len(nurses),
        'total_confirmations': sum(p['confirmations_count'] for p in performance)
    })


@bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    today = datetime.utcnow().date()
    
    today_plans = MedicationPlan.query.filter_by(dose_date=today).all()
    completed = sum(1 for p in today_plans if p.status in [DoseStatus.CONFIRMED, DoseStatus.MAKEUP_ADMINISTERED])
    missed = sum(1 for p in today_plans if p.status in [DoseStatus.MISSED, DoseStatus.MAKEUP_DENIED])
    scheduled = sum(1 for p in today_plans if p.status == DoseStatus.SCHEDULED)
    
    open_exceptions = ExceptionRecord.query.filter_by(status=ExceptionStatus.OPEN).count()
    low_inventory = MedicationInventory.query.filter(MedicationInventory.quantity <= 5).count()
    pending_handovers = ShiftHandover.query.filter_by(status=ShiftStatus.PENDING).count()
    
    recent_activities = []
    
    recent_confirms = MedicationConfirmation.query.order_by(
        MedicationConfirmation.confirmed_at.desc()
    ).limit(5).all()
    for c in recent_confirms:
        plan = MedicationPlan.query.get(c.medication_plan_id)
        resident = Resident.query.get(plan.resident_id) if plan else None
        prescription = Prescription.query.get(plan.prescription_id) if plan else None
        nurse = Nurse.query.get(c.nurse_id)
        recent_activities.append({
            'type': '确认用药',
            'time': c.confirmed_at.isoformat() if c.confirmed_at else None,
            'nurse': nurse.name if nurse else c.nurse_id,
            'resident': resident.name if resident else '未知',
            'medication': prescription.medication_name if prescription else '未知',
            'is_makeup': c.is_makeup
        })
    
    return success_response({
        'today': {
            'date': today.isoformat(),
            'total_plans': len(today_plans),
            'completed': completed,
            'scheduled': scheduled,
            'missed': missed,
            'completion_rate': f"{(completed/len(today_plans)*100):.1f}%" if today_plans else "0%"
        },
        'alerts': {
            'open_exceptions': open_exceptions,
            'low_inventory': low_inventory,
            'pending_handovers': pending_handovers
        },
        'recent_activities': recent_activities
    })
