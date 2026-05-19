import csv
import json
import os
from datetime import datetime, timedelta
from database import get_connection
from config import EXPORT_DIR


class DataExporter:
    def __init__(self, operator, role):
        self.operator = operator
        self.role = role

    def export_visitors(self, start_date=None, end_date=None, status=None):
        conn = get_connection()
        cursor = conn.cursor()

        query = 'SELECT * FROM visitors WHERE 1=1'
        params = []

        if start_date:
            query += ' AND visit_date >= ?'
            params.append(start_date)
        if end_date:
            query += ' AND visit_date <= ?'
            params.append(end_date)
        if status:
            query += ' AND status = ?'
            params.append(status)

        query += ' ORDER BY visit_date DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        visitors = [dict(row) for row in rows]

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'visitors_{timestamp}.csv'
        filepath = os.path.join(EXPORT_DIR, filename)

        if visitors:
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=visitors[0].keys())
                writer.writeheader()
                writer.writerows(visitors)

        return {
            'file': filepath,
            'count': len(visitors),
            'data': visitors
        }

    def export_plates(self, status=None):
        conn = get_connection()
        cursor = conn.cursor()

        query = 'SELECT * FROM temporary_plates WHERE 1=1'
        params = []

        if status:
            query += ' AND status = ?'
            params.append(status)

        query += ' ORDER BY valid_from DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        plates = [dict(row) for row in rows]

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'plates_{timestamp}.json'
        filepath = os.path.join(EXPORT_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({'plates': plates, 'exported_by': self.operator, 'exported_at': datetime.now().isoformat()},
                     f, ensure_ascii=False, indent=2)

        return {
            'file': filepath,
            'count': len(plates),
            'data': plates
        }

    def export_blacklist(self, active_only=True):
        conn = get_connection()
        cursor = conn.cursor()

        if active_only:
            cursor.execute('SELECT * FROM blacklist WHERE is_active = 1 ORDER BY added_at DESC')
        else:
            cursor.execute('SELECT * FROM blacklist ORDER BY added_at DESC')

        rows = cursor.fetchall()
        conn.close()

        blacklist = [dict(row) for row in rows]

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'blacklist_{timestamp}.csv'
        filepath = os.path.join(EXPORT_DIR, filename)

        if blacklist:
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=blacklist[0].keys())
                writer.writeheader()
                writer.writerows(blacklist)

        return {
            'file': filepath,
            'count': len(blacklist),
            'data': blacklist
        }

    def export_audit_logs(self, days=30, action=None):
        conn = get_connection()
        cursor = conn.cursor()

        start_date = (datetime.now() - timedelta(days=days)).isoformat()

        query = 'SELECT * FROM audit_logs WHERE timestamp >= ?'
        params = [start_date]

        if action:
            query += ' AND action = ?'
            params.append(action)

        query += ' ORDER BY timestamp DESC'

        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()

        logs = [dict(row) for row in rows]

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'audit_logs_{days}days_{timestamp}.csv'
        filepath = os.path.join(EXPORT_DIR, filename)

        if logs:
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=logs[0].keys())
                writer.writeheader()
                writer.writerows(logs)

        return {
            'file': filepath,
            'count': len(logs),
            'data': logs
        }

    def export_monthly_summary(self, year, month):
        conn = get_connection()
        cursor = conn.cursor()

        date_prefix = f'{year}-{month:02d}'

        cursor.execute('''
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                   SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as checked_in
            FROM visitors
            WHERE visit_date LIKE ?
        ''', (f'{date_prefix}%',))
        visitor_stats = dict(cursor.fetchone())

        cursor.execute('''
            SELECT COUNT(*) as total_verified,
                   SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                   SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
            FROM audit_logs
            WHERE action = 'verify' AND timestamp LIKE ?
        ''', (f'{date_prefix}%',))
        verify_stats = dict(cursor.fetchone())

        cursor.execute('SELECT COUNT(*) as active_blacklist FROM blacklist WHERE is_active = 1')
        blacklist_stats = dict(cursor.fetchone())

        conn.close()

        summary = {
            'period': f'{year}年{month}月',
            'generated_by': self.operator,
            'generated_at': datetime.now().isoformat(),
            'visitor_stats': visitor_stats,
            'verification_stats': verify_stats,
            'blacklist_stats': blacklist_stats
        }

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'monthly_summary_{year}_{month:02d}_{timestamp}.json'
        filepath = os.path.join(EXPORT_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)

        return {
            'file': filepath,
            'summary': summary
        }

    def export_batch_operations(self):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM batch_operations ORDER BY started_at DESC LIMIT 100')
        rows = cursor.fetchall()
        conn.close()

        operations = [dict(row) for row in rows]

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'batch_operations_{timestamp}.csv'
        filepath = os.path.join(EXPORT_DIR, filename)

        if operations:
            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=operations[0].keys())
                writer.writeheader()
                writer.writerows(operations)

        return {
            'file': filepath,
            'count': len(operations),
            'data': operations
        }
