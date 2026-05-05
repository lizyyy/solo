import requests
from datetime import datetime
from flask import current_app

def send_door_code_webhook(reservation):
    webhook_url = current_app.config['WEBHOOK_URL']
    
    payload = {
        'event': 'DOOR_CODE_GENERATED',
        'timestamp': datetime.utcnow().isoformat(),
        'data': {
            'reservation_id': reservation.id,
            'room_id': reservation.room_id,
            'room_name': reservation.room.name if reservation.room else None,
            'member_id': reservation.member_id,
            'member_name': reservation.member.name if reservation.member else None,
            'door_code': reservation.door_code,
            'start_time': reservation.start_time.isoformat() if reservation.start_time else None,
            'end_time': reservation.end_time.isoformat() if reservation.end_time else None
        }
    }
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        response.raise_for_status()
        print(f"Webhook sent successfully: {webhook_url}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Webhook notification failed: {e}")
        return False

def send_verification_webhook(reservation, member, success):
    webhook_url = current_app.config['WEBHOOK_URL']
    
    payload = {
        'event': 'DOOR_VERIFICATION' if success else 'DOOR_VERIFICATION_FAILED',
        'timestamp': datetime.utcnow().isoformat(),
        'data': {
            'reservation_id': reservation.id,
            'room_id': reservation.room_id,
            'room_name': reservation.room.name if reservation.room else None,
            'member_id': reservation.member_id,
            'member_name': member.name,
            'door_code': reservation.door_code,
            'success': success,
            'check_in_time': reservation.check_in_time.isoformat() if reservation.check_in_time else None
        }
    }
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        response.raise_for_status()
        print(f"Verification webhook sent successfully: {webhook_url}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Verification webhook notification failed: {e}")
        return False

def send_cancellation_webhook(reservation, member):
    webhook_url = current_app.config['WEBHOOK_URL']
    
    payload = {
        'event': 'RESERVATION_CANCELLED',
        'timestamp': datetime.utcnow().isoformat(),
        'data': {
            'reservation_id': reservation.id,
            'room_id': reservation.room_id,
            'room_name': reservation.room.name if reservation.room else None,
            'member_id': reservation.member_id,
            'member_name': member.name,
            'door_code': reservation.door_code,
            'cancelled_at': datetime.utcnow().isoformat()
        }
    }
    
    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
        response.raise_for_status()
        print(f"Cancellation webhook sent successfully: {webhook_url}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Cancellation webhook notification failed: {e}")
        return False
