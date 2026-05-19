from datetime import datetime
from models import Blacklist
from database import get_connection, log_audit


class GateVerifier:
    def __init__(self, operator, role):
        self.operator = operator
        self.role = role

    def verify_visitor(self, id_card, visit_date=None):
        if visit_date is None:
            visit_date = datetime.now().strftime('%Y-%m-%d')

        blacklist_record = Blacklist.check_blacklist('id_card', id_card)
        if blacklist_record:
            log_audit('verify', 'visitor', None, {
                'id_card': id_card,
                'visit_date': visit_date,
                'blacklist_reason': blacklist_record['reason']
            }, self.operator, self.role, 'rejected')
            return {
                'allowed': False,
                'reason': f'黑名单人员: {blacklist_record["reason"]}',
                'blacklist_id': blacklist_record['id']
            }

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM visitors
            WHERE id_card = ? AND visit_date = ? AND status = 'pending'
        ''', (id_card, visit_date))
        visitor = cursor.fetchone()
        conn.close()

        if not visitor:
            log_audit('verify', 'visitor', None, {
                'id_card': id_card,
                'visit_date': visit_date,
                'error': '未找到有效的访客预约记录'
            }, self.operator, self.role, 'rejected')
            return {
                'allowed': False,
                'reason': '未找到有效的访客预约记录',
                'action': '请联系被访人员确认预约'
            }

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE visitors SET status = 'checked_in', updated_by = ?, updated_at = ?
            WHERE id = ?
        ''', (self.operator, datetime.now().isoformat(), visitor['id']))
        conn.commit()
        conn.close()

        log_audit('verify', 'visitor', visitor['id'], {
            'id_card': id_card,
            'visit_date': visit_date,
            'visitor_name': visitor['name']
        }, self.operator, self.role, 'approved')

        return {
            'allowed': True,
            'visitor': dict(visitor),
            'message': '访客核验通过，请进'
        }

    def verify_vehicle(self, plate_number):
        blacklist_record = Blacklist.check_blacklist('vehicle', plate_number)
        if blacklist_record:
            log_audit('verify', 'vehicle', None, {
                'plate_number': plate_number,
                'blacklist_reason': blacklist_record['reason']
            }, self.operator, self.role, 'rejected')
            return {
                'allowed': False,
                'reason': f'黑名单车辆: {blacklist_record["reason"]}',
                'blacklist_id': blacklist_record['id']
            }

        now = datetime.now().isoformat()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM temporary_plates
            WHERE plate_number = ? AND status = 'active'
            AND valid_from <= ? AND valid_to >= ?
        ''', (plate_number, now, now))
        plate = cursor.fetchone()
        conn.close()

        if not plate:
            log_audit('verify', 'vehicle', None, {
                'plate_number': plate_number,
                'error': '未找到有效的临时车牌记录或已过期'
            }, self.operator, self.role, 'rejected')
            return {
                'allowed': False,
                'reason': '未找到有效的临时车牌记录或已过期',
                'action': '请办理临时入园手续'
            }

        log_audit('verify', 'vehicle', plate['id'], {
            'plate_number': plate_number,
            'owner_name': plate['owner_name']
        }, self.operator, self.role, 'approved')

        return {
            'allowed': True,
            'plate': dict(plate),
            'message': '车辆核验通过，请进'
        }

    def get_recent_verifications(self, limit=50):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM audit_logs
            WHERE action = 'verify'
            ORDER BY timestamp DESC
            LIMIT ?
        ''', (limit,))
        logs = cursor.fetchall()
        conn.close()
        return [dict(log) for log in logs]
