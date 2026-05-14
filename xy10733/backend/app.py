from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from datetime import datetime, timedelta
import sqlite3
import hashlib
import uuid
import csv
import io
import os

app = Flask(__name__)
CORS(app)
DATABASE = 'watermark_export.db'


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS field_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_name TEXT UNIQUE NOT NULL,
            description TEXT,
            requires_approval BOOLEAN DEFAULT 0,
            sensitivity_level INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watermark_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT UNIQUE NOT NULL,
            content_template TEXT NOT NULL,
            opacity REAL DEFAULT 0.3,
            font_size INTEGER DEFAULT 14,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS export_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            applicant TEXT NOT NULL,
            responsible_person TEXT NOT NULL,
            fields TEXT NOT NULL,
            purpose TEXT,
            status TEXT DEFAULT 'pending',
            watermark_rule_id INTEGER,
            reject_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            approved_at TIMESTAMP,
            FOREIGN KEY (watermark_rule_id) REFERENCES watermark_rules(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS download_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            downloader TEXT NOT NULL,
            download_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            success BOOLEAN DEFAULT 1,
            failure_reason TEXT,
            ip_address TEXT,
            FOREIGN KEY (application_id) REFERENCES export_applications(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS revoke_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            is_revoked BOOLEAN DEFAULT 0,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES export_applications(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            operator TEXT NOT NULL,
            application_id INTEGER,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (application_id) REFERENCES export_applications(id)
        )
    ''')
    
    conn.commit()
    conn.close()


@app.route('/api/applications', methods=['GET'])
def get_applications():
    conn = get_db()
    cursor = conn.cursor()
    
    group_by = request.args.get('group_by', 'responsible_person')
    cursor.execute('''
        SELECT ea.*, wr.rule_name as watermark_rule_name
        FROM export_applications ea
        LEFT JOIN watermark_rules wr ON ea.watermark_rule_id = wr.id
        ORDER BY ea.created_at DESC
    ''')
    
    rows = cursor.fetchall()
    applications = [dict(row) for row in rows]
    
    grouped = {}
    for app in applications:
        if group_by == 'responsible_person':
            key = app['responsible_person']
        elif group_by == 'created_at':
            key = app['created_at'].split(' ')[0] if app['created_at'] else 'Unknown'
        elif group_by == 'watermark_rule_name':
            key = app['watermark_rule_name'] or '无规则'
        else:
            key = 'all'
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(app)
    
    conn.close()
    return jsonify({'grouped': grouped, 'list': applications})


@app.route('/api/applications', methods=['POST'])
def create_application():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    fields = data.get('fields', [])
    field_names = ','.join(fields)
    
    cursor.execute('''
        SELECT field_name, requires_approval, sensitivity_level
        FROM field_permissions
        WHERE field_name IN ({})
    '''.format(','.join(['?'] * len(fields))), fields)
    
    permission_rows = cursor.fetchall()
    permissions = [dict(row) for row in permission_rows]
    
    requires_approval = any(p['requires_approval'] for p in permissions)
    high_sensitivity = any(p['sensitivity_level'] >= 3 for p in permissions)
    
    if high_sensitivity:
        status = 'rejected'
        reject_reason = '包含高敏感字段，需要特殊审批流程'
    elif requires_approval:
        status = 'pending'
        reject_reason = None
    else:
        status = 'approved'
        reject_reason = None
    
    cursor.execute('SELECT id FROM watermark_rules WHERE is_active = 1 ORDER BY id LIMIT 1')
    rule_row = cursor.fetchone()
    watermark_rule_id = rule_row['id'] if rule_row else None
    
    cursor.execute('''
        INSERT INTO export_applications 
        (applicant, responsible_person, fields, purpose, status, watermark_rule_id, reject_reason, approved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['applicant'],
        data['responsible_person'],
        field_names,
        data.get('purpose', ''),
        status,
        watermark_rule_id,
        reject_reason,
        datetime.now().isoformat() if status == 'approved' else None
    ))
    
    application_id = cursor.lastrowid
    
    cursor.execute('''
        INSERT INTO audit_logs (action, operator, application_id, details)
        VALUES (?, ?, ?, ?)
    ''', (
        'create_application',
        data['applicant'],
        application_id,
        f"申请导出字段: {field_names}, 状态: {status}"
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': application_id,
        'status': status,
        'reject_reason': reject_reason,
        'requires_approval': requires_approval,
        'message': '申请已提交' if status != 'rejected' else '申请被拒绝'
    }), 201


@app.route('/api/applications/batch', methods=['POST'])
def batch_import():
    data = request.json
    applications = data.get('applications', [])
    results = []
    
    conn = get_db()
    cursor = conn.cursor()
    
    for app_data in applications:
        fields = app_data.get('fields', [])
        field_names = ','.join(fields)
        
        cursor.execute('''
            SELECT field_name, requires_approval, sensitivity_level
            FROM field_permissions
            WHERE field_name IN ({})
        '''.format(','.join(['?'] * len(fields))), fields)
        
        permission_rows = cursor.fetchall()
        permissions = [dict(row) for row in permission_rows]
        
        requires_approval = any(p['requires_approval'] for p in permissions)
        high_sensitivity = any(p['sensitivity_level'] >= 3 for p in permissions)
        
        if high_sensitivity:
            status = 'rejected'
            reject_reason = '包含高敏感字段，需要特殊审批流程'
        elif requires_approval:
            status = 'pending'
            reject_reason = None
        else:
            status = 'approved'
            reject_reason = None
        
        cursor.execute('SELECT id FROM watermark_rules WHERE is_active = 1 ORDER BY id LIMIT 1')
        rule_row = cursor.fetchone()
        watermark_rule_id = rule_row['id'] if rule_row else None
        
        cursor.execute('''
            INSERT INTO export_applications 
            (applicant, responsible_person, fields, purpose, status, watermark_rule_id, reject_reason, approved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            app_data['applicant'],
            app_data['responsible_person'],
            field_names,
            app_data.get('purpose', ''),
            status,
            watermark_rule_id,
            reject_reason,
            datetime.now().isoformat() if status == 'approved' else None
        ))
        
        application_id = cursor.lastrowid
        
        cursor.execute('''
            INSERT INTO audit_logs (action, operator, application_id, details)
            VALUES (?, ?, ?, ?)
        ''', (
            'batch_import',
            app_data['applicant'],
            application_id,
            f"批量导入导出申请，状态: {status}"
        ))
        
        results.append({
            'id': application_id,
            'applicant': app_data['applicant'],
            'status': status,
            'reject_reason': reject_reason
        })
    
    conn.commit()
    conn.close()
    
    return jsonify({'results': results, 'total': len(results)})


@app.route('/api/applications/<int:application_id>/approve', methods=['POST'])
def approve_application(application_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM export_applications WHERE id = ?', (application_id,))
    app = cursor.fetchone()
    
    if not app:
        conn.close()
        return jsonify({'error': '申请不存在'}), 404
    
    cursor.execute('''
        UPDATE export_applications
        SET status = 'approved', approved_at = ?
        WHERE id = ?
    ''', (datetime.now().isoformat(), application_id))
    
    cursor.execute('''
        INSERT INTO audit_logs (action, operator, application_id, details)
        VALUES (?, ?, ?, ?)
    ''', (
        'approve',
        data.get('approver', 'unknown'),
        application_id,
        '申请已批准'
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': '申请已批准'})


@app.route('/api/applications/<int:application_id>/reject', methods=['POST'])
def reject_application(application_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM export_applications WHERE id = ?', (application_id,))
    app = cursor.fetchone()
    
    if not app:
        conn.close()
        return jsonify({'error': '申请不存在'}), 404
    
    cursor.execute('''
        UPDATE export_applications
        SET status = 'rejected', reject_reason = ?
        WHERE id = ?
    ''', (data.get('reason', '未说明原因'), application_id))
    
    cursor.execute('''
        INSERT INTO audit_logs (action, operator, application_id, details)
        VALUES (?, ?, ?, ?)
    ''', (
        'reject',
        data.get('rejecter', 'unknown'),
        application_id,
        f"申请被拒绝: {data.get('reason', '未说明原因')}"
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': '申请已拒绝'})


@app.route('/api/applications/<int:application_id>/download', methods=['POST'])
def record_download(application_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM export_applications WHERE id = ?', (application_id,))
    app = cursor.fetchone()
    
    if not app:
        conn.close()
        return jsonify({'error': '申请不存在'}), 404
    
    if dict(app)['status'] != 'approved':
        cursor.execute('''
            INSERT INTO download_records (application_id, downloader, success, failure_reason, ip_address)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            application_id,
            data.get('downloader', 'unknown'),
            False,
            '申请未批准',
            request.remote_addr
        ))
        
        cursor.execute('''
            INSERT INTO audit_logs (action, operator, application_id, details)
            VALUES (?, ?, ?, ?)
        ''', (
            'download_failed',
            data.get('downloader', 'unknown'),
            application_id,
            '下载失败: 申请未批准'
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'error': '申请未批准', 'success': False}), 403
    
    cursor.execute('''
        INSERT INTO download_records (application_id, downloader, success, ip_address)
        VALUES (?, ?, ?, ?)
    ''', (
        application_id,
        data.get('downloader', 'unknown'),
        True,
        request.remote_addr
    ))
    
    cursor.execute('''
        INSERT INTO audit_logs (action, operator, application_id, details)
        VALUES (?, ?, ?, ?)
    ''', (
        'download',
        data.get('downloader', 'unknown'),
        application_id,
        '下载成功'
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': '下载记录已保存', 'success': True})


@app.route('/api/applications/<int:application_id>/revoke-link', methods=['POST'])
def create_revoke_link(application_id):
    conn = get_db()
    cursor = conn.cursor()
    
    token = hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:32]
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    
    cursor.execute('''
        INSERT INTO revoke_links (application_id, token, expires_at)
        VALUES (?, ?, ?)
    ''', (application_id, token, expires_at))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'token': token,
        'revoke_url': f'/api/revoke/{token}',
        'expires_at': expires_at
    })


