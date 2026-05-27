from datetime import datetime
import uuid
from app import db
from app.models import OperationLog

def generate_no(prefix):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    unique = str(uuid.uuid4().hex)[:6].upper()
    return f"{prefix}{timestamp}{unique}"

def log_operation(operation, operator, reason=None, batch_id=None, record_id=None, old_status=None, new_status=None, ip_address=None):
    log = OperationLog(
        operation=operation,
        operator=operator,
        reason=reason,
        batch_id=batch_id,
        record_id=record_id,
        old_status=old_status,
        new_status=new_status,
        ip_address=ip_address
    )
    db.session.add(log)
    db.session.commit()
    return log

def calculate_electricity_tier(usage, tiers_config=None):
    if tiers_config is None:
        tiers_config = [
            {'name': '第一档', 'limit': 200, 'price': 0.56},
            {'name': '第二档', 'limit': 400, 'price': 0.61},
            {'name': '第三档', 'limit': float('inf'), 'price': 0.86}
        ]
    
    details = []
    remaining = float(usage)
    previous_limit = 0
    total_amount = 0
    
    for tier in tiers_config:
        if remaining <= 0:
            break
        
        tier_usage = min(remaining, tier['limit'] - previous_limit)
        tier_amount = tier_usage * tier['price']
        total_amount += tier_amount
        
        details.append({
            'tier_name': tier['name'],
            'usage': round(tier_usage, 2),
            'unit_price': tier['price'],
            'amount': round(tier_amount, 2)
        })
        
        remaining -= tier_usage
        previous_limit = tier['limit']
    
    return {
        'total_amount': round(total_amount, 2),
        'details': details
    }

ALLOWED_EXTENSIONS = {'csv', 'json', 'jpg', 'jpeg', 'png', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
