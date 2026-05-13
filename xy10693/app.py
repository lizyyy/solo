from flask import Flask, request, jsonify, send_file, render_template_string
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import io
import pandas as pd
from database import init_db, insert_sample_data, get_db_connection, calculate_status, log_audit

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    with open('static/index.html', 'r', encoding='utf-8') as f:
        return render_template_string(f.read())

@app.route('/api/dashboard/stats')
def dashboard_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as total FROM purchase_requests")
    total_requests = cursor.fetchone()['total']
    
    cursor.execute("SELECT COUNT(*) as pending FROM purchase_requests WHERE status = 'pending'")
    pending_requests = cursor.fetchone()['pending']
    
    cursor.execute("SELECT COUNT(*) as comparing FROM purchase_requests WHERE status = 'comparing'")
    comparing_requests = cursor.fetchone()['comparing']
    
    cursor.execute("SELECT COUNT(*) as approval FROM purchase_requests WHERE status = 'pending_approval'")
    approval_requests = cursor.fetchone()['approval']
    
    cursor.execute("SELECT COUNT(*) as approved FROM purchase_requests WHERE status = 'approved'")
    approved_requests = cursor.fetchone()['approved']
    
    cursor.execute("SELECT COUNT(*) as rejected FROM purchase_requests WHERE status = 'rejected'")
    rejected_requests = cursor.fetchone()['rejected']
    
    cursor.execute("SELECT COUNT(*) as anomalies FROM comparison_results WHERE price_anomalies != '[]' OR budget_anomalies != '[]'")
    anomalies_count = cursor.fetchone()['anomalies']
    
    conn.close()
    
    return jsonify({
        'total': total_requests,
        'pending': pending_requests,
        'comparing': comparing_requests,
        'pending_approval': approval_requests,
        'approved': approved_requests,
        'rejected': rejected_requests,
        'anomalies': anomalies_count
    })

@app.route('/api/purchase-requests')
def get_purchase_requests():
    status = request.args.get('status')
    department = request.args.get('department')
    keyword = request.args.get('keyword')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT pr.*, u.name as requester_name, bs.name as budget_subject_name,
               bs.code as budget_subject_code, bs.total_budget, bs.used_budget
        FROM purchase_requests pr
        LEFT JOIN users u ON pr.requester_id = u.id
        LEFT JOIN budget_subjects bs ON pr.budget_subject_id = bs.id
        WHERE 1=1
    '''
    params = []
    
    if status:
        query += ' AND pr.status = ?'
        params.append(status)
    
    if department:
        query += ' AND pr.department = ?'
        params.append(department)
    
    if keyword:
        query += ' AND (pr.title LIKE ? OR pr.request_no LIKE ? OR pr.description LIKE ?)'
        keyword_pattern = f'%{keyword}%'
        params.extend([keyword_pattern, keyword_pattern, keyword_pattern])
    
    query += ' ORDER BY pr.created_at DESC'
    
    cursor.execute(query, params)
    requests = cursor.fetchall()
    
    result = []
    for req in requests:
        req_dict = dict(req)
        
        cursor.execute('SELECT * FROM supplier_quotes WHERE purchase_request_id = ?', (req['id'],))
        quotes = cursor.fetchall()
        req_dict['quotes'] = [dict(q) for q in quotes]
        
        result.append(req_dict)
    
    conn.close()
    
    return jsonify(result)

@app.route('/api/purchase-requests/<int:request_id>')
def get_purchase_request_detail(request_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT pr.*, u.name as requester_name, bs.name as budget_subject_name,
               bs.code as budget_subject_code, bs.total_budget, bs.used_budget
        FROM purchase_requests pr
        LEFT JOIN users u ON pr.requester_id = u.id
        LEFT JOIN budget_subjects bs ON pr.budget_subject_id = bs.id
        WHERE pr.id = ?
    ''', (request_id,))
    request_data = cursor.fetchone()
    
    if not request_data:
        conn.close()
        return jsonify({'error': 'Request not found'}), 404
    
    result = dict(request_data)
    
    cursor.execute('''
        SELECT sq.*, s.name as supplier_name, s.contact_person, s.phone, s.rating
        FROM supplier_quotes sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        WHERE sq.purchase_request_id = ?
    ''', (request_id,))
    quotes = cursor.fetchall()
    result['quotes'] = [dict(q) for q in quotes]
    
    cursor.execute('''
        SELECT a.*, u.name as approver_name
        FROM approvals a
        LEFT JOIN users u ON a.approver_id = u.id
        WHERE a.purchase_request_id = ?
        ORDER BY a.approval_level
    ''', (request_id,))
    approvals = cursor.fetchall()
    result['approvals'] = [dict(a) for a in approvals]
    
    cursor.execute('SELECT * FROM comparison_results WHERE purchase_request_id = ?', (request_id,))
    comparison = cursor.fetchone()
    if comparison:
        result['comparison'] = dict(comparison)
    
    cursor.execute('''
        SELECT al.*, u.name as changed_by_name
        FROM audit_logs al
        LEFT JOIN users u ON al.changed_by_id = u.id
        WHERE al.table_name = 'purchase_requests' AND al.record_id = ?
        ORDER BY al.changed_at DESC
    ''', (request_id,))
    audit_logs = cursor.fetchall()
    result['audit_logs'] = [dict(log) for log in audit_logs]
    
    conn.close()
    
    return jsonify(result)