@app.route('/api/revoke/<token>', methods=['POST'])
def revoke_by_token(token):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM revoke_links WHERE token = ? AND is_revoked = 0', (token,))
    link = cursor.fetchone()
    
    if not link:
        conn.close()
        return jsonify({'error': '链接无效或已撤销'}), 404
    
    link_dict = dict(link)
    
    if datetime.fromisoformat(link_dict['expires_at']) < datetime.now():
        conn.close()
        return jsonify({'error': '链接已过期'}), 400
    
    cursor.execute('''
        UPDATE export_applications
        SET status = 'revoked'
        WHERE id = ?
    ''', (link_dict['application_id'],))
    
    cursor.execute('''
        UPDATE revoke_links
        SET is_revoked = 1
        WHERE id = ?
    ''', (link_dict['id'],))
    
    cursor.execute('''
        INSERT INTO audit_logs (action, operator, application_id, details)
        VALUES (?, ?, ?, ?)
    ''', (
        'revoke',
        'revoke_link',
        link_dict['application_id'],
        '通过撤销链接撤销了导出权限'
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': '导出权限已撤销'})


@app.route('/api/downloads', methods=['GET'])
def get_download_records():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT dr.*, ea.applicant, ea.responsible_person, ea.fields
        FROM download_records dr
        JOIN export_applications ea ON dr.application_id = ea.id
        ORDER BY dr.download_time DESC
    ''')
    
    rows = cursor.fetchall()
    records = [dict(row) for row in rows]
    
    conn.close()
    return jsonify(records)


@app.route('/api/audit-logs', methods=['GET'])
def get_audit_logs():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT al.*, ea.applicant, ea.responsible_person
        FROM audit_logs al
        LEFT JOIN export_applications ea ON al.application_id = ea.id
        ORDER BY al.created_at DESC
    ''')
    
    rows = cursor.fetchall()
    logs = [dict(row) for row in rows]
    
    conn.close()
    return jsonify(logs)


@app.route('/api/audit-logs/export', methods=['GET'])
def export_audit_logs():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT al.id, al.action, al.operator, al.details, al.created_at,
               ea.applicant, ea.responsible_person, ea.fields as application_fields
        FROM audit_logs al
        LEFT JOIN export_applications ea ON al.application_id = ea.id
        ORDER BY al.created_at DESC
    ''')
    
    rows = cursor.fetchall()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow(['ID', '操作类型', '操作人', '详情', '操作时间', '申请人', '负责人', '涉及字段'])
    
    for row in rows:
        writer.writerow([
            row['id'],
            row['action'],
            row['operator'],
            row['details'],
            row['created_at'],
            row['applicant'] or '',
            row['responsible_person'] or '',
            row['application_fields'] or ''
        ])
    
    output.seek(0)
    conn.close()
    
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'audit_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )


@app.route('/api/field-permissions', methods=['GET'])
def get_field_permissions():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM field_permissions ORDER BY id')
    rows = cursor.fetchall()
    permissions = [dict(row) for row in rows]
    
    conn.close()
    return jsonify(permissions)


@app.route('/api/watermark-rules', methods=['GET'])
def get_watermark_rules():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM watermark_rules ORDER BY id')
    rows = cursor.fetchall()
    rules = [dict(row) for row in rows]
    
    conn.close()
    return jsonify(rules)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as total FROM export_applications')
    total_apps = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as total FROM export_applications WHERE status = "approved"')
    approved = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as total FROM export_applications WHERE status = "pending"')
    pending = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as total FROM export_applications WHERE status = "rejected"')
    rejected = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as total FROM download_records')
    total_downloads = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as total FROM download_records WHERE success = 0')
    failed_downloads = cursor.fetchone()['total']
    
    conn.close()
    
    return jsonify({
        'total_applications': total_apps,
        'approved': approved,
        'pending': pending,
        'rejected': rejected,
        'total_downloads': total_downloads,
        'failed_downloads': failed_downloads
    })


if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()
    app.run(debug=True, port=5000)
