from app.models import Quarantine, TestCase, FlakyRun
from app import db
from datetime import datetime
from dateutil import parser as date_parser


def add_to_quarantine(test_name, reason, reason_category=None, full_name=None, 
                       module=None, owner=None, added_by=None, expected_fix_date=None, 
                       notes=None):
    existing = Quarantine.query.filter_by(test_name=test_name).first()
    
    if existing:
        if existing.is_active:
            return {
                'success': False,
                'message': f'Test "{test_name}" is already in quarantine',
                'quarantine': existing.to_dict()
            }
        else:
            existing.is_active = True
            existing.reason = reason
            existing.reason_category = reason_category
            existing.added_at = datetime.utcnow()
            existing.added_by = added_by
            existing.expected_fix_date = _parse_date(expected_fix_date)
            existing.notes = notes
            existing.deactivated_at = None
            existing.deactivated_by = None
            existing.deactivation_reason = None
            db.session.commit()
            return {
                'success': True,
                'message': f'Test "{test_name}" has been reactivated in quarantine',
                'quarantine': existing.to_dict()
            }
    
    quarantine = Quarantine()
    quarantine.test_name = test_name
    quarantine.full_name = full_name
    quarantine.module = module
    quarantine.owner = owner
    quarantine.reason = reason
    quarantine.reason_category = reason_category
    quarantine.added_by = added_by
    quarantine.expected_fix_date = _parse_date(expected_fix_date)
    quarantine.notes = notes
    
    if not full_name or not module or not owner:
        test_case = TestCase.query.filter(TestCase.name == test_name).first()
        if test_case:
            if not full_name:
                quarantine.full_name = test_case.full_name
            if not module:
                quarantine.module = test_case.module
            if not owner:
                quarantine.owner = test_case.owner
        else:
            flaky_run = FlakyRun.query.filter(FlakyRun.test_name == test_name).first()
            if flaky_run:
                if not full_name:
                    quarantine.full_name = flaky_run.full_name
                if not module:
                    quarantine.module = flaky_run.module
                if not owner:
                    quarantine.owner = flaky_run.owner
    
    db.session.add(quarantine)
    db.session.commit()
    
    return {
        'success': True,
        'message': f'Test "{test_name}" has been added to quarantine',
        'quarantine': quarantine.to_dict()
    }


def remove_from_quarantine(test_name, deactivated_by=None, deactivation_reason=None):
    quarantine = Quarantine.query.filter_by(test_name=test_name).first()
    
    if not quarantine:
        return {
            'success': False,
            'message': f'Test "{test_name}" not found in quarantine'
        }
    
    if not quarantine.is_active:
        return {
            'success': False,
            'message': f'Test "{test_name}" is already not in active quarantine',
            'quarantine': quarantine.to_dict()
        }
    
    quarantine.is_active = False
    quarantine.deactivated_at = datetime.utcnow()
    quarantine.deactivated_by = deactivated_by
    quarantine.deactivation_reason = deactivation_reason
    
    db.session.commit()
    
    return {
        'success': True,
        'message': f'Test "{test_name}" has been removed from quarantine',
        'quarantine': quarantine.to_dict()
    }


def get_quarantine_list(include_inactive=False, module=None, owner=None, 
                        reason_category=None):
    query = Quarantine.query
    
    if not include_inactive:
        query = query.filter_by(is_active=True)
    
    if module:
        query = query.filter(Quarantine.module == module)
    if owner:
        query = query.filter(Quarantine.owner == owner)
    if reason_category:
        query = query.filter(Quarantine.reason_category == reason_category)
    
    quarantines = query.order_by(Quarantine.added_at.desc()).all()
    
    return [q.to_dict() for q in quarantines]


def get_quarantine_stats():
    total_active = Quarantine.query.filter_by(is_active=True).count()
    total_inactive = Quarantine.query.filter_by(is_active=False).count()
    
    categories = {}
    for q in Quarantine.query.filter_by(is_active=True).all():
        cat = q.reason_category or 'uncategorized'
        categories[cat] = categories.get(cat, 0) + 1
    
    modules = {}
    for q in Quarantine.query.filter_by(is_active=True).all():
        mod = q.module or 'unknown'
        modules[mod] = modules.get(mod, 0) + 1
    
    owners = {}
    for q in Quarantine.query.filter_by(is_active=True).all():
        o = q.owner or 'unknown'
        owners[o] = owners.get(o, 0) + 1
    
    return {
        'total_active': total_active,
        'total_inactive': total_inactive,
        'by_category': categories,
        'by_module': modules,
        'by_owner': owners
    }


def update_quarantine(test_name, reason=None, reason_category=None, 
                       expected_fix_date=None, notes=None):
    quarantine = Quarantine.query.filter_by(test_name=test_name).first()
    
    if not quarantine:
        return {
            'success': False,
            'message': f'Test "{test_name}" not found in quarantine'
        }
    
    if reason:
        quarantine.reason = reason
    if reason_category:
        quarantine.reason_category = reason_category
    if expected_fix_date:
        quarantine.expected_fix_date = _parse_date(expected_fix_date)
    if notes is not None:
        quarantine.notes = notes
    
    db.session.commit()
    
    return {
        'success': True,
        'message': f'Test "{test_name}" quarantine entry has been updated',
        'quarantine': quarantine.to_dict()
    }


def check_quarantine_status(test_name):
    quarantine = Quarantine.query.filter_by(test_name=test_name).first()
    
    if not quarantine:
        return {
            'in_quarantine': False,
            'message': f'Test "{test_name}" is not in quarantine'
        }
    
    return {
        'in_quarantine': quarantine.is_active,
        'quarantine': quarantine.to_dict()
    }


def _parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str
    try:
        return date_parser.parse(date_str)
    except (ValueError, TypeError):
        return None