@app.route('/api/purchase-requests', methods=['POST'])
def create_purchase_request():
    data = request.json
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT MAX(id) as max_id FROM purchase_requests')
        max_id = cursor.fetchone()['max_id'] or 0
        request_no = f'CG-{datetime.now().year}-{str(max_id + 1).zfill(3)}'
        
        cursor.execute('''
            INSERT INTO purchase_requests 
            (request_no, title, description, requester_id, department, budget_subject_id, estimated_amount, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            request_no,
            data['title'],
            data.get('description', ''),
            data.get('requester_id', 1),
            data['department'],
            data['budget_subject_id'],
            data['estimated_amount'],
            data.get('priority', 'normal')
        ))
        
        conn.commit()
        new_id = cursor.lastrowid
        
        log_audit('purchase_requests', new_id, 'created', None, 'created', data.get('requester_id', 1), '创建采购需求')
        
        conn.close()
        return jsonify({'id': new_id, 'request_no': request_no, 'message': '创建成功'})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/purchase-requests/<int:request_id>/status', methods=['PUT'])
def update_request_status(request_id):
    data = request.json
    new_status = data['status']
    user_id = data.get('user_id', 1)
    reason = data.get('reason', '')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT status FROM purchase_requests WHERE id = ?', (request_id,))
    old_status = cursor.fetchone()
    
    if not old_status:
        conn.close()
        return jsonify({'error': 'Request not found'}), 404
    
    try:
        cursor.execute('UPDATE purchase_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                      (new_status, request_id))
        
        log_audit('purchase_requests', request_id, 'status', old_status['status'], new_status, user_id, reason)
        
        conn.commit()
        conn.close()
        return jsonify({'message': '状态更新成功'})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/purchase-requests/<int:request_id>/quotes', methods=['POST'])
def add_supplier_quote(request_id):
    data = request.json
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO supplier_quotes 
            (purchase_request_id, supplier_id, quote_amount, quote_details, valid_until)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            request_id,
            data['supplier_id'],
            data['quote_amount'],
            data.get('quote_details', ''),
            data.get('valid_until')
        ))
        
        conn.commit()
        new_id = cursor.lastrowid
        
        calculate_status(request_id)
        
        conn.close()
        return jsonify({'id': new_id, 'message': '报价添加成功'})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/suppliers')
def get_suppliers():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM suppliers ORDER BY rating DESC')
    suppliers = cursor.fetchall()
    conn.close()
    return jsonify([dict(s) for s in suppliers])

@app.route('/api/budget-subjects')
def get_budget_subjects():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM budget_subjects ORDER BY code')
    subjects = cursor.fetchall()
    conn.close()
    return jsonify([dict(s) for s in subjects])

@app.route('/api/historical-prices')
def get_historical_prices():
    item_name = request.args.get('item_name')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT hp.*, s.name as supplier_name
        FROM historical_prices hp
        LEFT JOIN suppliers s ON hp.supplier_id = s.id
        WHERE 1=1
    '''
    params = []
    
    if item_name:
        query += ' AND hp.item_name LIKE ?'
        params.append(f'%{item_name}%')
    
    query += ' ORDER BY hp.purchase_date DESC'
    
    cursor.execute(query, params)
    prices = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(p) for p in prices])

@app.route('/api/purchase-requests/<int:request_id>/compare', methods=['POST'])
def run_comparison(request_id):
    user_id = request.json.get('user_id', 1)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT pr.*, bs.total_budget, bs.used_budget, bs.name as budget_name
        FROM purchase_requests pr
        LEFT JOIN budget_subjects bs ON pr.budget_subject_id = bs.id
        WHERE pr.id = ?
    ''', (request_id,))
    request_data = cursor.fetchone()
    
    if not request_data:
        conn.close()
        return jsonify({'error': 'Request not found'}), 404
    
    cursor.execute('''
        SELECT sq.*, s.name as supplier_name
        FROM supplier_quotes sq
        LEFT JOIN suppliers s ON sq.supplier_id = s.id
        WHERE sq.purchase_request_id = ?
        ORDER BY sq.quote_amount
    ''', (request_id,))
    quotes = cursor.fetchall()
    
    if len(quotes) < 2:
        conn.close()
        return jsonify({'error': '至少需要2家供应商报价才能比价'}), 400
    
    price_anomalies = []
    budget_anomalies = []
    
    quotes_list = [dict(q) for q in quotes]
    avg_price = sum(q['quote_amount'] for q in quotes_list) / len(quotes_list)
    min_price = min(q['quote_amount'] for q in quotes_list)
    max_price = max(q['quote_amount'] for q in quotes_list)
    
    for quote in quotes_list:
        deviation = (quote['quote_amount'] - avg_price) / avg_price * 100
        if abs(deviation) > 20:
            price_anomalies.append({
                'supplier_id': quote['supplier_id'],
                'supplier_name': quote['supplier_name'],
                'quote_amount': quote['quote_amount'],
                'deviation': round(deviation, 2),
                'type': '价格偏离超过20%'
            })
    
    estimated_amount = request_data['estimated_amount']
    remaining_budget = request_data['total_budget'] - request_data['used_budget']
    
    if min_price > estimated_amount:
        budget_anomalies.append({
            'type': '超出预算',
            'message': f'最低报价{min_price}元超出预估金额{estimated_amount}元'
        })
    
    if min_price > remaining_budget:
        budget_anomalies.append({
            'type': '预算不足',
            'message': f'最低报价{min_price}元，科目剩余预算{remaining_budget}元'
        })
    
    recommended = quotes_list[0]
    
    comparison_summary = f'''比价结果：
    共收到{len(quotes_list)}家供应商报价
    最低报价：{recommended['supplier_name']} - {min_price}元
    最高报价：{max_price}元
    平均报价：{round(avg_price, 2)}元
    预算科目：{request_data['budget_name']}
    预估金额：{estimated_amount}元
    剩余预算：{remaining_budget}元
    '''
    
    if price_anomalies:
        comparison_summary += f'注意：发现{len(price_anomalies)}项价格异常\n'
    if budget_anomalies:
        comparison_summary += f'注意：发现{len(budget_anomalies)}项预算异常\n'
    
    try:
        cursor.execute('SELECT id FROM comparison_results WHERE purchase_request_id = ?', (request_id,))
        existing = cursor.fetchone()
        
        if existing:
            cursor.execute('''
                UPDATE comparison_results 
                SET recommended_supplier_id = ?, final_price = ?, comparison_summary = ?,
                    price_anomalies = ?, budget_anomalies = ?
                WHERE purchase_request_id = ?
            ''', (
                recommended['supplier_id'],
                min_price,
                comparison_summary,
                json.dumps(price_anomalies, ensure_ascii=False),
                json.dumps(budget_anomalies, ensure_ascii=False),
                request_id
            ))
        else:
            cursor.execute('''
                INSERT INTO comparison_results 
                (purchase_request_id, recommended_supplier_id, final_price, comparison_summary, price_anomalies, budget_anomalies)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                request_id,
                recommended['supplier_id'],
                min_price,
                comparison_summary,
                json.dumps(price_anomalies, ensure_ascii=False),
                json.dumps(budget_anomalies, ensure_ascii=False)
            ))
        
        cursor.execute('''
            INSERT INTO approvals (purchase_request_id, approver_id, approval_level, status)
            SELECT ?, ?, 1, 'pending'
            WHERE NOT EXISTS (SELECT 1 FROM approvals WHERE purchase_request_id = ? AND approval_level = 1)
        ''', (request_id, 4, request_id))
        
        cursor.execute('''
            INSERT INTO approvals (purchase_request_id, approver_id, approval_level, status)
            SELECT ?, ?, 2, 'pending'
            WHERE NOT EXISTS (SELECT 1 FROM approvals WHERE purchase_request_id = ? AND approval_level = 2)
        ''', (request_id, 5, request_id))
        
        conn.commit()
        
        calculate_status(request_id)
        
        log_audit('comparison_results', request_id, 'completed', None, 'completed', user_id, '比价完成')
        
        conn.close()
        return jsonify({
            'message': '比价完成',
            'recommended_supplier': recommended['supplier_name'],
            'final_price': min_price,
            'price_anomalies': price_anomalies,
            'budget_anomalies': budget_anomalies
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/approvals/<int:approval_id>', methods=['PUT'])
def process_approval(approval_id):
    data = request.json
    status = data['status']
    comments = data.get('comments', '')
    user_id = data.get('user_id', 1)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT purchase_request_id FROM approvals WHERE id = ?', (approval_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return jsonify({'error': 'Approval not found'}), 404
        
        purchase_request_id = result['purchase_request_id']
        
        cursor.execute('''
            UPDATE approvals 
            SET status = ?, comments = ?, approved_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, comments, approval_id))
        
        conn.commit()
        
        calculate_status(purchase_request_id)
        
        log_audit('approvals', purchase_request_id, 'status', 'pending', status, user_id, comments)
        
        conn.close()
        return jsonify({'message': '审批处理成功'})
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/export/report')
def export_report():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    status = request.args.get('status')
    department = request.args.get('department')
    responsible_id = request.args.get('responsible_id')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT 
            pr.request_no as '申请编号',
            pr.title as '标题',
            pr.department as '部门',
            u.name as '申请人',
            bs.name as '预算科目',
            pr.estimated_amount as '预估金额',
            cr.final_price as '最终价格',
            pr.status as '状态',
            pr.priority as '优先级',
            pr.created_at as '创建时间',
            pr.updated_at as '处理时间',
            a_u.name as '处理人'
        FROM purchase_requests pr
        LEFT JOIN users u ON pr.requester_id = u.id
        LEFT JOIN budget_subjects bs ON pr.budget_subject_id = bs.id
        LEFT JOIN comparison_results cr ON pr.id = cr.purchase_request_id
        LEFT JOIN approvals a ON pr.id = a.purchase_request_id
        LEFT JOIN users a_u ON a.approver_id = a_u.id
        WHERE 1=1
    '''
    params = []
    
    if start_date:
        query += ' AND pr.created_at >= ?'
        params.append(start_date)
    
    if end_date:
        query += ' AND pr.created_at <= ?'
        params.append(end_date)
    
    if status:
        query += ' AND pr.status = ?'
        params.append(status)
    
    if department:
        query += ' AND pr.department = ?'
        params.append(department)
    
    if responsible_id:
        query += ' AND (pr.requester_id = ? OR a.approver_id = ?)'
        params.extend([responsible_id, responsible_id])
    
    query += ' ORDER BY pr.created_at DESC'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    df = pd.DataFrame(rows, columns=[desc[0] for desc in cursor.description])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='采购报表')
    
    output.seek(0)
    conn.close()
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'采购比价报表_{datetime.now().strftime("%Y%m%d")}.xlsx'
    )

@app.route('/api/users')
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users ORDER BY name')
    users = cursor.fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/departments')
def get_departments():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT department FROM purchase_requests WHERE department IS NOT NULL')
    depts = cursor.fetchall()
    conn.close()
    return jsonify([d['department'] for d in depts])

if __name__ == '__main__':
    init_db()
    insert_sample_data()
    app.run(debug=True, host='0.0.0.0', port=5001)
